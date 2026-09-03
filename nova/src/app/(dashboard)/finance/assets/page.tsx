import { requireAuth } from "@/lib/auth/require-auth";
import { AssetDAO, AssetCategoryDAO, AssetLocationDAO } from "@/lib/dao/asset.dao";
import { AssetDepreciationEngine } from "@/lib/dao/asset-depreciation.engine";
import { AssetReportsDAO } from "@/lib/dao/asset-reports.dao";
import { FiscalPeriodDAO } from "@/lib/dao/gl.dao";
import { db } from "@/lib/db";
import { FixedAssetsClient } from "@/components/finance/FixedAssetsClient";

export default async function FixedAssetsPage() {
  const ctx = await requireAuth();

  // Ensure default categories are initialized
  await AssetCategoryDAO.initDefaultCategories(ctx);

  const [
    report,
    assets,
    categories,
    locations,
    runs,
    treasuryAccounts,
    periods,
    reconciliation
  ] = await Promise.all([
    AssetReportsDAO.getFixedAssetRegister(ctx),
    AssetDAO.listAssets(ctx),
    AssetCategoryDAO.listCategories(ctx),
    AssetLocationDAO.listLocations(ctx),
    AssetDepreciationEngine.listRuns(ctx),
    db.treasuryAccount.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      orderBy: { code: "asc" }
    }),
    FiscalPeriodDAO.listPeriods(ctx),
    AssetReportsDAO.reconcileFixedAssetsSubledger(ctx)
  ]);

  const serializedSummary = {
    totalAssetsCount: report.summary.totalAssetsCount,
    activeAssetsCount: report.summary.activeAssetsCount,
    fullyDepreciatedCount: report.summary.fullyDepreciatedCount,
    disposedCount: report.summary.disposedCount,
    totalGrossCost: report.summary.totalGrossCost.toString(),
    totalAccumDeprec: report.summary.totalAccumDeprec.toString(),
    totalNetBookValue: report.summary.totalNetBookValue.toString()
  };

  const serializedAssets = assets.map((a) => ({
    id: a.id,
    assetTag: a.assetTag,
    name: a.name,
    description: a.description,
    categoryId: a.categoryId,
    locationId: a.locationId,
    custodianId: a.custodianId,
    serialNumber: a.serialNumber,
    modelNumber: a.modelNumber,
    purchaseDate: a.purchaseDate.toISOString(),
    capitalizationDate: a.capitalizationDate.toISOString(),
    status: a.status,
    condition: a.condition,
    capitalizationSource: a.capitalizationSource,
    acquisitionCost: a.acquisitionCost.toString(),
    salvageValue: a.salvageValue.toString(),
    accumulatedDepreciation: a.accumulatedDepreciation.toString(),
    netBookValue: a.netBookValue.toString(),
    depreciationMethod: a.depreciationMethod,
    usefulLifeMonths: a.usefulLifeMonths,
    annualDepreciationRate: a.annualDepreciationRate?.toString() || null,
    category: {
      code: a.category.code,
      name: a.category.name,
      categoryType: a.category.categoryType
    },
    location: a.location ? { code: a.location.code, name: a.location.name } : null,
    custodian: a.custodian ? { firstName: a.custodian.firstName, lastName: a.custodian.lastName, employeeCode: a.custodian.employeeCode } : null,
    transportVehicle: a.transportVehicle ? { registrationNumber: a.transportVehicle.registrationNumber, makeModel: a.transportVehicle.makeModel } : null
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    categoryType: c.categoryType,
    depreciationMethod: c.depreciationMethod,
    usefulLifeMonths: c.usefulLifeMonths,
    annualDepreciationRate: c.annualDepreciationRate.toString(),
    defaultSalvagePercent: c.defaultSalvagePercent.toString(),
    glAssetAccountId: c.glAssetAccountId,
    glDepreciationAccountId: c.glDepreciationAccountId,
    glAccumDeprecAccountId: c.glAccumDeprecAccountId,
    glAssetAccount: c.glAssetAccount ? { code: c.glAssetAccount.code, name: c.glAssetAccount.name } : null,
    glDepreciationAccount: c.glDepreciationAccount ? { code: c.glDepreciationAccount.code, name: c.glDepreciationAccount.name } : null,
    glAccumDeprecAccount: c.glAccumDeprecAccount ? { code: c.glAccumDeprecAccount.code, name: c.glAccumDeprecAccount.name } : null
  }));

  const serializedLocations = locations.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    building: l.building,
    roomNumber: l.roomNumber
  }));

  const serializedRuns = runs.map((r) => ({
    id: r.id,
    runNumber: r.runNumber,
    periodId: r.periodId,
    runDate: r.runDate.toISOString(),
    status: r.status,
    totalAssetsCount: r.totalAssetsCount,
    totalDepreciationAmount: r.totalDepreciationAmount.toString(),
    fiscalPeriod: { name: r.fiscalPeriod.name, status: r.fiscalPeriod.status },
    createdBy: { firstName: r.createdBy.firstName, lastName: r.createdBy.lastName },
    approvedBy: r.approvedBy ? { firstName: r.approvedBy.firstName, lastName: r.approvedBy.lastName } : null,
    journalEntryId: r.journalEntryId
  }));

  const serializedTreasuryAccounts = treasuryAccounts.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    accountType: t.accountType,
    currentBalance: t.currentBalance.toString()
  }));

  const serializedPeriods = periods.map((p) => ({
    id: p.id,
    periodNumber: p.periodNumber,
    name: p.name,
    status: p.status,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString()
  }));

  const serializedReconciliation = {
    isReconciled: reconciliation.isReconciled,
    asOfDate: reconciliation.asOfDate.toISOString(),
    subledger: {
      activeAssetsCount: reconciliation.subledger.activeAssetsCount,
      totalGrossCost: reconciliation.subledger.totalGrossCost.toString(),
      totalAccumDeprec: reconciliation.subledger.totalAccumDeprec.toString(),
      totalNetBookValue: reconciliation.subledger.totalNetBookValue.toString()
    },
    generalLedger: {
      glGrossPPE: reconciliation.generalLedger.glGrossPPE.toString(),
      glAccumDeprec: reconciliation.generalLedger.glAccumDeprec.toString(),
      glNetBookValue: reconciliation.generalLedger.glNetBookValue.toString()
    },
    variance: {
      costVariance: reconciliation.variance.costVariance.toString(),
      accumVariance: reconciliation.variance.accumVariance.toString(),
      nbvVariance: reconciliation.variance.nbvVariance.toString()
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <FixedAssetsClient
        summary={serializedSummary}
        initialAssets={serializedAssets}
        categories={serializedCategories}
        locations={serializedLocations}
        runs={serializedRuns}
        treasuryAccounts={serializedTreasuryAccounts}
        fiscalPeriods={serializedPeriods}
        initialReconciliation={serializedReconciliation}
        currentUserId={ctx.userId}
      />
    </div>
  );
}
