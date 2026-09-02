-- CreateEnum
CREATE TYPE "StoreLocationType" AS ENUM ('CENTRAL_STORE', 'BURSAR_UNIFORM_STORE', 'KITCHEN_STORE', 'SCIENCE_LAB_STORE', 'LIBRARY_STORE', 'MAINTENANCE_WORKSHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryItemCategory" AS ENUM ('UNIFORM', 'SCHOLASTIC_TEXTBOOK', 'STATIONERY_OFFICE', 'FOOD_RATIONS', 'LAB_CHEMICAL_APPARATUS', 'BOARDING_SUPPLIES', 'CLEANING_HYGIENE', 'SPORTS_EQUIPMENT', 'MAINTENANCE_TOOLS', 'GENERAL');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PROCUREMENT_RECEIPT', 'REQUIREMENT_HANDOVER_INFLOW', 'TRANSFER_IN', 'TRANSFER_OUT', 'DEPARTMENT_ISSUE', 'DEPARTMENT_RETURN', 'STUDENT_SALE_OUTFLOW', 'STUDENT_SALE_RETURN', 'STOCKTAKE_SURPLUS', 'STOCKTAKE_DEFICIT', 'DAMAGE_WRITEOFF', 'EXPIRATION_WRITEOFF', 'VENDOR_RETURN');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'PARTIALLY_ISSUED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "InKindHandoverLog" ADD COLUMN     "ingestedAt" TIMESTAMP(3),
ADD COLUMN     "isIngestedIntoInventory" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InventoryStore" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storeType" "StoreLocationType" NOT NULL DEFAULT 'CENTRAL_STORE',
    "location" TEXT,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InventoryItemCategory" NOT NULL DEFAULT 'GENERAL',
    "unitOfMeasure" TEXT NOT NULL,
    "unitCostPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(12,2),
    "reorderLevel" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStoreStock" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quantityReserved" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastStocktakeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStoreStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySupplier" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "taxIdNumber" TEXT,
    "paymentTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "rejectionReason" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "quantityOrdered" DECIMAL(12,2) NOT NULL,
    "quantityReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCostPrice" DECIMAL(12,2) NOT NULL,
    "lineTotalCost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceivedNote" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "poId" TEXT,
    "supplierId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "expenseId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierInvoiceRef" TEXT,
    "supplierNameSnapshot" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "receivedById" TEXT NOT NULL,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceivedNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceivedItem" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "quantityReceived" DECIMAL(12,2) NOT NULL,
    "unitCostPrice" DECIMAL(12,2) NOT NULL,
    "lineTotalCost" DECIMAL(12,2) NOT NULL,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "GoodsReceivedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreRequisition" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requisitionNo" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "purpose" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionItem" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityRequested" DECIMAL(12,2) NOT NULL,
    "quantityIssued" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCostSnapshot" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "RequisitionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStoreSale" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "saleReceiptNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "invoiceItemId" TEXT,
    "paymentId" TEXT,
    "recordedById" TEXT NOT NULL,
    "isReturned" BOOLEAN NOT NULL DEFAULT false,
    "returnReason" TEXT,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentStoreSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStoreSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "StudentStoreSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantityDelta" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "unitCostAtMovement" DECIMAL(12,2) NOT NULL,
    "totalValuation" DECIMAL(14,2) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT,
    "reason" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryStore_branchId_storeType_isActive_idx" ON "InventoryStore"("branchId", "storeType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStore_branchId_code_key" ON "InventoryStore"("branchId", "code");

-- CreateIndex
CREATE INDEX "InventoryItem_branchId_category_isActive_idx" ON "InventoryItem"("branchId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_branchId_code_key" ON "InventoryItem"("branchId", "code");

-- CreateIndex
CREATE INDEX "InventoryStoreStock_branchId_storeId_idx" ON "InventoryStoreStock"("branchId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStoreStock_storeId_itemId_key" ON "InventoryStoreStock"("storeId", "itemId");

-- CreateIndex
CREATE INDEX "InventorySupplier_branchId_isActive_idx" ON "InventorySupplier"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySupplier_branchId_supplierCode_key" ON "InventorySupplier"("branchId", "supplierCode");

-- CreateIndex
CREATE INDEX "PurchaseOrder_branchId_status_idx" ON "PurchaseOrder"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_branchId_poNumber_key" ON "PurchaseOrder"("branchId", "poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_poId_idx" ON "PurchaseOrderItem"("poId");

-- CreateIndex
CREATE INDEX "GoodsReceivedNote_branchId_supplierId_deliveryDate_idx" ON "GoodsReceivedNote"("branchId", "supplierId", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceivedNote_branchId_grnNumber_key" ON "GoodsReceivedNote"("branchId", "grnNumber");

-- CreateIndex
CREATE INDEX "GoodsReceivedItem_grnId_idx" ON "GoodsReceivedItem"("grnId");

-- CreateIndex
CREATE INDEX "StoreRequisition_branchId_status_idx" ON "StoreRequisition"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StoreRequisition_branchId_requisitionNo_key" ON "StoreRequisition"("branchId", "requisitionNo");

-- CreateIndex
CREATE INDEX "RequisitionItem_requisitionId_idx" ON "RequisitionItem"("requisitionId");

-- CreateIndex
CREATE INDEX "StudentStoreSale_branchId_studentId_saleDate_idx" ON "StudentStoreSale"("branchId", "studentId", "saleDate");

-- CreateIndex
CREATE UNIQUE INDEX "StudentStoreSale_branchId_saleReceiptNo_key" ON "StudentStoreSale"("branchId", "saleReceiptNo");

-- CreateIndex
CREATE INDEX "StudentStoreSaleItem_saleId_idx" ON "StudentStoreSaleItem"("saleId");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_storeId_itemId_createdAt_idx" ON "StockMovement"("branchId", "storeId", "itemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_movementType_idx" ON "StockMovement"("branchId", "movementType");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySequence_branchId_type_year_key" ON "InventorySequence"("branchId", "type", "year");

-- AddForeignKey
ALTER TABLE "InventoryStore" ADD CONSTRAINT "InventoryStore_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStore" ADD CONSTRAINT "InventoryStore_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStoreStock" ADD CONSTRAINT "InventoryStoreStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStoreStock" ADD CONSTRAINT "InventoryStoreStock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStoreStock" ADD CONSTRAINT "InventoryStoreStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySupplier" ADD CONSTRAINT "InventorySupplier_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedItem" ADD CONSTRAINT "GoodsReceivedItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceivedNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedItem" ADD CONSTRAINT "GoodsReceivedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequisition" ADD CONSTRAINT "StoreRequisition_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequisition" ADD CONSTRAINT "StoreRequisition_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequisition" ADD CONSTRAINT "StoreRequisition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequisition" ADD CONSTRAINT "StoreRequisition_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequisition" ADD CONSTRAINT "StoreRequisition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionItem" ADD CONSTRAINT "RequisitionItem_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "StoreRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionItem" ADD CONSTRAINT "RequisitionItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSale" ADD CONSTRAINT "StudentStoreSale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSale" ADD CONSTRAINT "StudentStoreSale_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSale" ADD CONSTRAINT "StudentStoreSale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSale" ADD CONSTRAINT "StudentStoreSale_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSale" ADD CONSTRAINT "StudentStoreSale_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSale" ADD CONSTRAINT "StudentStoreSale_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSale" ADD CONSTRAINT "StudentStoreSale_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSale" ADD CONSTRAINT "StudentStoreSale_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSaleItem" ADD CONSTRAINT "StudentStoreSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StudentStoreSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStoreSaleItem" ADD CONSTRAINT "StudentStoreSaleItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySequence" ADD CONSTRAINT "InventorySequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "StudentTransportSubscription_branchId_studentId_academicYearId_" RENAME TO "StudentTransportSubscription_branchId_studentId_academicYea_key";

-- RenameIndex
ALTER INDEX "VehicleRouteAssignment_branchId_routeId_vehicleId_academicYearI" RENAME TO "VehicleRouteAssignment_branchId_routeId_vehicleId_academicY_key";

