-- CreateEnum
CREATE TYPE "AssetCategoryType" AS ENUM ('LAND_GROUNDS', 'BUILDINGS_STRUCTURES', 'MOTOR_VEHICLES_FLEET', 'FURNITURE_FIXTURES', 'COMPUTERS_ICT_EQUIPMENT', 'MACHINERY_GENERATORS', 'LABORATORY_APPARATUS', 'CAPITAL_WORK_IN_PROGRESS', 'OTHER_FIXED_ASSETS');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'REDUCING_BALANCE', 'NONE');

-- CreateEnum
CREATE TYPE "DepreciationFrequency" AS ENUM ('MONTHLY', 'TERMLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'IN_REPAIR', 'FULLY_DEPRECIATED', 'DISPOSED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'UNUSABLE');

-- CreateEnum
CREATE TYPE "CapitalizationSource" AS ENUM ('DIRECT_PURCHASE', 'PROCUREMENT_GRN', 'FLEET_VEHICLE', 'INVENTORY_CONVERSION', 'OPENING_BALANCE', 'DONATION_GRANT');

-- CreateEnum
CREATE TYPE "DepreciationRunStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetDisposalType" AS ENUM ('SALE', 'SCRAP', 'INSURANCE_LOSS', 'DONATION_OUT', 'WRITE_OFF');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CashbookMovementType" ADD VALUE 'CAPITAL_EXPENDITURE';
ALTER TYPE "CashbookMovementType" ADD VALUE 'ASSET_SALE_PROCEEDS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalType" ADD VALUE 'CAPITAL_PURCHASE';
ALTER TYPE "JournalType" ADD VALUE 'DEPRECIATION';
ALTER TYPE "JournalType" ADD VALUE 'ASSET_DISPOSAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SystemControlRole" ADD VALUE 'FIXED_ASSET_PPE_CONTROL';
ALTER TYPE "SystemControlRole" ADD VALUE 'ACCUMULATED_DEPRECIATION_CONTROL';
ALTER TYPE "SystemControlRole" ADD VALUE 'DEPRECIATION_EXPENSE_CONTROL';

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryType" "AssetCategoryType" NOT NULL DEFAULT 'OTHER_FIXED_ASSETS',
    "description" TEXT,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "usefulLifeMonths" INTEGER NOT NULL DEFAULT 36,
    "annualDepreciationRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "defaultSalvagePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "glAssetAccountId" TEXT,
    "glDepreciationAccountId" TEXT,
    "glAccumDeprecAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetLocation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "building" TEXT,
    "roomNumber" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetItem" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "locationId" TEXT,
    "custodianId" TEXT,
    "serialNumber" TEXT,
    "modelNumber" TEXT,
    "manufacturer" TEXT,
    "barcode" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "capitalizationDate" TIMESTAMP(3) NOT NULL,
    "warrantyExpiry" TIMESTAMP(3),
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "capitalizationSource" "CapitalizationSource" NOT NULL DEFAULT 'DIRECT_PURCHASE',
    "acquisitionCost" DECIMAL(12,2) NOT NULL,
    "salvageValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depreciableBasis" DECIMAL(12,2) NOT NULL,
    "accumulatedDepreciation" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netBookValue" DECIMAL(12,2) NOT NULL,
    "lastDepreciationDate" TIMESTAMP(3),
    "depreciationMethod" "DepreciationMethod",
    "usefulLifeMonths" INTEGER,
    "annualDepreciationRate" DECIMAL(5,2),
    "supplierId" TEXT,
    "grnId" TEXT,
    "grnItemId" TEXT,
    "transportVehicleId" TEXT,
    "treasuryAccountId" TEXT,
    "capitalizationJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciationRun" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "status" "DepreciationRunStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAssetsCount" INTEGER NOT NULL DEFAULT 0,
    "totalDepreciationAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetDepreciationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciationLine" (
    "id" TEXT NOT NULL,
    "depreciationRunId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "openingBookValue" DECIMAL(12,2) NOT NULL,
    "depreciationAmount" DECIMAL(12,2) NOT NULL,
    "closingBookValue" DECIMAL(12,2) NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL,
    "rateApplied" DECIMAL(5,2) NOT NULL,
    "activeDaysInPeriod" INTEGER NOT NULL DEFAULT 30,
    "totalDaysInPeriod" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDepreciationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDisposal" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "disposalDate" TIMESTAMP(3) NOT NULL,
    "disposalType" "AssetDisposalType" NOT NULL,
    "disposalProceeds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costAtDisposal" DECIMAL(12,2) NOT NULL,
    "accumDeprecAtDisposal" DECIMAL(12,2) NOT NULL,
    "netBookValueAtDisposal" DECIMAL(12,2) NOT NULL,
    "gainOrLossAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "buyerDetails" TEXT,
    "treasuryAccountId" TEXT,
    "cashbookMovementId" TEXT,
    "journalEntryId" TEXT,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDisposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetVerificationLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT NOT NULL,
    "condition" "AssetCondition" NOT NULL,
    "locationId" TEXT,
    "custodianId" TEXT,
    "isMissing" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMovementLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "fromCustodianId" TEXT,
    "toCustodianId" TEXT,
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "transferredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMovementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextVal" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetCategory_branchId_categoryType_idx" ON "AssetCategory"("branchId", "categoryType");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_branchId_code_key" ON "AssetCategory"("branchId", "code");

-- CreateIndex
CREATE INDEX "AssetLocation_branchId_idx" ON "AssetLocation"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLocation_branchId_code_key" ON "AssetLocation"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AssetItem_transportVehicleId_key" ON "AssetItem"("transportVehicleId");

-- CreateIndex
CREATE INDEX "AssetItem_branchId_status_idx" ON "AssetItem"("branchId", "status");

-- CreateIndex
CREATE INDEX "AssetItem_branchId_categoryId_idx" ON "AssetItem"("branchId", "categoryId");

-- CreateIndex
CREATE INDEX "AssetItem_branchId_locationId_idx" ON "AssetItem"("branchId", "locationId");

-- CreateIndex
CREATE INDEX "AssetItem_branchId_custodianId_idx" ON "AssetItem"("branchId", "custodianId");

-- CreateIndex
CREATE INDEX "AssetItem_branchId_grnId_idx" ON "AssetItem"("branchId", "grnId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetItem_branchId_assetTag_key" ON "AssetItem"("branchId", "assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciationRun_journalEntryId_key" ON "AssetDepreciationRun"("journalEntryId");

-- CreateIndex
CREATE INDEX "AssetDepreciationRun_branchId_status_idx" ON "AssetDepreciationRun"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciationRun_branchId_runNumber_key" ON "AssetDepreciationRun"("branchId", "runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciationRun_branchId_periodId_key" ON "AssetDepreciationRun"("branchId", "periodId");

-- CreateIndex
CREATE INDEX "AssetDepreciationLine_depreciationRunId_idx" ON "AssetDepreciationLine"("depreciationRunId");

-- CreateIndex
CREATE INDEX "AssetDepreciationLine_assetId_idx" ON "AssetDepreciationLine"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciationLine_depreciationRunId_assetId_key" ON "AssetDepreciationLine"("depreciationRunId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDisposal_assetId_key" ON "AssetDisposal"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDisposal_cashbookMovementId_key" ON "AssetDisposal"("cashbookMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDisposal_journalEntryId_key" ON "AssetDisposal"("journalEntryId");

-- CreateIndex
CREATE INDEX "AssetDisposal_branchId_idx" ON "AssetDisposal"("branchId");

-- CreateIndex
CREATE INDEX "AssetVerificationLog_branchId_assetId_idx" ON "AssetVerificationLog"("branchId", "assetId");

-- CreateIndex
CREATE INDEX "AssetVerificationLog_branchId_verifiedAt_idx" ON "AssetVerificationLog"("branchId", "verifiedAt");

-- CreateIndex
CREATE INDEX "AssetMovementLog_branchId_assetId_idx" ON "AssetMovementLog"("branchId", "assetId");

-- CreateIndex
CREATE INDEX "AssetSequence_branchId_idx" ON "AssetSequence"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSequence_branchId_type_year_key" ON "AssetSequence"("branchId", "type", "year");

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_glAssetAccountId_fkey" FOREIGN KEY ("glAssetAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_glDepreciationAccountId_fkey" FOREIGN KEY ("glDepreciationAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_glAccumDeprecAccountId_fkey" FOREIGN KEY ("glAccumDeprecAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLocation" ADD CONSTRAINT "AssetLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceivedNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_grnItemId_fkey" FOREIGN KEY ("grnItemId") REFERENCES "GoodsReceivedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_transportVehicleId_fkey" FOREIGN KEY ("transportVehicleId") REFERENCES "TransportVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_capitalizationJournalId_fkey" FOREIGN KEY ("capitalizationJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationRun" ADD CONSTRAINT "AssetDepreciationRun_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationRun" ADD CONSTRAINT "AssetDepreciationRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationRun" ADD CONSTRAINT "AssetDepreciationRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationRun" ADD CONSTRAINT "AssetDepreciationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationRun" ADD CONSTRAINT "AssetDepreciationRun_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationLine" ADD CONSTRAINT "AssetDepreciationLine_depreciationRunId_fkey" FOREIGN KEY ("depreciationRunId") REFERENCES "AssetDepreciationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationLine" ADD CONSTRAINT "AssetDepreciationLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssetItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssetItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_cashbookMovementId_fkey" FOREIGN KEY ("cashbookMovementId") REFERENCES "CashbookMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVerificationLog" ADD CONSTRAINT "AssetVerificationLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVerificationLog" ADD CONSTRAINT "AssetVerificationLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssetItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVerificationLog" ADD CONSTRAINT "AssetVerificationLog_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVerificationLog" ADD CONSTRAINT "AssetVerificationLog_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVerificationLog" ADD CONSTRAINT "AssetVerificationLog_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovementLog" ADD CONSTRAINT "AssetMovementLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovementLog" ADD CONSTRAINT "AssetMovementLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssetItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovementLog" ADD CONSTRAINT "AssetMovementLog_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "AssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovementLog" ADD CONSTRAINT "AssetMovementLog_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "AssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovementLog" ADD CONSTRAINT "AssetMovementLog_fromCustodianId_fkey" FOREIGN KEY ("fromCustodianId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovementLog" ADD CONSTRAINT "AssetMovementLog_toCustodianId_fkey" FOREIGN KEY ("toCustodianId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovementLog" ADD CONSTRAINT "AssetMovementLog_transferredById_fkey" FOREIGN KEY ("transferredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSequence" ADD CONSTRAINT "AssetSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
