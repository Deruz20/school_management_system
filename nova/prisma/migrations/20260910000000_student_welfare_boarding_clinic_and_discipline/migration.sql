-- CreateEnum
CREATE TYPE "HostelGender" AS ENUM ('MALE', 'FEMALE', 'MIXED');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('STANDARD_DORM', 'CUBICLE', 'PREFECT_ROOM', 'SPECIAL_NEEDS', 'SICK_BAY_RESERVE');

-- CreateEnum
CREATE TYPE "BedType" AS ENUM ('SINGLE', 'BUNK_LOWER', 'BUNK_UPPER');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED');

-- CreateEnum
CREATE TYPE "BedAllocationStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RollCallStatus" AS ENUM ('PRESENT', 'ABSENT', 'SICKBAY', 'AUTHORIZED_ABSENCE');

-- CreateEnum
CREATE TYPE "TriagePriority" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "DiagnosticCategory" AS ENUM ('MALARIA', 'RESPIRATORY', 'GASTROINTESTINAL', 'DENTAL', 'TRAUMA', 'DERMATOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "DisciplineCategory" AS ENUM ('BULLYING', 'SUBSTANCE_ABUSE', 'VANDALISM', 'THEFT', 'TRUANCY', 'INSUBORDINATION', 'FIGHTING', 'ACADEMIC_DISHONESTY', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'SEVERE');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'INVESTIGATING', 'HEARING_SCHEDULED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "HearingPlea" AS ENUM ('GUILTY', 'NOT_GUILTY', 'NO_CONTEST');

-- CreateEnum
CREATE TYPE "SanctionType" AS ENUM ('VERBAL_WARNING', 'WRITTEN_WARNING', 'DETENTION', 'COMMUNITY_SERVICE', 'LOSS_OF_PRIVILEGE', 'SUSPENSION', 'EXPULSION');

-- CreateEnum
CREATE TYPE "SanctionStatus" AS ENUM ('ACTIVE', 'SERVED', 'APPEALED', 'OVERTURNED');

-- CreateEnum
CREATE TYPE "ExeatType" AS ENUM ('MEDICAL', 'FAMILY_EMERGENCY', 'OFFICIAL_SCHOOL_EVENT', 'WEEKEND_EXEAT');

-- CreateEnum
CREATE TYPE "ExeatStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DEPARTED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Hostel" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "HostelGender" NOT NULL DEFAULT 'MIXED',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "wardenId" TEXT,
    "matronId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hostel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostelRoom" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "floorNumber" INTEGER NOT NULL DEFAULT 0,
    "wing" TEXT,
    "roomType" "RoomType" NOT NULL DEFAULT 'STANDARD_DORM',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostelRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostelBed" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedNumber" TEXT NOT NULL,
    "bedCode" TEXT NOT NULL,
    "bedType" "BedType" NOT NULL DEFAULT 'BUNK_LOWER',
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostelBed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedAllocation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "status" "BedAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "allocatedById" TEXT,
    "releasedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostelRollCall" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RollCallStatus" NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "takenById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostelRollCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostelClearanceRecord" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "mattressReturned" BOOLEAN NOT NULL DEFAULT true,
    "roomKeysReturned" BOOLEAN NOT NULL DEFAULT true,
    "lockerKeysReturned" BOOLEAN NOT NULL DEFAULT true,
    "bunkConditionIntact" BOOLEAN NOT NULL DEFAULT true,
    "damagesNoted" BOOLEAN NOT NULL DEFAULT false,
    "damageCostUGX" DECIMAL(12,2),
    "damageDescription" TEXT,
    "invoiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inspectorStaffId" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostelClearanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicEncounter" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "encounterNumber" TEXT NOT NULL,
    "attendingStaffId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "triagePriority" "TriagePriority" NOT NULL DEFAULT 'ROUTINE',
    "temperature" DECIMAL(4,1),
    "pulseRate" INTEGER,
    "bloodPressure" TEXT,
    "respiratoryRate" INTEGER,
    "weightKg" DECIMAL(5,2),
    "chiefComplaint" TEXT NOT NULL,
    "diagnosticCategory" "DiagnosticCategory" NOT NULL DEFAULT 'OTHER',
    "symptomsEncrypted" TEXT,
    "clinicalNotesEncrypted" TEXT,
    "diagnosisEncrypted" TEXT,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SickbayAdmission" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bedNumber" TEXT NOT NULL,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    "dischargeCondition" TEXT,
    "attendingNurseId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SickbayAdmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalReferral" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "externalFacilityName" TEXT NOT NULL,
    "referralReason" TEXT NOT NULL,
    "ambulanceDispatched" BOOLEAN NOT NULL DEFAULT false,
    "escortStaffId" TEXT,
    "guardianNotifiedAt" TIMESTAMP(3),
    "guardianNotificationNotes" TEXT,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicDispensingRecord" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "dosageInstructions" TEXT NOT NULL,
    "dispensedById" TEXT NOT NULL,
    "dispensedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stockMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicDispensingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryIncident" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "reportedById" TEXT NOT NULL,
    "category" "DisciplineCategory" NOT NULL DEFAULT 'OTHER',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MINOR',
    "description" TEXT NOT NULL,
    "witnessNotes" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentStudent" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY_OFFENDER',
    "plea" "HearingPlea" NOT NULL DEFAULT 'NO_CONTEST',
    "statement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryHearing" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "hearingDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "panelChairId" TEXT NOT NULL,
    "panelMembers" TEXT,
    "studentPlea" "HearingPlea" NOT NULL DEFAULT 'NOT_GUILTY',
    "guardianPresent" BOOLEAN NOT NULL DEFAULT false,
    "guardianId" TEXT,
    "hearingMinutes" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryHearing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinarySanction" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "hearingId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sanctionType" "SanctionType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "terms" TEXT NOT NULL,
    "demeritPoints" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT NOT NULL,
    "status" "SanctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lifecycleLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinarySanction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExeatPass" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "exeatNumber" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "exeatType" "ExeatType" NOT NULL DEFAULT 'WEEKEND_EXEAT',
    "reason" TEXT NOT NULL,
    "intendedDeparture" TIMESTAMP(3) NOT NULL,
    "expectedReturn" TIMESTAMP(3) NOT NULL,
    "actualDeparture" TIMESTAMP(3),
    "actualReturn" TIMESTAMP(3),
    "guardianConsent" BOOLEAN NOT NULL DEFAULT true,
    "guardianId" TEXT,
    "guardianConsentMethod" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "gateOfficerDepartId" TEXT,
    "gateOfficerReturnId" TEXT,
    "accompanyingAdult" TEXT,
    "status" "ExeatStatus" NOT NULL DEFAULT 'PENDING',
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "qrVerificationToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExeatPass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyNotificationLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "notificationReason" TEXT NOT NULL,
    "phoneDialed" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "callerStaffId" TEXT NOT NULL,
    "guardianResponseNotes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WelfareSequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextVal" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WelfareSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hostel_branchId_gender_isActive_idx" ON "Hostel"("branchId", "gender", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Hostel_branchId_code_key" ON "Hostel"("branchId", "code");

-- CreateIndex
CREATE INDEX "HostelRoom_branchId_hostelId_idx" ON "HostelRoom"("branchId", "hostelId");

-- CreateIndex
CREATE UNIQUE INDEX "HostelRoom_hostelId_roomNumber_key" ON "HostelRoom"("hostelId", "roomNumber");

-- CreateIndex
CREATE INDEX "HostelBed_branchId_status_idx" ON "HostelBed"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HostelBed_roomId_bedNumber_key" ON "HostelBed"("roomId", "bedNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HostelBed_branchId_bedCode_key" ON "HostelBed"("branchId", "bedCode");

-- CreateIndex
CREATE INDEX "BedAllocation_branchId_studentId_status_idx" ON "BedAllocation"("branchId", "studentId", "status");

-- CreateIndex
CREATE INDEX "BedAllocation_branchId_bedId_status_idx" ON "BedAllocation"("branchId", "bedId", "status");

-- CreateIndex
CREATE INDEX "HostelRollCall_branchId_date_idx" ON "HostelRollCall"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HostelRollCall_hostelId_studentId_date_key" ON "HostelRollCall"("hostelId", "studentId", "date");

-- CreateIndex
CREATE INDEX "HostelClearanceRecord_branchId_status_idx" ON "HostelClearanceRecord"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HostelClearanceRecord_studentId_academicYearId_termId_key" ON "HostelClearanceRecord"("studentId", "academicYearId", "termId");

-- CreateIndex
CREATE INDEX "ClinicEncounter_branchId_studentId_checkInAt_idx" ON "ClinicEncounter"("branchId", "studentId", "checkInAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicEncounter_branchId_encounterNumber_key" ON "ClinicEncounter"("branchId", "encounterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SickbayAdmission_encounterId_key" ON "SickbayAdmission"("encounterId");

-- CreateIndex
CREATE INDEX "SickbayAdmission_branchId_studentId_idx" ON "SickbayAdmission"("branchId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalReferral_encounterId_key" ON "MedicalReferral"("encounterId");

-- CreateIndex
CREATE INDEX "MedicalReferral_branchId_studentId_idx" ON "MedicalReferral"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "ClinicDispensingRecord_branchId_encounterId_idx" ON "ClinicDispensingRecord"("branchId", "encounterId");

-- CreateIndex
CREATE INDEX "ClinicDispensingRecord_branchId_studentId_idx" ON "ClinicDispensingRecord"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "DisciplinaryIncident_branchId_status_idx" ON "DisciplinaryIncident"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplinaryIncident_branchId_incidentNumber_key" ON "DisciplinaryIncident"("branchId", "incidentNumber");

-- CreateIndex
CREATE INDEX "IncidentStudent_branchId_studentId_idx" ON "IncidentStudent"("branchId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentStudent_incidentId_studentId_key" ON "IncidentStudent"("incidentId", "studentId");

-- CreateIndex
CREATE INDEX "DisciplinaryHearing_branchId_incidentId_idx" ON "DisciplinaryHearing"("branchId", "incidentId");

-- CreateIndex
CREATE INDEX "DisciplinarySanction_branchId_studentId_idx" ON "DisciplinarySanction"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "DisciplinarySanction_branchId_sanctionType_idx" ON "DisciplinarySanction"("branchId", "sanctionType");

-- CreateIndex
CREATE UNIQUE INDEX "ExeatPass_qrVerificationToken_key" ON "ExeatPass"("qrVerificationToken");

-- CreateIndex
CREATE INDEX "ExeatPass_branchId_studentId_idx" ON "ExeatPass"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "ExeatPass_branchId_status_idx" ON "ExeatPass"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExeatPass_branchId_exeatNumber_key" ON "ExeatPass"("branchId", "exeatNumber");

-- CreateIndex
CREATE INDEX "EmergencyNotificationLog_branchId_studentId_idx" ON "EmergencyNotificationLog"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "WelfareSequence_branchId_idx" ON "WelfareSequence"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "WelfareSequence_branchId_type_year_key" ON "WelfareSequence"("branchId", "type", "year");

-- AddForeignKey
ALTER TABLE "Hostel" ADD CONSTRAINT "Hostel_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hostel" ADD CONSTRAINT "Hostel_wardenId_fkey" FOREIGN KEY ("wardenId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hostel" ADD CONSTRAINT "Hostel_matronId_fkey" FOREIGN KEY ("matronId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelRoom" ADD CONSTRAINT "HostelRoom_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelRoom" ADD CONSTRAINT "HostelRoom_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelBed" ADD CONSTRAINT "HostelBed_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelBed" ADD CONSTRAINT "HostelBed_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HostelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAllocation" ADD CONSTRAINT "BedAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAllocation" ADD CONSTRAINT "BedAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAllocation" ADD CONSTRAINT "BedAllocation_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "HostelBed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAllocation" ADD CONSTRAINT "BedAllocation_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAllocation" ADD CONSTRAINT "BedAllocation_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAllocation" ADD CONSTRAINT "BedAllocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAllocation" ADD CONSTRAINT "BedAllocation_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelRollCall" ADD CONSTRAINT "HostelRollCall_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelRollCall" ADD CONSTRAINT "HostelRollCall_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelRollCall" ADD CONSTRAINT "HostelRollCall_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelRollCall" ADD CONSTRAINT "HostelRollCall_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelClearanceRecord" ADD CONSTRAINT "HostelClearanceRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelClearanceRecord" ADD CONSTRAINT "HostelClearanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelClearanceRecord" ADD CONSTRAINT "HostelClearanceRecord_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelClearanceRecord" ADD CONSTRAINT "HostelClearanceRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelClearanceRecord" ADD CONSTRAINT "HostelClearanceRecord_inspectorStaffId_fkey" FOREIGN KEY ("inspectorStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicEncounter" ADD CONSTRAINT "ClinicEncounter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicEncounter" ADD CONSTRAINT "ClinicEncounter_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicEncounter" ADD CONSTRAINT "ClinicEncounter_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicEncounter" ADD CONSTRAINT "ClinicEncounter_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicEncounter" ADD CONSTRAINT "ClinicEncounter_attendingStaffId_fkey" FOREIGN KEY ("attendingStaffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SickbayAdmission" ADD CONSTRAINT "SickbayAdmission_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SickbayAdmission" ADD CONSTRAINT "SickbayAdmission_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SickbayAdmission" ADD CONSTRAINT "SickbayAdmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SickbayAdmission" ADD CONSTRAINT "SickbayAdmission_attendingNurseId_fkey" FOREIGN KEY ("attendingNurseId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalReferral" ADD CONSTRAINT "MedicalReferral_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalReferral" ADD CONSTRAINT "MedicalReferral_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalReferral" ADD CONSTRAINT "MedicalReferral_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalReferral" ADD CONSTRAINT "MedicalReferral_escortStaffId_fkey" FOREIGN KEY ("escortStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicDispensingRecord" ADD CONSTRAINT "ClinicDispensingRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicDispensingRecord" ADD CONSTRAINT "ClinicDispensingRecord_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicDispensingRecord" ADD CONSTRAINT "ClinicDispensingRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicDispensingRecord" ADD CONSTRAINT "ClinicDispensingRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicDispensingRecord" ADD CONSTRAINT "ClinicDispensingRecord_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicDispensingRecord" ADD CONSTRAINT "ClinicDispensingRecord_dispensedById_fkey" FOREIGN KEY ("dispensedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryIncident" ADD CONSTRAINT "DisciplinaryIncident_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryIncident" ADD CONSTRAINT "DisciplinaryIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentStudent" ADD CONSTRAINT "IncidentStudent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentStudent" ADD CONSTRAINT "IncidentStudent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "DisciplinaryIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentStudent" ADD CONSTRAINT "IncidentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryHearing" ADD CONSTRAINT "DisciplinaryHearing_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryHearing" ADD CONSTRAINT "DisciplinaryHearing_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "DisciplinaryIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryHearing" ADD CONSTRAINT "DisciplinaryHearing_panelChairId_fkey" FOREIGN KEY ("panelChairId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryHearing" ADD CONSTRAINT "DisciplinaryHearing_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinarySanction" ADD CONSTRAINT "DisciplinarySanction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinarySanction" ADD CONSTRAINT "DisciplinarySanction_hearingId_fkey" FOREIGN KEY ("hearingId") REFERENCES "DisciplinaryHearing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinarySanction" ADD CONSTRAINT "DisciplinarySanction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinarySanction" ADD CONSTRAINT "DisciplinarySanction_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExeatPass" ADD CONSTRAINT "ExeatPass_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExeatPass" ADD CONSTRAINT "ExeatPass_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExeatPass" ADD CONSTRAINT "ExeatPass_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExeatPass" ADD CONSTRAINT "ExeatPass_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExeatPass" ADD CONSTRAINT "ExeatPass_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExeatPass" ADD CONSTRAINT "ExeatPass_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExeatPass" ADD CONSTRAINT "ExeatPass_gateOfficerDepartId_fkey" FOREIGN KEY ("gateOfficerDepartId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExeatPass" ADD CONSTRAINT "ExeatPass_gateOfficerReturnId_fkey" FOREIGN KEY ("gateOfficerReturnId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyNotificationLog" ADD CONSTRAINT "EmergencyNotificationLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyNotificationLog" ADD CONSTRAINT "EmergencyNotificationLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyNotificationLog" ADD CONSTRAINT "EmergencyNotificationLog_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyNotificationLog" ADD CONSTRAINT "EmergencyNotificationLog_callerStaffId_fkey" FOREIGN KEY ("callerStaffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelfareSequence" ADD CONSTRAINT "WelfareSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

