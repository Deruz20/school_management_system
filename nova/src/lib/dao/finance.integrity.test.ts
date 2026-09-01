import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentDAO } from './payment.dao';
import { LedgerDAO } from './ledger.dao';
import { InvoiceDAO } from './invoice.dao';
import { DiscountDAO } from './discount.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  AllocationStatus,
  ReceiptStatus,
  LedgerDirection,
  LedgerEntryType,
  Prisma,
  Student,
  AcademicYear,
  Term,
  Class,
  Enrollment,
  FeeType,
  FeeStructure
} from '@prisma/client';

describe('NOVA Finance Phase 3.1C — Financial Integrity & Adversarial Audit Suite', () => {
  let branchId: string;
  let ctx: TenantContext;
  let user1Id: string;

  let class1: Class;
  let ay1: AcademicYear;
  let term1: Term;
  let student1: Student;
  let enrollment1: Enrollment;
  let feeType1: FeeType;
  let feeType2: FeeType;
  let feeStructure1: FeeStructure;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `AuditOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: 'Audit High School', organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: 'Main Campus', schoolId: school.id }
    });
    branchId = branch.id;

    const user1 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `audit_bursar_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: 'hashed',
        firstName: 'Authoritative',
        lastName: 'Auditor',
        userType: 'STAFF'
      }
    });
    user1Id = user1.id;

    ctx = {
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId,
      userId: user1Id,
      role: 'Admin',
      permissions: [
        'fees:read',
        'fees:write',
        'fees:structure:write',
        'fees:payments:write',
        'fees:payments:reverse',
        'fees:ledger:read',
        'fees:ledger:adjust'
      ]
    };

    class1 = await db.class.create({
      data: { branchId, name: 'Senior 3' }
    });

    ay1 = await db.academicYear.create({
      data: {
        branchId,
        name: '2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31')
      }
    });

    term1 = await db.term.create({
      data: {
        academicYearId: ay1.id,
        name: 'Term 1',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-04-15')
      }
    });

    student1 = await db.student.create({
      data: {
        branchId,
        admissionNo: `AUDIT-S1-${Date.now()}`,
        firstName: 'Sarah',
        lastName: 'Nalwanga',
        classId: class1.id
      }
    });

    enrollment1 = await db.enrollment.create({
      data: {
        studentId: student1.id,
        classId: class1.id,
        academicYearId: ay1.id,
        status: 'ACTIVE'
      }
    });

    feeType1 = await db.feeType.create({
      data: {
        branchId,
        name: 'Tuition Fee',
        code: `TUI_${Date.now()}`
      }
    });

    feeType2 = await db.feeType.create({
      data: {
        branchId,
        name: 'Library Levy',
        code: `LIB_${Date.now()}`
      }
    });

    feeStructure1 = await db.feeStructure.create({
      data: {
        branchId,
        classId: class1.id,
        academicYearId: ay1.id,
        termId: term1.id,
        name: 'S3 Standard Fees',
        currency: 'UGX',
        items: {
          create: [
            { feeTypeId: feeType1.id, amount: new Prisma.Decimal('1000000.00'), isOptional: false },
            { feeTypeId: feeType2.id, amount: new Prisma.Decimal('200000.00'), isOptional: false }
          ]
        }
      }
    });
  });

  // =========================================================================
  // 1. DISCOUNT + FULL PAYMENT RECONCILIATION
  // =========================================================================
  it('ADV-01: Reconciles Discount + Gross Charge + Full Payment exactly on subledger', async () => {
    // 1. Create 20% discount on Tuition (20% of 1,000,000 = 200,000)
    await DiscountDAO.create(ctx, {
      studentId: student1.id,
      feeTypeId: feeType1.id,
      discountType: 'PERCENTAGE',
      value: 20,
      reason: 'Academic Merit 20% Tuition'
    });

    // 2. Generate invoice from FeeStructure (Gross = 1,200,000; Discount = 200,000; Net = 1,000,000)
    const invoice = await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      feeStructureId: feeStructure1.id,
      dueDate: new Date(Date.now() + 86400000)
    });

    expect(new Prisma.Decimal(invoice.grossAmount).toFixed(2)).toBe('1200000.00');
    expect(new Prisma.Decimal(invoice.discountAmount).toFixed(2)).toBe('200000.00');
    expect(new Prisma.Decimal(invoice.netAmount).toFixed(2)).toBe('1000000.00');

    // Verify Subledger after billing
    const balAfterBilling = await LedgerDAO.getBalance(ctx, student1.id);
    expect(balAfterBilling.totalDebits.toFixed(2)).toBe('1200000.00');
    expect(balAfterBilling.totalCredits.toFixed(2)).toBe('200000.00');
    expect(balAfterBilling.balance.toFixed(2)).toBe('1000000.00');

    // 3. Pay exact net amount 1,000,000
    const payRes = await PaymentDAO.recordPayment(ctx, {
      studentId: student1.id,
      amount: '1000000.00',
      paymentMethod: PaymentMethod.MTN_MOMO,
      externalReference: 'MOMO-PAY-01'
    });

    expect(payRes.payment.status).toBe(PaymentStatus.COMPLETED);
    expect(payRes.payment.receipt?.status).toBe(ReceiptStatus.ISSUED);

    // Verify Subledger after payment
    const balAfterPay = await LedgerDAO.getBalance(ctx, student1.id);
    expect(balAfterPay.totalDebits.toFixed(2)).toBe('1200000.00');
    expect(balAfterPay.totalCredits.toFixed(2)).toBe('1200000.00');
    expect(balAfterPay.balance.toFixed(2)).toBe('0.00');

    // Verify Invoice state
    const invRefreshed = await db.invoice.findUnique({
      where: { id: invoice.id },
      include: { allocations: { where: { status: AllocationStatus.ACTIVE } } }
    });
    expect(invRefreshed?.status).toBe(InvoiceStatus.PAID);
    const paidSum = invRefreshed!.allocations.reduce((acc, a) => acc.add(a.amount), new Prisma.Decimal(0));
    expect(paidSum.toFixed(2)).toBe('1000000.00');
  });

  // =========================================================================
  // 2. PAYMENT REVERSAL AFTER LATER PAYMENT
  // =========================================================================
  it('ADV-02: Handles Payment Reversal after later payments without corrupting surviving state', async () => {
    // Invoice 1: 500,000
    const inv1 = await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      dueDate: new Date('2026-02-01'),
      items: [{ feeTypeName: 'Tuition T1', unitAmount: '500000.00', quantity: 1 }]
    });

    // Invoice 2: 400,000
    const inv2 = await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      dueDate: new Date('2026-03-01'),
      items: [{ feeTypeName: 'Tuition T2', unitAmount: '400000.00', quantity: 1 }]
    });

    // Total debt: 900,000
    let bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('900000.00');

    // Payment 1: 500,000 (FIFO settles Invoice 1 -> PAID)
    const pay1 = await PaymentDAO.recordPayment(ctx, {
      studentId: student1.id,
      amount: '500000.00',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      externalReference: 'BANK-SLIP-001'
    });

    // Payment 2: 200,000 (FIFO settles Invoice 2 -> PARTIAL)
    const pay2 = await PaymentDAO.recordPayment(ctx, {
      studentId: student1.id,
      amount: '200000.00',
      paymentMethod: PaymentMethod.CASH
    });

    bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('200000.00');

    // Reverse Payment 1 (Bounced cheque / bank reversal)
    await PaymentDAO.reversePayment(ctx, pay1.payment.id, 'Bank slip dishonored');

    // Verify Payment 1 state
    const p1Db = await db.payment.findUnique({
      where: { id: pay1.payment.id },
      include: { receipt: true, allocations: true }
    });
    expect(p1Db?.status).toBe(PaymentStatus.REVERSED);
    expect(p1Db?.receipt?.status).toBe(ReceiptStatus.VOID);
    expect(p1Db?.allocations.every(a => a.status === AllocationStatus.REVERSED)).toBe(true);

    // Verify Payment 2 remains COMPLETED and ACTIVE
    const p2Db = await db.payment.findUnique({
      where: { id: pay2.payment.id },
      include: { receipt: true, allocations: true }
    });
    expect(p2Db?.status).toBe(PaymentStatus.COMPLETED);
    expect(p2Db?.receipt?.status).toBe(ReceiptStatus.ISSUED);
    expect(p2Db?.allocations[0].status).toBe(AllocationStatus.ACTIVE);

    // Verify Invoice 1 reverted to PENDING/OVERDUE because 0 active allocations survive
    const inv1Refreshed = await db.invoice.findUnique({
      where: { id: inv1.id },
      include: { allocations: { where: { status: AllocationStatus.ACTIVE } } }
    });
    expect(inv1Refreshed?.status).toBe(InvoiceStatus.OVERDUE);
    expect(inv1Refreshed?.allocations.length).toBe(0);

    // Verify Invoice 2 remains PARTIAL (200,000 active paid)
    const inv2Refreshed = await db.invoice.findUnique({
      where: { id: inv2.id },
      include: { allocations: { where: { status: AllocationStatus.ACTIVE } } }
    });
    expect(inv2Refreshed?.status).toBe(InvoiceStatus.PARTIAL);
    expect(inv2Refreshed?.allocations.reduce((acc, a) => acc.add(a.amount), new Prisma.Decimal(0)).toFixed(2)).toBe('200000.00');

    // Authoritative Student Balance: (500k + 400k + 500k reversal debit) - (500k + 200k) = 1400k - 700k = 700k
    bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('700000.00');
    // Outstanding invoices sum: inv1 (500k) + inv2 (200k) = 700k! Exactly reconciled.
  });

  // =========================================================================
  // 3. OVERPAYMENT THEN LATER INVOICE
  // =========================================================================
  it('ADV-03: Tracks advance overpayment credit and reconciles against subsequent invoices', async () => {
    // 1. Student pays 600,000 in advance with 0 invoices
    const pay = await PaymentDAO.recordPayment(ctx, {
      studentId: student1.id,
      amount: '600000.00',
      paymentMethod: PaymentMethod.SCHOOLPAY
    });

    expect(pay.payment.allocations.length).toBe(0);

    const paymentInfo = await PaymentDAO.getPayment(ctx, pay.payment.id);
    expect(paymentInfo.allocatedAmount.toFixed(2)).toBe('0.00');
    expect(paymentInfo.unallocatedAmount.toFixed(2)).toBe('600000.00');

    let bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('-600000.00'); // Advance Credit

    // 2. Later, issue invoice for 450,000
    await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      dueDate: new Date('2026-05-01'),
      items: [{ feeTypeName: 'Tuition T2', unitAmount: '450000.00', quantity: 1 }]
    });

    bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.totalDebits.toFixed(2)).toBe('450000.00');
    expect(bal.totalCredits.toFixed(2)).toBe('600000.00');
    expect(bal.balance.toFixed(2)).toBe('-150000.00'); // Remaining Advance Credit
  });

  // =========================================================================
  // 4. DUPLICATE PAYMENT REPLAY (IDEMPOTENCY)
  // =========================================================================
  it('ADV-04: Enforces strict idempotency and rejects duplicate ledger postings on replay', async () => {
    const idempotencyKey = `WEBHOOK_TX_${Date.now()}`;

    // Pass 1
    const res1 = await PaymentDAO.recordPayment(ctx, {
      studentId: student1.id,
      amount: '350000.00',
      paymentMethod: PaymentMethod.MTN_MOMO,
      idempotencyKey
    });
    expect(res1.isReplay).toBe(false);

    // Pass 2 (Duplicate Replay)
    const res2 = await PaymentDAO.recordPayment(ctx, {
      studentId: student1.id,
      amount: '350000.00',
      paymentMethod: PaymentMethod.MTN_MOMO,
      idempotencyKey
    });
    expect(res2.isReplay).toBe(true);
    expect(res2.payment.id).toBe(res1.payment.id);

    // Verify exactly 1 Payment row exists
    const paymentCount = await db.payment.count({
      where: { branchId, idempotencyKey }
    });
    expect(paymentCount).toBe(1);

    // Verify exactly 1 Receipt row exists
    const receiptCount = await db.receipt.count({
      where: { branchId, paymentId: res1.payment.id }
    });
    expect(receiptCount).toBe(1);

    // Verify exactly 1 StudentLedgerEntry exists
    const ledgerCount = await db.studentLedgerEntry.count({
      where: { branchId, referenceType: 'PAYMENT', referenceId: res1.payment.id }
    });
    expect(ledgerCount).toBe(1);

    // Balance reflects exactly 350,000 credit once
    const bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.totalCredits.toFixed(2)).toBe('350000.00');
  });

  // =========================================================================
  // 5. CONCURRENT PAYMENTS AGAINST SAME INVOICE
  // =========================================================================
  it('ADV-05: Serializes concurrent payments against the same student without over-allocating invoice', async () => {
    const invoice = await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      dueDate: new Date('2026-06-01'),
      items: [{ feeTypeName: 'Exam Fee', unitAmount: '500000.00', quantity: 1 }]
    });

    // Fire 2 concurrent payments of 300,000 each (Total 600,000 against 500,000 invoice)
    const [p1, p2] = await Promise.all([
      PaymentDAO.recordPayment(ctx, {
        studentId: student1.id,
        amount: '300000.00',
        paymentMethod: PaymentMethod.CASH,
        idempotencyKey: `CONCURRENT_P1_${Date.now()}`
      }),
      PaymentDAO.recordPayment(ctx, {
        studentId: student1.id,
        amount: '300000.00',
        paymentMethod: PaymentMethod.MTN_MOMO,
        idempotencyKey: `CONCURRENT_P2_${Date.now()}`
      })
    ]);

    expect(p1.payment.status).toBe(PaymentStatus.COMPLETED);
    expect(p2.payment.status).toBe(PaymentStatus.COMPLETED);

    // Verify Invoice allocations total EXACTLY 500,000 (never 600,000)
    const invRefreshed = await db.invoice.findUnique({
      where: { id: invoice.id },
      include: { allocations: { where: { status: AllocationStatus.ACTIVE } } }
    });
    expect(invRefreshed?.status).toBe(InvoiceStatus.PAID);
    const totalAllocatedToInvoice = invRefreshed!.allocations.reduce(
      (acc, a) => acc.add(a.amount),
      new Prisma.Decimal(0)
    );
    expect(totalAllocatedToInvoice.toFixed(2)).toBe('500000.00');

    // Verify Student subledger balance = 500,000 - 600,000 = -100,000 (100k advance credit)
    const bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('-100000.00');
  });

  // =========================================================================
  // 6. INVOICE VOID WITH DISCOUNT
  // =========================================================================
  it('ADV-06: Reverses exact gross and bursary ledger components when an unallocated invoice is voided', async () => {
    // 1. Create discount 100,000
    await DiscountDAO.create(ctx, {
      studentId: student1.id,
      feeTypeId: feeType1.id,
      discountType: 'FIXED_AMOUNT',
      value: 100000,
      reason: 'Staff Child Discount'
    });

    // 2. Issue invoice: Gross 1,200,000, Discount 100,000, Net 1,100,000
    const invoice = await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      feeStructureId: feeStructure1.id,
      dueDate: new Date('2026-07-01')
    });

    let bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('1100000.00');

    // 3. Void invoice
    await InvoiceDAO.voidInvoice(ctx, invoice.id, 'Wrong student billed in error');

    // 4. Verify subledger balance returns to exactly 0.00
    bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.totalDebits.toFixed(2)).toBe('1300000.00'); // 1,200,000 gross + 100,000 bursary void debit
    expect(bal.totalCredits.toFixed(2)).toBe('1300000.00'); // 100,000 bursary + 1,200,000 invoice void credit
    expect(bal.balance.toFixed(2)).toBe('0.00');

    // Verify chronological statement entries
    const statement = await LedgerDAO.getStatement(ctx, student1.id);
    const entryTypes = statement.transactions.map(t => t.entryType);
    expect(entryTypes).toContain(LedgerEntryType.INVOICE_GROSS_CHARGE);
    expect(entryTypes).toContain(LedgerEntryType.BURSARY_CREDIT);
    expect(entryTypes).toContain(LedgerEntryType.INVOICE_VOID_REVERSAL);
    expect(entryTypes).toContain(LedgerEntryType.BURSARY_VOID_REVERSAL);
    expect(statement.summary.closingBalance.toFixed(2)).toBe('0.00');
  });

  // =========================================================================
  // 7. OPENING BALANCE + NEW INVOICE
  // =========================================================================
  it('ADV-07: Seamlessly combines historical opening arrears with new term billing', async () => {
    // 1. Post opening arrears 300,000
    await LedgerDAO.postOpeningBalance(ctx, {
      studentId: student1.id,
      direction: LedgerDirection.DEBIT,
      amount: '300000.00',
      reason: 'Historical Arrears from 2025'
    });

    let bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('300000.00');

    // 2. Issue new invoice 700,000
    const inv = await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      dueDate: new Date('2026-08-01'),
      items: [{ feeTypeName: 'Term 1 Fees', unitAmount: '700000.00', quantity: 1 }]
    });

    bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('1000000.00');

    // 3. Pay 500,000 (FIFO allocates 500,000 to the open invoice)
    await PaymentDAO.recordPayment(ctx, {
      studentId: student1.id,
      amount: '500000.00',
      paymentMethod: PaymentMethod.CASH
    });

    bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('500000.00');

    // Outstanding breakdown:
    // Opening Arrears: 300,000
    // Invoice 1 remaining: 700,000 - 500,000 = 200,000
    // Total debt = 500,000. Exactly reconciled!
    const invRefreshed = await db.invoice.findUnique({
      where: { id: inv.id },
      include: { allocations: { where: { status: AllocationStatus.ACTIVE } } }
    });
    expect(invRefreshed?.status).toBe(InvoiceStatus.PARTIAL);
  });

  // =========================================================================
  // 8. ADJUSTMENT + PAYMENT + REVERSAL
  // =========================================================================
  it('ADV-08: Reconciles manual adjustments with payments and reversals', async () => {
    // 1. Post Debit Adjustment (Late Fee Penalty +50,000)
    await LedgerDAO.postAdjustment(ctx, {
      studentId: student1.id,
      direction: LedgerDirection.DEBIT,
      amount: '500000.00',
      reason: 'Boarding surcharge'
    });

    // 2. Post Credit Adjustment (Scholarship concession -100,000)
    await LedgerDAO.postAdjustment(ctx, {
      studentId: student1.id,
      direction: LedgerDirection.CREDIT,
      amount: '100000.00',
      reason: 'Special hardship concession'
    });

    let bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('400000.00');

    // 3. Payment 400,000
    const pay = await PaymentDAO.recordPayment(ctx, {
      studentId: student1.id,
      amount: '400000.00',
      paymentMethod: PaymentMethod.AIRTEL_MONEY
    });

    bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('0.00');

    // 4. Reverse Payment
    await PaymentDAO.reversePayment(ctx, pay.payment.id, 'Fraudulent transaction reversal');

    bal = await LedgerDAO.getBalance(ctx, student1.id);
    expect(bal.balance.toFixed(2)).toBe('400000.00');
  });
});
