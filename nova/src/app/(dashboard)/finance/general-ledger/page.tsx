import { requireAuth } from "@/lib/auth/require-auth";
import { GLAccountDAO, FiscalPeriodDAO, GLEngineDAO } from "@/lib/dao/gl.dao";
import { db } from "@/lib/db";
import GeneralLedgerClient from "@/components/finance/GeneralLedgerClient";

export default async function GeneralLedgerPage() {
  const ctx = await requireAuth();

  // Ensure COA is initialized
  await GLAccountDAO.initBranchChartOfAccounts(ctx.branchId);

  const [accounts, journals, periods, reconciliation] = await Promise.all([
    GLAccountDAO.listAccounts(ctx),
    db.journalEntry.findMany({
      where: { branchId: ctx.branchId },
      orderBy: [{ entryDate: "desc" }, { journalNumber: "desc" }],
      take: 50,
      include: {
        lines: {
          include: { account: true },
          orderBy: { lineNumber: "asc" }
        }
      }
    }),
    FiscalPeriodDAO.listPeriods(ctx),
    GLEngineDAO.reconcileSubledgers(ctx)
  ]);

  const serializedAccounts = accounts.map(a => ({
    id: a.id,
    code: a.code,
    name: a.name,
    accountType: a.accountType,
    normalBalance: a.normalBalance,
    controlRole: a.controlRole,
    isHeader: a.isHeader,
    parentId: a.parentId
  }));

  const serializedJournals = journals.map(j => ({
    id: j.id,
    journalNumber: j.journalNumber,
    journalType: j.journalType,
    status: j.status,
    entryDate: j.entryDate.toISOString(),
    description: j.description,
    referenceType: j.referenceType,
    referenceId: j.referenceId,
    lines: j.lines.map(l => ({
      id: l.id,
      accountId: l.accountId,
      lineNumber: l.lineNumber,
      description: l.description,
      debit: l.debit.toString(),
      credit: l.credit.toString(),
      account: {
        code: l.account.code,
        name: l.account.name
      }
    }))
  }));

  const serializedPeriods = periods.map(p => ({
    id: p.id,
    periodNumber: p.periodNumber,
    name: p.name,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    status: p.status
  }));

  const serializedReconciliation = {
    isFullyBalanced: reconciliation.isFullyBalanced,
    ar: {
      glBalance: reconciliation.ar.glBalance.toString(),
      subledgerTotal: reconciliation.ar.subledgerTotal.toString(),
      drift: reconciliation.ar.drift.toString(),
      isBalanced: reconciliation.ar.isBalanced
    },
    treasury: {
      glBalance: reconciliation.treasury.glBalance.toString(),
      subledgerTotal: reconciliation.treasury.subledgerTotal.toString(),
      drift: reconciliation.treasury.drift.toString(),
      isBalanced: reconciliation.treasury.isBalanced
    },
    inventory: {
      glBalance: reconciliation.inventory.glBalance.toString(),
      subledgerTotal: reconciliation.inventory.subledgerTotal.toString(),
      drift: reconciliation.inventory.drift.toString(),
      isBalanced: reconciliation.inventory.isBalanced
    }
  };

  return (
    <GeneralLedgerClient
      initialAccounts={serializedAccounts}
      initialJournals={serializedJournals}
      initialPeriods={serializedPeriods}
      initialReconciliation={serializedReconciliation}
    />
  );
}
