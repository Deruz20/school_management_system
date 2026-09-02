import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma } from '../db';
import { BudgetItemType, PaymentMethod } from '@prisma/client';
import { TenantContext } from './tenant-context';
import { BudgetDAO } from './budget.dao';
import { ExpenseDAO } from './expense.dao';

describe('NOVA Finance Phase 3.1G — Budgeting Adversarial Integrity & Edge Cases (ADV-BUD-01 to ADV-BUD-10)', () => {
  let ctx: TenantContext;
  let branchId: string;
  let academicYearId: string;
  let adminUserId: string;
  let approverUserId: string;
  let expenseCatId: string;

  beforeEach(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });
    const user = await prisma.user.findFirst({ where: { organizationId: org?.id } });

    branchId = branch!.id;
    adminUserId = user!.id;

    const approverUser = await prisma.user.upsert({
      where: { email: 'approver_adv@test.com' },
      create: {
        organizationId: org!.id,
        email: 'approver_adv@test.com',
        passwordHash: 'hashed_password',
        firstName: 'Adversarial',
        lastName: 'Auditor',
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

    await prisma.budgetRevisionItem.deleteMany({ where: { revision: { budget: { branchId } } } });
    await prisma.budgetRevision.deleteMany({ where: { budget: { branchId } } });
    await prisma.budgetItem.deleteMany({ where: { budget: { branchId } } });
    await prisma.budget.deleteMany({ where: { branchId } });
    await prisma.expense.deleteMany({ where: { branchId } });

    const year = await prisma.academicYear.upsert({
      where: { id: 'test-adv-academic-year-2026' },
      create: {
        id: 'test-adv-academic-year-2026',
        branchId,
        name: '2026 Academic Year Adv',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
      update: {},
    });
    academicYearId = year.id;

    const cat = await prisma.expenseCategory.upsert({
      where: { branchId_code: { branchId, code: 'ADV_TEST_CAT' } },
      create: {
        branchId,
        code: 'ADV_TEST_CAT',
        name: 'Adversarial Test Category',
      },
      update: {},
    });
    expenseCatId = cat.id;
  });

  it('ADV-BUD-01: Rejects negative budget line item allocations', async () => {
    await expect(
      BudgetDAO.createBudget(ctx, {
        academicYearId,
        title: 'Negative Budget Test',
        items: [
          {
            type: BudgetItemType.EXPENSE_VOTE_HEAD,
            categoryId: expenseCatId,
            code: 'ADV_TEST_CAT',
            name: 'Test Category',
            allocatedAmount: -50000,
          },
        ],
      })
    ).rejects.toThrow(/cannot be negative/i);
  });

  it('ADV-BUD-02: Rejects revision delta that would reduce budget item below zero', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      title: 'Budget for Reduction Test',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCatId,
          code: 'ADV_TEST_CAT',
          name: 'Test Category',
          allocatedAmount: 1000000, // 1M
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    const itemId = budget.items[0].id;

    // Delta of -1.5M on a 1.0M budget would result in -500k -> Must fail
    await expect(
      BudgetDAO.createRevision(ctx, {
        budgetId: budget.id,
        title: 'Excessive Reduction',
        reason: 'Attempting invalid negative budget',
        items: [
          {
            budgetItemId: itemId,
            deltaAmount: -1500000,
          },
        ],
      })
    ).rejects.toThrow(/cannot be negative/i);
  });

  it('ADV-BUD-03: Rejects creating revisions on non-approved budgets', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      title: 'Draft Budget Revision Attempt',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCatId,
          code: 'ADV_TEST_CAT',
          name: 'Test Category',
          allocatedAmount: 1000000,
        },
      ],
    });

    // Budget is still DRAFT
    await expect(
      BudgetDAO.createRevision(ctx, {
        budgetId: budget.id,
        title: 'Premature Revision',
        reason: 'Should be rejected',
        items: [{ budgetItemId: budget.items[0].id, deltaAmount: 200000 }],
      })
    ).rejects.toThrow(/Revisions can only be created for APPROVED budgets/i);
  });

  it('ADV-BUD-04: Segregation of duties: Revision preparer cannot self-authorize revision', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      title: 'Revision Auth Test',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCatId,
          code: 'ADV_TEST_CAT',
          name: 'Test Category',
          allocatedAmount: 1000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    const revision = await BudgetDAO.createRevision(ctx, {
      budgetId: budget.id,
      title: 'Supplementary Revision',
      reason: 'Legitimate revision',
      items: [{ budgetItemId: budget.items[0].id, deltaAmount: 500000 }],
    });

    // Submitter tries to authorize their own revision
    await expect(
      BudgetDAO.approveRevision(ctx, revision.id, false)
    ).rejects.toThrow(/Segregation of duties violation/i);
  });

  it('ADV-BUD-05: Rejects deleting a budget once submitted or approved', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      title: 'Budget Deletion Guard',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCatId,
          code: 'ADV_TEST_CAT',
          name: 'Test Category',
          allocatedAmount: 1000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);

    await expect(BudgetDAO.deleteDraftBudget(ctx, budget.id)).rejects.toThrow(
      /Only DRAFT budgets can be deleted/i
    );
  });

  it('ADV-BUD-06: Date Boundary Precision: Expenses outside budget boundary are excluded from actuals', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      title: '2026 Date Boundary Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCatId,
          code: 'ADV_TEST_CAT',
          name: 'Test Category',
          allocatedAmount: 10000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    // Expense from 2025 (before academic year start)
    await ExpenseDAO.createExpense(ctx, {
      categoryId: expenseCatId,
      title: 'Dec 2025 Prior Expense',
      amount: 3000000,
      paymentMethod: PaymentMethod.CASH,
      expenseDate: new Date('2025-12-15'),
    });

    // Expense in 2026 (within academic year)
    await ExpenseDAO.createExpense(ctx, {
      categoryId: expenseCatId,
      title: 'Feb 2026 Active Expense',
      amount: 2000000,
      paymentMethod: PaymentMethod.CASH,
      expenseDate: new Date('2026-02-15'),
    });

    const variance = await BudgetDAO.getLiveBudgetVariance(ctx, budget.id);

    // Actual spent should only count the 2M from 2026, ignoring 3M from 2025
    expect(variance.summary.totalActualExpenditure.toString()).toBe('2000000');
    expect(variance.summary.totalExpenditureVariance.toString()).toBe('8000000');
  });

  it('ADV-BUD-07: CSV Export produces deterministic and clean CSV rows', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      title: 'Export Test Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCatId,
          code: 'ADV_TEST_CAT',
          name: 'Test Category, with comma & "quotes"',
          allocatedAmount: 5000000,
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    const csv = await BudgetDAO.generateVarianceCsvExport(ctx, budget.id);

    expect(csv).toContain('Vote Head Code,Vote Head Name,Allocated Budget (UGX),Actual Expenditure (UGX),Variance (UGX),Utilization (%),Status');
    expect(csv).toContain('"ADV_TEST_CAT"');
    expect(csv).toContain('"TOTAL"');
  });

  it('ADV-BUD-08: Soft warning check flags isOverBudget: true without blocking expense voucher creation', async () => {
    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId,
      title: 'Soft Warning Budget',
      items: [
        {
          type: BudgetItemType.EXPENSE_VOTE_HEAD,
          categoryId: expenseCatId,
          code: 'ADV_TEST_CAT',
          name: 'Test Category',
          allocatedAmount: 1000000, // 1M cap
        },
      ],
    });

    await BudgetDAO.submitBudget(ctx, budget.id);
    await BudgetDAO.approveBudget({ ...ctx, userId: approverUserId }, budget.id);

    // Create expense of 1.5M (exceeding 1.0M budget)
    const result = await ExpenseDAO.createExpense(ctx, {
      categoryId: expenseCatId,
      title: 'Emergency Generator Overhaul',
      amount: 1500000,
      paymentMethod: PaymentMethod.CASH,
      expenseDate: new Date('2026-03-01'),
    });

    // The expense creation SUCCEEDED
    expect(result.expense.id).toBeDefined();
    expect(result.expense.status).toBe('COMPLETED');
    // And budgetCeiling flagged the overage
    expect(result.budgetCeiling?.isOverBudget).toBe(true);
    expect(result.budgetCeiling?.overBudgetAmount?.toString()).toBe('500000');
  });
});
