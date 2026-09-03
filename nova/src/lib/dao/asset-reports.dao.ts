import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import { Prisma, AssetStatus, AssetCategoryType } from "@prisma/client";

export class AssetReportsDAO {
  /**
   * 1. Authoritative Fixed Asset Register
   */
  static async getFixedAssetRegister(
    ctx: TenantContext,
    filters?: {
      categoryId?: string;
      status?: AssetStatus;
      locationId?: string;
      custodianId?: string;
    }
  ) {
    const where: Prisma.AssetItemWhereInput = {
      branchId: ctx.branchId
    };

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.status) where.status = filters.status;
    if (filters?.locationId) where.locationId = filters.locationId;
    if (filters?.custodianId) where.custodianId = filters.custodianId;

    const assets = await db.assetItem.findMany({
      where,
      include: {
        category: true,
        location: true,
        custodian: true,
        transportVehicle: true,
        disposalRecord: true
      },
      orderBy: { assetTag: "asc" }
    });

    let totalGrossCost = new Prisma.Decimal(0);
    let totalAccumDeprec = new Prisma.Decimal(0);
    let totalNetBookValue = new Prisma.Decimal(0);

    for (const a of assets) {
      if (a.status !== AssetStatus.DISPOSED && a.status !== AssetStatus.WRITTEN_OFF) {
        totalGrossCost = totalGrossCost.add(a.acquisitionCost);
        totalAccumDeprec = totalAccumDeprec.add(a.accumulatedDepreciation);
        totalNetBookValue = totalNetBookValue.add(a.netBookValue);
      }
    }

    return {
      summary: {
        totalAssetsCount: assets.length,
        activeAssetsCount: assets.filter(a => a.status === AssetStatus.ACTIVE || a.status === AssetStatus.IN_REPAIR).length,
        fullyDepreciatedCount: assets.filter(a => a.status === AssetStatus.FULLY_DEPRECIATED).length,
        disposedCount: assets.filter(a => a.status === AssetStatus.DISPOSED || a.status === AssetStatus.WRITTEN_OFF).length,
        totalGrossCost,
        totalAccumDeprec,
        totalNetBookValue
      },
      assets
    };
  }

  /**
   * 2. Fixed Asset Subledger vs General Ledger Telemetry & Reconciliation
   */
  static async reconcileFixedAssetsSubledger(ctx: TenantContext) {
    // 1. Calculate Active Subledger Totals (Excluding retired/disposed assets)
    const activeAssets = await db.assetItem.findMany({
      where: {
        branchId: ctx.branchId,
        status: { in: [AssetStatus.ACTIVE, AssetStatus.IN_REPAIR, AssetStatus.FULLY_DEPRECIATED] }
      },
      include: {
        category: true
      }
    });

    let subledgerTotalCost = new Prisma.Decimal(0);
    let subledgerTotalAccum = new Prisma.Decimal(0);

    // Grouping by Category
    const categoryBreakdownMap = new Map<string, {
      categoryCode: string;
      categoryName: string;
      categoryType: AssetCategoryType;
      count: number;
      subledgerCost: Prisma.Decimal;
      subledgerAccum: Prisma.Decimal;
      subledgerNbv: Prisma.Decimal;
      glAssetAccountId?: string;
    }>();

    for (const a of activeAssets) {
      subledgerTotalCost = subledgerTotalCost.add(a.acquisitionCost);
      subledgerTotalAccum = subledgerTotalAccum.add(a.accumulatedDepreciation);

      const catId = a.categoryId;
      const existing = categoryBreakdownMap.get(catId) || {
        categoryCode: a.category.code,
        categoryName: a.category.name,
        categoryType: a.category.categoryType,
        count: 0,
        subledgerCost: new Prisma.Decimal(0),
        subledgerAccum: new Prisma.Decimal(0),
        subledgerNbv: new Prisma.Decimal(0),
        glAssetAccountId: a.category.glAssetAccountId || undefined
      };

      existing.count += 1;
      existing.subledgerCost = existing.subledgerCost.add(a.acquisitionCost);
      existing.subledgerAccum = existing.subledgerAccum.add(a.accumulatedDepreciation);
      existing.subledgerNbv = existing.subledgerNbv.add(a.netBookValue);
      categoryBreakdownMap.set(catId, existing);
    }

    const subledgerNetBookValue = subledgerTotalCost.sub(subledgerTotalAccum);

    // 2. Fetch General Ledger Balances for PPE Accounts (#1510-#1580) and Accum Deprec (#1600)
    const ppeAccounts = await db.gLAccount.findMany({
      where: {
        branchId: ctx.branchId,
        OR: [
          { code: { startsWith: "15" } },
          { code: "1600" }
        ]
      },
      include: {
        journalLines: {
          where: { journalEntry: { status: "POSTED" } }
        }
      }
    });

    let glGrossPPE = new Prisma.Decimal(0);
    let glAccumDeprec = new Prisma.Decimal(0);

    for (const acc of ppeAccounts) {
      let debitSum = new Prisma.Decimal(0);
      let creditSum = new Prisma.Decimal(0);
      for (const jl of acc.journalLines) {
        debitSum = debitSum.add(jl.debit);
        creditSum = creditSum.add(jl.credit);
      }

      if (acc.code === "1600") {
        // Contra-Asset with Normal Credit balance
        glAccumDeprec = creditSum.sub(debitSum);
      } else if (acc.code.startsWith("15") && !acc.isHeader) {
        // Asset with Normal Debit balance
        glGrossPPE = glGrossPPE.add(debitSum.sub(creditSum));
      }
    }

    const glNetBookValue = glGrossPPE.sub(glAccumDeprec);

    const costVariance = subledgerTotalCost.sub(glGrossPPE);
    const accumVariance = subledgerTotalAccum.sub(glAccumDeprec);
    const nbvVariance = subledgerNetBookValue.sub(glNetBookValue);

    const isReconciled = costVariance.isZero() && accumVariance.isZero();

    return {
      isReconciled,
      asOfDate: new Date(),
      subledger: {
        activeAssetsCount: activeAssets.length,
        totalGrossCost: subledgerTotalCost,
        totalAccumDeprec: subledgerTotalAccum,
        totalNetBookValue: subledgerNetBookValue
      },
      generalLedger: {
        glGrossPPE,
        glAccumDeprec,
        glNetBookValue
      },
      variance: {
        costVariance,
        accumVariance,
        nbvVariance
      },
      categoryBreakdown: Array.from(categoryBreakdownMap.values())
    };
  }

  /**
   * 3. Asset Disposal Gain / Loss Audit Report
   */
  static async getDisposalReport(
    ctx: TenantContext,
    fromDate?: Date,
    toDate?: Date
  ) {
    const where: Prisma.AssetDisposalWhereInput = {
      branchId: ctx.branchId
    };

    if (fromDate || toDate) {
      where.disposalDate = {};
      if (fromDate) where.disposalDate.gte = fromDate;
      if (toDate) where.disposalDate.lte = toDate;
    }

    const disposals = await db.assetDisposal.findMany({
      where,
      include: {
        asset: { include: { category: true } },
        treasuryAccount: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { disposalDate: "desc" }
    });

    let totalProceeds = new Prisma.Decimal(0);
    let totalCostRelieved = new Prisma.Decimal(0);
    let totalAccumRelieved = new Prisma.Decimal(0);
    let totalGain = new Prisma.Decimal(0);
    let totalLoss = new Prisma.Decimal(0);

    for (const d of disposals) {
      totalProceeds = totalProceeds.add(d.disposalProceeds);
      totalCostRelieved = totalCostRelieved.add(d.costAtDisposal);
      totalAccumRelieved = totalAccumRelieved.add(d.accumDeprecAtDisposal);
      if (new Prisma.Decimal(d.gainOrLossAmount).gt(0)) {
        totalGain = totalGain.add(d.gainOrLossAmount);
      } else if (new Prisma.Decimal(d.gainOrLossAmount).lt(0)) {
        totalLoss = totalLoss.add(new Prisma.Decimal(d.gainOrLossAmount).abs());
      }
    }

    return {
      summary: {
        totalDisposalsCount: disposals.length,
        totalProceeds,
        totalCostRelieved,
        totalAccumRelieved,
        totalGain,
        totalLoss,
        netDisposalImpact: totalGain.sub(totalLoss)
      },
      disposals
    };
  }
}
