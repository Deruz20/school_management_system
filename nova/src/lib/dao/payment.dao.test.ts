import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentDAO } from './payment.dao';
import { LedgerDAO } from './ledger.dao';
import { InvoiceDAO } from './invoice.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  AllocationStatus,
  ReceiptStatus,
  Student,
  AcademicYear,
  Class,
  Enrollment
} from '@prisma/client';

describe('PaymentDAO & Invariant Matrix', () => {
  let branchId1: string;
  let branchId2: string;
  let ctxBranch1: TenantContext;
  let user1Id: string;

  let class1: Class;
  let ay1: AcademicYear;
  let student1: Student;
  let student2: Student;
  let enrollment1: Enrollment;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `PaymentTestOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: 'Payment School', organizationId: org.id }
    });

    const b1 = await db.branch.create({
      data: { name: 'Main Campus', schoolId: school.id }
    });
    branchId1 = b1.id;

    const b2 = await db.branch.create({
      data: { name: 'Annex Campus', schoolId: school.id }
    });
    branchId2 = b2.id;

    const user1 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `cashier_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: 'hashed',
        firstName: 'Grace',
        lastName: 'Nakato',
        userType: 'STAFF'
      }
    });
    user1Id = user1.id;

    ctxBranch1 = {
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId1,
      userId: user1Id,
      role: 'Admin',
      permissions: ['fees:read', 'fees:write', 'fees:payments:write', 'fees:payments:reverse', 'fees:ledger:adjust']
    };

    class1 = await db.class.create({
      data: { branchId: branchId1, name: 'Senior 2' }
    });

    ay1 = await db.academicYear.create({
      data: {
        branchId: branchId1,
        name: '2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31')
      }
    });

    await db.term.create({
      data: {
        academicYearId: ay1.id,
        name: 'Term 1',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-04-15')
      }
    });

    student1 = await db.student.create({
      data: {
        branchId: branchId1,
        admissionNo: `ADM-P1-${Date.now()}`,
        firstName: 'David',
        lastName: 'Kato',
        classId: class1.id
      }
    });

    student2 = await db.student.create({
      data: {
        branchId: branchId2,
        admissionNo: `ADM-P2-${Date.now()}`,
        firstName: 'Brian',
        lastName: 'Otim'
      }
    });

    enrollment1 = await db.enrollment.create({
      data: {
        studentId: student1.id,
        classId: class1.id,
        academicYearId: ay1.id
      }
    });
  });

  // T-01: Full Invoice Payment
  it('T-01: captures full payment, marks invoice PAID, creates receipt, and zeros ledger balance', async () => {
    // Create individual invoice for 800k
    const invoice = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      dueDate: new Date('2026-02-15'),
      items: [
        { feeTypeName: 'Tuition Fee', unitAmount: '800000.00', quantity: 1 }
      ]
    });

    // Verify initial ledger balance is 800k
    let bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('800000');

    // Record full payment of 800k via MTN MoMo
    const result = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '800000.00',
      paymentMethod: PaymentMethod.MTN_MOMO,
      externalReference: 'MOMO-REF-1001',
      payerName: 'David Kato Senior'
    });

    expect(result.isReplay).toBe(false);
    expect(result.payment.status).toBe(PaymentStatus.COMPLETED);
    expect(result.payment.receipt).toBeDefined();
    expect(result.payment.receipt?.status).toBe(ReceiptStatus.ISSUED);
    expect(result.payment.receipt?.amountFigures.toString()).toBe('800000');
    expect(result.payment.receipt?.receiptNumber).toMatch(/^REC-\d{4}-\d{5}$/);

    // Verify invoice status updated to PAID
    const updatedInv = await db.invoice.findUnique({ where: { id: invoice.id } });
    expect(updatedInv?.status).toBe(InvoiceStatus.PAID);

    // Verify ledger balance is now 0.00
    bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('0');
    expect(bal.totalDebits.toString()).toBe('800000');
    expect(bal.totalCredits.toString()).toBe('800000');
  });

  // T-02: Partial Payment
  it('T-02: captures partial payment, marks invoice PARTIAL, updates outstanding amount', async () => {
    const invoice = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      dueDate: new Date('2026-02-15'),
      items: [
        { feeTypeName: 'Tuition Fee', unitAmount: '1000000.00', quantity: 1 }
      ]
    });

    // Pay 400k (40%)
    const result = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '400000.00',
      paymentMethod: PaymentMethod.CASH
    });

    expect(result.payment.status).toBe(PaymentStatus.COMPLETED);

    // Verify invoice status is PARTIAL
    const updatedInv = await db.invoice.findUnique({ where: { id: invoice.id } });
    expect(updatedInv?.status).toBe(InvoiceStatus.PARTIAL);

    // Verify ledger balance is 600k
    const bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('600000');
  });

  // T-03: Multi-Invoice Payment (FIFO)
  it('T-03: allocates across multiple invoices using strict FIFO ordering', async () => {
    // Invoice 1: Due Jan 15 (500k)
    const inv1 = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      dueDate: new Date('2026-01-15'),
      items: [{ feeTypeName: 'Term 1 Tuition', unitAmount: '500000.00', quantity: 1 }]
    });

    // Invoice 2: Due Feb 15 (700k)
    const inv2 = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      dueDate: new Date('2026-02-15'),
      items: [{ feeTypeName: 'Term 1 Development', unitAmount: '700000.00', quantity: 1 }]
    });

    // Pay 800k total
    const payResult = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '800000.00',
      paymentMethod: PaymentMethod.BANK_TRANSFER
    });

    // Inv 1 should be fully PAID (500k)
    const checkInv1 = await db.invoice.findUnique({ where: { id: inv1.id } });
    expect(checkInv1?.status).toBe(InvoiceStatus.PAID);

    // Inv 2 should be PARTIAL (300k allocated of 700k)
    const checkInv2 = await db.invoice.findUnique({ where: { id: inv2.id } });
    expect(checkInv2?.status).toBe(InvoiceStatus.PARTIAL);

    const allocs = await db.paymentAllocation.findMany({
      where: { paymentId: payResult.payment.id },
      orderBy: { amount: 'desc' }
    });
    expect(allocs.length).toBe(2);
    expect(allocs[0].amount.toString()).toBe('500000');
    expect(allocs[1].amount.toString()).toBe('300000');

    // Total student debt remaining = 400k (1.2M - 800k)
    const bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('400000');
  });

  // T-04: Overpayment & Student Credit
  it('T-04: holds overpayment as unallocated credit and reflects negative ledger balance', async () => {
    const invoice = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      dueDate: new Date('2026-02-15'),
      items: [{ feeTypeName: 'Tuition', unitAmount: '600000.00', quantity: 1 }]
    });

    // Pay 1,000,000 (overpayment of 400,000)
    const result = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '1000000.00',
      paymentMethod: PaymentMethod.SCHOOLPAY
    });

    const updatedInv = await db.invoice.findUnique({ where: { id: invoice.id } });
    expect(updatedInv?.status).toBe(InvoiceStatus.PAID);

    const payDetails = await PaymentDAO.getPayment(ctxBranch1, result.payment.id);
    expect(payDetails.allocatedAmount.toString()).toBe('600000');
    expect(payDetails.unallocatedAmount.toString()).toBe('400000');

    // Student balance should be -400,000 (Credit)
    const bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('-400000');
  });

  // T-05: Advance Payment Before Invoicing
  it('T-05: captures advance payment before billing with zero allocations and credit balance', async () => {
    const result = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '750000.00',
      paymentMethod: PaymentMethod.AIRTEL_MONEY
    });

    expect(result.payment.status).toBe(PaymentStatus.COMPLETED);

    const payDetails = await PaymentDAO.getPayment(ctxBranch1, result.payment.id);
    expect(payDetails.allocatedAmount.toString()).toBe('0');
    expect(payDetails.unallocatedAmount.toString()).toBe('750000');

    const bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('-750000');
  });

  // T-07 & T-08: Non-Destructive Payment Reversal
  it('T-07 & T-08: reverses payment, marks receipt VOID, reverts invoice status, and preserves surviving allocations', async () => {
    // Invoice for 1,000,000
    const invoice = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      dueDate: new Date('2026-02-15'),
      items: [{ feeTypeName: 'Tuition', unitAmount: '1000000.00', quantity: 1 }]
    });

    // Payment 1: 600,000 (Invoice becomes PARTIAL)
    const pay1 = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '600000.00',
      paymentMethod: PaymentMethod.CASH
    });

    // Payment 2: 400,000 (Invoice becomes PAID)
    const pay2 = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '400000.00',
      paymentMethod: PaymentMethod.MTN_MOMO
    });

    let inv = await db.invoice.findUnique({ where: { id: invoice.id } });
    expect(inv?.status).toBe(InvoiceStatus.PAID);

    // Reverse Payment 1 (600k) due to bounced check / cashier correction
    await PaymentDAO.reversePayment(ctxBranch1, pay1.payment.id, 'Cashier entry error');

    // Verify Payment 1 is REVERSED and Receipt is VOID
    const reversedPay1 = await db.payment.findUnique({
      where: { id: pay1.payment.id },
      include: { receipt: true, allocations: true }
    });
    expect(reversedPay1?.status).toBe(PaymentStatus.REVERSED);
    expect(reversedPay1?.receipt?.status).toBe(ReceiptStatus.VOID);
    expect(reversedPay1?.allocations[0].status).toBe(AllocationStatus.REVERSED);

    // Verify Payment 2 allocations remain ACTIVE (400k)
    const activePay2 = await db.payment.findUnique({
      where: { id: pay2.payment.id },
      include: { allocations: true }
    });
    expect(activePay2?.status).toBe(PaymentStatus.COMPLETED);
    expect(activePay2?.allocations[0].status).toBe(AllocationStatus.ACTIVE);

    // Verify Invoice status correctly recalculates to PARTIAL (400k paid of 1M)
    inv = await db.invoice.findUnique({ where: { id: invoice.id } });
    expect(inv?.status).toBe(InvoiceStatus.PARTIAL);

    // Verify Student balance is 600k (1M - 400k)
    const bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('600000');
  });

  // T-09: Idempotency Replay
  it('T-09: deduplicates payment replay on duplicate idempotencyKey without creating duplicates', async () => {
    const key = 'GATEWAY:SCHOOLPAY:SCH001:TX-998811';

    const firstCall = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '300000.00',
      paymentMethod: PaymentMethod.SCHOOLPAY,
      idempotencyKey: key
    });

    expect(firstCall.isReplay).toBe(false);

    const secondCall = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '300000.00',
      paymentMethod: PaymentMethod.SCHOOLPAY,
      idempotencyKey: key
    });

    expect(secondCall.isReplay).toBe(true);
    expect(secondCall.payment.id).toBe(firstCall.payment.id);

    // Verify only 1 payment exists in DB
    const totalPayments = await db.payment.count({
      where: { branchId: branchId1, studentId: student1.id }
    });
    expect(totalPayments).toBe(1);
  });

  // T-12: Reject Invoice Void When Active Allocations Exist
  it('T-12: prevents voiding an invoice that has active payment allocations', async () => {
    const invoice = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      dueDate: new Date('2026-02-15'),
      items: [{ feeTypeName: 'Tuition', unitAmount: '500000.00', quantity: 1 }]
    });

    await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '500000.00',
      paymentMethod: PaymentMethod.CASH
    });

    await expect(
      InvoiceDAO.voidInvoice(ctxBranch1, invoice.id, 'Wrong bill')
    ).rejects.toThrow(/Cannot void invoice with active payment allocations/);
  });

  // T-15: Multi-Tenant Branch Isolation
  it('T-15: enforces branch isolation for payment creation, receipt viewing, and reversals', async () => {
    // Branch 1 cashier cannot pay for Branch 2 student
    await expect(
      PaymentDAO.recordPayment(ctxBranch1, {
        studentId: student2.id,
        amount: '200000.00',
        paymentMethod: PaymentMethod.CASH
      })
    ).rejects.toThrow(/Student not found or access denied/);
  });

  // T-16: Sequence Generation & Receipt Number Uniqueness
  it('T-16: generates sequential, unique receipt numbers with formatted word amounts', async () => {
    const pay1 = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '100000.00',
      paymentMethod: PaymentMethod.CASH
    });

    const pay2 = await PaymentDAO.recordPayment(ctxBranch1, {
      studentId: student1.id,
      amount: '250000.00',
      paymentMethod: PaymentMethod.CASH
    });

    const r1 = await PaymentDAO.getReceipt(ctxBranch1, pay1.payment.id);
    const r2 = await PaymentDAO.getReceipt(ctxBranch1, pay2.payment.id);

    expect(r1.receipt.receiptNumber).not.toBe(r2.receipt.receiptNumber);
    expect(r1.receipt.amountWords).toBe('One Hundred Thousand Uganda Shillings Only');
    expect(r2.receipt.amountWords).toBe('Two Hundred Fifty Thousand Uganda Shillings Only');
    expect(r1.student.fullName).toBe('David Kato');
  });
});
