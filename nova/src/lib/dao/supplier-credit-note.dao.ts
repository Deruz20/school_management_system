import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  SupplierCreditNoteStatus,
  SupplierInvoiceStatus,
  JournalType,
  PeriodStatus
} from "@prisma/client";
import { AuditService } from "@/lib/services/audit.service";
import { GLEngineDAO, GLAccountDAO } from "@/lib/dao/gl.dao";
import { SupplierDAO, SupplierSequenceDAO } from "@/lib/dao/supplier.dao";

export interface CreditNoteLineInput {
  itemId?: string;
  description: string;
  quantityReturned?: number | string | Prisma.Decimal;
  unitPrice: number | string | Prisma.Decimal;
  glAccountId?: string;
}

export interface CreateCreditNoteInput {
  vendorCreditNoteRef?: string;
  supplierId: string;
  originalInvoiceId?: string;
  fiscalPeriodId: string;
  creditNoteDate: Date | string;
  reason: string;
  taxAmount?: number | string | Prisma.Decimal;
  lines: CreditNoteLineInput[];
}

export class SupplierCreditNoteDAO {
  /**
   * 1. Create Draft Supplier Credit Note
   */
  static async createCreditNote(
    ctx: TenantContext,
    input: CreateCreditNoteInput
  ) {
    if (!input.reason || !input.reason.trim()) {
      throw new Error("Credit note reason is mandatory.");
    }
    if (!input.lines || input.lines.length === 0) {
      throw new Error("Credit note must contain at least one line item.");
    }

    return await db.$transaction(async (tx) => {
      // 1. Verify Supplier
      const supplier = await tx.inventorySupplier.findFirst({
        where: { id: input.supplierId, branchId: ctx.branchId }
      });
      if (!supplier) throw new Error("Supplier not found in this branch.");

      // 2. Verify Fiscal Period
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: input.fiscalPeriodId, branchId: ctx.branchId }
      });
      if (!period) throw new Error("Fiscal period not found.");
      if (period.status !== PeriodStatus.OPEN) {
        throw new Error(`Cannot issue credit note in a ${period.status} fiscal period.`);
      }

      let totalGross = new Prisma.Decimal(0);
      const linesToCreate = [];

      for (const line of input.lines) {
        const qty = new Prisma.Decimal(line.quantityReturned || 1);
        const price = new Prisma.Decimal(line.unitPrice);

        if (price.lte(0)) {
          throw new Error("Unit price must be positive on credit note lines.");
        }

        const lineTotal = qty.mul(price);
        totalGross = totalGross.add(lineTotal);

        linesToCreate.push({
          branchId: ctx.branchId,
          itemId: line.itemId,
          description: line.description.trim(),
          quantityReturned: qty,
          unitPrice: price,
          lineTotal,
          glAccountId: line.glAccountId
        });
      }

      const taxAmt = new Prisma.Decimal(input.taxAmount || 0);
      const netCredit = totalGross.add(taxAmt);

      const creditNoteNumber = await SupplierSequenceDAO.nextSequence(ctx, "SCRN", tx);

      const creditNote = await tx.supplierCreditNote.create({
        data: {
          branchId: ctx.branchId,
          creditNoteNumber,
          vendorCreditNoteRef: input.vendorCreditNoteRef?.trim() || null,
          supplierId: supplier.id,
          originalInvoiceId: input.originalInvoiceId || null,
          fiscalPeriodId: period.id,
          creditNoteDate: new Date(input.creditNoteDate),
          grossAmount: totalGross,
          taxAmount: taxAmt,
          netCreditAmount: netCredit,
          unallocatedAmount: netCredit,
          reason: input.reason.trim(),
          status: SupplierCreditNoteStatus.DRAFT,
          createdById: ctx.userId,
          lines: {
            create: linesToCreate
          }
        },
        include: {
          lines: true,
          supplier: true
        }
      });

      await AuditService.log(
        ctx,
        "CREATE_SUPPLIER_CREDIT_NOTE",
        "SupplierCreditNote",
        creditNote.id,
        JSON.stringify({ creditNoteNumber: creditNote.creditNoteNumber, net: netCredit.toString() })
      );

      return creditNote;
    });
  }

  /**
   * 2. Four-Eye Approval & Double-Entry General Ledger Posting
   * Dr. Accounts Payable - Suppliers (#2110)
   *   Cr. Stores Inventory Asset (#1310) / Expense (#6xxx)
   *   Cr. VAT Input Recoverable (#2150) (if tax credit included)
   */
  static async approveCreditNote(
    ctx: TenantContext,
    creditNoteId: string
  ) {
    return await db.$transaction(async (tx) => {
      const creditNote = await tx.supplierCreditNote.findFirst({
        where: { id: creditNoteId, branchId: ctx.branchId },
        include: {
          lines: { include: { item: true } },
          supplier: true,
          fiscalPeriod: true
        }
      });
      if (!creditNote) throw new Error("Supplier credit note not found.");

      if (creditNote.status !== SupplierCreditNoteStatus.DRAFT) {
        throw new Error(`Cannot approve credit note with status ${creditNote.status}.`);
      }

      if (creditNote.fiscalPeriod.status !== PeriodStatus.OPEN) {
        throw new Error(`Cannot approve credit note in a ${creditNote.fiscalPeriod.status} fiscal period.`);
      }

      // Maker-Checker constraint
      if (creditNote.createdById === ctx.userId) {
        throw new Error("Four-Eye Policy: The maker who created this credit note cannot self-approve it.");
      }

      const defaultApAcc = (await GLAccountDAO.getAccountByCode(ctx, "2110", tx))!.id;
      const defaultInvAcc = (await GLAccountDAO.getAccountByCode(ctx, "1310", tx))!.id;
      const defaultExpAcc = (await GLAccountDAO.getAccountByCode(ctx, "6200", tx))!.id;
      const defaultVatAcc = (await GLAccountDAO.getAccountByCode(ctx, "2150", tx)) || (await GLAccountDAO.getAccountByCode(ctx, "1220", tx));

      const journalLines: Array<{ accountId: string; debit: Prisma.Decimal | number; credit: Prisma.Decimal | number; description: string }> = [];

      // Debit: Relieve AP Supplier Liability (#2110)
      journalLines.push({
        accountId: defaultApAcc,
        debit: creditNote.netCreditAmount,
        credit: 0,
        description: `Credit Note Liability Reduction: ${creditNote.supplier.name} (${creditNote.creditNoteNumber})`
      });

      // Credit: Relieve inventory or expense for line items
      for (const line of creditNote.lines) {
        const lineCreditAccId = line.glAccountId || (line.itemId ? defaultInvAcc : defaultExpAcc);
        journalLines.push({
          accountId: lineCreditAccId,
          debit: 0,
          credit: line.lineTotal,
          description: `Credit Note Line: ${line.description}`
        });
      }

      // Credit: Adjust VAT Input Recoverable (#2150) if tax was refunded
      if (creditNote.taxAmount.gt(0)) {
        journalLines.push({
          accountId: defaultVatAcc!.id,
          debit: 0,
          credit: creditNote.taxAmount,
          description: `VAT Input Adjustment on Credit Note ${creditNote.creditNoteNumber}`
        });
      }

      const idempotencyKey = `${ctx.branchId}:AP_CRN:${creditNote.id}:POST`;

      const { journal } = await GLEngineDAO.postJournalEntry(
        ctx,
        {
          journalType: JournalType.AP_CREDIT_NOTE,
          entryDate: creditNote.creditNoteDate,
          description: `Supplier Credit Note: ${creditNote.supplier.name} (${creditNote.creditNoteNumber})`,
          referenceType: "SUPPLIER_CREDIT_NOTE",
          referenceId: creditNote.id,
          idempotencyKey,
          bypassControlAccountValidation: true,
          lines: journalLines
        },
        tx
      );

      const approved = await tx.supplierCreditNote.update({
        where: { id: creditNote.id },
        data: {
          status: SupplierCreditNoteStatus.POSTED,
          approvedById: ctx.userId,
          approvedAt: new Date(),
          journalEntryId: journal.id
        }
      });

      // Sync Authoritative Supplier Subledger Balance Cache
      await SupplierDAO.syncSupplierBalance(tx, ctx, creditNote.supplierId);

      await AuditService.log(
        ctx,
        "APPROVE_SUPPLIER_CREDIT_NOTE",
        "SupplierCreditNote",
        creditNote.id,
        JSON.stringify({ creditNoteNumber: creditNote.creditNoteNumber, journalId: journal.id })
      );

      return approved;
    });
  }

  /**
   * 3. Allocate Credit Note to an Outstanding Supplier Invoice
   */
  static async allocateCreditNote(
    ctx: TenantContext,
    creditNoteId: string,
    invoiceId: string,
    amountToApply?: number | string | Prisma.Decimal
  ) {
    return await db.$transaction(async (tx) => {
      const creditNote = await tx.supplierCreditNote.findFirst({
        where: { id: creditNoteId, branchId: ctx.branchId }
      });
      if (!creditNote) throw new Error("Credit note not found.");

      if (creditNote.status !== SupplierCreditNoteStatus.POSTED && creditNote.status !== SupplierCreditNoteStatus.APPROVED) {
        throw new Error(`Cannot allocate credit note in status ${creditNote.status}.`);
      }

      if (creditNote.unallocatedAmount.lte(0)) {
        throw new Error("Credit note is already fully allocated.");
      }

      const invoice = await tx.supplierInvoice.findFirst({
        where: { id: invoiceId, branchId: ctx.branchId, supplierId: creditNote.supplierId }
      });
      if (!invoice) throw new Error("Supplier invoice not found or does not belong to this vendor.");

      if (invoice.status !== SupplierInvoiceStatus.APPROVED && invoice.status !== SupplierInvoiceStatus.PARTIALLY_PAID) {
        throw new Error(`Cannot apply credit note to invoice in status ${invoice.status}.`);
      }

      const requestedAmt = amountToApply ? new Prisma.Decimal(amountToApply) : creditNote.unallocatedAmount;
      if (requestedAmt.lte(0)) throw new Error("Allocation amount must be positive.");

      // Amount to allocate is min(requested, unallocatedCredit, invoiceOutstanding)
      const allocAmt = Prisma.Decimal.min(requestedAmt, creditNote.unallocatedAmount, invoice.amountOutstanding);
      if (allocAmt.lte(0)) throw new Error("No qualifying amount to allocate.");

      const newInvoicePaid = new Prisma.Decimal(invoice.amountPaid).add(allocAmt);
      const newInvoiceOutstanding = new Prisma.Decimal(invoice.amountOutstanding).sub(allocAmt);
      const newCreditUnallocated = new Prisma.Decimal(creditNote.unallocatedAmount).sub(allocAmt);

      const nextInvoiceStatus = newInvoiceOutstanding.isZero()
        ? SupplierInvoiceStatus.PAID
        : SupplierInvoiceStatus.PARTIALLY_PAID;

      const nextCreditStatus = newCreditUnallocated.isZero()
        ? SupplierCreditNoteStatus.ALLOCATED
        : SupplierCreditNoteStatus.POSTED;

      await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newInvoicePaid,
          amountOutstanding: newInvoiceOutstanding,
          status: nextInvoiceStatus
        }
      });

      const updatedCreditNote = await tx.supplierCreditNote.update({
        where: { id: creditNote.id },
        data: {
          unallocatedAmount: newCreditUnallocated,
          status: nextCreditStatus
        }
      });

      // Sync Authoritative Supplier Subledger Balance Cache
      await SupplierDAO.syncSupplierBalance(tx, ctx, creditNote.supplierId);

      await AuditService.log(
        ctx,
        "ALLOCATE_SUPPLIER_CREDIT_NOTE",
        "SupplierCreditNote",
        creditNote.id,
        JSON.stringify({ invoiceId: invoice.id, allocated: allocAmt.toString(), remaining: newCreditUnallocated.toString() })
      );

      return updatedCreditNote;
    });
  }

  /**
   * 4. Get Credit Note
   */
  static async getCreditNote(ctx: TenantContext, id: string) {
    const crn = await db.supplierCreditNote.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        supplier: true,
        originalInvoice: true,
        fiscalPeriod: true,
        lines: { include: { item: true, glAccount: true } }
      }
    });
    if (!crn) throw new Error("Credit note not found.");
    return crn;
  }

  /**
   * 5. List Credit Notes
   */
  static async listCreditNotes(
    ctx: TenantContext,
    filters?: {
      supplierId?: string;
      status?: SupplierCreditNoteStatus;
      search?: string;
    }
  ) {
    const where: Prisma.SupplierCreditNoteWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              { creditNoteNumber: { contains: filters.search, mode: "insensitive" } },
              { vendorCreditNoteRef: { contains: filters.search, mode: "insensitive" } },
              { supplier: { name: { contains: filters.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    return await db.supplierCreditNote.findMany({
      where,
      include: {
        supplier: true,
        fiscalPeriod: true
      },
      orderBy: { creditNoteDate: "desc" }
    });
  }
}
