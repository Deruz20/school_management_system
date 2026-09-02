import { db } from "../db";
import {
  Prisma,
  PaymentMethod,
  ExpenseStatus,
  CashbookMovementType,
  CashDirection,
  TreasuryAccountType
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { BudgetDAO } from "./budget.dao";
import { TreasuryDAO } from "./treasury.dao";
import crypto from "crypto";

export interface CreateExpenseInput {
  categoryId: string;
  title: string;
  amount: number | string | Prisma.Decimal;
  expenseDate?: Date | string;
  paymentMethod: PaymentMethod;
  vendorName?: string | null;
  receiptRef?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  treasuryAccountId?: string | null;
}

export interface ListExpensesFilters {
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  status?: ExpenseStatus;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

export class ExpenseDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:read') ||
      perms.includes('fees:expenses:read') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:expenses:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:expenses:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:expenses:write");
  }

  private static checkVoidPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:expenses:void') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:expenses:void");
  }

  /**
   * Concurrency-safe atomic sequence generator for Expense Voucher Numbers (e.g. VOUCH-2026-00001).
   */
  static async generateNextVoucherNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
    date: Date = new Date()
  ): Promise<string> {
    const year = date.getFullYear();
    const fallbackId = crypto.randomUUID();

    while (true) {
      const result = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "ExpenseSequence" ("id", "branchId", "year", "lastValue", "updatedAt")
        VALUES (${fallbackId}, ${branchId}, ${year}, 1, NOW())
        ON CONFLICT ("branchId", "year")
        DO UPDATE SET "lastValue" = "ExpenseSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue";
      `;

      const seq = result[0]?.lastValue ?? 1;
      const voucherNumber = `VOUCH-${year}-${seq.toString().padStart(5, '0')}`;

      const existing = await tx.expense.findUnique({
        where: { branchId_voucherNumber: { branchId, voucherNumber } }
      });

      if (!existing) {
        return voucherNumber;
      }
    }
  }

  /**
   * Record a new operating expense voucher with atomic sequential number and idempotency.
   */
  static async createExpense(ctx: TenantContext, input: CreateExpenseInput) {
    this.checkWritePermission(ctx);

    const title = input.title?.trim();
    if (!title) throw new Error("Expense title is mandatory.");

    const amount = new Prisma.Decimal(input.amount);
    if (amount.isNegative() || amount.isZero() || amount.isNaN()) {
      throw new Error("Expense amount must be a positive number.");
    }

    // Validate category in branch
    const category = await db.expenseCategory.findFirst({
      where: { id: input.categoryId, branchId: ctx.branchId }
    });
    if (!category) {
      throw new Error("Invalid expense category: Category does not belong to this branch.");
    }

    const idempotencyKey = input.idempotencyKey?.trim() || `EXP_MANUAL:${crypto.randomUUID()}`;

    // Check duplicate replay
    const existing = await db.expense.findUnique({
      where: {
        branchId_idempotencyKey: {
          branchId: ctx.branchId,
          idempotencyKey
        }
      },
      include: {
        category: true
      }
    });

    if (existing) {
      return {
        expense: existing,
        isReplay: true
      };
    }

    const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();

    const created = await db.$transaction(async (tx) => {
      const voucherNumber = await this.generateNextVoucherNumber(tx, ctx.branchId, expenseDate);

      // Resolve Treasury Account (Phase 3.1K)
      let resolvedAccountId = input.treasuryAccountId || null;
      if (!resolvedAccountId) {
        if (input.paymentMethod === PaymentMethod.CASH) {
          const defaultSafe = await tx.treasuryAccount.findFirst({
            where: {
              branchId: ctx.branchId,
              accountType: { in: [TreasuryAccountType.CASH_OFFICE_SAFE, TreasuryAccountType.CASHIER_TILL] },
              isActive: true,
            },
          });
          if (defaultSafe) resolvedAccountId = defaultSafe.id;
        } else {
          const defaultOps = await tx.treasuryAccount.findFirst({
            where: {
              branchId: ctx.branchId,
              isDefaultOperations: true,
              isActive: true,
            },
          });
          if (defaultOps) resolvedAccountId = defaultOps.id;
        }
      }

      const expense = await tx.expense.create({
        data: {
          branchId: ctx.branchId,
          categoryId: input.categoryId,
          idempotencyKey,
          voucherNumber,
          title,
          amount,
          expenseDate,
          paymentMethod: input.paymentMethod,
          vendorName: input.vendorName?.trim() || null,
          receiptRef: input.receiptRef?.trim() || null,
          notes: input.notes?.trim() || null,
          status: ExpenseStatus.COMPLETED,
          recordedById: ctx.userId,
          treasuryAccountId: resolvedAccountId,
        },
        include: {
          category: true
        }
      });

      if (resolvedAccountId) {
        await TreasuryDAO.recordCashbookMovement(tx, ctx, {
          accountId: resolvedAccountId,
          movementType: CashbookMovementType.OPERATIONAL_EXPENSE,
          direction: CashDirection.OUTFLOW,
          amount,
          description: `Expense: ${title} (${voucherNumber})`,
          referenceNumber: voucherNumber,
          expenseId: expense.id,
          transactionDate: expenseDate,
        });
      }

      return expense;
    });

    const budgetCeiling = await BudgetDAO.checkExpenseBudgetCeiling(ctx, {
      categoryId: input.categoryId,
      amount,
      expenseDate,
      excludeExpenseId: created.id,
    });

    await AuditService.log(
      ctx,
      'CREATE_EXPENSE',
      'Expense',
      created.id,
      JSON.stringify({
        expenseId: created.id,
        voucherNumber: created.voucherNumber,
        amount: created.amount.toString(),
        categoryId: created.categoryId,
        categoryName: category.name,
        paymentMethod: created.paymentMethod,
        vendorName: created.vendorName,
        isOverBudget: budgetCeiling.isOverBudget,
      })
    );

    if (budgetCeiling.isOverBudget) {
      await AuditService.log(
        ctx,
        'BUDGET_OVER_EXPENDITURE_WARNING',
        'Expense',
        created.id,
        JSON.stringify({
          budgetId: budgetCeiling.budgetId,
          budgetNumber: budgetCeiling.budgetNumber,
          categoryName: budgetCeiling.categoryName,
          allocatedBudget: budgetCeiling.allocatedBudget?.toString(),
          currentSpent: budgetCeiling.currentSpent?.toString(),
          voucherAmount: amount.toString(),
          overBudgetAmount: budgetCeiling.overBudgetAmount?.toString(),
        })
      );
    }

    return {
      expense: created,
      isReplay: false,
      budgetCeiling,
    };
  }

  /**
   * Non-destructive expense voucher voiding.
   */
  static async voidExpense(ctx: TenantContext, id: string, reason: string) {
    this.checkVoidPermission(ctx);

    const voidReason = reason?.trim();
    if (!voidReason) {
      throw new Error("Void reason is mandatory.");
    }

    const expense = await db.expense.findFirst({
      where: { id, branchId: ctx.branchId }
    });

    if (!expense) {
      throw new Error("Expense voucher not found or access denied.");
    }

    if (expense.status === ExpenseStatus.VOID) {
      throw new Error("Expense voucher is already voided.");
    }

    const voided = await db.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.VOID,
          voidedAt: new Date(),
          voidReason,
          voidedById: ctx.userId
        },
        include: {
          category: true
        }
      });

      if (expense.treasuryAccountId) {
        await TreasuryDAO.recordCashbookMovement(tx, ctx, {
          accountId: expense.treasuryAccountId,
          movementType: CashbookMovementType.EXPENSE_VOID_IN,
          direction: CashDirection.INFLOW,
          amount: expense.amount,
          description: `Expense Void Re-credit: ${expense.title} (${expense.voucherNumber})`,
          referenceNumber: expense.voucherNumber,
          expenseId: expense.id,
        });
      }

      return updated;
    });

    await AuditService.log(
      ctx,
      'VOID_EXPENSE',
      'Expense',
      id,
      JSON.stringify({
        expenseId: id,
        voucherNumber: voided.voucherNumber,
        amount: voided.amount.toString(),
        reason: voidReason
      })
    );

    return voided;
  }

  /**
   * Get single expense voucher.
   */
  static async getExpense(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const expense = await db.expense.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        category: true
      }
    });

    if (!expense) {
      throw new Error("Expense voucher not found or access denied.");
    }

    return expense;
  }

  /**
   * List expenses with filters, pagination, and summary totals.
   */
  static async listExpenses(ctx: TenantContext, filters: ListExpensesFilters = {}) {
    this.checkReadPermission(ctx);

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      branchId: ctx.branchId,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { voucherNumber: { contains: filters.search, mode: 'insensitive' } },
              { vendorName: { contains: filters.search, mode: 'insensitive' } },
              { receiptRef: { contains: filters.search, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(filters.startDate || filters.endDate
        ? {
            expenseDate: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {})
            }
          }
        : {})
    };

    const [total, expenses] = await Promise.all([
      db.expense.count({ where }),
      db.expense.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, code: true }
          }
        },
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit
      })
    ]);

    return {
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Aggregates active expenses for current month and current year.
   */
  static async getSummary(ctx: TenantContext, referenceDate: Date = new Date()) {
    this.checkReadPermission(ctx);

    const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const endOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
    const endOfYear = new Date(referenceDate.getFullYear(), 11, 31, 23, 59, 59, 999);

    const [monthExpenses, yearExpenses] = await Promise.all([
      db.expense.findMany({
        where: {
          branchId: ctx.branchId,
          status: ExpenseStatus.COMPLETED,
          expenseDate: { gte: startOfMonth, lte: endOfMonth }
        },
        select: { amount: true }
      }),
      db.expense.findMany({
        where: {
          branchId: ctx.branchId,
          status: ExpenseStatus.COMPLETED,
          expenseDate: { gte: startOfYear, lte: endOfYear }
        },
        select: { amount: true }
      })
    ]);

    const totalMonth = monthExpenses.reduce((acc, e) => acc.add(e.amount), new Prisma.Decimal(0));
    const totalYear = yearExpenses.reduce((acc, e) => acc.add(e.amount), new Prisma.Decimal(0));

    return {
      thisMonthTotal: totalMonth,
      thisYearTotal: totalYear,
      thisMonthCount: monthExpenses.length,
      thisYearCount: yearExpenses.length
    };
  }
}
