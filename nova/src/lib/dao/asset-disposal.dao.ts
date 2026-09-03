import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  AssetStatus,
  AssetDisposalType,
  CashbookMovementType,
  CashDirection,
  JournalType,
  VehicleStatus
} from "@prisma/client";
import { AuditService } from "@/lib/services/audit.service";
import { GLEngineDAO, GLAccountDAO } from "@/lib/dao/gl.dao";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export interface AssetDisposalInput {
  assetId: string;
  disposalDate: Date;
  disposalType: AssetDisposalType;
  disposalProceeds?: number | Prisma.Decimal;
  reason: string;
  buyerDetails?: string;
  treasuryAccountId?: string;
}

export class AssetDisposalDAO {
  /**
   * Execute Fixed Asset Disposal & Retirement Atomic Transaction
   */
  static async disposeAsset(
    ctx: TenantContext,
    input: AssetDisposalInput
  ) {
    const proceeds = new Prisma.Decimal(input.disposalProceeds || 0);

    if (proceeds.lt(0)) {
      throw new Error("Disposal proceeds cannot be negative.");
    }
    if (proceeds.gt(0) && !input.treasuryAccountId) {
      throw new Error("Target treasury account is required when disposal proceeds are greater than zero.");
    }
    if (!input.reason || !input.reason.trim()) {
      throw new Error("Disposal reason is required.");
    }

    return await db.$transaction(async (tx) => {
      // 1. Fetch & Validate Asset
      const asset = await tx.assetItem.findFirst({
        where: { id: input.assetId, branchId: ctx.branchId },
        include: {
          category: true,
          transportVehicle: true,
          disposalRecord: true
        }
      });
      if (!asset) throw new Error("Asset item not found.");

      if (asset.status === AssetStatus.DISPOSED || asset.status === AssetStatus.WRITTEN_OFF) {
        throw new Error(`Asset ${asset.assetTag} is already ${asset.status}.`);
      }
      if (asset.disposalRecord) {
        throw new Error(`Asset ${asset.assetTag} already has a recorded disposal voucher.`);
      }

      const cost = new Prisma.Decimal(asset.acquisitionCost);
      const accum = new Prisma.Decimal(asset.accumulatedDepreciation);
      const nbv = cost.sub(accum);

      // Calculate Gain or Loss
      // Positive = Gain, Negative = Loss
      const gainOrLoss = proceeds.sub(nbv);

      // 2. Handle Treasury Proceeds if any
      let treasuryAcc: { id: string; name: string; glAccountId: string | null; currentBalance: Prisma.Decimal } | null = null;
      let cashbookMovement: { id: string } | null = null;

      if (proceeds.gt(0)) {
        treasuryAcc = await tx.treasuryAccount.findFirst({
          where: { id: input.treasuryAccountId, branchId: ctx.branchId }
        });
        if (!treasuryAcc) throw new Error("Treasury account not found in this branch.");

        const updatedTreasury = await tx.treasuryAccount.update({
          where: { id: treasuryAcc.id },
          data: { currentBalance: { increment: proceeds } }
        });

        const movNumber = await TreasuryDAO.getNextTreasurySequence(tx, ctx.branchId, "CBM");

        cashbookMovement = await tx.cashbookMovement.create({
          data: {
            branchId: ctx.branchId,
            accountId: treasuryAcc.id,
            movementNumber: movNumber,
            movementType: CashbookMovementType.ASSET_SALE_PROCEEDS,
            direction: CashDirection.INFLOW,
            amount: proceeds,
            balanceBefore: treasuryAcc.currentBalance,
            balanceAfter: updatedTreasury.currentBalance,
            transactionDate: input.disposalDate,
            referenceNumber: asset.assetTag,
            description: `Asset Disposal Proceeds: ${asset.name} (${asset.assetTag})`,
            createdById: ctx.userId
          }
        });
      }

      // 3. Decommission Linked Transport Vehicle (if any)
      if (asset.transportVehicleId) {
        await tx.transportVehicle.update({
          where: { id: asset.transportVehicleId },
          data: {
            status: VehicleStatus.OUT_OF_SERVICE,
            notes: (asset.transportVehicle?.notes ? `${asset.transportVehicle.notes} | ` : "") + `Decommissioned via asset disposal (${asset.assetTag}) on ${input.disposalDate.toISOString()}`
          }
        });
      }

      // 4. Create AssetDisposal Record
      const disposal = await tx.assetDisposal.create({
        data: {
          branchId: ctx.branchId,
          assetId: asset.id,
          disposalDate: input.disposalDate,
          disposalType: input.disposalType,
          disposalProceeds: proceeds,
          costAtDisposal: cost,
          accumDeprecAtDisposal: accum,
          netBookValueAtDisposal: nbv,
          gainOrLossAmount: gainOrLoss,
          reason: input.reason.trim(),
          buyerDetails: input.buyerDetails?.trim(),
          treasuryAccountId: treasuryAcc?.id,
          cashbookMovementId: cashbookMovement?.id,
          approvedById: ctx.userId
        }
      });

      // 5. Update AssetItem Status
      const nextStatus = input.disposalType === AssetDisposalType.WRITE_OFF ? AssetStatus.WRITTEN_OFF : AssetStatus.DISPOSED;
      await tx.assetItem.update({
        where: { id: asset.id },
        data: {
          status: nextStatus,
          netBookValue: new Prisma.Decimal(0)
        }
      });

      // 6. Post Double-Entry General Ledger Journal
      const assetGlAccId = asset.category.glAssetAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1550", tx))!.id;
      const accumGlAccId = asset.category.glAccumDeprecAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1600", tx))!.id;
      const gainGlAccId = (await GLAccountDAO.getAccountByCode(ctx, "4960", tx))!.id;
      const lossGlAccId = (await GLAccountDAO.getAccountByCode(ctx, "6950", tx))!.id;
      const bankGlAccId = treasuryAcc?.glAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1120", tx))!.id;

      const journalLines: Array<{ accountId: string; debit: Prisma.Decimal | number; credit: Prisma.Decimal | number; description: string }> = [];

      // Debit: Bank Proceeds (if proceeds > 0)
      if (proceeds.gt(0)) {
        journalLines.push({
          accountId: bankGlAccId,
          debit: proceeds,
          credit: 0,
          description: `Disposal Cash Proceeds from ${treasuryAcc?.name || "Treasury Account"}`
        });
      }

      // Debit: Relieve Accumulated Depreciation (if accumulated > 0)
      if (accum.gt(0)) {
        journalLines.push({
          accountId: accumGlAccId,
          debit: accum,
          credit: 0,
          description: `Relieve Accumulated Depreciation: ${asset.assetTag}`
        });
      }

      // Debit / Credit: Gain or Loss on Disposal
      if (gainOrLoss.lt(0)) {
        // Net Loss: Debit Loss on Disposal (#6950)
        const lossAmount = gainOrLoss.abs();
        journalLines.push({
          accountId: lossGlAccId,
          debit: lossAmount,
          credit: 0,
          description: `Loss on Asset Disposal: ${asset.assetTag} - ${asset.name}`
        });
      } else if (gainOrLoss.gt(0)) {
        // Net Gain: Credit Gain on Disposal (#4960)
        journalLines.push({
          accountId: gainGlAccId,
          debit: 0,
          credit: gainOrLoss,
          description: `Gain on Asset Disposal: ${asset.assetTag} - ${asset.name}`
        });
      }

      // Credit: Relieve Gross Fixed Asset Cost (#15xx)
      journalLines.push({
        accountId: assetGlAccId,
        debit: 0,
        credit: cost,
        description: `Relieve Gross Fixed Asset Cost: ${asset.assetTag}`
      });

      const idempotencyKey = `${ctx.branchId}:ASSET:${asset.id}:DISPOSAL`;

      const { journal } = await GLEngineDAO.postJournalEntry(
        ctx,
        {
          journalType: JournalType.ASSET_DISPOSAL,
          entryDate: input.disposalDate,
          description: `Asset Disposal & Decommissioning: ${asset.assetTag} - ${asset.name} (${input.disposalType})`,
          referenceType: "ASSET_DISPOSAL",
          referenceId: disposal.id,
          idempotencyKey,
          bypassControlAccountValidation: true,
          lines: journalLines
        },
        tx
      );

      // Link Journal to Disposal Record
      const updatedDisposal = await tx.assetDisposal.update({
        where: { id: disposal.id },
        data: { journalEntryId: journal.id }
      });

      await AuditService.log(
        ctx,
        "DISPOSE_ASSET",
        "AssetDisposal",
        disposal.id,
        JSON.stringify({ assetTag: asset.assetTag, type: input.disposalType, proceeds: proceeds.toString(), gainOrLoss: gainOrLoss.toString() })
      );

      return updatedDisposal;
    });
  }

  /**
   * Helper: Get Disposal Details
   */
  static async getDisposalByAssetId(ctx: TenantContext, assetId: string, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.assetDisposal.findUnique({
      where: { assetId },
      include: {
        asset: { include: { category: true } },
        treasuryAccount: true,
        cashbookMovement: true,
        journalEntry: { include: { lines: { include: { account: true } } } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
  }
}
