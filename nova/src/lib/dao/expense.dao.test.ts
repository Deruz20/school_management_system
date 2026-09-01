import { describe, it, expect, beforeEach } from 'vitest';
import { ExpenseDAO } from './expense.dao';
import { ExpenseCategoryDAO } from './expense-category.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import { PaymentMethod, ExpenseStatus, Prisma } from '@prisma/client';

describe('NOVA Finance Phase 3.1D — ExpenseDAO Integration & Invariant Tests', () => {
  let branchId1: string;
  let branchId2: string;
  let ctx1: TenantContext;
  let ctx2: TenantContext;
  let category1Id: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `ExpOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: 'Expense Test School', organizationId: org.id }
    });

    const branch1 = await db.branch.create({
      data: { name: 'Branch A', schoolId: school.id }
    });
    branchId1 = branch1.id;

    const branch2 = await db.branch.create({
      data: { name: 'Branch B', schoolId: school.id }
    });
    branchId2 = branch2.id;

    const user1 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `bursar1_${Date.now()}@test.com`,
        passwordHash: 'hash',
        firstName: 'Bursar',
        lastName: 'One',
        userType: 'STAFF'
      }
    });

    const user2 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `bursar2_${Date.now()}@test.com`,
        passwordHash: 'hash',
        firstName: 'Bursar',
        lastName: 'Two',
        userType: 'STAFF'
      }
    });

    ctx1 = {
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId1,
      userId: user1.id,
      role: 'Admin',
      permissions: ['fees:read', 'fees:write', 'fees:expenses:read', 'fees:expenses:write', 'fees:expenses:void']
    };

    ctx2 = {
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId2,
      userId: user2.id,
      role: 'Admin',
      permissions: ['fees:read', 'fees:write', 'fees:expenses:read', 'fees:expenses:write', 'fees:expenses:void']
    };

    const cat = await ExpenseCategoryDAO.create(ctx1, {
      name: 'Utilities',
      code: `UTIL_${Date.now()}`,
      description: 'Power and Water'
    });
    category1Id = cat.id;
  });

  // =========================================================================
  // EXP-01: Create Expense with Voucher Number & Decimal Money Precision
  // =========================================================================
  it('EXP-01: Creates COMPLETED expense voucher with atomic sequential number and exact Decimal(12,2)', async () => {
    const res = await ExpenseDAO.createExpense(ctx1, {
      categoryId: category1Id,
      title: 'Monthly Umeme Power Bill',
      amount: '550000.50',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      vendorName: 'Umeme Ltd',
      receiptRef: 'EFRIS-9921'
    });

    expect(res.isReplay).toBe(false);
    expect(res.expense.status).toBe(ExpenseStatus.COMPLETED);
    expect(res.expense.voucherNumber).toMatch(/^VOUCH-\d{4}-\d{5}$/);
    expect(new Prisma.Decimal(res.expense.amount).toFixed(2)).toBe('550000.50');
    expect(res.expense.vendorName).toBe('Umeme Ltd');
    expect(res.expense.receiptRef).toBe('EFRIS-9921');
  });

  // =========================================================================
  // EXP-02: Idempotent Duplicate Expense Submission
  // =========================================================================
  it('EXP-02: Replaying identical idempotencyKey returns existing voucher without duplicates', async () => {
    const idempotencyKey = `EXP_DUP_${Date.now()}`;

    const res1 = await ExpenseDAO.createExpense(ctx1, {
      categoryId: category1Id,
      title: 'Water Utility Bill',
      amount: '120000.00',
      paymentMethod: PaymentMethod.CASH,
      idempotencyKey
    });

    const res2 = await ExpenseDAO.createExpense(ctx1, {
      categoryId: category1Id,
      title: 'Water Utility Bill',
      amount: '120000.00',
      paymentMethod: PaymentMethod.CASH,
      idempotencyKey
    });

    expect(res1.isReplay).toBe(false);
    expect(res2.isReplay).toBe(true);
    expect(res2.expense.id).toBe(res1.expense.id);
    expect(res2.expense.voucherNumber).toBe(res1.expense.voucherNumber);

    const count = await db.expense.count({
      where: { branchId: branchId1, idempotencyKey }
    });
    expect(count).toBe(1);
  });

  // =========================================================================
  // EXP-03: Non-Destructive Expense Voucher Voiding
  // =========================================================================
  it('EXP-03: Voids an existing expense voucher, records mandatory reason, and preserves historical row', async () => {
    const res = await ExpenseDAO.createExpense(ctx1, {
      categoryId: category1Id,
      title: 'Lab Reagents Purchase',
      amount: '300000.00',
      paymentMethod: PaymentMethod.CASH
    });

    const voided = await ExpenseDAO.voidExpense(ctx1, res.expense.id, 'Ordered items returned and refunded');

    expect(voided.status).toBe(ExpenseStatus.VOID);
    expect(voided.voidReason).toBe('Ordered items returned and refunded');
    expect(voided.voidedAt).toBeDefined();

    // Verify cannot re-void
    await expect(
      ExpenseDAO.voidExpense(ctx1, res.expense.id, 'Trying to void again')
    ).rejects.toThrow('already voided');
  });

  // =========================================================================
  // EXP-04: Monthly & Yearly Aggregation Excludes Voided Vouchers
  // =========================================================================
  it('EXP-04: Sums active expenses accurately and excludes voided vouchers from monthly totals', async () => {
    // 1. Active expense 1: 400,000
    await ExpenseDAO.createExpense(ctx1, {
      categoryId: category1Id,
      title: 'Active Fuel Bill',
      amount: '400000.00',
      paymentMethod: PaymentMethod.MTN_MOMO
    });

    // 2. Active expense 2: 250,000
    const exp2 = await ExpenseDAO.createExpense(ctx1, {
      categoryId: category1Id,
      title: 'Void Target Bill',
      amount: '250000.00',
      paymentMethod: PaymentMethod.CASH
    });

    // 3. Void expense 2
    await ExpenseDAO.voidExpense(ctx1, exp2.expense.id, 'Cancelled transaction');

    const summary = await ExpenseDAO.getSummary(ctx1);
    expect(summary.thisMonthTotal.toFixed(2)).toBe('400000.00');
    expect(summary.thisMonthCount).toBe(1);
  });

  // =========================================================================
  // EXP-05: Multi-Tenant Branch Isolation
  // =========================================================================
  it('EXP-05: Enforces complete branch isolation across categories and expenses', async () => {
    // Branch 1 creates expense
    const res1 = await ExpenseDAO.createExpense(ctx1, {
      categoryId: category1Id,
      title: 'Branch 1 Office Rent',
      amount: '1500000.00',
      paymentMethod: PaymentMethod.BANK_TRANSFER
    });

    // Branch 2 attempts to view Branch 1 expense
    await expect(
      ExpenseDAO.getExpense(ctx2, res1.expense.id)
    ).rejects.toThrow('not found or access denied');

    // Branch 2 attempts to void Branch 1 expense
    await expect(
      ExpenseDAO.voidExpense(ctx2, res1.expense.id, 'Cross-branch attack')
    ).rejects.toThrow('not found or access denied');
  });
});
