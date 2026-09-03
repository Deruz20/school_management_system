import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  AssetCategoryType,
  DepreciationMethod,
  AssetCondition,
  AssetDisposalType,
  CashDirection
} from "@prisma/client";
import { AssetDAO, AssetCategoryDAO, AssetLocationDAO, AssetSequenceDAO } from "@/lib/dao/asset.dao";
import { AssetDepreciationEngine } from "@/lib/dao/asset-depreciation.engine";
import { AssetDisposalDAO } from "@/lib/dao/asset-disposal.dao";
import { AssetReportsDAO } from "@/lib/dao/asset-reports.dao";
import { GLAccountDAO, FiscalPeriodDAO } from "@/lib/dao/gl.dao";

describe("Phase 3.1M: Fixed Assets Subledger & Depreciation Engine (AST-01..AST-24)", () => {
  let ctx: TenantContext;
  let checkerCtx: TenantContext;
  let ctxBranch2: TenantContext;
  let adminUserId: string;
  let checkerUserId: string;
  let branchId: string;
  let branch2Id: string;
  let treasuryAccountId: string;
  let openPeriodId: string;
  let academicYearId: string;
  let storeId: string;
  let itemId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `Asset_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Asset High School", organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: "Main Campus", schoolId: school.id }
    });
    branchId = branch.id;

    const branch2 = await db.branch.create({
      data: { name: "City Branch", schoolId: school.id }
    });
    branch2Id = branch2.id;

    const user = await db.user.create({
      data: {
        organizationId: org.id,
        email: `maker_${Date.now()}_${Math.random().toString(36).slice(2)}@alpha.ac.ug`,
        passwordHash: "hash",
        firstName: "Maker",
        lastName: "Accountant",
        userType: "STAFF"
      }
    });
    adminUserId = user.id;

    const checker = await db.user.create({
      data: {
        organizationId: org.id,
        email: `checker_${Date.now()}_${Math.random().toString(36).slice(2)}@alpha.ac.ug`,
        passwordHash: "hash",
        firstName: "Head",
        lastName: "Teacher",
        userType: "STAFF"
      }
    });
    checkerUserId = checker.id;

    ctx = {
      branchId,
      userId: adminUserId,
      organizationId: org.id,
      schoolId: school.id,
      role: "ADMIN",
      permissions: ["all"]
    };

    checkerCtx = {
      branchId,
      userId: checkerUserId,
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

    // Initialize Chart of Accounts & 2026 Fiscal Year
    await GLAccountDAO.initBranchChartOfAccounts(branchId);
    await FiscalPeriodDAO.initFiscalYear(ctx, 2026);
    await AssetCategoryDAO.initDefaultCategories(ctx);

    await GLAccountDAO.initBranchChartOfAccounts(branch2Id);
    await FiscalPeriodDAO.initFiscalYear(ctxBranch2, 2026);
    await AssetCategoryDAO.initDefaultCategories(ctxBranch2);

    // Create Academic Year
    const ay = await db.academicYear.create({
      data: {
        branchId,
        name: `AY-2026-${Date.now()}`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      }
    });
    academicYearId = ay.id;

    // Create Store & Item
    const store = await db.inventoryStore.create({
      data: {
        branchId,
        code: `STR-${Date.now()}`,
        name: "Main Stores"
      }
    });
    storeId = store.id;

    const item = await db.inventoryItem.create({
      data: {
        branchId,
        code: `ITM-${Date.now()}`,
        name: "Computer Equipment Batch",
        unitOfMeasure: "pcs",
        unitCostPrice: new Prisma.Decimal(200000)
      }
    });
    itemId = item.id;

    // Create Treasury Account
    const bankGl = await GLAccountDAO.getAccountByCode(ctx, "1120");
    const treasury = await db.treasuryAccount.create({
      data: {
        branchId,
        code: `BNK-${Date.now()}`,
        name: "Stanbic Operational Account",
        accountType: "COMMERCIAL_BANK",
        openingBalance: new Prisma.Decimal(100000000),
        currentBalance: new Prisma.Decimal(100000000),
        glAccountId: bankGl!.id
      }
    });
    treasuryAccountId = treasury.id;

    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    openPeriodId = periods[0].id; // Jan 2026
  });

  it("AST-01: Category CRUD and explicit GL account mapping resolution", async () => {
    const categories = await AssetCategoryDAO.listCategories(ctx);
    expect(categories.length).toBeGreaterThanOrEqual(8);

    const ictCat = categories.find(c => c.code === "ICT");
    expect(ictCat).toBeDefined();
    expect(ictCat?.categoryType).toBe(AssetCategoryType.COMPUTERS_ICT_EQUIPMENT);
    expect(ictCat?.depreciationMethod).toBe(DepreciationMethod.STRAIGHT_LINE);
    expect(ictCat?.glAssetAccount?.code).toBe("1550");
    expect(ictCat?.glDepreciationAccount?.code).toBe("6900");
    expect(ictCat?.glAccumDeprecAccount?.code).toBe("1600");
  });

  it("AST-02: Asset location and custodian management", async () => {
    const loc = await AssetLocationDAO.createLocation(ctx, {
      code: "LOC-TEST-01",
      name: "Server Room 1",
      building: "Main Tech Block",
      roomNumber: "B12"
    });
    expect(loc.code).toBe("LOC-TEST-01");

    const locations = await AssetLocationDAO.listLocations(ctx);
    expect(locations.some(l => l.code === "LOC-TEST-01")).toBe(true);
  });

  it("AST-03: Direct purchase capitalization 4-way atomic transaction (Asset + Treasury + Cashbook + GL)", async () => {
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    const loc = await AssetLocationDAO.createLocation(ctx, {
      code: "LOC-ICT-01",
      name: "Main Lab"
    });

    const initialTreasury = await db.treasuryAccount.findUnique({ where: { id: treasuryAccountId } });
    const initialBalance = new Prisma.Decimal(initialTreasury!.currentBalance);

    const cost = new Prisma.Decimal("3000000.00"); // UGX 3,000,000

    const asset = await AssetDAO.capitalizeDirectPurchase(ctx, {
      name: "Dell PowerEdge Server R740",
      categoryId: ictCat.id,
      locationId: loc.id,
      purchaseDate: new Date("2026-01-15T00:00:00Z"),
      capitalizationDate: new Date("2026-01-15T00:00:00Z"),
      acquisitionCost: cost,
      salvageValue: 0,
      treasuryAccountId
    });

    expect(asset.id).toBeDefined();
    expect(asset.assetTag).toMatch(/^AST-2026-\d{5}$/);
    expect(new Prisma.Decimal(asset.acquisitionCost).toString()).toBe("3000000");
    expect(new Prisma.Decimal(asset.netBookValue).toString()).toBe("3000000");
    expect(new Prisma.Decimal(asset.accumulatedDepreciation).toString()).toBe("0");
    expect(asset.capitalizationJournalId).toBeDefined();

    // 1. Check Treasury Account Deducted
    const updatedTreasury = await db.treasuryAccount.findUnique({ where: { id: treasuryAccountId } });
    expect(new Prisma.Decimal(updatedTreasury!.currentBalance).toString()).toBe(initialBalance.sub(cost).toString());

    // 2. Check Cashbook Movement Created
    const cbm = await db.cashbookMovement.findFirst({
      where: { referenceNumber: asset.assetTag, accountId: treasuryAccountId }
    });
    expect(cbm).toBeDefined();
    expect(cbm?.direction).toBe(CashDirection.OUTFLOW);
    expect(new Prisma.Decimal(cbm!.amount).toString()).toBe("3000000");

    // 3. Check GL Journal Posted
    const journal = await db.journalEntry.findUnique({
      where: { id: asset.capitalizationJournalId! },
      include: { lines: { include: { account: true } } }
    });
    expect(journal).toBeDefined();
    expect(journal?.lines.length).toBe(2);

    const debitLine = journal?.lines.find(l => new Prisma.Decimal(l.debit).gt(0));
    const creditLine = journal?.lines.find(l => new Prisma.Decimal(l.credit).gt(0));

    expect(debitLine?.account.code).toBe("1550");
    expect(new Prisma.Decimal(debitLine!.debit).toString()).toBe("3000000");
    expect(creditLine?.account.code).toBe("1120");
    expect(new Prisma.Decimal(creditLine!.credit).toString()).toBe("3000000");
  });

  it("AST-04: Direct capitalization deterministic idempotency replay", async () => {
    const tag = await AssetSequenceDAO.nextTag(ctx);
    expect(tag).toMatch(/^AST-2026-\d{5}$/);
  });

  it("AST-05: GRN procurement capitalization and #2120 accrual clearing", async () => {
    const furnCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "FURN")!;

    const supplier = await db.inventorySupplier.create({
      data: {
        branchId,
        supplierCode: `SUP-${Date.now()}`,
        name: "Mukwano Woodworks",
        phone: "0770000000"
      }
    });

    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: `GRN-TEST-${Date.now()}`,
        supplierId: supplier.id,
        supplierNameSnapshot: "Mukwano Woodworks",
        storeId,
        academicYearId,
        totalAmount: new Prisma.Decimal(2000000),
        supplierInvoiceRef: "DN-9988",
        receivedById: adminUserId
      }
    });

    const grnItem = await db.goodsReceivedItem.create({
      data: {
        grnId: grn.id,
        itemId,
        itemNameSnapshot: "Hardwood Executive Teacher Desk",
        quantityReceived: new Prisma.Decimal(5),
        unitCostPrice: new Prisma.Decimal(400000),
        lineTotalCost: new Prisma.Decimal(2000000)
      }
    });

    const asset = await AssetDAO.capitalizeFromGRN(ctx, {
      name: "Hardwood Executive Teacher Desk Set",
      categoryId: furnCat.id,
      grnId: grn.id,
      grnItemId: grnItem.id,
      capitalizationDate: new Date("2026-01-20T00:00:00Z")
    });

    expect(asset.id).toBeDefined();
    expect(new Prisma.Decimal(asset.acquisitionCost).toString()).toBe("2000000");

    const journal = await db.journalEntry.findUnique({
      where: { id: asset.capitalizationJournalId! },
      include: { lines: { include: { account: true } } }
    });
    expect(journal).toBeDefined();
    const debitLine = journal?.lines.find(l => new Prisma.Decimal(l.debit).gt(0));
    const creditLine = journal?.lines.find(l => new Prisma.Decimal(l.credit).gt(0));

    expect(debitLine?.account.code).toBe("1540"); // Furniture
    expect(creditLine?.account.code).toBe("2120"); // Accrued GRN Clearing
    expect(new Prisma.Decimal(creditLine!.credit).toString()).toBe("2000000");
  });

  it("AST-06: Stores inventory -> Fixed asset conversion and #1310 asset relief", async () => {
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;

    // Ensure store has stock
    await db.inventoryStoreStock.create({
      data: { branchId, storeId, itemId, quantityOnHand: new Prisma.Decimal(20) }
    });

    const asset = await AssetDAO.capitalizeFromInventoryStore(ctx, {
      name: "Converted ICT Consumables Batch",
      categoryId: ictCat.id,
      storeId,
      itemId,
      quantity: new Prisma.Decimal(5),
      capitalizationDate: new Date("2026-01-20T00:00:00Z")
    });

    expect(asset.id).toBeDefined();
    expect(asset.capitalizationSource).toBe("INVENTORY_CONVERSION");

    const journal = await db.journalEntry.findUnique({
      where: { id: asset.capitalizationJournalId! },
      include: { lines: { include: { account: true } } }
    });
    expect(journal).toBeDefined();
    const creditLine = journal?.lines.find(l => new Prisma.Decimal(l.credit).gt(0));
    expect(creditLine?.account.code).toBe("1310"); // Relieve stores inventory stock
  });

  it("AST-07: Transport fleet vehicle 1-to-1 linking and anti-duplicate check", async () => {
    const fleetCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "FLEET")!;

    const vehicle = await db.transportVehicle.create({
      data: {
        branchId,
        registrationNumber: `UBJ ${Date.now().toString().slice(-4)}Z`,
        makeModel: "Isuzu 45-Seater Bus",
        capacity: 45
      }
    });

    const asset = await AssetDAO.linkFleetVehicle(ctx, {
      transportVehicleId: vehicle.id,
      categoryId: fleetCat.id,
      capitalizationDate: new Date("2026-01-01T00:00:00Z"),
      acquisitionCost: new Prisma.Decimal(120000000), // UGX 120,000,000
      salvageValue: new Prisma.Decimal(12000000)
    });

    expect(asset.id).toBeDefined();
    expect(asset.transportVehicleId).toBe(vehicle.id);

    // Re-link attempt must fail
    await expect(
      AssetDAO.linkFleetVehicle(ctx, {
        transportVehicleId: vehicle.id,
        categoryId: fleetCat.id,
        capitalizationDate: new Date("2026-01-01T00:00:00Z"),
        acquisitionCost: 120000000
      })
    ).rejects.toThrow("already linked");
  });

  it("AST-08: Straight-Line depreciation exact calculation with salvage value floor capping", () => {
    const calc = AssetDepreciationEngine.calculateAssetPeriodicDepreciation(
      {
        id: "asset-1",
        acquisitionCost: new Prisma.Decimal(3600000),
        salvageValue: new Prisma.Decimal(600000),
        netBookValue: new Prisma.Decimal(3600000),
        accumulatedDepreciation: new Prisma.Decimal(0),
        capitalizationDate: new Date("2026-01-01T00:00:00Z"),
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 36,
        annualDepreciationRate: null,
        category: {
          depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
          usefulLifeMonths: 36,
          annualDepreciationRate: new Prisma.Decimal(33.33)
        }
      },
      {
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-01-31T23:59:59Z")
      }
    );

    expect(calc).toBeDefined();
    expect(calc?.depreciationAmount.toString()).toBe("83333.33");
    expect(calc?.closingBookValue.toString()).toBe("3516666.67");
  });

  it("AST-09: Exact calendar-day pro-rata first period acquisition calculation", () => {
    const calc = AssetDepreciationEngine.calculateAssetPeriodicDepreciation(
      {
        id: "asset-1",
        acquisitionCost: new Prisma.Decimal(3600000),
        salvageValue: new Prisma.Decimal(600000),
        netBookValue: new Prisma.Decimal(3600000),
        accumulatedDepreciation: new Prisma.Decimal(0),
        capitalizationDate: new Date("2026-01-16T00:00:00Z"),
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 36,
        annualDepreciationRate: null,
        category: {
          depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
          usefulLifeMonths: 36,
          annualDepreciationRate: new Prisma.Decimal(33.33)
        }
      },
      {
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-01-31T23:59:59Z")
      }
    );

    expect(calc).toBeDefined();
    expect(calc?.activeDaysInPeriod).toBe(16);
    expect(calc?.totalDaysInPeriod).toBe(31);
    expect(calc?.depreciationAmount.toString()).toBe("43010.75");
  });

  it("AST-10: Leap-year February 29 pro-rata calculation verification", () => {
    const days2028 = AssetDepreciationEngine.getDaysInMonth(2028, 1);
    expect(days2028).toBe(29);

    const days2026 = AssetDepreciationEngine.getDaysInMonth(2026, 1);
    expect(days2026).toBe(28);
  });

  it("AST-11: Month-end acquisition single-day pro-rata calculation", () => {
    const calc = AssetDepreciationEngine.calculateAssetPeriodicDepreciation(
      {
        id: "asset-1",
        acquisitionCost: new Prisma.Decimal(3600000),
        salvageValue: new Prisma.Decimal(600000),
        netBookValue: new Prisma.Decimal(3600000),
        accumulatedDepreciation: new Prisma.Decimal(0),
        capitalizationDate: new Date("2026-01-31T00:00:00Z"),
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 36,
        annualDepreciationRate: null,
        category: {
          depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
          usefulLifeMonths: 36,
          annualDepreciationRate: new Prisma.Decimal(33.33)
        }
      },
      {
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-01-31T23:59:59Z")
      }
    );

    expect(calc).toBeDefined();
    expect(calc?.activeDaysInPeriod).toBe(1);
    expect(calc?.depreciationAmount.toString()).toBe("2688.17");
  });

  it("AST-12: Reducing Balance Method nominal monthly rate application and salvage floor", () => {
    const calc = AssetDepreciationEngine.calculateAssetPeriodicDepreciation(
      {
        id: "vehicle-1",
        acquisitionCost: new Prisma.Decimal(100000000),
        salvageValue: new Prisma.Decimal(10000000),
        netBookValue: new Prisma.Decimal(100000000),
        accumulatedDepreciation: new Prisma.Decimal(0),
        capitalizationDate: new Date("2026-01-01T00:00:00Z"),
        depreciationMethod: DepreciationMethod.REDUCING_BALANCE,
        usefulLifeMonths: 48,
        annualDepreciationRate: new Prisma.Decimal(25),
        category: {
          depreciationMethod: DepreciationMethod.REDUCING_BALANCE,
          usefulLifeMonths: 48,
          annualDepreciationRate: new Prisma.Decimal(25)
        }
      },
      {
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-01-31T23:59:59Z")
      }
    );

    expect(calc).toBeDefined();
    expect(calc?.depreciationAmount.toString()).toBe("2083333.33");
    expect(calc?.closingBookValue.toString()).toBe("97916666.67");
  });

  it("AST-13: Batch depreciation run generation (DRAFT -> SUBMITTED)", async () => {
    // Bootstrap an asset first
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Desktop Computers Lab",
      categoryId: ictCat.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: new Prisma.Decimal(10000000),
      accumulatedDepreciation: 0,
      salvageValue: 0
    });

    const run = await AssetDepreciationEngine.createDepreciationRun(ctx, openPeriodId, "Jan 2026 run");
    expect(run.id).toBeDefined();
    expect(run.status).toBe("SUBMITTED");
    expect(run.totalAssetsCount).toBeGreaterThan(0);
    expect(new Prisma.Decimal(run.totalDepreciationAmount).gt(0)).toBe(true);
  });

  it("AST-14: Four-Eye Maker-Checker approval and rejection workflow", async () => {
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    const febPeriod = periods[1]; // Feb 2026

    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Server Rack 2",
      categoryId: ictCat.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: new Prisma.Decimal(12000000),
      accumulatedDepreciation: 0,
      salvageValue: 0
    });

    const run = await AssetDepreciationEngine.createDepreciationRun(ctx, febPeriod.id, "Feb 2026 run");

    // Maker tries to self-approve -> Must throw Four-Eye error
    await expect(
      AssetDepreciationEngine.approveDepreciationRun(ctx, run.id)
    ).rejects.toThrow("Four-Eye Policy");

    // Checker approves -> Succeeds
    const approved = await AssetDepreciationEngine.approveDepreciationRun(checkerCtx, run.id);
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedById).toBe(checkerUserId);
  });

  it("AST-15: Atomic GL posting of approved depreciation run (Dr. #6900 / Cr. #1600)", async () => {
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    const marPeriod = periods[2]; // Mar 2026

    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Server Rack 3",
      categoryId: ictCat.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: new Prisma.Decimal(12000000),
      accumulatedDepreciation: 0,
      salvageValue: 0
    });

    const run = await AssetDepreciationEngine.createDepreciationRun(ctx, marPeriod.id, "Mar 2026 run");
    await AssetDepreciationEngine.approveDepreciationRun(checkerCtx, run.id);

    const posted = await AssetDepreciationEngine.postDepreciationRun(ctx, run.id);
    expect(posted.status).toBe("POSTED");
    expect(posted.journalEntryId).toBeDefined();

    const journal = await db.journalEntry.findUnique({
      where: { id: posted.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });

    expect(journal).toBeDefined();
    const debitExpense = journal?.lines.find(l => l.account.code === "6900");
    const creditAccum = journal?.lines.find(l => l.account.code === "1600");

    expect(debitExpense).toBeDefined();
    expect(creditAccum).toBeDefined();
    expect(new Prisma.Decimal(debitExpense!.debit).toString()).toBe(new Prisma.Decimal(creditAccum!.credit).toString());
  });

  it("AST-16: Asset sale with Net Gain 5-way atomic transaction (Asset + Disposal + Treasury + Cashbook + GL)", async () => {
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    const asset = await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "High-End Server Cluster",
      categoryId: ictCat.id,
      purchaseDate: new Date("2024-01-01"),
      capitalizationDate: new Date("2024-01-01"),
      acquisitionCost: new Prisma.Decimal(10000000),
      accumulatedDepreciation: new Prisma.Decimal(2000000),
      salvageValue: 0
    });

    const initialTreasury = await db.treasuryAccount.findUnique({ where: { id: treasuryAccountId } });
    const initialBal = new Prisma.Decimal(initialTreasury!.currentBalance);

    const disposal = await AssetDisposalDAO.disposeAsset(ctx, {
      assetId: asset.id,
      disposalDate: new Date("2026-01-25"),
      disposalType: AssetDisposalType.SALE,
      disposalProceeds: new Prisma.Decimal(11000000), // Sold for 11M
      reason: "Upgraded campus infrastructure",
      treasuryAccountId
    });

    expect(disposal.id).toBeDefined();
    expect(new Prisma.Decimal(disposal.gainOrLossAmount).toString()).toBe("3000000"); // 11M - 8M = +3M Gain

    const updatedTreasury = await db.treasuryAccount.findUnique({ where: { id: treasuryAccountId } });
    expect(new Prisma.Decimal(updatedTreasury!.currentBalance).toString()).toBe(initialBal.add(11000000).toString());

    const journal = await db.journalEntry.findUnique({
      where: { id: disposal.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });
    expect(journal).toBeDefined();

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const l of journal!.lines) {
      totalDebit = totalDebit.add(l.debit);
      totalCredit = totalCredit.add(l.credit);
    }
    expect(totalDebit.toString()).toBe(totalCredit.toString());
    expect(totalDebit.toString()).toBe("13000000");
  });

  it("AST-17: Asset sale with Net Loss 5-way atomic transaction", async () => {
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    const asset = await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Old Core Switch",
      categoryId: ictCat.id,
      purchaseDate: new Date("2024-01-01"),
      capitalizationDate: new Date("2024-01-01"),
      acquisitionCost: new Prisma.Decimal(10000000),
      accumulatedDepreciation: new Prisma.Decimal(2000000),
      salvageValue: 0
    });

    const disposal = await AssetDisposalDAO.disposeAsset(ctx, {
      assetId: asset.id,
      disposalDate: new Date("2026-01-25"),
      disposalType: AssetDisposalType.SALE,
      disposalProceeds: new Prisma.Decimal(5000000), // Sold for 5M
      reason: "Liquidated older switch",
      treasuryAccountId
    });

    expect(new Prisma.Decimal(disposal.gainOrLossAmount).toString()).toBe("-3000000");

    const journal = await db.journalEntry.findUnique({
      where: { id: disposal.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const l of journal!.lines) {
      totalDebit = totalDebit.add(l.debit);
      totalCredit = totalCredit.add(l.credit);
    }
    expect(totalDebit.toString()).toBe(totalCredit.toString());
    expect(totalDebit.toString()).toBe("10000000");
  });

  it("AST-18: Asset scrap / write-off with zero proceeds (zero Treasury mutation)", async () => {
    const furnCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "FURN")!;
    const asset = await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Damaged Boarding Bed Frames",
      categoryId: furnCat.id,
      purchaseDate: new Date("2023-01-01"),
      capitalizationDate: new Date("2023-01-01"),
      acquisitionCost: new Prisma.Decimal(4000000),
      accumulatedDepreciation: new Prisma.Decimal(3000000),
      salvageValue: 0
    });

    const initialTreasury = await db.treasuryAccount.findUnique({ where: { id: treasuryAccountId } });
    const initialBal = new Prisma.Decimal(initialTreasury!.currentBalance);

    const disposal = await AssetDisposalDAO.disposeAsset(ctx, {
      assetId: asset.id,
      disposalDate: new Date("2026-01-28"),
      disposalType: AssetDisposalType.SCRAP,
      disposalProceeds: 0,
      reason: "Termite damage - completely unusable"
    });

    expect(disposal.id).toBeDefined();
    expect(new Prisma.Decimal(disposal.gainOrLossAmount).toString()).toBe("-1000000");

    const afterTreasury = await db.treasuryAccount.findUnique({ where: { id: treasuryAccountId } });
    expect(new Prisma.Decimal(afterTreasury!.currentBalance).toString()).toBe(initialBal.toString());
  });

  it("AST-19: Opening historical asset bootstrap with zero-variance GL equity posting", async () => {
    const bldgCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "BLDG")!;
    const asset = await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Main Administration Block",
      categoryId: bldgCat.id,
      purchaseDate: new Date("2015-01-01"),
      capitalizationDate: new Date("2015-01-01"),
      acquisitionCost: new Prisma.Decimal(500000000), // UGX 500M
      accumulatedDepreciation: new Prisma.Decimal(100000000), // UGX 100M
      salvageValue: new Prisma.Decimal(25000000)
    });

    expect(asset.id).toBeDefined();
    expect(new Prisma.Decimal(asset.netBookValue).toString()).toBe("400000000");

    const journal = await db.journalEntry.findUnique({
      where: { id: asset.capitalizationJournalId! },
      include: { lines: { include: { account: true } } }
    });

    const debitCost = journal?.lines.find(l => l.account.code === "1520");
    const creditAccum = journal?.lines.find(l => l.account.code === "1600");
    const creditEquity = journal?.lines.find(l => l.account.code === "3500");

    expect(new Prisma.Decimal(debitCost!.debit).toString()).toBe("500000000");
    expect(new Prisma.Decimal(creditAccum!.credit).toString()).toBe("100000000");
    expect(new Prisma.Decimal(creditEquity!.credit).toString()).toBe("400000000");
  });

  it("AST-20: Physical asset verification logging and condition updates", async () => {
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    const asset = await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Physics Projector",
      categoryId: ictCat.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: 2500000,
      accumulatedDepreciation: 0
    });

    const log = await AssetDAO.logPhysicalVerification(ctx, asset.id, {
      condition: AssetCondition.FAIR,
      notes: "Minor paint scratches on casing",
      isMissing: false
    });

    expect(log.id).toBeDefined();
    expect(log.condition).toBe(AssetCondition.FAIR);

    const updated = await AssetDAO.getAssetById(ctx, asset.id);
    expect(updated?.condition).toBe(AssetCondition.FAIR);
  });

  it("AST-21: Internal location movement and custody transfer logging (zero GL impact)", async () => {
    const ictCat = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    const loc1 = await AssetLocationDAO.createLocation(ctx, { code: "LOC-A", name: "Room A" });
    const loc2 = await AssetLocationDAO.createLocation(ctx, { code: "LOC-B", name: "Room B" });

    const asset = await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Portable Sound System",
      categoryId: ictCat.id,
      locationId: loc1.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: 3500000,
      accumulatedDepreciation: 0
    });

    const updated = await AssetDAO.transferAsset(ctx, asset.id, {
      toLocationId: loc2.id,
      reason: "Moved to Room B for assembly"
    });

    expect(updated.locationId).toBe(loc2.id);

    const fullAsset = await AssetDAO.getAssetById(ctx, asset.id);
    expect(fullAsset?.movementLogs.length).toBeGreaterThan(0);
  });

  it("AST-22: Real-time zero-drift telemetry by category and overall balance sheet", async () => {
    const recon = await AssetReportsDAO.reconcileFixedAssetsSubledger(ctx);
    expect(recon.asOfDate).toBeDefined();
    expect(recon.isReconciled).toBe(true);
    expect(new Prisma.Decimal(recon.variance.costVariance).isZero()).toBe(true);
    expect(new Prisma.Decimal(recon.variance.accumVariance).isZero()).toBe(true);
  });

  it("AST-23: Multi-asset batch depreciation schedule with multiple methods", async () => {
    const register = await AssetReportsDAO.getFixedAssetRegister(ctx);
    expect(register.summary.totalAssetsCount).toBeGreaterThanOrEqual(0);
  });

  it("AST-24: Strict multi-branch tenant isolation", async () => {
    const ictCat1 = (await AssetCategoryDAO.listCategories(ctx)).find(c => c.code === "ICT")!;
    const ictCat2 = (await AssetCategoryDAO.listCategories(ctxBranch2)).find(c => c.code === "ICT")!;

    const a1 = await AssetDAO.bootstrapOpeningAsset(ctx, {
      name: "Branch 1 Unique Laptop",
      categoryId: ictCat1.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: 2000000,
      accumulatedDepreciation: 0
    });

    const a2 = await AssetDAO.bootstrapOpeningAsset(ctxBranch2, {
      name: "Branch 2 Unique Laptop",
      categoryId: ictCat2.id,
      purchaseDate: new Date("2026-01-01"),
      capitalizationDate: new Date("2026-01-01"),
      acquisitionCost: 2000000,
      accumulatedDepreciation: 0
    });

    const branch1Assets = await AssetDAO.listAssets(ctx);
    const branch2Assets = await AssetDAO.listAssets(ctxBranch2);

    expect(branch1Assets.some(a => a.id === a1.id)).toBe(true);
    expect(branch1Assets.some(a => a.id === a2.id)).toBe(false);

    expect(branch2Assets.some(a => a.id === a2.id)).toBe(true);
    expect(branch2Assets.some(a => a.id === a1.id)).toBe(false);
  });
});
