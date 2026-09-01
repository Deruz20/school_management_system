import { describe, it, expect, beforeEach } from 'vitest';
import { FinancialReportDAO } from './financial-report.dao';
import { ExpenseDAO } from './expense.dao';
import { ExpenseCategoryDAO } from './expense-category.dao';
import { InvoiceDAO } from './invoice.dao';
import { PaymentDAO } from './payment.dao';
import { LedgerDAO } from './ledger.dao';
import { FeeTypeDAO } from './fee-type.dao';
import { FeeStructureDAO } from './fee-structure.dao';
import { DiscountDAO } from './discount.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import { PaymentMethod, DiscountType, LedgerDirection } from '@prisma/client';

describe('NOVA Finance Phase 3.1D — FinancialReportDAO Integration & Invariant Tests', () => {
  let orgId: string;
  let schoolId: string;
  let branchId1: string;
  let branchId2: string;
  let ctx1: TenantContext;
  let ctx2: TenantContext;
  let ay1Id: string;
  let term1Id: string;
  let class1Id: string;
  let class2Id: string;
  let student1Id: string;
  let student2Id: string;
  let student3Id: string;
  let enrollment1Id: string;
  let enrollment2Id: string;
  let enrollment3Id: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `RepOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });
    orgId = org.id;

    const school = await db.school.create({
      data: { name: 'Report School', organizationId: org.id }
    });
    schoolId = school.id;

    const branch1 = await db.branch.create({
      data: { name: 'Report Branch 1', schoolId: school.id }
    });
    branchId1 = branch1.id;

    const branch2 = await db.branch.create({
      data: { name: 'Report Branch 2', schoolId: school.id }
    });
    branchId2 = branch2.id;

    const user1 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `bursar1_${Date.now()}@test.com`,
        passwordHash: 'hash',
        firstName: 'Report',
        lastName: 'Bursar',
        userType: 'STAFF'
      }
    });

    const user2 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `bursar2_${Date.now()}@test.com`,
        passwordHash: 'hash',
        firstName: 'Branch2',
        lastName: 'Bursar',
        userType: 'STAFF'
      }
    });

    ctx1 = {
      organizationId: orgId,
      schoolId: schoolId,
      branchId: branchId1,
      userId: user1.id,
      role: 'Admin',
      permissions: [
        'fees:read',
        'fees:write',
        'fees:invoices:write',
        'fees:payments:read',
        'fees:payments:write',
        'fees:ledger:read',
        'fees:ledger:adjust',
        'fees:expenses:read',
        'fees:expenses:write',
        'fees:expenses:void',
        'fees:reports:read',
        'fees:debtors:export'
      ]
    };

    ctx2 = {
      organizationId: orgId,
      schoolId: schoolId,
      branchId: branchId2,
      userId: user2.id,
      role: 'Admin',
      permissions: [
        'fees:read',
        'fees:write',
        'fees:invoices:write',
        'fees:payments:read',
        'fees:payments:write',
        'fees:ledger:read',
        'fees:expenses:read',
        'fees:expenses:write',
        'fees:reports:read',
        'fees:debtors:export'
      ]
    };

    const ay = await db.academicYear.create({
      data: {
        branchId: branchId1,
        name: '2026 Academic Year',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31')
      }
    });
    ay1Id = ay.id;

    const term = await db.term.create({
      data: {
        academicYearId: ay.id,
        name: 'Term 1 2026',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-05-01')
      }
    });
    term1Id = term.id;

    const c1 = await db.class.create({
      data: { branchId: branchId1, name: 'Primary 1' }
    });
    class1Id = c1.id;

    const c2 = await db.class.create({
      data: { branchId: branchId1, name: 'Primary 2' }
    });
    class2Id = c2.id;

    const s1 = await db.student.create({
      data: {
        branchId: branchId1,
        firstName: 'John',
        lastName: 'Doe',
        admissionNo: `ADM-${Date.now()}-1`,
        classId: class1Id,
        dateOfBirth: new Date('2018-01-01'),
        gender: 'MALE',
        status: 'ACTIVE'
      }
    });
    student1Id = s1.id;

    const s2 = await db.student.create({
      data: {
        branchId: branchId1,
        firstName: 'Jane',
        lastName: 'Smith',
        admissionNo: `ADM-${Date.now()}-2`,
        classId: class1Id,
        dateOfBirth: new Date('2018-02-01'),
        gender: 'FEMALE',
        status: 'ACTIVE'
      }
    });
    student2Id = s2.id;

    const s3 = await db.student.create({
      data: {
        branchId: branchId1,
        firstName: 'Mark',
        lastName: 'Taylor',
        admissionNo: `ADM-${Date.now()}-3`,
        classId: class2Id,
        dateOfBirth: new Date('2017-03-01'),
        gender: 'MALE',
        status: 'ACTIVE'
      }
    });
    student3Id = s3.id;

    const e1 = await db.enrollment.create({
      data: { studentId: student1Id, classId: class1Id, academicYearId: ay1Id, status: 'ACTIVE' }
    });
    enrollment1Id = e1.id;

    const e2 = await db.enrollment.create({
      data: { studentId: student2Id, classId: class1Id, academicYearId: ay1Id, status: 'ACTIVE' }
    });
    enrollment2Id = e2.id;

    const e3 = await db.enrollment.create({
      data: { studentId: student3Id, classId: class2Id, academicYearId: ay1Id, status: 'ACTIVE' }
    });
    enrollment3Id = e3.id;
  });

  // =========================================================================
  // REP-01 & REP-02: Executive Summary (Accrual Billing & Cash Flow)
  // =========================================================================
  it('REP-01 & REP-02: Executive Summary calculates accrual and cash flow metrics with mathematical precision', async () => {
    // 1. Setup Fee Structure
    const feeType = await FeeTypeDAO.create(ctx1, { name: 'Tuition', code: `TUI_${Date.now()}` });
    const struct = await FeeStructureDAO.create(ctx1, {
      name: 'P1 Fees',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      currency: 'UGX',
      items: [{ feeTypeId: feeType.id, amount: 500000, isOptional: false }]
    });

    // 2. Student 2 gets 20% Bursary (100,000 discount)
    await DiscountDAO.create(ctx1, {
      studentId: student2Id,
      feeTypeId: feeType.id,
      discountType: DiscountType.PERCENTAGE,
      value: 20,
      reason: 'Bursary'
    });

    // 3. Issue Invoices for Student 1 (Gross: 500k, Net: 500k) and Student 2 (Gross: 500k, Net: 400k)
    const inv1 = await InvoiceDAO.createIndividualInvoice(ctx1, {
      studentId: student1Id,
      enrollmentId: enrollment1Id,
      feeStructureId: struct.id,
      academicYearId: ay1Id,
      termId: term1Id,
      dueDate: new Date('2026-03-01')
    });

    await InvoiceDAO.createIndividualInvoice(ctx1, {
      studentId: student2Id,
      enrollmentId: enrollment2Id,
      feeStructureId: struct.id,
      academicYearId: ay1Id,
      termId: term1Id,
      dueDate: new Date('2026-03-01')
    });

    // 4. Student 1 pays 300,000 via MTN MoMo
    await PaymentDAO.recordPayment(ctx1, {
      studentId: student1Id,
      amount: '300000.00',
      paymentMethod: PaymentMethod.MTN_MOMO,
      paymentDate: new Date(),
      manualAllocations: [{ invoiceId: inv1.id, amount: '300000.00' }]
    });

    // 5. Record 150,000 completed operational expense
    const cat = await ExpenseCategoryDAO.create(ctx1, { name: 'Supplies', code: `SUP_${Date.now()}` });
    await ExpenseDAO.createExpense(ctx1, {
      categoryId: cat.id,
      title: 'Chalk and Reams',
      amount: '150000.00',
      paymentMethod: PaymentMethod.CASH
    });

    // 6. Query Executive Summary
    const summary = await FinancialReportDAO.getExecutiveSummary(ctx1, {
      academicYearId: ay1Id,
      termId: term1Id
    });

    // Accrual validations
    expect(summary.accrual.invoiceCount).toBe(2);
    expect(summary.accrual.grossBilled.toFixed(2)).toBe('1000000.00');
    expect(summary.accrual.discountAmount.toFixed(2)).toBe('100000.00');
    expect(summary.accrual.netBilled.toFixed(2)).toBe('900000.00');
    expect(summary.accrual.termCollected.toFixed(2)).toBe('300000.00');
    expect(summary.accrual.outstanding.toFixed(2)).toBe('600000.00');
    expect(summary.accrual.collectionRate).toBe(33.3); // 300,000 / 900,000 = 33.3%

    // Cash flow validations
    expect(summary.cashFlow.feePaymentCount).toBe(1);
    expect(summary.cashFlow.totalFeeInflows.toFixed(2)).toBe('300000.00');
    expect(summary.cashFlow.expenseCount).toBe(1);
    expect(summary.cashFlow.totalOperationalExpenses.toFixed(2)).toBe('150000.00');
    expect(summary.cashFlow.netOperatingCashFlow.toFixed(2)).toBe('150000.00'); // Surplus
  });

  // =========================================================================
  // REP-03 & REP-04: Class & Term Breakdown Matrices
  // =========================================================================
  it('REP-03 & REP-04: Aggregates collection performance by class and term', async () => {
    const feeType = await FeeTypeDAO.create(ctx1, { name: 'Tuition B', code: `TUIB_${Date.now()}` });
    const structP1 = await FeeStructureDAO.create(ctx1, {
      name: 'P1 Struct',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      currency: 'UGX',
      items: [{ feeTypeId: feeType.id, amount: 600000, isOptional: false }]
    });

    const structP2 = await FeeStructureDAO.create(ctx1, {
      name: 'P2 Struct',
      classId: class2Id,
      academicYearId: ay1Id,
      termId: term1Id,
      currency: 'UGX',
      items: [{ feeTypeId: feeType.id, amount: 700000, isOptional: false }]
    });

    const invP1 = await InvoiceDAO.createIndividualInvoice(ctx1, {
      studentId: student1Id,
      enrollmentId: enrollment1Id,
      feeStructureId: structP1.id,
      academicYearId: ay1Id,
      termId: term1Id,
      dueDate: new Date('2026-03-01')
    });

    await InvoiceDAO.createIndividualInvoice(ctx1, {
      studentId: student3Id,
      enrollmentId: enrollment3Id,
      feeStructureId: structP2.id,
      academicYearId: ay1Id,
      termId: term1Id,
      dueDate: new Date('2026-03-01')
    });

    // Pay 600,000 for P1 student
    await PaymentDAO.recordPayment(ctx1, {
      studentId: student1Id,
      amount: '600000.00',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      manualAllocations: [{ invoiceId: invP1.id, amount: '600000.00' }]
    });

    // 1. Class Breakdown
    const classData = await FinancialReportDAO.getCollectionByClass(ctx1, {
      academicYearId: ay1Id,
      termId: term1Id
    });

    expect(classData.length).toBe(2);
    const p1 = classData.find(c => c.className === 'Primary 1');
    const p2 = classData.find(c => c.className === 'Primary 2');

    expect(p1?.netBilled.toFixed(2)).toBe('600000.00');
    expect(p1?.collected.toFixed(2)).toBe('600000.00');
    expect(p1?.outstanding.toFixed(2)).toBe('0.00');
    expect(p1?.collectionRate).toBe(100);

    expect(p2?.netBilled.toFixed(2)).toBe('700000.00');
    expect(p2?.collected.toFixed(2)).toBe('0.00');
    expect(p2?.outstanding.toFixed(2)).toBe('700000.00');
    expect(p2?.collectionRate).toBe(0);

    // 2. Term Breakdown
    const termData = await FinancialReportDAO.getCollectionByTerm(ctx1, {
      academicYearId: ay1Id
    });

    expect(termData.length).toBe(1);
    expect(termData[0].netBilled.toFixed(2)).toBe('1300000.00');
    expect(termData[0].collected.toFixed(2)).toBe('600000.00');
    expect(termData[0].outstanding.toFixed(2)).toBe('700000.00');
  });

  // =========================================================================
  // REP-05 & REP-06: 12-Month Rolling Cash Flow & Payment Channels
  // =========================================================================
  it('REP-05 & REP-06: Calculates 12-month cash flows and payment channel share distribution', async () => {
    // Payment via Airtel Money: 800k
    await PaymentDAO.recordPayment(ctx1, {
      studentId: student1Id,
      amount: '800000.00',
      paymentMethod: PaymentMethod.AIRTEL_MONEY,
      paymentDate: new Date()
    });

    // Payment via Cash: 200k
    await PaymentDAO.recordPayment(ctx1, {
      studentId: student2Id,
      amount: '200000.00',
      paymentMethod: PaymentMethod.CASH,
      paymentDate: new Date()
    });

    const channels = await FinancialReportDAO.getPaymentChannels(ctx1);
    expect(channels.totalTransactions).toBe(2);
    expect(channels.totalVolume.toFixed(2)).toBe('1000000.00');

    const airtel = channels.channels.find(c => c.method === 'AIRTEL_MONEY');
    const cash = channels.channels.find(c => c.method === 'CASH');

    expect(airtel?.totalAmount.toFixed(2)).toBe('800000.00');
    expect(airtel?.percentage).toBe(80);

    expect(cash?.totalAmount.toFixed(2)).toBe('200000.00');
    expect(cash?.percentage).toBe(20);

    // 12-Month Cash Flow
    const flow = await FinancialReportDAO.get12MonthCashFlow(ctx1);
    expect(flow.length).toBe(12);
    const currentMonth = flow[flow.length - 1];
    expect(currentMonth.feesIn.toFixed(2)).toBe('1000000.00');
  });

  // =========================================================================
  // REP-07: Authoritative AR Subledger Debtors & CSV Export
  // =========================================================================
  it('REP-07: Identifies authoritative subledger debtors and exports CSV', async () => {
    // Post opening balance debt: Student 1 = 350,000, Student 2 = 120,000
    await LedgerDAO.postOpeningBalance(ctx1, {
      studentId: student1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      direction: LedgerDirection.DEBIT,
      amount: '350000.00',
      reason: 'Historical Arrears'
    });

    await LedgerDAO.postOpeningBalance(ctx1, {
      studentId: student2Id,
      academicYearId: ay1Id,
      termId: term1Id,
      direction: LedgerDirection.DEBIT,
      amount: '120000.00',
      reason: 'Historical Arrears'
    });

    const debtorsReport = await FinancialReportDAO.getDebtorsReport(ctx1);
    expect(debtorsReport.summary.totalDebtors).toBe(2);
    expect(debtorsReport.summary.totalDebtAmount.toFixed(2)).toBe('470000.00');

    // Verify ordering: Student 1 (350k) comes before Student 2 (120k)
    expect(debtorsReport.debtors[0].studentId).toBe(student1Id);
    expect(debtorsReport.debtors[0].balance.toFixed(2)).toBe('350000.00');
    expect(debtorsReport.debtors[1].studentId).toBe(student2Id);
    expect(debtorsReport.debtors[1].balance.toFixed(2)).toBe('120000.00');

    // Export CSV
    const csv = await FinancialReportDAO.exportDebtorsCsv(ctx1);
    expect(csv).toContain('Admission No');
    expect(csv).toContain('John Doe');
    expect(csv).toContain('Jane Smith');
    expect(csv).toContain('350000.00');
  });

  // =========================================================================
  // REP-08: Branch Isolation on Financial Reporting
  // =========================================================================
  it('REP-08: Ensures branch 2 cannot read or aggregate branch 1 financial metrics or debtors', async () => {
    // Post opening balance in branch 1
    await LedgerDAO.postOpeningBalance(ctx1, {
      studentId: student1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      direction: LedgerDirection.DEBIT,
      amount: '800000.00',
      reason: 'Branch 1 Arrears'
    });

    // Branch 2 queries debtors
    const branch2Debtors = await FinancialReportDAO.getDebtorsReport(ctx2);
    expect(branch2Debtors.summary.totalDebtors).toBe(0);
    expect(branch2Debtors.summary.totalDebtAmount.toFixed(2)).toBe('0.00');

    // Branch 2 queries executive summary
    const branch2Summary = await FinancialReportDAO.getExecutiveSummary(ctx2);
    expect(branch2Summary.accrual.netBilled.toFixed(2)).toBe('0.00');
    expect(branch2Summary.cashFlow.totalFeeInflows.toFixed(2)).toBe('0.00');
  });
});
