-- CreateEnum
CREATE TYPE "GLAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'DIRECT_COST', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "SystemControlRole" AS ENUM ('NONE', 'AR_STUDENT_CONTROL', 'AR_PREPAID_ADVANCES', 'AP_SUPPLIER_CONTROL', 'AP_GRN_ACCRUAL', 'CASH_BANK_CONTROL', 'INVENTORY_STORES_ASSET', 'INVENTORY_COGS_DEFAULT', 'INVENTORY_SHRINKAGE_EXPENSE', 'INVENTORY_SURPLUS_INCOME', 'PAYROLL_WAGES_EXPENSE', 'PAYROLL_EMPLOYER_NSSF_EXPENSE', 'PAYROLL_NET_PAY_PAYABLE', 'PAYROLL_PAYE_PAYABLE', 'PAYROLL_NSSF_PAYABLE', 'CASH_IN_TRANSIT', 'BANK_CHARGES_EXPENSE', 'BANK_INTEREST_INCOME', 'RETAINED_EARNINGS', 'OPENING_BALANCE_EQUITY');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('STANDARD_MANUAL', 'AR_BILLING', 'PAYMENT_RECEIPT', 'EXPENSE_DISBURSEMENT', 'PAYROLL_ACCRUAL', 'PAYROLL_PAYOUT', 'STATUTORY_REMITTANCE', 'INVENTORY_PURCHASE', 'INVENTORY_COGS', 'INVENTORY_ISSUE', 'INVENTORY_WRITEOFF', 'TREASURY_TRANSFER', 'TREASURY_RECONCILIATION', 'YEAR_END_CLOSE', 'REVERSAL', 'OPENING_BALANCE');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "glAccountId" TEXT;

-- AlterTable
ALTER TABLE "FeeType" ADD COLUMN     "glAccountId" TEXT;

-- AlterTable
ALTER TABLE "TreasuryAccount" ADD COLUMN     "glAccountId" TEXT;

-- CreateTable
CREATE TABLE "GLAccount" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "GLAccountType" NOT NULL,
    "normalBalance" "NormalBalance" NOT NULL,
    "controlRole" "SystemControlRole" NOT NULL DEFAULT 'NONE',
    "isHeader" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GLAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "journalNumber" TEXT NOT NULL,
    "fiscalPeriodId" TEXT NOT NULL,
    "journalType" "JournalType" NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'POSTED',
    "entryDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfId" TEXT,
    "reversedById" TEXT,
    "postedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "departmentId" TEXT,
    "academicYearId" TEXT,
    "termId" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLAccountMapping" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "mappingKey" "SystemControlRole" NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GLAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLSequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GLSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GLAccount_branchId_accountType_idx" ON "GLAccount"("branchId", "accountType");

-- CreateIndex
CREATE INDEX "GLAccount_branchId_controlRole_idx" ON "GLAccount"("branchId", "controlRole");

-- CreateIndex
CREATE UNIQUE INDEX "GLAccount_branchId_code_key" ON "GLAccount"("branchId", "code");

-- CreateIndex
CREATE INDEX "FiscalYear_branchId_status_idx" ON "FiscalYear"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_branchId_name_key" ON "FiscalYear"("branchId", "name");

-- CreateIndex
CREATE INDEX "FiscalPeriod_branchId_status_idx" ON "FiscalPeriod"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_fiscalYearId_periodNumber_key" ON "FiscalPeriod"("fiscalYearId", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_branchId_name_key" ON "FiscalPeriod"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversalOfId_key" ON "JournalEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "JournalEntry_branchId_entryDate_idx" ON "JournalEntry"("branchId", "entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_branchId_status_idx" ON "JournalEntry"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_branchId_journalNumber_key" ON "JournalEntry"("branchId", "journalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_branchId_idempotencyKey_key" ON "JournalEntry"("branchId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_branchId_referenceType_referenceId_journalType_key" ON "JournalEntry"("branchId", "referenceType", "referenceId", "journalType");

-- CreateIndex
CREATE INDEX "JournalLine_branchId_accountId_idx" ON "JournalLine"("branchId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_journalEntryId_lineNumber_key" ON "JournalLine"("journalEntryId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GLAccountMapping_branchId_mappingKey_key" ON "GLAccountMapping"("branchId", "mappingKey");

-- CreateIndex
CREATE UNIQUE INDEX "GLSequence_branchId_year_key" ON "GLSequence"("branchId", "year");

-- AddForeignKey
ALTER TABLE "FeeType" ADD CONSTRAINT "FeeType_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccount" ADD CONSTRAINT "GLAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccount" ADD CONSTRAINT "GLAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GLAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GLAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccountMapping" ADD CONSTRAINT "GLAccountMapping_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccountMapping" ADD CONSTRAINT "GLAccountMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GLAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLSequence" ADD CONSTRAINT "GLSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

