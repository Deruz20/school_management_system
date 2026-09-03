import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  SupplierInvoiceStatus,
  ThreeWayMatchStatus,
  SupplyCategory,
  JournalType,
  PeriodStatus
} from "@prisma/client";
import { AuditService } from "@/lib/services/audit.service";
import { GLEngineDAO, GLAccountDAO } from "@/lib/dao/gl.dao";
import { SupplierDAO, SupplierSequenceDAO } from "@/lib/dao/supplier.dao";
import { TaxPolicyEngine } from "@/lib/dao/tax-policy.engine";

export interface InvoiceLineInput {
  poItemId?: string;
  grnItemId?: string;
  itemId?: string;
  expenseCategoryId?: string;
  description: string;
  quantityInvoiced: number | string | Prisma.Decimal;
  unitPriceInvoiced: number | string | Prisma.Decimal;
  taxRate?: number | string | Prisma.Decimal;
  glAccountId?: string;
}

export interface CreateInvoiceInput {
  vendorInvoiceNumber: string;
  supplierId: string;
  poId?: string;
  grnId?: string;
  fiscalPeriodId: string;
  invoiceDate: Date | string;
  dueDate: Date | string;
  supplyCategory?: SupplyCategory;
  discountAmount?: number | string | Prisma.Decimal;
  efrisFiscalDocNumber?: string;
  efrisVerificationCode?: string;
  isOpeningBalance?: boolean;
  notes?: string;
  lines: InvoiceLineInput[];
}

export class SupplierInvoiceDAO {
  /**
   * 1. Create Draft Supplier Invoice & Evaluate 3-Way Match
   */
  static async createInvoice(
    ctx: TenantContext,
    input: CreateInvoiceInput
  ) {
    if (!input.vendorInvoiceNumber || !input.vendorInvoiceNumber.trim()) {
      throw new Error("Vendor external invoice number is required.");
    }
    if (!input.lines || input.lines.length === 0) {
      throw new Error("Supplier invoice must contain at least one line item.");
    }

    return await db.$transaction(async (tx) => {
      // 1. Verify Supplier
      const supplier = await tx.inventorySupplier.findFirst({
        where: { id: input.supplierId, branchId: ctx.branchId }
      });
      if (!supplier) throw new Error("Supplier not found in this branch.");

      // Check unique vendor invoice number per supplier in branch
      const dupVendorInvoice = await tx.supplierInvoice.findUnique({
        where: {
          branchId_supplierId_vendorInvoiceNumber: {
            branchId: ctx.branchId,
            supplierId: supplier.id,
            vendorInvoiceNumber: input.vendorInvoiceNumber.trim()
          }
        }
      });
      if (dupVendorInvoice) {
        throw new Error(`Invoice with number "${input.vendorInvoiceNumber.trim()}" already exists for supplier ${supplier.name}.`);
      }

      // 2. Verify Fiscal Period
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: input.fiscalPeriodId, branchId: ctx.branchId }
      });
      if (!period) throw new Error("Fiscal period not found in this branch.");
      if (period.status !== PeriodStatus.OPEN) {
        throw new Error(`Cannot record invoice in a ${period.status} fiscal period.`);
      }

      const invoiceDate = new Date(input.invoiceDate);
      const dueDate = new Date(input.dueDate);
      const supplyCategory = input.supplyCategory || SupplyCategory.GOODS;

      let totalGross = new Prisma.Decimal(0);
      let totalPPV = new Prisma.Decimal(0);
      let matchStatus: ThreeWayMatchStatus = ThreeWayMatchStatus.PERFECT_MATCH;

      const linesToCreate: Array<{
        branchId: string;
        poItemId?: string;
        grnItemId?: string;
        itemId?: string;
        expenseCategoryId?: string;
        description: string;
        quantityInvoiced: Prisma.Decimal;
        unitPriceInvoiced: Prisma.Decimal;
        unitCostSnapshot: Prisma.Decimal;
        lineTotalCost: Prisma.Decimal;
        ppvAmount: Prisma.Decimal;
        taxRate: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        glAccountId?: string;
      }> = [];

      for (const line of input.lines) {
        const qty = new Prisma.Decimal(line.quantityInvoiced);
        const price = new Prisma.Decimal(line.unitPriceInvoiced);

        if (qty.lte(0) || price.lt(0)) {
          throw new Error("Line quantity must be positive and unit price cannot be negative.");
        }

        const lineTotal = qty.mul(price);
        totalGross = totalGross.add(lineTotal);

        let unitCostSnapshot = price;
        let linePPV = new Prisma.Decimal(0);

        // 3-Way Match Logic if matching against GRN Item
        if (line.grnItemId) {
          const grnItem = await tx.goodsReceivedItem.findFirst({
            where: { id: line.grnItemId }
          });
          if (!grnItem) throw new Error(`GRN item ${line.grnItemId} not found.`);

          unitCostSnapshot = new Prisma.Decimal(grnItem.unitCostPrice);
          const availableQty = new Prisma.Decimal(grnItem.uninvoicedQuantity);

          if (qty.gt(availableQty)) {
            matchStatus = ThreeWayMatchStatus.QUANTITY_VARIANCE_FAIL;
            throw new Error(`Invoiced quantity (${qty}) exceeds available uninvoiced GRN quantity (${availableQty}) for item snapshot "${grnItem.itemNameSnapshot}".`);
          }

          // Compute PPV = Qty * (Invoiced Price - GRN Receiving Unit Cost)
          linePPV = qty.mul(price.sub(unitCostSnapshot));
          totalPPV = totalPPV.add(linePPV);

          if (!linePPV.isZero()) {
            const variancePercent = price.sub(unitCostSnapshot).div(unitCostSnapshot).mul(100).abs();
            if (variancePercent.lte(0.5)) {
              if (matchStatus === ThreeWayMatchStatus.PERFECT_MATCH) {
                matchStatus = ThreeWayMatchStatus.PRICE_VARIANCE_PASS;
              }
            } else if (variancePercent.lte(5.0)) {
              matchStatus = ThreeWayMatchStatus.PRICE_VARIANCE_PASS;
            } else {
              matchStatus = ThreeWayMatchStatus.PRICE_VARIANCE_FAIL;
            }
          }
        }

        linesToCreate.push({
          branchId: ctx.branchId,
          poItemId: line.poItemId,
          grnItemId: line.grnItemId,
          itemId: line.itemId,
          expenseCategoryId: line.expenseCategoryId,
          description: line.description.trim(),
          quantityInvoiced: qty,
          unitPriceInvoiced: price,
          unitCostSnapshot,
          lineTotalCost: lineTotal,
          ppvAmount: linePPV,
          taxRate: new Prisma.Decimal(line.taxRate || 0),
          taxAmount: new Prisma.Decimal(0), // Will evaluate tax
          glAccountId: line.glAccountId
        });
      }

      // Evaluate Tax Policy
      const taxEval = await TaxPolicyEngine.evaluateTax(tx, {
        branchId: ctx.branchId,
        supplyCategory,
        transactionDate: invoiceDate,
        grossAmount: totalGross,
        isSupplierWhtExempt: supplier.whtExempt,
        whtExemptionExpiry: supplier.whtExemptionExpiry,
        isSupplierVatRegistered: supplier.vatRegistered,
        hasEfrisInvoice: !!input.efrisFiscalDocNumber
      });

      const discountAmt = new Prisma.Decimal(input.discountAmount || 0);
      const taxAmt = taxEval.vatAmount;
      const netPayable = totalGross.sub(discountAmt).add(taxAmt);

      const invoiceNumber = await SupplierSequenceDAO.nextSequence(ctx, "PINV", tx);

      const isDisputed = matchStatus === ThreeWayMatchStatus.PRICE_VARIANCE_FAIL;
      const status = isDisputed ? SupplierInvoiceStatus.ON_HOLD : SupplierInvoiceStatus.MATCHED;

      const invoice = await tx.supplierInvoice.create({
        data: {
          branchId: ctx.branchId,
          invoiceNumber,
          vendorInvoiceNumber: input.vendorInvoiceNumber.trim(),
          supplierId: supplier.id,
          poId: input.poId || null,
          grnId: input.grnId || null,
          fiscalPeriodId: period.id,
          invoiceDate,
          dueDate,
          supplyCategory,
          grossAmount: totalGross,
          taxAmount: taxAmt,
          discountAmount: discountAmt,
          netPayableAmount: netPayable,
          amountPaid: new Prisma.Decimal(0),
          amountOutstanding: netPayable,
          ppvAmount: totalPPV,
          status,
          matchStatus,
          holdReason: isDisputed ? "Price or Quantity variance exceeded allowable tolerance." : null,
          efrisFiscalDocNumber: input.efrisFiscalDocNumber?.trim() || null,
          efrisVerificationCode: input.efrisVerificationCode?.trim() || null,
          isOpeningBalance: input.isOpeningBalance || false,
          notes: input.notes?.trim() || null,
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
        "CREATE_SUPPLIER_INVOICE",
        "SupplierInvoice",
        invoice.id,
        JSON.stringify({ invoiceNumber: invoice.invoiceNumber, gross: totalGross.toString(), net: netPayable.toString(), status })
      );

      return invoice;
    });
  }

  /**
   * 2. Four-Eye Approval & Double-Entry General Ledger Posting
   */
  static async approveInvoice(
    ctx: TenantContext,
    invoiceId: string
  ) {
    return await db.$transaction(async (tx) => {
      const invoice = await tx.supplierInvoice.findFirst({
        where: { id: invoiceId, branchId: ctx.branchId },
        include: {
          lines: {
            include: {
              grnItem: true,
              expenseCategory: true
            }
          },
          supplier: true,
          fiscalPeriod: true
        }
      });
      if (!invoice) throw new Error("Supplier invoice not found.");

      if (invoice.status !== SupplierInvoiceStatus.MATCHED && invoice.status !== SupplierInvoiceStatus.DRAFT) {
        throw new Error(`Cannot approve invoice with status ${invoice.status}.`);
      }

      if (invoice.fiscalPeriod.status !== PeriodStatus.OPEN) {
        throw new Error(`Cannot approve invoice in a ${invoice.fiscalPeriod.status} fiscal period.`);
      }

      // Maker-Checker constraint
      if (invoice.createdById === ctx.userId) {
        throw new Error("Four-Eye Policy: The maker who created this invoice cannot self-approve it.");
      }

      // 1. Mutate GoodsReceivedItem uninvoiced quantities
      for (const line of invoice.lines) {
        if (line.grnItemId) {
          const grnItem = await tx.goodsReceivedItem.findUnique({
            where: { id: line.grnItemId }
          });
          if (grnItem) {
            const newInvoiced = new Prisma.Decimal(grnItem.invoicedQuantity).add(line.quantityInvoiced);
            const newUninvoiced = new Prisma.Decimal(grnItem.uninvoicedQuantity).sub(line.quantityInvoiced);

            if (newUninvoiced.isNegative()) {
              throw new Error(`Approval blocked: Invoiced quantity exceeds available GRN uninvoiced quantity for line ${line.description}.`);
            }

            await tx.goodsReceivedItem.update({
              where: { id: grnItem.id },
              data: {
                invoicedQuantity: newInvoiced,
                uninvoicedQuantity: newUninvoiced
              }
            });
          }
        }
      }

      // 2. Build GL Journal Lines
      const defaultApAcc = (await GLAccountDAO.getAccountByCode(ctx, "2110", tx))!.id;
      const defaultGrnAcc = (await GLAccountDAO.getAccountByCode(ctx, "2120", tx))!.id;
      const defaultPpvAcc = (await GLAccountDAO.getAccountByCode(ctx, "5900", tx)) || (await GLAccountDAO.getAccountByCode(ctx, "5100", tx));
      const defaultVatAcc = (await GLAccountDAO.getAccountByCode(ctx, "2150", tx)) || (await GLAccountDAO.getAccountByCode(ctx, "1220", tx));
      const defaultEquityAcc = (await GLAccountDAO.getAccountByCode(ctx, "3500", tx))!.id;

      const journalLines: Array<{ accountId: string; debit: Prisma.Decimal | number; credit: Prisma.Decimal | number; description: string }> = [];

      if (invoice.isOpeningBalance) {
        // Historical Opening AP Bootstrap: Dr. Opening Equity (#3500) / Cr. AP (#2110)
        journalLines.push({
          accountId: defaultEquityAcc,
          debit: invoice.netPayableAmount,
          credit: 0,
          description: `Opening AP Bootstrap: ${invoice.supplier.name} (${invoice.vendorInvoiceNumber})`
        });
        journalLines.push({
          accountId: defaultApAcc,
          debit: 0,
          credit: invoice.netPayableAmount,
          description: `Opening Trade Payable: ${invoice.supplier.name}`
        });
      } else {
        let totalGrniCleared = new Prisma.Decimal(0);
        let totalPpvDebit = new Prisma.Decimal(0);
        let totalPpvCredit = new Prisma.Decimal(0);

        for (const line of invoice.lines) {
          if (line.grnItemId) {
            // GRNI clearing line at original unit cost snapshot
            const grniCost = line.quantityInvoiced.mul(line.unitCostSnapshot);
            totalGrniCleared = totalGrniCleared.add(grniCost);

            // PPV line
            if (line.ppvAmount.gt(0)) {
              totalPpvDebit = totalPpvDebit.add(line.ppvAmount);
            } else if (line.ppvAmount.lt(0)) {
              totalPpvCredit = totalPpvCredit.add(line.ppvAmount.abs());
            }
          } else {
            // Direct Expense Line: Debit Expense Category GL Account
            const expAccId = line.expenseCategory?.glAccountId || line.glAccountId || (await GLAccountDAO.getAccountByCode(ctx, "6200", tx))!.id;
            journalLines.push({
              accountId: expAccId,
              debit: line.lineTotalCost,
              credit: 0,
              description: `Direct Service/Expense Bill: ${line.description}`
            });
          }
        }

        // Debit: Accrued Goods Received (#2120)
        if (totalGrniCleared.gt(0)) {
          journalLines.push({
            accountId: defaultGrnAcc,
            debit: totalGrniCleared,
            credit: 0,
            description: `Clear GRNI Accrual for Invoice ${invoice.invoiceNumber}`
          });
        }

        // Debit / Credit: Purchase Price Variance (#5900)
        if (totalPpvDebit.gt(0)) {
          journalLines.push({
            accountId: defaultPpvAcc!.id,
            debit: totalPpvDebit,
            credit: 0,
            description: `Unfavorable PPV on Invoice ${invoice.invoiceNumber}`
          });
        }
        if (totalPpvCredit.gt(0)) {
          journalLines.push({
            accountId: defaultPpvAcc!.id,
            debit: 0,
            credit: totalPpvCredit,
            description: `Favorable PPV Discount on Invoice ${invoice.invoiceNumber}`
          });
        }

        // Debit: VAT Input Recoverable (#2150) if tax applies
        if (invoice.taxAmount.gt(0)) {
          journalLines.push({
            accountId: defaultVatAcc!.id,
            debit: invoice.taxAmount,
            credit: 0,
            description: `Input VAT on Invoice ${invoice.invoiceNumber}`
          });
        }

        // Credit: Accounts Payable - Suppliers (#2110) for Net Payable
        journalLines.push({
          accountId: defaultApAcc,
          debit: 0,
          credit: invoice.netPayableAmount,
          description: `Trade AP Liability: ${invoice.supplier.name} (${invoice.invoiceNumber})`
        });
      }

      // 3. Post Balanced Journal Entry
      const idempotencyKey = `${ctx.branchId}:AP_INV:${invoice.id}:POST`;

      const { journal } = await GLEngineDAO.postJournalEntry(
        ctx,
        {
          journalType: JournalType.AP_INVOICE_BILLING,
          entryDate: invoice.invoiceDate,
          description: `Supplier Invoice Billing: ${invoice.supplier.name} (${invoice.invoiceNumber})`,
          referenceType: "SUPPLIER_INVOICE",
          referenceId: invoice.id,
          idempotencyKey,
          bypassControlAccountValidation: true,
          lines: journalLines
        },
        tx
      );

      // 4. Update Invoice Status
      const approved = await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: {
          status: SupplierInvoiceStatus.APPROVED,
          approvedById: ctx.userId,
          approvedAt: new Date(),
          journalEntryId: journal.id
        }
      });

      // 5. Sync Authoritative Supplier Subledger Balance Cache
      await SupplierDAO.syncSupplierBalance(tx, ctx, invoice.supplierId);

      await AuditService.log(
        ctx,
        "APPROVE_SUPPLIER_INVOICE",
        "SupplierInvoice",
        invoice.id,
        JSON.stringify({ invoiceNumber: invoice.invoiceNumber, journalId: journal.id })
      );

      return approved;
    });
  }

  /**
   * 3. Dispute or Put Invoice On Hold
   */
  static async setHoldStatus(
    ctx: TenantContext,
    invoiceId: string,
    holdReason: string,
    isDisputed = false
  ) {
    if (!holdReason || !holdReason.trim()) throw new Error("Hold reason is mandatory.");

    return await db.$transaction(async (tx) => {
      const invoice = await tx.supplierInvoice.findFirst({
        where: { id: invoiceId, branchId: ctx.branchId }
      });
      if (!invoice) throw new Error("Supplier invoice not found.");

      if (invoice.status === SupplierInvoiceStatus.PAID || invoice.status === SupplierInvoiceStatus.VOIDED) {
        throw new Error(`Cannot place a ${invoice.status} invoice on hold.`);
      }

      const status = isDisputed ? SupplierInvoiceStatus.DISPUTED : SupplierInvoiceStatus.ON_HOLD;

      const updated = await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: {
          status,
          holdReason: holdReason.trim(),
          disputeReason: isDisputed ? holdReason.trim() : null
        }
      });

      await AuditService.log(ctx, "HOLD_SUPPLIER_INVOICE", "SupplierInvoice", invoice.id, JSON.stringify({ status, reason: holdReason }));
      return updated;
    });
  }

  /**
   * 4. Release Hold / Dispute
   */
  static async releaseHold(
    ctx: TenantContext,
    invoiceId: string
  ) {
    return await db.$transaction(async (tx) => {
      const invoice = await tx.supplierInvoice.findFirst({
        where: { id: invoiceId, branchId: ctx.branchId }
      });
      if (!invoice) throw new Error("Supplier invoice not found.");

      if (invoice.status !== SupplierInvoiceStatus.ON_HOLD && invoice.status !== SupplierInvoiceStatus.DISPUTED) {
        throw new Error(`Invoice is not on hold or disputed (current status: ${invoice.status}).`);
      }

      const status = invoice.journalEntryId ? SupplierInvoiceStatus.APPROVED : SupplierInvoiceStatus.MATCHED;

      const updated = await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: {
          status,
          holdReason: null,
          disputeReason: null
        }
      });

      await AuditService.log(ctx, "RELEASE_HOLD_SUPPLIER_INVOICE", "SupplierInvoice", invoice.id, JSON.stringify({ status }));
      return updated;
    });
  }

  /**
   * 5. Get Invoice Details
   */
  static async getInvoice(ctx: TenantContext, id: string) {
    const invoice = await db.supplierInvoice.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        supplier: true,
        po: true,
        grn: true,
        fiscalPeriod: true,
        lines: {
          include: {
            grnItem: true,
            expenseCategory: true,
            item: true,
            glAccount: true
          }
        },
        allocations: {
          include: {
            payment: true
          }
        },
        creditNotes: true
      }
    });
    if (!invoice) throw new Error("Supplier invoice not found.");
    return invoice;
  }

  /**
   * 6. List Invoices with Filters
   */
  static async listInvoices(
    ctx: TenantContext,
    filters?: {
      supplierId?: string;
      status?: SupplierInvoiceStatus;
      fiscalPeriodId?: string;
      search?: string;
    }
  ) {
    const where: Prisma.SupplierInvoiceWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.fiscalPeriodId ? { fiscalPeriodId: filters.fiscalPeriodId } : {}),
      ...(filters?.search
        ? {
            OR: [
              { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
              { vendorInvoiceNumber: { contains: filters.search, mode: "insensitive" } },
              { supplier: { name: { contains: filters.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    return await db.supplierInvoice.findMany({
      where,
      include: {
        supplier: true,
        fiscalPeriod: true
      },
      orderBy: { invoiceDate: "desc" }
    });
  }
}
