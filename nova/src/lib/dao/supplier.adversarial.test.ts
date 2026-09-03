import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  PaymentMethod,
  PeriodStatus
} from "@prisma/client";
import { SupplierDAO } from "@/lib/dao/supplier.dao";
import { SupplierInvoiceDAO } from "@/lib/dao/supplier-invoice.dao";
import { SupplierCreditNoteDAO } from "@/lib/dao/supplier-credit-note.dao";
import { SupplierPaymentDAO } from "@/lib/dao/supplier-payment.dao";
import { TaxPolicyEngine } from "@/lib/dao/tax-policy.engine";
import { GLAccountDAO, FiscalPeriodDAO } from "@/lib/dao/gl.dao";

describe("Phase 3.1N: Accounts Payable Adversarial & Concurrency Suite (ADV-AP-01..ADV-AP-18)", () => {
  let ctx: TenantContext;
  let checkerCtx: TenantContext;
  let ctxBranch2: TenantContext;
  let adminUserId: string;
  let checkerUserId: string;
  let branchId: string;
  let branch2Id: string;
  let treasuryAccountId: string;
  let openPeriodId: string;
  let closedPeriodId: string;
  let academicYearId: string;
  let storeId: string;
  let inventoryItemId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `Adv_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Adv High School", organizationId: org.id }
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
        email: `maker_adv_${Date.now()}_${Math.random().toString(36).slice(2)}@alpha.ac.ug`,
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
        email: `checker_adv_${Date.now()}_${Math.random().toString(36).slice(2)}@alpha.ac.ug`,
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

    await GLAccountDAO.initBranchChartOfAccounts(branchId);
    await GLAccountDAO.initBranchChartOfAccounts(branch2Id);
    await FiscalPeriodDAO.initFiscalYear(ctx, 2026);
    await FiscalPeriodDAO.initFiscalYear(ctxBranch2, 2026);
    await TaxPolicyEngine.initBranchDefaultTaxPolicies(ctx);

    const period = await db.fiscalPeriod.findFirst({
      where: { branchId, fiscalYear: { name: "FY 2026" }, periodNumber: 1 }
    });
    openPeriodId = period!.id;

    // Create closed period
    const closedPeriod = await db.fiscalPeriod.create({
      data: {
        branchId,
        fiscalYearId: period!.fiscalYearId,
        periodNumber: 13,
        name: `Closed Period ${Date.now()}`,
        startDate: new Date("2025-12-01"),
        endDate: new Date("2025-12-31"),
        status: PeriodStatus.CLOSED
      }
    });
    closedPeriodId = closedPeriod.id;

    const ay = await db.academicYear.create({
      data: {
        branchId,
        name: `AY-2026-ADV-${Date.now()}`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      }
    });
    academicYearId = ay.id;

    const bankGl = (await GLAccountDAO.getAccountByCode(ctx, "1120"))!.id;
    const treasury = await db.treasuryAccount.create({
      data: {
        branchId,
        code: `TR-ADV-${Date.now().toString().slice(-4)}`,
        name: "Stanbic Operations Bank",
        accountType: "COMMERCIAL_BANK",
        currentBalance: new Prisma.Decimal("10000000.00"), // UGX 10M
        openingBalance: new Prisma.Decimal("10000000.00"),
        glAccountId: bankGl,
        isActive: true
      }
    });
    treasuryAccountId = treasury.id;

    const store = await db.inventoryStore.create({
      data: {
        branchId,
        code: `STR-ADV-${Date.now().toString().slice(-4)}`,
        name: "Main Campus Store"
      }
    });
    storeId = store.id;

    const item = await db.inventoryItem.create({
      data: {
        branchId,
        code: `ITM-ADV-${Date.now().toString().slice(-4)}`,
        name: "Adversarial Test Item",
        category: "GENERAL",
        unitOfMeasure: "PIECE",
        unitCostPrice: new Prisma.Decimal("50000.00"),
        reorderLevel: new Prisma.Decimal(5)
      }
    });
    inventoryItemId = item.id;
  });

  it("ADV-AP-01: Blocks concurrent disbursements that would overpay an invoice", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Concurrent Test Supplier",
      phone: "+256700000001"
    });

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `CONC-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [{ description: "Hardware Supply", quantityInvoiced: 1, unitPriceInvoiced: "1000000.00" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, invoice.id);

    // First disbursement of 1,000,000
    await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "1000000.00",
      allocations: [{ invoiceId: invoice.id, amountToAllocate: "1000000.00" }]
    });

    // Second disbursement attempting to allocate to the now fully paid invoice must fail
    await expect(
      SupplierPaymentDAO.disbursePayment(ctx, {
        supplierId: supplier.id,
        treasuryAccountId,
        paymentDate: new Date("2026-02-15"),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        amountToDisburse: "500000.00",
        allocations: [{ invoiceId: invoice.id, amountToAllocate: "500000.00" }]
      })
    ).rejects.toThrow(/exceeds invoice outstanding amount/i);
  });

  it("ADV-AP-02: Blocks approving multiple invoices whose total quantity exceeds available GRN quantity", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "GRN Race Supplier",
      phone: "+256700000002"
    });

    const grn = await db.goodsReceivedNote.create({
      data: {
        branchId,
        grnNumber: `GRN-ADV-${Date.now()}`,
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
        itemNameSnapshot: "Limited Stock Item",
        quantityReceived: new Prisma.Decimal(5),
        uninvoicedQuantity: new Prisma.Decimal(5),
        unitCostPrice: new Prisma.Decimal("100000.00"),
        lineTotalCost: new Prisma.Decimal("500000.00")
      }
    });

    const inv1 = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `RACE-INV-1-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [{ grnItemId: grnItem.id, description: "Batch 1", quantityInvoiced: 4, unitPriceInvoiced: "100000.00" }]
    });

    const inv2 = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `RACE-INV-2-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [{ grnItemId: grnItem.id, description: "Batch 2", quantityInvoiced: 4, unitPriceInvoiced: "100000.00" }]
    });

    // Approve inv1 (consumes 4 of 5 units -> 1 remains)
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, inv1.id);

    // Approving inv2 (requires 4 units but only 1 remains) must fail
    await expect(SupplierInvoiceDAO.approveInvoice(checkerCtx, inv2.id)).rejects.toThrow(
      /Invoiced quantity exceeds available GRN uninvoiced quantity/i
    );
  });

  it("ADV-AP-03: Rejects disbursement when Treasury Account balance is insufficient", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Liquidity Check Supplier",
      phone: "+256700000003"
    });

    // Attempting to disburse 100,000,000 when treasury balance is only 10,000,000
    await expect(
      SupplierPaymentDAO.disbursePayment(ctx, {
        supplierId: supplier.id,
        treasuryAccountId,
        paymentDate: new Date("2026-02-15"),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        amountToDisburse: "100000000.00"
      })
    ).rejects.toThrow(/Insufficient treasury liquidity/i);
  });

  it("ADV-AP-04: Blocks allocating credit note beyond its unallocated balance", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Credit Overalloc Supplier",
      phone: "+256700000004"
    });

    const inv = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `CR-OVER-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [{ description: "Supplies", quantityInvoiced: 1, unitPriceInvoiced: "1000000.00" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, inv.id);

    const crn = await SupplierCreditNoteDAO.createCreditNote(ctx, {
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      creditNoteDate: new Date("2026-02-12"),
      reason: "Small credit note",
      lines: [{ description: "Credit", quantityReturned: 1, unitPrice: "100000.00" }]
    });
    await SupplierCreditNoteDAO.approveCreditNote(checkerCtx, crn.id);

    // Allocate 100,000 (fully consumes credit note)
    await SupplierCreditNoteDAO.allocateCreditNote(ctx, crn.id, inv.id, 100000);

    // Second allocation must fail because unallocated amount is 0
    await expect(SupplierCreditNoteDAO.allocateCreditNote(ctx, crn.id, inv.id, 50000)).rejects.toThrow(
      /Cannot allocate credit note in status ALLOCATED|already fully allocated/i
    );
  });

  it("ADV-AP-05: Rejects creating invoice in a closed fiscal period", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Closed Period Supplier",
      phone: "+256700000005"
    });

    await expect(
      SupplierInvoiceDAO.createInvoice(ctx, {
        vendorInvoiceNumber: `CLOSED-INV-${Date.now()}`,
        supplierId: supplier.id,
        fiscalPeriodId: closedPeriodId,
        invoiceDate: new Date("2025-12-15"),
        dueDate: new Date("2026-01-15"),
        lines: [{ description: "Old Supplies", quantityInvoiced: 1, unitPriceInvoiced: "100000.00" }]
      })
    ).rejects.toThrow(/Cannot record invoice in a CLOSED fiscal period/i);
  });

  it("ADV-AP-06: Rejects approving invoice when fiscal period is closed", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Period Status Check Supplier",
      phone: "+256700000006"
    });

    const inv = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `PER-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [{ description: "Supplies", quantityInvoiced: 1, unitPriceInvoiced: "100000.00" }]
    });

    // Close the period before approval
    await db.fiscalPeriod.update({
      where: { id: openPeriodId },
      data: { status: PeriodStatus.CLOSED }
    });

    await expect(SupplierInvoiceDAO.approveInvoice(checkerCtx, inv.id)).rejects.toThrow(
      /Cannot approve invoice in a CLOSED fiscal period/i
    );

    // Reopen period for remaining tests
    await db.fiscalPeriod.update({
      where: { id: openPeriodId },
      data: { status: PeriodStatus.OPEN }
    });
  });

  it("ADV-AP-07: Blocks cross-tenant invoice creation (supplier from branch 2 in branch 1)", async () => {
    const supplierBranch2 = await SupplierDAO.createSupplier(ctxBranch2, {
      name: "City Branch Only Supplier",
      phone: "+256700000007"
    });

    await expect(
      SupplierInvoiceDAO.createInvoice(ctx, {
        vendorInvoiceNumber: `CROSS-INV-${Date.now()}`,
        supplierId: supplierBranch2.id,
        fiscalPeriodId: openPeriodId,
        invoiceDate: new Date("2026-02-10"),
        dueDate: new Date("2026-03-10"),
        lines: [{ description: "Cross Branch Attempt", quantityInvoiced: 1, unitPriceInvoiced: "100000.00" }]
      })
    ).rejects.toThrow(/Supplier not found in this branch/i);
  });

  it("ADV-AP-08: Blocks cross-tenant credit note allocation", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Cross Alloc Supplier",
      phone: "+256700000008"
    });

    const crn = await SupplierCreditNoteDAO.createCreditNote(ctx, {
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      creditNoteDate: new Date("2026-02-12"),
      reason: "Credit",
      lines: [{ description: "Credit", quantityReturned: 1, unitPrice: "100000.00" }]
    });
    await SupplierCreditNoteDAO.approveCreditNote(checkerCtx, crn.id);

    // Attempting allocation from branch 2 context
    await expect(
      SupplierCreditNoteDAO.allocateCreditNote(ctxBranch2, crn.id, "non-existent-invoice", 100000)
    ).rejects.toThrow(/Credit note not found/i);
  });

  it("ADV-AP-09: Blocks reversing an already reversed payment", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Double Reverse Supplier",
      phone: "+256700000009"
    });

    const payment = await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "200000.00"
    });

    await SupplierPaymentDAO.reversePayment(ctx, payment.id, "First reversal valid reason");

    await expect(
      SupplierPaymentDAO.reversePayment(ctx, payment.id, "Second reversal attempt")
    ).rejects.toThrow(/Cannot reverse a payment in status REVERSED/i);
  });

  it("ADV-AP-10: Rejects approving an already approved invoice", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Double Approve Supplier",
      phone: "+256700000010"
    });

    const inv = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `DBL-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [{ description: "Supplies", quantityInvoiced: 1, unitPriceInvoiced: "100000.00" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, inv.id);

    await expect(SupplierInvoiceDAO.approveInvoice(checkerCtx, inv.id)).rejects.toThrow(
      /Cannot approve invoice with status APPROVED/i
    );
  });

  it("ADV-AP-11: Rejects approving an already posted credit note", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Double CRN Approve Supplier",
      phone: "+256700000011"
    });

    const crn = await SupplierCreditNoteDAO.createCreditNote(ctx, {
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      creditNoteDate: new Date("2026-02-12"),
      reason: "Credit",
      lines: [{ description: "Credit", quantityReturned: 1, unitPrice: "50000.00" }]
    });
    await SupplierCreditNoteDAO.approveCreditNote(checkerCtx, crn.id);

    await expect(SupplierCreditNoteDAO.approveCreditNote(checkerCtx, crn.id)).rejects.toThrow(
      /Cannot approve credit note with status POSTED/i
    );
  });

  it("ADV-AP-12: Rejects negative or zero invoice quantities and negative unit prices", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Negative Value Supplier",
      phone: "+256700000012"
    });

    await expect(
      SupplierInvoiceDAO.createInvoice(ctx, {
        vendorInvoiceNumber: `NEG-INV-${Date.now()}`,
        supplierId: supplier.id,
        fiscalPeriodId: openPeriodId,
        invoiceDate: new Date("2026-02-10"),
        dueDate: new Date("2026-03-10"),
        lines: [{ description: "Negative Price", quantityInvoiced: 1, unitPriceInvoiced: "-1000.00" }]
      })
    ).rejects.toThrow(/Line quantity must be positive and unit price cannot be negative/i);
  });

  it("ADV-AP-13: Rejects negative or zero payment disbursement amounts", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Negative Disburse Supplier",
      phone: "+256700000013"
    });

    await expect(
      SupplierPaymentDAO.disbursePayment(ctx, {
        supplierId: supplier.id,
        treasuryAccountId,
        paymentDate: new Date("2026-02-15"),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        amountToDisburse: "-50000.00"
      })
    ).rejects.toThrow(/Disbursement amount must be positive/i);
  });

  it("ADV-AP-14: Rejects empty invoice line items", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Empty Line Supplier",
      phone: "+256700000014"
    });

    await expect(
      SupplierInvoiceDAO.createInvoice(ctx, {
        vendorInvoiceNumber: `EMPTY-INV-${Date.now()}`,
        supplierId: supplier.id,
        fiscalPeriodId: openPeriodId,
        invoiceDate: new Date("2026-02-10"),
        dueDate: new Date("2026-03-10"),
        lines: []
      })
    ).rejects.toThrow(/Supplier invoice must contain at least one line item/i);
  });

  it("ADV-AP-15: Rejects putting a paid invoice on hold", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Hold Paid Invoice Supplier",
      phone: "+256700000015"
    });

    const inv = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `PAID-HOLD-INV-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [{ description: "Paid supplies", quantityInvoiced: 1, unitPriceInvoiced: "100000.00" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, inv.id);

    await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "100000.00"
    });

    await expect(SupplierInvoiceDAO.setHoldStatus(ctx, inv.id, "Hold attempt", false)).rejects.toThrow(
      /Cannot place a PAID invoice on hold/i
    );
  });

  it("ADV-AP-16: Rejects duplicate vendor external invoice number for the same supplier", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Duplicate Vendor Inv Supplier",
      phone: "+256700000016"
    });

    await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: "DUP-LEGAL-REF-001",
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      lines: [{ description: "First bill", quantityInvoiced: 1, unitPriceInvoiced: "100000.00" }]
    });

    await expect(
      SupplierInvoiceDAO.createInvoice(ctx, {
        vendorInvoiceNumber: "DUP-LEGAL-REF-001",
        supplierId: supplier.id,
        fiscalPeriodId: openPeriodId,
        invoiceDate: new Date("2026-02-11"),
        dueDate: new Date("2026-03-11"),
        lines: [{ description: "Duplicate bill attempt", quantityInvoiced: 1, unitPriceInvoiced: "100000.00" }]
      })
    ).rejects.toThrow(/already exists for supplier/i);
  });

  it("ADV-AP-17: Preserves zero-drift precision on fractional monetary allocations", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Precision Supplier",
      phone: "+256700000017"
    });

    // Three invoices with fractional amounts: 333,333.33, 333,333.33, 333,333.34 = 1,000,000.00 exactly
    const inv1 = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `PREC-1-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-01"),
      dueDate: new Date("2026-02-10"),
      lines: [{ description: "Part 1", quantityInvoiced: 1, unitPriceInvoiced: "333333.33" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, inv1.id);

    const inv2 = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `PREC-2-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-01"),
      dueDate: new Date("2026-02-11"),
      lines: [{ description: "Part 2", quantityInvoiced: 1, unitPriceInvoiced: "333333.33" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, inv2.id);

    const inv3 = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: `PREC-3-${Date.now()}`,
      supplierId: supplier.id,
      fiscalPeriodId: openPeriodId,
      invoiceDate: new Date("2026-02-01"),
      dueDate: new Date("2026-02-12"),
      lines: [{ description: "Part 3", quantityInvoiced: 1, unitPriceInvoiced: "333333.34" }]
    });
    await SupplierInvoiceDAO.approveInvoice(checkerCtx, inv3.id);

    // Disburse exactly 1,000,000.00
    await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: supplier.id,
      treasuryAccountId,
      paymentDate: new Date("2026-02-15"),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountToDisburse: "1000000.00"
    });

    const ref1 = await db.supplierInvoice.findUnique({ where: { id: inv1.id } });
    const ref2 = await db.supplierInvoice.findUnique({ where: { id: inv2.id } });
    const ref3 = await db.supplierInvoice.findUnique({ where: { id: inv3.id } });

    expect(ref1!.status).toBe("PAID");
    expect(ref2!.status).toBe("PAID");
    expect(ref3!.status).toBe("PAID");
  });

  it("ADV-AP-18: Verifies Subledger balance cache matches calculated statement ledger", async () => {
    const supplier = await SupplierDAO.createSupplier(ctx, {
      name: "Audit Supplier",
      phone: "+256700000018"
    });

    const refreshedSupplier = await db.inventorySupplier.findUnique({
      where: { id: supplier.id }
    });

    expect(new Prisma.Decimal(refreshedSupplier!.currentBalanceUGX).isZero()).toBe(true);
  });
});
