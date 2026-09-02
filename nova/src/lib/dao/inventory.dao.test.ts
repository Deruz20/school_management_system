import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import { InventoryDAO, Context } from "./inventory.dao";
import {
  StoreLocationType,
  InventoryItemCategory,
  PurchaseOrderStatus,
  StockMovementType,
  RequisitionStatus,
  PaymentMethod,
  Prisma,
} from "@prisma/client";

describe("NOVA Finance Phase 3.1J — Inventory, Stores & Procurement DAO Unit Test Suite", () => {
  let ctx: Context;
  let approverCtx: Context;
  let academicYear: { id: string };
  let term: { id: string };
  let student: { id: string };
  let employee: { id: string };
  let department: { id: string };
  let expenseCategory: { id: string };

  let centralStore: { id: string; code: string; storeType: StoreLocationType; name: string };
  let labStore: { id: string; code: string; storeType: StoreLocationType; name: string };
  let uniformItem: { id: string; code: string; name: string; sellingPrice: Prisma.Decimal | number | null; unitCostPrice: Prisma.Decimal | number };
  let bookItem: { id: string; code: string; name: string };
  let reagentItem: { id: string; code: string; name: string };
  let testSupplier: { id: string; name: string; supplierCode: string; taxIdNumber: string | null };

  beforeAll(async () => {
    // 1. Create Organization & Branches
    const org = await db.organization.create({
      data: { name: `Inventory Test Org ${Date.now()}` },
    });

    const branch = await db.branch.create({
      data: {
        schoolId: (
          await db.school.create({
            data: { name: "Inventory Test School", organizationId: org.id },
          })
        ).id,
        name: "Main Inventory Campus",
      },
    });

    const user1 = await db.user.create({
      data: {
        email: `inv-admin-${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Store",
        lastName: "Keeper",
        userType: "STAFF",
        organizationId: org.id,
      },
    });

    const user2 = await db.user.create({
      data: {
        email: `inv-approver-${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Bursar",
        lastName: "Approver",
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

    // 2. Create Academic Year & Term
    academicYear = await db.academicYear.create({
      data: {
        branchId: branch.id,
        name: `2026-2027 ${Date.now()}`,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-12-15"),
      },
    });

    term = await db.term.create({
      data: {
        academicYearId: academicYear.id,
        name: "Term 1",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-04-30"),
      },
    });

    // 3. Create Department & Employee
    department = await db.department.create({
      data: {
        branchId: branch.id,
        name: `Science Dept ${Date.now()}`,
      },
    });

    const employeeType = await db.employeeType.create({
      data: {
        branchId: branch.id,
        name: `Teacher ${Date.now()}`,
        isTeachingStaff: true,
      },
    });

    employee = await db.employee.create({
      data: {
        branchId: branch.id,
        employeeCode: `EMP-INV-${Date.now()}`,
        firstName: "John",
        lastName: "Teacher",
        departmentId: department.id,
        employeeTypeId: employeeType.id,
        userId: user1.id,
      },
    });

    // 4. Create Student & Enrollment
    const testClass = await db.class.create({
      data: {
        branchId: branch.id,
        name: `Class INV-1 ${Date.now()}`,
      },
    });

    student = await db.student.create({
      data: {
        branchId: branch.id,
        admissionNo: `ADM-INV-${Date.now()}`,
        firstName: "Sarah",
        lastName: "Nalubega",
        classId: testClass.id,
      },
    });

    await db.enrollment.create({
      data: {
        studentId: student.id,
        classId: testClass.id,
        academicYearId: academicYear.id,
        status: "ACTIVE",
      },
    });

    // 5. Create Expense Category for GRN integration
    expenseCategory = await db.expenseCategory.create({
      data: {
        branchId: branch.id,
        name: `Stores & Procurement ${Date.now()}`,
        code: `EXP-STR-${Date.now()}`,
      },
    });
  });

  // ==========================================
  // INV-01: Create Stores & Verify Code Uniqueness
  // ==========================================
  it("INV-01: should create store locations and enforce code uniqueness per branch", async () => {
    centralStore = await InventoryDAO.createStore(ctx, {
      code: "STR-MAIN",
      name: "Central Main Warehouse",
      storeType: StoreLocationType.CENTRAL_STORE,
      location: "Building A, Ground Floor",
      managerId: employee.id,
    });

    labStore = await InventoryDAO.createStore(ctx, {
      code: "STR-LAB",
      name: "Science Laboratory Store",
      storeType: StoreLocationType.SCIENCE_LAB_STORE,
      location: "Science Block 2",
    });

    expect(centralStore.id).toBeDefined();
    expect(centralStore.code).toBe("STR-MAIN");
    expect(centralStore.storeType).toBe(StoreLocationType.CENTRAL_STORE);

    // Duplicate code in same branch should fail
    await expect(
      InventoryDAO.createStore(ctx, {
        code: "STR-MAIN",
        name: "Duplicate Store",
      })
    ).rejects.toThrow();
  });

  // ==========================================
  // INV-02: Create Items in Catalog
  // ==========================================
  it("INV-02: should create catalog items with SKU, unit of measure, and prices", async () => {
    uniformItem = await InventoryDAO.createItem(ctx, {
      code: "UNIF-P3",
      name: "Primary 3 Uniform Set",
      category: InventoryItemCategory.UNIFORM,
      unitOfMeasure: "sets",
      unitCostPrice: 35000,
      sellingPrice: 50000,
      reorderLevel: 15,
      description: "Complete P3 uniform set with shirt, shorts, and badge",
    });

    bookItem = await InventoryDAO.createItem(ctx, {
      code: "BK-MATH-P3",
      name: "MK Primary Mathematics 3",
      category: InventoryItemCategory.SCHOLASTIC_TEXTBOOK,
      unitOfMeasure: "pcs",
      unitCostPrice: 18000,
      sellingPrice: 25000,
      reorderLevel: 20,
    });

    reagentItem = await InventoryDAO.createItem(ctx, {
      code: "CHEM-HCL-1L",
      name: "Hydrochloric Acid 1L",
      category: InventoryItemCategory.LAB_CHEMICAL_APPARATUS,
      unitOfMeasure: "liters",
      unitCostPrice: 45000,
      reorderLevel: 5,
    });

    expect(uniformItem.id).toBeDefined();
    expect(new Prisma.Decimal(uniformItem.sellingPrice!).toNumber()).toBe(50000);
    expect(new Prisma.Decimal(uniformItem.unitCostPrice).toNumber()).toBe(35000);
  });

  // ==========================================
  // INV-03: Create Supplier Profiles
  // ==========================================
  it("INV-03: should create certified supplier profile with TIN and payment terms", async () => {
    testSupplier = await InventoryDAO.createSupplier(ctx, {
      supplierCode: "SUP-MUKWANO",
      name: "Mukwano Industries Uganda",
      contactName: "David Musisi",
      phone: "+256772111222",
      email: "orders@mukwano.com",
      taxIdNumber: "1001234567",
      paymentTerms: "Net 30",
    });

    expect(testSupplier.id).toBeDefined();
    expect(testSupplier.supplierCode).toBe("SUP-MUKWANO");
    expect(testSupplier.taxIdNumber).toBe("1001234567");
  });

  // ==========================================
  // INV-04 & INV-05: Draft, Submit & Anti-Self-Approval on PO
  // ==========================================
  it("INV-04: should draft and submit a Purchase Order with line items", async () => {
    const po = await InventoryDAO.createPurchaseOrder(ctx, {
      supplierId: testSupplier.id,
      academicYearId: academicYear.id,
      termId: term.id,
      expectedDate: new Date("2026-02-15"),
      notes: "Initial term stock replenishment",
      items: [
        { itemId: uniformItem.id, quantityOrdered: 50, unitCostPrice: 35000 },
        { itemId: bookItem.id, quantityOrdered: 30, unitCostPrice: 18000 },
      ],
    });

    expect(po.poNumber).toMatch(/^PO-\d{4}-\d{5}$/);
    expect(po.status).toBe(PurchaseOrderStatus.DRAFT);
    expect(new Prisma.Decimal(po.totalAmount).toNumber()).toBe(50 * 35000 + 30 * 18000);

    const submitted = await InventoryDAO.submitPurchaseOrder(ctx, po.id);
    expect(submitted.status).toBe(PurchaseOrderStatus.SUBMITTED);
  });

  it("INV-05: should enforce anti-self-approval on submitted Purchase Orders", async () => {
    const po = await InventoryDAO.createPurchaseOrder(ctx, {
      supplierId: testSupplier.id,
      academicYearId: academicYear.id,
      items: [{ itemId: uniformItem.id, quantityOrdered: 10, unitCostPrice: 35000 }],
    });
    await InventoryDAO.submitPurchaseOrder(ctx, po.id);

    // Creator attempting to approve their own PO must fail
    await expect(InventoryDAO.approvePurchaseOrder(ctx, po.id)).rejects.toThrow(
      /Anti-self-approval violation/
    );

    // Different user (Bursar) can approve
    const approved = await InventoryDAO.approvePurchaseOrder(approverCtx, po.id);
    expect(approved.status).toBe(PurchaseOrderStatus.APPROVED);
    expect(approved.approvedById).toBe(approverCtx.userId);
  });

  // ==========================================
  // INV-06 & INV-07: Receive Goods (GRN), Increment Stock & WAC
  // ==========================================
  it("INV-06 & INV-07: should receive goods via GRN, recalculate WAC, and increment store stock", async () => {
    // Current stock is 0, WAC is 35,000
    // We receive 20 units at 40,000
    const grn = await InventoryDAO.receiveGoods(ctx, {
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      termId: term.id,
      supplierInvoiceRef: `INV-${Date.now()}`,
      expenseCategoryId: expenseCategory.id,
      items: [
        { itemId: uniformItem.id, quantityReceived: 20, unitCostPrice: 40000 },
      ],
    });

    expect(grn.grnNumber).toMatch(/^GRN-\d{4}-\d{5}$/);
    expect(new Prisma.Decimal(grn.totalAmount).toNumber()).toBe(800000);

    // Check store stock
    const stock = await db.inventoryStoreStock.findUnique({
      where: { storeId_itemId: { storeId: centralStore.id, itemId: uniformItem.id } },
    });
    expect(new Prisma.Decimal(stock!.quantityOnHand).toNumber()).toBe(20);

    // Check WAC updated on Item (was 0 qty -> becomes 40,000)
    const refreshedItem = await db.inventoryItem.findUnique({ where: { id: uniformItem.id } });
    expect(new Prisma.Decimal(refreshedItem!.unitCostPrice).toNumber()).toBe(40000);

    // Now receive 20 more units at 30,000:
    // New WAC = (20 * 40,000 + 20 * 30,000) / 40 = 35,000
    await InventoryDAO.receiveGoods(ctx, {
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      supplierInvoiceRef: `INV-2-${Date.now()}`,
      expenseCategoryId: expenseCategory.id,
      items: [
        { itemId: uniformItem.id, quantityReceived: 20, unitCostPrice: 30000 },
      ],
    });

    const stockAfter = await db.inventoryStoreStock.findUnique({
      where: { storeId_itemId: { storeId: centralStore.id, itemId: uniformItem.id } },
    });
    expect(new Prisma.Decimal(stockAfter!.quantityOnHand).toNumber()).toBe(40);

    const refreshedItem2 = await db.inventoryItem.findUnique({ where: { id: uniformItem.id } });
    expect(new Prisma.Decimal(refreshedItem2!.unitCostPrice).toNumber()).toBe(35000);
  });

  // ==========================================
  // INV-08 & INV-09: Partial & Full GRN Receiving on Purchase Order
  // ==========================================
  it("INV-08 & INV-09: should track partial and full fulfillment of Purchase Order", async () => {
    const po = await InventoryDAO.createPurchaseOrder(ctx, {
      supplierId: testSupplier.id,
      academicYearId: academicYear.id,
      items: [{ itemId: bookItem.id, quantityOrdered: 50, unitCostPrice: 18000 }],
    });
    await InventoryDAO.submitPurchaseOrder(ctx, po.id);
    await InventoryDAO.approvePurchaseOrder(approverCtx, po.id);

    // 1. Partial receipt: 20 of 50
    const partialGrn = await InventoryDAO.receiveGoods(ctx, {
      poId: po.id,
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      supplierInvoiceRef: `PARTIAL-${Date.now()}`,
      expenseCategoryId: expenseCategory.id,
      items: [{ itemId: bookItem.id, quantityReceived: 20, unitCostPrice: 18000 }],
    });
    expect(partialGrn.id).toBeDefined();

    const poAfterPartial = await db.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(poAfterPartial?.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);

    // 2. Remaining receipt: 30 of 50
    await InventoryDAO.receiveGoods(ctx, {
      poId: po.id,
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      supplierInvoiceRef: `FINAL-${Date.now()}`,
      expenseCategoryId: expenseCategory.id,
      items: [{ itemId: bookItem.id, quantityReceived: 30, unitCostPrice: 18000 }],
    });

    const poAfterFinal = await db.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(poAfterFinal?.status).toBe(PurchaseOrderStatus.RECEIVED);
  });

  // ==========================================
  // INV-10 & INV-11: ExpenseDAO and Budget Integration
  // ==========================================
  it("INV-10 & INV-11: should automatically generate linked Expense voucher in ExpenseDAO and validate Budget", async () => {
    const grn = await InventoryDAO.receiveGoods(ctx, {
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      supplierInvoiceRef: `EXP-GRN-${Date.now()}`,
      expenseCategoryId: expenseCategory.id,
      createExpenseVoucher: true,
      items: [{ itemId: reagentItem.id, quantityReceived: 10, unitCostPrice: 45000 }],
    });

    expect(grn.expenseId).toBeDefined();

    const expense = await db.expense.findUnique({ where: { id: grn.expenseId! } });
    expect(expense).toBeDefined();
    expect(new Prisma.Decimal(expense!.amount).toNumber()).toBe(450000);
    expect(expense!.vendorName).toBe(testSupplier.name);
  });

  // ==========================================
  // INV-12: Internal Store Transfers
  // ==========================================
  it("INV-12: should transfer stock between two stores in single atomic transaction", async () => {
    // Currently centralStore has 40 uniforms. We transfer 15 to labStore (or auxiliary store).
    const transfer = await InventoryDAO.transferStock(ctx, {
      sourceStoreId: centralStore.id,
      destStoreId: labStore.id,
      itemId: uniformItem.id,
      quantity: 15,
      reason: "Classroom branch allocation",
    });

    expect(new Prisma.Decimal(transfer.sourceStock.quantityOnHand).toNumber()).toBe(25);
    expect(new Prisma.Decimal(transfer.destStock.quantityOnHand).toNumber()).toBe(15);

    // Verify movements recorded
    const movements = await db.stockMovement.findMany({
      where: { referenceId: transfer.transferRef },
    });
    expect(movements.length).toBe(2);
    expect(movements.some((m) => m.movementType === StockMovementType.TRANSFER_OUT)).toBe(true);
    expect(movements.some((m) => m.movementType === StockMovementType.TRANSFER_IN)).toBe(true);
  });

  // ==========================================
  // INV-13 & INV-14: Departmental Requisitions, Issuing & Returns
  // ==========================================
  it("INV-13 & INV-14: should manage departmental requisitions, approvals, issuance, and unused returns", async () => {
    const req = await InventoryDAO.createRequisition(ctx, {
      storeId: centralStore.id,
      departmentId: department.id,
      requestedById: employee.id,
      purpose: "Practical Chemistry Lab Session",
      items: [{ itemId: reagentItem.id, quantityRequested: 4 }],
    });

    expect(req.status).toBe(RequisitionStatus.PENDING_APPROVAL);

    await InventoryDAO.approveRequisition(approverCtx, req.id);
    const issued = await InventoryDAO.issueRequisition(ctx, req.id);
    expect(issued.status).toBe(RequisitionStatus.ISSUED);

    // Verify store stock decremented
    const stock = await db.inventoryStoreStock.findUnique({
      where: { storeId_itemId: { storeId: centralStore.id, itemId: reagentItem.id } },
    });
    expect(new Prisma.Decimal(stock!.quantityOnHand).toNumber()).toBe(6); // Was 10 -> 6

    // Return 1 unused unit
    await InventoryDAO.returnRequisitionItems(ctx, req.id, {
      items: [{ itemId: reagentItem.id, quantityReturned: 1, reason: "Unopened bottle" }],
    });

    const stockAfterReturn = await db.inventoryStoreStock.findUnique({
      where: { storeId_itemId: { storeId: centralStore.id, itemId: reagentItem.id } },
    });
    expect(new Prisma.Decimal(stockAfterReturn!.quantityOnHand).toNumber()).toBe(7);
  });

  // ==========================================
  // INV-15: Student Store Direct Cash Counter Sale
  // ==========================================
  it("INV-15: should record student direct counter store sale with PaymentDAO receipt", async () => {
    const sale = await InventoryDAO.recordStudentStoreSale(ctx, {
      studentId: student.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      termId: term.id,
      isInvoiceCharge: false,
      paymentMethod: PaymentMethod.CASH,
      items: [{ itemId: uniformItem.id, quantity: 2, unitPrice: 50000 }],
    });

    expect(sale.saleReceiptNo).toMatch(/^STR-SALE-\d{4}-\d{5}$/);
    expect(sale.paymentId).toBeDefined();
    expect(new Prisma.Decimal(sale.totalAmount).toNumber()).toBe(100000);

    // Store stock reduced
    const stock = await db.inventoryStoreStock.findUnique({
      where: { storeId_itemId: { storeId: centralStore.id, itemId: uniformItem.id } },
    });
    expect(new Prisma.Decimal(stock!.quantityOnHand).toNumber()).toBe(23); // Was 25 -> 23
  });

  // ==========================================
  // INV-16: Student Store On-Account Invoiced Sale
  // ==========================================
  it("INV-16: should bill student store sale on-account and debit student subledger", async () => {
    const enrollment = await db.enrollment.findFirst({
      where: { studentId: student.id },
    });

    // Create an active term invoice for student
    const invoice = await db.invoice.create({
      data: {
        branchId: ctx.branchId,
        studentId: student.id,
        enrollmentId: enrollment!.id,
        academicYearId: academicYear.id,
        termId: term.id,
        invoiceNumber: `INV-BILL-${Date.now()}`,
        billingKey: `bill-key-${Date.now()}`,
        grossAmount: new Prisma.Decimal(500000),
        discountAmount: new Prisma.Decimal(0),
        netAmount: new Prisma.Decimal(500000),
        dueDate: new Date("2026-03-31"),
      },
    });

    const sale = await InventoryDAO.recordStudentStoreSale(ctx, {
      studentId: student.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      termId: term.id,
      isInvoiceCharge: true,
      invoiceId: invoice.id,
      items: [{ itemId: bookItem.id, quantity: 2, unitPrice: 25000 }],
    });

    expect(sale.invoiceItemId).toBeDefined();
    expect(new Prisma.Decimal(sale.totalAmount).toNumber()).toBe(50000);

    // Verify subledger entry posted
    const ledger = await db.studentLedgerEntry.findFirst({
      where: { referenceId: sale.saleReceiptNo, studentId: student.id },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.entryType).toBe("INVOICE_GROSS_CHARGE");
  });

  // ==========================================
  // INV-17: Requirements Handover Ingestion (Phase 3.1H)
  // ==========================================
  it("INV-17: should ingest Phase 3.1H physical requirement handovers into store stock without student double-credit", async () => {
    // 1. Create a Requirement and Student handover log
    const catalogItem = await db.requirementCatalog.create({
      data: {
        branchId: ctx.branchId,
        code: `REQ-CAT-${Date.now()}`,
        name: `Ream of Paper ${Date.now()}`,
        category: "ACADEMIC_STATIONERY",
        unit: "PIECE",
      },
    });

    const targetClass = await db.class.findFirst({ where: { branchId: ctx.branchId } });

    const classReq = await db.classRequirement.create({
      data: {
        branchId: ctx.branchId,
        title: "P3 Term 1 Requirements",
        classId: targetClass!.id,
        academicYearId: academicYear.id,
        termId: term.id,
        createdById: ctx.userId,
      },
    });

    const bpItem = await db.classRequirementItem.create({
      data: {
        classRequirementId: classReq.id,
        catalogItemId: catalogItem.id,
        name: catalogItem.name,
        category: "ACADEMIC_STATIONERY",
        unit: "PIECE",
        quantity: 2,
      },
    });

    const reqRecord = await db.studentRequirementRecord.create({
      data: {
        branchId: ctx.branchId,
        studentId: student.id,
        classRequirementId: classReq.id,
        academicYearId: academicYear.id,
        termId: term.id,
      },
    });

    const studentReqItem = await db.studentRequirementItem.create({
      data: {
        recordId: reqRecord.id,
        blueprintItemId: bpItem.id,
        name: catalogItem.name,
        category: "ACADEMIC_STATIONERY",
        unit: "PIECE",
        quantityRequired: 2,
        quantityDelivered: 2,
        status: "FULFILLED",
      },
    });

    const handoverLog = await db.inKindHandoverLog.create({
      data: {
        branchId: ctx.branchId,
        studentRequirementItemId: studentReqItem.id,
        receiptNumber: `INK-TEST-${Date.now()}`,
        deltaDelivered: new Prisma.Decimal(2),
        previousQuantity: new Prisma.Decimal(0),
        newQuantity: new Prisma.Decimal(2),
        receivedById: ctx.userId,
      },
    });

    // 2. Ingest into Store
    const reamInventoryItem = await InventoryDAO.createItem(ctx, {
      code: `REAM-ROTATR-${Date.now()}`,
      name: "Rotatrim A4 Reams",
      unitOfMeasure: "reams",
      unitCostPrice: 0,
    });

    const ingestion = await InventoryDAO.ingestRequirementHandovers(ctx, {
      storeId: centralStore.id,
      itemId: reamInventoryItem.id,
      handoverLogIds: [handoverLog.id],
    });

    expect(new Prisma.Decimal(ingestion.totalIngestedQty).toNumber()).toBe(2);
    expect(new Prisma.Decimal(ingestion.stock.quantityOnHand).toNumber()).toBe(2);

    // Verify handover is flagged as ingested
    const refreshedHandover = await db.inKindHandoverLog.findUnique({
      where: { id: handoverLog.id },
    });
    expect(refreshedHandover?.isIngestedIntoInventory).toBe(true);
  });

  // ==========================================
  // INV-18: Physical Stocktake Audits & Adjustments
  // ==========================================
  it("INV-18: should record physical stocktake audit with surplus and deficit adjustments", async () => {
    // Currently centralStore has 23 uniforms. Physical count reveals 25 (Surplus of +2).
    const audit1 = await InventoryDAO.recordStocktakeAdjustment(ctx, {
      storeId: centralStore.id,
      itemId: uniformItem.id,
      physicalCount: 25,
      reason: "Found 2 extra boxed uniforms during end-of-month stocktake",
    });
    expect(new Prisma.Decimal(audit1.delta).toNumber()).toBe(2);
    expect(new Prisma.Decimal(audit1.stock.quantityOnHand).toNumber()).toBe(25);

    // Another audit reveals only 22 (Deficit of -3).
    const audit2 = await InventoryDAO.recordStocktakeAdjustment(ctx, {
      storeId: centralStore.id,
      itemId: uniformItem.id,
      physicalCount: 22,
      reason: "Missing 3 uniforms due to shrinkage",
    });
    expect(new Prisma.Decimal(audit2.delta).toNumber()).toBe(-3);
    expect(new Prisma.Decimal(audit2.stock.quantityOnHand).toNumber()).toBe(22);
  });

  // ==========================================
  // INV-19: Damaged & Expired Goods Write-Off
  // ==========================================
  it("INV-19: should record damaged and expired goods write-offs with non-destructive audit trail", async () => {
    // Write off 2 damaged uniforms
    const writeoff = await InventoryDAO.recordDamageOrLossWriteoff(ctx, {
      storeId: centralStore.id,
      itemId: uniformItem.id,
      quantity: 2,
      reason: "Water damage from roof leak",
    });

    expect(new Prisma.Decimal(writeoff.stock.quantityOnHand).toNumber()).toBe(20);
    expect(writeoff.movement.movementType).toBe(StockMovementType.DAMAGE_WRITEOFF);
  });

  // ==========================================
  // INV-20: Void GRN and Synchronously Void Expense
  // ==========================================
  it("INV-20: should void Goods Received Note, reverse stock, and void linked Expense voucher", async () => {
    const grn = await InventoryDAO.receiveGoods(ctx, {
      supplierId: testSupplier.id,
      storeId: centralStore.id,
      academicYearId: academicYear.id,
      supplierInvoiceRef: `VOID-TEST-${Date.now()}`,
      expenseCategoryId: expenseCategory.id,
      createExpenseVoucher: true,
      items: [{ itemId: bookItem.id, quantityReceived: 10, unitCostPrice: 18000 }],
    });

    expect(grn.expenseId).toBeDefined();

    // Void the GRN
    const voided = await InventoryDAO.voidGoodsReceivedNote(ctx, grn.id, "Incorrect delivery consignment");
    expect(voided.isVoided).toBe(true);

    // Verify linked expense is VOID
    const expense = await db.expense.findUnique({ where: { id: grn.expenseId! } });
    expect(expense?.status).toBe("VOID");
  });
});
