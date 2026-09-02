import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";
import { db } from "@/lib/db";
import TreasuryDashboardClient from "@/components/finance/TreasuryDashboardClient";

export default async function TreasuryPage() {
  const ctx = await requireAuth();

  const [accounts, summary, shifts, transfers, imprests, statements, reconciliations] =
    await Promise.all([
      TreasuryDAO.getTreasuryAccounts(ctx),
      TreasuryDAO.getLiquiditySummary(ctx),
      TreasuryDAO.getShiftSessions(ctx),
      db.treasuryTransfer.findMany({
        where: { branchId: ctx.branchId },
        include: { fromAccount: true, toAccount: true, initiatedBy: true, approvedBy: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      TreasuryDAO.getPettyCashImprests(ctx),
      db.bankStatement.findMany({
        where: { branchId: ctx.branchId },
        include: { account: true, lines: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.bankReconciliation.findMany({
        where: { branchId: ctx.branchId },
        include: { account: true, statement: true, certifiedBy: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

  const serializedAccounts = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    accountType: a.accountType,
    bankName: a.bankName,
    accountNumber: a.accountNumber,
    currency: a.currency,
    openingBalance: a.openingBalance.toString(),
    currentBalance: a.currentBalance.toString(),
    isDefaultFeeCollection: a.isDefaultFeeCollection,
    isDefaultOperations: a.isDefaultOperations,
    isDefaultPettyCash: a.isDefaultPettyCash,
    isActive: a.isActive,
    custodian: a.custodian ? `${a.custodian.firstName} ${a.custodian.lastName}` : null,
  }));

  const serializedSummary = {
    totalLiquidity: summary.totalLiquidity.toString(),
    commercialBanks: summary.commercialBanks.toString(),
    cashSafes: summary.cashSafes.toString(),
    cashierTills: summary.cashierTills.toString(),
    mobileMoneyFloats: summary.mobileMoneyFloats.toString(),
    pettyCashFloats: summary.pettyCashFloats.toString(),
  };

  const serializedShifts = shifts.map((s) => ({
    id: s.id,
    cashierName: `${s.cashier.firstName} ${s.cashier.lastName}`,
    tillName: s.tillAccount.name,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() || null,
    openingFloat: s.openingFloat.toString(),
    expectedClosingBalance: s.expectedClosingBalance?.toString() || null,
    actualCashCounted: s.actualCashCounted?.toString() || null,
    cashVariance: s.cashVariance?.toString() || null,
    status: s.status,
    varianceNotes: s.varianceNotes,
    supervisorName: s.supervisorWitness
      ? `${s.supervisorWitness.firstName} ${s.supervisorWitness.lastName}`
      : null,
  }));

  const serializedTransfers = transfers.map((t) => ({
    id: t.id,
    transferNumber: t.transferNumber,
    fromAccountName: t.fromAccount.name,
    toAccountName: t.toAccount.name,
    amount: t.amount.toString(),
    transferMethod: t.transferMethod,
    depositSlipNumber: t.depositSlipNumber,
    status: t.status,
    initiatedByName: `${t.initiatedBy.firstName} ${t.initiatedBy.lastName}`,
    approvedByName: t.approvedBy ? `${t.approvedBy.firstName} ${t.approvedBy.lastName}` : null,
    createdAt: t.createdAt.toISOString(),
  }));

  const serializedImprests = imprests.map((i) => ({
    id: i.id,
    name: i.name,
    accountName: i.account.name,
    accountBalance: i.account.currentBalance.toString(),
    floatCeiling: i.floatCeiling.toString(),
    replenishmentThreshold: i.replenishmentThreshold.toString(),
    custodianName: `${i.custodian.firstName} ${i.custodian.lastName}`,
    departmentName: i.department?.name || null,
  }));

  const serializedStatements = statements.map((s) => ({
    id: s.id,
    accountName: s.account.name,
    statementIdentifier: s.statementIdentifier,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    closingBalance: s.closingBalance.toString(),
    linesCount: s.lines.length,
    unreconciledCount: s.lines.filter((l) => l.matchStatus === "UNRECONCILED").length,
  }));

  const serializedReconciliations = reconciliations.map((r) => ({
    id: r.id,
    reconciliationNumber: r.reconciliationNumber,
    accountName: r.account.name,
    statementIdentifier: r.statement.statementIdentifier,
    statementClosingBalance: r.statementClosingBalance.toString(),
    cashbookClosingBalance: r.cashbookClosingBalance.toString(),
    adjustedBankBalance: r.adjustedBankBalance.toString(),
    adjustedCashbookBalance: r.adjustedCashbookBalance.toString(),
    variance: r.variance.toString(),
    status: r.status,
    certifiedByName: r.certifiedBy ? `${r.certifiedBy.firstName} ${r.certifiedBy.lastName}` : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <TreasuryDashboardClient
      initialAccounts={serializedAccounts}
      initialSummary={serializedSummary}
      initialShifts={serializedShifts}
      initialTransfers={serializedTransfers}
      initialImprests={serializedImprests}
      initialStatements={serializedStatements}
      initialReconciliations={serializedReconciliations}
    />
  );
}
