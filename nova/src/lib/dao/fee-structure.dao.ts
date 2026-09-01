import { db } from "../db";
import { Prisma } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface FeeStructureItemInput {
  feeTypeId: string;
  amount: number | string | Prisma.Decimal;
  isOptional?: boolean;
  dueDate?: Date | string | null;
  description?: string | null;
}

export interface CreateFeeStructureInput {
  name: string;
  classId: string;
  academicYearId: string;
  termId?: string | null;
  description?: string | null;
  currency?: string;
  isActive?: boolean;
  items: FeeStructureItemInput[];
}

export interface UpdateFeeStructureInput {
  name?: string;
  description?: string | null;
  currency?: string;
  isActive?: boolean;
  items?: FeeStructureItemInput[];
}

export class FeeStructureDAO {
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

  static async list(ctx: TenantContext, options?: { classId?: string; academicYearId?: string; termId?: string }) {
    this.checkReadPermission(ctx);

    return db.feeStructure.findMany({
      where: {
        branchId: ctx.branchId,
        ...(options?.classId ? { classId: options.classId } : {}),
        ...(options?.academicYearId ? { academicYearId: options.academicYearId } : {}),
        ...(options?.termId !== undefined ? { termId: options.termId } : {})
      },
      include: {
        classRef: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        items: {
          include: {
            feeType: { select: { id: true, name: true, code: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getById(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const structure = await db.feeStructure.findUnique({
      where: { id },
      include: {
        classRef: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        items: {
          include: {
            feeType: { select: { id: true, name: true, code: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!structure || structure.branchId !== ctx.branchId) {
      return null;
    }

    return structure;
  }

  static async create(ctx: TenantContext, data: CreateFeeStructureInput) {
    this.checkWritePermission(ctx);

    const name = data.name.trim();
    if (!name) {
      throw new Error("Fee structure name is required.");
    }

    if (!data.items || data.items.length === 0) {
      throw new Error("At least one fee structure item is required.");
    }

    // 1. Validate Class belongs to branch
    const cls = await db.class.findUnique({
      where: { id: data.classId }
    });
    if (!cls || cls.branchId !== ctx.branchId) {
      throw new Error("Invalid class selected: Class does not belong to the active branch.");
    }

    // 2. Validate AcademicYear belongs to branch
    const ay = await db.academicYear.findUnique({
      where: { id: data.academicYearId }
    });
    if (!ay || ay.branchId !== ctx.branchId) {
      throw new Error("Invalid academic year selected: Academic year does not belong to the active branch.");
    }

    // 3. Validate Term belongs to AcademicYear and branch if provided
    if (data.termId) {
      const term = await db.term.findUnique({
        where: { id: data.termId }
      });
      if (!term || term.academicYearId !== data.academicYearId) {
        throw new Error("Invalid term selected: Term does not belong to the selected academic year.");
      }
    }

    // 4. Validate duplicate FeeStructure for same context
    const duplicate = await db.feeStructure.findFirst({
      where: {
        branchId: ctx.branchId,
        classId: data.classId,
        academicYearId: data.academicYearId,
        termId: data.termId || null,
        name
      }
    });
    if (duplicate) {
      throw new Error(`A fee structure named "${name}" already exists for this Class, Academic Year, and Term.`);
    }

    // 5. Validate FeeTypes in items
    const feeTypeIds = data.items.map(i => i.feeTypeId);
    const uniqueFeeTypeIds = new Set(feeTypeIds);
    if (uniqueFeeTypeIds.size !== feeTypeIds.length) {
      throw new Error("Duplicate fee types in structure items are not permitted.");
    }

    const feeTypes = await db.feeType.findMany({
      where: {
        id: { in: Array.from(uniqueFeeTypeIds) },
        branchId: ctx.branchId
      }
    });

    if (feeTypes.length !== uniqueFeeTypeIds.size) {
      throw new Error("One or more fee types are invalid or belong to a different branch.");
    }

    for (const item of data.items) {
      const decimalAmount = new Prisma.Decimal(item.amount);
      if (decimalAmount.isNegative() || decimalAmount.isNaN()) {
        throw new Error("Fee item amount must be a valid non-negative number.");
      }
    }

    // 6. Create FeeStructure and items atomically
    const feeStructure = await db.feeStructure.create({
      data: {
        branchId: ctx.branchId,
        name,
        classId: data.classId,
        academicYearId: data.academicYearId,
        termId: data.termId || null,
        description: data.description?.trim() || null,
        currency: data.currency || "UGX",
        isActive: data.isActive !== undefined ? data.isActive : true,
        items: {
          create: data.items.map(item => ({
            feeTypeId: item.feeTypeId,
            amount: new Prisma.Decimal(item.amount),
            isOptional: !!item.isOptional,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            description: item.description?.trim() || null
          }))
        }
      },
      include: {
        classRef: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        items: {
          include: {
            feeType: { select: { id: true, name: true, code: true } }
          }
        }
      }
    });

    await AuditService.log(
      ctx,
      'CREATE_FEE_STRUCTURE',
      'FeeStructure',
      feeStructure.id,
      JSON.stringify({
        name: feeStructure.name,
        classId: feeStructure.classId,
        academicYearId: feeStructure.academicYearId,
        termId: feeStructure.termId,
        itemCount: feeStructure.items.length
      })
    );

    return feeStructure;
  }

  static async update(ctx: TenantContext, id: string, data: UpdateFeeStructureInput) {
    this.checkWritePermission(ctx);

    const existing = await this.getById(ctx, id);
    if (!existing) {
      throw new Error("Fee structure not found");
    }

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    if (!name) {
      throw new Error("Fee structure name cannot be empty.");
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await db.feeStructure.findFirst({
        where: {
          branchId: ctx.branchId,
          classId: existing.classId,
          academicYearId: existing.academicYearId,
          termId: existing.termId,
          name,
          id: { not: id }
        }
      });
      if (duplicate) {
        throw new Error(`A fee structure named "${name}" already exists for this Class, Academic Year, and Term.`);
      }
    }

    // If items are being replaced
    if (data.items !== undefined) {
      if (data.items.length === 0) {
        throw new Error("Fee structure must contain at least one item.");
      }

      const feeTypeIds = data.items.map(i => i.feeTypeId);
      const uniqueFeeTypeIds = new Set(feeTypeIds);
      if (uniqueFeeTypeIds.size !== feeTypeIds.length) {
        throw new Error("Duplicate fee types in structure items are not permitted.");
      }

      const feeTypes = await db.feeType.findMany({
        where: {
          id: { in: Array.from(uniqueFeeTypeIds) },
          branchId: ctx.branchId
        }
      });

      if (feeTypes.length !== uniqueFeeTypeIds.size) {
        throw new Error("One or more fee types are invalid or belong to a different branch.");
      }

      for (const item of data.items) {
        const decimalAmount = new Prisma.Decimal(item.amount);
        if (decimalAmount.isNegative() || decimalAmount.isNaN()) {
          throw new Error("Fee item amount must be a valid non-negative number.");
        }
      }
    }

    // Execute atomic update
    const updated = await db.$transaction(async (tx) => {
      if (data.items !== undefined) {
        // Delete existing items
        await tx.feeStructureItem.deleteMany({
          where: { feeStructureId: id }
        });

        // Insert new items
        await tx.feeStructureItem.createMany({
          data: data.items.map(item => ({
            feeStructureId: id,
            feeTypeId: item.feeTypeId,
            amount: new Prisma.Decimal(item.amount),
            isOptional: !!item.isOptional,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            description: item.description?.trim() || null
          }))
        });
      }

      return tx.feeStructure.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name } : {}),
          ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
        },
        include: {
          classRef: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          term: { select: { id: true, name: true } },
          items: {
            include: {
              feeType: { select: { id: true, name: true, code: true } }
            }
          }
        }
      });
    });

    await AuditService.log(
      ctx,
      'UPDATE_FEE_STRUCTURE',
      'FeeStructure',
      id,
      JSON.stringify(data)
    );

    return updated;
  }

  static async delete(ctx: TenantContext, id: string) {
    this.checkWritePermission(ctx);

    const existing = await this.getById(ctx, id);
    if (!existing) {
      throw new Error("Fee structure not found");
    }

    await db.feeStructure.delete({
      where: { id }
    });

    await AuditService.log(
      ctx,
      'DELETE_FEE_STRUCTURE',
      'FeeStructure',
      id,
      JSON.stringify({ name: existing.name, classId: existing.classId })
    );

    return { success: true };
  }
}
