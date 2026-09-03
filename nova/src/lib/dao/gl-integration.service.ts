import { Prisma, JournalType, SystemControlRole } from "@prisma/client";
import { TenantContext } from "./tenant-context";
import { GLEngineDAO, GLAccountDAO, PostJournalLineParam } from "./gl.dao";

export class GLIntegrationService {
  /**
   * Helper to ensure Chart of Accounts is initialized for branch before posting.
   */
  private static async ensureCOA(tx: Prisma.TransactionClient, branchId: string) {
    await GLAccountDAO.initBranchChartOfAccounts(branchId, tx);
  }

  /**
   * 3.1B: Term Fee Invoice Billing Gross Charge
   * Dr. AR Student Control (#1200)
   *   Cr. Tuition / Boarding / Transport Revenue (#4xxx)
   * If discount: Dr. Bursary Allowance (#4800), Cr. AR Student Control (#1200)
   */
  static async postInvoiceBilling(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    invoiceId: string
  ) {
    await this.ensureCOA(tx, ctx.branchId);

    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, branchId: ctx.branchId },
      include: { items: { include: { feeType: true } } }
    });
    if (!invoice) return null;

    const arAccount = await GLAccountDAO.getMapping(ctx, SystemControlRole.AR_STUDENT_CONTROL, tx);
    if (!arAccount) return null;

    // Resolve default revenue accounts
    const tuitionRev = await GLAccountDAO.getAccountByCode(ctx, '4100', tx);
    const boardingRev = await GLAccountDAO.getAccountByCode(ctx, '4200', tx);
    const transportRev = await GLAccountDAO.getAccountByCode(ctx, '4300', tx);
    const defaultRev = tuitionRev || arAccount;

    const lines: PostJournalLineParam[] = [];

    // DR: AR Student Control (Gross Amount)
    lines.push({
      accountId: arAccount.id,
      debit: invoice.grossAmount,
      credit: 0,
      description: `Invoice ${invoice.invoiceNumber}: Gross billing charge`
    });

    // CR: Revenue items
    for (const item of invoice.items) {
      let revAccId = item.feeType?.glAccountId;
      if (!revAccId) {
        const nameUpper = (item.feeTypeName || '').toUpperCase();
        if (nameUpper.includes('BOARDING')) revAccId = boardingRev?.id;
        else if (nameUpper.includes('TRANSPORT')) revAccId = transportRev?.id;
        else revAccId = defaultRev?.id;
      }

      if (revAccId && !item.lineTotal.isZero()) {
        lines.push({
          accountId: revAccId,
          debit: 0,
          credit: item.lineTotal,
          description: `Fee: ${item.feeTypeName}`
        });
      }
    }

    // Handle Bursary Discount if applicable
    if (invoice.discountAmount.isPositive()) {
      const bursaryAcc = await GLAccountDAO.getAccountByCode(ctx, '4800', tx);
      if (bursaryAcc) {
        lines.push({
          accountId: bursaryAcc.id,
          debit: invoice.discountAmount,
          credit: 0,
          description: `Bursary discount for Invoice ${invoice.invoiceNumber}`
        });
        lines.push({
          accountId: arAccount.id,
          debit: 0,
          credit: invoice.discountAmount,
          description: `Bursary credit allowance`
        });
      }
    }

    const idempotencyKey = `${ctx.branchId}:INVOICE:${invoice.id}:BILLING`;

    return GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.AR_BILLING,
        entryDate: invoice.issueDate,
        description: `Term Fee Billing: Invoice ${invoice.invoiceNumber}`,
        referenceType: "INVOICE",
        referenceId: invoice.id,
        idempotencyKey,
        bypassControlAccountValidation: true,
        lines
      },
      tx
    );
  }

  /**
   * 3.1B: Invoice Void Reversal
   */
  static async postInvoiceVoid(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    invoiceId: string
  ) {
    const existing = await tx.journalEntry.findUnique({
      where: {
        branchId_referenceType_referenceId_journalType: {
          branchId: ctx.branchId,
          referenceType: "INVOICE",
          referenceId: invoiceId,
          journalType: JournalType.AR_BILLING
        }
      }
    });
    if (!existing) return null;

    return GLEngineDAO.reverseJournalEntry(ctx, existing.id, "Invoice voided");
  }

  /**
   * 3.1C: Student Fee Payment Receipt
   * Dr. Cash/Bank Account (#11xx)
   *   Cr. AR Student Control (#1200)
   */
  static async postPaymentReceipt(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    paymentId: string
  ) {
    await this.ensureCOA(tx, ctx.branchId);

    const payment = await tx.payment.findFirst({
      where: { id: paymentId, branchId: ctx.branchId },
      include: { treasuryAccount: true }
    });
    if (!payment) return null;

    const arAccount = await GLAccountDAO.getMapping(ctx, SystemControlRole.AR_STUDENT_CONTROL, tx);
    let bankAccount = null;

    if (payment.treasuryAccount?.glAccountId) {
      bankAccount = await tx.gLAccount.findFirst({
        where: { id: payment.treasuryAccount.glAccountId, branchId: ctx.branchId }
      });
    }

    if (!bankAccount) {
      if (payment.paymentMethod === 'CASH') {
        bankAccount = await GLAccountDAO.getAccountByCode(ctx, '1110', tx); // Till
      } else {
        bankAccount = await GLAccountDAO.getMapping(ctx, SystemControlRole.CASH_BANK_CONTROL, tx) ||
                      await GLAccountDAO.getAccountByCode(ctx, '1120', tx); // Bank
      }
    }

    if (!arAccount || !bankAccount) return null;

    const idempotencyKey = `${ctx.branchId}:PAYMENT:${payment.id}:RECEIPT`;

    return GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.PAYMENT_RECEIPT,
        entryDate: payment.paymentDate,
        description: `Fee Receipt ${payment.paymentNumber} (${payment.paymentMethod})`,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        idempotencyKey,
        bypassControlAccountValidation: true,
        lines: [
          {
            accountId: bankAccount.id,
            debit: payment.amount,
            credit: 0,
            description: `Fee payment receipt via ${payment.paymentMethod}`
          },
          {
            accountId: arAccount.id,
            debit: 0,
            credit: payment.amount,
            description: `Credit student fee account: ${payment.paymentNumber}`
          }
        ]
      },
      tx
    );
  }

  /**
   * 3.1C: Payment Reversal
   */
  static async postPaymentReversal(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    paymentId: string
  ) {
    const existing = await tx.journalEntry.findUnique({
      where: {
        branchId_referenceType_referenceId_journalType: {
          branchId: ctx.branchId,
          referenceType: "PAYMENT",
          referenceId: paymentId,
          journalType: JournalType.PAYMENT_RECEIPT
        }
      }
    });
    if (!existing) return null;

    return GLEngineDAO.reverseJournalEntry(ctx, existing.id, "Payment reversed / bounced");
  }

  /**
   * 3.1D: Operational Expense Disbursement
   * Dr. Operational Expense (#6xxx)
   *   Cr. Commercial Bank / Cash Office Safe (#1120 / #1105)
   */
  static async postExpenseDisbursement(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    expenseId: string
  ) {
    await this.ensureCOA(tx, ctx.branchId);

    const expense = await tx.expense.findFirst({
      where: { id: expenseId, branchId: ctx.branchId },
      include: { category: true, treasuryAccount: true, payrollRun: true }
    });
    if (!expense) return null;

    // If expense originated from a Payroll Run, suppress duplicate expense posting!
    if (expense.payrollRun) {
      return null;
    }

    let expenseAcc = null;
    if (expense.category?.glAccountId) {
      expenseAcc = await tx.gLAccount.findFirst({
        where: { id: expense.category.glAccountId, branchId: ctx.branchId }
      });
    }
    if (!expenseAcc) {
      expenseAcc = await GLAccountDAO.getAccountByCode(ctx, '6500', tx); // Campus Utilities / General Ops
    }

    let bankAcc = null;
    if (expense.treasuryAccount?.glAccountId) {
      bankAcc = await tx.gLAccount.findFirst({
        where: { id: expense.treasuryAccount.glAccountId, branchId: ctx.branchId }
      });
    }
    if (!bankAcc) {
      if (expense.paymentMethod === 'CASH') {
        bankAcc = await GLAccountDAO.getAccountByCode(ctx, '1105', tx); // Safe
      } else {
        bankAcc = await GLAccountDAO.getAccountByCode(ctx, '1120', tx); // Bank
      }
    }

    if (!expenseAcc || !bankAcc) return null;

    const idempotencyKey = `${ctx.branchId}:EXPENSE:${expense.id}:DISBURSEMENT`;

    return GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.EXPENSE_DISBURSEMENT,
        entryDate: expense.expenseDate,
        description: `Expense Voucher ${expense.voucherNumber}: ${expense.vendorName || 'General'} - ${expense.title}`,
        referenceType: "EXPENSE",
        referenceId: expense.id,
        idempotencyKey,
        bypassControlAccountValidation: true,
        lines: [
          {
            accountId: expenseAcc.id,
            debit: expense.amount,
            credit: 0,
            description: `Expense: ${expense.category?.name || 'General'}`
          },
          {
            accountId: bankAcc.id,
            debit: 0,
            credit: expense.amount,
            description: `Paid from ${bankAcc.name}`
          }
        ]
      },
      tx
    );
  }

  /**
   * 3.1D: Expense Void
   */
  static async postExpenseVoid(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    expenseId: string
  ) {
    const existing = await tx.journalEntry.findUnique({
      where: {
        branchId_referenceType_referenceId_journalType: {
          branchId: ctx.branchId,
          referenceType: "EXPENSE",
          referenceId: expenseId,
          journalType: JournalType.EXPENSE_DISBURSEMENT
        }
      }
    });
    if (!existing) return null;

    return GLEngineDAO.reverseJournalEntry(ctx, existing.id, "Expense voucher voided");
  }

  /**
   * 3.1F: Staff Payroll Accrual upon Approval
   * Dr. Staff Wages Expense (#6100)
   * Dr. Employer NSSF Expense (#6300)
   *   Cr. Net Salaries Payable (#2210)
   *   Cr. URA PAYE Tax Payable (#2220)
   *   Cr. NSSF Payable (#2230)
   */
  static async postPayrollAccrual(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    payrollRunId: string
  ) {
    await this.ensureCOA(tx, ctx.branchId);

    const run = await tx.payrollRun.findFirst({
      where: { id: payrollRunId, branchId: ctx.branchId },
      include: { payslips: { include: { items: true } } }
    });
    if (!run) return null;

    const wagesAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.PAYROLL_WAGES_EXPENSE, tx);
    const employerNssfAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.PAYROLL_EMPLOYER_NSSF_EXPENSE, tx);
    const netPayAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.PAYROLL_NET_PAY_PAYABLE, tx);
    const payeAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.PAYROLL_PAYE_PAYABLE, tx);
    const nssfAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.PAYROLL_NSSF_PAYABLE, tx);

    if (!wagesAcc || !employerNssfAcc || !netPayAcc || !payeAcc || !nssfAcc) return null;

    const employerNssfAmt = run.totalEmployerCost.minus(run.totalGross);

    let totalPaye = new Prisma.Decimal(0);
    let employeeNssf = new Prisma.Decimal(0);
    for (const ps of run.payslips) {
      for (const it of ps.items) {
        if (it.type === 'DEDUCTION') {
          if (it.code.toUpperCase().includes('PAYE') || it.name.toUpperCase().includes('PAYE')) {
            totalPaye = totalPaye.add(it.amount);
          } else if (it.code.toUpperCase().includes('NSSF') || it.name.toUpperCase().includes('NSSF')) {
            employeeNssf = employeeNssf.add(it.amount);
          }
        }
      }
    }
    const combinedNssf = employeeNssf.add(employerNssfAmt);

    const lines: PostJournalLineParam[] = [
      {
        accountId: wagesAcc.id,
        debit: run.totalGross,
        credit: 0,
        description: `Gross payroll salaries for ${run.month}/${run.year}`
      },
      {
        accountId: employerNssfAcc.id,
        debit: employerNssfAmt,
        credit: 0,
        description: `Employer 10% statutory NSSF contribution`
      },
      {
        accountId: netPayAcc.id,
        debit: 0,
        credit: run.totalNet,
        description: `Net salaries payable to employees`
      },
      {
        accountId: payeAcc.id,
        debit: 0,
        credit: totalPaye,
        description: `URA PAYE tax withholding payable`
      },
      {
        accountId: nssfAcc.id,
        debit: 0,
        credit: combinedNssf,
        description: `NSSF contributions payable (15% combined)`
      }
    ];

    const idempotencyKey = `${ctx.branchId}:PAYROLL_RUN:${run.id}:ACCRUAL`;

    return GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.PAYROLL_ACCRUAL,
        entryDate: run.createdAt,
        description: `Payroll Accrual ${run.payrollNumber} (${run.month}/${run.year})`,
        referenceType: "PAYROLL_RUN",
        referenceId: run.id,
        idempotencyKey,
        bypassControlAccountValidation: true,
        lines
      },
      tx
    );
  }

  /**
   * 3.1F: Staff Payroll Net Payout Settlement
   * Dr. Net Salaries Payable (#2210)
   *   Cr. Commercial Bank Account (#1120)
   */
  static async postPayrollDisbursement(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    payrollRunId: string
  ) {
    await this.ensureCOA(tx, ctx.branchId);

    const run = await tx.payrollRun.findFirst({
      where: { id: payrollRunId, branchId: ctx.branchId }
    });
    if (!run) return null;

    const netPayAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.PAYROLL_NET_PAY_PAYABLE, tx);
    const bankAcc = await GLAccountDAO.getAccountByCode(ctx, '1120', tx);

    if (!netPayAcc || !bankAcc) return null;

    const idempotencyKey = `${ctx.branchId}:PAYROLL_RUN:${run.id}:DISBURSEMENT`;

    return GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.PAYROLL_PAYOUT,
        entryDate: run.disbursedAt || new Date(),
        description: `Payroll Disbursement Payout: ${run.payrollNumber}`,
        referenceType: "PAYROLL_RUN",
        referenceId: run.id,
        idempotencyKey,
        bypassControlAccountValidation: true,
        lines: [
          {
            accountId: netPayAcc.id,
            debit: run.totalNet,
            credit: 0,
            description: `Settlement of net salaries: ${run.payrollNumber}`
          },
          {
            accountId: bankAcc.id,
            debit: 0,
            credit: run.totalNet,
            description: `Disbursed from bank account`
          }
        ]
      },
      tx
    );
  }

  /**
   * 3.1J: GRN Stock Arrival (Accrual)
   * Dr. Stores Inventory Asset (#1310)
   *   Cr. Accrued Goods Received (#2120)
   */
  static async postGRNReceipt(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    grnId: string
  ) {
    await this.ensureCOA(tx, ctx.branchId);

    const grn = await tx.goodsReceivedNote.findFirst({
      where: { id: grnId, branchId: ctx.branchId },
      include: { items: true }
    });
    if (!grn) return null;

    let totalVal = new Prisma.Decimal(0);
    for (const it of grn.items) {
      totalVal = totalVal.add(new Prisma.Decimal(it.quantityReceived).mul(it.unitCostPrice));
    }

    if (totalVal.isZero()) return null;

    const invAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.INVENTORY_STORES_ASSET, tx);
    const apAccrual = await GLAccountDAO.getMapping(ctx, SystemControlRole.AP_GRN_ACCRUAL, tx);

    if (!invAcc || !apAccrual) return null;

    const idempotencyKey = `${ctx.branchId}:GRN:${grn.id}:RECEIPT`;

    return GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.INVENTORY_PURCHASE,
        entryDate: grn.deliveryDate || grn.createdAt,
        description: `GRN Receipt ${grn.grnNumber}`,
        referenceType: "GRN",
        referenceId: grn.id,
        idempotencyKey,
        bypassControlAccountValidation: true,
        lines: [
          {
            accountId: invAcc.id,
            debit: totalVal,
            credit: 0,
            description: `Stores Inventory Asset Inflow: ${grn.grnNumber}`
          },
          {
            accountId: apAccrual.id,
            debit: 0,
            credit: totalVal,
            description: `Accrued Goods Received liability`
          }
        ]
      },
      tx
    );
  }

  /**
   * 3.1J: Student Store Sale (Dual Legs: Retail Revenue + Historical WAC COGS)
   */
  static async postStoreSale(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    saleId: string
  ) {
    await this.ensureCOA(tx, ctx.branchId);

    const sale = await tx.studentStoreSale.findFirst({
      where: { id: saleId, branchId: ctx.branchId },
      include: { items: { include: { item: true } } }
    });
    if (!sale) return null;

    const retailRev = await GLAccountDAO.getAccountByCode(ctx, '4500', tx); // Bookstore & Uniform Sales
    const tillAcc = await GLAccountDAO.getAccountByCode(ctx, '1110', tx);
    const arAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.AR_STUDENT_CONTROL, tx);
    const cogsAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.INVENTORY_COGS_DEFAULT, tx);
    const invAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.INVENTORY_STORES_ASSET, tx);

    if (!retailRev || !cogsAcc || !invAcc) return null;

    const debitAcc = sale.invoiceItemId ? arAcc : tillAcc;
    if (!debitAcc) return null;

    let wacCost = new Prisma.Decimal(0);
    for (const it of sale.items) {
      wacCost = wacCost.add(new Prisma.Decimal(it.quantity).mul(it.item.unitCostPrice));
    }

    const idempotencyKey = `${ctx.branchId}:STORE_SALE:${sale.id}:SALE`;

    return GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.INVENTORY_COGS,
        entryDate: sale.saleDate || sale.createdAt,
        description: `Store Sale ${sale.saleReceiptNo}`,
        referenceType: "STORE_SALE",
        referenceId: sale.id,
        idempotencyKey,
        bypassControlAccountValidation: true,
        lines: [
          // Revenue Leg
          {
            accountId: debitAcc.id,
            debit: sale.totalAmount,
            credit: 0,
            description: `Store sale proceeds: ${sale.saleReceiptNo}`
          },
          {
            accountId: retailRev.id,
            debit: 0,
            credit: sale.totalAmount,
            description: `Bookstore / Uniform sales revenue`
          },
          // COGS Leg
          {
            accountId: cogsAcc.id,
            debit: wacCost,
            credit: 0,
            description: `Cost of Goods Sold (WAC valuation)`
          },
          {
            accountId: invAcc.id,
            debit: 0,
            credit: wacCost,
            description: `Inventory reduction at historical WAC`
          }
        ]
      },
      tx
    );
  }

  /**
   * 3.1J: Departmental Store Requisition Issue
   * Dr. Departmental Operational Supplies Expense (#6500)
   *   Cr. Stores Inventory Asset (#1310) at WAC
   */
  static async postStoreRequisition(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    requisitionId: string
  ) {
    await this.ensureCOA(tx, ctx.branchId);

    const req = await tx.storeRequisition.findFirst({
      where: { id: requisitionId, branchId: ctx.branchId },
      include: { items: { include: { item: true } } }
    });
    if (!req) return null;

    let totalWacCost = new Prisma.Decimal(0);
    for (const it of req.items) {
      totalWacCost = totalWacCost.add(new Prisma.Decimal(it.quantityIssued).mul(it.item.unitCostPrice));
    }
    if (totalWacCost.isZero()) return null;

    const expenseAcc = await GLAccountDAO.getAccountByCode(ctx, '6500', tx); // General Supplies / Operations
    const invAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.INVENTORY_STORES_ASSET, tx);

    if (!expenseAcc || !invAcc) return null;

    const idempotencyKey = `${ctx.branchId}:STORE_REQ:${req.id}:ISSUE`;

    return GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.INVENTORY_ISSUE,
        entryDate: req.issuedDate || req.updatedAt,
        description: `Store Requisition Issue: ${req.requisitionNo}`,
        referenceType: "STORE_REQ",
        referenceId: req.id,
        idempotencyKey,
        bypassControlAccountValidation: true,
        lines: [
          {
            accountId: expenseAcc.id,
            debit: totalWacCost,
            credit: 0,
            description: `Departmental supplies issued: ${req.requisitionNo}`
          },
          {
            accountId: invAcc.id,
            debit: 0,
            credit: totalWacCost,
            description: `Inventory stock reduction at WAC`
          }
        ]
      },
      tx
    );
  }

  /**
   * 3.1K: Pure Treasury Cash Banking Confirmation
   * Dr. Commercial Bank (#1120)
   *   Cr. Cash in Transit (#1115)
   */
  static async postCashBankingConfirmation(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    transferId: string
  ) {
    await this.ensureCOA(tx, ctx.branchId);

    const transfer = await tx.treasuryTransfer.findFirst({
      where: { id: transferId, branchId: ctx.branchId },
      include: { toAccount: true }
    });
    if (!transfer) return null;

    const bankAcc = transfer.toAccount.glAccountId
      ? await tx.gLAccount.findFirst({ where: { id: transfer.toAccount.glAccountId, branchId: ctx.branchId } })
      : await GLAccountDAO.getAccountByCode(ctx, '1120', tx);

    const inTransitAcc = await GLAccountDAO.getMapping(ctx, SystemControlRole.CASH_IN_TRANSIT, tx);

    if (!bankAcc || !inTransitAcc) return null;

    const idempotencyKey = `${ctx.branchId}:TREASURY_TRANSFER:${transfer.id}:CONFIRMATION`;

    return GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.TREASURY_TRANSFER,
        entryDate: new Date(),
        description: `Cash Banking Stamped Deposit Confirmed: ${transfer.transferNumber}`,
        referenceType: "TREASURY_TRANSFER",
        referenceId: transfer.id,
        idempotencyKey,
        bypassControlAccountValidation: true,
        lines: [
          {
            accountId: bankAcc.id,
            debit: transfer.amount,
            credit: 0,
            description: `Bank account deposit clearance: ${transfer.depositSlipNumber || ''}`
          },
          {
            accountId: inTransitAcc.id,
            debit: 0,
            credit: transfer.amount,
            description: `Clear cash in transit`
          }
        ]
      },
      tx
    );
  }
}
