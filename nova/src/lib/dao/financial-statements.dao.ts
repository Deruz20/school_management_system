import { db } from "../db";
import { Prisma, GLAccountType, JournalStatus } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";

export class FinancialStatementsDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('gl:reports:read') ||
      perms.includes('gl:accounts:read') ||
      perms.includes('fees:read')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: gl:reports:read");
  }

  /**
   * Trial Balance (TB)
   * Lists every active detail account with Total Debits, Total Credits, and Net Balance.
   * Asserts: Total Debits == Total Credits (Zero Variance).
   */
  static async getTrialBalance(ctx: TenantContext, asOfDate?: Date | string) {
    let cutoff: Date;
    if (asOfDate) {
      const d = new Date(asOfDate);
      cutoff = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    } else {
      cutoff = new Date();
    }

    const accounts = await db.gLAccount.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      orderBy: [{ code: 'asc' }],
      include: { parent: true }
    });

    const lines = await db.journalLine.findMany({
      where: {
        branchId: ctx.branchId,
        journalEntry: {
          status: JournalStatus.POSTED,
          entryDate: { lte: cutoff }
        }
      }
    });

    // Group debits and credits by accountId
    const sumMap = new Map<string, { debits: Prisma.Decimal; credits: Prisma.Decimal }>();
    for (const l of lines) {
      const current = sumMap.get(l.accountId) || { debits: new Prisma.Decimal(0), credits: new Prisma.Decimal(0) };
      sumMap.set(l.accountId, {
        debits: current.debits.add(l.debit),
        credits: current.credits.add(l.credit)
      });
    }

    let grandTotalDebit = new Prisma.Decimal(0);
    let grandTotalCredit = new Prisma.Decimal(0);

    const reportRows = accounts.map(acc => {
      const sums = sumMap.get(acc.id) || { debits: new Prisma.Decimal(0), credits: new Prisma.Decimal(0) };
      let debitBalance = new Prisma.Decimal(0);
      let creditBalance = new Prisma.Decimal(0);

      if (acc.normalBalance === 'DEBIT') {
        const net = sums.debits.minus(sums.credits);
        if (net.greaterThan(0)) debitBalance = net;
        else if (net.lessThan(0)) creditBalance = net.abs();
      } else {
        const net = sums.credits.minus(sums.debits);
        if (net.greaterThan(0)) creditBalance = net;
        else if (net.lessThan(0)) debitBalance = net.abs();
      }

      if (!acc.isHeader) {
        grandTotalDebit = grandTotalDebit.add(debitBalance);
        grandTotalCredit = grandTotalCredit.add(creditBalance);
      }

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.accountType,
        normalBalance: acc.normalBalance,
        isHeader: acc.isHeader,
        parentId: acc.parentId,
        totalDebits: sums.debits,
        totalCredits: sums.credits,
        debitBalance,
        creditBalance
      };
    });

    const variance = grandTotalDebit.minus(grandTotalCredit).abs();
    return {
      asOfDate: cutoff,
      branchId: ctx.branchId,
      totalDebit: grandTotalDebit,
      totalCredit: grandTotalCredit,
      variance,
      isBalanced: variance.isZero(),
      rows: reportRows
    };
  }

  /**
   * Statement of Comprehensive Income (Income Statement / P&L)
   * Formula:
   *   Operating Revenues (4000s)
   * - Bursary Allowances (4800s)
   * = Net Operating Revenue
   * - Direct Costs (5000s)
   * = Gross Educational Margin
   * - Operational & Admin Expenses (6000s)
   * = Net Operating Surplus
   * + Other / Interest Incomes (4900s)
   * = Net Comprehensive Surplus / (Deficit)
   */
  static async getIncomeStatement(ctx: TenantContext, startDate: Date | string, endDate: Date | string) {
    this.checkReadPermission(ctx);
    const start = new Date(startDate);
    const end = new Date(endDate);

    const accounts = await db.gLAccount.findMany({
      where: {
        branchId: ctx.branchId,
        accountType: { in: [GLAccountType.REVENUE, GLAccountType.DIRECT_COST, GLAccountType.EXPENSE] },
        isActive: true,
        isHeader: false
      },
      orderBy: [{ code: 'asc' }]
    });

    const lines = await db.journalLine.findMany({
      where: {
        branchId: ctx.branchId,
        journalEntry: {
          status: JournalStatus.POSTED,
          entryDate: { gte: start, lte: end }
        }
      }
    });

    const sumMap = new Map<string, Prisma.Decimal>();
    for (const l of lines) {
      const current = sumMap.get(l.accountId) || new Prisma.Decimal(0);
      sumMap.set(l.accountId, current.add(l.debit).minus(l.credit));
    }

    const revenues: Array<{ code: string; name: string; amount: Prisma.Decimal }> = [];
    const directCosts: Array<{ code: string; name: string; amount: Prisma.Decimal }> = [];
    const expenses: Array<{ code: string; name: string; amount: Prisma.Decimal }> = [];
    let bursaryAllowance = new Prisma.Decimal(0);
    let otherIncome = new Prisma.Decimal(0);

    let grossRevenue = new Prisma.Decimal(0);
    let totalDirectCosts = new Prisma.Decimal(0);
    let totalExpenses = new Prisma.Decimal(0);

    for (const acc of accounts) {
      const rawNet = sumMap.get(acc.id) || new Prisma.Decimal(0);

      if (acc.accountType === GLAccountType.REVENUE) {
        // Normal balance CREDIT: credit - debit = -rawNet
        const amount = rawNet.negated();
        if (acc.code.startsWith('48')) {
          // Bursary discount (contra-revenue)
          bursaryAllowance = bursaryAllowance.add(rawNet); // positive debit
        } else if (acc.code.startsWith('49')) {
          otherIncome = otherIncome.add(amount);
        } else {
          grossRevenue = grossRevenue.add(amount);
          revenues.push({ code: acc.code, name: acc.name, amount });
        }
      } else if (acc.accountType === GLAccountType.DIRECT_COST) {
        // Normal balance DEBIT
        const amount = rawNet;
        totalDirectCosts = totalDirectCosts.add(amount);
        directCosts.push({ code: acc.code, name: acc.name, amount });
      } else if (acc.accountType === GLAccountType.EXPENSE) {
        // Normal balance DEBIT
        const amount = rawNet;
        totalExpenses = totalExpenses.add(amount);
        expenses.push({ code: acc.code, name: acc.name, amount });
      }
    }

    const netOperatingRevenue = grossRevenue.minus(bursaryAllowance);
    const grossEducationalMargin = netOperatingRevenue.minus(totalDirectCosts);
    const netOperatingSurplus = grossEducationalMargin.minus(totalExpenses);
    const netComprehensiveSurplus = netOperatingSurplus.add(otherIncome);

    return {
      period: { startDate: start, endDate: end },
      grossRevenue,
      bursaryAllowance,
      netOperatingRevenue,
      directCosts: {
        total: totalDirectCosts,
        items: directCosts
      },
      grossEducationalMargin,
      operatingExpenses: {
        total: totalExpenses,
        items: expenses
      },
      netOperatingSurplus,
      otherIncome,
      netComprehensiveSurplus
    };
  }

  /**
   * Statement of Financial Position (Balance Sheet)
   * Formula: Total Assets = Total Liabilities + Total Equity + Current Year Surplus
   */
  static async getBalanceSheet(ctx: TenantContext, asOfDate?: Date | string) {
    this.checkReadPermission(ctx);
    let cutoff: Date;
    if (asOfDate) {
      const d = new Date(asOfDate);
      cutoff = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    } else {
      cutoff = new Date();
    }

    const accounts = await db.gLAccount.findMany({
      where: {
        branchId: ctx.branchId,
        isActive: true,
        isHeader: false
      },
      orderBy: [{ code: 'asc' }]
    });

    const lines = await db.journalLine.findMany({
      where: {
        branchId: ctx.branchId,
        journalEntry: {
          status: JournalStatus.POSTED,
          entryDate: { lte: cutoff }
        }
      }
    });

    const sumMap = new Map<string, { debits: Prisma.Decimal; credits: Prisma.Decimal }>();
    for (const l of lines) {
      const cur = sumMap.get(l.accountId) || { debits: new Prisma.Decimal(0), credits: new Prisma.Decimal(0) };
      sumMap.set(l.accountId, {
        debits: cur.debits.add(l.debit),
        credits: cur.credits.add(l.credit)
      });
    }

    const currentAssets: Array<{ code: string; name: string; amount: Prisma.Decimal }> = [];
    const nonCurrentAssets: Array<{ code: string; name: string; amount: Prisma.Decimal }> = [];
    let totalAssets = new Prisma.Decimal(0);

    const currentLiabilities: Array<{ code: string; name: string; amount: Prisma.Decimal }> = [];
    const longTermLiabilities: Array<{ code: string; name: string; amount: Prisma.Decimal }> = [];
    let totalLiabilities = new Prisma.Decimal(0);

    const equityItems: Array<{ code: string; name: string; amount: Prisma.Decimal }> = [];
    let totalEquity = new Prisma.Decimal(0);

    let cumulativePnlRevenue = new Prisma.Decimal(0);
    let cumulativePnlCosts = new Prisma.Decimal(0);

    for (const acc of accounts) {
      const sums = sumMap.get(acc.id) || { debits: new Prisma.Decimal(0), credits: new Prisma.Decimal(0) };

      if (acc.accountType === GLAccountType.ASSET) {
        let bal = sums.debits.minus(sums.credits);
        if (acc.code === '1600') {
          // Contra-asset: credit balance reduces asset total
          bal = sums.credits.minus(sums.debits).negated();
        }
        totalAssets = totalAssets.add(bal);
        if (acc.code.startsWith('11') || acc.code.startsWith('12') || acc.code.startsWith('13')) {
          currentAssets.push({ code: acc.code, name: acc.name, amount: bal });
        } else {
          nonCurrentAssets.push({ code: acc.code, name: acc.name, amount: bal });
        }
      } else if (acc.accountType === GLAccountType.LIABILITY) {
        const bal = sums.credits.minus(sums.debits);
        totalLiabilities = totalLiabilities.add(bal);
        if (acc.code.startsWith('25')) {
          longTermLiabilities.push({ code: acc.code, name: acc.name, amount: bal });
        } else {
          currentLiabilities.push({ code: acc.code, name: acc.name, amount: bal });
        }
      } else if (acc.accountType === GLAccountType.EQUITY) {
        const bal = sums.credits.minus(sums.debits);
        totalEquity = totalEquity.add(bal);
        equityItems.push({ code: acc.code, name: acc.name, amount: bal });
      } else if (acc.accountType === GLAccountType.REVENUE) {
        cumulativePnlRevenue = cumulativePnlRevenue.add(sums.credits.minus(sums.debits));
      } else if (acc.accountType === GLAccountType.DIRECT_COST || acc.accountType === GLAccountType.EXPENSE) {
        cumulativePnlCosts = cumulativePnlCosts.add(sums.debits.minus(sums.credits));
      }
    }

    const currentPeriodNetSurplus = cumulativePnlRevenue.minus(cumulativePnlCosts);
    const totalLiabilitiesAndEquity = totalLiabilities.add(totalEquity).add(currentPeriodNetSurplus);
    const balanceDiscrepancy = totalAssets.minus(totalLiabilitiesAndEquity).abs();

    return {
      asOfDate: cutoff,
      assets: {
        currentAssets,
        nonCurrentAssets,
        totalAssets
      },
      liabilities: {
        currentLiabilities,
        longTermLiabilities,
        totalLiabilities
      },
      equity: {
        items: equityItems,
        currentPeriodNetSurplus,
        totalEquity: totalEquity.add(currentPeriodNetSurplus)
      },
      totalLiabilitiesAndEquity,
      balanceDiscrepancy,
      isBalanced: balanceDiscrepancy.isZero()
    };
  }

  /**
   * General Ledger Detail Report for an Account
   */
  static async getAccountLedgerReport(
    ctx: TenantContext,
    accountId: string,
    startDate?: Date | string,
    endDate?: Date | string
  ) {
    this.checkReadPermission(ctx);

    const account = await db.gLAccount.findFirst({
      where: { id: accountId, branchId: ctx.branchId }
    });
    if (!account) throw new Error("Account not found.");

    const start = startDate ? new Date(startDate) : new Date(Date.UTC(2000, 0, 1));
    const end = endDate ? new Date(endDate) : new Date();

    // 1. Calculate Opening Balance before start date
    const priorLines = await db.journalLine.findMany({
      where: {
        branchId: ctx.branchId,
        accountId,
        journalEntry: {
          status: JournalStatus.POSTED,
          entryDate: { lt: start }
        }
      }
    });

    let openingBalance = new Prisma.Decimal(0);
    for (const pl of priorLines) {
      if (account.normalBalance === 'DEBIT') {
        openingBalance = openingBalance.add(pl.debit).minus(pl.credit);
      } else {
        openingBalance = openingBalance.add(pl.credit).minus(pl.debit);
      }
    }

    // 2. Fetch period journal lines
    const periodLines = await db.journalLine.findMany({
      where: {
        branchId: ctx.branchId,
        accountId,
        journalEntry: {
          status: JournalStatus.POSTED,
          entryDate: { gte: start, lte: end }
        }
      },
      include: {
        journalEntry: {
          select: {
            journalNumber: true,
            journalType: true,
            entryDate: true,
            description: true,
            referenceType: true,
            referenceId: true
          }
        }
      },
      orderBy: [{ journalEntry: { entryDate: 'asc' } }, { id: 'asc' }]
    });

    let runningBalance = new Prisma.Decimal(openingBalance);
    const rows = periodLines.map(pl => {
      if (account.normalBalance === 'DEBIT') {
        runningBalance = runningBalance.add(pl.debit).minus(pl.credit);
      } else {
        runningBalance = runningBalance.add(pl.credit).minus(pl.debit);
      }

      return {
        id: pl.id,
        date: pl.journalEntry.entryDate,
        journalNumber: pl.journalEntry.journalNumber,
        journalType: pl.journalEntry.journalType,
        referenceType: pl.journalEntry.referenceType,
        referenceId: pl.journalEntry.referenceId,
        description: pl.description || pl.journalEntry.description,
        debit: pl.debit,
        credit: pl.credit,
        runningBalance
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        normalBalance: account.normalBalance,
        accountType: account.accountType
      },
      period: { startDate: start, endDate: end },
      openingBalance,
      closingBalance: runningBalance,
      rows
    };
  }
}
