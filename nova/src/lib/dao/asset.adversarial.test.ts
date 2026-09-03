import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  DepreciationMethod,
  AssetDisposalType,
  PeriodStatus
} from "@prisma/client";
import { AssetDAO, AssetCategoryDAO, AssetSequenceDAO } from "@/lib/dao/asset.dao";
import { AssetDepreciationEngine } from "@/lib/dao/asset-depreciation.engine";
import { AssetDisposalDAO } from "@/lib/dao/asset-disposal.dao";
import { AssetReportsDAO } from "@/lib/dao/asset-reports.dao";
import { GLAccountDAO, FiscalPeriodDAO } from "@/lib/dao/gl.dao";

describe("Phase 3.1M: Fixed Assets Adversarial, Concurrency & Security Tests (ADV-AST-01..ADV-AST-14)", () => {
  let ctx: TenantContext;
  let ctxBranch2: TenantContext;
  let adminUserId: string;
  let branchId: string;
  let branch2Id: string;
  let treasuryAccountId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `Adv_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Adv School", organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: "Main Campus", schoolId: school.id }
    });
    branchId = branch.id;

    const branch2 = await db.branch.create({
      data: { name: "City Campus", schoolId: school.id }
    });
    branch2Id = branch2.id;

    const user = await db.user.create({
      data: {
        organizationId: org.id,
        email: `adv_maker_${Date.now()}_${Math.random().toString(36).slice(2)}@alpha.ac.ug`,
        passwordHash: "hash",
        firstName: "Maker",
        lastName: "Accountant",
        userType: "STAFF"
      }
    });
    adminUserId = user.id;

    ctx = {
      branchId,
      userId: adminUserId,
      organizationId: org.id,
      schoolId: school.id,
      role: "ADMIN",
      permissions: ["all"]
    };

    ctxBranch2 = {
      branchId: branch2Id,
      userId: adminUserId,
      organizationId: org.id,
      schoolId: school.id,
      role: "ADMIN",
      permissions: ["all"]
    };

    await GLAccountDAO.initBranchChartOfAccounts(branchId);
    await FiscalPeriodDAO.initFiscalYear(ctx, 2026);
    await AssetCategoryDAO.initDefaultCategories(ctx);

    await GLAccountDAO.initBranchChartOfAccounts(branch2Id);
    await FiscalPeriodDAO.initFiscalYear(ctxBranch2, 2026);
    await AssetCategoryDAO.initDefaultCategories(ctxBranch2);

    const bankGl = await GLAccountDAO.getAccountByCode(ctx, "1120");
    const treasury = await db.treasuryAccount.create({
      data: {
        branchId,
        code: `BNK-ADV-${Date.now()}`,
        name: "Stanbic Adversarial Account",
        accountType: "COMMERCIAL_BANK",
        openingBalance: new Prisma.Decimal(50000000),
        currentBalance: new Prisma.Decimal(50000000),
        glAccountId: bankGl!.id
      }
    });
    treasuryAccountId = treasury.id;
  });

  it("ADV-AST-01: Concurrent sequence tag generation without collisions", async () => {
    const promises: Promise<string>[] = [];
    for (let i = 0; i < 20; i++) {
      promises.push(AssetSequenceDAO.nextTag(ctx));
    }
    const tags = await Promise.all(promises);
    expect(tags.length).toBe(20);

    const uniqueTags = new Set(tags);
    expect(uniqueTags.size).toBe(20);
  });

  it("ADV-AST-02: Concurrent duplicate depreciation run attempt in same fiscal period rejected", async () => {
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    const targetPeriod = periods[4]; // May 2026

    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Adversarial Test Server",
      categoryId: ictCat.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: new Prisma.Decimal(12000000),
      accumulatedDepreciation: 0,
      salvageValue: 0
    });

    const run1 = await AssetDepreciationEngine.createDepreciationRun(ctx, targetPeriod.id);
    expect(run1.id).toBeDefined();

    // Second run creation for the same period must fail
    await expect(
      AssetDepreciationEngine.createDepreciationRun(ctx, targetPeriod.id)
    ).rejects.toThrow("already exists");
  });

  it("ADV-AST-03: Depreciation run creation/posting in CLOSED or LOCKED fiscal period rejected", async () => {
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    const decPeriod = periods[11]; // Dec 2026

    // Close Dec Period
    await db.fiscalPeriod.update({
      where: { id: decPeriod.id },
      data: { status: PeriodStatus.CLOSED, closedAt: new Date(), closedById: ctx.userId }
    });

    await expect(
      AssetDepreciationEngine.createDepreciationRun(ctx, decPeriod.id)
    ).rejects.toThrow("Cannot run depreciation in a CLOSED fiscal period");
  });

  it("ADV-AST-04: Four-Eye bypass / maker self-approval attempt rejected", async () => {
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    const targetPeriod = periods[5]; // June 2026

    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Adversarial Test Server 2",
      categoryId: ictCat.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: new Prisma.Decimal(12000000),
      accumulatedDepreciation: 0,
      salvageValue: 0
    });

    const run = await AssetDepreciationEngine.createDepreciationRun(ctx, targetPeriod.id);

    // Maker tries to approve
    await expect(
      AssetDepreciationEngine.approveDepreciationRun(ctx, run.id)
    ).rejects.toThrow("Four-Eye Policy");
  });

  it("ADV-AST-05: Depreciation of already disposed or written-off asset excluded", () => {
    const calc = AssetDepreciationEngine.calculateAssetPeriodicDepreciation(
      {
        id: "disposed-asset",
        acquisitionCost: new Prisma.Decimal(1000000),
        salvageValue: new Prisma.Decimal(0),
        netBookValue: new Prisma.Decimal(0),
        accumulatedDepreciation: new Prisma.Decimal(1000000),
        capitalizationDate: new Date("2025-01-01"),
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 12,
        annualDepreciationRate: null,
        category: {
          depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
          usefulLifeMonths: 12,
          annualDepreciationRate: new Prisma.Decimal(100)
        }
      },
      {
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31")
      }
    );

    expect(calc).toBeNull();
  });

  it("ADV-AST-06: Depreciation charge forcing NBV below salvage value capped at salvage floor", () => {
    const calc = AssetDepreciationEngine.calculateAssetPeriodicDepreciation(
      {
        id: "near-salvage-asset",
        acquisitionCost: new Prisma.Decimal(5000000),
        salvageValue: new Prisma.Decimal(1000000),
        netBookValue: new Prisma.Decimal(1050000),
        accumulatedDepreciation: new Prisma.Decimal(3950000),
        capitalizationDate: new Date("2025-01-01"),
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 40,
        annualDepreciationRate: null,
        category: {
          depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
          usefulLifeMonths: 40,
          annualDepreciationRate: new Prisma.Decimal(25)
        }
      },
      {
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31")
      }
    );

    expect(calc).toBeDefined();
    expect(calc?.depreciationAmount.toString()).toBe("50000");
    expect(calc?.closingBookValue.toString()).toBe("1000000");
  });

  it("ADV-AST-07: Duplicate disposal attempt on same asset rejected", async () => {
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    const asset = await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Asset for Duplicate Disposal Test",
      categoryId: ictCat.id,
      purchaseDate: new Date("2025-01-01"),
      capitalizationDate: new Date("2025-01-01"),
      acquisitionCost: new Prisma.Decimal(5000000),
      accumulatedDepreciation: new Prisma.Decimal(1000000),
      salvageValue: 0
    });

    await AssetDisposalDAO.disposeAsset(ctx, {
      assetId: asset.id,
      disposalDate: new Date("2026-01-20"),
      disposalType: AssetDisposalType.SCRAP,
      disposalProceeds: 0,
      reason: "Decommissioned"
    });

    // Second disposal must fail
    await expect(
      AssetDisposalDAO.disposeAsset(ctx, {
        assetId: asset.id,
        disposalDate: new Date("2026-01-21"),
        disposalType: AssetDisposalType.SCRAP,
        disposalProceeds: 0,
        reason: "Second decommissioning attempt"
      })
    ).rejects.toThrow("already DISPOSED");
  });

  it("ADV-AST-08: Direct capitalization with insufficient treasury funds rejected", async () => {
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;

    await expect(
      AssetDAO.capitalizeDirectPurchase(ctx, {
        name: "Massive Datacenter Expansion",
        categoryId: ictCat.id,
        purchaseDate: new Date("2026-01-01"),
        capitalizationDate: new Date("2026-01-01"),
        acquisitionCost: new Prisma.Decimal(1000000000),
        treasuryAccountId
      })
    ).rejects.toThrow("Insufficient treasury funds");
  });

  it("ADV-AST-09: Decimal(12,2) sub-cent rounding precision under 500 assets (exact zero variance)", () => {
    let totalCharge = new Prisma.Decimal(0);
    const assetCount = 500;
    const cost = new Prisma.Decimal(1000000);
    const salvage = new Prisma.Decimal(0);
    const usefulLife = 36;

    for (let i = 0; i < assetCount; i++) {
      const calc = AssetDepreciationEngine.calculateAssetPeriodicDepreciation(
        {
          id: `asset-sim-${i}`,
          acquisitionCost: cost,
          salvageValue: salvage,
          netBookValue: cost,
          accumulatedDepreciation: new Prisma.Decimal(0),
          capitalizationDate: new Date("2026-01-01"),
          depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
          usefulLifeMonths: usefulLife,
          annualDepreciationRate: null,
          category: {
            depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
            usefulLifeMonths: usefulLife,
            annualDepreciationRate: new Prisma.Decimal(33.33)
          }
        },
        {
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-01-31")
        }
      );
      if (calc) {
        totalCharge = totalCharge.add(calc.depreciationAmount);
      }
    }

    expect(totalCharge.toString()).toBe("13888890");
  });

  it("ADV-AST-10: Cross-branch asset mutation or access rejected", async () => {
    const ictCat2 = (await AssetCategoryDAO.listCategories(ctxBranch2)).find(c => c.code === "ICT")!;
    const b2Asset = await AssetDAO.bootstrapOpeningAsset(ctxBranch2, {
      name: "Branch 2 Private Asset",
      categoryId: ictCat2.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: 5000000,
      accumulatedDepreciation: 0
    });

    // Branch 1 user tries to dispose Branch 2 asset
    await expect(
      AssetDisposalDAO.disposeAsset(ctx, {
        assetId: b2Asset.id,
        disposalDate: new Date("2026-01-01"),
        disposalType: AssetDisposalType.SCRAP,
        disposalProceeds: 0,
        reason: "Unauthorized cross-branch attack"
      })
    ).rejects.toThrow("Asset item not found");
  });

  it("ADV-AST-11: Intentional asset tampering drift detection via telemetry engine", async () => {
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    const asset = await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Tamper Test Asset",
      categoryId: ictCat.id,
      purchaseDate: new Date("2025-01-01"),
      capitalizationDate: new Date("2025-01-01"),
      acquisitionCost: new Prisma.Decimal(10000000),
      accumulatedDepreciation: 0,
      salvageValue: 0
    });

    // Artificially mutate subledger cost without posting GL entry
    await db.assetItem.update({
      where: { id: asset.id },
      data: { acquisitionCost: new Prisma.Decimal(15000000) }
    });

    const recon = await AssetReportsDAO.reconcileFixedAssetsSubledger(ctx);
    expect(recon.isReconciled).toBe(false);
    expect(new Prisma.Decimal(recon.variance.costVariance).toString()).toBe("5000000");

    // Restore back
    await db.assetItem.update({
      where: { id: asset.id },
      data: { acquisitionCost: new Prisma.Decimal(10000000) }
    });
  });

  it("ADV-AST-12: Duplicate capitalization replay on same GRN item rejected", async () => {
    const furnCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "FURN")!;

    const supplier = await db.inventorySupplier.create({
      data: {
        branchId,
        supplierCode: `SUP-ADV-${Date.now()}`,
        name: "Mukwano Adv Supplies",
        phone: "0770000000"
      }
    });

    const store = await db.inventoryStore.create({
      data: { branchId, code: `STR-ADV-${Date.now()}`, name: "Adv Store" }
    });

    const item = await db.inventoryItem.create({
      data: { branchId, code: `ITM-ADV-${Date.now()}`, name: "Adv Item", unitOfMeasure: "pcs" }
    });

    const academicYear = await db.academicYear.create({
      data: { branchId, name: `AY-ADV-${Date.now()}`, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") }
    });

    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: `GRN-ADV-${Date.now()}`,
        supplierId: supplier.id,
        supplierNameSnapshot: "Mukwano Adv Supplies",
        storeId: store.id,
        academicYearId: academicYear.id,
        totalAmount: new Prisma.Decimal(1000000),
        receivedById: adminUserId
      }
    });

    const grnItem = await db.goodsReceivedItem.create({
      data: {
        grnId: grn.id,
        itemId: item.id,
        itemNameSnapshot: "Adv Executive Desk",
        quantityReceived: new Prisma.Decimal(1),
        unitCostPrice: new Prisma.Decimal(1000000),
        lineTotalCost: new Prisma.Decimal(1000000)
      }
    });

    await AssetDAO.capitalizeFromGRN(ctx, {
      name: "Adv Exec Desk 1",
      categoryId: furnCat.id,
      grnId: grn.id,
      grnItemId: grnItem.id,
      capitalizationDate: new Date("2026-01-20")
    });

    // Replay attempt must fail
    await expect(
      AssetDAO.capitalizeFromGRN(ctx, {
        name: "Adv Exec Desk Duplicate",
        categoryId: furnCat.id,
        grnId: grn.id,
        grnItemId: grnItem.id,
        capitalizationDate: new Date("2026-01-20")
      })
    ).rejects.toThrow("already been capitalized");
  });

  it("ADV-AST-13: Linking two active asset items to the same TransportVehicle rejected", async () => {
    const fleetCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "FLEET")!;
    const vehicle = await db.transportVehicle.create({
      data: {
        branchId,
        registrationNumber: `UBJ ${Date.now().toString().slice(-4)}V`,
        makeModel: "Toyota HiAce Van",
        capacity: 14
      }
    });

    await AssetDAO.linkFleetVehicle(ctx, {
      transportVehicleId: vehicle.id,
      categoryId: fleetCat.id,
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: 40000000
    });

    // Second linking attempt must fail
    await expect(
      AssetDAO.linkFleetVehicle(ctx, {
        transportVehicleId: vehicle.id,
        categoryId: fleetCat.id,
        capitalizationDate: new Date("2026-01-01"),
        acquisitionCost: 40000000
      })
    ).rejects.toThrow("already linked");
  });

  it("ADV-AST-14: Disposal of non-existent or uncapitalized draft asset rejected", async () => {
    await expect(
      AssetDisposalDAO.disposeAsset(ctx, {
        assetId: "non-existent-cuid",
        disposalDate: new Date("2026-01-01"),
        disposalType: AssetDisposalType.SCRAP,
        reason: "Fake asset"
      })
    ).rejects.toThrow("Asset item not found");
  });
});
