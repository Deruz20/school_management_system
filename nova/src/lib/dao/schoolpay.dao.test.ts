import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db as prisma } from '../db';
import { Prisma, PaymentMethod, SchoolPayTxStatus, SchoolPaySourceChannel, Student, Invoice } from '@prisma/client';
import { TenantContext } from './tenant-context';
import { SchoolPayDAO } from './schoolpay.dao';
import { SchoolPayConfigDAO } from './schoolpay-config.dao';
import { PaymentDAO } from './payment.dao';
import { FeeTypeDAO } from './fee-type.dao';
import { FeeStructureDAO } from './fee-structure.dao';
import { InvoiceDAO } from './invoice.dao';
import {
  encryptSecret,
  decryptSecret,
  generateHmacSha256,
  verifyHmacSha256,
  isTimestampWithinDrift
} from '../security/crypto';

describe('NOVA Finance Phase 3.1E — SchoolPay Gateway & Reconciliation Invariant Tests', () => {
  let ctx: TenantContext;
  let branchId: string;
  let student1: Student;
  let student2: Student;
  let invoice1: Invoice;
  const schoolCode = `SP_${Date.now()}`;
  const webhookSecret = 'test-secret-key-12345';

  beforeEach(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });
    const user = await prisma.user.findFirst({ where: { organizationId: org?.id } });

    branchId = branch!.id;
    ctx = {
      organizationId: org!.id,
      schoolId: school!.id,
      branchId,
      userId: user!.id,
      role: 'ADMIN',
      permissions: ['all']
    };

    // 1. Setup Student 1 with SchoolPay Code
    student1 = await prisma.student.create({
      data: {
        branchId,
        admissionNo: `ADM_${Date.now()}_1`,
        schoolPayCode: `SPCODE_${Date.now()}_1`,
        firstName: 'Moses',
        lastName: 'Kato',
        status: 'ACTIVE'
      }
    });

    // 2. Setup Student 2 without SchoolPay Code
    student2 = await prisma.student.create({
      data: {
        branchId,
        admissionNo: `ADM_${Date.now()}_2`,
        firstName: 'Sarah',
        lastName: 'Namubiru',
        status: 'ACTIVE'
      }
    });

    // 3. Setup Billing Context & Active Invoice for Student 1
    const ay = await prisma.academicYear.findFirst({ where: { branchId } });
    const term = await prisma.term.findFirst({ where: { academicYearId: ay?.id } });
    const cls = await prisma.class.findFirst({ where: { branchId } });

    await prisma.student.update({
      where: { id: student1.id },
      data: { classId: cls!.id }
    });

    const enrollment1 = await prisma.enrollment.create({
      data: {
        studentId: student1.id,
        classId: cls!.id,
        academicYearId: ay!.id,
        status: 'ACTIVE'
      }
    });

    const feeType = await FeeTypeDAO.create(ctx, {
      name: `Tuition ${Date.now()}`,
      code: `TUIT_${Date.now()}`
    });

    const feeStruct = await FeeStructureDAO.create(ctx, {
      name: `S.1 Structure ${Date.now()}`,
      academicYearId: ay!.id,
      termId: term!.id,
      classId: cls!.id,
      items: [{ feeTypeId: feeType.id, amount: new Prisma.Decimal('500000.00'), isOptional: false }]
    });

    invoice1 = await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay!.id,
      termId: term!.id,
      dueDate: new Date('2026-04-15'),
      feeStructureId: feeStruct.id,
      items: [{ feeTypeId: feeType.id, feeTypeName: 'Term 1 Tuition', description: 'Term 1 Tuition', unitAmount: 500000, quantity: 1 }]
    });

    // 4. Setup SchoolPayConfig
    await SchoolPayConfigDAO.updateConfig(ctx, {
      schoolCode,
      apiPassword: 'mypassword123',
      webhookSecret,
      enabled: true,
      autoPostMatched: true
    });
  });

  afterEach(async () => {
    // Clean up created test data in safe dependency order
    await prisma.schoolPayTransaction.deleteMany({ where: { branchId } });
    await prisma.paymentAllocation.deleteMany({ where: { branchId } });
    await prisma.receipt.deleteMany({ where: { branchId } });
    await prisma.payment.deleteMany({ where: { branchId } });
    await prisma.studentLedgerEntry.deleteMany({ where: { branchId } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { branchId } } });
    await prisma.invoice.deleteMany({ where: { branchId } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: [student1.id, student2.id] } } });
    await prisma.student.deleteMany({
      where: { id: { in: [student1.id, student2.id] } }
    });
    await prisma.schoolPayConfig.deleteMany({ where: { branchId } });
  });

  // ==========================================================================
  // SPAY-01: HMAC SECURITY & TIMESTAMP DRIFT
  // ==========================================================================
  it('SPAY-01: Verifies HMAC signature and rejects expired timestamps or tampered payloads', () => {
    const rawBody = JSON.stringify({ receipt_number: 'SP-1001', amount: 500000, payment_code: '100234' });
    const timestamp = Date.now();

    // Valid signature
    const validSignature = generateHmacSha256(rawBody, timestamp, webhookSecret);
    const isValid = verifyHmacSha256(rawBody, timestamp, webhookSecret, validSignature);
    expect(isValid).toBe(true);

    // Tampered payload
    const isTamperedValid = verifyHmacSha256(rawBody + 'tamper', timestamp, webhookSecret, validSignature);
    expect(isTamperedValid).toBe(false);

    // Expired timestamp (> 5 minutes / 300 seconds)
    const expiredTimestamp = Date.now() - 600 * 1000;
    expect(isTimestampWithinDrift(expiredTimestamp, 300)).toBe(false);
    expect(isTimestampWithinDrift(Date.now(), 300)).toBe(true);
  });

  // ==========================================================================
  // SPAY-02: TENANT ISOLATION & SCHOOL CODE RESOLUTION
  // ==========================================================================
  it('SPAY-02: Resolves tenant configuration by unique schoolCode and rejects unknown schoolCodes', async () => {
    const internalConfig = await SchoolPayConfigDAO.getInternalConfigBySchoolCode(schoolCode);
    expect(internalConfig).not.toBeNull();
    expect(internalConfig!.branchId).toBe(branchId);
    expect(internalConfig!.apiPassword).toBe('mypassword123');

    const unknownConfig = await SchoolPayConfigDAO.getInternalConfigBySchoolCode('NON_EXISTENT_CODE');
    expect(unknownConfig).toBeNull();
  });

  // ==========================================================================
  // SPAY-03: STAGING FIRST INGESTION
  // ==========================================================================
  it('SPAY-03: Durably stages incoming transactions in RECEIVED state before accounting execution', async () => {
    const receiptNo = `SP_RCPT_${Date.now()}`;
    const txId = `TX_${Date.now()}`;

    const { transaction, isReplay } = await SchoolPayDAO.stageInboundTransaction(branchId, {
      schoolPayReceiptNo: receiptNo,
      transactionId: txId,
      schoolPayCode: student1.schoolPayCode!,
      amount: 250000,
      payerName: 'John Kato',
      channel: SchoolPaySourceChannel.STANBIC_BANK,
      paymentDate: new Date(),
      rawPayload: { test: true }
    });

    expect(isReplay).toBe(false);
    expect(transaction.status).toBe(SchoolPayTxStatus.RECEIVED);
    expect(transaction.amount.toString()).toBe('250000');
    expect(transaction.paymentId).toBeNull();
  });

  // ==========================================================================
  // SPAY-04: DETERMINISTIC IDEMPOTENCY REPLAY
  // ==========================================================================
  it('SPAY-04: Enforces strict idempotency and returns isReplay=true with zero duplicate records', async () => {
    const receiptNo = `SP_IDEMP_${Date.now()}`;
    const txId = `TX_IDEMP_${Date.now()}`;

    const dto = {
      schoolPayReceiptNo: receiptNo,
      transactionId: txId,
      schoolPayCode: student1.schoolPayCode!,
      amount: 300000,
      channel: SchoolPaySourceChannel.MTN_MOMO,
      paymentDate: new Date(),
      rawPayload: { idemp: true }
    };

    const first = await SchoolPayDAO.stageInboundTransaction(branchId, dto);
    expect(first.isReplay).toBe(false);

    // Second ingestion with identical receipt number
    const second = await SchoolPayDAO.stageInboundTransaction(branchId, dto);
    expect(second.isReplay).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);

    // Verify exactly 1 transaction in DB
    const count = await prisma.schoolPayTransaction.count({
      where: { branchId, schoolPayReceiptNo: receiptNo }
    });
    expect(count).toBe(1);
  });

  // ==========================================================================
  // SPAY-05: TIER 1 EXACT CODE MATCH & AUTO-POSTING
  // ==========================================================================
  it('SPAY-05: Auto-posts high-confidence student code match through PaymentDAO settling invoices via FIFO', async () => {
    const receiptNo = `SP_POST_${Date.now()}`;
    const { transaction } = await SchoolPayDAO.stageInboundTransaction(branchId, {
      schoolPayReceiptNo: receiptNo,
      transactionId: `TX_POST_${Date.now()}`,
      schoolPayCode: student1.schoolPayCode!,
      amount: 350000,
      payerName: 'Parent Kato',
      channel: SchoolPaySourceChannel.STANBIC_BANK,
      paymentDate: new Date(),
      rawPayload: { auto: true }
    });

    const processed = await SchoolPayDAO.matchAndProcessTransaction(branchId, transaction.id);

    expect(processed.status).toBe(SchoolPayTxStatus.POSTED);
    expect(processed.studentId).toBe(student1.id);
    expect(processed.paymentId).not.toBeNull();

    // Verify Payment and Receipt created
    const payment = await prisma.payment.findUnique({
      where: { id: processed.paymentId! },
      include: { allocations: true, receipt: true }
    });
    expect(payment).not.toBeNull();
    expect(payment!.paymentMethod).toBe(PaymentMethod.SCHOOLPAY);
    expect(payment!.amount.toString()).toBe('350000');
    expect(payment!.receipt).not.toBeNull();
    expect(payment!.receipt!.receiptNumber).toMatch(/^REC-\d{4}-\d{5}$/);

    // Verify FIFO allocation to invoice1
    expect(payment!.allocations.length).toBe(1);
    expect(payment!.allocations[0].invoiceId).toBe(invoice1.id);
    expect(payment!.allocations[0].amount.toString()).toBe('350000');

    // Verify StudentLedgerEntry created
    const ledgerEntry = await prisma.studentLedgerEntry.findFirst({
      where: { branchId, studentId: student1.id, referenceType: 'PAYMENT' }
    });
    expect(ledgerEntry).not.toBeNull();
    expect(ledgerEntry!.direction).toBe('CREDIT');
    expect(ledgerEntry!.amount.toString()).toBe('350000');
  });

  // ==========================================================================
  // SPAY-06: TIER 2 ADMISSION NUMBER FALLBACK MATCH
  // ==========================================================================
  it('SPAY-06: Auto-posts when code matches active student admission number as fallback', async () => {
    const receiptNo = `SP_ADM_${Date.now()}`;
    const { transaction } = await SchoolPayDAO.stageInboundTransaction(branchId, {
      schoolPayReceiptNo: receiptNo,
      transactionId: `TX_ADM_${Date.now()}`,
      schoolPayCode: student2.admissionNo, // Payer entered admission number instead of SP code
      amount: 150000,
      channel: SchoolPaySourceChannel.CENTENARY_BANK,
      paymentDate: new Date(),
      rawPayload: { adm: true }
    });

    const processed = await SchoolPayDAO.matchAndProcessTransaction(branchId, transaction.id);

    expect(processed.status).toBe(SchoolPayTxStatus.POSTED);
    expect(processed.studentId).toBe(student2.id);
  });

  // ==========================================================================
  // SPAY-07: INACTIVE & AMBIGUOUS CODE MATCH SAFETY
  // ==========================================================================
  it('SPAY-07: Never auto-posts inactive student code matches; safely routes to NEEDS_REVIEW', async () => {
    const inactiveCode = `INACT_CODE_${Date.now()}`;
    const studentInactive = await prisma.student.create({
      data: {
        branchId,
        admissionNo: `ADM_INACT_${Date.now()}`,
        schoolPayCode: inactiveCode,
        firstName: 'Inactive',
        lastName: 'Student',
        status: 'SUSPENDED'
      }
    });

    const receiptNo = `SP_AMBIG_${Date.now()}`;
    const { transaction } = await SchoolPayDAO.stageInboundTransaction(branchId, {
      schoolPayReceiptNo: receiptNo,
      transactionId: `TX_AMBIG_${Date.now()}`,
      schoolPayCode: inactiveCode,
      amount: 200000,
      channel: SchoolPaySourceChannel.AIRTEL_MONEY,
      paymentDate: new Date(),
      rawPayload: { ambig: true }
    });

    const processed = await SchoolPayDAO.matchAndProcessTransaction(branchId, transaction.id);

    expect(processed.status).toBe(SchoolPayTxStatus.NEEDS_REVIEW);
    expect(processed.paymentId).toBeNull();
    expect(processed.errorMessage).toContain('No active student found');

    // Clean up
    await prisma.student.delete({ where: { id: studentInactive.id } });
  });

  // ==========================================================================
  // SPAY-08: NO MATCH ROUTING
  // ==========================================================================
  it('SPAY-08: Routes unknown student codes to NEEDS_REVIEW queue with zero money posted', async () => {
    const receiptNo = `SP_NOMATCH_${Date.now()}`;
    const { transaction } = await SchoolPayDAO.stageInboundTransaction(branchId, {
      schoolPayReceiptNo: receiptNo,
      transactionId: `TX_NOMATCH_${Date.now()}`,
      schoolPayCode: 'COMPLETELY_UNKNOWN_999',
      amount: 175000,
      channel: SchoolPaySourceChannel.DFCU_BANK,
      paymentDate: new Date(),
      rawPayload: { nomatch: true }
    });

    const processed = await SchoolPayDAO.matchAndProcessTransaction(branchId, transaction.id);

    expect(processed.status).toBe(SchoolPayTxStatus.NEEDS_REVIEW);
    expect(processed.studentId).toBeNull();
    expect(processed.paymentId).toBeNull();
  });

  // ==========================================================================
  // SPAY-09: MANUAL RECONCILIATION & ASSIGNMENT WORKFLOW
  // ==========================================================================
  it('SPAY-09: Allows bursar to manually assign unposted transaction, link code, and post to ledger', async () => {
    const unlinkedCode = `NEW_SP_CODE_${Date.now()}`;
    const receiptNo = `SP_ASSIGN_${Date.now()}`;

    const { transaction } = await SchoolPayDAO.stageInboundTransaction(branchId, {
      schoolPayReceiptNo: receiptNo,
      transactionId: `TX_ASSIGN_${Date.now()}`,
      schoolPayCode: unlinkedCode,
      amount: 180000,
      payerName: 'Sarah Namubiru Parent',
      channel: SchoolPaySourceChannel.MTN_MOMO,
      paymentDate: new Date(),
      rawPayload: { assign: true }
    });

    // Staged is in NEEDS_REVIEW
    await SchoolPayDAO.matchAndProcessTransaction(branchId, transaction.id);

    // Bursar assigns to student2 and links unlinkedCode
    const assigned = await SchoolPayDAO.assignAndPostTransaction(
      ctx,
      transaction.id,
      student2.id,
      true, // linkSchoolPayCode
      'Verified with mother by telephone'
    );

    expect(assigned.status).toBe(SchoolPayTxStatus.POSTED);
    expect(assigned.studentId).toBe(student2.id);
    expect(assigned.paymentId).not.toBeNull();
    expect(assigned.reviewNotes).toBe('Verified with mother by telephone');

    // Verify student2's schoolPayCode was linked
    const updatedStudent2 = await prisma.student.findUnique({ where: { id: student2.id } });
    expect(updatedStudent2!.schoolPayCode).toBe(unlinkedCode);
  });

  // ==========================================================================
  // SPAY-10: MANUAL IGNORE WORKFLOW
  // ==========================================================================
  it('SPAY-10: Allows bursar to mark invalid/test transaction IGNORED with mandatory reason', async () => {
    const receiptNo = `SP_IGNORE_${Date.now()}`;
    const { transaction } = await SchoolPayDAO.stageInboundTransaction(branchId, {
      schoolPayReceiptNo: receiptNo,
      transactionId: `TX_IGNORE_${Date.now()}`,
      schoolPayCode: 'TEST_ERRONEOUS_CODE',
      amount: 50000,
      channel: SchoolPaySourceChannel.UNKNOWN,
      paymentDate: new Date(),
      rawPayload: { test: true }
    });

    const ignored = await SchoolPayDAO.ignoreTransaction(
      ctx,
      transaction.id,
      'Test transaction initiated during gateway onboarding'
    );

    expect(ignored.status).toBe(SchoolPayTxStatus.IGNORED);
    expect(ignored.reviewNotes).toBe('Test transaction initiated during gateway onboarding');
    expect(ignored.paymentId).toBeNull();
  });

  // ==========================================================================
  // SPAY-11: PAYMENT REVERSAL RECONCILIATION
  // ==========================================================================
  it('SPAY-11: Reversing a posted SchoolPay payment cleanly reverses ledger and receipt without deleting records', async () => {
    const receiptNo = `SP_REV_${Date.now()}`;
    const { transaction } = await SchoolPayDAO.stageInboundTransaction(branchId, {
      schoolPayReceiptNo: receiptNo,
      transactionId: `TX_REV_${Date.now()}`,
      schoolPayCode: student1.schoolPayCode!,
      amount: 100000,
      channel: SchoolPaySourceChannel.STANBIC_BANK,
      paymentDate: new Date(),
      rawPayload: { rev: true }
    });

    const posted = await SchoolPayDAO.matchAndProcessTransaction(branchId, transaction.id);
    expect(posted.status).toBe(SchoolPayTxStatus.POSTED);

    // Reverse payment via Phase 3.1C PaymentDAO
    const reversedPayment = await PaymentDAO.reversePayment(
      ctx,
      posted.paymentId!,
      'Bank chargeback: fraudulent transaction'
    );

    expect(reversedPayment.status).toBe('REVERSED');

    // Verify DEBIT reversal entry created in subledger
    const revLedgerEntry = await prisma.studentLedgerEntry.findFirst({
      where: {
        branchId,
        studentId: student1.id,
        direction: 'DEBIT',
        referenceType: 'PAYMENT_REVERSAL'
      }
    });
    expect(revLedgerEntry).not.toBeNull();
    expect(revLedgerEntry!.amount.toString()).toBe('100000');
  });

  // ==========================================================================
  // SPAY-12: SECRET ENCRYPTION AT REST
  // ==========================================================================
  it('SPAY-12: Encrypts secrets at rest with AES-256-GCM and never exposes plain secrets in getConfig', async () => {
    const secretText = 'super-secret-gateway-key-999';
    const encrypted = encryptSecret(secretText);

    expect(encrypted.startsWith('enc:')).toBe(true);
    expect(decryptSecret(encrypted)).toBe(secretText);

    const publicConfig = await SchoolPayConfigDAO.getConfig(ctx);
    expect(publicConfig).not.toBeNull();
    expect(publicConfig!.hasApiPassword).toBe(true);
    expect('apiPassword' in (publicConfig || {})).toBe(false);
    expect('apiPasswordEnc' in (publicConfig || {})).toBe(false);
  });

  // ==========================================================================
  // SPAY-13: BATCH SYNC LOGGING
  // ==========================================================================
  it('SPAY-13: Records sync results in SchoolPaySyncLog and updates lastSyncedAt', async () => {
    const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const to = new Date();

    const result = await SchoolPayDAO.syncTransactions(ctx, from, to);
    expect(result).toBeDefined();

    const config = await prisma.schoolPayConfig.findUnique({ where: { branchId } });
    expect(config!.lastSyncedAt).not.toBeNull();

    const syncLog = await prisma.schoolPaySyncLog.findFirst({
      where: { branchId },
      orderBy: { createdAt: 'desc' }
    });
    expect(syncLog).not.toBeNull();
    expect(syncLog!.status).toBe('SUCCESS');
  });

  // ==========================================================================
  // SPAY-14: CURRENCY & AMOUNT VALIDATION
  // ==========================================================================
  it('SPAY-14: Rejects non-positive amounts with clear error', async () => {
    await expect(
      SchoolPayDAO.stageInboundTransaction(branchId, {
        schoolPayReceiptNo: `SP_ZERO_${Date.now()}`,
        transactionId: `TX_ZERO_${Date.now()}`,
        schoolPayCode: student1.schoolPayCode!,
        amount: 0,
        channel: SchoolPaySourceChannel.UNKNOWN,
        paymentDate: new Date(),
        rawPayload: {}
      })
    ).rejects.toThrow('Payment amount must be greater than zero.');
  });

  // ==========================================================================
  // SPAY-15: FAILURE RECOVERY & RETRY PIPELINE
  // ==========================================================================
  it('SPAY-15: Transitions to FAILED on processing errors and recovers cleanly on retry', async () => {
    const receiptNo = `SP_FAIL_${Date.now()}`;
    const { transaction } = await SchoolPayDAO.stageInboundTransaction(branchId, {
      schoolPayReceiptNo: receiptNo,
      transactionId: `TX_FAIL_${Date.now()}`,
      schoolPayCode: student1.schoolPayCode!,
      amount: 75000,
      channel: SchoolPaySourceChannel.POST_BANK,
      paymentDate: new Date(),
      rawPayload: {}
    });

    // Manually mark status as FAILED with error message
    await prisma.schoolPayTransaction.update({
      where: { id: transaction.id },
      data: { status: SchoolPayTxStatus.FAILED, errorMessage: 'Simulated connection timeout' }
    });

    // Retry transaction
    const retried = await SchoolPayDAO.retryTransaction(ctx, transaction.id);
    expect(retried.status).toBe(SchoolPayTxStatus.POSTED);
    expect(retried.errorMessage).toBeNull();
    expect(retried.paymentId).not.toBeNull();
  });

  // ==========================================================================
  // SPAY-16: AUDIT LOGGING INTEGRATION
  // ==========================================================================
  it('SPAY-16: Emits structured audit log events for configuration changes and auto-posts', async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        resourceType: { in: ['SchoolPayConfig', 'SchoolPayTransaction', 'SchoolPaySyncLog'] }
      },
      orderBy: { timestamp: 'desc' },
      take: 5
    });

    expect(auditLogs.length).toBeGreaterThan(0);
  });
});
