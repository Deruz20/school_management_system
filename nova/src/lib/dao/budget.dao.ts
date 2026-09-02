import { db } from "../db";
import {
  Prisma,
  Budget,
  BudgetItem,
  ExpenseCategory,
  FeeType,
  AcademicYear,
  Term,
  BudgetStatus,
  BudgetItemType,
  BudgetRevisionStatus,
  ExpenseStatus,
  InvoiceStatus,
  AllocationStatus,
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export type ActiveApprovedBudget = (Budget & {
  items: (BudgetItem & { category: ExpenseCategory | null; feeType: FeeType | null })[];
  academicYear: AcademicYear;
  term: Term | null;
}) | null;

export interface CreateBudgetItemInput {
  type?: BudgetItemType;
  categoryId?: string;
  feeTypeId?: string;
  code: string;
  name: string;
  allocatedAmount: number | string | Prisma.Decimal;
  notes?: string;
}

export interface CreateBudgetInput {
  academicYearId: string;
  termId?: string | null;
  title: string;
  description?: string;
  items: CreateBudgetItemInput[];
}

export interface UpdateDraftBudgetInput {
  id: string;
  title?: string;
  description?: string;
  items?: CreateBudgetItemInput[];
}

export interface CreateRevisionItemInput {
  budgetItemId: string;
  deltaAmount: number | string | Prisma.Decimal;
  notes?: string;
}

export interface CreateBudgetRevisionInput {
  budgetId: string;
  title: string;
  reason: string;
  items: CreateRevisionItemInput[];
}

export interface BudgetFilterParams {
  academicYearId?: string;
  termId?: string | null;
  status?: BudgetStatus;
  search?: string;
}

export class BudgetDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('finance:budget:read') ||
      perms.includes('fees:read') ||
      perms.includes('fees:reports:read') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: finance:budget:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('finance:budget:write') ||
      perms.includes('finance:budget:create') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: finance:budget:write");
  }

  private static checkSubmitPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('finance:budget:submit') ||
      perms.includes('finance:budget:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: finance:budget:submit");
  }

  private static checkApprovePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('finance:budget:approve') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: finance:budget:approve");
  }

  private static checkRevisePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('finance:budget:revise') ||
      perms.includes('finance:budget:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: finance:budget:revise");
  }

  private static checkExportPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('finance:budget:export') ||
      perms.includes('finance:budget:read') ||
      perms.includes('fees:reports:read') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: finance:budget:export");
  }

  /**
   * Generates next atomic, collision-safe budget number (BUD-YYYY-0001).
   */
  static async generateNextBudgetNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
    year: number
  ): Promise<string> {
    const seq = await tx.budgetSequence.upsert({
      where: {
        branchId_year: {
          branchId,
          year,
        },
      },
      update: {
        lastValue: {
          increment: 1,
        },
      },
      create: {
        branchId,
        year,
        lastValue: 1,
      },
    });

    const padded = String(seq.lastValue).padStart(4, '0');
    return `BUD-${year}-${padded}`;
  }

  /**
   * Creates a new draft budget with expense vote heads and revenue targets.
   */
  static async createBudget(ctx: TenantContext, input: CreateBudgetInput) {
    this.checkWritePermission(ctx);
    const branchId = ctx.branchId!;

    // Validate Academic Year belongs to branch
    const academicYear = await db.academicYear.findFirst({
      where: { id: input.academicYearId, branchId },
    });
    if (!academicYear) {
      throw new Error("Academic Year not found or access denied.");
    }

    if (input.termId) {
      const term = await db.term.findFirst({
        where: { id: input.termId, academicYearId: input.academicYearId },
      });
      if (!term) {
        throw new Error("Term not found or does not belong to selected Academic Year.");
      }
    }

    // Validate period uniqueness
    const existing = await db.budget.findFirst({
      where: {
        branchId,
        academicYearId: input.academicYearId,
        termId: input.termId || null,
      },
    });
    if (existing) {
      throw new Error(
        `A budget already exists for this ${input.termId ? 'Term' : 'Academic Year'} (${existing.budgetNumber} - ${existing.status}).`
      );
    }

    // Validate Items and calculate totals
    let totalExpense = new Prisma.Decimal(0);
    let totalIncome = new Prisma.Decimal(0);

    const validatedItems: Array<{
      type: BudgetItemType;
      categoryId?: string | null;
      feeTypeId?: string | null;
      code: string;
      name: string;
      allocatedAmount: Prisma.Decimal;
      notes?: string | null;
    }> = [];

    for (const item of input.items) {
      const amount = new Prisma.Decimal(item.allocatedAmount.toString());
      if (amount.lessThan(0)) {
        throw new Error(`Allocated amount for item "${item.name}" cannot be negative.`);
      }

      const itemType = item.type || BudgetItemType.EXPENSE_VOTE_HEAD;

      if (itemType === BudgetItemType.EXPENSE_VOTE_HEAD) {
        if (item.categoryId) {
          const cat = await db.expenseCategory.findFirst({
            where: { id: item.categoryId, branchId },
          });
          if (!cat) {
            throw new Error(`Expense Category not found or access denied for item "${item.name}".`);
          }
        }
        totalExpense = totalExpense.add(amount);
      } else {
        if (item.feeTypeId) {
          const feeType = await db.feeType.findFirst({
            where: { id: item.feeTypeId, branchId },
          });
          if (!feeType) {
            throw new Error(`Fee Type not found or access denied for revenue target "${item.name}".`);
          }
        }
        totalIncome = totalIncome.add(amount);
      }

      validatedItems.push({
        type: itemType,
        categoryId: item.categoryId || null,
        feeTypeId: item.feeTypeId || null,
        code: item.code.trim().toUpperCase(),
        name: item.name.trim(),
        allocatedAmount: amount,
        notes: item.notes?.trim() || null,
      });
    }

    const netSurplus = totalIncome.minus(totalExpense);
    const year = academicYear.startDate.getFullYear() || new Date().getFullYear();

    const createdBudget = await db.$transaction(async (tx) => {
      const budgetNumber = await this.generateNextBudgetNumber(tx, branchId, year);

      const budget = await tx.budget.create({
        data: {
          branchId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          budgetNumber,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          status: BudgetStatus.DRAFT,
          totalIncome,
          totalExpense,
          netSurplus,
          createdById: ctx.userId!,
          items: {
            create: validatedItems,
          },
        },
        include: {
          items: {
            include: {
              category: true,
              feeType: true,
            },
          },
          academicYear: true,
          term: true,
        },
      });

      return budget;
    });

    await AuditService.log(
      ctx,
      'BUDGET_CREATED',
      'Budget',
      createdBudget.id,
      JSON.stringify({
        budgetNumber: createdBudget.budgetNumber,
        title: createdBudget.title,
        totalExpense: createdBudget.totalExpense.toString(),
        totalIncome: createdBudget.totalIncome.toString(),
        netSurplus: createdBudget.netSurplus.toString(),
        itemCount: createdBudget.items.length,
      })
    );

    return createdBudget;
  }

  /**
   * Updates an existing draft budget.
   */
  static async updateDraftBudget(ctx: TenantContext, input: UpdateDraftBudgetInput) {
    this.checkWritePermission(ctx);
    const branchId = ctx.branchId!;

    const existing = await db.budget.findFirst({
      where: { id: input.id, branchId },
      include: { items: true },
    });

    if (!existing) {
      throw new Error("Budget not found or access denied.");
    }

    if (existing.status !== BudgetStatus.DRAFT) {
      throw new Error(`Cannot modify budget in status ${existing.status}. Only DRAFT budgets can be edited.`);
    }

    return await db.$transaction(async (tx) => {
      let totalExpense = existing.totalExpense;
      let totalIncome = existing.totalIncome;

      if (input.items) {
        // Delete existing items and recreate
        await tx.budgetItem.deleteMany({
          where: { budgetId: existing.id },
        });

        totalExpense = new Prisma.Decimal(0);
        totalIncome = new Prisma.Decimal(0);

        const validatedItems: Array<{
          budgetId: string;
          type: BudgetItemType;
          categoryId?: string | null;
          feeTypeId?: string | null;
          code: string;
          name: string;
          allocatedAmount: Prisma.Decimal;
          notes?: string | null;
        }> = [];

        for (const item of input.items) {
          const amount = new Prisma.Decimal(item.allocatedAmount.toString());
          if (amount.lessThan(0)) {
            throw new Error(`Allocated amount for item "${item.name}" cannot be negative.`);
          }

          const itemType = item.type || BudgetItemType.EXPENSE_VOTE_HEAD;

          if (itemType === BudgetItemType.EXPENSE_VOTE_HEAD) {
            totalExpense = totalExpense.add(amount);
          } else {
            totalIncome = totalIncome.add(amount);
          }

          validatedItems.push({
            budgetId: existing.id,
            type: itemType,
            categoryId: item.categoryId || null,
            feeTypeId: item.feeTypeId || null,
            code: item.code.trim().toUpperCase(),
            name: item.name.trim(),
            allocatedAmount: amount,
            notes: item.notes?.trim() || null,
          });
        }

        await tx.budgetItem.createMany({
          data: validatedItems,
        });
      }

      const netSurplus = totalIncome.minus(totalExpense);

      const updated = await tx.budget.update({
        where: { id: existing.id },
        data: {
          title: input.title ? input.title.trim() : existing.title,
          description: input.description !== undefined ? input.description?.trim() : existing.description,
          totalExpense,
          totalIncome,
          netSurplus,
        },
        include: {
          items: {
            include: {
              category: true,
              feeType: true,
            },
          },
          academicYear: true,
          term: true,
        },
      });

      return updated;
    });
  }

  /**
   * Deletes a draft budget.
   */
  static async deleteDraftBudget(ctx: TenantContext, id: string) {
    this.checkWritePermission(ctx);
    const branchId = ctx.branchId!;

    const existing = await db.budget.findFirst({
      where: { id, branchId },
      include: { revisions: true },
    });

    if (!existing) {
      throw new Error("Budget not found or access denied.");
    }

    if (existing.status !== BudgetStatus.DRAFT) {
      throw new Error(`Cannot delete budget in status ${existing.status}. Only DRAFT budgets can be deleted.`);
    }

    if (existing.revisions.length > 0) {
      throw new Error("Cannot delete budget with existing revision records.");
    }

    await db.budget.delete({
      where: { id },
    });

    await AuditService.log(
      ctx,
      'BUDGET_DELETED',
      'Budget',
      id,
      JSON.stringify({ budgetNumber: existing.budgetNumber, title: existing.title })
    );

    return { success: true };
  }

  /**
   * Gets detailed budget with items, categories, fee types, revisions, and approval info.
   */
  static async getBudgetDetail(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);
    const branchId = ctx.branchId!;

    const budget = await db.budget.findFirst({
      where: { id, branchId },
      include: {
        academicYear: true,
        term: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        submittedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        items: {
          include: {
            category: true,
            feeType: true,
          },
          orderBy: [{ type: 'asc' }, { code: 'asc' }],
        },
        revisions: {
          include: {
            preparedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            authorizedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            items: {
              include: {
                budgetItem: true,
              },
            },
          },
          orderBy: { revisionNumber: 'desc' },
        },
      },
    });

    return budget;
  }

  /**
   * Lists budgets with optional filters.
   */
  static async listBudgets(ctx: TenantContext, filters: BudgetFilterParams = {}) {
    this.checkReadPermission(ctx);
    const branchId = ctx.branchId!;

    const where: Prisma.BudgetWhereInput = {
      branchId,
      ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
      ...(filters.termId !== undefined
        ? { termId: filters.termId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { budgetNumber: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const budgets = await db.budget.findMany({
      where,
      include: {
        academicYear: true,
        term: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: {
            items: true,
            revisions: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return budgets;
  }

  /**
   * Gets active approved budget for a period or date.
   */
  static async getActiveApprovedBudget(
    ctx: TenantContext,
    params: { academicYearId?: string; termId?: string | null; date?: Date } = {}
  ): Promise<ActiveApprovedBudget> {
    this.checkReadPermission(ctx);
    const branchId = ctx.branchId!;

    const academicYearId = params.academicYearId;
    const termId = params.termId;

    // If explicit academicYearId is provided
    if (academicYearId) {
      if (termId) {
        const termBudget = await db.budget.findFirst({
          where: {
            branchId,
            academicYearId,
            termId,
            status: BudgetStatus.APPROVED,
          },
          include: {
            items: { include: { category: true, feeType: true } },
            academicYear: true,
            term: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (termBudget) return termBudget;
      }

      const annualBudget = await db.budget.findFirst({
        where: {
          branchId,
          academicYearId,
          termId: null,
          status: BudgetStatus.APPROVED,
        },
        include: {
          items: { include: { category: true, feeType: true } },
          academicYear: true,
          term: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (annualBudget) return annualBudget;
    }

    // Match by date
    const targetDate = params.date || new Date();

    // 1. Term budget active for date
    const approvedTermBudget = await db.budget.findFirst({
      where: {
        branchId,
        status: BudgetStatus.APPROVED,
        termId: { not: null },
        term: {
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
      },
      include: {
        items: { include: { category: true, feeType: true } },
        academicYear: true,
        term: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (approvedTermBudget) return approvedTermBudget;

    // 2. Annual budget active for date
    const approvedAnnualBudget = await db.budget.findFirst({
      where: {
        branchId,
        status: BudgetStatus.APPROVED,
        termId: null,
        academicYear: {
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
      },
      include: {
        items: { include: { category: true, feeType: true } },
        academicYear: true,
        term: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (approvedAnnualBudget) return approvedAnnualBudget;

    // 3. Fallback to branch settings
    const settings = await db.branchSettings.findUnique({
      where: { branchId },
    });
    if (settings?.activeAcademicYearId && settings.activeAcademicYearId !== academicYearId) {
      return this.getActiveApprovedBudget(ctx, {
        academicYearId: settings.activeAcademicYearId,
        termId: settings.activeTermId,
      });
    }

    return null;
  }

  /**
   * Submits a draft budget for board approval.
   */
  static async submitBudget(ctx: TenantContext, id: string) {
    this.checkSubmitPermission(ctx);
    const branchId = ctx.branchId!;

    const budget = await db.budget.findFirst({
      where: { id, branchId },
      include: { items: true },
    });

    if (!budget) throw new Error("Budget not found or access denied.");
    if (budget.status !== BudgetStatus.DRAFT) {
      throw new Error(`Only DRAFT budgets can be submitted. Current status: ${budget.status}.`);
    }

    if (budget.items.length === 0) {
      throw new Error("Cannot submit an empty budget with no line items.");
    }

    const submittedAt = new Date();
    const updated = await db.budget.update({
      where: { id },
      data: {
        status: BudgetStatus.SUBMITTED,
        submittedById: ctx.userId,
        submittedAt,
        rejectionReason: null,
      },
      include: {
        academicYear: true,
        term: true,
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await AuditService.log(
      ctx,
      'BUDGET_SUBMITTED',
      'Budget',
      id,
      JSON.stringify({
        budgetNumber: budget.budgetNumber,
        totalExpense: budget.totalExpense.toString(),
        totalIncome: budget.totalIncome.toString(),
        submittedById: ctx.userId,
      })
    );

    return updated;
  }

  /**
   * Approves a submitted budget with four-eye governance.
   */
  static async approveBudget(ctx: TenantContext, id: string, allowSingleAdminMode: boolean = false) {
    this.checkApprovePermission(ctx);
    const branchId = ctx.branchId!;

    const budget = await db.budget.findFirst({
      where: { id, branchId },
    });

    if (!budget) throw new Error("Budget not found or access denied.");
    if (budget.status !== BudgetStatus.SUBMITTED) {
      throw new Error(`Only SUBMITTED budgets can be approved. Current status: ${budget.status}.`);
    }

    // Four-Eye Segregation of Duties Check
    if (!allowSingleAdminMode && budget.submittedById && budget.submittedById === ctx.userId) {
      throw new Error("Segregation of duties violation: Submitter cannot self-approve budget.");
    }

    const approvedAt = new Date();

    const updated = await db.$transaction(async (tx) => {
      // Deactivate any previously approved budget for the exact same period
      await tx.budget.updateMany({
        where: {
          branchId,
          academicYearId: budget.academicYearId,
          termId: budget.termId,
          status: BudgetStatus.APPROVED,
          id: { not: id },
        },
        data: {
          status: BudgetStatus.CLOSED,
        },
      });

      return await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.APPROVED,
          approvedById: ctx.userId,
          approvedAt,
          rejectionReason: null,
        },
        include: {
          academicYear: true,
          term: true,
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          items: { include: { category: true, feeType: true } },
        },
      });
    });

    await AuditService.log(
      ctx,
      'BUDGET_APPROVED',
      'Budget',
      id,
      JSON.stringify({
        budgetNumber: budget.budgetNumber,
        totalExpense: budget.totalExpense.toString(),
        totalIncome: budget.totalIncome.toString(),
        approvedById: ctx.userId,
        allowSingleAdminMode,
      })
    );

    return updated;
  }

  /**
   * Rejects a submitted budget with feedback reason.
   */
  static async rejectBudget(ctx: TenantContext, id: string, reason: string) {
    this.checkApprovePermission(ctx);
    const branchId = ctx.branchId!;

    if (!reason || reason.trim().length === 0) {
      throw new Error("A rejection reason is required.");
    }

    const budget = await db.budget.findFirst({
      where: { id, branchId },
    });

    if (!budget) throw new Error("Budget not found or access denied.");
    if (budget.status !== BudgetStatus.SUBMITTED) {
      throw new Error(`Only SUBMITTED budgets can be rejected. Current status: ${budget.status}.`);
    }

    const updated = await db.budget.update({
      where: { id },
      data: {
        status: BudgetStatus.DRAFT,
        rejectionReason: reason.trim(),
        submittedById: null,
        submittedAt: null,
        approvedById: null,
        approvedAt: null,
      },
      include: {
        academicYear: true,
        term: true,
      },
    });

    await AuditService.log(
      ctx,
      'BUDGET_REJECTED',
      'Budget',
      id,
      JSON.stringify({
        budgetNumber: budget.budgetNumber,
        rejectedById: ctx.userId,
        reason: reason.trim(),
      })
    );

    return updated;
  }

  /**
   * Creates a supplementary budget revision with frozen snapshot.
   */
  static async createRevision(ctx: TenantContext, input: CreateBudgetRevisionInput) {
    this.checkRevisePermission(ctx);
    const branchId = ctx.branchId!;

    if (!input.reason || input.reason.trim().length === 0) {
      throw new Error("A reason is required for budget revisions.");
    }

    const budget = await db.budget.findFirst({
      where: { id: input.budgetId, branchId },
      include: { items: true },
    });

    if (!budget) throw new Error("Budget not found or access denied.");
    if (budget.status !== BudgetStatus.APPROVED) {
      throw new Error(`Revisions can only be created for APPROVED budgets. Current status: ${budget.status}.`);
    }

    // Freeze existing snapshot
    const snapshotJson = JSON.stringify({
      budgetNumber: budget.budgetNumber,
      totalExpense: budget.totalExpense.toString(),
      totalIncome: budget.totalIncome.toString(),
      netSurplus: budget.netSurplus.toString(),
      items: budget.items.map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        type: i.type,
        categoryId: i.categoryId,
        feeTypeId: i.feeTypeId,
        allocatedAmount: i.allocatedAmount.toString(),
      })),
    });

    return await db.$transaction(async (tx) => {
      // Find highest revision number
      const lastRev = await tx.budgetRevision.findFirst({
        where: { budgetId: budget.id },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      });
      const nextRevisionNumber = (lastRev?.revisionNumber || 0) + 1;

      let totalDelta = new Prisma.Decimal(0);
      const revisionItemsData: Array<{
        budgetItemId: string;
        previousAmount: Prisma.Decimal;
        deltaAmount: Prisma.Decimal;
        newAmount: Prisma.Decimal;
        notes?: string | null;
      }> = [];

      for (const revItem of input.items) {
        const item = budget.items.find((i) => i.id === revItem.budgetItemId);
        if (!item) {
          throw new Error(`Budget item with ID ${revItem.budgetItemId} does not belong to this budget.`);
        }

        const delta = new Prisma.Decimal(revItem.deltaAmount.toString());
        const previousAmount = item.allocatedAmount;
        const newAmount = previousAmount.plus(delta);

        if (newAmount.lessThan(0)) {
          throw new Error(`New amount for "${item.name}" cannot be negative (UGX ${newAmount.toFixed(2)}).`);
        }

        totalDelta = totalDelta.add(delta);

        revisionItemsData.push({
          budgetItemId: item.id,
          previousAmount,
          deltaAmount: delta,
          newAmount,
          notes: revItem.notes?.trim() || null,
        });
      }

      const revision = await tx.budgetRevision.create({
        data: {
          budgetId: budget.id,
          revisionNumber: nextRevisionNumber,
          title: input.title.trim(),
          reason: input.reason.trim(),
          status: BudgetRevisionStatus.DRAFT,
          totalDelta,
          snapshotJson,
          preparedById: ctx.userId!,
          items: {
            create: revisionItemsData,
          },
        },
        include: {
          items: { include: { budgetItem: true } },
          preparedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return revision;
    });
  }

  /**
   * Authorizes and applies a supplementary budget revision.
   */
  static async approveRevision(
    ctx: TenantContext,
    revisionId: string,
    allowSingleAdminMode: boolean = false
  ) {
    this.checkApprovePermission(ctx);
    const branchId = ctx.branchId!;

    const revision = await db.budgetRevision.findUnique({
      where: { id: revisionId },
      include: {
        budget: { include: { items: true } },
        items: true,
      },
    });

    if (!revision || revision.budget.branchId !== branchId) {
      throw new Error("Budget revision not found or access denied.");
    }

    if (revision.status !== BudgetRevisionStatus.DRAFT) {
      throw new Error(`Revision is already ${revision.status}.`);
    }

    // Four-Eye Segregation
    if (!allowSingleAdminMode && revision.preparedById && revision.preparedById === ctx.userId) {
      throw new Error("Segregation of duties violation: Submitter cannot self-authorize budget revision.");
    }

    const authorizedAt = new Date();

    const updated = await db.$transaction(async (tx) => {
      let expenseDelta = new Prisma.Decimal(0);
      let incomeDelta = new Prisma.Decimal(0);

      // Apply delta amounts to budget items
      for (const revItem of revision.items) {
        const budgetItem = revision.budget.items.find((i) => i.id === revItem.budgetItemId);
        if (budgetItem) {
          const newAllocated = budgetItem.allocatedAmount.plus(revItem.deltaAmount);

          await tx.budgetItem.update({
            where: { id: budgetItem.id },
            data: { allocatedAmount: newAllocated },
          });

          if (budgetItem.type === BudgetItemType.EXPENSE_VOTE_HEAD) {
            expenseDelta = expenseDelta.add(revItem.deltaAmount);
          } else {
            incomeDelta = incomeDelta.add(revItem.deltaAmount);
          }
        }
      }

      const updatedBudget = await tx.budget.update({
        where: { id: revision.budgetId },
        data: {
          totalExpense: revision.budget.totalExpense.plus(expenseDelta),
          totalIncome: revision.budget.totalIncome.plus(incomeDelta),
          netSurplus: revision.budget.totalIncome.plus(incomeDelta).minus(revision.budget.totalExpense.plus(expenseDelta)),
        },
      });

      const approvedRev = await tx.budgetRevision.update({
        where: { id: revisionId },
        data: {
          status: BudgetRevisionStatus.APPROVED,
          authorizedById: ctx.userId,
          authorizedAt,
        },
        include: {
          authorizedBy: { select: { id: true, firstName: true, lastName: true } },
          items: { include: { budgetItem: true } },
        },
      });

      return { revision: approvedRev, budget: updatedBudget };
    });

    await AuditService.log(
      ctx,
      'BUDGET_REVISION_APPROVED',
      'BudgetRevision',
      revisionId,
      JSON.stringify({
        budgetId: revision.budgetId,
        revisionNumber: revision.revisionNumber,
        authorizedById: ctx.userId,
        totalDelta: revision.totalDelta.toString(),
      })
    );

    return updated;
  }

  /**
   * Computes real-time Budget vs Actuals variance for all expense vote heads.
   */
  static async getLiveBudgetVariance(ctx: TenantContext, budgetId: string) {
    this.checkReadPermission(ctx);
    const branchId = ctx.branchId!;

    const budget = await db.budget.findFirst({
      where: { id: budgetId, branchId },
      include: {
        academicYear: true,
        term: true,
        items: {
          where: { type: BudgetItemType.EXPENSE_VOTE_HEAD },
          include: { category: true },
          orderBy: { code: 'asc' },
        },
      },
    });

    if (!budget) throw new Error("Budget not found or access denied.");

    // Date boundaries
    const startDate = budget.term ? budget.term.startDate : budget.academicYear.startDate;
    const endDate = budget.term ? budget.term.endDate : budget.academicYear.endDate;

    // Query active COMPLETED expenses in date boundary
    const completedExpenses = await db.expense.findMany({
      where: {
        branchId,
        status: ExpenseStatus.COMPLETED,
        expenseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        categoryId: true,
        amount: true,
      },
    });

    // Map actual spent per category
    const actualsByCategory = new Map<string, Prisma.Decimal>();
    let totalActualExpenditure = new Prisma.Decimal(0);

    for (const exp of completedExpenses) {
      const current = actualsByCategory.get(exp.categoryId) || new Prisma.Decimal(0);
      actualsByCategory.set(exp.categoryId, current.add(exp.amount));
      totalActualExpenditure = totalActualExpenditure.add(exp.amount);
    }

    // Build itemized variance breakdown
    const itemVariances = budget.items.map((item) => {
      const categoryId = item.categoryId;
      const actualSpent = categoryId
        ? actualsByCategory.get(categoryId) || new Prisma.Decimal(0)
        : new Prisma.Decimal(0);

      const allocated = item.allocatedAmount;
      const variance = allocated.minus(actualSpent);
      
      let utilizationPercent = 0;
      if (allocated.greaterThan(0)) {
        utilizationPercent = Number(
          actualSpent.times(100).dividedBy(allocated).toFixed(2)
        );
      } else if (actualSpent.greaterThan(0)) {
        utilizationPercent = 100.0;
      }

      let status: 'HEALTHY' | 'WARNING' | 'OVER_BUDGET' = 'HEALTHY';
      if (utilizationPercent > 100) {
        status = 'OVER_BUDGET';
      } else if (utilizationPercent >= 80) {
        status = 'WARNING';
      }

      return {
        id: item.id,
        code: item.code,
        name: item.name,
        categoryId: item.categoryId,
        categoryName: item.category?.name || item.name,
        allocatedAmount: allocated,
        actualSpent,
        variance,
        utilizationPercent,
        status,
      };
    });

    const totalAllocatedExpense = budget.totalExpense;
    const totalExpenditureVariance = totalAllocatedExpense.minus(totalActualExpenditure);
    let totalUtilizationPercent = 0;
    if (totalAllocatedExpense.greaterThan(0)) {
      totalUtilizationPercent = Number(
        totalActualExpenditure.times(100).dividedBy(totalAllocatedExpense).toFixed(2)
      );
    }

    return {
      budgetId: budget.id,
      budgetNumber: budget.budgetNumber,
      title: budget.title,
      status: budget.status,
      period: {
        academicYearName: budget.academicYear.name,
        termName: budget.term?.name || 'Full Academic Year',
        startDate,
        endDate,
      },
      summary: {
        totalAllocatedExpense,
        totalActualExpenditure,
        totalExpenditureVariance,
        totalUtilizationPercent,
        isOverBudget: totalActualExpenditure.greaterThan(totalAllocatedExpense),
      },
      items: itemVariances,
    };
  }

  /**
   * Computes Revenue Realization comparing targets with actual invoiced accrual and payments.
   */
  static async getRevenueRealization(ctx: TenantContext, budgetId: string) {
    this.checkReadPermission(ctx);
    const branchId = ctx.branchId!;

    const budget = await db.budget.findFirst({
      where: { id: budgetId, branchId },
      include: {
        academicYear: true,
        term: true,
        items: {
          where: { type: BudgetItemType.REVENUE_TARGET },
          include: { feeType: true },
          orderBy: { code: 'asc' },
        },
      },
    });

    if (!budget) throw new Error("Budget not found or access denied.");

    const startDate = budget.term ? budget.term.startDate : budget.academicYear.startDate;
    const endDate = budget.term ? budget.term.endDate : budget.academicYear.endDate;

    // Actual invoiced amounts in period (accrual basis)
    const invoiceItems = await db.invoiceItem.findMany({
      where: {
        invoice: {
          branchId,
          status: { not: InvoiceStatus.VOID },
          academicYearId: budget.academicYearId,
          ...(budget.termId ? { termId: budget.termId } : {}),
        },
      },
      select: {
        feeTypeId: true,
        lineTotal: true,
      },
    });

    // Actual payments collected in period (cash basis)
    const paymentAllocations = await db.paymentAllocation.findMany({
      where: {
        status: AllocationStatus.ACTIVE,
        payment: {
          branchId,
          paymentDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        invoice: {
          academicYearId: budget.academicYearId,
          ...(budget.termId ? { termId: budget.termId } : {}),
        },
      },
      select: {
        amount: true,
      },
    });

    const invoicedByFeeType = new Map<string, Prisma.Decimal>();
    let totalInvoicedRevenue = new Prisma.Decimal(0);

    for (const item of invoiceItems) {
      if (item.feeTypeId) {
        const current = invoicedByFeeType.get(item.feeTypeId) || new Prisma.Decimal(0);
        invoicedByFeeType.set(item.feeTypeId, current.add(item.lineTotal));
      }
      totalInvoicedRevenue = totalInvoicedRevenue.add(item.lineTotal);
    }

    const totalCollectedCash = paymentAllocations.reduce(
      (acc, p) => acc.add(p.amount),
      new Prisma.Decimal(0)
    );

    const revenueItems = budget.items.map((item) => {
      const feeTypeId = item.feeTypeId;
      const actualInvoiced = feeTypeId
        ? invoicedByFeeType.get(feeTypeId) || new Prisma.Decimal(0)
        : new Prisma.Decimal(0);

      const target = item.allocatedAmount;
      const shortfall = target.minus(actualInvoiced);
      let realizationPercent = 0;
      if (target.greaterThan(0)) {
        realizationPercent = Number(
          actualInvoiced.times(100).dividedBy(target).toFixed(2)
        );
      }

      return {
        id: item.id,
        code: item.code,
        name: item.name,
        feeTypeId: item.feeTypeId,
        feeTypeName: item.feeType?.name || item.name,
        targetAmount: target,
        actualInvoiced,
        shortfall,
        realizationPercent,
      };
    });

    const totalTargetIncome = budget.totalIncome;
    const totalShortfall = totalTargetIncome.minus(totalInvoicedRevenue);
    let overallRealizationPercent = 0;
    if (totalTargetIncome.greaterThan(0)) {
      overallRealizationPercent = Number(
        totalInvoicedRevenue.times(100).dividedBy(totalTargetIncome).toFixed(2)
      );
    }

    return {
      budgetId: budget.id,
      budgetNumber: budget.budgetNumber,
      title: budget.title,
      summary: {
        totalTargetIncome,
        totalInvoicedRevenue,
        totalCollectedCash,
        totalShortfall,
        overallRealizationPercent,
      },
      items: revenueItems,
    };
  }

  /**
   * Pre-flight ceiling check when creating/approving an Expense voucher.
   */
  static async checkExpenseBudgetCeiling(
    ctx: TenantContext,
    params: {
      categoryId: string;
      amount: number | string | Prisma.Decimal;
      expenseDate?: Date;
      excludeExpenseId?: string;
    }
  ) {
    const branchId = ctx.branchId!;
    const voucherAmount = new Prisma.Decimal(params.amount.toString());
    const expenseDate = params.expenseDate || new Date();

    const activeBudget = await this.getActiveApprovedBudget(ctx, {
      date: expenseDate,
    });

    if (!activeBudget) {
      return {
        hasActiveBudget: false,
        isOverBudget: false,
        voucherAmount,
      };
    }

    const budgetItem = activeBudget.items.find(
      (i: { categoryId?: string | null; type: BudgetItemType; name: string; allocatedAmount: Prisma.Decimal }) =>
        i.categoryId === params.categoryId && i.type === BudgetItemType.EXPENSE_VOTE_HEAD
    );

    if (!budgetItem) {
      return {
        hasActiveBudget: true,
        budgetId: activeBudget.id,
        budgetNumber: activeBudget.budgetNumber,
        hasVoteHead: false,
        isOverBudget: false,
        voucherAmount,
      };
    }

    const startDate = activeBudget.term ? activeBudget.term.startDate : activeBudget.academicYear.startDate;
    const endDate = activeBudget.term ? activeBudget.term.endDate : activeBudget.academicYear.endDate;

    // Sum completed expenses in this category (excluding current expense if already inserted)
    const aggregate = await db.expense.aggregate({
      where: {
        branchId,
        categoryId: params.categoryId,
        status: ExpenseStatus.COMPLETED,
        ...(params.excludeExpenseId ? { id: { not: params.excludeExpenseId } } : {}),
        expenseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { amount: true },
    });

    const currentSpent = aggregate._sum.amount || new Prisma.Decimal(0);
    const allocatedBudget = budgetItem.allocatedAmount;
    const projectedSpent = currentSpent.plus(voucherAmount);
    const remainingBudget = allocatedBudget.minus(currentSpent);
    const isOverBudget = projectedSpent.greaterThan(allocatedBudget);
    const overBudgetAmount = isOverBudget ? projectedSpent.minus(allocatedBudget) : new Prisma.Decimal(0);

    let utilizationPercent = 0;
    if (allocatedBudget.greaterThan(0)) {
      utilizationPercent = Number(
        projectedSpent.times(100).dividedBy(allocatedBudget).toFixed(2)
      );
    }

    return {
      hasActiveBudget: true,
      hasVoteHead: true,
      budgetId: activeBudget.id,
      budgetNumber: activeBudget.budgetNumber,
      categoryName: budgetItem.name,
      allocatedBudget,
      currentSpent,
      voucherAmount,
      projectedSpent,
      remainingBudget,
      overBudgetAmount,
      isOverBudget,
      utilizationPercent,
    };
  }

  /**
   * Generates deterministic CSV export for budget vs actuals.
   */
  static async generateVarianceCsvExport(ctx: TenantContext, budgetId: string): Promise<string> {
    this.checkExportPermission(ctx);
    const variance = await this.getLiveBudgetVariance(ctx, budgetId);

    const headers = [
      'Vote Head Code',
      'Vote Head Name',
      'Allocated Budget (UGX)',
      'Actual Expenditure (UGX)',
      'Variance (UGX)',
      'Utilization (%)',
      'Status',
    ];

    const rows = variance.items.map((item) => [
      `"${item.code}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      item.allocatedAmount.toFixed(2),
      item.actualSpent.toFixed(2),
      item.variance.toFixed(2),
      `${item.utilizationPercent}%`,
      `"${item.status}"`,
    ]);

    // Summary row
    rows.push([
      '"TOTAL"',
      '"Total Expenditure"',
      variance.summary.totalAllocatedExpense.toFixed(2),
      variance.summary.totalActualExpenditure.toFixed(2),
      variance.summary.totalExpenditureVariance.toFixed(2),
      `${variance.summary.totalUtilizationPercent}%`,
      `"${variance.summary.isOverBudget ? 'OVER_BUDGET' : 'WITHIN_BUDGET'}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
