import { db } from "../db";
import {
  Prisma,
  RequirementCatalog,
  ClassRequirement,
  ClassRequirementItem,
  StudentRequirementRecord,
  StudentRequirementItem,
  InKindHandoverLog,
  RequirementCategory,
  RequirementUnit,
  RequirementItemStatus,
  PaymentMethod
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { PaymentDAO } from "./payment.dao";
import crypto from "crypto";

export interface CreateCatalogItemInput {
  code: string;
  name: string;
  category?: RequirementCategory;
  unit?: RequirementUnit;
  defaultCashInLieu?: number | string | Prisma.Decimal | null;
  description?: string | null;
}

export interface UpdateCatalogItemInput {
  name?: string;
  category?: RequirementCategory;
  unit?: RequirementUnit;
  defaultCashInLieu?: number | string | Prisma.Decimal | null;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateBlueprintItemInput {
  id?: string;
  catalogItemId?: string | null;
  feeTypeId?: string | null;
  name: string;
  category?: RequirementCategory;
  unit?: RequirementUnit;
  quantity: number | string | Prisma.Decimal;
  cashInLieuAmount?: number | string | Prisma.Decimal | null;
  isMandatory?: boolean;
  notes?: string | null;
}

export interface CreateClassRequirementInput {
  classId: string;
  academicYearId: string;
  termId?: string | null;
  title: string;
  description?: string | null;
  items: CreateBlueprintItemInput[];
}

export interface UpdateClassRequirementInput {
  title?: string;
  description?: string | null;
  isActive?: boolean;
  items?: CreateBlueprintItemInput[];
}

export interface BulkAssignRequirementsInput {
  classRequirementId: string;
  academicYearId: string;
  termId?: string | null;
  studentIds?: string[];
}

export interface ReceiveInKindHandoverInput {
  studentRequirementItemId: string;
  deltaDelivered: number | string | Prisma.Decimal;
  notes?: string | null;
  allowOverDelivery?: boolean;
}

export interface ReverseInKindHandoverInput {
  studentRequirementItemId: string;
  deltaReduction: number | string | Prisma.Decimal;
  reason: string;
  notes?: string | null;
}

export interface MonetizeRequirementInput {
  studentRequirementItemId: string;
  monetizedQuantity: number | string | Prisma.Decimal;
  paymentMethod: PaymentMethod;
  payerName?: string | null;
  payerPhone?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
}

export interface ExemptRequirementInput {
  studentRequirementItemId: string;
  reason: string;
  notes?: string | null;
}

export class RequirementsDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("requirements:read") ||
      perms.includes("requirements:catalog:manage") ||
      perms.includes("requirements:blueprint:manage") ||
      perms.includes("requirements:receive") ||
      perms.includes("requirements:monetize") ||
      perms.includes("requirements:reports") ||
      perms.includes("fees:read") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: requirements:read");
  }

  private static checkCatalogPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("requirements:catalog:manage") ||
      perms.includes("requirements:write") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: requirements:catalog:manage");
  }

  private static checkBlueprintPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("requirements:blueprint:manage") ||
      perms.includes("requirements:write") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: requirements:blueprint:manage");
  }

  private static checkAssignPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("requirements:assign") ||
      perms.includes("requirements:write") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: requirements:assign");
  }

  private static checkReceivePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("requirements:receive") ||
      perms.includes("requirements:write") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: requirements:receive");
  }

  private static checkMonetizePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("requirements:monetize") ||
      perms.includes("fees:payments:write") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: requirements:monetize");
  }

  private static checkReportsPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("requirements:reports") ||
      perms.includes("fees:reports:read") ||
      perms.includes("fees:read") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: requirements:reports");
  }

  /**
   * Concurrency-safe atomic sequence generator for In-Kind Handover Receipts (e.g. INK-2026-00001).
   */
  static async generateNextInKindReceiptNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
    date: Date = new Date()
  ): Promise<string> {
    const year = date.getFullYear();
    const fallbackId = crypto.randomUUID();

    const result = await tx.$queryRaw<{ nextValue: number }[]>`
      INSERT INTO "InKindReceiptSequence" ("id", "branchId", "year", "nextValue", "updatedAt")
      VALUES (${fallbackId}, ${branchId}, ${year}, 2, NOW())
      ON CONFLICT ("branchId", "year")
      DO UPDATE SET "nextValue" = "InKindReceiptSequence"."nextValue" + 1, "updatedAt" = NOW()
      RETURNING "nextValue" - 1 AS "nextValue"
    `;

    const seqNumber = result[0]?.nextValue ?? 1;
    return `INK-${year}-${String(seqNumber).padStart(5, "0")}`;
  }

  // ==========================================
  // 1. REQUIREMENTS CATALOG
  // ==========================================

  static async createCatalogItem(
    ctx: TenantContext,
    input: CreateCatalogItemInput
  ): Promise<RequirementCatalog> {
    this.checkCatalogPermission(ctx);

    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !name) {
      throw new Error("Item code and name are required.");
    }

    const defaultCashInLieu = input.defaultCashInLieu != null
      ? new Prisma.Decimal(input.defaultCashInLieu.toString())
      : null;

    if (defaultCashInLieu && defaultCashInLieu.isNegative()) {
      throw new Error("Default cash-in-lieu amount cannot be negative.");
    }

    const item = await db.requirementCatalog.create({
      data: {
        branchId: ctx.branchId,
        code,
        name,
        category: input.category || RequirementCategory.GENERAL,
        unit: input.unit || RequirementUnit.PIECE,
        defaultCashInLieu,
        description: input.description?.trim() || null
      }
    });

    await AuditService.log(
      ctx,
      "REQUIREMENT_CATALOG_CREATED",
      "RequirementCatalog",
      item.id,
      `Created requirement catalog item ${item.name} (${item.code})`
    );

    return item;
  }

  static async updateCatalogItem(
    ctx: TenantContext,
    id: string,
    input: UpdateCatalogItemInput
  ): Promise<RequirementCatalog> {
    this.checkCatalogPermission(ctx);

    const existing = await db.requirementCatalog.findFirst({
      where: { id, branchId: ctx.branchId }
    });
    if (!existing) {
      throw new Error("Requirement catalog item not found in current branch.");
    }

    const defaultCashInLieu = input.defaultCashInLieu !== undefined
      ? input.defaultCashInLieu != null
        ? new Prisma.Decimal(input.defaultCashInLieu.toString())
        : null
      : existing.defaultCashInLieu;

    if (defaultCashInLieu && defaultCashInLieu.isNegative()) {
      throw new Error("Default cash-in-lieu amount cannot be negative.");
    }

    const updated = await db.requirementCatalog.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : existing.name,
        category: input.category || existing.category,
        unit: input.unit || existing.unit,
        defaultCashInLieu,
        description: input.description !== undefined ? input.description?.trim() || null : existing.description,
        isActive: input.isActive !== undefined ? input.isActive : existing.isActive
      }
    });

    await AuditService.log(
      ctx,
      "REQUIREMENT_CATALOG_UPDATED",
      "RequirementCatalog",
      updated.id,
      `Updated requirement catalog item ${updated.name}`
    );

    return updated;
  }

  static async getCatalogItem(ctx: TenantContext, id: string): Promise<RequirementCatalog | null> {
    this.checkReadPermission(ctx);
    return db.requirementCatalog.findFirst({
      where: { id, branchId: ctx.branchId }
    });
  }

  static async listCatalogItems(
    ctx: TenantContext,
    filters?: { category?: RequirementCategory; isActive?: boolean; search?: string }
  ): Promise<RequirementCatalog[]> {
    this.checkReadPermission(ctx);

    return db.requirementCatalog.findMany({
      where: {
        branchId: ctx.branchId,
        category: filters?.category,
        isActive: filters?.isActive,
        ...(filters?.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { code: { contains: filters.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });
  }

  // ==========================================
  // 2. CLASS REQUIREMENT BLUEPRINTS
  // ==========================================

  static async createClassRequirement(
    ctx: TenantContext,
    input: CreateClassRequirementInput
  ): Promise<ClassRequirement & { items: ClassRequirementItem[] }> {
    this.checkBlueprintPermission(ctx);

    if (!input.title?.trim()) {
      throw new Error("Blueprint title is required.");
    }
    if (!input.items || input.items.length === 0) {
      throw new Error("At least one requirement item must be defined in the blueprint.");
    }

    const cls = await db.class.findFirst({
      where: { id: input.classId, branchId: ctx.branchId }
    });
    if (!cls) throw new Error("Class not found in current branch.");

    const year = await db.academicYear.findFirst({
      where: { id: input.academicYearId, branchId: ctx.branchId }
    });
    if (!year) throw new Error("Academic Year not found in current branch.");

    if (input.termId) {
      const term = await db.term.findFirst({
        where: { id: input.termId, academicYearId: input.academicYearId }
      });
      if (!term) throw new Error("Term does not belong to specified Academic Year.");
    }

    const existing = await db.classRequirement.findFirst({
      where: {
        branchId: ctx.branchId,
        classId: input.classId,
        academicYearId: input.academicYearId,
        termId: input.termId || null
      }
    });
    if (existing) {
      throw new Error("A requirement blueprint already exists for this class, academic year, and term.");
    }

    return db.$transaction(async (tx) => {
      const blueprint = await tx.classRequirement.create({
        data: {
          branchId: ctx.branchId,
          classId: input.classId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          createdById: ctx.userId,
          items: {
            create: input.items.map((item) => {
              const qty = new Prisma.Decimal(item.quantity.toString());
              if (qty.isNegative() || qty.isZero()) {
                throw new Error(`Quantity for item '${item.name}' must be greater than 0.`);
              }
              const cashInLieu = item.cashInLieuAmount != null
                ? new Prisma.Decimal(item.cashInLieuAmount.toString())
                : null;
              if (cashInLieu && cashInLieu.isNegative()) {
                throw new Error(`Cash-in-lieu amount for '${item.name}' cannot be negative.`);
              }

              return {
                catalogItemId: item.catalogItemId || null,
                feeTypeId: item.feeTypeId || null,
                name: item.name.trim(),
                category: item.category || RequirementCategory.GENERAL,
                unit: item.unit || RequirementUnit.PIECE,
                quantity: qty,
                cashInLieuAmount: cashInLieu,
                isMandatory: item.isMandatory !== undefined ? item.isMandatory : true,
                notes: item.notes?.trim() || null
              };
            })
          }
        },
        include: { items: true }
      });

      await AuditService.log(
        ctx,
        "CLASS_REQUIREMENT_CREATED",
        "ClassRequirement",
        blueprint.id,
        `Created Class Requirement Blueprint '${blueprint.title}' with ${blueprint.items.length} items.`
      );

      return blueprint;
    });
  }

  static async updateClassRequirement(
    ctx: TenantContext,
    id: string,
    input: UpdateClassRequirementInput
  ): Promise<ClassRequirement & { items: ClassRequirementItem[] }> {
    this.checkBlueprintPermission(ctx);

    const existing = await db.classRequirement.findFirst({
      where: { id, branchId: ctx.branchId },
      include: { items: true }
    });
    if (!existing) {
      throw new Error("Class Requirement Blueprint not found in current branch.");
    }

    return db.$transaction(async (tx) => {
      if (input.items) {
        if (input.items.length === 0) {
          throw new Error("A blueprint must contain at least one item.");
        }

        // Check if any existing items are referenced by student checklists
        const referencedCount = await tx.studentRequirementItem.count({
          where: { blueprintItem: { classRequirementId: id } }
        });

        if (referencedCount === 0) {
          await tx.classRequirementItem.deleteMany({
            where: { classRequirementId: id }
          });
          await tx.classRequirementItem.createMany({
            data: input.items.map((item) => {
              const qty = new Prisma.Decimal(item.quantity.toString());
              if (qty.isNegative() || qty.isZero()) {
                throw new Error(`Quantity for item '${item.name}' must be greater than 0.`);
              }
              const cashInLieu = item.cashInLieuAmount != null
                ? new Prisma.Decimal(item.cashInLieuAmount.toString())
                : null;
              if (cashInLieu && cashInLieu.isNegative()) {
                throw new Error(`Cash-in-lieu amount for '${item.name}' cannot be negative.`);
              }

              return {
                classRequirementId: id,
                catalogItemId: item.catalogItemId || null,
                feeTypeId: item.feeTypeId || null,
                name: item.name.trim(),
                category: item.category || RequirementCategory.GENERAL,
                unit: item.unit || RequirementUnit.PIECE,
                quantity: qty,
                cashInLieuAmount: cashInLieu,
                isMandatory: item.isMandatory !== undefined ? item.isMandatory : true,
                notes: item.notes?.trim() || null
              };
            })
          });
        } else {
          // Update existing items in-place where possible, create new ones otherwise
          for (let i = 0; i < input.items.length; i++) {
            const newItem = input.items[i];
            const existingItem = existing.items[i];
            const qty = new Prisma.Decimal(newItem.quantity.toString());
            const cashInLieu = newItem.cashInLieuAmount != null
              ? new Prisma.Decimal(newItem.cashInLieuAmount.toString())
              : null;

            if (existingItem) {
              await tx.classRequirementItem.update({
                where: { id: existingItem.id },
                data: {
                  catalogItemId: newItem.catalogItemId || null,
                  feeTypeId: newItem.feeTypeId || null,
                  name: newItem.name.trim(),
                  category: newItem.category || RequirementCategory.GENERAL,
                  unit: newItem.unit || RequirementUnit.PIECE,
                  quantity: qty,
                  cashInLieuAmount: cashInLieu,
                  isMandatory: newItem.isMandatory !== undefined ? newItem.isMandatory : true,
                  notes: newItem.notes?.trim() || null
                }
              });
            } else {
              await tx.classRequirementItem.create({
                data: {
                  classRequirementId: id,
                  catalogItemId: newItem.catalogItemId || null,
                  feeTypeId: newItem.feeTypeId || null,
                  name: newItem.name.trim(),
                  category: newItem.category || RequirementCategory.GENERAL,
                  unit: newItem.unit || RequirementUnit.PIECE,
                  quantity: qty,
                  cashInLieuAmount: cashInLieu,
                  isMandatory: newItem.isMandatory !== undefined ? newItem.isMandatory : true,
                  notes: newItem.notes?.trim() || null
                }
              });
            }
          }
        }
      }

      const updated = await tx.classRequirement.update({
        where: { id },
        data: {
          title: input.title !== undefined ? input.title.trim() : existing.title,
          description: input.description !== undefined ? input.description?.trim() || null : existing.description,
          isActive: input.isActive !== undefined ? input.isActive : existing.isActive
        },
        include: { items: true }
      });

      await AuditService.log(
        ctx,
        "CLASS_REQUIREMENT_UPDATED",
        "ClassRequirement",
        updated.id,
        `Updated Class Requirement Blueprint '${updated.title}'.`
      );

      return updated;
    });
  }

  static async getClassRequirement(
    ctx: TenantContext,
    id: string
  ): Promise<(ClassRequirement & { items: (ClassRequirementItem & { catalogItem: RequirementCatalog | null })[]; class: { id: string; name: string } }) | null> {
    this.checkReadPermission(ctx);
    return db.classRequirement.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        class: true,
        academicYear: true,
        term: true,
        items: {
          include: { catalogItem: true, feeType: true }
        }
      }
    });
  }

  static async listClassRequirements(
    ctx: TenantContext,
    filters?: { classId?: string; academicYearId?: string; termId?: string | null; isActive?: boolean }
  ): Promise<(ClassRequirement & { items: ClassRequirementItem[]; class: { id: string; name: string } })[]> {
    this.checkReadPermission(ctx);

    return db.classRequirement.findMany({
      where: {
        branchId: ctx.branchId,
        classId: filters?.classId,
        academicYearId: filters?.academicYearId,
        ...(filters?.termId !== undefined ? { termId: filters.termId } : {}),
        isActive: filters?.isActive
      },
      include: {
        class: true,
        academicYear: true,
        term: true,
        items: true
      },
      orderBy: [{ academicYear: { startDate: "desc" } }, { class: { name: "asc" } }]
    });
  }

  // ==========================================
  // 3. BULK STUDENT ASSIGNMENT & SNAPSHOTTING
  // ==========================================

  static async bulkAssignRequirements(
    ctx: TenantContext,
    input: BulkAssignRequirementsInput
  ): Promise<{ assignedCount: number; skippedCount: number }> {
    this.checkAssignPermission(ctx);

    const blueprint = await db.classRequirement.findFirst({
      where: { id: input.classRequirementId, branchId: ctx.branchId },
      include: { items: true }
    });
    if (!blueprint) {
      throw new Error("Class Requirement Blueprint not found in current branch.");
    }
    if (blueprint.items.length === 0) {
      throw new Error("Blueprint has no requirement items to assign.");
    }

    let targetStudents: { id: string; enrollmentId: string | null }[] = [];

    if (input.studentIds && input.studentIds.length > 0) {
      const students = await db.student.findMany({
        where: {
          id: { in: input.studentIds },
          branchId: ctx.branchId,
          status: "ACTIVE"
        },
        include: {
          enrollments: {
            where: {
              academicYearId: input.academicYearId,
              status: "ACTIVE"
            },
            take: 1
          }
        }
      });
      targetStudents = students.map((s) => ({
        id: s.id,
        enrollmentId: s.enrollments[0]?.id || null
      }));
    } else {
      const enrollments = await db.enrollment.findMany({
        where: {
          academicYearId: input.academicYearId,
          classId: blueprint.classId,
          status: "ACTIVE",
          student: { branchId: ctx.branchId, status: "ACTIVE" }
        },
        select: { id: true, studentId: true }
      });
      targetStudents = enrollments.map((e) => ({
        id: e.studentId,
        enrollmentId: e.id
      }));
    }

    if (targetStudents.length === 0) {
      return { assignedCount: 0, skippedCount: 0 };
    }

    let assignedCount = 0;
    let skippedCount = 0;

    await db.$transaction(async (tx) => {
      for (const target of targetStudents) {
        const existingRecord = await tx.studentRequirementRecord.findFirst({
          where: {
            branchId: ctx.branchId,
            studentId: target.id,
            academicYearId: input.academicYearId,
            termId: input.termId || null
          }
        });

        if (existingRecord) {
          skippedCount++;
          continue;
        }

        const totalItemsCount = blueprint.items.length;
        const pendingCount = blueprint.items.length;

        await tx.studentRequirementRecord.create({
          data: {
            branchId: ctx.branchId,
            studentId: target.id,
            enrollmentId: target.enrollmentId,
            classRequirementId: blueprint.id,
            academicYearId: input.academicYearId,
            termId: input.termId || null,
            totalItemsCount,
            fulfilledCount: 0,
            pendingCount,
            isFullyCompliant: false,
            items: {
              create: blueprint.items.map((bItem) => ({
                blueprintItemId: bItem.id,
                name: bItem.name,
                category: bItem.category,
                unit: bItem.unit,
                quantityRequired: bItem.quantity,
                quantityDelivered: new Prisma.Decimal(0),
                quantityMonetized: new Prisma.Decimal(0),
                cashInLieuAmount: bItem.cashInLieuAmount,
                status: RequirementItemStatus.PENDING,
                isMandatory: bItem.isMandatory
              }))
            }
          }
        });

        assignedCount++;
      }
    });

    await AuditService.log(
      ctx,
      "REQUIREMENTS_BULK_ASSIGNED",
      "ClassRequirement",
      blueprint.id,
      `Bulk assigned requirements to ${assignedCount} students (${skippedCount} already had records).`
    );

    return { assignedCount, skippedCount };
  }

  // ==========================================
  // 4. PHYSICAL HANDOVER RECEIVING & REVERSALS
  // ==========================================

  static async receiveInKindHandover(
    ctx: TenantContext,
    input: ReceiveInKindHandoverInput
  ): Promise<{ item: StudentRequirementItem; log: InKindHandoverLog }> {
    this.checkReceivePermission(ctx);

    const delta = new Prisma.Decimal(input.deltaDelivered.toString());
    if (delta.isNegative() || delta.isZero()) {
      throw new Error("Delivered quantity must be greater than zero.");
    }

    return db.$transaction(async (tx) => {
      // Row-level lock on student requirement item
      await tx.$queryRaw`SELECT id FROM "StudentRequirementItem" WHERE id = ${input.studentRequirementItemId} FOR UPDATE`;

      const item = await tx.studentRequirementItem.findFirst({
        where: { id: input.studentRequirementItemId },
        include: { record: true }
      });

      if (!item || item.record.branchId !== ctx.branchId) {
        throw new Error("Student requirement item not found in current branch.");
      }

      if (item.status === RequirementItemStatus.EXEMPTED) {
        throw new Error("Cannot record physical delivery for an exempted requirement.");
      }

      const prevDelivered = item.quantityDelivered;
      const newDelivered = prevDelivered.add(delta);
      const effectiveDelivered = newDelivered.add(item.quantityMonetized);

      if (!input.allowOverDelivery && effectiveDelivered.greaterThan(item.quantityRequired)) {
        throw new Error(
          `Delivered quantity (${effectiveDelivered}) exceeds required quantity (${item.quantityRequired}). Set allowOverDelivery: true to proceed.`
        );
      }

      let newStatus: RequirementItemStatus = item.status;
      if (effectiveDelivered.greaterThanOrEqualTo(item.quantityRequired)) {
        newStatus = RequirementItemStatus.FULFILLED;
      } else if (effectiveDelivered.greaterThan(0)) {
        newStatus = RequirementItemStatus.PARTIAL;
      } else {
        newStatus = RequirementItemStatus.PENDING;
      }

      const receiptNumber = await this.generateNextInKindReceiptNumber(tx, ctx.branchId);

      const log = await tx.inKindHandoverLog.create({
        data: {
          branchId: ctx.branchId,
          studentRequirementItemId: item.id,
          receiptNumber,
          deltaDelivered: delta,
          previousQuantity: prevDelivered,
          newQuantity: newDelivered,
          receivedById: ctx.userId,
          isCorrection: false,
          notes: input.notes?.trim() || null
        }
      });

      const updatedItem = await tx.studentRequirementItem.update({
        where: { id: item.id },
        data: {
          quantityDelivered: newDelivered,
          status: newStatus,
          lastReceivedById: ctx.userId,
          lastReceivedAt: new Date(),
          notes: input.notes ? (item.notes ? `${item.notes} | ${input.notes}` : input.notes) : item.notes
        }
      });

      await this.recalculateRecordCompliance(tx, item.recordId);

      await AuditService.log(
        ctx,
        "IN_KIND_HANDOVER_RECORDED",
        "StudentRequirementItem",
        item.id,
        `Received ${delta} ${item.unit}(s) of '${item.name}' (Receipt: ${receiptNumber}).`
      );

      return { item: updatedItem, log };
    });
  }

  static async reverseInKindHandover(
    ctx: TenantContext,
    input: ReverseInKindHandoverInput
  ): Promise<{ item: StudentRequirementItem; log: InKindHandoverLog }> {
    this.checkReceivePermission(ctx);

    const deltaReduction = new Prisma.Decimal(input.deltaReduction.toString());
    if (deltaReduction.isNegative() || deltaReduction.isZero()) {
      throw new Error("Reduction quantity must be greater than zero.");
    }
    if (!input.reason?.trim()) {
      throw new Error("A reason is mandatory for in-kind handover reversal.");
    }

    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "StudentRequirementItem" WHERE id = ${input.studentRequirementItemId} FOR UPDATE`;

      const item = await tx.studentRequirementItem.findFirst({
        where: { id: input.studentRequirementItemId },
        include: { record: true }
      });

      if (!item || item.record.branchId !== ctx.branchId) {
        throw new Error("Student requirement item not found in current branch.");
      }

      if (deltaReduction.greaterThan(item.quantityDelivered)) {
        throw new Error(
          `Cannot reduce by ${deltaReduction}; current delivered quantity is ${item.quantityDelivered}.`
        );
      }

      const prevDelivered = item.quantityDelivered;
      const newDelivered = prevDelivered.minus(deltaReduction);
      const effectiveDelivered = newDelivered.add(item.quantityMonetized);

      let newStatus: RequirementItemStatus = item.status;
      if (item.status !== RequirementItemStatus.EXEMPTED) {
        if (effectiveDelivered.greaterThanOrEqualTo(item.quantityRequired)) {
          newStatus = item.quantityDelivered.isZero() && item.quantityMonetized.greaterThanOrEqualTo(item.quantityRequired)
            ? RequirementItemStatus.MONETIZED
            : RequirementItemStatus.FULFILLED;
        } else if (effectiveDelivered.greaterThan(0)) {
          newStatus = RequirementItemStatus.PARTIAL;
        } else {
          newStatus = RequirementItemStatus.PENDING;
        }
      }

      const receiptNumber = await this.generateNextInKindReceiptNumber(tx, ctx.branchId);

      const log = await tx.inKindHandoverLog.create({
        data: {
          branchId: ctx.branchId,
          studentRequirementItemId: item.id,
          receiptNumber,
          deltaDelivered: deltaReduction.negated(),
          previousQuantity: prevDelivered,
          newQuantity: newDelivered,
          receivedById: ctx.userId,
          isCorrection: true,
          correctionReason: input.reason.trim(),
          notes: input.notes?.trim() || null
        }
      });

      const updatedItem = await tx.studentRequirementItem.update({
        where: { id: item.id },
        data: {
          quantityDelivered: newDelivered,
          status: newStatus
        }
      });

      await this.recalculateRecordCompliance(tx, item.recordId);

      await AuditService.log(
        ctx,
        "IN_KIND_HANDOVER_REVERSED",
        "StudentRequirementItem",
        item.id,
        `Reversed ${deltaReduction} ${item.unit}(s) of '${item.name}' (Reason: ${input.reason}).`
      );

      return { item: updatedItem, log };
    });
  }

  // ==========================================
  // 5. CASH-IN-LIEU MONETIZATION (VIA PAYMENTDAO)
  // ==========================================

  static async monetizeRequirementItem(
    ctx: TenantContext,
    input: MonetizeRequirementInput
  ): Promise<{ item: StudentRequirementItem; payment: { id: string; paymentNumber: string; amount: Prisma.Decimal; [key: string]: unknown } }> {
    this.checkMonetizePermission(ctx);

    const monetizedQty = new Prisma.Decimal(input.monetizedQuantity.toString());
    if (monetizedQty.isNegative() || monetizedQty.isZero()) {
      throw new Error("Monetized quantity must be greater than zero.");
    }

    const item = await db.studentRequirementItem.findFirst({
      where: { id: input.studentRequirementItemId },
      include: {
        record: {
          include: { student: true }
        },
        blueprintItem: true
      }
    });

    if (!item || item.record.branchId !== ctx.branchId) {
      throw new Error("Student requirement item not found in current branch.");
    }

    if (item.status === RequirementItemStatus.EXEMPTED) {
      throw new Error("Cannot monetize an exempted requirement.");
    }

    if (!item.cashInLieuAmount || item.cashInLieuAmount.isZero()) {
      throw new Error(`Requirement item '${item.name}' has no cash-in-lieu amount configured.`);
    }

    const unfulfilledQty = item.quantityRequired.minus(item.quantityDelivered).minus(item.quantityMonetized);
    if (monetizedQty.greaterThan(unfulfilledQty)) {
      throw new Error(
        `Cannot monetize ${monetizedQty} ${item.unit}(s). Remaining unfulfilled quantity is ${unfulfilledQty}.`
      );
    }

    const totalAmount = monetizedQty.mul(item.cashInLieuAmount);

    const idempotencyKey = input.idempotencyKey || `req-monetize-${item.id}-${Date.now()}`;
    const paymentRes = await PaymentDAO.recordPayment(ctx, {
      studentId: item.record.studentId,
      amount: totalAmount,
      paymentMethod: input.paymentMethod,
      payerName: input.payerName || `${item.record.student.firstName} ${item.record.student.lastName}`,
      payerPhone: input.payerPhone,
      notes: `Cash-in-lieu for ${monetizedQty} ${item.unit}(s) of '${item.name}'${input.notes ? ` - ${input.notes}` : ""}`,
      idempotencyKey
    }) as unknown as { payment?: { id: string; paymentNumber: string; amount: Prisma.Decimal; [key: string]: unknown }; id: string; paymentNumber: string; amount: Prisma.Decimal; [key: string]: unknown };

    const payment = paymentRes.payment || paymentRes;

    const updatedItem = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "StudentRequirementItem" WHERE id = ${item.id} FOR UPDATE`;

      const newMonetized = item.quantityMonetized.add(monetizedQty);
      const effectiveDelivered = item.quantityDelivered.add(newMonetized);

      let newStatus: RequirementItemStatus = item.status;
      if (effectiveDelivered.greaterThanOrEqualTo(item.quantityRequired)) {
        newStatus = item.quantityDelivered.isZero()
          ? RequirementItemStatus.MONETIZED
          : RequirementItemStatus.FULFILLED;
      } else if (effectiveDelivered.greaterThan(0)) {
        newStatus = RequirementItemStatus.PARTIAL;
      } else {
        newStatus = RequirementItemStatus.PENDING;
      }

      const updated = await tx.studentRequirementItem.update({
        where: { id: item.id },
        data: {
          quantityMonetized: newMonetized,
          paymentId: payment.id,
          status: newStatus
        }
      });

      await this.recalculateRecordCompliance(tx, item.recordId);
      return updated;
    });

    await AuditService.log(
      ctx,
      "REQUIREMENT_CASH_IN_LIEU_PAID",
      "StudentRequirementItem",
      item.id,
      `Monetized ${monetizedQty} ${item.unit}(s) of '${item.name}' for UGX ${totalAmount} (Payment: ${payment.paymentNumber}).`
    );

    return { item: updatedItem, payment };
  }

  // ==========================================
  // 6. EXEMPTIONS
  // ==========================================

  static async exemptRequirementItem(
    ctx: TenantContext,
    input: ExemptRequirementInput
  ): Promise<StudentRequirementItem> {
    this.checkReceivePermission(ctx);

    if (!input.reason?.trim()) {
      throw new Error("Exemption reason is mandatory.");
    }

    const item = await db.studentRequirementItem.findFirst({
      where: { id: input.studentRequirementItemId },
      include: { record: true }
    });

    if (!item || item.record.branchId !== ctx.branchId) {
      throw new Error("Student requirement item not found in current branch.");
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.studentRequirementItem.update({
        where: { id: item.id },
        data: {
          status: RequirementItemStatus.EXEMPTED,
          exemptionReason: input.reason.trim(),
          notes: input.notes?.trim() || item.notes
        }
      });

      await this.recalculateRecordCompliance(tx, item.recordId);

      await AuditService.log(
        ctx,
        "REQUIREMENT_ITEM_EXEMPTED",
        "StudentRequirementItem",
        item.id,
        `Exempted requirement item '${item.name}' for student (Reason: ${input.reason}).`
      );

      return updated;
    });
  }

  // ==========================================
  // 7. COMPLIANCE HELPER
  // ==========================================

  private static async recalculateRecordCompliance(
    tx: Prisma.TransactionClient,
    recordId: string
  ): Promise<void> {
    const items = await tx.studentRequirementItem.findMany({
      where: { recordId }
    });

    const totalItemsCount = items.length;
    let fulfilledCount = 0;
    let pendingCount = 0;
    let allMandatoryFulfilled = true;

    for (const it of items) {
      const isFulfilled =
        it.status === RequirementItemStatus.FULFILLED ||
        it.status === RequirementItemStatus.MONETIZED ||
        it.status === RequirementItemStatus.EXEMPTED;

      if (isFulfilled) {
        fulfilledCount++;
      } else {
        pendingCount++;
        if (it.isMandatory) {
          allMandatoryFulfilled = false;
        }
      }
    }

    await tx.studentRequirementRecord.update({
      where: { id: recordId },
      data: {
        totalItemsCount,
        fulfilledCount,
        pendingCount,
        isFullyCompliant: allMandatoryFulfilled
      }
    });
  }

  // ==========================================
  // 8. QUERY & REPORTING METHODS
  // ==========================================

  static async getStudentRequirementRecord(
    ctx: TenantContext,
    filters: { studentId: string; academicYearId: string; termId?: string | null }
  ): Promise<(StudentRequirementRecord & { items: (StudentRequirementItem & { handoverLogs: InKindHandoverLog[] })[]; student: { id: string; firstName: string; lastName: string; admissionNo: string; [key: string]: unknown } }) | null> {
    this.checkReadPermission(ctx);

    return db.studentRequirementRecord.findFirst({
      where: {
        branchId: ctx.branchId,
        studentId: filters.studentId,
        academicYearId: filters.academicYearId,
        ...(filters.termId !== undefined ? { termId: filters.termId } : {})
      },
      include: {
        student: true,
        academicYear: true,
        term: true,
        classRequirement: true,
        items: {
          include: {
            handoverLogs: {
              include: { receivedBy: true },
              orderBy: { receivedAt: "desc" }
            },
            payment: true
          },
          orderBy: [{ category: "asc" }, { name: "asc" }]
        }
      }
    });
  }

  static async listStudentRequirementRecords(
    ctx: TenantContext,
    filters: {
      classId?: string;
      academicYearId: string;
      termId?: string | null;
      isFullyCompliant?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    records: (StudentRequirementRecord & { student: { firstName: string; lastName: string; admissionNo: string; [key: string]: unknown }; classRequirement: { class: { name: string; [key: string]: unknown }; [key: string]: unknown }; items: StudentRequirementItem[] })[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.checkReadPermission(ctx);

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.StudentRequirementRecordWhereInput = {
      branchId: ctx.branchId,
      academicYearId: filters.academicYearId,
      ...(filters.termId !== undefined ? { termId: filters.termId } : {}),
      ...(filters.isFullyCompliant !== undefined ? { isFullyCompliant: filters.isFullyCompliant } : {}),
      ...(filters.classId
        ? {
            classRequirement: { classId: filters.classId }
          }
        : {}),
      ...(filters.search
        ? {
            student: {
              OR: [
                { firstName: { contains: filters.search, mode: "insensitive" } },
                { lastName: { contains: filters.search, mode: "insensitive" } },
                { admissionNo: { contains: filters.search, mode: "insensitive" } }
              ]
            }
          }
        : {})
    };

    const [records, total] = await Promise.all([
      db.studentRequirementRecord.findMany({
        where,
        include: {
          student: true,
          classRequirement: { include: { class: true } },
          items: true
        },
        skip,
        take: limit,
        orderBy: [{ isFullyCompliant: "asc" }, { student: { lastName: "asc" } }]
      }),
      db.studentRequirementRecord.count({ where })
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getStorekeeperTally(
    ctx: TenantContext,
    filters: { academicYearId: string; termId?: string | null; classId?: string }
  ): Promise<{
    items: {
      name: string;
      category: RequirementCategory;
      unit: RequirementUnit;
      totalRequired: number;
      totalDelivered: number;
      totalMonetized: number;
      totalPending: number;
      fulfillmentRate: number;
    }[];
    totalDeliveredPhysical: number;
    totalMonetizedItems: number;
  }> {
    this.checkReportsPermission(ctx);

    const studentItems = await db.studentRequirementItem.findMany({
      where: {
        record: {
          branchId: ctx.branchId,
          academicYearId: filters.academicYearId,
          ...(filters.termId !== undefined ? { termId: filters.termId } : {}),
          ...(filters.classId ? { classRequirement: { classId: filters.classId } } : {})
        }
      }
    });

    const tallyMap = new Map<
      string,
      {
        name: string;
        category: RequirementCategory;
        unit: RequirementUnit;
        totalRequired: Prisma.Decimal;
        totalDelivered: Prisma.Decimal;
        totalMonetized: Prisma.Decimal;
      }
    >();

    for (const item of studentItems) {
      const key = `${item.name}-${item.unit}-${item.category}`;
      if (!tallyMap.has(key)) {
        tallyMap.set(key, {
          name: item.name,
          category: item.category,
          unit: item.unit,
          totalRequired: new Prisma.Decimal(0),
          totalDelivered: new Prisma.Decimal(0),
          totalMonetized: new Prisma.Decimal(0)
        });
      }

      const cur = tallyMap.get(key)!;
      cur.totalRequired = cur.totalRequired.add(item.quantityRequired);
      cur.totalDelivered = cur.totalDelivered.add(item.quantityDelivered);
      cur.totalMonetized = cur.totalMonetized.add(item.quantityMonetized);
    }

    const items = Array.from(tallyMap.values()).map((v) => {
      const totalReq = v.totalRequired.toNumber();
      const totalDel = v.totalDelivered.toNumber();
      const totalMon = v.totalMonetized.toNumber();
      const totalFulfilled = totalDel + totalMon;
      const totalPending = Math.max(0, totalReq - totalFulfilled);
      const fulfillmentRate = totalReq > 0 ? Number(((totalFulfilled / totalReq) * 100).toFixed(1)) : 100;

      return {
        name: v.name,
        category: v.category,
        unit: v.unit,
        totalRequired: totalReq,
        totalDelivered: totalDel,
        totalMonetized: totalMon,
        totalPending,
        fulfillmentRate
      };
    });

    const totalDeliveredPhysical = items.reduce((acc, it) => acc + it.totalDelivered, 0);
    const totalMonetizedItems = items.reduce((acc, it) => acc + it.totalMonetized, 0);

    return {
      items,
      totalDeliveredPhysical,
      totalMonetizedItems
    };
  }

  static async getClassComplianceSummary(
    ctx: TenantContext,
    filters: { academicYearId: string; termId?: string | null }
  ): Promise<{
    classes: {
      classId: string;
      className: string;
      totalStudents: number;
      fullyCompliantCount: number;
      partialOrPendingCount: number;
      complianceRate: number;
    }[];
    overallComplianceRate: number;
    totalAssignedStudents: number;
  }> {
    this.checkReportsPermission(ctx);

    const records = await db.studentRequirementRecord.findMany({
      where: {
        branchId: ctx.branchId,
        academicYearId: filters.academicYearId,
        ...(filters.termId !== undefined ? { termId: filters.termId } : {})
      },
      include: {
        classRequirement: { include: { class: true } }
      }
    });

    const classMap = new Map<
      string,
      {
        classId: string;
        className: string;
        totalStudents: number;
        fullyCompliantCount: number;
      }
    >();

    for (const rec of records) {
      const cid = rec.classRequirement.classId;
      const cname = rec.classRequirement.class.name;

      if (!classMap.has(cid)) {
        classMap.set(cid, {
          classId: cid,
          className: cname,
          totalStudents: 0,
          fullyCompliantCount: 0
        });
      }

      const cur = classMap.get(cid)!;
      cur.totalStudents++;
      if (rec.isFullyCompliant) {
        cur.fullyCompliantCount++;
      }
    }

    const classes = Array.from(classMap.values()).map((c) => {
      const partialOrPending = c.totalStudents - c.fullyCompliantCount;
      const rate = c.totalStudents > 0 ? Number(((c.fullyCompliantCount / c.totalStudents) * 100).toFixed(1)) : 0;
      return {
        classId: c.classId,
        className: c.className,
        totalStudents: c.totalStudents,
        fullyCompliantCount: c.fullyCompliantCount,
        partialOrPendingCount: partialOrPending,
        complianceRate: rate
      };
    });

    const totalAssignedStudents = records.length;
    const totalCompliant = records.filter((r) => r.isFullyCompliant).length;
    const overallComplianceRate = totalAssignedStudents > 0
      ? Number(((totalCompliant / totalAssignedStudents) * 100).toFixed(1))
      : 0;

    return {
      classes,
      overallComplianceRate,
      totalAssignedStudents
    };
  }
}
