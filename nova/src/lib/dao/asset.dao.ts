import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  AssetCategoryType,
  DepreciationMethod,
  AssetStatus,
  AssetCondition,
  CapitalizationSource,
  CashbookMovementType,
  CashDirection,
  JournalType,
  StockMovementType
} from "@prisma/client";
import { AuditService } from "@/lib/services/audit.service";
import { GLEngineDAO, GLAccountDAO } from "@/lib/dao/gl.dao";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export interface AssetCategoryInput {
  code: string;
  name: string;
  categoryType?: AssetCategoryType;
  description?: string;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths?: number;
  annualDepreciationRate?: number | Prisma.Decimal;
  defaultSalvagePercent?: number | Prisma.Decimal;
  glAssetAccountId?: string;
  glDepreciationAccountId?: string;
  glAccumDeprecAccountId?: string;
}

export interface AssetLocationInput {
  code: string;
  name: string;
  building?: string;
  roomNumber?: string;
  description?: string;
}

export interface DirectAssetPurchaseInput {
  name: string;
  description?: string;
  categoryId: string;
  locationId?: string;
  custodianId?: string;
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  purchaseDate: Date;
  capitalizationDate: Date;
  warrantyExpiry?: Date;
  acquisitionCost: number | Prisma.Decimal;
  salvageValue?: number | Prisma.Decimal;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths?: number;
  annualDepreciationRate?: number | Prisma.Decimal;
  treasuryAccountId: string;
}

export interface GRNCapitalizationInput {
  name: string;
  description?: string;
  categoryId: string;
  grnId: string;
  grnItemId: string;
  locationId?: string;
  custodianId?: string;
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  capitalizationDate: Date;
  acquisitionCost?: number | Prisma.Decimal; // Optional override; defaults to GRN item total
  salvageValue?: number | Prisma.Decimal;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths?: number;
  annualDepreciationRate?: number | Prisma.Decimal;
}

export interface InventoryConversionInput {
  name: string;
  description?: string;
  categoryId: string;
  storeId: string;
  itemId: string;
  quantity: number | Prisma.Decimal;
  locationId?: string;
  custodianId?: string;
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  capitalizationDate: Date;
  salvageValue?: number | Prisma.Decimal;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths?: number;
  annualDepreciationRate?: number | Prisma.Decimal;
}

export interface FleetVehicleLinkingInput {
  transportVehicleId: string;
  categoryId: string;
  locationId?: string;
  custodianId?: string;
  capitalizationDate: Date;
  acquisitionCost: number | Prisma.Decimal;
  salvageValue?: number | Prisma.Decimal;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths?: number;
  annualDepreciationRate?: number | Prisma.Decimal;
}

export interface OpeningAssetBootstrapInput {
  assetTag?: string;
  name: string;
  description?: string;
  categoryId: string;
  locationId?: string;
  custodianId?: string;
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  purchaseDate: Date;
  capitalizationDate: Date;
  acquisitionCost: number | Prisma.Decimal;
  accumulatedDepreciation: number | Prisma.Decimal;
  salvageValue?: number | Prisma.Decimal;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths?: number;
  annualDepreciationRate?: number | Prisma.Decimal;
  lastDepreciationDate?: Date;
}

export class AssetSequenceDAO {
  static async nextTag(ctx: TenantContext, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || db;
    const year = new Date().getUTCFullYear();
    const type = "ASSET_TAG";

    const seq = await client.assetSequence.upsert({
      where: {
        branchId_type_year: {
          branchId: ctx.branchId,
          type,
          year
        }
      },
      update: {
        nextVal: { increment: 1 }
      },
      create: {
        branchId: ctx.branchId,
        type,
        year,
        nextVal: 2
      }
    });

    const val = tx ? seq.nextVal - 1 : seq.nextVal - 1;
    const padded = String(val).padStart(5, "0");
    return `AST-${year}-${padded}`;
  }

  static async nextRunNumber(ctx: TenantContext, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || db;
    const year = new Date().getUTCFullYear();
    const type = "DEPRECIATION_RUN";

    const seq = await client.assetSequence.upsert({
      where: {
        branchId_type_year: {
          branchId: ctx.branchId,
          type,
          year
        }
      },
      update: {
        nextVal: { increment: 1 }
      },
      create: {
        branchId: ctx.branchId,
        type,
        year,
        nextVal: 2
      }
    });

    const val = seq.nextVal - 1;
    const padded = String(val).padStart(3, "0");
    return `DEP-${year}-${padded}`;
  }
}

export class AssetCategoryDAO {
  static async initDefaultCategories(ctx: TenantContext, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || db;
    await GLAccountDAO.initBranchChartOfAccounts(ctx.branchId, client);

    const landAcc = await GLAccountDAO.getAccountByCode(ctx, "1510", client);
    const bldgAcc = await GLAccountDAO.getAccountByCode(ctx, "1520", client);
    const fleetAcc = await GLAccountDAO.getAccountByCode(ctx, "1530", client);
    const furnAcc = await GLAccountDAO.getAccountByCode(ctx, "1540", client);
    const ictAcc = await GLAccountDAO.getAccountByCode(ctx, "1550", client);
    const machAcc = await GLAccountDAO.getAccountByCode(ctx, "1560", client);
    const cipAcc = await GLAccountDAO.getAccountByCode(ctx, "1580", client);
    const accumAcc = await GLAccountDAO.getAccountByCode(ctx, "1600", client);
    const deprecAcc = await GLAccountDAO.getAccountByCode(ctx, "6900", client);

    const defaults: Array<{
      code: string;
      name: string;
      categoryType: AssetCategoryType;
      depreciationMethod: DepreciationMethod;
      usefulLifeMonths: number;
      annualDepreciationRate: number;
      defaultSalvagePercent: number;
      glAssetAccountId?: string;
    }> = [
      {
        code: "LAND",
        name: "School Land & Grounds",
        categoryType: AssetCategoryType.LAND_GROUNDS,
        depreciationMethod: DepreciationMethod.NONE,
        usefulLifeMonths: 0,
        annualDepreciationRate: 0,
        defaultSalvagePercent: 0,
        glAssetAccountId: landAcc?.id
      },
      {
        code: "BLDG",
        name: "School Buildings & Structures",
        categoryType: AssetCategoryType.BUILDINGS_STRUCTURES,
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 300, // 25 years
        annualDepreciationRate: 4.0,
        defaultSalvagePercent: 5.0,
        glAssetAccountId: bldgAcc?.id
      },
      {
        code: "FLEET",
        name: "School Fleet & Transport Buses",
        categoryType: AssetCategoryType.MOTOR_VEHICLES_FLEET,
        depreciationMethod: DepreciationMethod.REDUCING_BALANCE,
        usefulLifeMonths: 48, // 4 years
        annualDepreciationRate: 25.0,
        defaultSalvagePercent: 10.0,
        glAssetAccountId: fleetAcc?.id
      },
      {
        code: "FURN",
        name: "Classroom & Dormitory Furniture",
        categoryType: AssetCategoryType.FURNITURE_FIXTURES,
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 96, // 8 years
        annualDepreciationRate: 12.5,
        defaultSalvagePercent: 0,
        glAssetAccountId: furnAcc?.id
      },
      {
        code: "ICT",
        name: "Computers & Laboratory ICT",
        categoryType: AssetCategoryType.COMPUTERS_ICT_EQUIPMENT,
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 36, // 3 years
        annualDepreciationRate: 33.33,
        defaultSalvagePercent: 0,
        glAssetAccountId: ictAcc?.id
      },
      {
        code: "GEN",
        name: "Generators & Heavy Machinery",
        categoryType: AssetCategoryType.MACHINERY_GENERATORS,
        depreciationMethod: DepreciationMethod.REDUCING_BALANCE,
        usefulLifeMonths: 60, // 5 years
        annualDepreciationRate: 20.0,
        defaultSalvagePercent: 5.0,
        glAssetAccountId: machAcc?.id
      },
      {
        code: "LAB",
        name: "Science Laboratory Apparatus",
        categoryType: AssetCategoryType.LABORATORY_APPARATUS,
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 60,
        annualDepreciationRate: 20.0,
        defaultSalvagePercent: 0,
        glAssetAccountId: furnAcc?.id
      },
      {
        code: "CIP",
        name: "Capital Work in Progress",
        categoryType: AssetCategoryType.CAPITAL_WORK_IN_PROGRESS,
        depreciationMethod: DepreciationMethod.NONE,
        usefulLifeMonths: 0,
        annualDepreciationRate: 0,
        defaultSalvagePercent: 0,
        glAssetAccountId: cipAcc?.id
      }
    ];

    for (const d of defaults) {
      await client.assetCategory.upsert({
        where: {
          branchId_code: {
            branchId: ctx.branchId,
            code: d.code
          }
        },
        update: {
          name: d.name,
          categoryType: d.categoryType,
          depreciationMethod: d.depreciationMethod,
          usefulLifeMonths: d.usefulLifeMonths,
          annualDepreciationRate: d.annualDepreciationRate,
          defaultSalvagePercent: d.defaultSalvagePercent,
          glAssetAccountId: d.glAssetAccountId,
          glDepreciationAccountId: deprecAcc?.id,
          glAccumDeprecAccountId: accumAcc?.id
        },
        create: {
          branchId: ctx.branchId,
          code: d.code,
          name: d.name,
          categoryType: d.categoryType,
          depreciationMethod: d.depreciationMethod,
          usefulLifeMonths: d.usefulLifeMonths,
          annualDepreciationRate: d.annualDepreciationRate,
          defaultSalvagePercent: d.defaultSalvagePercent,
          glAssetAccountId: d.glAssetAccountId,
          glDepreciationAccountId: deprecAcc?.id,
          glAccumDeprecAccountId: accumAcc?.id
        }
      });
    }
  }

  static async listCategories(ctx: TenantContext, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.assetCategory.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      include: {
        glAssetAccount: true,
        glDepreciationAccount: true,
        glAccumDeprecAccount: true,
        _count: { select: { assets: true } }
      },
      orderBy: { code: "asc" }
    });
  }

  static async createCategory(ctx: TenantContext, input: AssetCategoryInput, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    const category = await client.assetCategory.create({
      data: {
        branchId: ctx.branchId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        categoryType: input.categoryType || AssetCategoryType.OTHER_FIXED_ASSETS,
        description: input.description?.trim(),
        depreciationMethod: input.depreciationMethod || DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: input.usefulLifeMonths || 36,
        annualDepreciationRate: input.annualDepreciationRate ? new Prisma.Decimal(input.annualDepreciationRate) : 0,
        defaultSalvagePercent: input.defaultSalvagePercent ? new Prisma.Decimal(input.defaultSalvagePercent) : 0,
        glAssetAccountId: input.glAssetAccountId,
        glDepreciationAccountId: input.glDepreciationAccountId,
        glAccumDeprecAccountId: input.glAccumDeprecAccountId
      }
    });

    await AuditService.log(ctx, "CREATE_ASSET_CATEGORY", "AssetCategory", category.id, JSON.stringify(input));
    return category;
  }
}

export class AssetLocationDAO {
  static async listLocations(ctx: TenantContext, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.assetLocation.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      include: { _count: { select: { assets: true } } },
      orderBy: { code: "asc" }
    });
  }

  static async createLocation(ctx: TenantContext, input: AssetLocationInput, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    const loc = await client.assetLocation.create({
      data: {
        branchId: ctx.branchId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        building: input.building?.trim(),
        roomNumber: input.roomNumber?.trim(),
        description: input.description?.trim()
      }
    });

    await AuditService.log(ctx, "CREATE_ASSET_LOCATION", "AssetLocation", loc.id, JSON.stringify(input));
    return loc;
  }
}

export class AssetDAO {
  /**
   * 1. Direct Purchase Capitalization: 4-Way Atomic Transaction
   * Asset Item + Treasury Account Deduction + Cashbook Movement + GL Entry
   */
  static async capitalizeDirectPurchase(
    ctx: TenantContext,
    input: DirectAssetPurchaseInput
  ) {
    const cost = new Prisma.Decimal(input.acquisitionCost);
    const salvage = new Prisma.Decimal(input.salvageValue || 0);

    if (cost.lte(0)) {
      throw new Error("Acquisition cost must be strictly greater than zero.");
    }
    if (salvage.lt(0) || salvage.gte(cost)) {
      throw new Error("Salvage value must be non-negative and less than acquisition cost.");
    }

    return await db.$transaction(async (tx) => {
      // 1. Validate Treasury Account & Liquidity
      const treasury = await tx.treasuryAccount.findFirst({
        where: { id: input.treasuryAccountId, branchId: ctx.branchId }
      });
      if (!treasury) {
        throw new Error("Treasury account not found or does not belong to this branch.");
      }
      if (new Prisma.Decimal(treasury.currentBalance).lt(cost)) {
        throw new Error(`Insufficient treasury funds in ${treasury.name} (Available: UGX ${treasury.currentBalance.toLocaleString()}, Required: UGX ${cost.toLocaleString()}).`);
      }

      // Deduct Treasury Balance
      const updatedTreasury = await tx.treasuryAccount.update({
        where: { id: treasury.id },
        data: { currentBalance: { decrement: cost } }
      });

      // 2. Generate Unique Asset Tag
      const tag = await AssetSequenceDAO.nextTag(ctx, tx);

      // 3. Category Lookup for Defaults
      const category = await tx.assetCategory.findUnique({
        where: { id: input.categoryId }
      });
      if (!category) {
        throw new Error("Asset category not found.");
      }

      const method = input.depreciationMethod || category.depreciationMethod;
      const usefulLife = input.usefulLifeMonths || category.usefulLifeMonths;
      const rate = input.annualDepreciationRate ? new Prisma.Decimal(input.annualDepreciationRate) : category.annualDepreciationRate;

      // 4. Create AssetItem
      const asset = await tx.assetItem.create({
        data: {
          branchId: ctx.branchId,
          assetTag: tag,
          name: input.name.trim(),
          description: input.description?.trim(),
          categoryId: category.id,
          locationId: input.locationId,
          custodianId: input.custodianId,
          serialNumber: input.serialNumber?.trim(),
          modelNumber: input.modelNumber?.trim(),
          manufacturer: input.manufacturer?.trim(),
          purchaseDate: input.purchaseDate,
          capitalizationDate: input.capitalizationDate,
          warrantyExpiry: input.warrantyExpiry,
          status: AssetStatus.ACTIVE,
          condition: AssetCondition.GOOD,
          capitalizationSource: CapitalizationSource.DIRECT_PURCHASE,
          acquisitionCost: cost,
          salvageValue: salvage,
          depreciableBasis: cost.sub(salvage),
          accumulatedDepreciation: new Prisma.Decimal(0),
          netBookValue: cost,
          depreciationMethod: method,
          usefulLifeMonths: usefulLife,
          annualDepreciationRate: rate,
          treasuryAccountId: treasury.id
        }
      });

      // 5. Create Immutable CashbookMovement
      const movNumber = await TreasuryDAO.getNextTreasurySequence(tx, ctx.branchId, "CBM");

      await tx.cashbookMovement.create({
        data: {
          branchId: ctx.branchId,
          accountId: treasury.id,
          movementNumber: movNumber,
          movementType: CashbookMovementType.CAPITAL_EXPENDITURE,
          direction: CashDirection.OUTFLOW,
          amount: cost,
          balanceBefore: treasury.currentBalance,
          balanceAfter: updatedTreasury.currentBalance,
          transactionDate: input.capitalizationDate,
          referenceNumber: asset.assetTag,
          description: `Direct Capital Asset Acquisition: ${asset.name} (${asset.assetTag})`,
          createdById: ctx.userId
        }
      });

      // 6. Post Double-Entry General Ledger Journal
      const assetGlAccId = category.glAssetAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1550", tx))!.id;
      const bankGlAccId = treasury.glAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1120", tx))!.id;

      const idempotencyKey = `${ctx.branchId}:ASSET:${asset.id}:CAPITALIZE`;

      const { journal } = await GLEngineDAO.postJournalEntry(
        ctx,
        {
          journalType: JournalType.CAPITAL_PURCHASE,
          entryDate: input.capitalizationDate,
          description: `Direct Capital Asset Acquisition: ${asset.assetTag} - ${asset.name}`,
          referenceType: "ASSET_ITEM",
          referenceId: asset.id,
          idempotencyKey,
          bypassControlAccountValidation: true,
          lines: [
            {
              accountId: assetGlAccId,
              debit: cost,
              credit: 0,
              description: `Capitalized: ${asset.name} (${asset.assetTag})`
            },
            {
              accountId: bankGlAccId,
              debit: 0,
              credit: cost,
              description: `Paid from ${treasury.name}`
            }
          ]
        },
        tx
      );

      // Link Journal to AssetItem
      const updatedAsset = await tx.assetItem.update({
        where: { id: asset.id },
        data: { capitalizationJournalId: journal.id }
      });

      await AuditService.log(
        ctx,
        "CAPITALIZE_DIRECT_ASSET",
        "AssetItem",
        asset.id,
        JSON.stringify({ tag: asset.assetTag, cost: cost.toString(), treasuryId: treasury.id })
      );

      return updatedAsset;
    });
  }

  /**
   * 2. Procurement GRN Capitalization Reclassification
   * Dr. Fixed Asset (#15xx) / Cr. Accrued GRN Clearing (#2120)
   */
  static async capitalizeFromGRN(
    ctx: TenantContext,
    input: GRNCapitalizationInput
  ) {
    return await db.$transaction(async (tx) => {
      // 1. Anti-Duplication Check on GRN Item
      const existing = await tx.assetItem.findFirst({
        where: {
          branchId: ctx.branchId,
          grnId: input.grnId,
          grnItemId: input.grnItemId
        }
      });
      if (existing) {
        throw new Error(`This GRN line item has already been capitalized as asset ${existing.assetTag}.`);
      }

      // 2. Lookup GRN and Item
      const grn = await tx.goodsReceivedNote.findFirst({
        where: { id: input.grnId, branchId: ctx.branchId },
        include: { supplier: true }
      });
      if (!grn) throw new Error("Goods Received Note not found.");

      const grnItem = await tx.goodsReceivedItem.findFirst({
        where: { id: input.grnItemId, grnId: grn.id }
      });
      if (!grnItem) throw new Error("GRN line item not found.");

      const cost = input.acquisitionCost ? new Prisma.Decimal(input.acquisitionCost) : new Prisma.Decimal(grnItem.lineTotalCost);
      const salvage = new Prisma.Decimal(input.salvageValue || 0);

      const category = await tx.assetCategory.findUnique({
        where: { id: input.categoryId }
      });
      if (!category) throw new Error("Asset category not found.");

      const tag = await AssetSequenceDAO.nextTag(ctx, tx);

      const asset = await tx.assetItem.create({
        data: {
          branchId: ctx.branchId,
          assetTag: tag,
          name: input.name.trim() || grnItem.itemNameSnapshot,
          description: input.description?.trim(),
          categoryId: category.id,
          locationId: input.locationId,
          custodianId: input.custodianId,
          serialNumber: input.serialNumber?.trim(),
          modelNumber: input.modelNumber?.trim(),
          manufacturer: input.manufacturer?.trim(),
          purchaseDate: grn.deliveryDate || grn.createdAt,
          capitalizationDate: input.capitalizationDate,
          status: AssetStatus.ACTIVE,
          condition: AssetCondition.EXCELLENT,
          capitalizationSource: CapitalizationSource.PROCUREMENT_GRN,
          acquisitionCost: cost,
          salvageValue: salvage,
          depreciableBasis: cost.sub(salvage),
          accumulatedDepreciation: new Prisma.Decimal(0),
          netBookValue: cost,
          depreciationMethod: input.depreciationMethod || category.depreciationMethod,
          usefulLifeMonths: input.usefulLifeMonths || category.usefulLifeMonths,
          annualDepreciationRate: input.annualDepreciationRate ? new Prisma.Decimal(input.annualDepreciationRate) : category.annualDepreciationRate,
          supplierId: grn.supplierId,
          grnId: grn.id,
          grnItemId: grnItem.id
        }
      });

      // GL Entry: Dr. Asset (#15xx) / Cr. Accrued GRN Liability (#2120)
      const assetGlAccId = category.glAssetAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1550", tx))!.id;
      const grnClearingAcc = await GLAccountDAO.getAccountByCode(ctx, "2120", tx);
      const grnClearingAccId = grnClearingAcc!.id;

      const idempotencyKey = `${ctx.branchId}:ASSET:${asset.id}:GRN_CAPITALIZE`;

      const { journal } = await GLEngineDAO.postJournalEntry(
        ctx,
        {
          journalType: JournalType.CAPITAL_PURCHASE,
          entryDate: input.capitalizationDate,
          description: `GRN Asset Capitalization: ${asset.assetTag} from GRN ${grn.grnNumber}`,
          referenceType: "ASSET_ITEM",
          referenceId: asset.id,
          idempotencyKey,
          bypassControlAccountValidation: true,
          lines: [
            {
              accountId: assetGlAccId,
              debit: cost,
              credit: 0,
              description: `Capitalized from GRN ${grn.grnNumber}: ${asset.name}`
            },
            {
              accountId: grnClearingAccId,
              debit: 0,
              credit: cost,
              description: `Clear Accrued GRN liability: ${grn.grnNumber}`
            }
          ]
        },
        tx
      );

      const updatedAsset = await tx.assetItem.update({
        where: { id: asset.id },
        data: { capitalizationJournalId: journal.id }
      });

      await AuditService.log(ctx, "CAPITALIZE_GRN_ASSET", "AssetItem", asset.id, JSON.stringify({ tag: asset.assetTag, grnId: grn.id }));
      return updatedAsset;
    });
  }

  /**
   * 3. Stores Inventory -> Fixed Asset Conversion
   * Dr. Fixed Asset (#15xx) / Cr. Stores Inventory Asset (#1310)
   */
  static async capitalizeFromInventoryStore(
    ctx: TenantContext,
    input: InventoryConversionInput
  ) {
    const qty = new Prisma.Decimal(input.quantity);
    if (qty.lte(0)) throw new Error("Quantity must be greater than zero.");

    return await db.$transaction(async (tx) => {
      const stock = await tx.inventoryStoreStock.findUnique({
        where: {
          storeId_itemId: {
            storeId: input.storeId,
            itemId: input.itemId
          }
        },
        include: { item: true, store: true }
      });
      if (!stock || new Prisma.Decimal(stock.quantityOnHand).lt(qty)) {
        throw new Error("Insufficient stock in the specified store for conversion.");
      }

      const totalVal = qty.mul(stock.item.unitCostPrice);
      const salvage = new Prisma.Decimal(input.salvageValue || 0);

      // Decrement Store Stock
      await tx.inventoryStoreStock.update({
        where: { id: stock.id },
        data: { quantityOnHand: { decrement: qty } }
      });

      // Record Stock Movement
      await tx.stockMovement.create({
        data: {
          branchId: ctx.branchId,
          storeId: stock.storeId,
          itemId: stock.itemId,
          movementType: StockMovementType.DEPARTMENT_ISSUE,
          quantityDelta: qty.negated(),
          balanceAfter: new Prisma.Decimal(stock.quantityOnHand).sub(qty),
          unitCostAtMovement: stock.item.unitCostPrice,
          totalValuation: totalVal,
          referenceType: "CAPITAL_CONVERSION",
          referenceId: `CONV-${Date.now()}`,
          reason: `Converted to fixed capital asset: ${input.name}`,
          performedById: ctx.userId
        }
      });

      const category = await tx.assetCategory.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new Error("Asset category not found.");

      const tag = await AssetSequenceDAO.nextTag(ctx, tx);

      const asset = await tx.assetItem.create({
        data: {
          branchId: ctx.branchId,
          assetTag: tag,
          name: input.name.trim(),
          description: input.description?.trim(),
          categoryId: category.id,
          locationId: input.locationId,
          custodianId: input.custodianId,
          serialNumber: input.serialNumber?.trim(),
          modelNumber: input.modelNumber?.trim(),
          manufacturer: input.manufacturer?.trim(),
          purchaseDate: input.capitalizationDate,
          capitalizationDate: input.capitalizationDate,
          status: AssetStatus.ACTIVE,
          condition: AssetCondition.GOOD,
          capitalizationSource: CapitalizationSource.INVENTORY_CONVERSION,
          acquisitionCost: totalVal,
          salvageValue: salvage,
          depreciableBasis: totalVal.sub(salvage),
          accumulatedDepreciation: new Prisma.Decimal(0),
          netBookValue: totalVal,
          depreciationMethod: input.depreciationMethod || category.depreciationMethod,
          usefulLifeMonths: input.usefulLifeMonths || category.usefulLifeMonths,
          annualDepreciationRate: input.annualDepreciationRate ? new Prisma.Decimal(input.annualDepreciationRate) : category.annualDepreciationRate
        }
      });

      // GL Entry: Dr. Fixed Asset (#15xx) / Cr. Stores Inventory Asset (#1310)
      const assetGlAccId = category.glAssetAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1550", tx))!.id;
      const invAcc = await GLAccountDAO.getAccountByCode(ctx, "1310", tx);
      const invAccId = invAcc!.id;

      const idempotencyKey = `${ctx.branchId}:ASSET:${asset.id}:STORE_CONVERT`;

      const { journal } = await GLEngineDAO.postJournalEntry(
        ctx,
        {
          journalType: JournalType.CAPITAL_PURCHASE,
          entryDate: input.capitalizationDate,
          description: `Store Stock Asset Conversion: ${asset.assetTag} - ${asset.name}`,
          referenceType: "ASSET_ITEM",
          referenceId: asset.id,
          idempotencyKey,
          bypassControlAccountValidation: true,
          lines: [
            {
              accountId: assetGlAccId,
              debit: totalVal,
              credit: 0,
              description: `Capitalized from Store Stock: ${asset.name}`
            },
            {
              accountId: invAccId,
              debit: 0,
              credit: totalVal,
              description: `Relieve Stores Inventory stock at historical WAC`
            }
          ]
        },
        tx
      );

      const updatedAsset = await tx.assetItem.update({
        where: { id: asset.id },
        data: { capitalizationJournalId: journal.id }
      });

      await AuditService.log(ctx, "CONVERT_STORE_TO_ASSET", "AssetItem", asset.id, JSON.stringify({ tag: asset.assetTag, totalVal: totalVal.toString() }));
      return updatedAsset;
    });
  }

  /**
   * 4. Fleet Vehicle 1-to-1 Linking
   */
  static async linkFleetVehicle(
    ctx: TenantContext,
    input: FleetVehicleLinkingInput
  ) {
    return await db.$transaction(async (tx) => {
      // Check 1-to-1
      const existing = await tx.assetItem.findFirst({
        where: {
          branchId: ctx.branchId,
          transportVehicleId: input.transportVehicleId
        }
      });
      if (existing) {
        throw new Error(`Transport vehicle is already linked to fixed asset ${existing.assetTag}.`);
      }

      const vehicle = await tx.transportVehicle.findFirst({
        where: { id: input.transportVehicleId, branchId: ctx.branchId }
      });
      if (!vehicle) throw new Error("Transport vehicle not found.");

      const category = await tx.assetCategory.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new Error("Asset category not found.");

      const cost = new Prisma.Decimal(input.acquisitionCost);
      const salvage = new Prisma.Decimal(input.salvageValue || 0);

      const tag = await AssetSequenceDAO.nextTag(ctx, tx);

      const asset = await tx.assetItem.create({
        data: {
          branchId: ctx.branchId,
          assetTag: tag,
          name: `${vehicle.makeModel} (${vehicle.registrationNumber})`,
          description: `School Transport Fleet Vehicle`,
          categoryId: category.id,
          locationId: input.locationId,
          custodianId: input.custodianId,
          serialNumber: vehicle.registrationNumber,
          modelNumber: vehicle.makeModel,
          purchaseDate: input.capitalizationDate,
          capitalizationDate: input.capitalizationDate,
          status: AssetStatus.ACTIVE,
          condition: AssetCondition.GOOD,
          capitalizationSource: CapitalizationSource.FLEET_VEHICLE,
          acquisitionCost: cost,
          salvageValue: salvage,
          depreciableBasis: cost.sub(salvage),
          accumulatedDepreciation: new Prisma.Decimal(0),
          netBookValue: cost,
          depreciationMethod: input.depreciationMethod || category.depreciationMethod,
          usefulLifeMonths: input.usefulLifeMonths || category.usefulLifeMonths,
          annualDepreciationRate: input.annualDepreciationRate ? new Prisma.Decimal(input.annualDepreciationRate) : category.annualDepreciationRate,
          transportVehicleId: vehicle.id
        }
      });

      await AuditService.log(ctx, "LINK_FLEET_VEHICLE_ASSET", "AssetItem", asset.id, JSON.stringify({ tag: asset.assetTag, vehicleId: vehicle.id }));
      return asset;
    });
  }

  /**
   * 5. Historical Opening Asset Bootstrap
   * Dr. Asset Gross (#15xx) / Cr. Accum Deprec (#1600) + Cr. Opening Equity (#3500)
   */
  static async bootstrapOpeningAsset(
    ctx: TenantContext,
    input: OpeningAssetBootstrapInput
  ) {
    const cost = new Prisma.Decimal(input.acquisitionCost);
    const accum = new Prisma.Decimal(input.accumulatedDepreciation);
    const salvage = new Prisma.Decimal(input.salvageValue || 0);
    const nbv = cost.sub(accum);

    if (cost.lte(0)) throw new Error("Acquisition cost must be positive.");
    if (accum.lt(0) || accum.gt(cost)) throw new Error("Accumulated depreciation cannot be negative or exceed cost.");
    if (nbv.lt(salvage)) throw new Error("Net Book Value cannot be less than salvage value.");

    return await db.$transaction(async (tx) => {
      const category = await tx.assetCategory.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new Error("Asset category not found.");

      const tag = input.assetTag?.trim() || (await AssetSequenceDAO.nextTag(ctx, tx));

      // Check Tag Uniqueness
      const existing = await tx.assetItem.findUnique({
        where: { branchId_assetTag: { branchId: ctx.branchId, assetTag: tag } }
      });
      if (existing) {
        throw new Error(`Asset tag ${tag} already exists in this branch.`);
      }

      const asset = await tx.assetItem.create({
        data: {
          branchId: ctx.branchId,
          assetTag: tag,
          name: input.name.trim(),
          description: input.description?.trim(),
          categoryId: category.id,
          locationId: input.locationId,
          custodianId: input.custodianId,
          serialNumber: input.serialNumber?.trim(),
          modelNumber: input.modelNumber?.trim(),
          manufacturer: input.manufacturer?.trim(),
          purchaseDate: input.purchaseDate,
          capitalizationDate: input.capitalizationDate,
          status: nbv.eq(salvage) ? AssetStatus.FULLY_DEPRECIATED : AssetStatus.ACTIVE,
          condition: AssetCondition.GOOD,
          capitalizationSource: CapitalizationSource.OPENING_BALANCE,
          acquisitionCost: cost,
          salvageValue: salvage,
          depreciableBasis: cost.sub(salvage),
          accumulatedDepreciation: accum,
          netBookValue: nbv,
          lastDepreciationDate: input.lastDepreciationDate || input.capitalizationDate,
          depreciationMethod: input.depreciationMethod || category.depreciationMethod,
          usefulLifeMonths: input.usefulLifeMonths || category.usefulLifeMonths,
          annualDepreciationRate: input.annualDepreciationRate ? new Prisma.Decimal(input.annualDepreciationRate) : category.annualDepreciationRate
        }
      });

      // Opening GL Journal: Dr. #15xx Cost / Cr. #1600 Accum / Cr. #3500 Opening Equity
      const assetGlAccId = category.glAssetAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1550", tx))!.id;
      const accumGlAccId = category.glAccumDeprecAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1600", tx))!.id;
      const equityAcc = await GLAccountDAO.getAccountByCode(ctx, "3500", tx);
      const equityAccId = equityAcc!.id;

      const idempotencyKey = `${ctx.branchId}:ASSET:${asset.id}:BOOTSTRAP`;

      const lines: Array<{ accountId: string; debit: Prisma.Decimal | number; credit: Prisma.Decimal | number; description: string }> = [
        {
          accountId: assetGlAccId,
          debit: cost,
          credit: 0,
          description: `Opening Fixed Asset Gross Cost: ${asset.name}`
        }
      ];

      if (accum.gt(0)) {
        lines.push({
          accountId: accumGlAccId,
          debit: 0,
          credit: accum,
          description: `Opening Cumulative Depreciation: ${asset.name}`
        });
      }

      if (nbv.gt(0)) {
        lines.push({
          accountId: equityAccId,
          debit: 0,
          credit: nbv,
          description: `Opening Equity Balance: Net Book Value of ${asset.name}`
        });
      }

      const { journal } = await GLEngineDAO.postJournalEntry(
        ctx,
        {
          journalType: JournalType.OPENING_BALANCE,
          entryDate: input.capitalizationDate,
          description: `Historical Asset Opening Bootstrap: ${asset.assetTag} - ${asset.name}`,
          referenceType: "ASSET_ITEM",
          referenceId: asset.id,
          idempotencyKey,
          bypassControlAccountValidation: true,
          lines
        },
        tx
      );

      const updatedAsset = await tx.assetItem.update({
        where: { id: asset.id },
        data: { capitalizationJournalId: journal.id }
      });

      await AuditService.log(ctx, "BOOTSTRAP_OPENING_ASSET", "AssetItem", asset.id, JSON.stringify({ tag: asset.assetTag, cost: cost.toString(), nbv: nbv.toString() }));
      return updatedAsset;
    });
  }

  /**
   * 6. Location & Custody Movement (Zero GL Impact)
   */
  static async transferAsset(
    ctx: TenantContext,
    assetId: string,
    input: {
      toLocationId?: string;
      toCustodianId?: string;
      reason?: string;
    }
  ) {
    return await db.$transaction(async (tx) => {
      const asset = await tx.assetItem.findFirst({
        where: { id: assetId, branchId: ctx.branchId }
      });
      if (!asset) throw new Error("Asset item not found.");

      const fromLocationId = asset.locationId;
      const fromCustodianId = asset.custodianId;

      const updated = await tx.assetItem.update({
        where: { id: asset.id },
        data: {
          locationId: input.toLocationId || asset.locationId,
          custodianId: input.toCustodianId !== undefined ? input.toCustodianId : asset.custodianId
        }
      });

      await tx.assetMovementLog.create({
        data: {
          branchId: ctx.branchId,
          assetId: asset.id,
          fromLocationId,
          toLocationId: input.toLocationId,
          fromCustodianId,
          toCustodianId: input.toCustodianId,
          reason: input.reason?.trim(),
          transferredById: ctx.userId
        }
      });

      await AuditService.log(ctx, "TRANSFER_ASSET", "AssetItem", asset.id, JSON.stringify(input));
      return updated;
    });
  }

  /**
   * 7. Physical Asset Verification & Condition Audit
   */
  static async logPhysicalVerification(
    ctx: TenantContext,
    assetId: string,
    input: {
      condition: AssetCondition;
      locationId?: string;
      custodianId?: string;
      isMissing?: boolean;
      notes?: string;
    }
  ) {
    return await db.$transaction(async (tx) => {
      const asset = await tx.assetItem.findFirst({
        where: { id: assetId, branchId: ctx.branchId }
      });
      if (!asset) throw new Error("Asset item not found.");

      await tx.assetItem.update({
        where: { id: asset.id },
        data: {
          condition: input.condition,
          locationId: input.locationId || asset.locationId,
          custodianId: input.custodianId !== undefined ? input.custodianId : asset.custodianId
        }
      });

      const log = await tx.assetVerificationLog.create({
        data: {
          branchId: ctx.branchId,
          assetId: asset.id,
          verifiedById: ctx.userId,
          condition: input.condition,
          locationId: input.locationId || asset.locationId,
          custodianId: input.custodianId || asset.custodianId,
          isMissing: input.isMissing || false,
          notes: input.notes?.trim()
        }
      });

      await AuditService.log(ctx, "VERIFY_ASSET_PHYSICAL", "AssetItem", asset.id, JSON.stringify(input));
      return log;
    });
  }

  /**
   * Query Helpers
   */
  static async getAssetById(ctx: TenantContext, id: string, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.assetItem.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        category: {
          include: {
            glAssetAccount: true,
            glDepreciationAccount: true,
            glAccumDeprecAccount: true
          }
        },
        location: true,
        custodian: true,
        supplier: true,
        grn: true,
        transportVehicle: true,
        treasuryAccount: true,
        disposalRecord: true,
        movementLogs: { orderBy: { transferDate: "desc" }, take: 10 },
        verificationLogs: { orderBy: { verifiedAt: "desc" }, take: 10 }
      }
    });
  }

  static async listAssets(ctx: TenantContext, filters?: {
    categoryId?: string;
    status?: AssetStatus;
    locationId?: string;
    custodianId?: string;
    search?: string;
  }, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    const where: Prisma.AssetItemWhereInput = {
      branchId: ctx.branchId
    };

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.status) where.status = filters.status;
    if (filters?.locationId) where.locationId = filters.locationId;
    if (filters?.custodianId) where.custodianId = filters.custodianId;
    if (filters?.search) {
      where.OR = [
        { assetTag: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
        { serialNumber: { contains: filters.search, mode: "insensitive" } }
      ];
    }

    return client.assetItem.findMany({
      where,
      include: {
        category: true,
        location: true,
        custodian: true,
        transportVehicle: true
      },
      orderBy: { assetTag: "asc" }
    });
  }
}
