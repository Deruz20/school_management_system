-- AlterEnum
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "NotificationOutbox" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "PortalAuthOtp" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAuthOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalPhoneLockout" (
    "phone" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalPhoneLockout_pkey" PRIMARY KEY ("phone")
);

-- CreateIndex
CREATE INDEX "PortalAuthOtp_branchId_phone_idx" ON "PortalAuthOtp"("branchId", "phone");

-- CreateIndex
CREATE INDEX "PortalAuthOtp_phone_isConsumed_idx" ON "PortalAuthOtp"("phone", "isConsumed");

-- CreateIndex
CREATE INDEX "PortalPhoneLockout_lockedUntil_idx" ON "PortalPhoneLockout"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_idempotencyKey_key" ON "NotificationOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_nextRetryAt_idx" ON "NotificationOutbox"("status", "nextRetryAt");

-- AddForeignKey
ALTER TABLE "PortalAuthOtp" ADD CONSTRAINT "PortalAuthOtp_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
