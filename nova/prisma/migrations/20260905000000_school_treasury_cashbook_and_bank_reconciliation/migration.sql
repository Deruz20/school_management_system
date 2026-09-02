-- CreateEnum
CREATE TYPE "TreasuryAccountType" AS ENUM ('COMMERCIAL_BANK', 'CASH_OFFICE_SAFE', 'CASHIER_TILL', 'MOBILE_MONEY_FLOAT', 'PETTY_CASH_FLOAT');

-- CreateEnum
CREATE TYPE "CashbookMovementType" AS ENUM ('FEE_PAYMENT_RECEIPT', 'STORE_SALE_RECEIPT', 'OPERATIONAL_EXPENSE', 'PAYROLL_DISBURSEMENT', 'BANK_DEPOSIT_OUT', 'BANK_DEPOSIT_IN', 'INTER_ACCOUNT_TRANSFER_OUT', 'INTER_ACCOUNT_TRANSFER_IN', 'PETTY_CASH_DISBURSEMENT', 'PETTY_CASH_REPLENISHMENT_OUT', 'PETTY_CASH_REPLENISHMENT_IN', 'PETTY_CASH_CHANGE_RETURN', 'BANK_CHARGE', 'BANK_INTEREST_CREDIT', 'PAYMENT_REVERSAL_OUT', 'EXPENSE_VOID_IN', 'OPENING_BALANCE', 'AUDIT_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CashDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "TransferMethod" AS ENUM ('CASH_BANKING_DEPOSIT', 'BANK_TO_BANK_EFT', 'BANK_WITHDRAWAL_TO_SAFE', 'TILL_TO_SAFE_SWEEP', 'SAFE_TO_PETTY_FLOAT', 'MOMO_TO_BANK_SWEEP');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING_APPROVAL', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PettyVoucherStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'DISBURSED', 'RETIRED', 'REJECTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "StatementLineMatchStatus" AS ENUM ('UNRECONCILED', 'AUTO_MATCHED', 'MANUALLY_MATCHED', 'EXCEPTION_DISCREPANCY', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "BRSStatus" AS ENUM ('DRAFT', 'CERTIFIED', 'LOCKED');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "treasuryAccountId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "treasuryAccountId" TEXT;

-- CreateTable
CREATE TABLE "TreasuryAccount" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "TreasuryAccountType" NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "swiftCode" TEXT,
    "branchSortCode" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "openingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDefaultFeeCollection" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultOperations" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultPettyCash" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "custodianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashbookMovement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "movementNumber" TEXT NOT NULL,
    "movementType" "CashbookMovementType" NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceNumber" TEXT,
    "description" TEXT NOT NULL,
    "paymentId" TEXT,
    "expenseId" TEXT,
    "transferId" TEXT,
    "payrollRunId" TEXT,
    "storeSaleId" TEXT,
    "pettyVoucherId" TEXT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "statementLineId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashbookMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryTransfer" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transferMethod" "TransferMethod" NOT NULL,
    "depositSlipNumber" TEXT,
    "securityEscortDetails" TEXT,
    "notes" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'COMPLETED',
    "initiatedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierShiftSession" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "tillAccountId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingFloat" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "expectedClosingBalance" DECIMAL(12,2),
    "actualCashCounted" DECIMAL(12,2),
    "cashVariance" DECIMAL(12,2),
    "denominationsJson" TEXT,
    "varianceNotes" TEXT,
    "supervisorWitnessId" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashierShiftSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashImprest" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "custodianId" TEXT NOT NULL,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "floatCeiling" DECIMAL(12,2) NOT NULL,
    "replenishmentThreshold" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashImprest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashVoucher" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "imprestId" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "budgetItemId" TEXT,
    "requestedAmount" DECIMAL(12,2) NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "disbursedAmount" DECIMAL(12,2),
    "spentAmount" DECIMAL(12,2),
    "changeReturned" DECIMAL(12,2),
    "receiptUrl" TEXT,
    "status" "PettyVoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PettyCashVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statementIdentifier" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(12,2) NOT NULL,
    "closingBalance" DECIMAL(12,2) NOT NULL,
    "fileHash" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3),
    "reference" TEXT,
    "narrative" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "runningBalance" DECIMAL(12,2),
    "matchStatus" "StatementLineMatchStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "matchNotes" TEXT,
    "matchedById" TEXT,
    "matchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "reconciliationNumber" TEXT NOT NULL,
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "statementClosingBalance" DECIMAL(12,2) NOT NULL,
    "cashbookClosingBalance" DECIMAL(12,2) NOT NULL,
    "totalDepositsInTransit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalUnpresentedCheques" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalBankCharges" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalBankInterest" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "adjustedBankBalance" DECIMAL(12,2) NOT NULL,
    "adjustedCashbookBalance" DECIMAL(12,2) NOT NULL,
    "variance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" "BRSStatus" NOT NULL DEFAULT 'DRAFT',
    "certifiedById" TEXT,
    "certifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasurySequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasurySequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreasuryAccount_branchId_accountType_idx" ON "TreasuryAccount"("branchId", "accountType");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccount_branchId_code_key" ON "TreasuryAccount"("branchId", "code");

-- CreateIndex
CREATE INDEX "CashbookMovement_branchId_accountId_transactionDate_idx" ON "CashbookMovement"("branchId", "accountId", "transactionDate");

-- CreateIndex
CREATE INDEX "CashbookMovement_branchId_paymentId_idx" ON "CashbookMovement"("branchId", "paymentId");

-- CreateIndex
CREATE INDEX "CashbookMovement_branchId_expenseId_idx" ON "CashbookMovement"("branchId", "expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "CashbookMovement_branchId_movementNumber_key" ON "CashbookMovement"("branchId", "movementNumber");

-- CreateIndex
CREATE INDEX "TreasuryTransfer_branchId_fromAccountId_idx" ON "TreasuryTransfer"("branchId", "fromAccountId");

-- CreateIndex
CREATE INDEX "TreasuryTransfer_branchId_toAccountId_idx" ON "TreasuryTransfer"("branchId", "toAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryTransfer_branchId_transferNumber_key" ON "TreasuryTransfer"("branchId", "transferNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryTransfer_branchId_idempotencyKey_key" ON "TreasuryTransfer"("branchId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CashierShiftSession_branchId_cashierId_status_idx" ON "CashierShiftSession"("branchId", "cashierId", "status");

-- CreateIndex
CREATE INDEX "PettyCashImprest_branchId_custodianId_idx" ON "PettyCashImprest"("branchId", "custodianId");

-- CreateIndex
CREATE INDEX "PettyCashVoucher_branchId_imprestId_status_idx" ON "PettyCashVoucher"("branchId", "imprestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashVoucher_branchId_voucherNumber_key" ON "PettyCashVoucher"("branchId", "voucherNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatement_branchId_fileHash_key" ON "BankStatement"("branchId", "fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatement_branchId_accountId_statementIdentifier_key" ON "BankStatement"("branchId", "accountId", "statementIdentifier");

-- CreateIndex
CREATE INDEX "BankStatementLine_statementId_matchStatus_idx" ON "BankStatementLine"("statementId", "matchStatus");

-- CreateIndex
CREATE INDEX "BankReconciliation_branchId_accountId_status_idx" ON "BankReconciliation"("branchId", "accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_branchId_reconciliationNumber_key" ON "BankReconciliation"("branchId", "reconciliationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TreasurySequence_branchId_prefix_year_key" ON "TreasurySequence"("branchId", "prefix", "year");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbookMovement" ADD CONSTRAINT "CashbookMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbookMovement" ADD CONSTRAINT "CashbookMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbookMovement" ADD CONSTRAINT "CashbookMovement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbookMovement" ADD CONSTRAINT "CashbookMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbookMovement" ADD CONSTRAINT "CashbookMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "TreasuryTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbookMovement" ADD CONSTRAINT "CashbookMovement_pettyVoucherId_fkey" FOREIGN KEY ("pettyVoucherId") REFERENCES "PettyCashVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbookMovement" ADD CONSTRAINT "CashbookMovement_statementLineId_fkey" FOREIGN KEY ("statementLineId") REFERENCES "BankStatementLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbookMovement" ADD CONSTRAINT "CashbookMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryTransfer" ADD CONSTRAINT "TreasuryTransfer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryTransfer" ADD CONSTRAINT "TreasuryTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryTransfer" ADD CONSTRAINT "TreasuryTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryTransfer" ADD CONSTRAINT "TreasuryTransfer_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryTransfer" ADD CONSTRAINT "TreasuryTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftSession" ADD CONSTRAINT "CashierShiftSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftSession" ADD CONSTRAINT "CashierShiftSession_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftSession" ADD CONSTRAINT "CashierShiftSession_tillAccountId_fkey" FOREIGN KEY ("tillAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftSession" ADD CONSTRAINT "CashierShiftSession_supervisorWitnessId_fkey" FOREIGN KEY ("supervisorWitnessId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashImprest" ADD CONSTRAINT "PettyCashImprest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashImprest" ADD CONSTRAINT "PettyCashImprest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashImprest" ADD CONSTRAINT "PettyCashImprest_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashImprest" ADD CONSTRAINT "PettyCashImprest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashVoucher" ADD CONSTRAINT "PettyCashVoucher_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashVoucher" ADD CONSTRAINT "PettyCashVoucher_imprestId_fkey" FOREIGN KEY ("imprestId") REFERENCES "PettyCashImprest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashVoucher" ADD CONSTRAINT "PettyCashVoucher_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashVoucher" ADD CONSTRAINT "PettyCashVoucher_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashVoucher" ADD CONSTRAINT "PettyCashVoucher_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashVoucher" ADD CONSTRAINT "PettyCashVoucher_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashVoucher" ADD CONSTRAINT "PettyCashVoucher_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_certifiedById_fkey" FOREIGN KEY ("certifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasurySequence" ADD CONSTRAINT "TreasurySequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

