-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('CLEANING_HYGIENE', 'ACADEMIC_STATIONERY', 'BOARDING_PERSONAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "RequirementUnit" AS ENUM ('PIECE', 'ROLL', 'REAM', 'BAR', 'BOTTLE', 'BOOK', 'PACKET', 'PAIR', 'SET', 'LITRE', 'KG');

-- CreateEnum
CREATE TYPE "RequirementItemStatus" AS ENUM ('PENDING', 'PARTIAL', 'FULFILLED', 'MONETIZED', 'EXEMPTED');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('CLEARED', 'PROVISIONAL', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ClearanceType" AS ENUM ('EXAM_PERMIT', 'GATE_PASS', 'TERM_REGISTRATION', 'REPORT_CARD');

-- CreateEnum
CREATE TYPE "ClearanceDocStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "RequirementCatalog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "RequirementCategory" NOT NULL DEFAULT 'GENERAL',
    "unit" "RequirementUnit" NOT NULL DEFAULT 'PIECE',
    "defaultCashInLieu" DECIMAL(12,2),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassRequirement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassRequirementItem" (
    "id" TEXT NOT NULL,
    "classRequirementId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "feeTypeId" TEXT,
    "name" TEXT NOT NULL,
    "category" "RequirementCategory" NOT NULL DEFAULT 'GENERAL',
    "unit" "RequirementUnit" NOT NULL DEFAULT 'PIECE',
    "quantity" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "cashInLieuAmount" DECIMAL(12,2),
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassRequirementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRequirementRecord" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "classRequirementId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "totalItemsCount" INTEGER NOT NULL DEFAULT 0,
    "fulfilledCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "isFullyCompliant" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentRequirementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRequirementItem" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "blueprintItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "RequirementCategory" NOT NULL DEFAULT 'GENERAL',
    "unit" "RequirementUnit" NOT NULL DEFAULT 'PIECE',
    "quantityRequired" DECIMAL(8,2) NOT NULL,
    "quantityDelivered" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "quantityMonetized" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "cashInLieuAmount" DECIMAL(12,2),
    "paymentId" TEXT,
    "status" "RequirementItemStatus" NOT NULL DEFAULT 'PENDING',
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "lastReceivedById" TEXT,
    "lastReceivedAt" TIMESTAMP(3),
    "exemptionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentRequirementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InKindHandoverLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentRequirementItemId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "deltaDelivered" DECIMAL(8,2) NOT NULL,
    "previousQuantity" DECIMAL(8,2) NOT NULL,
    "newQuantity" DECIMAL(8,2) NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCorrection" BOOLEAN NOT NULL DEFAULT false,
    "correctionReason" TEXT,
    "notes" TEXT,

    CONSTRAINT "InKindHandoverLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentClearance" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "requirementRecordId" TEXT,
    "clearanceType" "ClearanceType" NOT NULL DEFAULT 'EXAM_PERMIT',
    "clearanceNumber" TEXT NOT NULL,
    "status" "ClearanceStatus" NOT NULL DEFAULT 'CLEARED',
    "docStatus" "ClearanceDocStatus" NOT NULL DEFAULT 'ACTIVE',
    "ledgerBalance" DECIMAL(12,2) NOT NULL,
    "feesPaidPercent" DECIMAL(5,2) NOT NULL,
    "requirementsFulfilled" BOOLEAN NOT NULL DEFAULT true,
    "provisionalReason" TEXT,
    "revocationReason" TEXT,
    "authorizedById" TEXT NOT NULL,
    "revokedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "verificationToken" TEXT NOT NULL,

    CONSTRAINT "StudentClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClearanceSequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClearanceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InKindReceiptSequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InKindReceiptSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequirementCatalog_branchId_category_idx" ON "RequirementCatalog"("branchId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementCatalog_branchId_code_key" ON "RequirementCatalog"("branchId", "code");

-- CreateIndex
CREATE INDEX "ClassRequirement_branchId_academicYearId_termId_idx" ON "ClassRequirement"("branchId", "academicYearId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRequirement_branchId_classId_academicYearId_termId_key" ON "ClassRequirement"("branchId", "classId", "academicYearId", "termId");

-- CreateIndex
CREATE INDEX "ClassRequirementItem_classRequirementId_idx" ON "ClassRequirementItem"("classRequirementId");

-- CreateIndex
CREATE INDEX "StudentRequirementRecord_branchId_studentId_idx" ON "StudentRequirementRecord"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "StudentRequirementRecord_branchId_academicYearId_termId_idx" ON "StudentRequirementRecord"("branchId", "academicYearId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRequirementRecord_branchId_studentId_academicYearId__key" ON "StudentRequirementRecord"("branchId", "studentId", "academicYearId", "termId");

-- CreateIndex
CREATE INDEX "StudentRequirementItem_recordId_idx" ON "StudentRequirementItem"("recordId");

-- CreateIndex
CREATE INDEX "StudentRequirementItem_blueprintItemId_idx" ON "StudentRequirementItem"("blueprintItemId");

-- CreateIndex
CREATE INDEX "InKindHandoverLog_studentRequirementItemId_idx" ON "InKindHandoverLog"("studentRequirementItemId");

-- CreateIndex
CREATE INDEX "InKindHandoverLog_branchId_receivedAt_idx" ON "InKindHandoverLog"("branchId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InKindHandoverLog_branchId_receiptNumber_key" ON "InKindHandoverLog"("branchId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentClearance_verificationToken_key" ON "StudentClearance"("verificationToken");

-- CreateIndex
CREATE INDEX "StudentClearance_branchId_studentId_academicYearId_termId_idx" ON "StudentClearance"("branchId", "studentId", "academicYearId", "termId");

-- CreateIndex
CREATE INDEX "StudentClearance_verificationToken_idx" ON "StudentClearance"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "StudentClearance_branchId_clearanceNumber_key" ON "StudentClearance"("branchId", "clearanceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClearanceSequence_branchId_year_key" ON "ClearanceSequence"("branchId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "InKindReceiptSequence_branchId_year_key" ON "InKindReceiptSequence"("branchId", "year");

-- AddForeignKey
ALTER TABLE "RequirementCatalog" ADD CONSTRAINT "RequirementCatalog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRequirement" ADD CONSTRAINT "ClassRequirement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRequirement" ADD CONSTRAINT "ClassRequirement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRequirement" ADD CONSTRAINT "ClassRequirement_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRequirement" ADD CONSTRAINT "ClassRequirement_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRequirement" ADD CONSTRAINT "ClassRequirement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRequirementItem" ADD CONSTRAINT "ClassRequirementItem_classRequirementId_fkey" FOREIGN KEY ("classRequirementId") REFERENCES "ClassRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRequirementItem" ADD CONSTRAINT "ClassRequirementItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "RequirementCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRequirementItem" ADD CONSTRAINT "ClassRequirementItem_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementRecord" ADD CONSTRAINT "StudentRequirementRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementRecord" ADD CONSTRAINT "StudentRequirementRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementRecord" ADD CONSTRAINT "StudentRequirementRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementRecord" ADD CONSTRAINT "StudentRequirementRecord_classRequirementId_fkey" FOREIGN KEY ("classRequirementId") REFERENCES "ClassRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementRecord" ADD CONSTRAINT "StudentRequirementRecord_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementRecord" ADD CONSTRAINT "StudentRequirementRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementItem" ADD CONSTRAINT "StudentRequirementItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "StudentRequirementRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementItem" ADD CONSTRAINT "StudentRequirementItem_blueprintItemId_fkey" FOREIGN KEY ("blueprintItemId") REFERENCES "ClassRequirementItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementItem" ADD CONSTRAINT "StudentRequirementItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRequirementItem" ADD CONSTRAINT "StudentRequirementItem_lastReceivedById_fkey" FOREIGN KEY ("lastReceivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InKindHandoverLog" ADD CONSTRAINT "InKindHandoverLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InKindHandoverLog" ADD CONSTRAINT "InKindHandoverLog_studentRequirementItemId_fkey" FOREIGN KEY ("studentRequirementItemId") REFERENCES "StudentRequirementItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InKindHandoverLog" ADD CONSTRAINT "InKindHandoverLog_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClearance" ADD CONSTRAINT "StudentClearance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClearance" ADD CONSTRAINT "StudentClearance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClearance" ADD CONSTRAINT "StudentClearance_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClearance" ADD CONSTRAINT "StudentClearance_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClearance" ADD CONSTRAINT "StudentClearance_requirementRecordId_fkey" FOREIGN KEY ("requirementRecordId") REFERENCES "StudentRequirementRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClearance" ADD CONSTRAINT "StudentClearance_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClearance" ADD CONSTRAINT "StudentClearance_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClearanceSequence" ADD CONSTRAINT "ClearanceSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InKindReceiptSequence" ADD CONSTRAINT "InKindReceiptSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

