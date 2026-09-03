import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  PaymentMethod,
  SupplierPaymentStatus,
  SupplierInvoiceStatus,
  CashbookMovementType,
  CashDirection,
  JournalType,
  SupplyCategory
} from "@prisma/client";
import { AuditService } from "@/lib/services/audit.service";
import { GLEngineDAO, GLAccountDAO } from "@/lib/dao/gl.dao";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";
import { SupplierDAO, SupplierSequenceDAO } from "@/lib/dao/supplier.dao";

export interface InvoiceAllocationInput {
  invoiceId: string;
  amountToAllocate: number | string | Prisma.Decimal;
  discountAmount?: number | string | Prisma.Decimal;
}

export interface DisburseSupplierPaymentInput {
  supplierId: string;
  treasuryAccountId: string;
  paymentDate: Date | string;
  paymentMethod: PaymentMethod;
  amountToDisburse: number | string | Prisma.Decimal;
  referenceNumber?: string;
  notes?: string;
  whtDeductedAmount?: number | string | Prisma.Decimal;
  discountTakenAmount?: number | string | Prisma.Decimal;
  allocations?: InvoiceAllocationInput[]; // If empty, executes FIFO automated allocation
}

export class SupplierPaymentDAO {
  /**
   * 1. Disburse Supplier Payment & Post Balanced Settlement Journal
   */
  static async disbursePayment(
    ctx: TenantContext,
    input: DisburseSupplierPaymentInput
  ) {
    const totalDisburse = new Prisma.Decimal(input.amountToDisburse);
    if (totalDisburse.lte(0)) {
      throw new Error("Disbursement amount must be positive.");
    }

    const whtAmt = new Prisma.Decimal(input.whtDeductedAmount || 0);
    const discountAmt = new Prisma.Decimal(input.discountTakenAmount || 0);

    // Net Cash Outflow = Total Disburse - WHT - Discount
    const netCashOutflow = totalDisburse.sub(whtAmt).sub(discountAmt);
    if (netCashOutflow.lte(0)) {
      throw new Error("Net cash payout amount must be greater than zero.");
    }

    return await db.$transaction(async (tx) => {
      // 1. Verify Supplier
      const supplier = await tx.inventorySupplier.findFirst({
        where: { id: input.supplierId, branchId: ctx.branchId }
      });
      if (!supplier) throw new Error("Supplier not found in this branch.");

      // 2. Verify Treasury Account Liquidity
      const treasury = await tx.treasuryAccount.findFirst({
        where: { id: input.treasuryAccountId, branchId: ctx.branchId }
      });
      if (!treasury) throw new Error("Treasury account not found.");
      if (new Prisma.Decimal(treasury.currentBalance).lt(netCashOutflow)) {
        throw new Error(`Insufficient treasury liquidity in ${treasury.name} (Available: ${treasury.currentBalance}, Required: ${netCashOutflow}).`);
      }

      // 3. Mutate Treasury Balance
      const updatedTreasury = await tx.treasuryAccount.update({
        where: { id: treasury.id },
        data: { currentBalance: { decrement: netCashOutflow } }
      });

      const paymentNumber = await SupplierSequenceDAO.nextSequence(ctx, "SPAY", tx);
      const paymentDate = new Date(input.paymentDate);

      // 4. Create Cashbook Movement (CBM Outflow)
      const movNumber = await TreasuryDAO.getNextTreasurySequence(tx, ctx.branchId, "CBM");
      const cashbookMovement = await tx.cashbookMovement.create({
        data: {
          branchId: ctx.branchId,
          accountId: treasury.id,
          movementNumber: movNumber,
          movementType: CashbookMovementType.SUPPLIER_SETTLEMENT,
          direction: CashDirection.OUTFLOW,
          amount: netCashOutflow,
          balanceBefore: treasury.currentBalance,
          balanceAfter: updatedTreasury.currentBalance,
          transactionDate: paymentDate,
          referenceNumber: paymentNumber,
          description: `Supplier Payment: ${supplier.name} (${paymentNumber})`,
          createdById: ctx.userId
        }
      });

      // 5. Create Supplier Payment Record
      const payment = await tx.supplierPayment.create({
        data: {
          branchId: ctx.branchId,
          paymentNumber,
          supplierId: supplier.id,
          treasuryAccountId: treasury.id,
          paymentDate,
          totalAmountPaid: totalDisburse,
          whtDeductedAmount: whtAmt,
          discountTakenAmount: discountAmt,
          unallocatedAmount: totalDisburse, // Will decrement as allocations apply
          paymentMethod: input.paymentMethod,
          referenceNumber: input.referenceNumber?.trim() || null,
          notes: input.notes?.trim() || null,
          status: SupplierPaymentStatus.COMPLETED,
          cashbookMovementId: cashbookMovement.id,
          createdById: ctx.userId
        }
      });

      // Link payment to cashbook movement
      await tx.cashbookMovement.update({
        where: { id: cashbookMovement.id },
        data: { supplierPaymentId: payment.id }
      });

      // 6. Execute Allocations (Explicit or FIFO)
      let remainingToAllocate = totalDisburse;
      let primaryPurchCategory: SupplyCategory = SupplyCategory.GOODS;

      if (input.allocations && input.allocations.length > 0) {
        // Explicit Allocation
        for (const alloc of input.allocations) {
          const inv = await tx.supplierInvoice.findFirst({
            where: { id: alloc.invoiceId, branchId: ctx.branchId, supplierId: supplier.id }
          });
          if (!inv) throw new Error(`Invoice ${alloc.invoiceId} not found or does not belong to this supplier.`);

          primaryPurchCategory = inv.supplyCategory;
          const allocAmt = new Prisma.Decimal(alloc.amountToAllocate);
          const lineDisc = new Prisma.Decimal(alloc.discountAmount || 0);

          if (allocAmt.gt(inv.amountOutstanding)) {
            throw new Error(`Allocation of ${allocAmt} exceeds invoice outstanding amount of ${inv.amountOutstanding} on ${inv.invoiceNumber}.`);
          }

          const newPaid = new Prisma.Decimal(inv.amountPaid).add(allocAmt);
          const newOutstanding = new Prisma.Decimal(inv.amountOutstanding).sub(allocAmt);

          await tx.supplierInvoice.update({
            where: { id: inv.id },
            data: {
              amountPaid: newPaid,
              amountOutstanding: newOutstanding,
              status: newOutstanding.isZero() ? SupplierInvoiceStatus.PAID : SupplierInvoiceStatus.PARTIALLY_PAID
            }
          });

          await tx.supplierPaymentAllocation.create({
            data: {
              branchId: ctx.branchId,
              paymentId: payment.id,
              invoiceId: inv.id,
              allocatedAmount: allocAmt,
              discountAmount: lineDisc
            }
          });

          remainingToAllocate = remainingToAllocate.sub(allocAmt);
        }
      } else {
        // FIFO Automated Allocation across oldest overdue invoices
        const openInvoices = await tx.supplierInvoice.findMany({
          where: {
            branchId: ctx.branchId,
            supplierId: supplier.id,
            status: { in: [SupplierInvoiceStatus.APPROVED, SupplierInvoiceStatus.PARTIALLY_PAID] },
            amountOutstanding: { gt: 0 }
          },
          orderBy: { dueDate: "asc" }
        });

        for (const inv of openInvoices) {
          if (remainingToAllocate.lte(0)) break;

          primaryPurchCategory = inv.supplyCategory;
          const outstanding = new Prisma.Decimal(inv.amountOutstanding);
          const allocAmt = Prisma.Decimal.min(remainingToAllocate, outstanding);

          const newPaid = new Prisma.Decimal(inv.amountPaid).add(allocAmt);
          const newOutstanding = outstanding.sub(allocAmt);

          await tx.supplierInvoice.update({
            where: { id: inv.id },
            data: {
              amountPaid: newPaid,
              amountOutstanding: newOutstanding,
              status: newOutstanding.isZero() ? SupplierInvoiceStatus.PAID : SupplierInvoiceStatus.PARTIALLY_PAID
            }
          });

          await tx.supplierPaymentAllocation.create({
            data: {
              branchId: ctx.branchId,
              paymentId: payment.id,
              invoiceId: inv.id,
              allocatedAmount: allocAmt,
              discountAmount: new Prisma.Decimal(0)
            }
          });

          remainingToAllocate = remainingToAllocate.sub(allocAmt);
        }
      }

      // Update unallocated advance balance on payment
      const updatedPayment = await tx.supplierPayment.update({
        where: { id: payment.id },
        data: { unallocatedAmount: Prisma.Decimal.max(remainingToAllocate, new Prisma.Decimal(0)) }
      });

      // 7. Construct Balanced GL Journal Lines
      const defaultApAcc = (await GLAccountDAO.getAccountByCode(ctx, "2110", tx))!.id;
      const bankGlAcc = treasury.glAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1120", tx))!.id;
      const whtGlAcc = (await GLAccountDAO.getAccountByCode(ctx, "2140", tx)) || (await GLAccountDAO.getAccountByCode(ctx, "2220", tx));

      let discountGlAccId: string;
      if (primaryPurchCategory === SupplyCategory.GOODS) {
        discountGlAccId = (await GLAccountDAO.getAccountByCode(ctx, "1310", tx))!.id; // Stores Inventory
      } else if (primaryPurchCategory === SupplyCategory.CONSTRUCTION_WORKS) {
        discountGlAccId = (await GLAccountDAO.getAccountByCode(ctx, "1580", tx))!.id; // Capital WIP
      } else {
        discountGlAccId = (await GLAccountDAO.getAccountByCode(ctx, "4920", tx))?.id || (await GLAccountDAO.getAccountByCode(ctx, "6200", tx))!.id;
      }

      const journalLines: Array<{ accountId: string; debit: Prisma.Decimal | number; credit: Prisma.Decimal | number; description: string }> = [];

      // Debit: Relieve AP Supplier Liability (#2110) for full gross amount
      journalLines.push({
        accountId: defaultApAcc,
        debit: totalDisburse,
        credit: 0,
        description: `Supplier Settlement: ${supplier.name} (${paymentNumber})`
      });

      // Credit: Commercial Bank Account (#1120) for net cash outflow
      journalLines.push({
        accountId: bankGlAcc,
        debit: 0,
        credit: netCashOutflow,
        description: `Bank Disbursement from ${treasury.name}`
      });

      // Credit: Withholding Tax Payable (#2140) if tax deducted
      if (whtAmt.gt(0)) {
        journalLines.push({
          accountId: whtGlAcc!.id,
          debit: 0,
          credit: whtAmt,
          description: `URA WHT 6% Withholding on Payment ${paymentNumber}`
        });
      }

      // Credit: Category-Specific Prompt Discount Account
      if (discountAmt.gt(0)) {
        journalLines.push({
          accountId: discountGlAccId,
          debit: 0,
          credit: discountAmt,
          description: `Prompt Settlement Discount on Payment ${paymentNumber}`
        });
      }

      const idempotencyKey = `${ctx.branchId}:AP_PAY:${payment.id}:DISBURSE`;

      const { journal } = await GLEngineDAO.postJournalEntry(
        ctx,
        {
          journalType: JournalType.AP_PAYMENT_DISBURSEMENT,
          entryDate: paymentDate,
          description: `Supplier Settlement Payout: ${supplier.name} (${paymentNumber})`,
          referenceType: "SUPPLIER_PAYMENT",
          referenceId: payment.id,
          idempotencyKey,
          bypassControlAccountValidation: true,
          lines: journalLines
        },
        tx
      );

      const finalPayment = await tx.supplierPayment.update({
        where: { id: payment.id },
        data: { journalEntryId: journal.id }
      });

      // 8. Sync Authoritative Supplier Subledger Balance Cache
      await SupplierDAO.syncSupplierBalance(tx, ctx, supplier.id);

      await AuditService.log(
        ctx,
        "DISBURSE_SUPPLIER_PAYMENT",
        "SupplierPayment",
        payment.id,
        JSON.stringify({ paymentNumber: payment.paymentNumber, total: totalDisburse.toString(), net: netCashOutflow.toString() })
      );

      return finalPayment;
    });
  }

  /**
   * 2. Reverse Supplier Payment (Dishonored Cheque / Cancelled Payout)
   */
  static async reversePayment(
    ctx: TenantContext,
    paymentId: string,
    reversalReason: string
  ) {
    if (!reversalReason || !reversalReason.trim()) throw new Error("Reversal reason is required.");

    return await db.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.findFirst({
        where: { id: paymentId, branchId: ctx.branchId },
        include: {
          treasuryAccount: true,
          allocations: { include: { invoice: true } },
          supplier: true
        }
      });
      if (!payment) throw new Error("Supplier payment not found.");

      if (payment.status !== SupplierPaymentStatus.COMPLETED) {
        throw new Error(`Cannot reverse a payment in status ${payment.status}.`);
      }

      const netCashOutflow = new Prisma.Decimal(payment.totalAmountPaid).sub(payment.whtDeductedAmount).sub(payment.discountTakenAmount);

      // 1. Re-credit Treasury Account
      const updatedTreasury = await tx.treasuryAccount.update({
        where: { id: payment.treasuryAccountId },
        data: { currentBalance: { increment: netCashOutflow } }
      });

      // 2. Log Inflow Cashbook Movement
      const movNumber = await TreasuryDAO.getNextTreasurySequence(tx, ctx.branchId, "CBM");
      await tx.cashbookMovement.create({
        data: {
          branchId: ctx.branchId,
          accountId: payment.treasuryAccountId,
          movementNumber: movNumber,
          movementType: CashbookMovementType.SUPPLIER_REFUND_IN,
          direction: CashDirection.INFLOW,
          amount: netCashOutflow,
          balanceBefore: payment.treasuryAccount.currentBalance,
          balanceAfter: updatedTreasury.currentBalance,
          transactionDate: new Date(),
          referenceNumber: payment.paymentNumber,
          description: `Payment Reversal Refund: ${payment.supplier.name} (${payment.paymentNumber}) - ${reversalReason.trim()}`,
          createdById: ctx.userId
        }
      });

      // 3. Reinstate Outstanding Invoices
      for (const alloc of payment.allocations) {
        const inv = alloc.invoice;
        const newPaid = new Prisma.Decimal(inv.amountPaid).sub(alloc.allocatedAmount);
        const newOutstanding = new Prisma.Decimal(inv.amountOutstanding).add(alloc.allocatedAmount);

        await tx.supplierInvoice.update({
          where: { id: inv.id },
          data: {
            amountPaid: Prisma.Decimal.max(newPaid, new Prisma.Decimal(0)),
            amountOutstanding: newOutstanding,
            status: newPaid.isZero() ? SupplierInvoiceStatus.APPROVED : SupplierInvoiceStatus.PARTIALLY_PAID
          }
        });
      }

      // 4. Reverse Journal Entry if posted
      if (payment.journalEntryId) {
        await GLEngineDAO.reverseJournalEntry(ctx, payment.journalEntryId, `Supplier payment reversal: ${reversalReason.trim()}`);
      }

      // 5. Update Payment Status
      const reversed = await tx.supplierPayment.update({
        where: { id: payment.id },
        data: {
          status: SupplierPaymentStatus.REVERSED,
          notes: (payment.notes ? `${payment.notes} | ` : "") + `Reversed on ${new Date().toISOString()}: ${reversalReason.trim()}`
        }
      });

      // 6. Sync Authoritative Supplier Subledger Balance Cache
      await SupplierDAO.syncSupplierBalance(tx, ctx, payment.supplierId);

      await AuditService.log(
        ctx,
        "REVERSE_SUPPLIER_PAYMENT",
        "SupplierPayment",
        payment.id,
        JSON.stringify({ paymentNumber: payment.paymentNumber, reason: reversalReason })
      );

      return reversed;
    });
  }

  /**
   * 3. Get Payment Details
   */
  static async getPayment(ctx: TenantContext, id: string) {
    const payment = await db.supplierPayment.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        supplier: true,
        treasuryAccount: true,
        allocations: {
          include: { invoice: true }
        }
      }
    });
    if (!payment) throw new Error("Supplier payment not found.");
    return payment;
  }

  /**
   * 4. List Payments with Filters
   */
  static async listPayments(
    ctx: TenantContext,
    filters?: {
      supplierId?: string;
      treasuryAccountId?: string;
      status?: SupplierPaymentStatus;
      search?: string;
    }
  ) {
    const where: Prisma.SupplierPaymentWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters?.treasuryAccountId ? { treasuryAccountId: filters.treasuryAccountId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              { paymentNumber: { contains: filters.search, mode: "insensitive" } },
              { referenceNumber: { contains: filters.search, mode: "insensitive" } },
              { supplier: { name: { contains: filters.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    return await db.supplierPayment.findMany({
      where,
      include: {
        supplier: true,
        treasuryAccount: true,
        allocations: true
      },
      orderBy: { paymentDate: "desc" }
    });
  }
}
