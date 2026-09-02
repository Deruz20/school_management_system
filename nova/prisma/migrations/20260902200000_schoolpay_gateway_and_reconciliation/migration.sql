-- CreateEnum
CREATE TYPE "SchoolPayTxStatus" AS ENUM ('RECEIVED', 'MATCHED', 'POSTED', 'NEEDS_REVIEW', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "SchoolPaySourceChannel" AS ENUM ('STANBIC_BANK', 'CENTENARY_BANK', 'ABSA_BANK', 'DFCU_BANK', 'POST_BANK', 'EQUITY_BANK', 'MTN_MOMO', 'AIRTEL_MONEY', 'OTHER_BANK', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "schoolPayCode" TEXT;

-- CreateTable
CREATE TABLE "SchoolPayConfig" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "schoolCode" TEXT NOT NULL,
    "apiPasswordEnc" TEXT,
    "channelKeyEnc" TEXT,
    "webhookSecretEnc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoPostMatched" BOOLEAN NOT NULL DEFAULT true,
    "allowedIps" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolPayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPayTransaction" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "schoolPayReceiptNo" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "schoolPayCode" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "feeAmount" DECIMAL(12,2),
    "payerName" TEXT,
    "payerPhone" TEXT,
    "channel" "SchoolPaySourceChannel" NOT NULL DEFAULT 'UNKNOWN',
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" "SchoolPayTxStatus" NOT NULL DEFAULT 'RECEIVED',
    "studentId" TEXT,
    "paymentId" TEXT,
    "rawPayload" JSONB,
    "reviewNotes" TEXT,
    "errorMessage" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolPayTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPaySyncLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "newReceived" INTEGER NOT NULL DEFAULT 0,
    "autoPosted" INTEGER NOT NULL DEFAULT 0,
    "needsReview" INTEGER NOT NULL DEFAULT 0,
    "skippedExisting" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "syncedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolPaySyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPayConfig_branchId_key" ON "SchoolPayConfig"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPayConfig_schoolCode_key" ON "SchoolPayConfig"("schoolCode");

-- CreateIndex
CREATE INDEX "SchoolPayConfig_branchId_idx" ON "SchoolPayConfig"("branchId");

-- CreateIndex
CREATE INDEX "SchoolPayConfig_schoolCode_idx" ON "SchoolPayConfig"("schoolCode");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPayTransaction_paymentId_key" ON "SchoolPayTransaction"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPayTransaction_branchId_schoolPayReceiptNo_key" ON "SchoolPayTransaction"("branchId", "schoolPayReceiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPayTransaction_branchId_transactionId_key" ON "SchoolPayTransaction"("branchId", "transactionId");

-- CreateIndex
CREATE INDEX "SchoolPayTransaction_branchId_status_idx" ON "SchoolPayTransaction"("branchId", "status");

-- CreateIndex
CREATE INDEX "SchoolPayTransaction_branchId_schoolPayCode_idx" ON "SchoolPayTransaction"("branchId", "schoolPayCode");

-- CreateIndex
CREATE INDEX "SchoolPayTransaction_branchId_paymentDate_idx" ON "SchoolPayTransaction"("branchId", "paymentDate");

-- CreateIndex
CREATE INDEX "SchoolPaySyncLog_branchId_createdAt_idx" ON "SchoolPaySyncLog"("branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_branchId_schoolPayCode_key" ON "Student"("branchId", "schoolPayCode");

-- AddForeignKey
ALTER TABLE "SchoolPayConfig" ADD CONSTRAINT "SchoolPayConfig_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPayTransaction" ADD CONSTRAINT "SchoolPayTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPayTransaction" ADD CONSTRAINT "SchoolPayTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPayTransaction" ADD CONSTRAINT "SchoolPayTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPaySyncLog" ADD CONSTRAINT "SchoolPaySyncLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPaySyncLog" ADD CONSTRAINT "SchoolPaySyncLog_configId_fkey" FOREIGN KEY ("configId") REFERENCES "SchoolPayConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
