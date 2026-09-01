import { db } from "../db";
import { Prisma, DiscountType, InvoiceStatus, Invoice } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { LedgerDAO } from "./ledger.dao";
import crypto from "crypto";

export interface EvaluatedLineItem {
  feeTypeId: string | null;
  feeTypeName: string;
  description: string | null;
  unitAmount: Prisma.Decimal;
  quantity: number;
  discount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface CreateIndividualInvoiceInput {
  studentId: string;
  enrollmentId: string;
  academicYearId: string;
  termId?: string | null;
  feeStructureId?: string | null;
  dueDate: Date | string;
  notes?: string | null;
  items?: Array<{
    feeTypeId?: string | null;
    feeTypeName: string;
    description?: string | null;
    unitAmount: number | string | Prisma.Decimal;
    quantity?: number;
  }>;
}

export interface BulkClassBillingInput {
  classId: string;
  academicYearId: string;
  termId?: string | null;
  feeStructureId: string;
  dueDate: Date | string;
  notes?: string | null;
}

export class InvoiceDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:read') ||
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
      perms.includes('fees:invoices:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:invoices:write");
  }

  /**
   * Concurrency-safe, race-free invoice number generation via atomic PostgreSQL sequence table.
   */
  static async generateNextInvoiceNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
    issueDate: Date = new Date()
  ): Promise<string> {
    const year = issueDate.getFullYear();
    const id = crypto.randomUUID();

    const result = await tx.$queryRaw<Array<{ lastValue: number }>>`
      INSERT INTO "InvoiceSequence" ("id", "branchId", "year", "lastValue", "updatedAt")
      VALUES (${id}, ${branchId}, ${year}, 1, NOW())
      ON CONFLICT ("branchId", "year")
      DO UPDATE SET "lastValue" = "InvoiceSequence"."lastValue" + 1, "updatedAt" = NOW()
      RETURNING "lastValue";
    `;

    const seq = result[0]?.lastValue ?? 1;
    return `INV-${year}-${seq.toString().padStart(5, '0')}`;
  }

  /**
   * Deterministic discount calculation:
   * 1. Specific FeeType discounts applied to matching line items (capped at item amount).
   * 2. General student discount applied to remaining subtotal (capped at remaining amount).
   * 3. Net amount strictly >= 0.
   */
  static calculateFinancials(
    rawItems: Array<{
      feeTypeId?: string | null;
      feeTypeName: string;
      description?: string | null;
      unitAmount: Prisma.Decimal;
      quantity?: number;
    }>,
    discounts: Array<{
      feeTypeId: string | null;
      discountType: DiscountType;
      value: Prisma.Decimal;
      isActive: boolean;
    }>
  ): {
    items: EvaluatedLineItem[];
    grossAmount: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    netAmount: Prisma.Decimal;
  } {
    const activeDiscounts = discounts.filter(d => d.isActive);
    let grossSum = new Prisma.Decimal(0);
    let lineDiscountSum = new Prisma.Decimal(0);

    const evaluatedItems: EvaluatedLineItem[] = [];

    // Phase 1: Line Item Calculation & Specific Discounts
    for (const item of rawItems) {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const unit = new Prisma.Decimal(item.unitAmount);
      const itemGross = unit.mul(qty);
      grossSum = grossSum.add(itemGross);

      let itemDiscount = new Prisma.Decimal(0);
      if (item.feeTypeId) {
        const specificDiscount = activeDiscounts.find(d => d.feeTypeId === item.feeTypeId);
        if (specificDiscount) {
          if (specificDiscount.discountType === DiscountType.PERCENTAGE) {
            itemDiscount = itemGross.mul(specificDiscount.value).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          } else {
            itemDiscount = new Prisma.Decimal(specificDiscount.value);
          }
          // Cap at item gross
          if (itemDiscount.greaterThan(itemGross)) {
            itemDiscount = itemGross;
          }
        }
      }

      lineDiscountSum = lineDiscountSum.add(itemDiscount);
      const lineTotal = itemGross.minus(itemDiscount);

      evaluatedItems.push({
        feeTypeId: item.feeTypeId || null,
        feeTypeName: item.feeTypeName,
        description: item.description || null,
        unitAmount: unit,
        quantity: qty,
        discount: itemDiscount,
        lineTotal
      });
    }

    // Phase 2: General Discount Evaluation
    let generalDiscount = new Prisma.Decimal(0);
    const generalRule = activeDiscounts.find(d => d.feeTypeId === null);
    const remainingSubtotal = grossSum.minus(lineDiscountSum);

    if (generalRule && remainingSubtotal.greaterThan(0)) {
      if (generalRule.discountType === DiscountType.PERCENTAGE) {
        generalDiscount = remainingSubtotal.mul(generalRule.value).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      } else {
        generalDiscount = new Prisma.Decimal(generalRule.value);
      }
      if (generalDiscount.greaterThan(remainingSubtotal)) {
        generalDiscount = remainingSubtotal;
      }
    }

    const totalDiscount = lineDiscountSum.add(generalDiscount);
    const netAmount = grossSum.minus(totalDiscount);

    return {
      items: evaluatedItems,
      grossAmount: grossSum,
      discountAmount: totalDiscount,
      netAmount: netAmount.isNegative() ? new Prisma.Decimal(0) : netAmount
    };
  }

  static async list(
    ctx: TenantContext,
    filters?: {
      studentId?: string;
      classId?: string;
      academicYearId?: string;
      termId?: string;
      status?: InvoiceStatus;
    }
  ) {
    this.checkReadPermission(ctx);

    return db.invoice.findMany({
      where: {
        branchId: ctx.branchId,
        ...(filters?.studentId ? { studentId: filters.studentId } : {}),
        ...(filters?.academicYearId ? { academicYearId: filters.academicYearId } : {}),
        ...(filters?.termId !== undefined ? { termId: filters.termId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.classId
          ? {
              enrollment: {
                classId: filters.classId
              }
            }
          : {})
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        enrollment: {
          include: {
            classRef: { select: { id: true, name: true } }
          }
        },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        feeStructure: { select: { id: true, name: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getById(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const invoice = await db.invoice.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        enrollment: {
          include: {
            classRef: { select: { id: true, name: true } }
          }
        },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        feeStructure: { select: { id: true, name: true } },
        items: {
          include: {
            feeType: { select: { id: true, name: true, code: true } }
          }
        }
      }
    });

    if (!invoice) {
      throw new Error("Invoice not found or access denied.");
    }

    return invoice;
  }

  static async createIndividualInvoice(ctx: TenantContext, data: CreateIndividualInvoiceInput) {
    this.checkWritePermission(ctx);

    // 1. Validate student
    const student = await db.student.findFirst({
      where: { id: data.studentId, branchId: ctx.branchId }
    });
    if (!student) {
      throw new Error("Invalid student: Student does not belong to this branch.");
    }

    // 2. Validate enrollment
    const enrollment = await db.enrollment.findUnique({
      where: { id: data.enrollmentId },
      include: { classRef: true }
    });
    if (
      !enrollment ||
      enrollment.studentId !== data.studentId ||
      enrollment.classRef.branchId !== ctx.branchId ||
      enrollment.academicYearId !== data.academicYearId
    ) {
      throw new Error("Invalid enrollment: Enrollment does not match the student and academic year context.");
    }

    // 3. Validate AcademicYear
    const academicYear = await db.academicYear.findFirst({
      where: { id: data.academicYearId, branchId: ctx.branchId }
    });
    if (!academicYear) {
      throw new Error("Invalid academic year: Academic year does not exist in this branch.");
    }

    // 4. Validate optional Term
    if (data.termId) {
      const term = await db.term.findUnique({ where: { id: data.termId } });
      if (!term || term.academicYearId !== data.academicYearId) {
        throw new Error("Invalid term: Term does not belong to the selected academic year.");
      }
    }

    // 5. Resolve items
    let rawItems: Array<{
      feeTypeId?: string | null;
      feeTypeName: string;
      description?: string | null;
      unitAmount: Prisma.Decimal;
      quantity?: number;
    }> = [];

    let billingKey = "";

    if (data.feeStructureId) {
      const feeStructure = await db.feeStructure.findFirst({
        where: { id: data.feeStructureId, branchId: ctx.branchId },
        include: {
          items: {
            include: { feeType: true }
          }
        }
      });
      if (!feeStructure || feeStructure.items.length === 0) {
        throw new Error("Invalid fee structure: Fee structure does not exist or has no items.");
      }

      rawItems = feeStructure.items.map(i => ({
        feeTypeId: i.feeTypeId,
        feeTypeName: i.feeType.name,
        description: i.description || null,
        unitAmount: i.amount,
        quantity: 1
      }));

      const termSuffix = data.termId || "ANNUAL";
      billingKey = `BULK:${data.feeStructureId}:${data.studentId}:${data.academicYearId}:${termSuffix}`;

      // Check duplicate
      const duplicate = await db.invoice.findUnique({
        where: {
          branchId_billingKey: {
            branchId: ctx.branchId,
            billingKey
          }
        }
      });
      if (duplicate) {
        throw new Error("An invoice has already been issued for this student and fee structure.");
      }
    } else if (data.items && data.items.length > 0) {
      // Custom ad-hoc items
      for (const item of data.items) {
        if (item.feeTypeId) {
          const feeType = await db.feeType.findFirst({
            where: { id: item.feeTypeId, branchId: ctx.branchId }
          });
          if (!feeType) {
            throw new Error(`Invalid fee type: Fee type ${item.feeTypeId} does not exist in this branch.`);
          }
        }

        const amt = new Prisma.Decimal(item.unitAmount);
        if (amt.isNegative() || amt.isNaN()) {
          throw new Error("Invoice item amount cannot be negative.");
        }

        rawItems.push({
          feeTypeId: item.feeTypeId || null,
          feeTypeName: item.feeTypeName.trim(),
          description: item.description?.trim() || null,
          unitAmount: amt,
          quantity: item.quantity && item.quantity > 0 ? item.quantity : 1
        });
      }
      billingKey = `ADHOC:${crypto.randomUUID()}`;
    } else {
      throw new Error("Invoice must have either a fee structure or at least one custom line item.");
    }

    // 6. Resolve applicable discounts
    const discounts = await db.studentFeeDiscount.findMany({
      where: {
        branchId: ctx.branchId,
        studentId: data.studentId,
        isActive: true,
        OR: [
          { academicYearId: null },
          { academicYearId: data.academicYearId }
        ],
        AND: [
          {
            OR: [
              { termId: null },
              { termId: data.termId || null }
            ]
          }
        ]
      }
    });

    const financials = this.calculateFinancials(rawItems, discounts);
    const dueDate = new Date(data.dueDate);

    // 7. Atomic transaction
    const invoice = await db.$transaction(async (tx) => {
      const invoiceNumber = await this.generateNextInvoiceNumber(tx, ctx.branchId, new Date());

      const createdInvoice = await tx.invoice.create({
        data: {
          branchId: ctx.branchId,
          studentId: data.studentId,
          enrollmentId: data.enrollmentId,
          academicYearId: data.academicYearId,
          termId: data.termId || null,
          feeStructureId: data.feeStructureId || null,
          invoiceNumber,
          billingKey,
          dueDate,
          grossAmount: financials.grossAmount,
          discountAmount: financials.discountAmount,
          netAmount: financials.netAmount,
          status: InvoiceStatus.PENDING,
          notes: data.notes?.trim() || null,
          items: {
            create: financials.items.map(item => ({
              feeTypeId: item.feeTypeId,
              feeTypeName: item.feeTypeName,
              description: item.description,
              unitAmount: item.unitAmount,
              quantity: item.quantity,
              discount: item.discount,
              lineTotal: item.lineTotal
            }))
          }
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
          enrollment: {
            include: {
              classRef: { select: { id: true, name: true } }
            }
          },
          academicYear: { select: { id: true, name: true } },
          term: { select: { id: true, name: true } },
          items: true
        }
      });

      await LedgerDAO.syncInvoiceIssued(tx, ctx.branchId, createdInvoice, ctx.userId);

      return createdInvoice;
    });

    await AuditService.log(
      ctx,
      'CREATE_INVOICE',
      'Invoice',
      invoice.id,
      JSON.stringify({
        studentId: invoice.studentId,
        invoiceNumber: invoice.invoiceNumber,
        netAmount: invoice.netAmount.toString(),
        dueDate: invoice.dueDate.toISOString()
      })
    );

    return invoice;
  }

  static async generateInvoicesForClass(ctx: TenantContext, input: BulkClassBillingInput) {
    this.checkWritePermission(ctx);

    // 1. Validate class
    const classRef = await db.class.findFirst({
      where: { id: input.classId, branchId: ctx.branchId }
    });
    if (!classRef) {
      throw new Error("Invalid class: Class does not belong to this branch.");
    }

    // 2. Validate AcademicYear
    const academicYear = await db.academicYear.findFirst({
      where: { id: input.academicYearId, branchId: ctx.branchId }
    });
    if (!academicYear) {
      throw new Error("Invalid academic year: Academic year does not exist in this branch.");
    }

    // 3. Validate optional Term
    if (input.termId) {
      const term = await db.term.findUnique({ where: { id: input.termId } });
      if (!term || term.academicYearId !== input.academicYearId) {
        throw new Error("Invalid term: Term does not belong to the selected academic year.");
      }
    }

    // 4. Validate FeeStructure
    const feeStructure = await db.feeStructure.findFirst({
      where: { id: input.feeStructureId, branchId: ctx.branchId },
      include: {
        items: {
          include: { feeType: true }
        }
      }
    });
    if (!feeStructure || feeStructure.items.length === 0) {
      throw new Error("Invalid fee structure: Fee structure does not exist or contains no items.");
    }

    // 5. Load active enrollments in class
    const enrollments = await db.enrollment.findMany({
      where: {
        classId: input.classId,
        academicYearId: input.academicYearId,
        status: 'ACTIVE',
        student: { branchId: ctx.branchId }
      },
      include: {
        student: true
      }
    });

    if (enrollments.length === 0) {
      return {
        billedCount: 0,
        skippedCount: 0,
        totalBilled: '0.00',
        totalDiscount: '0.00',
        invoices: []
      };
    }

    const studentIds = enrollments.map(e => e.studentId);

    // 6. Load all active discounts for candidate students
    const allDiscounts = await db.studentFeeDiscount.findMany({
      where: {
        branchId: ctx.branchId,
        studentId: { in: studentIds },
        isActive: true,
        OR: [
          { academicYearId: null },
          { academicYearId: input.academicYearId }
        ],
        AND: [
          {
            OR: [
              { termId: null },
              { termId: input.termId || null }
            ]
          }
        ]
      }
    });

    const discountsByStudent = new Map<string, typeof allDiscounts>();
    for (const d of allDiscounts) {
      const list = discountsByStudent.get(d.studentId) || [];
      list.push(d);
      discountsByStudent.set(d.studentId, list);
    }

    const rawTemplateItems = feeStructure.items.map(i => ({
      feeTypeId: i.feeTypeId,
      feeTypeName: i.feeType.name,
      description: i.description || null,
      unitAmount: i.amount,
      quantity: 1
    }));

    const termSuffix = input.termId || "ANNUAL";
    const dueDate = new Date(input.dueDate);

    // 7. Atomic batch creation
    const billedInvoices: Invoice[] = [];
    let skippedCount = 0;
    let totalBilledDecimal = new Prisma.Decimal(0);
    let totalDiscountDecimal = new Prisma.Decimal(0);

    await db.$transaction(async (tx) => {
      for (const enrollment of enrollments) {
        const billingKey = `BULK:${input.feeStructureId}:${enrollment.studentId}:${input.academicYearId}:${termSuffix}`;

        // Check if invoice with this billing key already exists
        const existing = await tx.invoice.findUnique({
          where: {
            branchId_billingKey: {
              branchId: ctx.branchId,
              billingKey
            }
          }
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        const studentDiscounts = discountsByStudent.get(enrollment.studentId) || [];
        const financials = this.calculateFinancials(rawTemplateItems, studentDiscounts);
        const invoiceNumber = await this.generateNextInvoiceNumber(tx, ctx.branchId, new Date());

        const created = await tx.invoice.create({
          data: {
            branchId: ctx.branchId,
            studentId: enrollment.studentId,
            enrollmentId: enrollment.id,
            academicYearId: input.academicYearId,
            termId: input.termId || null,
            feeStructureId: input.feeStructureId,
            invoiceNumber,
            billingKey,
            dueDate,
            grossAmount: financials.grossAmount,
            discountAmount: financials.discountAmount,
            netAmount: financials.netAmount,
            status: InvoiceStatus.PENDING,
            notes: input.notes?.trim() || null,
            items: {
              create: financials.items.map(item => ({
                feeTypeId: item.feeTypeId,
                feeTypeName: item.feeTypeName,
                description: item.description,
                unitAmount: item.unitAmount,
                quantity: item.quantity,
                discount: item.discount,
                lineTotal: item.lineTotal
              }))
            }
          },
          include: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
            items: true
          }
        });

        billedInvoices.push(created);
        totalBilledDecimal = totalBilledDecimal.add(created.netAmount);
        totalDiscountDecimal = totalDiscountDecimal.add(created.discountAmount);

        await LedgerDAO.syncInvoiceIssued(tx, ctx.branchId, created, ctx.userId);
      }
    });

    if (billedInvoices.length > 0) {
      await AuditService.log(
        ctx,
        'GENERATE_BULK_INVOICES',
        'InvoiceBatch',
        input.classId,
        JSON.stringify({
          classId: input.classId,
          academicYearId: input.academicYearId,
          termId: input.termId,
          feeStructureId: input.feeStructureId,
          studentCount: billedInvoices.length,
          skippedCount,
          totalBilled: totalBilledDecimal.toString(),
          totalDiscount: totalDiscountDecimal.toString()
        })
      );
    }

    return {
      billedCount: billedInvoices.length,
      skippedCount,
      totalBilled: totalBilledDecimal.toString(),
      totalDiscount: totalDiscountDecimal.toString(),
      invoices: billedInvoices
    };
  }

  static async voidInvoice(ctx: TenantContext, id: string, reason: string) {
    this.checkWritePermission(ctx);

    const voidReason = reason?.trim();
    if (!voidReason) {
      throw new Error("Void reason is mandatory.");
    }

    const invoice = await db.invoice.findFirst({
      where: { id, branchId: ctx.branchId }
    });

    if (!invoice) {
      throw new Error("Invoice not found or access denied.");
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new Error("Invoice is already voided.");
    }

    const activeAllocations = await db.paymentAllocation.findMany({
      where: { invoiceId: id, status: 'ACTIVE' }
    });
    if (activeAllocations.length > 0) {
      throw new Error("Cannot void invoice with active payment allocations. Reverse associated payments or re-allocate first.");
    }

    const updated = await db.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.VOID,
          voidReason,
          voidedAt: new Date(),
          voidedById: ctx.userId
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
          items: true
        }
      });

      await LedgerDAO.syncInvoiceVoided(tx, ctx.branchId, invoice, voidReason, ctx.userId);

      return updatedInvoice;
    });

    await AuditService.log(
      ctx,
      'VOID_INVOICE',
      'Invoice',
      id,
      JSON.stringify({
        invoiceId: id,
        invoiceNumber: updated.invoiceNumber,
        reason: voidReason,
        originalNetAmount: updated.netAmount.toString()
      })
    );

    return updated;
  }
}
