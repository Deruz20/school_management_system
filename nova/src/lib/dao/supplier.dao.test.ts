import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  SupplierInvoiceStatus,
  SupplierCreditNoteStatus,
  SupplierPaymentStatus,
  ThreeWayMatchStatus,
  PaymentMethod,
  SupplyCategory
} from "@prisma/client";
import { SupplierDAO } from "@/lib/dao/supplier.dao";
import { SupplierInvoiceDAO } from "@/lib/dao/supplier-invoice.dao";
import { SupplierCreditNoteDAO } from "@/lib/dao/supplier-credit-note.dao";
import { SupplierPaymentDAO } from "@/lib/dao/supplier-payment.dao";
import { APReportsDAO } from "@/lib/dao/ap-reports.dao";
import { TaxPolicyEngine } from "@/lib/dao/tax-policy.engine";
import { GLAccountDAO, FiscalPeriodDAO } from "@/lib/dao/gl.dao";

describe("Phase 3.1N: Accounts Payable, Supplier Credit Management & 3-Way Matching (AP-01..AP-28)", () => {
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
  let inventoryItemId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `AP_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "AP High School", organizationId: org.id }
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
        firstName: "Checker",
        lastName: "Bursar",
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

    // Initialize Chart of Accounts, Fiscal Year 2026, Tax Policies
    await GLAccountDAO.initBranchChartOfAccounts(branchId);
    await GLAccountDAO.initBranchChartOfAccounts(branch2Id);
    await FiscalPeriodDAO.initFiscalYear(ctx, 2026);
    await FiscalPeriodDAO.initFiscalYear(ctxBranch2, 2026);
    await TaxPolicyEngine.initBranchDefaultTaxPolicies(ctx);
    await TaxPolicyEngine.initBranchDefaultTaxPolicies(ctxBranch2);

    const period = await db.fiscalPeriod.findFirst({
      where: { branchId, fiscalYear: { name: "FY 2026" }, periodNumber: 1 }
    });
    openPeriodId = period!.id;

    const ay = await db.academicYear.create({
      data: {
        branchId,
        name: `AY-2026-${Date.now()}`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      }
    });
    academicYearId = ay.id;

    // Create Treasury Account
    const bankGl = (await GLAccountDAO.getAccountByCode(ctx, "1120"))!.id;
    const treasury = await db.treasuryAccount.create({
      data: {
        branchId,
        code: `TR-BANK-${Date.now().toString().slice(-4)}`,
        name: "Stanbic Operations Bank",
        accountType: "COMMERCIAL_BANK",
        currentBalance: new Prisma.Decimal("50000000.00"), // UGX 50M
        openingBalance: new Prisma.Decimal("50000000.00"),
        glAccountId: bankGl,
        isActive: true
      }
    });
    treasuryAccountId = treasury.id;

    // Create Inventory Store and Item
    const store = await db.inventoryStore.create({
      data: {
        branchId,
        code: `STR-${Date.now().toString().slice(-4)}`,
        name: "Main Campus Store"
      }
    });
    storeId = store.id;

    const item = await db.inventoryItem.create({
      data: {
        branchId,
        code: `ITM-POSHO-${Date.now().toString().slice(-4)}`,
        name: "Super Fine Maize Posho (50kg)",
        category: "FOOD_RATIONS",
        unitOfMeasure: "BAG",
        unitCostPrice: new Prisma.Decimal("120000.00"),
        reorderLevel: new Prisma.Decimal(10)
      }
    });
    inventoryItemId = item.id;
  });

  // ==========================================================================
  // AP-01 to AP-04: Supplier Master & Balance Recalculation
  // ==========================================================================
  it("AP-01: Creates Supplier Master with automatic sequence and branch isolation", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Mukwano Industries Uganda Ltd",
      phone: "+256700112233",
      email: "orders@mukwano.com",
      taxIdNumber: "1000293841",
      paymentTermsDays: 30,
      creditLimitUGX: "25000000.00",
      vatRegistered: true
    });

    expect(supplier.id).toBeDefined();
    expect(supplier.supplierCode).toMatch(/^SUP-2026-\d{5}$/);
    expect(supplier.branchId).toBe(branchId);
    expect(new Prisma.Decimal(supplier.currentBalanceUGX).isZero()).toBe(true);

    // Cross-branch isolation check
    const branch2List = await SupplierDAO.listSuppliers(ctxBranch2);
    expect(branch2List.find((s) => s.id === supplier.id)).toBeUndefined();
  });

  it("AP-02: Prevents duplicate supplier names or codes in the same branch", async () => {
    await SupplierDAO.createSupplier(ctx, {
      name: "Kampala Modern Printers",
      phone: "+256782111222"
    });

    await expect(
      SupplierDAO.createSupplier(ctx, {
        name: "Kampala Modern Printers",
        phone: "+256782333444"
      })
    ).rejects.toThrow(/already exists/i);
  });

  it("AP-03: Updates Supplier details and toggles credit block", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "TotalEnergies Uganda",
      phone: "+256701999888",
      creditLimitUGX: "10000000.00"
    });

    const updated = await SupplierDAO.updateSupplier(ctx, supplier.id, {
      isCreditBlocked: true,
      notes: "Blocked due to pending credit limit review"
    });

    expect(updated.isCreditBlocked).toBe(true);
    expect(updated.notes).toContain("pending credit limit");
  });

  it("AP-04: Recalculates supplier balance exactly across subledger records", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Crown Beverages (Pepsi)",
      phone: "+256772444555"
    });

    const balance = await db.$transaction(async (tx) => {
      return await SupplierDAO.syncSupplierBalance(tx, ctx, supplier.id);
    });

    expect(balance.isZero()).toBe(true);
  });

  // ==========================================================================
  // AP-05 to AP-07: Versioned Dynamic Tax Policy Engine
  // ==========================================================================
  it("AP-05: Evaluates WHT 6% on supplies >= UGX 1,000,000 threshold", async () => {
    const result = await db.$transaction(async (tx) => {
      return await TaxPolicyEngine.evaluateTax(tx, {
        branchId,
        supplyCategory: SupplyCategory.GOODS,
        transactionDate: new Date("2026-02-15"),
        grossAmount: new Prisma.Decimal("2500000.00"),
        isSupplierWhtExempt: false,
        isSupplierVatRegistered: false,
        hasEfrisInvoice: true
      });
    });

    expect(result.whtRatePercent.equals(6)).toBe(true);
    expect(result.whtAmount.equals(150000)).toBe(true); // 6% of 2.5M
  });

  it("AP-06: Evaluates WHT exemption for qualified suppliers", async () => {
    const result = await db.$transaction(async (tx) => {
      return await TaxPolicyEngine.evaluateTax(tx, {
        branchId,
        supplyCategory: SupplyCategory.GOODS,
        transactionDate: new Date("2026-02-15"),
        grossAmount: new Prisma.Decimal("5000000.00"),
        isSupplierWhtExempt: true,
        whtExemptionExpiry: new Date("2026-12-31"),
        isSupplierVatRegistered: false,
        hasEfrisInvoice: true
      });
    });

    expect(result.whtAmount.isZero()).toBe(true);
  });

  it("AP-07: Evaluates VAT 18% on registered vendors", async () => {
    const result = await db.$transaction(async (tx) => {
      return await TaxPolicyEngine.evaluateTax(tx, {
        branchId,
        supplyCategory: SupplyCategory.GOODS,
        transactionDate: new Date("2026-02-15"),
        grossAmount: new Prisma.Decimal("1000000.00"),
        isSupplierWhtExempt: false,
        isSupplierVatRegistered: true,
        hasEfrisInvoice: true
      });
    });

    expect(result.vatRatePercent.equals(18)).toBe(true);
    expect(result.vatAmount.equals(180000)).toBe(true);
    expect(result.netPayableAmount.equals(1180000)).toBe(true);
  });

  // ==========================================================================
  // AP-08 to AP-11: Deterministic 3-Way Matching Engine & Tolerances
  // ==========================================================================
  it("AP-08: Performs 3-Way Perfect Match PO <-> GRN <-> Supplier Invoice", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Uganda Grain Millers Ltd",
      phone: "+256752000111"
    });

    // 1. Create PO
    const po = await db.purchaseOrder.create({
      data: {
        branchId,
        poNumber: "PO-2026-0001",
        supplierId: supplier.id,
        academicYearId,
        totalAmount: new Prisma.Decimal("1200000.00"),
        createdById: adminUserId
      }
    });

    const poItem = await db.purchaseOrderItem.create({
      data: {
        poId: po.id,
        itemId: inventoryItemId,
        itemNameSnapshot: "Posho 50kg",
        quantityOrdered: new Prisma.Decimal(10),
        unitCostPrice: new Prisma.Decimal("120000.00"),
        lineTotalCost: new Prisma.Decimal("1200000.00")
      }
    });

    // 2. Create GRN
    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: "GRN-2026-0001",
        poId: po.id,
        supplierId: supplier.id,
        storeId,
        academicYearId,
        supplierNameSnapshot: supplier.name,
        totalAmount: new Prisma.Decimal("1200000.00"),
        receivedById: adminUserId
      }
    });

    const grnItem = await db.goodsReceivedItem.create({
      data: {
        grnId: grn.id,
        itemId: inventoryItemId,
        itemNameSnapshot: "Posho 50kg",
        quantityReceived: new Prisma.Decimal(10),
        invoicedQuantity: new Prisma.Decimal(0),
        uninvoicedQuantity: new Prisma.Decimal(10),
        unitCostPrice: new Prisma.Decimal("120000.00"),
        lineTotalCost: new Prisma.Decimal("1200000.00")
      }
    });

    // 3. Match Invoice
    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: "UGM-INV-9901",
      supplierId: supplier.id,
      poId: po.id,
      grnId: grn.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          poItemId: poItem.id,
          grnItemId: grnItem.id,
          itemId: inventoryItemId,
          description: "Posho 50kg matching GRN",
          quantityInvoiced: 10,
          unitPriceInvoiced: "120000.00"
        }
      ]
    });

    expect(invoice.matchStatus).toBe(ThreeWayMatchStatus.PERFECT_MATCH);
    expect(invoice.status).toBe(SupplierInvoiceStatus.MATCHED);
    expect(new Prisma.Decimal(invoice.ppvAmount).isZero()).toBe(true);
  });

  it("AP-09: Accepts Price Variance within allowable tolerance (PPV Pass)", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Agro Supply Co",
      phone: "+256752000222"
    });

    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: `GRN-${Date.now().toString().slice(-4)}`,
        supplierId: supplier.id,
        storeId,
        academicYearId,
        supplierNameSnapshot: supplier.name,
        totalAmount: new Prisma.Decimal("100000.00"),
        receivedById: adminUserId
      }
    });

    const grnItem = await db.goodsReceivedItem.create({
      data: {
        grnId: grn.id,
        itemId: inventoryItemId,
        itemNameSnapshot: "Posho 50kg",
        quantityReceived: new Prisma.Decimal(1),
        uninvoicedQuantity: new Prisma.Decimal(1),
        unitCostPrice: new Prisma.Decimal("100000.00"),
        lineTotalCost: new Prisma.Decimal("100000.00")
      }
    });

    // Invoiced at 102,000 (2% variance -> pass)
    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `AGRO-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          grnItemId: grnItem.id,
          description: "Posho 50kg",
          quantityInvoiced: 1,
          unitPriceInvoiced: "102000.00"
        }
      ]
    });

    expect(invoice.matchStatus).toBe(ThreeWayMatchStatus.PRICE_VARIANCE_PASS);
    expect(invoice.status).toBe(SupplierInvoiceStatus.MATCHED);
    expect(new Prisma.Decimal(invoice.ppvAmount).equals(2000)).toBe(true);
  });

  it("AP-10: Places invoice on hold when Price Variance exceeds allowable 5% limit", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Kampala Fresh Produce",
      phone: "+256752000333"
    });

    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: `GRN-${Date.now().toString().slice(-4)}`,
        supplierId: supplier.id,
        storeId,
        academicYearId,
        supplierNameSnapshot: supplier.name,
        totalAmount: new Prisma.Decimal("100000.00"),
        receivedById: adminUserId
      }
    });

    const grnItem = await db.goodsReceivedItem.create({
      data: {
        grnId: grn.id,
        itemId: inventoryItemId,
        itemNameSnapshot: "Posho 50kg",
        quantityReceived: new Prisma.Decimal(1),
        uninvoicedQuantity: new Prisma.Decimal(1),
        unitCostPrice: new Prisma.Decimal("100000.00"),
        lineTotalCost: new Prisma.Decimal("100000.00")
      }
    });

    // Invoiced at 120,000 (20% variance -> fails)
    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `KFP-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          grnItemId: grnItem.id,
          description: "Posho 50kg",
          quantityInvoiced: 1,
          unitPriceInvoiced: "120000.00"
        }
      ]
    });

    expect(invoice.matchStatus).toBe(ThreeWayMatchStatus.PRICE_VARIANCE_FAIL);
    expect(invoice.status).toBe(SupplierInvoiceStatus.ON_HOLD);
    expect(invoice.holdReason).toContain("variance");
  });

  it("AP-11: Rejects Over-Invoicing where Invoiced Qty > Available GRN Uninvoiced Qty", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Mukwano Oil Depot",
      phone: "+256752000444"
    });

    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: `GRN-${Date.now().toString().slice(-4)}`,
        supplierId: supplier.id,
        storeId,
        academicYearId,
        supplierNameSnapshot: supplier.name,
        totalAmount: new Prisma.Decimal("500000.00"),
        receivedById: adminUserId
      }
    });

    const grnItem = await db.goodsReceivedItem.create({
      data: {
        grnId: grn.id,
        itemId: inventoryItemId,
        itemNameSnapshot: "Cooking Oil 20L",
        quantityReceived: new Prisma.Decimal(5),
        uninvoicedQuantity: new Prisma.Decimal(5),
        unitCostPrice: new Prisma.Decimal("100000.00"),
        lineTotalCost: new Prisma.Decimal("500000.00")
      }
    });

    // Attempting to invoice 10 units when only 5 were received
    await expect(
      SupplierInvoiceDAO.createInvoice(ctx, {
        vendorInvoiceNumber: `OVER-INV-${Date.now()}`,
        supplierId: supplier.id,
        fiscalPeriodId: openPeriodId,
        invoiceDate: new Date("2026-02-10"),
        dueDate: new Date("2026-03-10"),
        lines: [
          {
            grnItemId: grnItem.id,
            description: "Cooking Oil 20L",
            quantityInvoiced: 10,
            unitPriceInvoiced: "100000.00"
          }
        ]
      })
    ).rejects.toThrow(/exceeds available uninvoiced GRN quantity/i);
  });

  // ==========================================================================
  // AP-12 to AP-17: 4-Eye Approval & Double-Entry GL Posting
  // ==========================================================================
  it("AP-12: Enforces Maker-Checker policy blocking self-approval of invoices", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Alpha Educational Supplies",
      phone: "+256752000555"
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `AES-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          description: "Examination Answer Booklets",
          quantityInvoiced: 500,
          unitPriceInvoiced: "2000.00"
        }
      ]
    });

    // Self-approval by maker must fail
    await expect(SupplierInvoiceDAO.approveInvoice(ctx, invoice.id)).rejects.toThrow(
      /Four-Eye Policy: The maker who created this invoice cannot self-approve it/i
    );
  });

  it("AP-13: Mutates GoodsReceivedItem invoiced/uninvoiced quantities upon approval", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Dairy Top Uganda",
      phone: "+256752000666"
    });

    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: `GRN-${Date.now().toString().slice(-4)}`,
        supplierId: supplier.id,
        storeId,
        academicYearId,
        supplierNameSnapshot: supplier.name,
        totalAmount: new Prisma.Decimal("1000000.00"),
        receivedById: adminUserId
      }
    });

    const grnItem = await db.goodsReceivedItem.create({
      data: {
        grnId: grn.id,
        itemId: inventoryItemId,
        itemNameSnapshot: "Fresh Milk 50L",
        quantityReceived: new Prisma.Decimal(10),
        uninvoicedQuantity: new Prisma.Decimal(10),
        unitCostPrice: new Prisma.Decimal("100000.00"),
        lineTotalCost: new Prisma.Decimal("1000000.00")
      }
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `DT-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          grnItemId: grnItem.id,
          description: "Fresh Milk 50L",
          quantityInvoiced: 6,
          unitPriceInvoiced: "100000.00"
        }
      ]
    });

    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    const refreshedGrnItem = await db.goodsReceivedItem.findUnique({
      where: { id: grnItem.id }
    });

    expect(new Prisma.Decimal(refreshedGrnItem!.invoicedQuantity).equals(6)).toBe(true);
    expect(new Prisma.Decimal(refreshedGrnItem!.uninvoicedQuantity).equals(4)).toBe(true);
  });

  it("AP-14: Posts balanced GL journal: Dr. #2120 GRNI / Cr. #2110 AP", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Mukwano Soap Depot",
      phone: "+256752000777"
    });

    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: `GRN-${Date.now().toString().slice(-4)}`,
        supplierId: supplier.id,
        storeId,
        academicYearId,
        supplierNameSnapshot: supplier.name,
        totalAmount: new Prisma.Decimal("500000.00"),
        receivedById: adminUserId
      }
    });

    const grnItem = await db.goodsReceivedItem.create({
      data: {
        grnId: grn.id,
        itemId: inventoryItemId,
        itemNameSnapshot: "Laundry Bar Soap",
        quantityReceived: new Prisma.Decimal(5),
        uninvoicedQuantity: new Prisma.Decimal(5),
        unitCostPrice: new Prisma.Decimal("100000.00"),
        lineTotalCost: new Prisma.Decimal("500000.00")
      }
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `MSD-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          grnItemId: grnItem.id,
          description: "Laundry Bar Soap",
          quantityInvoiced: 5,
          unitPriceInvoiced: "100000.00"
        }
      ]
    });

    const approved = await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);
    expect(approved.journalEntryId).toBeDefined();

    const journal = await db.journalEntry.findUnique({
      where: { id: approved.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });

    expect(journal).toBeDefined();
    const grniLine = journal!.lines.find((l) => l.account.code === "2120");
    const apLine = journal!.lines.find((l) => l.account.code === "2110");

    expect(new Prisma.Decimal(grniLine!.debit).equals(500000)).toBe(true);
    expect(new Prisma.Decimal(apLine!.credit).equals(500000)).toBe(true);
  });

  it("AP-15: Posts Purchase Price Variance to #5900 on price discrepancy", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Bata Shoe Company",
      phone: "+256752000888"
    });

    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: `GRN-${Date.now().toString().slice(-4)}`,
        supplierId: supplier.id,
        storeId,
        academicYearId,
        supplierNameSnapshot: supplier.name,
        totalAmount: new Prisma.Decimal("100000.00"),
        receivedById: adminUserId
      }
    });

    const grnItem = await db.goodsReceivedItem.create({
      data: {
        grnId: grn.id,
        itemId: inventoryItemId,
        itemNameSnapshot: "Black Leather School Shoes",
        quantityReceived: new Prisma.Decimal(1),
        uninvoicedQuantity: new Prisma.Decimal(1),
        unitCostPrice: new Prisma.Decimal("100000.00"),
        lineTotalCost: new Prisma.Decimal("100000.00")
      }
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `BATA-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          grnItemId: grnItem.id,
          description: "Black Leather Shoes",
          quantityInvoiced: 1,
          unitPriceInvoiced: "102000.00" // 2,000 UGX PPV
        }
      ]
    });

    const approved = await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);
    const journal = await db.journalEntry.findUnique({
      where: { id: approved.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });

    const ppvLine = journal!.lines.find((l) => l.account.code === "5900");
    expect(ppvLine).toBeDefined();
    expect(new Prisma.Decimal(ppvLine!.debit).equals(2000)).toBe(true);
  });

  it("AP-16: Posts Direct Service / Operating Expense Bill to Expense GL and #2110", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Speedy Internet Solutions",
      phone: "+256752000999"
    });

    const expCat = await db.expenseCategory.create({
      data: {
        branchId,
        code: `NET-${Date.now().toString().slice(-4)}`,
        name: "Campus High-Speed Fiber Internet",
        glAccountId: (await GLAccountDAO.getAccountByCode(ctx, "6500"))!.id
      }
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `SIS-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      supplyCategory: SupplyCategory.STANDARD_SERVICES,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          expenseCategoryId: expCat.id,
          description: "Monthly Dedicated Fiber 100Mbps",
          quantityInvoiced: 1,
          unitPriceInvoiced: "1500000.00"
        }
      ]
    });

    const approved = await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);
    const journal = await db.journalEntry.findUnique({
      where: { id: approved.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });

    const expLine = journal!.lines.find((l) => l.account.code === "6500");
    const apLine = journal!.lines.find((l) => l.account.code === "2110");

    expect(new Prisma.Decimal(expLine!.debit).equals(1500000)).toBe(true);
    expect(new Prisma.Decimal(apLine!.credit).equals(1500000)).toBe(true);
  });

  it("AP-17: Manages Invoice Dispute, Hold and Release Lifecycle", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "City Cleaners Uganda",
      phone: "+256752111000"
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `CC-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          description: "Sanitation Consumables",
          quantityInvoiced: 10,
          unitPriceInvoiced: "50000.00"
        }
      ]
    });

    const held = await SupplierInvoiceDAO.setHoldStatus(ctx, invoice.id, "Pending vendor credit note adjustment", true);
    expect(held.status).toBe(SupplierInvoiceStatus.DISPUTED);

    const released = await SupplierInvoiceDAO.releaseHold(ctx, invoice.id);
    expect(released.status).toBe(SupplierInvoiceStatus.MATCHED);
  });

  // ==========================================================================
  // AP-18 to AP-19: Supplier Credit Notes & Invoice Allocations
  // ==========================================================================
  it("AP-18: Creates & Approves Supplier Credit Note posting Dr. #2110 / Cr. #1310", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Mukwano Soap Ref",
      phone: "+256752111222"
    });

    const crn = await SupplierCreditNoteDAO.createCreditNote(ctx, {
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      creditNoteDate: new Date("2026-02-15"),
      reason: "Damaged bar soap returned to vendor",
      lines: [
        {
          itemId: inventoryItemId,
          description: "Damaged bar soap return",
          quantityReturned: 2,
          unitPrice: "100000.00"
        }
      ]
    });

    const approved = await SupplierCreditNoteDAO.approveCreditNote(checkerCtx, crn.id);
    expect(approved.status).toBe(SupplierCreditNoteStatus.POSTED);

    const journal = await db.journalEntry.findUnique({
      where: { id: approved.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });

    const apLine = journal!.lines.find((l) => l.account.code === "2110");
    const invLine = journal!.lines.find((l) => l.account.code === "1310");

    expect(new Prisma.Decimal(apLine!.debit).equals(200000)).toBe(true);
    expect(new Prisma.Decimal(invLine!.credit).equals(200000)).toBe(true);
  });

  it("AP-19: Allocates Credit Note to reduce Invoice outstanding liability", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Uganda Clays Ltd",
      phone: "+256752111333"
    });

    // 1. Create Invoice of 1,000,000
    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `UCL-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          description: "Roofing Tiles",
          quantityInvoiced: 100,
          unitPriceInvoiced: "10000.00"
        }
      ]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    // 2. Create Credit Note of 200,000
    const crn = await SupplierCreditNoteDAO.createCreditNote(ctx, {
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      creditNoteDate: new Date("2026-02-12"),
      reason: "Broken tiles rebate",
      lines: [
        {
          description: "Broken tiles rebate",
          quantityReturned: 20,
          unitPrice: "10000.00"
        }
      ]
    });
    await SupplierCreditNoteDAO.approveCreditNote(checkerCtx, crn.id);

    // 3. Allocate Credit Note to Invoice
    await SupplierCreditNoteDAO.allocateCreditNote(ctx, crn.id, invoice.id, 200000);

    const refreshedInvoice = await db.supplierInvoice.findUnique({
      where: { id: invoice.id }
    });

    expect(new Prisma.Decimal(refreshedInvoice!.amountPaid).equals(200000)).toBe(true);
    expect(new Prisma.Decimal(refreshedInvoice!.amountOutstanding).equals(800000)).toBe(true);
    expect(refreshedInvoice!.status).toBe(SupplierInvoiceStatus.PARTIALLY_PAID);
  });

  // ==========================================================================
  // AP-20 to AP-26: Supplier Payments, Settlement Engine & Discounts
  // ==========================================================================
  it("AP-20: Disburses Supplier Payment and deducts Treasury Account balance", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Kampala Stationary Hub",
      phone: "+256752111444"
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `KSH-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          description: "Printing Paper 50 Reams",
          quantityInvoiced: 50,
          unitPriceInvoiced: "10000.00"
        }
      ]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    const initialTreasury = await db.treasuryAccount.findUnique({
      where: { id: treasuryAccountId }
    });

    const payment = await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "500000.00",
      allocations: [
        {
          invoiceId: invoice.id,
          amountToAllocate: "500000.00"
        }
      ]
    });

    expect(payment.status).toBe(SupplierPaymentStatus.COMPLETED);

    const updatedTreasury = await db.treasuryAccount.findUnique({
      where: { id: treasuryAccountId }
    });

    expect(new Prisma.Decimal(initialTreasury!.currentBalance).sub(updatedTreasury!.currentBalance).equals(500000)).toBe(true);
  });

  it("AP-21: Creates immutable CashbookMovement (CBM Outflow) for supplier settlement", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Prime Uniforms Tailors",
      phone: "+256752111555"
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `PUT-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          description: "Student Blazers",
          quantityInvoiced: 10,
          unitPriceInvoiced: "50000.00"
        }
      ]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    const payment = await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "500000.00"
    });

    const cbm = await db.cashbookMovement.findFirst({
      where: { supplierPaymentId: payment.id }
    });

    expect(cbm).toBeDefined();
    expect(cbm!.direction).toBe("OUTFLOW");
    expect(new Prisma.Decimal(cbm!.amount).equals(500000)).toBe(true);
  });

  it("AP-22: Deducts URA WHT 6% and posts to #2140 WHT Payable", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Apex Logistics Ltd",
      phone: "+256752111666"
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `APEX-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          description: "Transport Freight",
          quantityInvoiced: 1,
          unitPriceInvoiced: "2000000.00"
        }
      ]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    // Disburse 2,000,000 gross with 120,000 WHT deduction (net 1,880,000)
    const payment = await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "2000000.00",
      whtDeductedAmount: "120000.00"
    });

    const journal = await db.journalEntry.findUnique({
      where: { id: payment.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });

    const apLine = journal!.lines.find((l) => l.account.code === "2110");
    const bankLine = journal!.lines.find((l) => l.account.code === "1120");
    const whtLine = journal!.lines.find((l) => l.account.code === "2140");

    expect(new Prisma.Decimal(apLine!.debit).equals(2000000)).toBe(true);
    expect(new Prisma.Decimal(bankLine!.credit).equals(1880000)).toBe(true);
    expect(new Prisma.Decimal(whtLine!.credit).equals(120000)).toBe(true);
  });

  it("AP-23: Applies early settlement discount reducing Stores Inventory cost (#1310)", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Mega Hardware Stores",
      phone: "+256752111777"
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `MHS-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      supplyCategory: SupplyCategory.GOODS,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          description: "Store Hardware Supplies",
          quantityInvoiced: 10,
          unitPriceInvoiced: "100000.00"
        }
      ]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    // Settlement with 50,000 prompt discount
    const payment = await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "1000000.00",
      discountTakenAmount: "50000.00"
    });

    const journal = await db.journalEntry.findUnique({
      where: { id: payment.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });

    const apLine = journal!.lines.find((l) => l.account.code === "2110");
    const bankLine = journal!.lines.find((l) => l.account.code === "1120");
    const invDiscountLine = journal!.lines.find((l) => l.account.code === "1310");

    expect(new Prisma.Decimal(apLine!.debit).equals(1000000)).toBe(true);
    expect(new Prisma.Decimal(bankLine!.credit).equals(950000)).toBe(true);
    expect(new Prisma.Decimal(invDiscountLine!.credit).equals(50000)).toBe(true);
  });

  it("AP-24: Applies early settlement discount for services to Discount Income (#4920)", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Security Group Africa",
      phone: "+256752111888"
    });

    const expCat = await db.expenseCategory.create({
      data: {
        branchId,
        code: `SEC-${Date.now().toString().slice(-4)}`,
        name: "Security Guard Services",
        glAccountId: (await GLAccountDAO.getAccountByCode(ctx, "6200"))!.id
      }
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `SGA-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      supplyCategory: SupplyCategory.STANDARD_SERVICES,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [
        {
          expenseCategoryId: expCat.id,
          description: "Monthly Campus Security Guards",
          quantityInvoiced: 1,
          unitPriceInvoiced: "1000000.00"
        }
      ]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    const payment = await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "1000000.00",
      discountTakenAmount: "30000.00"
    });

    const journal = await db.journalEntry.findUnique({
      where: { id: payment.journalEntryId! },
      include: { lines: { include: { account: true } } }
    });

    const discountLine = journal!.lines.find((l) => l.account.code === "4920" || l.account.code === "6200");
    expect(discountLine).toBeDefined();
    expect(new Prisma.Decimal(discountLine!.credit).equals(30000)).toBe(true);
  });

  it("AP-25: Automatically allocates payments in FIFO order across multiple open invoices", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Kampala Meat Suppliers",
      phone: "+256752111999"
    });

    // Invoice 1: 300,000 (Due Feb 1)
    const inv1 = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `KMS-INV-1-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-01-10"),
      dueDate: new Date("2026-02-01"),
      lines: [{ description: "Beef Rations", quantityInvoiced: 10, unitPriceInvoiced: "30000.00" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, inv1.id);

    // Invoice 2: 500,000 (Due Feb 15)
    const inv2 = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `KMS-INV-2-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-01-20"),
      dueDate: new Date("2026-02-15"),
      lines: [{ description: "Chicken Rations", quantityInvoiced: 10, unitPriceInvoiced: "50000.00" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, inv2.id);

    // Disburse 600,000 (FIFO: clears Inv 1 fully (300k), and Inv 2 partially (300k))
    await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-10"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "600000.00"
    });

    const refreshed1 = await db.supplierInvoice.findUnique({ where: { id: inv1.id } });
    const refreshed2 = await db.supplierInvoice.findUnique({ where: { id: inv2.id } });

    expect(refreshed1!.status).toBe(SupplierInvoiceStatus.PAID);
    expect(new Prisma.Decimal(refreshed1!.amountOutstanding).isZero()).toBe(true);

    expect(refreshed2!.status).toBe(SupplierInvoiceStatus.PARTIALLY_PAID);
    expect(new Prisma.Decimal(refreshed2!.amountPaid).equals(300000)).toBe(true);
    expect(new Prisma.Decimal(refreshed2!.amountOutstanding).equals(200000)).toBe(true);
  });

  it("AP-26: Reverses payment, re-credits Treasury, and reinstates outstanding invoices", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Victoria Chemicals",
      phone: "+256752222111"
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `VC-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [{ description: "Science Lab Reagents", quantityInvoiced: 5, unitPriceInvoiced: "100000.00" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    const payment = await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "500000.00"
    });

    // Reverse Payment
    const reversed = await SupplierPaymentDAO.reversePayment(ctx, payment.id, "Payment cancelled by Bursar instruction");
    expect(reversed.status).toBe(SupplierPaymentStatus.REVERSED);

    const refreshedInvoice = await db.supplierInvoice.findUnique({ where: { id: invoice.id } });
    expect(refreshedInvoice!.status).toBe(SupplierInvoiceStatus.APPROVED);
    expect(new Prisma.Decimal(refreshedInvoice!.amountOutstanding).equals(500000)).toBe(true);
  });

  // ==========================================================================
  // AP-27 to AP-28: Reports & Subledger-to-GL Zero-Drift Telemetry
  // ==========================================================================
  it("AP-27: Computes Aged Payables breakdown (0-30, 31-60, 61-90, 90+ days)", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Jinja Food Distributors",
      phone: "+256752222222"
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `JFD-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-01-01"),
      dueDate: new Date("2026-01-15"),
      lines: [{ description: "Rice 50kg Bags", quantityInvoiced: 5, unitPriceInvoiced: "100000.00" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    const report = await APReportsDAO.getAgedPayablesReport(ctx, new Date("2026-03-01"));
    expect(report.summary.grandTotal.gt(0)).toBe(true);
  });

  it("AP-28: Asserts Subledger-to-GL Zero-Drift Telemetry for AP #2110 & GRNI #2120", async () => {
    const reconciliation = await APReportsDAO.reconcileAPSubledger(ctx);

    expect(reconciliation.apControl.varianceAP.isZero()).toBe(true);
    expect(reconciliation.grniControl.varianceGRNI.isZero()).toBe(true);
    expect(reconciliation.isReconciled).toBe(true);
  });
});
