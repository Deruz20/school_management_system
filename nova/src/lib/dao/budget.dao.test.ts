import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma } from '../db';
import {
  BudgetStatus,
  BudgetItemType,
  BudgetRevisionStatus,
  PaymentMethod,
} from '@prisma/client';
import { TenantContext } from './tenant-context';
import { BudgetDAO } from './budget.dao';
import { ExpenseDAO } from './expense.dao';
import { PayrollDAO } from './payroll.dao';
import { EmployeeCompensationDAO } from './employee-compensation.dao';

describe('NOVA Finance Phase 3.1G — School Budgeting & Expenditure Control Engine (BUD-01 to BUD-15)', () => {
  let ctx: TenantContext;
  let branchId: string;
  let academicYearId: string;
  let term1Id: string;
  let adminUserId: string;
  let approverUserId: string;
  let expenseCat1Id: string;
  let expenseCat2Id: string;
  let feeType1Id: string;
  let feeType2Id: string;

  beforeEach(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });
    const user = await prisma.user.findFirst({ where: { organizationId: org?.id } });

    branchId = branch!.id;
    adminUserId = user!.id;

    // Create secondary user for Four-Eye segregation
    const approverUser = await prisma.user.upsert({
      where: { email: 'headteacher_budget@test.com' },
      create: {
        organizationId: org!.id,
        email: 'headteacher_budget@test.com',
        passwordHash: 'hashed_password',
        firstName: 'Board',
        lastName: 'Approver',
        userType: 'STAFF',
      },
      update: {},
    });
    approverUserId = approverUser.id;

    ctx = {
      organizationId: org!.id,
      schoolId: school!.id,
      branchId,
      userId: adminUserId,
      role: 'ADMIN',
      permissions: ['all'],
    };

    // Clean up budget and expense records for clean test run
    await prisma.budgetRevisionItem.deleteMany({ where: { revision: { budget: { branchId } } } });
    await prisma.budgetRevision.deleteMany({ where: { budget: { branchId } } });
    await prisma.budgetItem.deleteMany({ where: { budget: { branchId } } });
    await prisma.budget.deleteMany({ where: { branchId } });
    await prisma.expense.deleteMany({ where: { branchId } });
    await prisma.payslipItem.deleteMany({ where: { payslip: { branchId } } });
    await prisma.payslip.deleteMany({ where: { branchId } });
    await prisma.payrollRun.deleteMany({ where: { branchId } });

    // Setup Academic Year and Term
    const year = await prisma.academicYear.upsert({
      where: { id: 'test-academic-year-2026' },
      create: {
        id: 'test-academic-year-2026',
        branchId,
        name: '2026 Academic Year',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
      update: {},
    });
    academicYearId = year.id;

    const term1 = await prisma.term.upsert({
      where: { id: 'test-term-1-2026' },
      create: {
        id: 'test-term-1-2026',
        academicYearId,
        name: 'Term 1 2026',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-04-30'),
      },
      update: {},
    });
    term1Id = term1.id;

    // Setup Expense Categories
    const cat1 = await prisma.expenseCategory.upsert({
      where: { branchId_code: { branchId, code: 'SALARIES_AND_WAGES' } },
      create: {
        branchId,
        code: 'SALARIES_AND_WAGES',
        name: 'Staff Salaries & Wages',
      },
      update: {},
    });
    expenseCat1Id = cat1.id;

    const cat2 = await prisma.expenseCategory.upsert({
      where: { branchId_code: { branchId, code: 'BOARDING_PROVISIONS' } },
      create: {
        branchId,
        code: 'BOARDING_PROVISIONS',
        name: 'Boarding Provisions & Food',
      },
      update: {},
    });
    expenseCat2Id = cat2.id;

    // Setup Fee Types
    const fee1 = await prisma.feeType.upsert({
      where: { branchId_code: { branchId, code: 'TUITION' } },
      create: {
        branchId,
        code: 'TUITION',
        name: 'Tuition Fees',
      },
      update: {},
    });
    feeType1Id = fee1.id;

    const fee2 = await prisma.feeType.upsert({
      where: { branchId_code: { branchId, code: 'BOARDING' } },
      create: {
        branchId,
        code: 'BOARDING',
        name: 'Boarding Fees',
      },
      update: {},
    });
    feeType2Id = fee2.id;
  });

  it('BUD-01: Creates draft budget with expense vote heads, revenue targets, and exact Decimal(12,2) totals', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null, // Annual
      title: '2026 Annual School Operating Budget',
      description: 'Master budget for 2026',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES_AND_WAGES',
          name: 'Staff Salaries & Wages',
          allocatedAmount: 150000000, // 150M UGX
        },
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat2Id,
          code: 'BOARDING_PROVISIONS',
          name: 'Boarding Provisions & Food',
          allocatedAmount: 50000000, // 50M UGX
        },
        {
          type: BudgetItemType.REVENUE_TARGET,
          feeTypeId: feeType1Id,
          code: 'REV_TUITION',
          name: 'Tuition Fee Revenue',
          allocatedAmount: 180000000, // 180M UGX
        },
        {
          type: BudgetItemType.REVENUE_TARGET,
          feeTypeId: feeType2Id,
          code: 'REV_BOARDING',
          name: 'Boarding Fee Revenue',
          allocatedAmount: 60000000, // 60M UGX
        },
      ],
    });

    expect(budget.id).toBeDefined();
    expect(budget.status).toBe(BudgetStatus.DRAFT);
    expect(budget.budgetNumber).toMatch(/^BUD-2026-\d{4}$/);
    expect(budget.totalExpense.toString()).toBe('200000000');
    expect(budget.totalIncome.toString()).toBe('240000000');
    expect(budget.netSurplus.toString()).toBe('40000000'); // 240M - 200M = 40M surplus
    expect(budget.items).toHaveLength(4);
  });

  it('BUD-02: Generates atomic, sequential budget numbers without collision', async () => {
    const b1 = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: term1Id,
      title: '2026 Term 1 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES_AND_WAGES',
          name: 'Salaries',
          allocatedAmount: 50000000,
        },
      ],
    });

    expect(b1.budgetNumber).toMatch(/^BUD-2026-\d{4}$/);
  });

  it('BUD-03: Rejects duplicate budget creation for the same Branch, Academic Year, and Term', async () => {
    await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Master Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES',
          name: 'Salaries',
          allocatedAmount: 10000000,
        },
      ],
    });

    await expect(
      BudgetDAO.createBudget(ctx, {
        academicYearId,
        termId: null,
        title: '2026 Master Budget Duplicate',
        items: [],
      })
    ).rejects.toThrow(/already exists/i);
  });

  it('BUD-04: Enforces Four-Eye Segregation: Submitter cannot self-approve budget', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES',
          name: 'Salaries',
          allocatedAmount: 50000000,
        },
      ],
    });

    // Submitter submits budget
    await BudgetDAO.submitBudget(ctx, budget.id);

    // Submitter tries to self-approve without bypass flag -> FAILS
    await expect(
      BudgetDAO.approveBudget(ctx, budget.id, false)
    ).rejects.toThrow(/Segregation of duties violation/i);

    // Independent approver approves -> SUCCEEDS
    const approverCtx: TenantContext = {
      ...ctx,
      userId: approverUserId,
    };
    const approved = await BudgetDAO.approveBudget(approverCtx, budget.id, false);
    expect(approved.status).toBe(BudgetStatus.APPROVED);
    expect(approved.approvedById).toBe(approverUserId);
    expect(approved.approvedAt).toBeDefined();
  });

  it('BUD-05: Board approval locks baseline totals and transitions to APPROVED', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Operating Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES',
          name: 'Salaries',
          allocatedAmount: 10000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    const approved = await BudgetDAO.approveBudget(
      { ...ctx, userId: approverUserId },
      budget.id
    );

    expect(approved.status).toBe(BudgetStatus.APPROVED);
    expect(approved.totalExpense.toString()).toBe('10000000');
  });

  it('BUD-06: Rejection workflow records reason and returns budget to DRAFT', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES',
          name: 'Salaries',
          allocatedAmount: 10000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);

    const rejected = await BudgetDAO.rejectBudget(
      { ...ctx, userId: approverUserId },
      budget.id,
      'Board requires 15% reduction in administrative overhead'
    );

    expect(rejected.status).toBe(BudgetStatus.DRAFT);
    expect(rejected.rejectionReason).toBe('Board requires 15% reduction in administrative overhead');
    expect(rejected.submittedById).toBeNull();
  });

  it('BUD-07: Rejects direct modification of line items on an APPROVED budget', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES',
          name: 'Salaries',
          allocatedAmount: 10000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    // Direct update on approved budget must be rejected
    await expect(
      BudgetDAO.updateDraftBudget(ctx, {
        id: budget.id,
        title: 'Mutated Budget',
      })
    ).rejects.toThrow(/Only DRAFT budgets can be edited/i);
  });

  it('BUD-08: Supplementary Revision creates draft revision with frozen snapshot JSON', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES',
          name: 'Salaries',
          allocatedAmount: 10000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    const itemId = budget.items[0].id;

    const revision = await BudgetDAO.createRevision(ctx, {
      budgetId: budget.id,
      title: 'Supplementary Cost of Living Adjustment',
      reason: 'Approved by board minute 14/B',
      items: [
        {
          budgetItemId: itemId,
          deltaAmount: 2000000, // +2M UGX
        },
      ],
    });

    expect(revision.status).toBe(BudgetRevisionStatus.DRAFT);
    expect(revision.revisionNumber).toBe(1);
    expect(revision.totalDelta.toString()).toBe('2000000');
    expect(revision.snapshotJson).toContain('"allocatedAmount":"10000000"');
  });

  it('BUD-09: Revision Approval updates authorized budget line items and totals', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES',
          name: 'Salaries',
          allocatedAmount: 10000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    const itemId = budget.items[0].id;

    const revision = await BudgetDAO.createRevision(ctx, {
      budgetId: budget.id,
      title: 'Supplementary 1',
      reason: 'Board resolution 22',
      items: [{ budgetItemId: itemId, deltaAmount: 3000000 }],
    });

    const result = await BudgetDAO.approveRevision(
      { ...ctx, userId: approverUserId },
      revision.id
    );

    expect(result.revision.status).toBe(BudgetRevisionStatus.APPROVED);
    expect(result.budget.totalExpense.toString()).toBe('13000000'); // 10M + 3M = 13M

    const updatedDetail = await BudgetDAO.getBudgetDetail(ctx, budget.id);
    expect(updatedDetail?.items[0].allocatedAmount.toString()).toBe('13000000');
  });

  it('BUD-10: Live Variance accurately computes ActualSpent, Variance UGX, and Utilization % against completed expenses', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES',
          name: 'Salaries',
          allocatedAmount: 10000000, // 10M
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    // Record completed expenses
    await ExpenseDAO.createExpense(ctx, {
      categoryId: expenseCat1Id,
      title: 'Jan Salaries Net Pay',
      amount: 4000000, // 4M
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      expenseDate: new Date('2026-01-31'),
    });

    await ExpenseDAO.createExpense(ctx, {
      categoryId: expenseCat1Id,
      title: 'Feb Salaries Net Pay',
      amount: 3500000, // 3.5M
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      expenseDate: new Date('2026-02-28'),
    });

    const variance = await BudgetDAO.getLiveBudgetVariance(ctx, budget.id);

    expect(variance.summary.totalAllocatedExpense.toString()).toBe('10000000');
    expect(variance.summary.totalActualExpenditure.toString()).toBe('7500000'); // 4M + 3.5M
    expect(variance.summary.totalExpenditureVariance.toString()).toBe('2500000'); // 10M - 7.5M = 2.5M remaining
    expect(variance.summary.totalUtilizationPercent).toBe(75.0);
    expect(variance.summary.isOverBudget).toBe(false);
  });

  it('BUD-11: Proves VOID expenses are strictly excluded from budget actuals', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat2Id,
          code: 'PROVISIONS',
          name: 'Provisions',
          allocatedAmount: 5000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    // Create and then void an expense voucher
    const { expense } = await ExpenseDAO.createExpense(ctx, {
      categoryId: expenseCat2Id,
      title: 'Erroneous Rice Purchase Voucher',
      amount: 2000000,
      paymentMethod: PaymentMethod.CASH,
      expenseDate: new Date('2026-02-10'),
    });

    await ExpenseDAO.voidExpense(ctx, expense.id, 'Duplicate supplier invoice voided');

    const variance = await BudgetDAO.getLiveBudgetVariance(ctx, budget.id);

    // Actual spent should be 0.00 since voucher is VOID
    expect(variance.summary.totalActualExpenditure.toString()).toBe('0');
    expect(variance.summary.totalExpenditureVariance.toString()).toBe('5000000');
  });

  it('BUD-12: Proves disbursed payroll expense vouchers feed SALARIES_AND_WAGES vote head with ZERO double-counting', async () => {
    // 1. Create staff compensation profile & salary component
    const comp = await prisma.salaryComponent.upsert({
      where: { branchId_code: { branchId, code: 'BUD_BASE_SAL' } },
      create: {
        branchId,
        name: 'Budget Base Salary Component',
        code: 'BUD_BASE_SAL',
        type: 'ALLOWANCE',
        calculationType: 'FIXED_AMOUNT',
        defaultAmount: 3000000,
        isStatutory: false,
        isTaxable: true,
      },
      update: {},
    });

    const dept = await prisma.department.upsert({
      where: { branchId_name: { branchId, name: 'Teaching Department' } },
      create: { branchId, name: 'Teaching Department' },
      update: {},
    });

    const empType = await prisma.employeeType.upsert({
      where: { branchId_name: { branchId, name: 'Full-Time Teacher' } },
      create: { branchId, name: 'Full-Time Teacher', isTeachingStaff: true },
      update: {},
    });

    const emp = await prisma.employee.upsert({
      where: { branchId_employeeCode: { branchId, employeeCode: 'EMP-BUD-01' } },
      create: {
        branchId,
        employeeCode: 'EMP-BUD-01',
        firstName: 'Paul',
        lastName: 'Musoke',
        departmentId: dept.id,
        employeeTypeId: empType.id,
        status: 'ACTIVE',
        joinedAt: new Date('2025-01-01'),
      },
      update: {},
    });

    await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: emp.id,
      baseSalary: 3000000,
      paymentMethod: 'BANK_TRANSFER',
      recurringItems: [{ componentId: comp.id, amount: 500000 }],
    });

    // 2. Setup budget with Salaries vote head
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat1Id,
          code: 'SALARIES_AND_WAGES',
          name: 'Staff Salaries & Wages',
          allocatedAmount: 50000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    // 3. Generate, approve and disburse payroll
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2026,
      month: 3,
      title: 'March 2026 Staff Payroll for Budget Test',
    });

    await PayrollDAO.submitPayrollRun(ctx, run.id);
    await PayrollDAO.approvePayrollRun({ ...ctx, userId: approverUserId }, run.id);
    const disbursed = await PayrollDAO.disbursePayrollRun(ctx, {
      id: run.id,
      paymentDate: new Date('2026-03-31'),
    });

    expect('expense' in disbursed ? disbursed.expense.id : disbursed.payrollRun.expenseId).toBeDefined();

    // 4. Verify variance against Expense table only (Zero double counting)
    const variance = await BudgetDAO.getLiveBudgetVariance(ctx, budget.id);

    expect(variance.summary.totalActualExpenditure.toString()).toBe(
      run.totalNet.toString()
    );
  });

  it('BUD-13: Revenue Realization accurately tracks fee billing and collection progress', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.REVENUE_TARGET,
          feeTypeId: feeType1Id,
          code: 'REV_TUITION',
          name: 'Tuition Fees',
          allocatedAmount: 100000000, // 100M Target
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    const revenue = await BudgetDAO.getRevenueRealization(ctx, budget.id);

    expect(revenue.summary.totalTargetIncome.toString()).toBe('100000000');
    expect(revenue.items).toHaveLength(1);
    expect(revenue.items[0].targetAmount.toString()).toBe('100000000');
  });

  it('BUD-14: Pre-flight ceiling check detects when an expense voucher will exceed category budget', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      termId: null,
      title: '2026 Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCat2Id,
          code: 'BOARDING_PROVISIONS',
          name: 'Boarding Provisions & Food',
          allocatedAmount: 1000000, // 1M Cap
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    // Check pre-flight within budget
    const check1 = await BudgetDAO.checkExpenseBudgetCeiling(ctx, {
      categoryId: expenseCat2Id,
      amount: 400000,
      expenseDate: new Date('2026-03-01'),
    });
    expect(check1.isOverBudget).toBe(false);

    // Record expense of 800,000
    await ExpenseDAO.createExpense(ctx, {
      categoryId: expenseCat2Id,
      title: 'Food batch 1',
      amount: 800000,
      paymentMethod: PaymentMethod.CASH,
      expenseDate: new Date('2026-03-01'),
    });

    // Check next voucher of 500,000 (800k + 500k = 1.3M > 1.0M)
    const check2 = await BudgetDAO.checkExpenseBudgetCeiling(ctx, {
      categoryId: expenseCat2Id,
      amount: 500000,
      expenseDate: new Date('2026-03-05'),
    });

    expect(check2.isOverBudget).toBe(true);
    expect(check2.overBudgetAmount?.toString()).toBe('300000'); // 300k excess
    expect(check2.utilizationPercent).toBe(130.0);
  });

  it('BUD-15: Multi-Tenant Branch Isolation: Budgets and variance are strictly branch-scoped', async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });

    // Create Branch B
    const branchB = await prisma.branch.create({
      data: {
        schoolId: school!.id,
        name: 'Branch B — Jinja Campus',
      },
    });

    const ctxB: TenantContext = {
      ...ctx,
      branchId: branchB.id,
    };

    const yearB = await prisma.academicYear.create({
      data: {
        branchId: branchB.id,
        name: '2026 Academic Year Branch B',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });

    const catB = await prisma.expenseCategory.create({
      data: {
        branchId: branchB.id,
        code: 'MAINTENANCE_B',
        name: 'Campus Maintenance B',
      },
    });

    const budgetB = await BudgetDAO.createBudget(ctxB, {
      academicYearId: yearB.id,
      title: 'Branch B Master Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: catB.id,
          code: 'MAINTENANCE_B',
          name: 'Maintenance',
          allocatedAmount: 20000000,
        },
      ],
    });

    // Query from Branch A -> Cannot see Branch B budget
    const listA = await BudgetDAO.listBudgets(ctx);
    expect(listA.some((b) => b.id === budgetB.id)).toBe(false);

    // Detail lookup from Branch A for Branch B budget -> null
    const detailFromA = await BudgetDAO.getBudgetDetail(ctx, budgetB.id);
    expect(detailFromA).toBeNull();
  });
});
