import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface CreateFeeTypeInput {
  name: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateFeeTypeInput {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

export class FeeTypeDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('fees:read') || perms.includes('fees:structure:write') || perms.includes('fees:write')) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('fees:structure:write') || perms.includes('fees:write')) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:structure:write");
  }

  static async list(ctx: TenantContext, options?: { activeOnly?: boolean }) {
    this.checkReadPermission(ctx);
    return db.feeType.findMany({
      where: {
        branchId: ctx.branchId,
        ...(options?.activeOnly ? { isActive: true } : {})
      },
      include: {
        _count: { select: { structureItems: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  static async getById(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);
    const feeType = await db.feeType.findUnique({
      where: { id },
      include: {
        _count: { select: { structureItems: true } }
      }
    });

    if (!feeType || feeType.branchId !== ctx.branchId) {
      return null;
    }

    return feeType;
  }

  static async create(ctx: TenantContext, data: CreateFeeTypeInput) {
    this.checkWritePermission(ctx);

    const name = data.name.trim();
    const rawCode = data.code?.trim() || name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const code = rawCode.toUpperCase();

    // Check uniqueness within branch
    const existingName = await db.feeType.findUnique({
      where: {
        branchId_name: {
          branchId: ctx.branchId,
          name
        }
      }
    });
    if (existingName) {
      throw new Error(`Fee type with name "${name}" already exists in this branch.`);
    }

    const existingCode = await db.feeType.findUnique({
      where: {
        branchId_code: {
          branchId: ctx.branchId,
          code
        }
      }
    });
    if (existingCode) {
      throw new Error(`Fee type with code "${code}" already exists in this branch.`);
    }

    const feeType = await db.feeType.create({
      data: {
        branchId: ctx.branchId,
        name,
        code,
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    await AuditService.log(
      ctx,
      'CREATE_FEE_TYPE',
      'FeeType',
      feeType.id,
      JSON.stringify({ name: feeType.name, code: feeType.code })
    );

    return feeType;
  }

  static async update(ctx: TenantContext, id: string, data: UpdateFeeTypeInput) {
    this.checkWritePermission(ctx);

    const existing = await this.getById(ctx, id);
    if (!existing) {
      throw new Error("Fee type not found");
    }

    const updateData: {
      name?: string;
      code?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (name !== existing.name) {
        const duplicateName = await db.feeType.findUnique({
          where: {
            branchId_name: {
              branchId: ctx.branchId,
              name
            }
          }
        });
        if (duplicateName) {
          throw new Error(`Fee type with name "${name}" already exists in this branch.`);
        }
        updateData.name = name;
      }
    }

    if (data.code !== undefined) {
      const code = data.code.trim().toUpperCase();
      if (code !== existing.code) {
        const duplicateCode = await db.feeType.findUnique({
          where: {
            branchId_code: {
              branchId: ctx.branchId,
              code
            }
          }
        });
        if (duplicateCode) {
          throw new Error(`Fee type with code "${code}" already exists in this branch.`);
        }
        updateData.code = code;
      }
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const feeType = await db.feeType.update({
      where: { id },
      data: updateData
    });

    await AuditService.log(
      ctx,
      'UPDATE_FEE_TYPE',
      'FeeType',
      feeType.id,
      JSON.stringify(data)
    );

    return feeType;
  }

  static async delete(ctx: TenantContext, id: string) {
    this.checkWritePermission(ctx);

    const existing = await this.getById(ctx, id);
    if (!existing) {
      throw new Error("Fee type not found");
    }

    const usageCount = await db.feeStructureItem.count({
      where: { feeTypeId: id }
    });

    if (usageCount > 0) {
      throw new Error("Cannot delete fee type because it is currently assigned to fee structures.");
    }

    await db.feeType.delete({
      where: { id }
    });

    await AuditService.log(
      ctx,
      'DELETE_FEE_TYPE',
      'FeeType',
      id,
      JSON.stringify({ name: existing.name, code: existing.code })
    );

    return { success: true };
  }
}
