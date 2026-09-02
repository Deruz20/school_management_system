-- CreateEnum
CREATE TYPE "TransportSubscriptionType" AS ENUM ('TWO_WAY', 'ONE_WAY_MORNING', 'ONE_WAY_EVENING');

-- CreateEnum
CREATE TYPE "TransportSubscriptionStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('ROUTINE_SERVICE', 'REPAIR', 'TYRES', 'INSPECTION', 'BATTERY', 'OTHER');

-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "destinationZone" TEXT,
    "twoWayFee" DECIMAL(12,2) NOT NULL,
    "oneWayFee" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopName" TEXT NOT NULL,
    "landmark" TEXT,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 1,
    "morningPickupTime" TEXT,
    "eveningDropTime" TEXT,
    "surchargeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportVehicle" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "makeModel" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "fuelType" TEXT NOT NULL DEFAULT 'DIESEL',
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "insuranceExpiry" TIMESTAMP(3),
    "inspectionDueDate" TIMESTAMP(3),
    "currentOdometerKm" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportDriver" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseClass" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleRouteAssignment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "vehiclePlateSnapshot" TEXT NOT NULL,
    "vehicleCapacitySnapshot" INTEGER NOT NULL,
    "driverNameSnapshot" TEXT,
    "driverPhoneSnapshot" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleRouteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentTransportSubscription" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "subscriptionType" "TransportSubscriptionType" NOT NULL DEFAULT 'TWO_WAY',
    "status" "TransportSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "routeNameSnapshot" TEXT NOT NULL,
    "stopNameSnapshot" TEXT,
    "baseFeeSnapshot" DECIMAL(12,2) NOT NULL,
    "stopSurchargeSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalFeeAmount" DECIMAL(12,2) NOT NULL,
    "invoiceItemId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "overrideJustification" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentTransportSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleFuelLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "expenseId" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odometerKm" INTEGER NOT NULL,
    "litersFilled" DECIMAL(8,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "fuelStation" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleFuelLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMaintenanceLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "expenseId" TEXT,
    "maintenanceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maintenanceType" "MaintenanceType" NOT NULL DEFAULT 'ROUTINE_SERVICE',
    "garageName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "partsCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "odometerAtService" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceKm" INTEGER,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_branchId_academicYearId_code_key" ON "TransportRoute"("branchId", "academicYearId", "code");
CREATE INDEX "TransportRoute_branchId_academicYearId_isActive_idx" ON "TransportRoute"("branchId", "academicYearId", "isActive");

-- CreateIndex
CREATE INDEX "TransportRouteStop_routeId_sequenceOrder_idx" ON "TransportRouteStop"("routeId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_branchId_registrationNumber_key" ON "TransportVehicle"("branchId", "registrationNumber");
CREATE INDEX "TransportVehicle_branchId_status_idx" ON "TransportVehicle"("branchId", "status");

-- CreateIndex
CREATE INDEX "TransportDriver_branchId_isActive_idx" ON "TransportDriver"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleRouteAssignment_branchId_routeId_vehicleId_academicYearId_termId_key" ON "VehicleRouteAssignment"("branchId", "routeId", "vehicleId", "academicYearId", "termId");
CREATE INDEX "VehicleRouteAssignment_branchId_academicYearId_idx" ON "VehicleRouteAssignment"("branchId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTransportSubscription_branchId_studentId_academicYearId_termId_routeId_key" ON "StudentTransportSubscription"("branchId", "studentId", "academicYearId", "termId", "routeId");
CREATE INDEX "StudentTransportSubscription_branchId_routeId_status_idx" ON "StudentTransportSubscription"("branchId", "routeId", "status");
CREATE INDEX "StudentTransportSubscription_branchId_studentId_idx" ON "StudentTransportSubscription"("branchId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleFuelLog_branchId_fuelStation_receiptNumber_key" ON "VehicleFuelLog"("branchId", "fuelStation", "receiptNumber");
CREATE INDEX "VehicleFuelLog_branchId_vehicleId_logDate_idx" ON "VehicleFuelLog"("branchId", "vehicleId", "logDate");

-- CreateIndex
CREATE INDEX "VehicleMaintenanceLog_branchId_vehicleId_maintenanceDate_idx" ON "VehicleMaintenanceLog"("branchId", "vehicleId", "maintenanceDate");

-- AddForeignKey
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRouteStop" ADD CONSTRAINT "TransportRouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportVehicle" ADD CONSTRAINT "TransportVehicle_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriver" ADD CONSTRAINT "TransportDriver_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportDriver" ADD CONSTRAINT "TransportDriver_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleRouteAssignment" ADD CONSTRAINT "VehicleRouteAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleRouteAssignment" ADD CONSTRAINT "VehicleRouteAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleRouteAssignment" ADD CONSTRAINT "VehicleRouteAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleRouteAssignment" ADD CONSTRAINT "VehicleRouteAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TransportDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleRouteAssignment" ADD CONSTRAINT "VehicleRouteAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleRouteAssignment" ADD CONSTRAINT "VehicleRouteAssignment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTransportSubscription" ADD CONSTRAINT "StudentTransportSubscription_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTransportSubscription" ADD CONSTRAINT "StudentTransportSubscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTransportSubscription" ADD CONSTRAINT "StudentTransportSubscription_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTransportSubscription" ADD CONSTRAINT "StudentTransportSubscription_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "TransportRouteStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentTransportSubscription" ADD CONSTRAINT "StudentTransportSubscription_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTransportSubscription" ADD CONSTRAINT "StudentTransportSubscription_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTransportSubscription" ADD CONSTRAINT "StudentTransportSubscription_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleFuelLog" ADD CONSTRAINT "VehicleFuelLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleFuelLog" ADD CONSTRAINT "VehicleFuelLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleFuelLog" ADD CONSTRAINT "VehicleFuelLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TransportDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleFuelLog" ADD CONSTRAINT "VehicleFuelLog_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenanceLog" ADD CONSTRAINT "VehicleMaintenanceLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleMaintenanceLog" ADD CONSTRAINT "VehicleMaintenanceLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleMaintenanceLog" ADD CONSTRAINT "VehicleMaintenanceLog_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
