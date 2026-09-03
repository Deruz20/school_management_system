-- CreateEnum
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('DRAFT', 'MATCHED', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'ON_HOLD', 'VOIDED');

-- CreateEnum
CREATE TYPE "SupplierCreditNoteStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'ALLOCATED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SupplierPaymentStatus" AS ENUM ('COMPLETED', 'REVERSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SupplyCategory" AS ENUM ('GOODS', 'STANDARD_SERVICES', 'MANAGEMENT_PROFESSIONAL_SERVICES', 'CONSTRUCTION_WORKS', 'RENT_PREMISES');

-- CreateEnum
CREATE TYPE "InputVatTreatment" AS ENUM ('RECOVERABLE_INPUT_TAX', 'NON_RECOVERABLE_EXPENSED', 'NON_RECOVERABLE_CAPITALIZED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "ThreeWayMatchStatus" AS ENUM ('PERFECT_MATCH', 'PRICE_VARIANCE_PASS', 'PRICE_VARIANCE_FAIL', 'QUANTITY_VARIANCE_FAIL', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "StatementMatchStatus" AS ENUM ('UNMATCHED', 'EXACT_MATCH', 'VARIANCE_REVIEW', 'DISPUTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CashbookMovementType" ADD VALUE 'SUPPLIER_SETTLEMENT';
ALTER TYPE "CashbookMovementType" ADD VALUE 'SUPPLIER_REFUND_IN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalType" ADD VALUE 'AP_INVOICE_BILLING';
ALTER TYPE "JournalType" ADD VALUE 'AP_PAYMENT_DISBURSEMENT';
ALTER TYPE "JournalType" ADD VALUE 'AP_CREDIT_NOTE';
ALTER TYPE "JournalType" ADD VALUE 'AP_PRICE_VARIANCE';
ALTER TYPE "JournalType" ADD VALUE 'AP_SETTLEMENT_DISCOUNT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SystemControlRole" ADD VALUE 'AP_WHT_PAYABLE';
ALTER TYPE "SystemControlRole" ADD VALUE 'AP_VAT_INPUT_CONTROL';
ALTER TYPE "SystemControlRole" ADD VALUE 'AP_PURCHASE_PRICE_VARIANCE';

-- AlterTable
ALTER TABLE "CashbookMovement" ADD COLUMN     "supplierPaymentId" TEXT;

-- AlterTable
ALTER TABLE "GoodsReceivedItem" ADD COLUMN     "invoicedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "uninvoicedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventorySupplier" ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "creditLimitUGX" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "currentBalanceUGX" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "isCreditBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mobileMoneyNumber" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "preferredPaymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
ADD COLUMN     "tradeName" TEXT,
ADD COLUMN     "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whtExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whtExemptionCertRef" TEXT,
ADD COLUMN     "whtExemptionExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaxPolicy" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplyCategory" "SupplyCategory" NOT NULL,
    "isWhtApplicable" BOOLEAN NOT NULL DEFAULT true,
    "whtRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 6.00,
    "whtThresholdAmount" DECIMAL(14,2) NOT NULL DEFAULT 1000000.00,
    "whtTaxableBaseRule" TEXT NOT NULL DEFAULT 'GROSS_EXCLUDING_VAT',
    "isVatApplicable" BOOLEAN NOT NULL DEFAULT true,
    "vatRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "inputVatTreatment" "InputVatTreatment" NOT NULL DEFAULT 'NON_RECOVERABLE_EXPENSED',
    "efrisEvidenceRequired" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorInvoiceNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poId" TEXT,
    "grnId" TEXT,
    "fiscalPeriodId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "supplyCategory" "SupplyCategory" NOT NULL DEFAULT 'GOODS',
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netPayableAmount" DECIMAL(14,2) NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountOutstanding" DECIMAL(14,2) NOT NULL,
    "ppvAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "matchStatus" "ThreeWayMatchStatus",
    "disputeReason" TEXT,
    "holdReason" TEXT,
    "efrisFiscalDocNumber" TEXT,
    "efrisVerificationCode" TEXT,
    "isOpeningBalance" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "poItemId" TEXT,
    "grnItemId" TEXT,
    "itemId" TEXT,
    "expenseCategoryId" TEXT,
    "description" TEXT NOT NULL,
    "quantityInvoiced" DECIMAL(12,2) NOT NULL,
    "unitPriceInvoiced" DECIMAL(12,2) NOT NULL,
    "unitCostSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotalCost" DECIMAL(14,2) NOT NULL,
    "ppvAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "glAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCreditNote" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "vendorCreditNoteRef" TEXT,
    "supplierId" TEXT NOT NULL,
    "originalInvoiceId" TEXT,
    "fiscalPeriodId" TEXT NOT NULL,
    "creditNoteDate" TIMESTAMP(3) NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netCreditAmount" DECIMAL(14,2) NOT NULL,
    "unallocatedAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SupplierCreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantityReturned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "glAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "treasuryAccountId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "totalAmountPaid" DECIMAL(14,2) NOT NULL,
    "whtDeductedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountTakenAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unallocatedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "status" "SupplierPaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "journalEntryId" TEXT,
    "cashbookMovementId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPaymentAllocation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierStatementImport" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "statementRef" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL,
    "closingBalance" DECIMAL(14,2) NOT NULL,
    "totalDebits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCredits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierStatementLine" (
    "id" TEXT NOT NULL,
    "statementImportId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "description" TEXT,
    "debitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL,
    "matchStatus" "StatementMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedInvoiceId" TEXT,
    "matchedPaymentId" TEXT,
    "matchedCreditNoteId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextVal" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxPolicy_branchId_supplyCategory_effectiveFrom_effectiveTo_idx" ON "TaxPolicy"("branchId", "supplyCategory", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "TaxPolicy_branchId_isActive_idx" ON "TaxPolicy"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_journalEntryId_key" ON "SupplierInvoice"("journalEntryId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_branchId_status_dueDate_idx" ON "SupplierInvoice"("branchId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "SupplierInvoice_branchId_supplierId_idx" ON "SupplierInvoice"("branchId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_branchId_invoiceNumber_key" ON "SupplierInvoice"("branchId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_branchId_supplierId_vendorInvoiceNumber_key" ON "SupplierInvoice"("branchId", "supplierId", "vendorInvoiceNumber");

-- CreateIndex
CREATE INDEX "SupplierInvoiceLine_invoiceId_idx" ON "SupplierInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "SupplierInvoiceLine_branchId_grnItemId_idx" ON "SupplierInvoiceLine"("branchId", "grnItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCreditNote_journalEntryId_key" ON "SupplierCreditNote"("journalEntryId");

-- CreateIndex
CREATE INDEX "SupplierCreditNote_branchId_supplierId_idx" ON "SupplierCreditNote"("branchId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierCreditNote_branchId_status_idx" ON "SupplierCreditNote"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCreditNote_branchId_creditNoteNumber_key" ON "SupplierCreditNote"("branchId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "SupplierCreditNoteLine_creditNoteId_idx" ON "SupplierCreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_journalEntryId_key" ON "SupplierPayment"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_cashbookMovementId_key" ON "SupplierPayment"("cashbookMovementId");

-- CreateIndex
CREATE INDEX "SupplierPayment_branchId_supplierId_paymentDate_idx" ON "SupplierPayment"("branchId", "supplierId", "paymentDate");

-- CreateIndex
CREATE INDEX "SupplierPayment_branchId_status_idx" ON "SupplierPayment"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_branchId_paymentNumber_key" ON "SupplierPayment"("branchId", "paymentNumber");

-- CreateIndex
CREATE INDEX "SupplierPaymentAllocation_paymentId_idx" ON "SupplierPaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "SupplierPaymentAllocation_invoiceId_idx" ON "SupplierPaymentAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "SupplierStatementImport_branchId_supplierId_statementDate_idx" ON "SupplierStatementImport"("branchId", "supplierId", "statementDate");

-- CreateIndex
CREATE INDEX "SupplierStatementLine_statementImportId_idx" ON "SupplierStatementLine"("statementImportId");

-- CreateIndex
CREATE INDEX "SupplierStatementLine_branchId_matchStatus_idx" ON "SupplierStatementLine"("branchId", "matchStatus");

-- CreateIndex
CREATE INDEX "SupplierSequence_branchId_idx" ON "SupplierSequence"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSequence_branchId_type_year_key" ON "SupplierSequence"("branchId", "type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "CashbookMovement_supplierPaymentId_key" ON "CashbookMovement"("supplierPaymentId");

-- CreateIndex
CREATE INDEX "CashbookMovement_branchId_supplierPaymentId_idx" ON "CashbookMovement"("branchId", "supplierPaymentId");

-- CreateIndex
CREATE INDEX "InventorySupplier_branchId_name_idx" ON "InventorySupplier"("branchId", "name");

-- AddForeignKey
ALTER TABLE "CashbookMovement" ADD CONSTRAINT "CashbookMovement_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPolicy" ADD CONSTRAINT "TaxPolicy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceivedNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_grnItemId_fkey" FOREIGN KEY ("grnItemId") REFERENCES "GoodsReceivedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNote" ADD CONSTRAINT "SupplierCreditNote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNote" ADD CONSTRAINT "SupplierCreditNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNote" ADD CONSTRAINT "SupplierCreditNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNote" ADD CONSTRAINT "SupplierCreditNote_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNote" ADD CONSTRAINT "SupplierCreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNote" ADD CONSTRAINT "SupplierCreditNote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNote" ADD CONSTRAINT "SupplierCreditNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNoteLine" ADD CONSTRAINT "SupplierCreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "SupplierCreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNoteLine" ADD CONSTRAINT "SupplierCreditNoteLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNoteLine" ADD CONSTRAINT "SupplierCreditNoteLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNoteLine" ADD CONSTRAINT "SupplierCreditNoteLine_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierStatementImport" ADD CONSTRAINT "SupplierStatementImport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierStatementImport" ADD CONSTRAINT "SupplierStatementImport_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierStatementImport" ADD CONSTRAINT "SupplierStatementImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierStatementLine" ADD CONSTRAINT "SupplierStatementLine_statementImportId_fkey" FOREIGN KEY ("statementImportId") REFERENCES "SupplierStatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierStatementLine" ADD CONSTRAINT "SupplierStatementLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSequence" ADD CONSTRAINT "SupplierSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

