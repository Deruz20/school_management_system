import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  SupplierInvoiceStatus,
  SupplierCreditNoteStatus,
  SupplierPaymentStatus,
  StatementMatchStatus
} from "@prisma/client";

export class APReportsDAO {
  /**
   * 1. Authoritative Supplier Aged Payables Report (0-30, 31-60, 61-90, 90+ days)
   */
  static async getAgedPayablesReport(
    ctx: TenantContext,
    asOfDateInput?: Date | string
  ) {
    const asOfDate = asOfDateInput ? new Date(asOfDateInput) : new Date();

    const openInvoices = await db.supplierInvoice.findMany({
      where: {
        branchId: ctx.branchId,
        status: { in: [SupplierInvoiceStatus.APPROVED, SupplierInvoiceStatus.PARTIALLY_PAID] },
        amountOutstanding: { gt: 0 }
      },
      include: {
        supplier: true
      },
      orderBy: { dueDate: "asc" }
    });

    const supplierAgingMap = new Map<string, {
      supplierId: string;
      supplierCode: string;
      supplierName: string;
      current: Prisma.Decimal;
      days31to60: Prisma.Decimal;
      days61to90: Prisma.Decimal;
      days90Plus: Prisma.Decimal;
      totalOutstanding: Prisma.Decimal;
    }>();

    let grandCurrent = new Prisma.Decimal(0);
    let grand31to60 = new Prisma.Decimal(0);
    let grand61to90 = new Prisma.Decimal(0);
    let grand90Plus = new Prisma.Decimal(0);
    let grandTotal = new Prisma.Decimal(0);

    for (const inv of openInvoices) {
      const outstanding = new Prisma.Decimal(inv.amountOutstanding);
      const diffMs = asOfDate.getTime() - new Date(inv.dueDate).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const existing = supplierAgingMap.get(inv.supplierId) || {
        supplierId: inv.supplierId,
        supplierCode: inv.supplier.supplierCode,
        supplierName: inv.supplier.name,
        current: new Prisma.Decimal(0),
        days31to60: new Prisma.Decimal(0),
        days61to90: new Prisma.Decimal(0),
        days90Plus: new Prisma.Decimal(0),
        totalOutstanding: new Prisma.Decimal(0)
      };

      if (diffDays <= 30) {
        existing.current = existing.current.add(outstanding);
        grandCurrent = grandCurrent.add(outstanding);
      } else if (diffDays <= 60) {
        existing.days31to60 = existing.days31to60.add(outstanding);
        grand31to60 = grand31to60.add(outstanding);
      } else if (diffDays <= 90) {
        existing.days61to90 = existing.days61to90.add(outstanding);
        grand61to90 = grand61to90.add(outstanding);
      } else {
        existing.days90Plus = existing.days90Plus.add(outstanding);
        grand90Plus = grand90Plus.add(outstanding);
      }

      existing.totalOutstanding = existing.totalOutstanding.add(outstanding);
      grandTotal = grandTotal.add(outstanding);
      supplierAgingMap.set(inv.supplierId, existing);
    }

    return {
      asOfDate,
      summary: {
        current: grandCurrent,
        days31to60: grand31to60,
        days61to90: grand61to90,
        days90Plus: grand90Plus,
        grandTotal
      },
      vendors: Array.from(supplierAgingMap.values())
    };
  }

  /**
   * 2. Goods Received Not Invoiced (GRNI) Accrual Schedule
   */
  static async getGRNIAccrualSchedule(ctx: TenantContext) {
    const grnItems = await db.goodsReceivedItem.findMany({
      where: {
        grn: {
          branchId: ctx.branchId,
          isVoided: false
        },
        uninvoicedQuantity: { gt: 0 }
      },
      include: {
        grn: {
          include: { supplier: true, store: true }
        },
        item: true
      },
      orderBy: { grn: { deliveryDate: "asc" } }
    });

    let totalAccrualAmount = new Prisma.Decimal(0);
    const scheduleLines = [];

    for (const item of grnItems) {
      const uninvoicedQty = new Prisma.Decimal(item.uninvoicedQuantity);
      const unitCost = new Prisma.Decimal(item.unitCostPrice);
      const uninvoicedCost = uninvoicedQty.mul(unitCost);

      totalAccrualAmount = totalAccrualAmount.add(uninvoicedCost);

      scheduleLines.push({
        grnItemId: item.id,
        grnNumber: item.grn.grnNumber,
        deliveryDate: item.grn.deliveryDate,
        supplierName: item.grn.supplier.name,
        storeName: item.grn.store.name,
        itemName: item.item.name,
        quantityReceived: item.quantityReceived,
        invoicedQuantity: item.invoicedQuantity,
        uninvoicedQuantity: item.uninvoicedQuantity,
        unitCostPrice: item.unitCostPrice,
        uninvoicedCost
      });
    }

    return {
      asOfDate: new Date(),
      totalAccrualAmount,
      linesCount: scheduleLines.length,
      lines: scheduleLines
    };
  }

  /**
   * 3. Supplier Statement / Vendor Account Ledger
   */
  static async getSupplierStatement(
    ctx: TenantContext,
    supplierId: string,
    startDateInput?: Date | string,
    endDateInput?: Date | string
  ) {
    const startDate = startDateInput ? new Date(startDateInput) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = endDateInput ? new Date(endDateInput) : new Date();

    const supplier = await db.inventorySupplier.findFirst({
      where: { id: supplierId, branchId: ctx.branchId }
    });
    if (!supplier) throw new Error("Supplier not found.");

    // 1. Calculate Opening Balance before startDate
    const priorInvoices = await db.supplierInvoice.findMany({
      where: {
        branchId: ctx.branchId,
        supplierId: supplier.id,
        status: { in: [SupplierInvoiceStatus.APPROVED, SupplierInvoiceStatus.PARTIALLY_PAID, SupplierInvoiceStatus.PAID] },
        invoiceDate: { lt: startDate }
      }
    });
    const priorCreditNotes = await db.supplierCreditNote.findMany({
      where: {
        branchId: ctx.branchId,
        supplierId: supplier.id,
        status: { in: [SupplierCreditNoteStatus.APPROVED, SupplierCreditNoteStatus.POSTED, SupplierCreditNoteStatus.ALLOCATED] },
        creditNoteDate: { lt: startDate }
      }
    });
    const priorPayments = await db.supplierPayment.findMany({
      where: {
        branchId: ctx.branchId,
        supplierId: supplier.id,
        status: SupplierPaymentStatus.COMPLETED,
        paymentDate: { lt: startDate }
      }
    });

    let openingBalance = new Prisma.Decimal(0);
    for (const inv of priorInvoices) openingBalance = openingBalance.add(inv.netPayableAmount);
    for (const crn of priorCreditNotes) openingBalance = openingBalance.sub(crn.netCreditAmount);
    for (const pay of priorPayments) openingBalance = openingBalance.sub(pay.totalAmountPaid);

    // 2. Fetch Transactions within Date Range
    const periodInvoices = await db.supplierInvoice.findMany({
      where: {
        branchId: ctx.branchId,
        supplierId: supplier.id,
        status: { in: [SupplierInvoiceStatus.APPROVED, SupplierInvoiceStatus.PARTIALLY_PAID, SupplierInvoiceStatus.PAID] },
        invoiceDate: { gte: startDate, lte: endDate }
      }
    });
    const periodCreditNotes = await db.supplierCreditNote.findMany({
      where: {
        branchId: ctx.branchId,
        supplierId: supplier.id,
        status: { in: [SupplierCreditNoteStatus.APPROVED, SupplierCreditNoteStatus.POSTED, SupplierCreditNoteStatus.ALLOCATED] },
        creditNoteDate: { gte: startDate, lte: endDate }
      }
    });
    const periodPayments = await db.supplierPayment.findMany({
      where: {
        branchId: ctx.branchId,
        supplierId: supplier.id,
        status: SupplierPaymentStatus.COMPLETED,
        paymentDate: { gte: startDate, lte: endDate }
      }
    });

    // 3. Build Unified Chronological Ledger Entries
    const entries: Array<{
      date: Date;
      type: "INVOICE" | "CREDIT_NOTE" | "PAYMENT";
      referenceNumber: string;
      description: string;
      debitAmount: Prisma.Decimal;
      creditAmount: Prisma.Decimal;
      runningBalance: Prisma.Decimal;
    }> = [];

    for (const inv of periodInvoices) {
      entries.push({
        date: inv.invoiceDate,
        type: "INVOICE",
        referenceNumber: inv.invoiceNumber,
        description: `Vendor Bill: ${inv.vendorInvoiceNumber}`,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: inv.netPayableAmount,
        runningBalance: new Prisma.Decimal(0)
      });
    }

    for (const crn of periodCreditNotes) {
      entries.push({
        date: crn.creditNoteDate,
        type: "CREDIT_NOTE",
        referenceNumber: crn.creditNoteNumber,
        description: `Credit Note: ${crn.reason}`,
        debitAmount: crn.netCreditAmount,
        creditAmount: new Prisma.Decimal(0),
        runningBalance: new Prisma.Decimal(0)
      });
    }

    for (const pay of periodPayments) {
      entries.push({
        date: pay.paymentDate,
        type: "PAYMENT",
        referenceNumber: pay.paymentNumber,
        description: `Payment Payout: ${pay.referenceNumber || pay.paymentMethod}`,
        debitAmount: pay.totalAmountPaid,
        creditAmount: new Prisma.Decimal(0),
        runningBalance: new Prisma.Decimal(0)
      });
    }

    // Sort chronologically
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = openingBalance;
    for (const e of entries) {
      // Normal Credit Balance: Credit adds to liability, Debit reduces liability
      running = running.add(e.creditAmount).sub(e.debitAmount);
      e.runningBalance = running;
    }

    return {
      supplier: {
        id: supplier.id,
        code: supplier.supplierCode,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email
      },
      startDate,
      endDate,
      openingBalance,
      closingBalance: running,
      entries
    };
  }

  /**
   * 4. External Vendor Statement Importer & Matcher
   */
  static async importAndMatchStatement(
    ctx: TenantContext,
    supplierId: string,
    statementData: {
      statementDate: Date | string;
      statementRef?: string;
      openingBalance: number | string | Prisma.Decimal;
      closingBalance: number | string | Prisma.Decimal;
      lines: Array<{
        transactionDate: Date | string;
        referenceNumber: string;
        description?: string;
        debitAmount: number | string | Prisma.Decimal;
        creditAmount: number | string | Prisma.Decimal;
        balance: number | string | Prisma.Decimal;
      }>;
    }
  ) {
    return await db.$transaction(async (tx) => {
      const supplier = await tx.inventorySupplier.findFirst({
        where: { id: supplierId, branchId: ctx.branchId }
      });
      if (!supplier) throw new Error("Supplier not found.");

      const stmt = await tx.supplierStatementImport.create({
        data: {
          branchId: ctx.branchId,
          supplierId: supplier.id,
          statementDate: new Date(statementData.statementDate),
          statementRef: statementData.statementRef?.trim() || null,
          openingBalance: new Prisma.Decimal(statementData.openingBalance),
          closingBalance: new Prisma.Decimal(statementData.closingBalance),
          importedById: ctx.userId
        }
      });

      for (const line of statementData.lines) {
        const debit = new Prisma.Decimal(line.debitAmount || 0);
        const credit = new Prisma.Decimal(line.creditAmount || 0);
        const ref = line.referenceNumber.trim();

        // Match against existing invoices or payments
        let matchStatus: StatementMatchStatus = StatementMatchStatus.UNMATCHED;
        let matchedInvoiceId: string | null = null;
        let matchedPaymentId: string | null = null;

        if (credit.gt(0)) {
          // Vendor billed us -> matches our SupplierInvoice (credit)
          const matchedInv = await tx.supplierInvoice.findFirst({
            where: {
              branchId: ctx.branchId,
              supplierId: supplier.id,
              OR: [
                { vendorInvoiceNumber: { equals: ref, mode: "insensitive" } },
                { invoiceNumber: { equals: ref, mode: "insensitive" } }
              ]
            }
          });
          if (matchedInv) {
            matchedInvoiceId = matchedInv.id;
            matchStatus = matchedInv.netPayableAmount.equals(credit)
              ? StatementMatchStatus.EXACT_MATCH
              : StatementMatchStatus.VARIANCE_REVIEW;
          }
        } else if (debit.gt(0)) {
          // Vendor received payment -> matches our SupplierPayment (debit)
          const matchedPay = await tx.supplierPayment.findFirst({
            where: {
              branchId: ctx.branchId,
              supplierId: supplier.id,
              OR: [
                { paymentNumber: { equals: ref, mode: "insensitive" } },
                { referenceNumber: { equals: ref, mode: "insensitive" } }
              ]
            }
          });
          if (matchedPay) {
            matchedPaymentId = matchedPay.id;
            matchStatus = matchedPay.totalAmountPaid.equals(debit)
              ? StatementMatchStatus.EXACT_MATCH
              : StatementMatchStatus.VARIANCE_REVIEW;
          }
        }

        await tx.supplierStatementLine.create({
          data: {
            statementImportId: stmt.id,
            branchId: ctx.branchId,
            transactionDate: new Date(line.transactionDate),
            referenceNumber: ref,
            description: line.description?.trim() || null,
            debitAmount: debit,
            creditAmount: credit,
            balance: new Prisma.Decimal(line.balance),
            matchStatus,
            matchedInvoiceId,
            matchedPaymentId
          }
        });
      }

      return stmt;
    });
  }

  /**
   * 5. AP Subledger vs GL Control #2110 & GRNI #2120 Zero-Drift Telemetry Engine
   */
  static async reconcileAPSubledger(ctx: TenantContext) {
    // 1. Calculate Active AP Subledger Total
    const allSuppliers = await db.inventorySupplier.findMany({
      where: { branchId: ctx.branchId }
    });

    let subledgerTotalAP = new Prisma.Decimal(0);
    for (const s of allSuppliers) {
      subledgerTotalAP = subledgerTotalAP.add(s.currentBalanceUGX);
    }

    // 2. Calculate Active GRNI Subledger Total
    const grniSchedule = await this.getGRNIAccrualSchedule(ctx);
    const subledgerTotalGRNI = grniSchedule.totalAccrualAmount;

    // 3. Fetch General Ledger Posted Balances for #2110 and #2120
    const apAccount = await db.gLAccount.findFirst({
      where: { branchId: ctx.branchId, code: "2110" },
      include: {
        journalLines: {
          where: { journalEntry: { status: "POSTED" } }
        }
      }
    });

    const grniAccount = await db.gLAccount.findFirst({
      where: { branchId: ctx.branchId, code: "2120" },
      include: {
        journalLines: {
          where: { journalEntry: { status: "POSTED" } }
        }
      }
    });

    let glBalance2110 = new Prisma.Decimal(0);
    if (apAccount) {
      let debitSum = new Prisma.Decimal(0);
      let creditSum = new Prisma.Decimal(0);
      for (const jl of apAccount.journalLines) {
        debitSum = debitSum.add(jl.debit);
        creditSum = creditSum.add(jl.credit);
      }
      // Normal Credit liability account: Balance = Credit - Debit
      glBalance2110 = creditSum.sub(debitSum);
    }

    let glBalance2120 = new Prisma.Decimal(0);
    if (grniAccount) {
      let debitSum = new Prisma.Decimal(0);
      let creditSum = new Prisma.Decimal(0);
      for (const jl of grniAccount.journalLines) {
        debitSum = debitSum.add(jl.debit);
        creditSum = creditSum.add(jl.credit);
      }
      // Normal Credit liability account: Balance = Credit - Debit
      glBalance2120 = creditSum.sub(debitSum);
    }

    const varianceAP = subledgerTotalAP.sub(glBalance2110);
    const varianceGRNI = subledgerTotalGRNI.sub(glBalance2120);

    const isReconciled = varianceAP.isZero() && varianceGRNI.isZero();

    return {
      isReconciled,
      asOfDate: new Date(),
      apControl: {
        subledgerTotalAP,
        glBalance2110,
        varianceAP,
        isReconciled: varianceAP.isZero()
      },
      grniControl: {
        subledgerTotalGRNI,
        glBalance2120,
        varianceGRNI,
        isReconciled: varianceGRNI.isZero()
      }
    };
  }
}
