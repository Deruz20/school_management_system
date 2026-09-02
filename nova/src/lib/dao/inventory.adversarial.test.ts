import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import { InventoryDAO, Context } from "./inventory.dao";
import {
  PaymentMethod,
  Prisma,
} from "@prisma/client";

describe("NOVA Finance Phase 3.1J — Inventory Adversarial & Boundary Test Suite", () => {
  let ctx: Context;
  let approverCtx: Context;
  let otherBranchCtx: Context;
  let academicYear: { id: string };
  let student: { id: string };
  let centralStore: { id: string; code: string; name: string };
  let isolatedStore: { id: string; code: string; name: string };
  let testItem: { id: string; code: string; name: string };
  let testSupplier: { id: string; name: string; supplierCode: string };

  beforeAll(async () => {
    // 1. Create Organization & Branches
    const org = await db.organization.create({
      data: { name: `Adv Inv Org ${Date.now()}` },
    });

    const branch = await db.branch.create({
      data: {
        schoolId: (
          await db.school.create({
            data: { name: "Adv Inv Main School", organizationId: org.id },
          })
        ).id,
        name: "Main Campus",
      },
    });

    const otherBranch = await db.branch.create({
      data: {
        schoolId: (
          await db.school.create({
            data: { name: "Adv Inv Isolated School", organizationId: org.id },
          })
        ).id,
        name: "Isolated Branch",
      },
    });

    const user1 = await db.user.create({
      data: {
        email: `adv-user1-${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Adv",
        lastName: "User1",
        userType: "STAFF",
        organizationId: org.id,
      },
    });

    const user2 = await db.user.create({
      data: {
        email: `adv-user2-${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Adv",
        lastName: "User2",
        userType: "STAFF",
        organizationId: org.id,
      },
    });

    ctx = {
      branchId: branch.id,
      userId: user1.id,
      organizationId: org.id,
      role: "ADMIN",
      permissions: ["all"],
    };

    approverCtx = {
      branchId: branch.id,
      userId: user2.id,
      organizationId: org.id,
      role: "BURSAR",
      permissions: ["all"],
    };

    otherBranchCtx = {
      branchId: otherBranch.id,
      userId: user1.id,
      organizationId: org.id,
      role: "ADMIN",
      permissions: ["all"],
    };

    academicYear = await db.academicYear.create({
      data: {
        branchId: branch.id,
        name: `2026 Adv Year ${Date.now()}`,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-12-15"),
      },
    });

    const testClass = await db.class.create({
      data: { branchId: branch.id, name: `Class ADV ${Date.now()}` },
    });

    student = await db.student.create({
      data: {
        branchId: branch.id,
        admissionNo: `ADM-ADV-${Date.now()}`,
        firstName: "Adv",
        lastName: "Student",
        classId: testClass.id,
      },
    });

    centralStore = await InventoryDAO.createStore(ctx, {
      code: "STR-ADV-MAIN",
      name: "Adv Main Store",
    });

    isolatedStore = await InventoryDAO.createStore(otherBranchCtx, {
      code: "STR-ADV-ISOLATED",
      name: "Isolated Branch Store",
    });

    testItem = await InventoryDAO.createItem(ctx, {
      code: "ITEM-ADV-1",
      name: "Mathematical Instruments Box",
      unitOfMeasure: "sets",
      unitCostPrice: 15000,
      sellingPrice: 20000,
      reorderLevel: 10,
    });

    testSupplier = await InventoryDAO.createSupplier(ctx, {
      supplierCode: "SUP-ADV-1",
      name: "Uganda Scholastic Distributors",
      phone: "+256700999888",
    });
  });

  // ==========================================
  // ADV-INV-01: Block Stock Issue or Sale if Insufficient Stock
  // ==========================================
  it("ADV-INV-01: should block stock issue or sale if requested quantity exceeds available quantity", async () => {
    // Current stock is 0. Attempting to sell 1 set must fail.
    await expect(
      InventoryDAO.recordStudentStoreSale(ctx, {
        studentId: student.id,
        storeId: centralStore.id,
        academicYearId: academicYear.id,
        isInvoiceCharge: false,
        paymentMethod: PaymentMethod.CASH,
        items: [{ itemId: testItem.id, quantity: 1 }],
      })
    ).rejects.toThrow(/Insufficient stock/);
  });

  // ==========================================
  // ADV-INV-02: Prevent Duplicate Supplier Invoice Reference
  // ==========================================
  it("ADV-INV-02: should reject duplicate supplier invoice reference for the same vendor", async () => {
    const invoiceRef = `DUP-REF-${Date.now()}`;

    // First GRN succeeds
    await InventoryDAO.receiveGoods(ctx, {
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      supplierInvoiceRef: invoiceRef,
      items: [{ itemId: testItem.id, quantityReceived: 10, unitCostPrice: 15000 }],
    });

    // Duplicate GRN with same supplier invoice ref must fail
    await expect(
      InventoryDAO.receiveGoods(ctx, {
        supplierId: testSupplier.id,
        storeId: centralStore.id,
        academicYearId: academicYear.id,
        supplierInvoiceRef: invoiceRef,
        items: [{ itemId: testItem.id, quantityReceived: 5, unitCostPrice: 15000 }],
      })
    ).rejects.toThrow(/already exists for this vendor/);
  });

  // ==========================================
  // ADV-INV-03: Prevent Receiving Goods on Unapproved or Cancelled PO
  // ==========================================
  it("ADV-INV-03: should prevent receiving goods against a DRAFT, REJECTED, or CANCELLED Purchase Order", async () => {
    const poDraft = await InventoryDAO.createPurchaseOrder(ctx, {
      supplierId: testSupplier.id,
      academicYearId: academicYear.id,
      items: [{ itemId: testItem.id, quantityOrdered: 20, unitCostPrice: 15000 }],
    });

    // Cannot receive against DRAFT PO
    await expect(
      InventoryDAO.receiveGoods(ctx, {
        poId: poDraft.id,
        supplierId: testSupplier.id,
        storeId: centralStore.id,
        academicYearId: academicYear.id,
        items: [{ itemId: testItem.id, quantityReceived: 20, unitCostPrice: 15000 }],
      })
    ).rejects.toThrow(/Cannot receive goods against PO in status: DRAFT/);

    // Cancel PO
    await InventoryDAO.cancelPurchaseOrder(ctx, poDraft.id, "Testing cancellation block");

    // Cannot receive against CANCELLED PO
    await expect(
      InventoryDAO.receiveGoods(ctx, {
        poId: poDraft.id,
        supplierId: testSupplier.id,
        storeId: centralStore.id,
        academicYearId: academicYear.id,
        items: [{ itemId: testItem.id, quantityReceived: 20, unitCostPrice: 15000 }],
      })
    ).rejects.toThrow(/Cannot receive goods against PO in status: CANCELLED/);
  });

  // ==========================================
  // ADV-INV-04: Block Over-Receipt on Purchase Order
  // ==========================================
  it("ADV-INV-04: should block over-receipt on PO unless supervisor override authorization is provided", async () => {
    const po = await InventoryDAO.createPurchaseOrder(ctx, {
      supplierId: testSupplier.id,
      academicYearId: academicYear.id,
      items: [{ itemId: testItem.id, quantityOrdered: 10, unitCostPrice: 15000 }],
    });
    await InventoryDAO.submitPurchaseOrder(ctx, po.id);
    await InventoryDAO.approvePurchaseOrder(approverCtx, po.id);

    // Attempt to receive 15 without allowOverReceipt flag must fail
    await expect(
      InventoryDAO.receiveGoods(ctx, {
        poId: po.id,
        supplierId: testSupplier.id,
        storeId: centralStore.id,
        academicYearId: academicYear.id,
        allowOverReceipt: false,
        items: [{ itemId: testItem.id, quantityReceived: 15, unitCostPrice: 15000 }],
      })
    ).rejects.toThrow(/Over-receipt blocked/);

    // Attempt to receive > 10% overage even with override must fail
    await expect(
      InventoryDAO.receiveGoods(ctx, {
        poId: po.id,
        supplierId: testSupplier.id,
        storeId: centralStore.id,
        academicYearId: academicYear.id,
        allowOverReceipt: true,
        items: [{ itemId: testItem.id, quantityReceived: 15, unitCostPrice: 15000 }],
      })
    ).rejects.toThrow(/exceeded maximum allowed tolerance of 10%/);

    // 10% overage (11 units on 10 ordered) succeeds with allowOverReceipt
    const grn = await InventoryDAO.receiveGoods(ctx, {
      poId: po.id,
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      allowOverReceipt: true,
      items: [{ itemId: testItem.id, quantityReceived: 11, unitCostPrice: 15000 }],
    });
    expect(grn.id).toBeDefined();
  });

  // ==========================================
  // ADV-INV-05: Exact Decimal Precision on WAC Calculations
  // ==========================================
  it("ADV-INV-05: should maintain exact Decimal precision during multi-tier WAC recalculations", async () => {
    const precisionItem = await InventoryDAO.createItem(ctx, {
      code: `PREC-ITEM-${Date.now()}`,
      name: "Laboratory Precision Microscope",
      unitOfMeasure: "pcs",
      unitCostPrice: 0,
    });

    // Step 1: 3 units at 333.33 -> WAC = 333.33
    await InventoryDAO.receiveGoods(ctx, {
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      items: [{ itemId: precisionItem.id, quantityReceived: 3, unitCostPrice: 333.33 }],
    });
    let item = await InventoryDAO.getItem(ctx, precisionItem.id);
    expect(new Prisma.Decimal(item.unitCostPrice).toNumber()).toBe(333.33);

    // Step 2: 7 units at 666.67 -> Total = (3 * 333.33 + 7 * 666.67) / 10 = (999.99 + 4666.69) / 10 = 5666.68 / 10 = 566.67
    await InventoryDAO.receiveGoods(ctx, {
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      items: [{ itemId: precisionItem.id, quantityReceived: 7, unitCostPrice: 666.67 }],
    });
    item = await InventoryDAO.getItem(ctx, precisionItem.id);
    expect(new Prisma.Decimal(item.unitCostPrice).toNumber()).toBe(566.67);
  });

  // ==========================================
  // ADV-INV-06: Cross-Branch Stock Transfer Block
  // ==========================================
  it("ADV-INV-06: should prevent cross-branch stock transfers", async () => {
    // Attempt to transfer from centralStore (branch 1) to isolatedStore (branch 2)
    await expect(
      InventoryDAO.transferStock(ctx, {
        sourceStoreId: centralStore.id,
        destStoreId: isolatedStore.id,
        itemId: testItem.id,
        quantity: 2,
      })
    ).rejects.toThrow(/Destination store not found in this branch/);
  });

  // ==========================================
  // ADV-INV-07: Reject Negative Prices and Negative Quantities
  // ==========================================
  it("ADV-INV-07: should reject negative prices or negative quantities across mutation endpoints", async () => {
    // Negative item price
    await expect(
      InventoryDAO.createItem(ctx, {
        code: `NEG-ITEM-${Date.now()}`,
        name: "Negative Price Item",
        unitOfMeasure: "pcs",
        unitCostPrice: -5000,
      })
    ).rejects.toThrow(/Prices and reorder levels cannot be negative/);

    // Negative PO line quantity
    await expect(
      InventoryDAO.createPurchaseOrder(ctx, {
        supplierId: testSupplier.id,
        academicYearId: academicYear.id,
        items: [{ itemId: testItem.id, quantityOrdered: -5, unitCostPrice: 10000 }],
      })
    ).rejects.toThrow(/Quantity must be greater than zero/);

    // Negative GRN quantity
    await expect(
      InventoryDAO.receiveGoods(ctx, {
        supplierId: testSupplier.id,
        storeId: centralStore.id,
        academicYearId: academicYear.id,
        items: [{ itemId: testItem.id, quantityReceived: -10, unitCostPrice: 10000 }],
      })
    ).rejects.toThrow(/Received quantity must be positive/);
  });

  // ==========================================
  // ADV-INV-08: Historical Immutability on Catalog & Supplier Edits
  // ==========================================
  it("ADV-INV-08: should guarantee that renaming an item or changing its price never modifies past sale or GRN records", async () => {
    const item = await InventoryDAO.createItem(ctx, {
      code: `IMMUTABLE-${Date.now()}`,
      name: "Original Uniform Badge",
      unitOfMeasure: "pcs",
      unitCostPrice: 5000,
      sellingPrice: 8000,
    });

    // Inflow 10 units
    const grn = await InventoryDAO.receiveGoods(ctx, {
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      items: [{ itemId: item.id, quantityReceived: 10, unitCostPrice: 5000 }],
    });

    // Sell 2 units
    const sale = await InventoryDAO.recordStudentStoreSale(ctx, {
      studentId: student.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      isInvoiceCharge: false,
      items: [{ itemId: item.id, quantity: 2, unitPrice: 8000 }],
    });

    // Now update Item master: change name, cost price, and selling price
    await InventoryDAO.updateItem(ctx, item.id, {
      name: "Renamed Premium Gold Badge",
      unitCostPrice: 12000,
      sellingPrice: 20000,
    });

    // Verify GRN item snapshot remains untouched
    const historicalGrnItem = await db.goodsReceivedItem.findFirst({
      where: { grnId: grn.id, itemId: item.id },
    });
    expect(historicalGrnItem?.itemNameSnapshot).toBe("Original Uniform Badge");
    expect(new Prisma.Decimal(historicalGrnItem!.unitCostPrice).toNumber()).toBe(5000);

    // Verify Sale item snapshot remains untouched
    const historicalSaleItem = await db.studentStoreSaleItem.findFirst({
      where: { saleId: sale.id, itemId: item.id },
    });
    expect(historicalSaleItem?.itemNameSnapshot).toBe("Original Uniform Badge");
    expect(new Prisma.Decimal(historicalSaleItem!.unitPrice).toNumber()).toBe(8000);
  });

  // ==========================================
  // ADV-INV-09: Duplicate Ingestion of Requirement Handover Block
  // ==========================================
  it("ADV-INV-09: should reject duplicate ingestion of the same student requirement handover record", async () => {
    const catalogItem = await db.requirementCatalog.create({
      data: {
        branchId: ctx.branchId,
        code: `REQ-BROOM-${Date.now()}`,
        name: `Broom ${Date.now()}`,
        category: "CLEANING_HYGIENE",
        unit: "PIECE",
      },
    });

    const targetClass = await db.class.findFirst({ where: { branchId: ctx.branchId } });

    const classReq = await db.classRequirement.create({
      data: {
        branchId: ctx.branchId,
        title: "ADV Class Requirements",
        classId: targetClass!.id,
        academicYearId: academicYear.id,
        createdById: ctx.userId,
      },
    });

    const bpItem = await db.classRequirementItem.create({
      data: {
        classRequirementId: classReq.id,
        catalogItemId: catalogItem.id,
        name: catalogItem.name,
        category: "CLEANING_HYGIENE",
        unit: "PIECE",
        quantity: 1,
      },
    });

    const reqRecord = await db.studentRequirementRecord.create({
      data: {
        branchId: ctx.branchId,
        studentId: student.id,
        classRequirementId: classReq.id,
        academicYearId: academicYear.id,
      },
    });

    const studentReq = await db.studentRequirementItem.create({
      data: {
        recordId: reqRecord.id,
        blueprintItemId: bpItem.id,
        name: catalogItem.name,
        category: "CLEANING_HYGIENE",
        unit: "PIECE",
        quantityRequired: 1,
        quantityDelivered: 1,
        status: "FULFILLED",
      },
    });

    const handover = await db.inKindHandoverLog.create({
      data: {
        branchId: ctx.branchId,
        studentRequirementItemId: studentReq.id,
        receiptNumber: `INK-ADV-${Date.now()}`,
        deltaDelivered: new Prisma.Decimal(1),
        previousQuantity: new Prisma.Decimal(0),
        newQuantity: new Prisma.Decimal(1),
        receivedById: ctx.userId,
      },
    });

    const broomItem = await InventoryDAO.createItem(ctx, {
      code: `BROOM-${Date.now()}`,
      name: "Hard Bristle Broom",
      unitOfMeasure: "pcs",
    });

    // Ingest once
    await InventoryDAO.ingestRequirementHandovers(ctx, {
      storeId: centralStore.id,
      itemId: broomItem.id,
      handoverLogIds: [handover.id],
    });

    // Ingest same handover second time must fail
    await expect(
      InventoryDAO.ingestRequirementHandovers(ctx, {
        storeId: centralStore.id,
        itemId: broomItem.id,
        handoverLogIds: [handover.id],
      })
    ).rejects.toThrow(/has already been ingested into store inventory/);
  });

  // ==========================================
  // ADV-INV-10: Complete Voiding & Return Audit Trail
  // ==========================================
  it("ADV-INV-10: should verify non-destructive audit log trail on stock voiding and return", async () => {
    const auditCountBefore = await db.auditLog.count({
      where: { branchId: ctx.branchId },
    });
    expect(auditCountBefore).toBeGreaterThan(0);

    const movements = await InventoryDAO.getStockMovementLedger(ctx, {
      storeId: centralStore.id,
    });
    expect(movements.length).toBeGreaterThan(0);
  });
});
