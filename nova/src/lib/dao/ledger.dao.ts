import { db } from "../db";
import { Prisma, LedgerEntryType, LedgerDirection } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface PostLedgerEntryParams {
  branchId: string;
  studentId: string;
  academicYearId?: string | null;
  termId?: string | null;
  invoiceId?: string | null;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: Prisma.Decimal;
  referenceType: string;
  referenceId?: string | null;
  description: string;
  createdById?: string | null;
}

export interface PostOpeningBalanceInput {
  studentId: string;
  academicYearId?: string | null;
  termId?: string | null;
  direction: LedgerDirection; // DEBIT for arrears, CREDIT for advance
  amount: number | string | Prisma.Decimal;
  reason: string;
  cutoffDate?: Date | string;
}

export interface PostAdjustmentInput {
  studentId: string;
  academicYearId?: string | null;
  termId?: string | null;
  direction: LedgerDirection; // DEBIT for charge, CREDIT for waiver
  amount: number | string | Prisma.Decimal;
  reason: string;
}

export class LedgerDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:read') ||
      perms.includes('fees:ledger:read') ||
      perms.includes('fees:payments:read') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:read");
  }

  private static checkAdjustPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:ledger:adjust') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:ledger:adjust");
  }

  /**
   * Internal transactional ledger journal posting with exact balance derivation.
   */
  static async postEntry(
    tx: Prisma.TransactionClient,
    params: PostLedgerEntryParams
  ) {
    const amount = new Prisma.Decimal(params.amount);
    if (amount.isNegative() || amount.isZero() || amount.isNaN()) {
      throw new Error("Ledger entry amount must be a positive number.");
    }

    // Get current balance inside the transaction
    const lastEntry = await tx.studentLedgerEntry.findFirst({
      where: {
        branchId: params.branchId,
        studentId: params.studentId
      },
      orderBy: [
        { postedAt: 'desc' },
        { id: 'desc' }
      ]
    });

    const previousBalance = lastEntry ? new Prisma.Decimal(lastEntry.balanceAfter) : new Prisma.Decimal(0);
    const balanceAfter = params.direction === LedgerDirection.DEBIT
      ? previousBalance.add(amount)
      : previousBalance.minus(amount);

    return tx.studentLedgerEntry.create({
      data: {
        branchId: params.branchId,
        studentId: params.studentId,
        academicYearId: params.academicYearId || null,
        termId: params.termId || null,
        invoiceId: params.invoiceId || null,
        entryType: params.entryType,
        direction: params.direction,
        amount,
        referenceType: params.referenceType,
        referenceId: params.referenceId || null,
        description: params.description.trim(),
        balanceAfter,
        createdById: params.createdById || null
      }
    });
  }

  /**
   * Authoritative Student Balance: sum(Debits) - sum(Credits).
   */
  static async getBalance(ctx: TenantContext, studentId: string): Promise<{
    studentId: string;
    balance: Prisma.Decimal;
    totalDebits: Prisma.Decimal;
    totalCredits: Prisma.Decimal;
  }> {
    this.checkReadPermission(ctx);

    const student = await db.student.findFirst({
      where: { id: studentId, branchId: ctx.branchId }
    });
    if (!student) {
      throw new Error("Student not found or access denied.");
    }

    const entries = await db.studentLedgerEntry.findMany({
      where: { branchId: ctx.branchId, studentId },
      select: { direction: true, amount: true }
    });

    let debits = new Prisma.Decimal(0);
    let credits = new Prisma.Decimal(0);

    for (const e of entries) {
      if (e.direction === LedgerDirection.DEBIT) {
        debits = debits.add(e.amount);
      } else {
        credits = credits.add(e.amount);
      }
    }

    return {
      studentId,
      balance: debits.minus(credits),
      totalDebits: debits,
      totalCredits: credits
    };
  }

  /**
   * Full chronological student account statement.
   */
  static async getStatement(
    ctx: TenantContext,
    studentId: string,
    filters?: {
      academicYearId?: string;
      termId?: string;
      startDate?: Date | string;
      endDate?: Date | string;
    }
  ) {
    this.checkReadPermission(ctx);

    const student = await db.student.findFirst({
      where: { id: studentId, branchId: ctx.branchId },
      include: {
        classRef: { select: { name: true } },
        streamRef: { select: { name: true } }
      }
    });
    if (!student) {
      throw new Error("Student not found or access denied.");
    }

    const entries = await db.studentLedgerEntry.findMany({
      where: {
        branchId: ctx.branchId,
        studentId,
        ...(filters?.academicYearId ? { academicYearId: filters.academicYearId } : {}),
        ...(filters?.termId ? { termId: filters.termId } : {}),
        ...(filters?.startDate || filters?.endDate
          ? {
              postedAt: {
                ...(filters?.startDate ? { gte: new Date(filters.startDate) } : {}),
                ...(filters?.endDate ? { lte: new Date(filters.endDate) } : {})
              }
            }
          : {})
      },
      orderBy: [
        { postedAt: 'asc' },
        { id: 'asc' }
      ]
    });

    let totalDebits = new Prisma.Decimal(0);
    let totalCredits = new Prisma.Decimal(0);

    const transactions = entries.map(e => {
      if (e.direction === LedgerDirection.DEBIT) {
        totalDebits = totalDebits.add(e.amount);
      } else {
        totalCredits = totalCredits.add(e.amount);
      }

      return {
        id: e.id,
        postedAt: e.postedAt,
        entryType: e.entryType,
        direction: e.direction,
        amount: e.amount,
        referenceType: e.referenceType,
        referenceId: e.referenceId,
        description: e.description,
        balanceAfter: e.balanceAfter,
        debit: e.direction === LedgerDirection.DEBIT ? e.amount : null,
        credit: e.direction === LedgerDirection.CREDIT ? e.amount : null
      };
    });

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        className: student.classRef?.name || '-',
        streamName: student.streamRef?.name || null
      },
      transactions,
      summary: {
        totalDebits,
        totalCredits,
        closingBalance: totalDebits.minus(totalCredits)
      }
    };
  }

  /**
   * Post historical arrears / opening balance with deduplication check.
   */
  static async postOpeningBalance(ctx: TenantContext, input: PostOpeningBalanceInput) {
    this.checkAdjustPermission(ctx);

    const student = await db.student.findFirst({
      where: { id: input.studentId, branchId: ctx.branchId }
    });
    if (!student) {
      throw new Error("Student not found or access denied.");
    }

    const amt = new Prisma.Decimal(input.amount);
    if (amt.isNegative() || amt.isZero() || amt.isNaN()) {
      throw new Error("Opening balance amount must be a positive number.");
    }

    const reason = input.reason?.trim();
    if (!reason) {
      throw new Error("Reason for opening balance is mandatory.");
    }

    // Deduplication check: Check if invoices exist on or before cutoff date
    if (input.cutoffDate) {
      const cutoff = new Date(input.cutoffDate);
      const existingInvoices = await db.invoice.findFirst({
        where: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          status: { not: 'VOID' },
          issueDate: { lte: cutoff }
        }
      });
      if (existingInvoices) {
        throw new Error("Conflict: Active invoices already exist on or before the specified cutoff date. Deduplicate to avoid double-charging.");
      }
    }

    const entry = await db.$transaction(async (tx) => {
      // Pessimistic lock on student row
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${input.studentId} FOR UPDATE`;

      return this.postEntry(tx, {
        branchId: ctx.branchId,
        studentId: input.studentId,
        academicYearId: input.academicYearId || null,
        termId: input.termId || null,
        entryType: LedgerEntryType.OPENING_BALANCE,
        direction: input.direction,
        amount: amt,
        referenceType: "SYSTEM_OPENING",
        referenceId: `OPENING:${input.studentId}:${Date.now()}`,
        description: `Opening Balance: ${reason}`,
        createdById: ctx.userId
      });
    });

    await AuditService.log(
      ctx,
      'POST_OPENING_BALANCE',
      'StudentLedgerEntry',
      entry.id,
      JSON.stringify({
        studentId: input.studentId,
        direction: input.direction,
        amount: amt.toString(),
        reason
      })
    );

    return entry;
  }

  /**
   * Post manual debit or credit ledger adjustment.
   */
  static async postAdjustment(ctx: TenantContext, input: PostAdjustmentInput) {
    this.checkAdjustPermission(ctx);

    const student = await db.student.findFirst({
      where: { id: input.studentId, branchId: ctx.branchId }
    });
    if (!student) {
      throw new Error("Student not found or access denied.");
    }

    const amt = new Prisma.Decimal(input.amount);
    if (amt.isNegative() || amt.isZero() || amt.isNaN()) {
      throw new Error("Adjustment amount must be a positive number.");
    }

    const reason = input.reason?.trim();
    if (!reason) {
      throw new Error("Adjustment reason is mandatory.");
    }

    const entryType = input.direction === LedgerDirection.CREDIT
      ? LedgerEntryType.CREDIT_ADJUSTMENT
      : LedgerEntryType.DEBIT_ADJUSTMENT;

    const entry = await db.$transaction(async (tx) => {
      // Pessimistic lock on student row
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${input.studentId} FOR UPDATE`;

      return this.postEntry(tx, {
        branchId: ctx.branchId,
        studentId: input.studentId,
        academicYearId: input.academicYearId || null,
        termId: input.termId || null,
        entryType,
        direction: input.direction,
        amount: amt,
        referenceType: "MANUAL_ADJUSTMENT",
        referenceId: `ADJ:${Date.now()}`,
        description: `Adjustment: ${reason}`,
        createdById: ctx.userId
      });
    });

    await AuditService.log(
      ctx,
      'POST_LEDGER_ADJUSTMENT',
      'StudentLedgerEntry',
      entry.id,
      JSON.stringify({
        studentId: input.studentId,
        direction: input.direction,
        amount: amt.toString(),
        reason
      })
    );

    return entry;
  }

  /**
   * Helper to post gross charges and discount credits when an invoice is issued.
   */
  static async syncInvoiceIssued(
    tx: Prisma.TransactionClient,
    branchId: string,
    invoice: {
      id: string;
      studentId: string;
      academicYearId: string;
      termId?: string | null;
      invoiceNumber: string;
      grossAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
    },
    createdById?: string | null
  ) {
    // 1. Post Gross Charge (DEBIT)
    await this.postEntry(tx, {
      branchId,
      studentId: invoice.studentId,
      academicYearId: invoice.academicYearId,
      termId: invoice.termId,
      invoiceId: invoice.id,
      entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
      direction: LedgerDirection.DEBIT,
      amount: invoice.grossAmount,
      referenceType: "INVOICE",
      referenceId: invoice.id,
      description: `Invoice #${invoice.invoiceNumber} Gross Charge`,
      createdById
    });

    // 2. If discount > 0, post Bursary/Discount Credit (CREDIT)
    if (new Prisma.Decimal(invoice.discountAmount).greaterThan(0)) {
      await this.postEntry(tx, {
        branchId,
        studentId: invoice.studentId,
        academicYearId: invoice.academicYearId,
        termId: invoice.termId,
        invoiceId: invoice.id,
        entryType: LedgerEntryType.BURSARY_CREDIT,
        direction: LedgerDirection.CREDIT,
        amount: invoice.discountAmount,
        referenceType: "BURSARY",
        referenceId: invoice.id,
        description: `Bursary / Discount Credit for Invoice #${invoice.invoiceNumber}`,
        createdById
      });
    }
  }

  /**
   * Helper to post mirror reversals when an invoice is voided.
   */
  static async syncInvoiceVoided(
    tx: Prisma.TransactionClient,
    branchId: string,
    invoice: {
      id: string;
      studentId: string;
      academicYearId: string;
      termId?: string | null;
      invoiceNumber: string;
      grossAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
    },
    voidReason: string,
    voidedById?: string | null
  ) {
    // 1. Post Gross Charge Reversal (CREDIT)
    await this.postEntry(tx, {
      branchId,
      studentId: invoice.studentId,
      academicYearId: invoice.academicYearId,
      termId: invoice.termId,
      invoiceId: invoice.id,
      entryType: LedgerEntryType.INVOICE_VOID_REVERSAL,
      direction: LedgerDirection.CREDIT,
      amount: invoice.grossAmount,
      referenceType: "INVOICE_VOID",
      referenceId: invoice.id,
      description: `Void Reversal for Invoice #${invoice.invoiceNumber}: ${voidReason}`,
      createdById: voidedById
    });

    // 2. If discount > 0, reverse Bursary/Discount Credit (DEBIT)
    if (new Prisma.Decimal(invoice.discountAmount).greaterThan(0)) {
      await this.postEntry(tx, {
        branchId,
        studentId: invoice.studentId,
        academicYearId: invoice.academicYearId,
        termId: invoice.termId,
        invoiceId: invoice.id,
        entryType: LedgerEntryType.BURSARY_VOID_REVERSAL,
        direction: LedgerDirection.DEBIT,
        amount: invoice.discountAmount,
        referenceType: "BURSARY_VOID",
        referenceId: invoice.id,
        description: `Bursary Reversal on Void Invoice #${invoice.invoiceNumber}`,
        createdById: voidedById
      });
    }
  }
}
