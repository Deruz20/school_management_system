import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface CreateExpenseCategoryInput {
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateExpenseCategoryInput {
  name?: string;
  code?: string;
  description?: string | null;
  isActive?: boolean;
}

export class ExpenseCategoryDAO {
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

  static async list(ctx: TenantContext, includeInactive = false) {
    this.checkReadPermission(ctx);

    return db.expenseCategory.findMany({
      where: {
        branchId: ctx.branchId,
        ...(includeInactive ? {} : { isActive: true })
      },
      include: {
        _count: {
          select: { expenses: true }
        }
      },
      orderBy: [{ name: 'asc' }]
    });
  }

  static async getById(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const category = await db.expenseCategory.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        _count: {
          select: { expenses: true }
        }
      }
    });

    if (!category) {
      throw new Error("Expense category not found or access denied.");
    }

    return category;
  }

  static async create(ctx: TenantContext, input: CreateExpenseCategoryInput) {
    this.checkWritePermission(ctx);

    const name = input.name?.trim();
    if (!name) throw new Error("Category name is required.");

    const code = (input.code || name.replace(/[^a-zA-Z0-9]/g, '_')).toUpperCase().trim();
    if (!code) throw new Error("Category code is required.");

    // Check duplicate name in branch
    const dupName = await db.expenseCategory.findUnique({
      where: { branchId_name: { branchId: ctx.branchId, name } }
    });
    if (dupName) {
      throw new Error(`Expense category with name "${name}" already exists in this branch.`);
    }

    // Check duplicate code in branch
    const dupCode = await db.expenseCategory.findUnique({
      where: { branchId_code: { branchId: ctx.branchId, code } }
    });
    if (dupCode) {
      throw new Error(`Expense category with code "${code}" already exists in this branch.`);
    }

    const category = await db.expenseCategory.create({
      data: {
        branchId: ctx.branchId,
        name,
        code,
        description: input.description?.trim() || null,
        isActive: input.isActive !== undefined ? input.isActive : true
      }
    });

    await AuditService.log(
      ctx,
      'CREATE_EXPENSE_CATEGORY',
      'ExpenseCategory',
      category.id,
      JSON.stringify({
        categoryId: category.id,
        name: category.name,
        code: category.code,
        isActive: category.isActive
      })
    );

    return category;
  }

  static async update(ctx: TenantContext, id: string, input: UpdateExpenseCategoryInput) {
    this.checkWritePermission(ctx);

    const existing = await db.expenseCategory.findFirst({
      where: { id, branchId: ctx.branchId }
    });
    if (!existing) {
      throw new Error("Expense category not found or access denied.");
    }

    const data: {
      name?: string;
      code?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error("Category name cannot be empty.");
      if (name !== existing.name) {
        const dup = await db.expenseCategory.findUnique({
          where: { branchId_name: { branchId: ctx.branchId, name } }
        });
        if (dup) throw new Error(`Category name "${name}" already in use.`);
        data.name = name;
      }
    }

    if (input.code !== undefined) {
      const code = input.code.toUpperCase().trim();
      if (!code) throw new Error("Category code cannot be empty.");
      if (code !== existing.code) {
        const dup = await db.expenseCategory.findUnique({
          where: { branchId_code: { branchId: ctx.branchId, code } }
        });
        if (dup) throw new Error(`Category code "${code}" already in use.`);
        data.code = code;
      }
    }

    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    const updated = await db.expenseCategory.update({
      where: { id },
      data
    });

    await AuditService.log(
      ctx,
      'UPDATE_EXPENSE_CATEGORY',
      'ExpenseCategory',
      updated.id,
      JSON.stringify({
        categoryId: updated.id,
        changes: data
      })
    );

    return updated;
  }
}
