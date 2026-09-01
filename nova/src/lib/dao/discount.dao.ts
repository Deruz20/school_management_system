import { db } from "../db";
import { Prisma, DiscountType } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface CreateDiscountInput {
  studentId: string;
  feeTypeId?: string | null;
  academicYearId?: string | null;
  termId?: string | null;
  discountType: DiscountType;
  value: number | string | Prisma.Decimal;
  reason: string;
  isActive?: boolean;
}

export interface UpdateDiscountInput {
  feeTypeId?: string | null;
  academicYearId?: string | null;
  termId?: string | null;
  discountType?: DiscountType;
  value?: number | string | Prisma.Decimal;
  reason?: string;
  isActive?: boolean;
}

export class DiscountDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:read') ||
      perms.includes('fees:discount:write') ||
      perms.includes('fees:invoices:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:discount:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:discount:write");
  }

  static async list(
    ctx: TenantContext,
    filters?: {
      studentId?: string;
      feeTypeId?: string;
      academicYearId?: string;
      termId?: string;
      isActive?: boolean;
    }
  ) {
    this.checkReadPermission(ctx);

    return db.studentFeeDiscount.findMany({
      where: {
        branchId: ctx.branchId,
        ...(filters?.studentId ? { studentId: filters.studentId } : {}),
        ...(filters?.feeTypeId !== undefined ? { feeTypeId: filters.feeTypeId } : {}),
        ...(filters?.academicYearId !== undefined ? { academicYearId: filters.academicYearId } : {}),
        ...(filters?.termId !== undefined ? { termId: filters.termId } : {}),
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {})
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        feeType: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getById(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const discount = await db.studentFeeDiscount.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        feeType: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } }
      }
    });

    if (!discount) {
      throw new Error("Student fee discount not found or access denied.");
    }

    return discount;
  }

  static async create(ctx: TenantContext, data: CreateDiscountInput) {
    this.checkWritePermission(ctx);

    // 1. Validate student belongs to current branch
    const student = await db.student.findFirst({
      where: { id: data.studentId, branchId: ctx.branchId }
    });
    if (!student) {
      throw new Error("Invalid student: Student does not exist in this branch.");
    }

    // 2. Validate optional FeeType belongs to branch
    if (data.feeTypeId) {
      const feeType = await db.feeType.findFirst({
        where: { id: data.feeTypeId, branchId: ctx.branchId }
      });
      if (!feeType) {
        throw new Error("Invalid fee type: Fee type does not exist in this branch.");
      }
    }

    // 3. Validate optional AcademicYear belongs to branch
    if (data.academicYearId) {
      const academicYear = await db.academicYear.findFirst({
        where: { id: data.academicYearId, branchId: ctx.branchId }
      });
      if (!academicYear) {
        throw new Error("Invalid academic year: Academic year does not exist in this branch.");
      }
    }

    // 4. Validate optional Term belongs to AcademicYear
    if (data.termId) {
      const term = await db.term.findUnique({
        where: { id: data.termId }
      });
      if (!term || (data.academicYearId && term.academicYearId !== data.academicYearId)) {
        throw new Error("Invalid term: Term does not belong to the selected academic year.");
      }
    }

    // 5. Validate discount value
    const decimalValue = new Prisma.Decimal(data.value);
    if (decimalValue.isNaN() || decimalValue.isNegative() || decimalValue.isZero()) {
      throw new Error("Discount value must be a positive number.");
    }

    if (data.discountType === DiscountType.PERCENTAGE) {
      if (decimalValue.greaterThan(100)) {
        throw new Error("Percentage discount cannot exceed 100%.");
      }
    }

    const reason = data.reason?.trim();
    if (!reason) {
      throw new Error("Discount reason is mandatory.");
    }

    // 6. Check single active discount rule per target
    const existing = await db.studentFeeDiscount.findFirst({
      where: {
        branchId: ctx.branchId,
        studentId: data.studentId,
        feeTypeId: data.feeTypeId || null,
        academicYearId: data.academicYearId || null,
        termId: data.termId || null,
        isActive: true
      }
    });
    if (existing) {
      throw new Error("An active discount rule already exists for this student and target period.");
    }

    const discount = await db.studentFeeDiscount.create({
      data: {
        branchId: ctx.branchId,
        studentId: data.studentId,
        feeTypeId: data.feeTypeId || null,
        academicYearId: data.academicYearId || null,
        termId: data.termId || null,
        discountType: data.discountType,
        value: decimalValue,
        reason,
        isActive: data.isActive !== undefined ? data.isActive : true
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        feeType: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } }
      }
    });

    await AuditService.log(
      ctx,
      'ASSIGN_BURSARY',
      'StudentFeeDiscount',
      discount.id,
      JSON.stringify({
        studentId: discount.studentId,
        discountType: discount.discountType,
        value: discount.value.toString(),
        reason: discount.reason,
        feeTypeId: discount.feeTypeId,
        termId: discount.termId
      })
    );

    return discount;
  }

  static async update(ctx: TenantContext, id: string, data: UpdateDiscountInput) {
    this.checkWritePermission(ctx);

    const existing = await db.studentFeeDiscount.findFirst({
      where: { id, branchId: ctx.branchId }
    });
    if (!existing) {
      throw new Error("Student fee discount not found or access denied.");
    }

    if (data.feeTypeId !== undefined && data.feeTypeId !== null) {
      const feeType = await db.feeType.findFirst({
        where: { id: data.feeTypeId, branchId: ctx.branchId }
      });
      if (!feeType) {
        throw new Error("Invalid fee type: Fee type does not exist in this branch.");
      }
    }

    let decimalValue = existing.value;
    if (data.value !== undefined) {
      decimalValue = new Prisma.Decimal(data.value);
      if (decimalValue.isNaN() || decimalValue.isNegative() || decimalValue.isZero()) {
        throw new Error("Discount value must be a positive number.");
      }
    }

    const discountType = data.discountType || existing.discountType;
    if (discountType === DiscountType.PERCENTAGE && decimalValue.greaterThan(100)) {
      throw new Error("Percentage discount cannot exceed 100%.");
    }

    const updated = await db.studentFeeDiscount.update({
      where: { id },
      data: {
        ...(data.feeTypeId !== undefined ? { feeTypeId: data.feeTypeId } : {}),
        ...(data.academicYearId !== undefined ? { academicYearId: data.academicYearId } : {}),
        ...(data.termId !== undefined ? { termId: data.termId } : {}),
        ...(data.discountType !== undefined ? { discountType: data.discountType } : {}),
        ...(data.value !== undefined ? { value: decimalValue } : {}),
        ...(data.reason !== undefined ? { reason: data.reason.trim() } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        feeType: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } }
      }
    });

    await AuditService.log(
      ctx,
      'UPDATE_BURSARY',
      'StudentFeeDiscount',
      id,
      JSON.stringify({
        modifiedFields: Object.keys(data),
        newValue: updated.value.toString()
      })
    );

    return updated;
  }

  static async delete(ctx: TenantContext, id: string) {
    this.checkWritePermission(ctx);

    const existing = await db.studentFeeDiscount.findFirst({
      where: { id, branchId: ctx.branchId }
    });
    if (!existing) {
      throw new Error("Student fee discount not found or access denied.");
    }

    await db.studentFeeDiscount.delete({ where: { id } });

    await AuditService.log(
      ctx,
      'DELETE_BURSARY',
      'StudentFeeDiscount',
      id,
      JSON.stringify({
        studentId: existing.studentId,
        reason: existing.reason
      })
    );

    return { success: true };
  }
}
