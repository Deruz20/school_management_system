import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  DepreciationMethod,
  AssetStatus,
  DepreciationRunStatus,
  JournalType,
  PeriodStatus
} from "@prisma/client";
import { AuditService } from "@/lib/services/audit.service";
import { GLEngineDAO, GLAccountDAO } from "@/lib/dao/gl.dao";
import { AssetSequenceDAO } from "@/lib/dao/asset.dao";

export interface DepreciationCalculationResult {
  assetId: string;
  openingBookValue: Prisma.Decimal;
  depreciationAmount: Prisma.Decimal;
  closingBookValue: Prisma.Decimal;
  depreciationMethod: DepreciationMethod;
  rateApplied: Prisma.Decimal;
  activeDaysInPeriod: number;
  totalDaysInPeriod: number;
}

export class AssetDepreciationEngine {
  /**
   * Helper to get exact days in a specific calendar month
   */
  static getDaysInMonth(year: number, monthZeroIndexed: number): number {
    return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
  }

  /**
   * Exact Mathematical Calculation for a Single Asset in a Target Period
   */
  static calculateAssetPeriodicDepreciation(
    asset: {
      id: string;
      acquisitionCost: Prisma.Decimal;
      salvageValue: Prisma.Decimal;
      netBookValue: Prisma.Decimal;
      accumulatedDepreciation: Prisma.Decimal;
      capitalizationDate: Date;
      depreciationMethod: DepreciationMethod | null;
      usefulLifeMonths: number | null;
      annualDepreciationRate: Prisma.Decimal | null;
      category: {
        depreciationMethod: DepreciationMethod;
        usefulLifeMonths: number;
        annualDepreciationRate: Prisma.Decimal;
      };
    },
    period: {
      startDate: Date;
      endDate: Date;
    }
  ): DepreciationCalculationResult | null {
    const cost = new Prisma.Decimal(asset.acquisitionCost);
    const salvage = new Prisma.Decimal(asset.salvageValue);
    const currentNbv = new Prisma.Decimal(asset.netBookValue);

    // If NBV is already at or below salvage, no further depreciation
    if (currentNbv.lte(salvage)) {
      return null;
    }

    // If asset was capitalized after period end date, not yet active in this period
    const capDate = new Date(asset.capitalizationDate);
    const periodStart = new Date(period.startDate);
    const periodEnd = new Date(period.endDate);

    if (capDate > periodEnd) {
      return null;
    }

    const method = asset.depreciationMethod || asset.category.depreciationMethod;
    if (method === DepreciationMethod.NONE) {
      return null;
    }

    // Calculate calendar days in period
    const year = periodStart.getUTCFullYear();
    const month = periodStart.getUTCMonth();
    const totalDaysInMonth = AssetDepreciationEngine.getDaysInMonth(year, month);

    let activeDays = totalDaysInMonth;
    if (capDate >= periodStart && capDate <= periodEnd) {
      // Capitalized during this month
      const capDay = capDate.getUTCDate();
      activeDays = totalDaysInMonth - capDay + 1;
    }

    if (activeDays <= 0) return null;

    const proRataFactor = new Prisma.Decimal(activeDays).div(new Prisma.Decimal(totalDaysInMonth));
    let rawAmount = new Prisma.Decimal(0);
    let rateApplied = new Prisma.Decimal(0);

    const maxAllowable = currentNbv.sub(salvage);

    if (method === DepreciationMethod.STRAIGHT_LINE) {
      const usefulMonths = asset.usefulLifeMonths || asset.category.usefulLifeMonths || 36;
      if (usefulMonths <= 0) return null;

      const depreciableBasis = cost.sub(salvage);
      const monthlyFullCharge = depreciableBasis.div(new Prisma.Decimal(usefulMonths));
      rawAmount = monthlyFullCharge.mul(proRataFactor);
      rateApplied = new Prisma.Decimal(100).div(new Prisma.Decimal(usefulMonths / 12));
    } else if (method === DepreciationMethod.REDUCING_BALANCE) {
      const annualRate = asset.annualDepreciationRate || asset.category.annualDepreciationRate || new Prisma.Decimal(25);
      const monthlyRate = new Prisma.Decimal(annualRate).div(new Prisma.Decimal(1200)); // Rate / 100 / 12
      const fullMonthCharge = currentNbv.mul(monthlyRate);
      rawAmount = fullMonthCharge.mul(proRataFactor);
      rateApplied = new Prisma.Decimal(annualRate);
    }

    // Round to 2 decimal places
    let finalAmount = new Prisma.Decimal(rawAmount.toFixed(2));

    // Cap at remaining depreciable value
    if (finalAmount.gt(maxAllowable)) {
      finalAmount = maxAllowable;
    }

    if (finalAmount.lte(0)) {
      return null;
    }

    const closingBookValue = currentNbv.sub(finalAmount);

    return {
      assetId: asset.id,
      openingBookValue: currentNbv,
      depreciationAmount: finalAmount,
      closingBookValue,
      depreciationMethod: method,
      rateApplied: new Prisma.Decimal(rateApplied.toFixed(2)),
      activeDaysInPeriod: activeDays,
      totalDaysInPeriod: totalDaysInMonth
    };
  }

  /**
   * 1. Generate Batch Depreciation Schedule Run (Maker: Accountant)
   * Transitions immediately to SUBMITTED for Checker review
   */
  static async createDepreciationRun(
    ctx: TenantContext,
    periodId: string,
    notes?: string
  ) {
    return await db.$transaction(async (tx) => {
      // 1. Verify Fiscal Period is OPEN
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: periodId, branchId: ctx.branchId }
      });
      if (!period) throw new Error("Fiscal period not found.");
      if (period.status !== PeriodStatus.OPEN) {
        throw new Error(`Cannot run depreciation in a ${period.status} fiscal period.`);
      }

      // 2. Verify no active/completed run for this period
      const existingRun = await tx.assetDepreciationRun.findFirst({
        where: {
          branchId: ctx.branchId,
          periodId: period.id,
          status: { in: [DepreciationRunStatus.DRAFT, DepreciationRunStatus.SUBMITTED, DepreciationRunStatus.APPROVED, DepreciationRunStatus.POSTED] }
        }
      });
      if (existingRun) {
        throw new Error(`A depreciation run (${existingRun.runNumber}) already exists for period ${period.name} with status ${existingRun.status}.`);
      }

      // 3. Find all candidate assets
      const candidateAssets = await tx.assetItem.findMany({
        where: {
          branchId: ctx.branchId,
          status: { in: [AssetStatus.ACTIVE, AssetStatus.IN_REPAIR] },
          netBookValue: { gt: 0 },
          capitalizationDate: { lte: period.endDate }
        },
        include: {
          category: true
        }
      });

      const linesToCreate: DepreciationCalculationResult[] = [];
      let totalAmount = new Prisma.Decimal(0);

      for (const asset of candidateAssets) {
        const line = AssetDepreciationEngine.calculateAssetPeriodicDepreciation(asset, {
          startDate: period.startDate,
          endDate: period.endDate
        });
        if (line && line.depreciationAmount.gt(0)) {
          linesToCreate.push(line);
          totalAmount = totalAmount.add(line.depreciationAmount);
        }
      }

      if (linesToCreate.length === 0) {
        throw new Error("No qualifying assets found for depreciation in this period.");
      }

      const runNumber = await AssetSequenceDAO.nextRunNumber(ctx, tx);

      const run = await tx.assetDepreciationRun.create({
        data: {
          branchId: ctx.branchId,
          runNumber,
          periodId: period.id,
          runDate: period.endDate,
          status: DepreciationRunStatus.SUBMITTED,
          totalAssetsCount: linesToCreate.length,
          totalDepreciationAmount: totalAmount,
          createdById: ctx.userId,
          notes: notes?.trim()
        }
      });

      // Bulk create lines
      for (const line of linesToCreate) {
        await tx.assetDepreciationLine.create({
          data: {
            depreciationRunId: run.id,
            assetId: line.assetId,
            openingBookValue: line.openingBookValue,
            depreciationAmount: line.depreciationAmount,
            closingBookValue: line.closingBookValue,
            depreciationMethod: line.depreciationMethod,
            rateApplied: line.rateApplied,
            activeDaysInPeriod: line.activeDaysInPeriod,
            totalDaysInPeriod: line.totalDaysInPeriod
          }
        });
      }

      await AuditService.log(
        ctx,
        "CREATE_DEPRECIATION_RUN",
        "AssetDepreciationRun",
        run.id,
        JSON.stringify({ runNumber: run.runNumber, assetsCount: linesToCreate.length, total: totalAmount.toString() })
      );

      return run;
    });
  }

  /**
   * 2. Four-Eye Review & Approval (Checker: Bursar / Head Teacher)
   */
  static async approveDepreciationRun(
    ctx: TenantContext,
    runId: string
  ) {
    return await db.$transaction(async (tx) => {
      const run = await tx.assetDepreciationRun.findFirst({
        where: { id: runId, branchId: ctx.branchId }
      });
      if (!run) throw new Error("Depreciation run not found.");

      if (run.status !== DepreciationRunStatus.SUBMITTED) {
        throw new Error(`Cannot approve a run with status ${run.status}.`);
      }

      // Strict Maker-Checker constraint
      if (run.createdById === ctx.userId) {
        throw new Error("Four-Eye Policy: The maker who prepared the depreciation run cannot self-approve it.");
      }

      const approved = await tx.assetDepreciationRun.update({
        where: { id: run.id },
        data: {
          status: DepreciationRunStatus.APPROVED,
          approvedById: ctx.userId,
          approvedAt: new Date()
        }
      });

      await AuditService.log(ctx, "APPROVE_DEPRECIATION_RUN", "AssetDepreciationRun", run.id, JSON.stringify({ runNumber: run.runNumber }));
      return approved;
    });
  }

  /**
   * 3. Rejection of Submitted Run
   */
  static async rejectDepreciationRun(
    ctx: TenantContext,
    runId: string,
    reason: string
  ) {
    if (!reason || !reason.trim()) throw new Error("Rejection reason is required.");

    return await db.$transaction(async (tx) => {
      const run = await tx.assetDepreciationRun.findFirst({
        where: { id: runId, branchId: ctx.branchId }
      });
      if (!run) throw new Error("Depreciation run not found.");

      if (run.status !== DepreciationRunStatus.SUBMITTED && run.status !== DepreciationRunStatus.APPROVED) {
        throw new Error(`Cannot reject a run with status ${run.status}.`);
      }

      const rejected = await tx.assetDepreciationRun.update({
        where: { id: run.id },
        data: {
          status: DepreciationRunStatus.REJECTED,
          rejectionReason: reason.trim()
        }
      });

      await AuditService.log(ctx, "REJECT_DEPRECIATION_RUN", "AssetDepreciationRun", run.id, JSON.stringify({ reason }));
      return rejected;
    });
  }

  /**
   * 4. Post Approved Depreciation Run to General Ledger
   * Dr. Depreciation Expense (#6900) / Cr. Accumulated Depreciation (#1600)
   */
  static async postDepreciationRun(
    ctx: TenantContext,
    runId: string
  ) {
    return await db.$transaction(async (tx) => {
      const run = await tx.assetDepreciationRun.findFirst({
        where: { id: runId, branchId: ctx.branchId },
        include: {
          fiscalPeriod: true,
          lines: {
            include: {
              asset: {
                include: { category: true }
              }
            }
          }
        }
      });
      if (!run) throw new Error("Depreciation run not found.");

      if (run.status !== DepreciationRunStatus.APPROVED) {
        throw new Error(`Only APPROVED depreciation runs can be posted to GL. Current status: ${run.status}.`);
      }

      if (run.fiscalPeriod.status !== PeriodStatus.OPEN) {
        throw new Error(`Cannot post depreciation into ${run.fiscalPeriod.status} fiscal period ${run.fiscalPeriod.name}.`);
      }

      // Group journal lines by GL accounts
      const debitExpenseMap = new Map<string, Prisma.Decimal>();
      const creditAccumMap = new Map<string, Prisma.Decimal>();

      const defaultDeprecAcc = (await GLAccountDAO.getAccountByCode(ctx, "6900", tx))!.id;
      const defaultAccumAcc = (await GLAccountDAO.getAccountByCode(ctx, "1600", tx))!.id;

      for (const line of run.lines) {
        const deprecAccId = line.asset.category.glDepreciationAccountId || defaultDeprecAcc;
        const accumAccId = line.asset.category.glAccumDeprecAccountId || defaultAccumAcc;

        const currentDebit = debitExpenseMap.get(deprecAccId) || new Prisma.Decimal(0);
        debitExpenseMap.set(deprecAccId, currentDebit.add(line.depreciationAmount));

        const currentCredit = creditAccumMap.get(accumAccId) || new Prisma.Decimal(0);
        creditAccumMap.set(accumAccId, currentCredit.add(line.depreciationAmount));

        // Update AssetItem Subledger Record
        const newAccum = new Prisma.Decimal(line.asset.accumulatedDepreciation).add(line.depreciationAmount);
        const newNbv = line.closingBookValue;
        const isFullyDepreciated = newNbv.lte(line.asset.salvageValue);

        await tx.assetItem.update({
          where: { id: line.assetId },
          data: {
            accumulatedDepreciation: newAccum,
            netBookValue: newNbv,
            lastDepreciationDate: run.runDate,
            status: isFullyDepreciated ? AssetStatus.FULLY_DEPRECIATED : line.asset.status
          }
        });
      }

      // Construct Balanced GL Journal Lines
      const journalLines: Array<{ accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description: string }> = [];

      for (const [accId, amt] of debitExpenseMap.entries()) {
        journalLines.push({
          accountId: accId,
          debit: amt,
          credit: new Prisma.Decimal(0),
          description: `Depreciation Expense: Run ${run.runNumber} for ${run.fiscalPeriod.name}`
        });
      }

      for (const [accId, amt] of creditAccumMap.entries()) {
        journalLines.push({
          accountId: accId,
          debit: new Prisma.Decimal(0),
          credit: amt,
          description: `Accumulated Depreciation: Run ${run.runNumber}`
        });
      }

      const idempotencyKey = `${ctx.branchId}:DEP_RUN:${run.id}:POST`;

      const { journal } = await GLEngineDAO.postJournalEntry(
        ctx,
        {
          journalType: JournalType.DEPRECIATION,
          entryDate: run.runDate,
          description: `Periodic Fixed Asset Depreciation: Run ${run.runNumber} (${run.fiscalPeriod.name})`,
          referenceType: "DEPRECIATION_RUN",
          referenceId: run.id,
          idempotencyKey,
          bypassControlAccountValidation: true,
          lines: journalLines
        },
        tx
      );

      const posted = await tx.assetDepreciationRun.update({
        where: { id: run.id },
        data: {
          status: DepreciationRunStatus.POSTED,
          journalEntryId: journal.id
        }
      });

      await AuditService.log(
        ctx,
        "POST_DEPRECIATION_RUN",
        "AssetDepreciationRun",
        run.id,
        JSON.stringify({ runNumber: run.runNumber, journalId: journal.id, total: run.totalDepreciationAmount.toString() })
      );

      return posted;
    });
  }

  /**
   * Helper: Get Run Details
   */
  static async getRunById(ctx: TenantContext, runId: string, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.assetDepreciationRun.findFirst({
      where: { id: runId, branchId: ctx.branchId },
      include: {
        fiscalPeriod: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        journalEntry: { include: { lines: { include: { account: true } } } },
        lines: {
          include: {
            asset: {
              include: { category: true, location: true }
            }
          },
          orderBy: { asset: { assetTag: "asc" } }
        }
      }
    });
  }

  /**
   * Helper: List Depreciation Runs
   */
  static async listRuns(ctx: TenantContext, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.assetDepreciationRun.findMany({
      where: { branchId: ctx.branchId },
      include: {
        fiscalPeriod: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
