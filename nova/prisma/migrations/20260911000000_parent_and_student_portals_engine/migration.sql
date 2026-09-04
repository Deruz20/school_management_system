-- AlterTable
ALTER TABLE "Class" ADD COLUMN "portalAccessEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "ParentConsentType" AS ENUM ('EXEAT_PASS', 'MEDICAL_TREATMENT', 'ACTIVITY_FIELD_TRIP', 'FEE_COMMUNICATION', 'DATA_PRIVACY_RELEASE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PORTAL', 'SMS', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ReportCardAccessStatus" AS ENUM ('UNRESTRICTED', 'DEBTOR_BLOCKED', 'FEE_THRESHOLD_MET');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "ParentConsentRecord" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "consentType" "ParentConsentType" NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "granted" BOOLEAN NOT NULL,
    "decisionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digitalSignature" TEXT,
    "recordedIp" TEXT,
    "userAgent" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "guardianId" TEXT,
    "studentId" TEXT,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "preferredChannel" "NotificationChannel" NOT NULL DEFAULT 'PORTAL',
    "feeAlerts" BOOLEAN NOT NULL DEFAULT true,
    "academicAlerts" BOOLEAN NOT NULL DEFAULT true,
    "attendanceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "disciplineAlerts" BOOLEAN NOT NULL DEFAULT true,
    "welfareAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAccessPolicy" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "allowStudentAccess" BOOLEAN NOT NULL DEFAULT true,
    "allowParentAccess" BOOLEAN NOT NULL DEFAULT true,
    "enforceFeeBlockOnReports" BOOLEAN NOT NULL DEFAULT true,
    "outstandingFeeThreshold" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "blockMessage" TEXT DEFAULT 'Your account has an outstanding fee balance. Please contact the accounts office to clear payments and access your academic reports.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalAccessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalActivityLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "recipientId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentConsentRecord_branchId_guardianId_idx" ON "ParentConsentRecord"("branchId", "guardianId");
CREATE INDEX "ParentConsentRecord_branchId_studentId_idx" ON "ParentConsentRecord"("branchId", "studentId");
CREATE INDEX "ParentConsentRecord_referenceType_referenceId_idx" ON "ParentConsentRecord"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_guardianId_key" ON "NotificationPreference"("guardianId");
CREATE UNIQUE INDEX "NotificationPreference_studentId_key" ON "NotificationPreference"("studentId");
CREATE INDEX "NotificationPreference_branchId_idx" ON "NotificationPreference"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccessPolicy_branchId_key" ON "PortalAccessPolicy"("branchId");

-- CreateIndex
CREATE INDEX "PortalActivityLog_branchId_userId_idx" ON "PortalActivityLog"("branchId", "userId");
CREATE INDEX "PortalActivityLog_branchId_action_idx" ON "PortalActivityLog"("branchId", "action");

-- CreateIndex
CREATE INDEX "NotificationOutbox_branchId_status_idx" ON "NotificationOutbox"("branchId", "status");
CREATE INDEX "NotificationOutbox_channel_status_idx" ON "NotificationOutbox"("channel", "status");

-- AddForeignKey
ALTER TABLE "ParentConsentRecord" ADD CONSTRAINT "ParentConsentRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentConsentRecord" ADD CONSTRAINT "ParentConsentRecord_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentConsentRecord" ADD CONSTRAINT "ParentConsentRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccessPolicy" ADD CONSTRAINT "PortalAccessPolicy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalActivityLog" ADD CONSTRAINT "PortalActivityLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalActivityLog" ADD CONSTRAINT "PortalActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
