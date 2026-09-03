import { db } from "../db";
import {
  Prisma,
  StoreLocationType,
  InventoryItemCategory,
  PurchaseOrderStatus,
  StockMovementType,
  RequisitionStatus,
  PaymentMethod,
  LedgerEntryType,
  LedgerDirection,
} from "@prisma/client";
import { AuditService } from "../services/audit.service";
import { ExpenseDAO } from "./expense.dao";
import { PaymentDAO } from "./payment.dao";
import { LedgerDAO } from "./ledger.dao";
import { TenantContext } from "./tenant-context";
import { GLIntegrationService } from "./gl-integration.service";

export interface Context {
  branchId: string;
  userId: string;
  organizationId?: string;
  schoolId?: string;
  role?: string;
  permissions?: string[];
}

export function toTenantContext(ctx: Context): TenantContext {
  return {
    branchId: ctx.branchId,
    userId: ctx.userId,
    organizationId: ctx.organizationId || "org-system",
    schoolId: ctx.schoolId || "school-system",
    role: ctx.role || "ADMIN",
    permissions: ctx.permissions && ctx.permissions.length > 0 ? ctx.permissions : ["all"],
  };
}

export class InventoryDAO {
  // ============================================================================
  // SEQUENCE GENERATOR HELPER
  // ============================================================================

  private static async getNextSequence(
    tx: Prisma.TransactionClient,
    branchId: string,
    type: "PO" | "GRN" | "REQ" | "SALE",
    year: number
  ): Promise<string> {
    const seq = await tx.inventorySequence.upsert({
      where: {
        branchId_type_year: {
          branchId,
          type,
          year,
        },
      },
      update: {
        lastValue: { increment: 1 },
      },
      create: {
        branchId,
        type,
        year,
        lastValue: 1,
      },
    });

    const prefix =
      type === "PO"
        ? "PO"
        : type === "GRN"
        ? "GRN"
        : type === "REQ"
        ? "REQ"
        : "STR-SALE";

    return `${prefix}-${year}-${seq.lastValue.toString().padStart(5, "0")}`;
  }

  // ============================================================================
  // 1. STORE LOCATIONS MANAGEMENT
  // ============================================================================

  static async createStore(
    ctx: Context,
    input: {
      code: string;
      name: string;
      storeType?: StoreLocationType;
      location?: string | null;
      managerId?: string | null;
    }
  ) {
    const cleanCode = input.code.trim().toUpperCase();
    const cleanName = input.name.trim();

    if (!cleanCode || !cleanName) {
      throw new Error("Store code and name are required.");
    }

    const store = await db.inventoryStore.create({
      data: {
        branchId: ctx.branchId,
        code: cleanCode,
        name: cleanName,
        storeType: input.storeType || StoreLocationType.CENTRAL_STORE,
        location: input.location?.trim() || null,
        managerId: input.managerId || null,
      },
      include: {
        manager: true,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "CREATE_INVENTORY_STORE",
      "InventoryStore",
      store.id,
      JSON.stringify({ code: store.code, name: store.name, storeType: store.storeType })
    );

    return store;
  }

  static async updateStore(
    ctx: Context,
    id: string,
    input: Partial<{
      name: string;
      storeType: StoreLocationType;
      location: string | null;
      managerId: string | null;
      isActive: boolean;
    }>
  ) {
    const existing = await db.inventoryStore.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!existing) {
      throw new Error("Inventory store not found.");
    }

    const updated = await db.inventoryStore.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        storeType: input.storeType,
        location: input.location !== undefined ? input.location?.trim() || null : undefined,
        managerId: input.managerId !== undefined ? input.managerId : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
      include: { manager: true },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "UPDATE_INVENTORY_STORE",
      "InventoryStore",
      updated.id,
      JSON.stringify(input)
    );

    return updated;
  }

  static async getStore(ctx: Context, id: string) {
    const store = await db.inventoryStore.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        manager: true,
        stocks: {
          include: { item: true },
        },
      },
    });
    if (!store) {
      throw new Error("Inventory store not found.");
    }
    return store;
  }

  static async listStores(
    ctx: Context,
    filters?: {
      storeType?: StoreLocationType;
      isActive?: boolean;
      search?: string;
    }
  ) {
    const where: Prisma.InventoryStoreWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.storeType ? { storeType: filters.storeType } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { code: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return db.inventoryStore.findMany({
      where,
      include: {
        manager: true,
        _count: {
          select: { stocks: true, movements: true },
        },
      },
      orderBy: { code: "asc" },
    });
  }

  // ============================================================================
  // 2. ITEM MASTER & CATALOG MANAGEMENT
  // ============================================================================

  static async createItem(
    ctx: Context,
    input: {
      code: string;
      name: string;
      category?: InventoryItemCategory;
      unitOfMeasure: string;
      unitCostPrice?: number | string | Prisma.Decimal;
      sellingPrice?: number | string | Prisma.Decimal | null;
      reorderLevel?: number | string | Prisma.Decimal;
      description?: string | null;
    }
  ) {
    const cleanCode = input.code.trim().toUpperCase();
    const cleanName = input.name.trim();

    if (!cleanCode || !cleanName || !input.unitOfMeasure) {
      throw new Error("Item code, name, and unit of measure are required.");
    }

    const costDecimal = new Prisma.Decimal(input.unitCostPrice ?? 0);
    const sellingDecimal =
      input.sellingPrice !== undefined && input.sellingPrice !== null
        ? new Prisma.Decimal(input.sellingPrice)
        : null;
    const reorderDecimal = new Prisma.Decimal(input.reorderLevel ?? 10);

    if (costDecimal.isNegative() || (sellingDecimal && sellingDecimal.isNegative()) || reorderDecimal.isNegative()) {
      throw new Error("Prices and reorder levels cannot be negative.");
    }

    const item = await db.inventoryItem.create({
      data: {
        branchId: ctx.branchId,
        code: cleanCode,
        name: cleanName,
        category: input.category || InventoryItemCategory.GENERAL,
        unitOfMeasure: input.unitOfMeasure.trim(),
        unitCostPrice: costDecimal,
        sellingPrice: sellingDecimal,
        reorderLevel: reorderDecimal,
        description: input.description?.trim() || null,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "CREATE_INVENTORY_ITEM",
      "InventoryItem",
      item.id,
      JSON.stringify({
        code: item.code,
        name: item.name,
        category: item.category,
        unitCostPrice: item.unitCostPrice.toString(),
      })
    );

    return item;
  }

  static async updateItem(
    ctx: Context,
    id: string,
    input: Partial<{
      name: string;
      category: InventoryItemCategory;
      unitOfMeasure: string;
      unitCostPrice: number | string | Prisma.Decimal;
      sellingPrice: number | string | Prisma.Decimal | null;
      reorderLevel: number | string | Prisma.Decimal;
      description: string | null;
      isActive: boolean;
    }>
  ) {
    const existing = await db.inventoryItem.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!existing) {
      throw new Error("Inventory item not found.");
    }

    const costDecimal =
      input.unitCostPrice !== undefined ? new Prisma.Decimal(input.unitCostPrice) : undefined;
    const sellingDecimal =
      input.sellingPrice !== undefined
        ? input.sellingPrice !== null
          ? new Prisma.Decimal(input.sellingPrice)
          : null
        : undefined;
    const reorderDecimal =
      input.reorderLevel !== undefined ? new Prisma.Decimal(input.reorderLevel) : undefined;

    const updated = await db.inventoryItem.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        category: input.category,
        unitOfMeasure: input.unitOfMeasure !== undefined ? input.unitOfMeasure.trim() : undefined,
        unitCostPrice: costDecimal,
        sellingPrice: sellingDecimal,
        reorderLevel: reorderDecimal,
        description: input.description !== undefined ? input.description?.trim() || null : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "UPDATE_INVENTORY_ITEM",
      "InventoryItem",
      updated.id,
      JSON.stringify(input)
    );

    return updated;
  }

  static async getItem(ctx: Context, id: string) {
    const item = await db.inventoryItem.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        stocks: {
          include: { store: true },
        },
      },
    });
    if (!item) {
      throw new Error("Inventory item not found.");
    }
    return item;
  }

  static async listItems(
    ctx: Context,
    filters?: {
      category?: InventoryItemCategory;
      isActive?: boolean;
      search?: string;
      lowStockOnly?: boolean;
      storeId?: string;
    }
  ) {
    const where: Prisma.InventoryItemWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.category ? { category: filters.category } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { code: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const items = await db.inventoryItem.findMany({
      where,
      include: {
        stocks: filters?.storeId
          ? { where: { storeId: filters.storeId }, include: { store: true } }
          : { include: { store: true } },
      },
      orderBy: { name: "asc" },
    });

    if (filters?.lowStockOnly) {
      return items.filter((item) => {
        const totalOnHand = item.stocks.reduce(
          (acc, s) => acc.add(s.quantityOnHand),
          new Prisma.Decimal(0)
        );
        return totalOnHand.lessThanOrEqualTo(item.reorderLevel);
      });
    }

    return items;
  }

  // ============================================================================
  // 3. ATOMIC STOCK MUTATION & AUDIT MOVEMENT HELPER
  // ============================================================================

  public static async recordStockMutation(
    tx: Prisma.TransactionClient,
    params: {
      branchId: string;
      storeId: string;
      itemId: string;
      movementType: StockMovementType;
      quantityDelta: Prisma.Decimal;
      referenceType: string;
      referenceId?: string | null;
      reason?: string | null;
      performedById: string;
      allowNegative?: boolean;
      overrideUnitCost?: Prisma.Decimal;
    }
  ) {
    // 1. Get or initialize StoreStock row
    let stock = await tx.inventoryStoreStock.findUnique({
      where: {
        storeId_itemId: {
          storeId: params.storeId,
          itemId: params.itemId,
        },
      },
    });

    if (!stock) {
      stock = await tx.inventoryStoreStock.create({
        data: {
          branchId: params.branchId,
          storeId: params.storeId,
          itemId: params.itemId,
          quantityOnHand: new Prisma.Decimal(0),
          quantityReserved: new Prisma.Decimal(0),
        },
      });
    }

    const currentOnHand = new Prisma.Decimal(stock.quantityOnHand);
    const newOnHand = currentOnHand.add(params.quantityDelta);

    if (!params.allowNegative && newOnHand.isNegative()) {
      throw new Error(
        `Insufficient stock for item in store. Available: ${currentOnHand.toString()}, Requested delta: ${params.quantityDelta.toString()}`
      );
    }

    // 2. Fetch Item to get current unit WAC cost
    const item = await tx.inventoryItem.findUniqueOrThrow({
      where: { id: params.itemId },
    });

    const costAtMovement = params.overrideUnitCost || item.unitCostPrice;
    const totalValuation = newOnHand.mul(costAtMovement);

    // 3. Update StoreStock
    await tx.inventoryStoreStock.update({
      where: { id: stock.id },
      data: {
        quantityOnHand: newOnHand,
      },
    });

    // 4. Create immutable StockMovement entry
    const movement = await tx.stockMovement.create({
      data: {
        branchId: params.branchId,
        storeId: params.storeId,
        itemId: params.itemId,
        movementType: params.movementType,
        quantityDelta: params.quantityDelta,
        balanceAfter: newOnHand,
        unitCostAtMovement: costAtMovement,
        totalValuation,
        referenceType: params.referenceType,
        referenceId: params.referenceId || null,
        reason: params.reason || null,
        performedById: params.performedById,
      },
    });

    return { stock: { ...stock, quantityOnHand: newOnHand }, movement };
  }

  // ============================================================================
  // 4. SUPPLIERS MANAGEMENT
  // ============================================================================

  static async createSupplier(
    ctx: Context,
    input: {
      supplierCode: string;
      name: string;
      contactName?: string | null;
      phone: string;
      email?: string | null;
      address?: string | null;
      taxIdNumber?: string | null;
      paymentTerms?: string | null;
      notes?: string | null;
    }
  ) {
    const cleanCode = input.supplierCode.trim().toUpperCase();
    const cleanName = input.name.trim();

    if (!cleanCode || !cleanName || !input.phone) {
      throw new Error("Supplier code, name, and phone are required.");
    }

    const supplier = await db.inventorySupplier.create({
      data: {
        branchId: ctx.branchId,
        supplierCode: cleanCode,
        name: cleanName,
        contactName: input.contactName?.trim() || null,
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        taxIdNumber: input.taxIdNumber?.trim() || null,
        paymentTerms: input.paymentTerms?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "CREATE_INVENTORY_SUPPLIER",
      "InventorySupplier",
      supplier.id,
      JSON.stringify({ code: supplier.supplierCode, name: supplier.name })
    );

    return supplier;
  }

  static async updateSupplier(
    ctx: Context,
    id: string,
    input: Partial<{
      name: string;
      contactName: string | null;
      phone: string;
      email: string | null;
      address: string | null;
      taxIdNumber: string | null;
      paymentTerms: string | null;
      notes: string | null;
      isActive: boolean;
    }>
  ) {
    const existing = await db.inventorySupplier.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!existing) {
      throw new Error("Supplier not found.");
    }

    const updated = await db.inventorySupplier.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        contactName: input.contactName !== undefined ? input.contactName?.trim() || null : undefined,
        phone: input.phone !== undefined ? input.phone.trim() : undefined,
        email: input.email !== undefined ? input.email?.trim() || null : undefined,
        address: input.address !== undefined ? input.address?.trim() || null : undefined,
        taxIdNumber: input.taxIdNumber !== undefined ? input.taxIdNumber?.trim() || null : undefined,
        paymentTerms: input.paymentTerms !== undefined ? input.paymentTerms?.trim() || null : undefined,
        notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "UPDATE_INVENTORY_SUPPLIER",
      "InventorySupplier",
      updated.id,
      JSON.stringify(input)
    );

    return updated;
  }

  static async getSupplier(ctx: Context, id: string) {
    const supplier = await db.inventorySupplier.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        pos: { orderBy: { createdAt: "desc" }, take: 10 },
        grns: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!supplier) {
      throw new Error("Supplier not found.");
    }
    return supplier;
  }

  static async listSuppliers(
    ctx: Context,
    filters?: {
      isActive?: boolean;
      search?: string;
    }
  ) {
    const where: Prisma.InventorySupplierWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { supplierCode: { contains: filters.search, mode: "insensitive" } },
              { phone: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return db.inventorySupplier.findMany({
      where,
      include: {
        _count: {
          select: { pos: true, grns: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  // ============================================================================
  // 5. PURCHASE ORDERS (PO) MANAGEMENT
  // ============================================================================

  static async createPurchaseOrder(
    ctx: Context,
    input: {
      supplierId: string;
      academicYearId: string;
      termId?: string | null;
      expectedDate?: Date | string | null;
      notes?: string | null;
      items: Array<{
        itemId: string;
        quantityOrdered: number | string | Prisma.Decimal;
        unitCostPrice: number | string | Prisma.Decimal;
      }>;
    }
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error("Purchase order must contain at least one line item.");
    }

    return db.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const poNumber = await InventoryDAO.getNextSequence(tx, ctx.branchId, "PO", year);

      let totalAmount = new Prisma.Decimal(0);
      const itemsToCreate = [];

      for (const itemInput of input.items) {
        const item = await tx.inventoryItem.findUnique({
          where: { id: itemInput.itemId },
        });
        if (!item || item.branchId !== ctx.branchId) {
          throw new Error(`Inventory item ${itemInput.itemId} not found in this branch.`);
        }

        const qty = new Prisma.Decimal(itemInput.quantityOrdered);
        const unitCost = new Prisma.Decimal(itemInput.unitCostPrice);

        if (qty.lessThanOrEqualTo(0) || unitCost.isNegative()) {
          throw new Error("Quantity must be greater than zero and unit cost cannot be negative.");
        }

        const lineTotal = qty.mul(unitCost);
        totalAmount = totalAmount.add(lineTotal);

        itemsToCreate.push({
          itemId: item.id,
          itemNameSnapshot: item.name,
          quantityOrdered: qty,
          quantityReceived: new Prisma.Decimal(0),
          unitCostPrice: unitCost,
          lineTotalCost: lineTotal,
        });
      }

      const po = await tx.purchaseOrder.create({
        data: {
          branchId: ctx.branchId,
          poNumber,
          supplierId: input.supplierId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          status: PurchaseOrderStatus.DRAFT,
          totalAmount,
          notes: input.notes?.trim() || null,
          createdById: ctx.userId,
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          items: { include: { item: true } },
          supplier: true,
        },
      });

      await AuditService.log(
        toTenantContext(ctx),
        "CREATE_PURCHASE_ORDER",
        "PurchaseOrder",
        po.id,
        JSON.stringify({ poNumber: po.poNumber, totalAmount: po.totalAmount.toString() })
      );

      return po;
    });
  }

  static async submitPurchaseOrder(ctx: Context, id: string) {
    const po = await db.purchaseOrder.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!po) {
      throw new Error("Purchase order not found.");
    }
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error(`Only DRAFT purchase orders can be submitted. Current status: ${po.status}`);
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SUBMITTED },
      include: { items: true, supplier: true },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "SUBMIT_PURCHASE_ORDER",
      "PurchaseOrder",
      updated.id,
      JSON.stringify({ poNumber: updated.poNumber, status: updated.status })
    );

    return updated;
  }

  static async approvePurchaseOrder(
    ctx: Context,
    id: string,
    options?: { allowSelfApproval?: boolean }
  ) {
    const po = await db.purchaseOrder.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!po) {
      throw new Error("Purchase order not found.");
    }
    if (po.status !== PurchaseOrderStatus.SUBMITTED && po.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error(`Cannot approve PO in status: ${po.status}`);
    }

    // Four-eye check (anti-self-approval)
    if (!options?.allowSelfApproval && po.createdById === ctx.userId) {
      throw new Error("Anti-self-approval violation: The creator of a Purchase Order cannot approve it.");
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedById: ctx.userId,
        approvedAt: new Date(),
      },
      include: { items: true, supplier: true, approvedBy: true },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "APPROVE_PURCHASE_ORDER",
      "PurchaseOrder",
      updated.id,
      JSON.stringify({ poNumber: updated.poNumber, approvedBy: ctx.userId })
    );

    return updated;
  }

  static async cancelPurchaseOrder(ctx: Context, id: string, cancellationReason: string) {
    const cleanReason = cancellationReason.trim();
    if (!cleanReason) {
      throw new Error("Cancellation reason is mandatory.");
    }

    const po = await db.purchaseOrder.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!po) {
      throw new Error("Purchase order not found.");
    }
    if (po.status === PurchaseOrderStatus.RECEIVED) {
      throw new Error("Cannot cancel a fully RECEIVED purchase order.");
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
        cancellationReason: cleanReason,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "CANCEL_PURCHASE_ORDER",
      "PurchaseOrder",
      updated.id,
      JSON.stringify({ poNumber: updated.poNumber, cancellationReason: cleanReason })
    );

    return updated;
  }

  static async rejectPurchaseOrder(ctx: Context, id: string, rejectionReason: string) {
    const cleanReason = rejectionReason.trim();
    if (!cleanReason) {
      throw new Error("Rejection reason is mandatory.");
    }

    const po = await db.purchaseOrder.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!po) {
      throw new Error("Purchase order not found.");
    }
    if (po.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new Error("Only SUBMITTED purchase orders can be rejected.");
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.REJECTED,
        rejectionReason: cleanReason,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "REJECT_PURCHASE_ORDER",
      "PurchaseOrder",
      updated.id,
      JSON.stringify({ poNumber: updated.poNumber, rejectionReason: cleanReason })
    );

    return updated;
  }

  static async getPurchaseOrder(ctx: Context, id: string) {
    const po = await db.purchaseOrder.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        supplier: true,
        items: { include: { item: true } },
        createdBy: true,
        approvedBy: true,
        grns: true,
      },
    });
    if (!po) {
      throw new Error("Purchase order not found.");
    }
    return po;
  }

  static async listPurchaseOrders(
    ctx: Context,
    filters?: {
      supplierId?: string;
      status?: PurchaseOrderStatus;
      academicYearId?: string;
      termId?: string;
    }
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.academicYearId ? { academicYearId: filters.academicYearId } : {}),
      ...(filters?.termId ? { termId: filters.termId } : {}),
    };

    return db.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: { include: { item: true } },
        createdBy: true,
        approvedBy: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ============================================================================
  // 6. GOODS RECEIVED NOTES (GRN), WAC RECALCULATION & EXPENSE INTEGRATION
  // ============================================================================

  static async receiveGoods(
    ctx: Context,
    input: {
      poId?: string | null;
      supplierId: string;
      storeId: string;
      academicYearId: string;
      termId?: string | null;
      deliveryDate?: Date | string;
      supplierInvoiceRef?: string | null;
      notes?: string | null;
      createExpenseVoucher?: boolean;
      paymentMethod?: PaymentMethod;
      expenseCategoryId?: string | null;
      allowOverReceipt?: boolean;
      overReceiptJustification?: string | null;
      items: Array<{
        itemId: string;
        quantityReceived: number | string | Prisma.Decimal;
        unitCostPrice: number | string | Prisma.Decimal;
        batchNumber?: string | null;
        expiryDate?: Date | string | null;
        notes?: string | null;
      }>;
    }
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error("Goods Received Note must contain at least one line item.");
    }

    return db.$transaction(async (tx) => {
      // 1. Verify Supplier and Store
      const supplier = await tx.inventorySupplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier || supplier.branchId !== ctx.branchId) {
        throw new Error("Supplier not found in this branch.");
      }

      const store = await tx.inventoryStore.findUnique({
        where: { id: input.storeId },
      });
      if (!store || store.branchId !== ctx.branchId) {
        throw new Error("Store location not found in this branch.");
      }

      // Check duplicate supplier invoice reference
      if (input.supplierInvoiceRef?.trim()) {
        const dupRef = await tx.goodsReceivedNote.findFirst({
          where: {
            branchId: ctx.branchId,
            supplierId: input.supplierId,
            supplierInvoiceRef: input.supplierInvoiceRef.trim(),
            isVoided: false,
          },
        });
        if (dupRef) {
          throw new Error(
            `A Goods Received Note with supplier invoice reference "${input.supplierInvoiceRef.trim()}" already exists for this vendor.`
          );
        }
      }

      // 2. Validate PO if supplied
      let po = null;
      if (input.poId) {
        po = await tx.purchaseOrder.findUnique({
          where: { id: input.poId },
          include: { items: true },
        });
        if (!po || po.branchId !== ctx.branchId) {
          throw new Error("Purchase order not found in this branch.");
        }
        if (
          po.status !== PurchaseOrderStatus.APPROVED &&
          po.status !== PurchaseOrderStatus.ORDERED &&
          po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
        ) {
          throw new Error(`Cannot receive goods against PO in status: ${po.status}`);
        }
      }

      // 3. Generate Sequence
      const year = new Date().getFullYear();
      const grnNumber = await InventoryDAO.getNextSequence(tx, ctx.branchId, "GRN", year);

      let totalAmount = new Prisma.Decimal(0);
      const grnItemsToCreate = [];

      // 4. Process Each Item, Update WAC, and Increment Stock
      for (const itemInput of input.items) {
        const item = await tx.inventoryItem.findUnique({
          where: { id: itemInput.itemId },
        });
        if (!item || item.branchId !== ctx.branchId) {
          throw new Error(`Inventory item ${itemInput.itemId} not found in this branch.`);
        }

        const qtyReceived = new Prisma.Decimal(itemInput.quantityReceived);
        const unitCost = new Prisma.Decimal(itemInput.unitCostPrice);

        if (qtyReceived.lessThanOrEqualTo(0) || unitCost.isNegative()) {
          throw new Error("Received quantity must be positive and unit cost cannot be negative.");
        }

        // PO remaining check and over-receipt tolerance
        if (po) {
          const poLine = po.items.find((line) => line.itemId === item.id);
          if (!poLine) {
            throw new Error(`Item "${item.name}" was not part of Purchase Order ${po.poNumber}.`);
          }

          const currentReceived = new Prisma.Decimal(poLine.quantityReceived);
          const orderedQty = new Prisma.Decimal(poLine.quantityOrdered);
          const newReceivedTotal = currentReceived.add(qtyReceived);

          if (newReceivedTotal.greaterThan(orderedQty)) {
            const overagePercent = newReceivedTotal.minus(orderedQty).div(orderedQty).mul(100);
            if (!input.allowOverReceipt) {
              throw new Error(
                `Over-receipt blocked for item "${item.name}". Ordered: ${orderedQty.toString()}, Total received would be: ${newReceivedTotal.toString()}.`
              );
            }
            if (overagePercent.greaterThan(10)) {
              throw new Error(
                `Over-receipt exceeded maximum allowed tolerance of 10% for item "${item.name}" (Attempted: ${overagePercent.toFixed(2)}%).`
              );
            }
          }

          // Update PO Line
          await tx.purchaseOrderItem.update({
            where: { id: poLine.id },
            data: { quantityReceived: newReceivedTotal },
          });
        }

        const lineTotal = qtyReceived.mul(unitCost);
        totalAmount = totalAmount.add(lineTotal);

        // Fetch current total stock across branch to compute new WAC
        const allItemStocks = await tx.inventoryStoreStock.findMany({
          where: { itemId: item.id, branchId: ctx.branchId },
        });
        const currentTotalStock = allItemStocks.reduce(
          (acc, s) => acc.add(s.quantityOnHand),
          new Prisma.Decimal(0)
        );

        let newWAC: Prisma.Decimal;
        if (currentTotalStock.lessThanOrEqualTo(0)) {
          newWAC = unitCost;
        } else {
          const currentTotalValuation = currentTotalStock.mul(item.unitCostPrice);
          const newInflowValuation = qtyReceived.mul(unitCost);
          const combinedStock = currentTotalStock.add(qtyReceived);
          newWAC = currentTotalValuation.add(newInflowValuation).div(combinedStock);
        }

        // Round WAC to 2 decimal places half-up
        const roundedWAC = new Prisma.Decimal(newWAC.toFixed(2));

        // Update Item master WAC
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { unitCostPrice: roundedWAC },
        });

        // Mutate Stock + Audit Log
        await InventoryDAO.recordStockMutation(tx, {
          branchId: ctx.branchId,
          storeId: input.storeId,
          itemId: item.id,
          movementType: StockMovementType.PROCUREMENT_RECEIPT,
          quantityDelta: qtyReceived,
          referenceType: "GRN",
          referenceId: grnNumber,
          reason: `Procurement Delivery from ${supplier.name} (GRN: ${grnNumber})`,
          performedById: ctx.userId,
          overrideUnitCost: unitCost,
        });

        grnItemsToCreate.push({
          itemId: item.id,
          itemNameSnapshot: item.name,
          quantityReceived: qtyReceived,
          unitCostPrice: unitCost,
          lineTotalCost: lineTotal,
          batchNumber: itemInput.batchNumber?.trim() || null,
          expiryDate: itemInput.expiryDate ? new Date(itemInput.expiryDate) : null,
          notes: itemInput.notes?.trim() || null,
        });
      }

      // 5. Update PO overall status if applicable
      if (po) {
        const refreshedLines = await tx.purchaseOrderItem.findMany({
          where: { poId: po.id },
        });
        const isFullyReceived = refreshedLines.every((l) =>
          new Prisma.Decimal(l.quantityReceived).greaterThanOrEqualTo(l.quantityOrdered)
        );

        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            status: isFullyReceived
              ? PurchaseOrderStatus.RECEIVED
              : PurchaseOrderStatus.PARTIALLY_RECEIVED,
          },
        });
      }

      // 6. ExpenseDAO and BudgetDAO Integration
      let expenseId: string | null = null;
      if (input.createExpenseVoucher !== false) {
        // Resolve Expense Category
        let categoryId = input.expenseCategoryId;
        if (!categoryId) {
          const defaultCat = await tx.expenseCategory.findFirst({
            where: { branchId: ctx.branchId, isActive: true },
          });
          if (defaultCat) {
            categoryId = defaultCat.id;
          }
        }

        if (categoryId) {
          const tenantCtx = toTenantContext(ctx);
          const paymentMethod = input.paymentMethod || PaymentMethod.BANK_TRANSFER;
          const idempotencyKey = `grn-exp-${ctx.branchId}-${grnNumber}`;

          const expenseResult = await ExpenseDAO.createExpense(tenantCtx, {
            categoryId,
            title: `GRN: ${grnNumber} - ${supplier.name}`,
            amount: totalAmount,
            paymentMethod,
            vendorName: supplier.name,
            receiptRef: input.supplierInvoiceRef?.trim() || grnNumber,
            notes: `Auto-generated procurement voucher for Goods Received Note ${grnNumber}`,
            idempotencyKey,
            expenseDate: input.deliveryDate || new Date(),
          });
          expenseId = expenseResult.expense.id;
        }
      }

      // 7. Create Goods Received Note record
      const grn = await tx.goodsReceivedNote.create({
        data: {
          branchId: ctx.branchId,
          grnNumber,
          poId: input.poId || null,
          supplierId: input.supplierId,
          storeId: input.storeId,
          expenseId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : new Date(),
          supplierInvoiceRef: input.supplierInvoiceRef?.trim() || null,
          supplierNameSnapshot: supplier.name,
          totalAmount,
          notes: input.notes?.trim() || null,
          receivedById: ctx.userId,
          items: {
            create: grnItemsToCreate,
          },
        },
        include: {
          items: { include: { item: true } },
          supplier: true,
          store: true,
          expense: true,
        },
      });

      await AuditService.log(
        toTenantContext(ctx),
        "RECEIVE_GOODS_GRN",
        "GoodsReceivedNote",
        grn.id,
        JSON.stringify({
          grnNumber: grn.grnNumber,
          totalAmount: grn.totalAmount.toString(),
          supplier: supplier.name,
          expenseId: grn.expenseId,
        })
      );

      // Post GRN Receipt to General Ledger (Phase 3.1L)
      try {
        await GLIntegrationService.postGRNReceipt(tx, toTenantContext(ctx), grn.id);
      } catch {
        // Non-blocking fallback
      }

      return grn;
    });
  }

  static async voidGoodsReceivedNote(ctx: Context, id: string, voidReason: string) {
    const cleanReason = voidReason.trim();
    if (!cleanReason) {
      throw new Error("Void reason is mandatory.");
    }

    return db.$transaction(async (tx) => {
      const grn = await tx.goodsReceivedNote.findFirst({
        where: { id, branchId: ctx.branchId },
        include: { items: true },
      });
      if (!grn) {
        throw new Error("Goods Received Note not found.");
      }
      if (grn.isVoided) {
        throw new Error("Goods Received Note is already voided.");
      }

      // 1. Reverse stock movements for each item
      for (const itemLine of grn.items) {
        await InventoryDAO.recordStockMutation(tx, {
          branchId: ctx.branchId,
          storeId: grn.storeId,
          itemId: itemLine.itemId,
          movementType: StockMovementType.VENDOR_RETURN,
          quantityDelta: itemLine.quantityReceived.mul(-1),
          referenceType: "GRN_VOID",
          referenceId: grn.grnNumber,
          reason: `GRN Voided: ${cleanReason}`,
          performedById: ctx.userId,
          overrideUnitCost: itemLine.unitCostPrice,
        });

        // If PO was attached, decrement PO received quantity
        if (grn.poId) {
          const poLine = await tx.purchaseOrderItem.findFirst({
            where: { poId: grn.poId, itemId: itemLine.itemId },
          });
          if (poLine) {
            const updatedReceived = new Prisma.Decimal(poLine.quantityReceived).minus(
              itemLine.quantityReceived
            );
            await tx.purchaseOrderItem.update({
              where: { id: poLine.id },
              data: {
                quantityReceived: updatedReceived.isNegative()
                  ? new Prisma.Decimal(0)
                  : updatedReceived,
              },
            });
          }
        }
      }

      // Re-evaluate PO status if attached
      if (grn.poId) {
        const poLines = await tx.purchaseOrderItem.findMany({
          where: { poId: grn.poId },
        });
        const anyReceived = poLines.some((l) => new Prisma.Decimal(l.quantityReceived).greaterThan(0));
        await tx.purchaseOrder.update({
          where: { id: grn.poId },
          data: {
            status: anyReceived
              ? PurchaseOrderStatus.PARTIALLY_RECEIVED
              : PurchaseOrderStatus.APPROVED,
          },
        });
      }

      // 2. Void linked Expense voucher if exists
      if (grn.expenseId) {
        await ExpenseDAO.voidExpense(
          toTenantContext(ctx),
          grn.expenseId,
          `GRN ${grn.grnNumber} voided: ${cleanReason}`
        );
      }

      // 3. Mark GRN as voided
      const updated = await tx.goodsReceivedNote.update({
        where: { id: grn.id },
        data: {
          isVoided: true,
          voidReason: cleanReason,
        },
      });

      await AuditService.log(
        toTenantContext(ctx),
        "VOID_GOODS_RECEIVED_NOTE",
        "GoodsReceivedNote",
        updated.id,
        JSON.stringify({ grnNumber: updated.grnNumber, voidReason: cleanReason })
      );

      return updated;
    });
  }

  static async getGoodsReceivedNote(ctx: Context, id: string) {
    const grn = await db.goodsReceivedNote.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        supplier: true,
        store: true,
        expense: true,
        receivedBy: true,
        items: { include: { item: true } },
      },
    });
    if (!grn) {
      throw new Error("Goods Received Note not found.");
    }
    return grn;
  }

  static async listGoodsReceivedNotes(
    ctx: Context,
    filters?: {
      supplierId?: string;
      storeId?: string;
      poId?: string;
      isVoided?: boolean;
    }
  ) {
    const where: Prisma.GoodsReceivedNoteWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters?.storeId ? { storeId: filters.storeId } : {}),
      ...(filters?.poId ? { poId: filters.poId } : {}),
      ...(filters?.isVoided !== undefined ? { isVoided: filters.isVoided } : {}),
    };

    return db.goodsReceivedNote.findMany({
      where,
      include: {
        supplier: true,
        store: true,
        expense: true,
        receivedBy: true,
        items: { include: { item: true } },
      },
      orderBy: { deliveryDate: "desc" },
    });
  }

  // ============================================================================
  // 7. REQUIREMENTS INGESTION (PHASE 3.1H INTEGRATION)
  // ============================================================================

  static async ingestRequirementHandovers(
    ctx: Context,
    input: {
      storeId: string;
      itemId: string;
      handoverLogIds: string[];
      notes?: string | null;
    }
  ) {
    if (!input.handoverLogIds || input.handoverLogIds.length === 0) {
      throw new Error("No requirement handover logs specified for ingestion.");
    }

    return db.$transaction(async (tx) => {
      const store = await tx.inventoryStore.findUnique({
        where: { id: input.storeId },
      });
      if (!store || store.branchId !== ctx.branchId) {
        throw new Error("Store location not found in this branch.");
      }

      const item = await tx.inventoryItem.findUnique({
        where: { id: input.itemId },
      });
      if (!item || item.branchId !== ctx.branchId) {
        throw new Error("Inventory item not found in this branch.");
      }

      let totalIngestedQty = new Prisma.Decimal(0);

      for (const logId of input.handoverLogIds) {
        const log = await tx.inKindHandoverLog.findUnique({
          where: { id: logId },
          include: { studentItem: { include: { blueprintItem: true } } },
        });

        if (!log || log.branchId !== ctx.branchId) {
          throw new Error(`In-kind handover record ${logId} not found in this branch.`);
        }
        if (log.isIngestedIntoInventory) {
          throw new Error(
            `Requirement handover ${log.receiptNumber} has already been ingested into store inventory.`
          );
        }

        const qty = new Prisma.Decimal(log.deltaDelivered);
        totalIngestedQty = totalIngestedQty.add(qty);

        // Mark handover as ingested
        await tx.inKindHandoverLog.update({
          where: { id: log.id },
          data: {
            isIngestedIntoInventory: true,
            ingestedAt: new Date(),
          },
        });
      }

      // Record Stock Mutation with REQUIREMENT_HANDOVER_INFLOW
      const result = await InventoryDAO.recordStockMutation(tx, {
        branchId: ctx.branchId,
        storeId: input.storeId,
        itemId: input.itemId,
        movementType: StockMovementType.REQUIREMENT_HANDOVER_INFLOW,
        quantityDelta: totalIngestedQty,
        referenceType: "REQUIREMENT_HANDOVER",
        reason: `Physical Requirements Ingestion (${input.handoverLogIds.length} batches): ${
          input.notes || ""
        }`,
        performedById: ctx.userId,
      });

      await AuditService.log(
        toTenantContext(ctx),
        "INGEST_REQUIREMENT_HANDOVER",
        "StockMovement",
        result.movement.id,
        JSON.stringify({
          storeId: input.storeId,
          itemId: input.itemId,
          quantity: totalIngestedQty.toString(),
          handoverCount: input.handoverLogIds.length,
        })
      );

      return {
        totalIngestedQty,
        stock: result.stock,
        movement: result.movement,
      };
    });
  }

  // ============================================================================
  // 8. INTERNAL STORE TRANSFERS
  // ============================================================================

  static async transferStock(
    ctx: Context,
    input: {
      sourceStoreId: string;
      destStoreId: string;
      itemId: string;
      quantity: number | string | Prisma.Decimal;
      reason?: string | null;
    }
  ) {
    if (input.sourceStoreId === input.destStoreId) {
      throw new Error("Source and destination stores must be different.");
    }

    const transferQty = new Prisma.Decimal(input.quantity);
    if (transferQty.lessThanOrEqualTo(0)) {
      throw new Error("Transfer quantity must be positive.");
    }

    return db.$transaction(async (tx) => {
      const sourceStore = await tx.inventoryStore.findUnique({
        where: { id: input.sourceStoreId },
      });
      const destStore = await tx.inventoryStore.findUnique({
        where: { id: input.destStoreId },
      });

      if (!sourceStore || sourceStore.branchId !== ctx.branchId) {
        throw new Error("Source store not found in this branch.");
      }
      if (!destStore || destStore.branchId !== ctx.branchId) {
        throw new Error("Destination store not found in this branch.");
      }

      const item = await tx.inventoryItem.findUnique({
        where: { id: input.itemId },
      });
      if (!item || item.branchId !== ctx.branchId) {
        throw new Error("Inventory item not found in this branch.");
      }

      const transferRef = `TRF-${Date.now()}`;

      // 1. Decrement Source Store
      const outResult = await InventoryDAO.recordStockMutation(tx, {
        branchId: ctx.branchId,
        storeId: input.sourceStoreId,
        itemId: input.itemId,
        movementType: StockMovementType.TRANSFER_OUT,
        quantityDelta: transferQty.mul(-1),
        referenceType: "STORE_TRANSFER",
        referenceId: transferRef,
        reason: `Transferred to ${destStore.name}: ${input.reason || ""}`,
        performedById: ctx.userId,
      });

      // 2. Increment Destination Store
      const inResult = await InventoryDAO.recordStockMutation(tx, {
        branchId: ctx.branchId,
        storeId: input.destStoreId,
        itemId: input.itemId,
        movementType: StockMovementType.TRANSFER_IN,
        quantityDelta: transferQty,
        referenceType: "STORE_TRANSFER",
        referenceId: transferRef,
        reason: `Transferred from ${sourceStore.name}: ${input.reason || ""}`,
        performedById: ctx.userId,
      });

      await AuditService.log(
        toTenantContext(ctx),
        "TRANSFER_STOCK",
        "StockMovement",
        transferRef,
        JSON.stringify({
          sourceStore: sourceStore.name,
          destStore: destStore.name,
          itemId: item.id,
          quantity: transferQty.toString(),
        })
      );

      return {
        transferRef,
        sourceStock: outResult.stock,
        destStock: inResult.stock,
      };
    });
  }

  // ============================================================================
  // 9. DEPARTMENTAL REQUISITIONS & ISSUES
  // ============================================================================

  static async createRequisition(
    ctx: Context,
    input: {
      storeId: string;
      departmentId?: string | null;
      requestedById: string;
      purpose: string;
      notes?: string | null;
      items: Array<{
        itemId: string;
        quantityRequested: number | string | Prisma.Decimal;
      }>;
    }
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error("Requisition must contain at least one line item.");
    }
    const cleanPurpose = input.purpose.trim();
    if (!cleanPurpose) {
      throw new Error("Requisition purpose is required.");
    }

    return db.$transaction(async (tx) => {
      const store = await tx.inventoryStore.findUnique({
        where: { id: input.storeId },
      });
      if (!store || store.branchId !== ctx.branchId) {
        throw new Error("Store location not found in this branch.");
      }

      const year = new Date().getFullYear();
      const requisitionNo = await InventoryDAO.getNextSequence(tx, ctx.branchId, "REQ", year);

      const itemsToCreate = [];
      for (const itemInput of input.items) {
        const item = await tx.inventoryItem.findUnique({
          where: { id: itemInput.itemId },
        });
        if (!item || item.branchId !== ctx.branchId) {
          throw new Error(`Inventory item ${itemInput.itemId} not found in this branch.`);
        }

        const qty = new Prisma.Decimal(itemInput.quantityRequested);
        if (qty.lessThanOrEqualTo(0)) {
          throw new Error("Requested quantity must be positive.");
        }

        itemsToCreate.push({
          itemId: item.id,
          quantityRequested: qty,
          quantityIssued: new Prisma.Decimal(0),
          unitCostSnapshot: item.unitCostPrice,
        });
      }

      const requisition = await tx.storeRequisition.create({
        data: {
          branchId: ctx.branchId,
          requisitionNo,
          storeId: input.storeId,
          departmentId: input.departmentId || null,
          requestedById: input.requestedById,
          status: RequisitionStatus.PENDING_APPROVAL,
          purpose: cleanPurpose,
          notes: input.notes?.trim() || null,
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          items: { include: { item: true } },
          store: true,
          department: true,
          requestedBy: true,
        },
      });

      await AuditService.log(
        toTenantContext(ctx),
        "CREATE_STORE_REQUISITION",
        "StoreRequisition",
        requisition.id,
        JSON.stringify({ requisitionNo: requisition.requisitionNo, purpose: requisition.purpose })
      );

      return requisition;
    });
  }

  static async approveRequisition(ctx: Context, id: string) {
    const requisition = await db.storeRequisition.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!requisition) {
      throw new Error("Store requisition not found.");
    }
    if (requisition.status !== RequisitionStatus.PENDING_APPROVAL && requisition.status !== RequisitionStatus.DRAFT) {
      throw new Error(`Cannot approve requisition in status: ${requisition.status}`);
    }

    const updated = await db.storeRequisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.APPROVED,
        approvedById: ctx.userId,
      },
      include: { items: true, requestedBy: true, approvedBy: true },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "APPROVE_STORE_REQUISITION",
      "StoreRequisition",
      updated.id,
      JSON.stringify({ requisitionNo: updated.requisitionNo, approvedBy: ctx.userId })
    );

    return updated;
  }

  static async rejectRequisition(ctx: Context, id: string, rejectionReason: string) {
    const cleanReason = rejectionReason.trim();
    if (!cleanReason) {
      throw new Error("Rejection reason is mandatory.");
    }

    const requisition = await db.storeRequisition.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!requisition) {
      throw new Error("Store requisition not found.");
    }
    if (requisition.status !== RequisitionStatus.PENDING_APPROVAL) {
      throw new Error("Only PENDING_APPROVAL requisitions can be rejected.");
    }

    const updated = await db.storeRequisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.REJECTED,
        rejectionReason: cleanReason,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "REJECT_STORE_REQUISITION",
      "StoreRequisition",
      updated.id,
      JSON.stringify({ requisitionNo: updated.requisitionNo, rejectionReason: cleanReason })
    );

    return updated;
  }

  static async issueRequisition(
    ctx: Context,
    id: string,
    input?: {
      items?: Array<{
        itemId: string;
        quantityIssued: number | string | Prisma.Decimal;
      }>;
    }
  ) {
    return db.$transaction(async (tx) => {
      const requisition = await tx.storeRequisition.findFirst({
        where: { id, branchId: ctx.branchId },
        include: { items: { include: { item: true } }, department: true },
      });
      if (!requisition) {
        throw new Error("Store requisition not found.");
      }
      if (
        requisition.status !== RequisitionStatus.APPROVED &&
        requisition.status !== RequisitionStatus.PARTIALLY_ISSUED
      ) {
        throw new Error(`Cannot issue goods for requisition in status: ${requisition.status}`);
      }

      for (const line of requisition.items) {
        let issueQty: Prisma.Decimal;
        if (input?.items && input.items.length > 0) {
          const matched = input.items.find((i) => i.itemId === line.itemId);
          issueQty = matched ? new Prisma.Decimal(matched.quantityIssued) : new Prisma.Decimal(0);
        } else {
          // Default to issuing remainder of requested quantity
          issueQty = new Prisma.Decimal(line.quantityRequested).minus(line.quantityIssued);
        }

        if (issueQty.greaterThan(0)) {
          const newIssuedTotal = new Prisma.Decimal(line.quantityIssued).add(issueQty);

          // Decrement stock
          await InventoryDAO.recordStockMutation(tx, {
            branchId: ctx.branchId,
            storeId: requisition.storeId,
            itemId: line.itemId,
            movementType: StockMovementType.DEPARTMENT_ISSUE,
            quantityDelta: issueQty.mul(-1),
            referenceType: "REQUISITION",
            referenceId: requisition.requisitionNo,
            reason: `Department Issue (${requisition.department?.name || "General"}): ${
              requisition.purpose
            }`,
            performedById: ctx.userId,
            overrideUnitCost: line.item.unitCostPrice,
          });

          // Update requisition item line
          await tx.requisitionItem.update({
            where: { id: line.id },
            data: {
              quantityIssued: newIssuedTotal,
              unitCostSnapshot: line.item.unitCostPrice,
            },
          });
        }
      }

      // Check if all lines fulfilled
      const refreshedLines = await tx.requisitionItem.findMany({
        where: { requisitionId: requisition.id },
      });
      const isFullyIssued = refreshedLines.every((l) =>
        new Prisma.Decimal(l.quantityIssued).greaterThanOrEqualTo(l.quantityRequested)
      );

      const updated = await tx.storeRequisition.update({
        where: { id: requisition.id },
        data: {
          status: isFullyIssued ? RequisitionStatus.ISSUED : RequisitionStatus.PARTIALLY_ISSUED,
          issuedDate: new Date(),
        },
        include: { items: { include: { item: true } } },
      });

      await AuditService.log(
        toTenantContext(ctx),
        "ISSUE_STORE_REQUISITION",
        "StoreRequisition",
        updated.id,
        JSON.stringify({ requisitionNo: updated.requisitionNo, status: updated.status })
      );

      // Post Requisition Issue to General Ledger (Phase 3.1L)
      try {
        await GLIntegrationService.postStoreRequisition(tx, toTenantContext(ctx), updated.id);
      } catch {
        // Non-blocking fallback
      }

      return updated;
    });
  }

  static async returnRequisitionItems(
    ctx: Context,
    id: string,
    input: {
      items: Array<{
        itemId: string;
        quantityReturned: number | string | Prisma.Decimal;
        reason?: string | null;
      }>;
    }
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error("No items specified for return.");
    }

    return db.$transaction(async (tx) => {
      const requisition = await tx.storeRequisition.findFirst({
        where: { id, branchId: ctx.branchId },
        include: { items: true },
      });
      if (!requisition) {
        throw new Error("Store requisition not found.");
      }

      for (const returnInput of input.items) {
        const line = requisition.items.find((l) => l.itemId === returnInput.itemId);
        if (!line) {
          throw new Error(`Item ${returnInput.itemId} was not issued on this requisition.`);
        }

        const returnQty = new Prisma.Decimal(returnInput.quantityReturned);
        if (returnQty.lessThanOrEqualTo(0)) {
          throw new Error("Return quantity must be positive.");
        }
        if (returnQty.greaterThan(line.quantityIssued)) {
          throw new Error(
            `Return quantity (${returnQty.toString()}) exceeds issued quantity (${line.quantityIssued.toString()}).`
          );
        }

        // Increment stock with DEPARTMENT_RETURN
        await InventoryDAO.recordStockMutation(tx, {
          branchId: ctx.branchId,
          storeId: requisition.storeId,
          itemId: returnInput.itemId,
          movementType: StockMovementType.DEPARTMENT_RETURN,
          quantityDelta: returnQty,
          referenceType: "REQUISITION_RETURN",
          referenceId: requisition.requisitionNo,
          reason: `Department Return: ${returnInput.reason || ""}`,
          performedById: ctx.userId,
          overrideUnitCost: line.unitCostSnapshot,
        });

        // Update requisition line
        await tx.requisitionItem.update({
          where: { id: line.id },
          data: {
            quantityIssued: new Prisma.Decimal(line.quantityIssued).minus(returnQty),
          },
        });
      }

      await AuditService.log(
        toTenantContext(ctx),
        "RETURN_REQUISITION_ITEMS",
        "StoreRequisition",
        requisition.id,
        JSON.stringify({ requisitionNo: requisition.requisitionNo, returnedCount: input.items.length })
      );

      return db.storeRequisition.findUnique({
        where: { id: requisition.id },
        include: { items: { include: { item: true } } },
      });
    });
  }

  static async getRequisition(ctx: Context, id: string) {
    const requisition = await db.storeRequisition.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        items: { include: { item: true } },
        store: true,
        department: true,
        requestedBy: true,
        approvedBy: true,
      },
    });
    if (!requisition) {
      throw new Error("Store requisition not found.");
    }
    return requisition;
  }

  static async listRequisitions(
    ctx: Context,
    filters?: {
      storeId?: string;
      departmentId?: string;
      status?: RequisitionStatus;
    }
  ) {
    const where: Prisma.StoreRequisitionWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.storeId ? { storeId: filters.storeId } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    };

    return db.storeRequisition.findMany({
      where,
      include: {
        items: { include: { item: true } },
        store: true,
        department: true,
        requestedBy: true,
        approvedBy: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ============================================================================
  // 10. STUDENT STORE SALES & UNIFORM BILLING
  // ============================================================================

  static async recordStudentStoreSale(
    ctx: Context,
    input: {
      studentId: string;
      storeId: string;
      academicYearId: string;
      termId?: string | null;
      isInvoiceCharge: boolean;
      paymentMethod?: PaymentMethod;
      invoiceId?: string | null;
      feeTypeId?: string | null;
      notes?: string | null;
      items: Array<{
        itemId: string;
        quantity: number | string | Prisma.Decimal;
        unitPrice?: number | string | Prisma.Decimal | null;
      }>;
    }
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error("Student store sale must contain at least one line item.");
    }

    return db.$transaction(async (tx) => {
      // 1. Verify Student and Store
      const student = await tx.student.findUnique({
        where: { id: input.studentId },
      });
      if (!student || student.branchId !== ctx.branchId) {
        throw new Error("Student not found in this branch.");
      }

      const store = await tx.inventoryStore.findUnique({
        where: { id: input.storeId },
      });
      if (!store || store.branchId !== ctx.branchId) {
        throw new Error("Store location not found in this branch.");
      }

      const year = new Date().getFullYear();
      const saleReceiptNo = await InventoryDAO.getNextSequence(tx, ctx.branchId, "SALE", year);

      let totalAmount = new Prisma.Decimal(0);
      const saleItemsToCreate = [];

      // 2. Validate Items, Compute Totals, and Decrement Stock
      for (const itemInput of input.items) {
        const item = await tx.inventoryItem.findUnique({
          where: { id: itemInput.itemId },
        });
        if (!item || item.branchId !== ctx.branchId) {
          throw new Error(`Inventory item ${itemInput.itemId} not found in this branch.`);
        }

        const qty = new Prisma.Decimal(itemInput.quantity);
        if (qty.lessThanOrEqualTo(0)) {
          throw new Error("Sale quantity must be positive.");
        }

        const unitPrice =
          itemInput.unitPrice !== undefined && itemInput.unitPrice !== null
            ? new Prisma.Decimal(itemInput.unitPrice)
            : item.sellingPrice || item.unitCostPrice;

        if (unitPrice.isNegative()) {
          throw new Error("Item unit selling price cannot be negative.");
        }

        const lineTotal = qty.mul(unitPrice);
        totalAmount = totalAmount.add(lineTotal);

        // Deduct Stock immediately
        await InventoryDAO.recordStockMutation(tx, {
          branchId: ctx.branchId,
          storeId: input.storeId,
          itemId: item.id,
          movementType: StockMovementType.STUDENT_SALE_OUTFLOW,
          quantityDelta: qty.mul(-1),
          referenceType: "STUDENT_SALE",
          referenceId: saleReceiptNo,
          reason: `Student Store Sale (${student.firstName} ${student.lastName}): ${saleReceiptNo}`,
          performedById: ctx.userId,
          overrideUnitCost: item.unitCostPrice,
        });

        saleItemsToCreate.push({
          itemId: item.id,
          itemNameSnapshot: item.name,
          quantity: qty,
          unitPrice,
          totalPrice: lineTotal,
        });
      }

      let invoiceItemId: string | null = null;
      let paymentId: string | null = null;

      // 3. Financial Handling
      if (input.isInvoiceCharge) {
        // Find or use provided active term invoice
        let targetInvoice = null;
        if (input.invoiceId) {
          targetInvoice = await tx.invoice.findUnique({
            where: { id: input.invoiceId },
          });
        } else {
          targetInvoice = await tx.invoice.findFirst({
            where: {
              studentId: input.studentId,
              branchId: ctx.branchId,
              academicYearId: input.academicYearId,
              termId: input.termId || undefined,
            },
            orderBy: { createdAt: "desc" },
          });
        }

        if (!targetInvoice) {
          throw new Error(
            "Cannot bill on account: No existing term invoice found for this student."
          );
        }

        // Add InvoiceItem
        const createdInvoiceItem = await tx.invoiceItem.create({
          data: {
            invoiceId: targetInvoice.id,
            feeTypeId: input.feeTypeId || null,
            feeTypeName: "Store / Uniform Purchase",
            description: `Store Purchase: ${saleReceiptNo}`,
            unitAmount: totalAmount,
            quantity: 1,
            discount: new Prisma.Decimal(0),
            lineTotal: totalAmount,
          },
        });
        invoiceItemId = createdInvoiceItem.id;

        // Post Subledger Debit
        await LedgerDAO.postEntry(tx, {
          branchId: ctx.branchId,
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          invoiceId: targetInvoice.id,
          entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
          direction: LedgerDirection.DEBIT,
          amount: totalAmount,
          referenceType: "STORE_SALE",
          referenceId: saleReceiptNo,
          description: `Student Store Purchase: ${saleReceiptNo}`,
          createdById: ctx.userId,
        });
      } else {
        // Immediate Cash / MoMo / Card Payment
        const tenantCtx = toTenantContext(ctx);
        const paymentResult = await PaymentDAO.recordPayment(tenantCtx, {
          studentId: input.studentId,
          amount: totalAmount,
          paymentMethod: input.paymentMethod || PaymentMethod.CASH,
          notes: `Store Sale: ${saleReceiptNo}`,
          idempotencyKey: `sale-pay-${ctx.branchId}-${saleReceiptNo}`,
        });
        paymentId = (paymentResult as { id?: string; payment?: { id?: string } }).id || (paymentResult as { id?: string; payment?: { id?: string } }).payment?.id || null;
      }

      // 4. Create StudentStoreSale Record
      const sale = await tx.studentStoreSale.create({
        data: {
          branchId: ctx.branchId,
          saleReceiptNo,
          studentId: input.studentId,
          storeId: input.storeId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          totalAmount,
          invoiceItemId,
          paymentId,
          recordedById: ctx.userId,
          notes: input.notes?.trim() || null,
          items: {
            create: saleItemsToCreate,
          },
        },
        include: {
          items: { include: { item: true } },
          student: true,
          store: true,
          payment: true,
        },
      });

      await AuditService.log(
        toTenantContext(ctx),
        "RECORD_STUDENT_STORE_SALE",
        "StudentStoreSale",
        sale.id,
        JSON.stringify({
          saleReceiptNo: sale.saleReceiptNo,
          totalAmount: sale.totalAmount.toString(),
          isInvoiceCharge: input.isInvoiceCharge,
        })
      );

      // Post Store Sale to General Ledger (Phase 3.1L)
      try {
        await GLIntegrationService.postStoreSale(tx, toTenantContext(ctx), sale.id);
      } catch {
        // Non-blocking fallback
      }

      return sale;
    });
  }

  static async processStudentSaleReturn(
    ctx: Context,
    saleId: string,
    input: {
      items: Array<{
        itemId: string;
        quantity: number | string | Prisma.Decimal;
        returnReason?: string | null;
      }>;
    }
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error("No items specified for sale return.");
    }

    return db.$transaction(async (tx) => {
      const sale = await tx.studentStoreSale.findFirst({
        where: { id: saleId, branchId: ctx.branchId },
        include: { items: { include: { item: true } }, student: true },
      });
      if (!sale) {
        throw new Error("Student store sale record not found.");
      }

      let totalRefundAmount = new Prisma.Decimal(0);

      for (const returnInput of input.items) {
        const line = sale.items.find((l) => l.itemId === returnInput.itemId);
        if (!line) {
          throw new Error(`Item ${returnInput.itemId} was not part of this sale.`);
        }

        const returnQty = new Prisma.Decimal(returnInput.quantity);
        if (returnQty.lessThanOrEqualTo(0)) {
          throw new Error("Return quantity must be positive.");
        }
        if (returnQty.greaterThan(line.quantity)) {
          throw new Error(`Return quantity exceeds sold quantity.`);
        }

        const lineRefund = returnQty.mul(line.unitPrice);
        totalRefundAmount = totalRefundAmount.add(lineRefund);

        // Restore Stock
        await InventoryDAO.recordStockMutation(tx, {
          branchId: ctx.branchId,
          storeId: sale.storeId,
          itemId: returnInput.itemId,
          movementType: StockMovementType.STUDENT_SALE_RETURN,
          quantityDelta: returnQty,
          referenceType: "STUDENT_SALE_RETURN",
          referenceId: sale.saleReceiptNo,
          reason: `Student Sale Return (${sale.student.firstName} ${sale.student.lastName}): ${
            returnInput.returnReason || ""
          }`,
          performedById: ctx.userId,
          overrideUnitCost: line.item.unitCostPrice,
        });
      }

      // Financial Credit Adjustment if on-account
      if (sale.invoiceItemId) {
        await LedgerDAO.postEntry(tx, {
          branchId: ctx.branchId,
          studentId: sale.studentId,
          academicYearId: sale.academicYearId,
          termId: sale.termId || null,
          entryType: LedgerEntryType.CREDIT_ADJUSTMENT,
          direction: LedgerDirection.CREDIT,
          amount: totalRefundAmount,
          referenceType: "STORE_SALE_RETURN",
          referenceId: sale.saleReceiptNo,
          description: `Store Sale Return Credit: ${sale.saleReceiptNo}`,
          createdById: ctx.userId,
        });
      }

      const updated = await tx.studentStoreSale.update({
        where: { id: sale.id },
        data: {
          isReturned: true,
          returnReason: input.items.map((i) => i.returnReason).filter(Boolean).join("; ") || "Returned",
          returnedAt: new Date(),
        },
      });

      await AuditService.log(
        toTenantContext(ctx),
        "RETURN_STUDENT_STORE_SALE",
        "StudentStoreSale",
        updated.id,
        JSON.stringify({ saleReceiptNo: sale.saleReceiptNo, refundAmount: totalRefundAmount.toString() })
      );

      return updated;
    });
  }

  static async getStudentStoreSale(ctx: Context, id: string) {
    const sale = await db.studentStoreSale.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        student: true,
        store: true,
        items: { include: { item: true } },
        payment: true,
        invoiceItem: true,
        recordedBy: true,
      },
    });
    if (!sale) {
      throw new Error("Student store sale record not found.");
    }
    return sale;
  }

  static async listStudentStoreSales(
    ctx: Context,
    filters?: {
      studentId?: string;
      storeId?: string;
      academicYearId?: string;
      termId?: string;
      startDate?: Date | string;
      endDate?: Date | string;
    }
  ) {
    const where: Prisma.StudentStoreSaleWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.studentId ? { studentId: filters.studentId } : {}),
      ...(filters?.storeId ? { storeId: filters.storeId } : {}),
      ...(filters?.academicYearId ? { academicYearId: filters.academicYearId } : {}),
      ...(filters?.termId ? { termId: filters.termId } : {}),
      ...(filters?.startDate || filters?.endDate
        ? {
            saleDate: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
    };

    return db.studentStoreSale.findMany({
      where,
      include: {
        student: true,
        store: true,
        items: { include: { item: true } },
        payment: true,
        recordedBy: true,
      },
      orderBy: { saleDate: "desc" },
    });
  }

  // ============================================================================
  // 11. PHYSICAL STOCKTAKES & WRITE-OFFS
  // ============================================================================

  static async recordStocktakeAdjustment(
    ctx: Context,
    input: {
      storeId: string;
      itemId: string;
      physicalCount: number | string | Prisma.Decimal;
      reason: string;
    }
  ) {
    const cleanReason = input.reason.trim();
    if (!cleanReason) {
      throw new Error("Stocktake adjustment justification/reason is required.");
    }

    const physicalDecimal = new Prisma.Decimal(input.physicalCount);
    if (physicalDecimal.isNegative()) {
      throw new Error("Physical count cannot be negative.");
    }

    return db.$transaction(async (tx) => {
      const store = await tx.inventoryStore.findUnique({
        where: { id: input.storeId },
      });
      if (!store || store.branchId !== ctx.branchId) {
        throw new Error("Store location not found in this branch.");
      }

      const item = await tx.inventoryItem.findUnique({
        where: { id: input.itemId },
      });
      if (!item || item.branchId !== ctx.branchId) {
        throw new Error("Inventory item not found in this branch.");
      }

      let stock = await tx.inventoryStoreStock.findUnique({
        where: {
          storeId_itemId: { storeId: input.storeId, itemId: input.itemId },
        },
      });

      if (!stock) {
        stock = await tx.inventoryStoreStock.create({
          data: {
            branchId: ctx.branchId,
            storeId: input.storeId,
            itemId: input.itemId,
            quantityOnHand: new Prisma.Decimal(0),
            quantityReserved: new Prisma.Decimal(0),
          },
        });
      }

      const currentOnHand = new Prisma.Decimal(stock.quantityOnHand);
      const discrepancyDelta = physicalDecimal.minus(currentOnHand);

      if (discrepancyDelta.isZero()) {
        await tx.inventoryStoreStock.update({
          where: { id: stock.id },
          data: { lastStocktakeAt: new Date() },
        });
        return { stock, delta: discrepancyDelta, message: "Physical count matches system stock exactly." };
      }

      const movementType = discrepancyDelta.isPositive()
        ? StockMovementType.STOCKTAKE_SURPLUS
        : StockMovementType.STOCKTAKE_DEFICIT;

      // Apply mutation
      const result = await InventoryDAO.recordStockMutation(tx, {
        branchId: ctx.branchId,
        storeId: input.storeId,
        itemId: input.itemId,
        movementType,
        quantityDelta: discrepancyDelta,
        referenceType: "STOCKTAKE",
        reason: `Physical Stocktake Audit: ${cleanReason}`,
        performedById: ctx.userId,
        allowNegative: true,
      });

      await tx.inventoryStoreStock.update({
        where: { id: stock.id },
        data: { lastStocktakeAt: new Date() },
      });

      await AuditService.log(
        toTenantContext(ctx),
        "RECORD_STOCKTAKE_ADJUSTMENT",
        "StockMovement",
        result.movement.id,
        JSON.stringify({
          storeId: input.storeId,
          itemId: input.itemId,
          previous: currentOnHand.toString(),
          physical: physicalDecimal.toString(),
          delta: discrepancyDelta.toString(),
          reason: cleanReason,
        })
      );

      return {
        stock: result.stock,
        delta: discrepancyDelta,
        movement: result.movement,
      };
    });
  }

  static async recordDamageOrLossWriteoff(
    ctx: Context,
    input: {
      storeId: string;
      itemId: string;
      quantity: number | string | Prisma.Decimal;
      isExpiration?: boolean;
      reason: string;
    }
  ) {
    const cleanReason = input.reason.trim();
    if (!cleanReason) {
      throw new Error("Write-off justification reason is required.");
    }

    const qty = new Prisma.Decimal(input.quantity);
    if (qty.lessThanOrEqualTo(0)) {
      throw new Error("Write-off quantity must be positive.");
    }

    return db.$transaction(async (tx) => {
      const movementType = input.isExpiration
        ? StockMovementType.EXPIRATION_WRITEOFF
        : StockMovementType.DAMAGE_WRITEOFF;

      const result = await InventoryDAO.recordStockMutation(tx, {
        branchId: ctx.branchId,
        storeId: input.storeId,
        itemId: input.itemId,
        movementType,
        quantityDelta: qty.mul(-1),
        referenceType: "WRITEOFF",
        reason: `Write-off (${movementType}): ${cleanReason}`,
        performedById: ctx.userId,
      });

      await AuditService.log(
        toTenantContext(ctx),
        "RECORD_DAMAGE_WRITEOFF",
        "StockMovement",
        result.movement.id,
        JSON.stringify({
          storeId: input.storeId,
          itemId: input.itemId,
          quantity: qty.toString(),
          type: movementType,
          reason: cleanReason,
        })
      );

      return result;
    });
  }

  // ============================================================================
  // 12. REPORTING & ANALYTICS SUITE
  // ============================================================================

  static async getStockValuationReport(
    ctx: Context,
    filters?: {
      storeId?: string;
      category?: InventoryItemCategory;
    }
  ) {
    const where: Prisma.InventoryStoreStockWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.storeId ? { storeId: filters.storeId } : {}),
      ...(filters?.category ? { item: { category: filters.category } } : {}),
    };

    const stocks = await db.inventoryStoreStock.findMany({
      where,
      include: {
        store: true,
        item: true,
      },
    });

    let totalValuation = new Prisma.Decimal(0);
    let totalItemsCount = 0;
    let totalStockUnits = new Prisma.Decimal(0);

    const rows = stocks.map((s) => {
      const onHand = new Prisma.Decimal(s.quantityOnHand);
      const unitCost = new Prisma.Decimal(s.item.unitCostPrice);
      const lineValuation = onHand.mul(unitCost);

      totalValuation = totalValuation.add(lineValuation);
      totalStockUnits = totalStockUnits.add(onHand);
      totalItemsCount += 1;

      return {
        storeId: s.storeId,
        storeName: s.store.name,
        itemId: s.itemId,
        itemCode: s.item.code,
        itemName: s.item.name,
        category: s.item.category,
        unitOfMeasure: s.item.unitOfMeasure,
        quantityOnHand: onHand.toNumber(),
        unitCostPrice: unitCost.toNumber(),
        totalValuation: lineValuation.toNumber(),
        isLowStock: onHand.lessThanOrEqualTo(s.item.reorderLevel),
      };
    });

    return {
      summary: {
        totalValuation: totalValuation.toNumber(),
        totalItemsCount,
        totalStockUnits: totalStockUnits.toNumber(),
      },
      rows,
    };
  }

  static async getLowStockReport(ctx: Context, filters?: { storeId?: string }) {
    const items = await this.listItems(ctx, {
      storeId: filters?.storeId,
      lowStockOnly: true,
      isActive: true,
    });

    return items.map((item) => {
      const totalOnHand = item.stocks.reduce(
        (acc, s) => acc.add(s.quantityOnHand),
        new Prisma.Decimal(0)
      );

      return {
        itemId: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unitOfMeasure: item.unitOfMeasure,
        reorderLevel: item.reorderLevel.toNumber(),
        totalOnHand: totalOnHand.toNumber(),
        deficit: item.reorderLevel.minus(totalOnHand).toNumber(),
        unitCostPrice: item.unitCostPrice.toNumber(),
        storesBreakdown: item.stocks.map((s) => ({
          storeId: s.storeId,
          storeName: s.store.name,
          quantityOnHand: new Prisma.Decimal(s.quantityOnHand).toNumber(),
        })),
      };
    });
  }

  static async getDepartmentConsumptionReport(
    ctx: Context,
    filters?: {
      departmentId?: string;
      startDate?: Date | string;
      endDate?: Date | string;
    }
  ) {
    const where: Prisma.StoreRequisitionWhereInput = {
      branchId: ctx.branchId,
      status: { in: [RequisitionStatus.ISSUED, RequisitionStatus.PARTIALLY_ISSUED] },
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.startDate || filters?.endDate
        ? {
            issuedDate: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
    };

    const requisitions = await db.storeRequisition.findMany({
      where,
      include: {
        department: true,
        items: { include: { item: true } },
      },
    });

    let grandTotalConsumption = new Prisma.Decimal(0);
    const departmentMap: Record<
      string,
      {
        departmentName: string;
        totalCost: Prisma.Decimal;
        itemsIssued: Record<string, { itemName: string; quantity: Prisma.Decimal; cost: Prisma.Decimal }>;
      }
    > = {};

    for (const req of requisitions) {
      const deptName = req.department?.name || "Unassigned / General";
      if (!departmentMap[deptName]) {
        departmentMap[deptName] = {
          departmentName: deptName,
          totalCost: new Prisma.Decimal(0),
          itemsIssued: {},
        };
      }

      for (const line of req.items) {
        const qty = new Prisma.Decimal(line.quantityIssued);
        const cost = qty.mul(line.unitCostSnapshot);

        grandTotalConsumption = grandTotalConsumption.add(cost);
        departmentMap[deptName].totalCost = departmentMap[deptName].totalCost.add(cost);

        if (!departmentMap[deptName].itemsIssued[line.itemId]) {
          departmentMap[deptName].itemsIssued[line.itemId] = {
            itemName: line.item.name,
            quantity: new Prisma.Decimal(0),
            cost: new Prisma.Decimal(0),
          };
        }
        departmentMap[deptName].itemsIssued[line.itemId].quantity =
          departmentMap[deptName].itemsIssued[line.itemId].quantity.add(qty);
        departmentMap[deptName].itemsIssued[line.itemId].cost =
          departmentMap[deptName].itemsIssued[line.itemId].cost.add(cost);
      }
    }

    return {
      grandTotalConsumption: grandTotalConsumption.toNumber(),
      departments: Object.values(departmentMap).map((d) => ({
        departmentName: d.departmentName,
        totalCost: d.totalCost.toNumber(),
        items: Object.values(d.itemsIssued).map((i) => ({
          itemName: i.itemName,
          quantity: i.quantity.toNumber(),
          cost: i.cost.toNumber(),
        })),
      })),
    };
  }

  static async getStudentStoreSalesReport(
    ctx: Context,
    filters?: {
      academicYearId?: string;
      termId?: string;
      startDate?: Date | string;
      endDate?: Date | string;
    }
  ) {
    const sales = await this.listStudentStoreSales(ctx, filters);

    let totalRevenue = new Prisma.Decimal(0);
    let totalCostOfGoodsSold = new Prisma.Decimal(0);

    const rows = sales.map((sale) => {
      let saleCost = new Prisma.Decimal(0);
      for (const item of sale.items) {
        saleCost = saleCost.add(new Prisma.Decimal(item.quantity).mul(item.item.unitCostPrice));
      }

      const revenue = new Prisma.Decimal(sale.totalAmount);
      const grossProfit = revenue.minus(saleCost);

      totalRevenue = totalRevenue.add(revenue);
      totalCostOfGoodsSold = totalCostOfGoodsSold.add(saleCost);

      return {
        saleId: sale.id,
        saleReceiptNo: sale.saleReceiptNo,
        studentName: `${sale.student.firstName} ${sale.student.lastName}`,
        admissionNo: sale.student.admissionNo,
        saleDate: sale.saleDate,
        totalAmount: revenue.toNumber(),
        costOfGoodsSold: saleCost.toNumber(),
        grossProfit: grossProfit.toNumber(),
        marginPercent: revenue.isZero() ? 0 : grossProfit.div(revenue).mul(100).toNumber(),
        isReturned: sale.isReturned,
      };
    });

    const totalGrossProfit = totalRevenue.minus(totalCostOfGoodsSold);
    const overallMargin = totalRevenue.isZero()
      ? 0
      : totalGrossProfit.div(totalRevenue).mul(100).toNumber();

    return {
      summary: {
        totalSalesCount: sales.length,
        totalRevenue: totalRevenue.toNumber(),
        totalCostOfGoodsSold: totalCostOfGoodsSold.toNumber(),
        totalGrossProfit: totalGrossProfit.toNumber(),
        overallMarginPercent: overallMargin,
      },
      rows,
    };
  }

  static async getStockMovementLedger(
    ctx: Context,
    filters?: {
      storeId?: string;
      itemId?: string;
      movementType?: StockMovementType;
      startDate?: Date | string;
      endDate?: Date | string;
      limit?: number;
    }
  ) {
    const where: Prisma.StockMovementWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.storeId ? { storeId: filters.storeId } : {}),
      ...(filters?.itemId ? { itemId: filters.itemId } : {}),
      ...(filters?.movementType ? { movementType: filters.movementType } : {}),
      ...(filters?.startDate || filters?.endDate
        ? {
            createdAt: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
    };

    return db.stockMovement.findMany({
      where,
      include: {
        store: true,
        item: true,
        performedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 100,
    });
  }
}
