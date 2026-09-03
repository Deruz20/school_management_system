-- CreateEnum
CREATE TYPE "BoardingStatus" AS ENUM ('DAY', 'BOARDING');

-- CreateEnum
CREATE TYPE "StudentLifecycleStatus" AS ENUM ('PROSPECTIVE', 'ACTIVE', 'SUSPENDED', 'DEFERRED', 'TRANSFERRED_OUT', 'EXPELLED', 'GRADUATED', 'DECEASED');

-- CreateEnum
CREATE TYPE "ApplicantStatus" AS ENUM ('INQUIRY', 'SUBMITTED', 'UNDER_REVIEW', 'ASSESSMENT_SCHEDULED', 'ADMISSION_OFFERED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'ENROLLED', 'WAITLISTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "GuardianRelationship" AS ENUM ('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'SPONSOR', 'NEXT_OF_KIN', 'FOSTER_PARENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BIRTH_CERTIFICATE', 'PLE_RESULT_SLIP', 'UCE_RESULT_SLIP', 'UACE_RESULT_SLIP', 'TRANSFER_LETTER_EMIS', 'PASSPORT_PHOTO', 'IMMUNIZATION_CARD', 'NATIONAL_ID_NIN', 'LEGAL_GUARDIANSHIP_DOC', 'OTHER');

-- CreateEnum
CREATE TYPE "DocVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProvisioningTaskStatus" AS ENUM ('PENDING', 'SKIPPED', 'COMPLETED', 'FAILED_RETRYABLE', 'FAILED_FATAL');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "applicantId" TEXT,
ADD COLUMN     "birthCertNo" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "dayOrBoarding" "BoardingStatus" NOT NULL DEFAULT 'DAY',
ADD COLUMN     "district" TEXT,
ADD COLUMN     "familyGroupId" TEXT,
ADD COLUMN     "graduatedDate" TIMESTAMP(3),
ADD COLUMN     "lifecycleStatus" "StudentLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "linEmisNo" TEXT,
ADD COLUMN     "medicalEmergencyNotes" TEXT,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "nationality" TEXT NOT NULL DEFAULT 'Ugandan',
ADD COLUMN     "nin" TEXT,
ADD COLUMN     "ninLookupHash" TEXT,
ADD COLUMN     "parish" TEXT,
ADD COLUMN     "passportNo" TEXT,
ADD COLUMN     "pleAggregate" INTEGER,
ADD COLUMN     "pleDivision" TEXT,
ADD COLUMN     "pleIndexNo" TEXT,
ADD COLUMN     "previousClass" TEXT,
ADD COLUMN     "previousSchoolName" TEXT,
ADD COLUMN     "residentialAddress" TEXT,
ADD COLUMN     "specialNeeds" TEXT,
ADD COLUMN     "subCounty" TEXT,
ADD COLUMN     "uceAggregate" INTEGER,
ADD COLUMN     "uceIndexNo" TEXT,
ADD COLUMN     "villageLCI" TEXT,
ADD COLUMN     "withdrawnDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdmissionSequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyGroup" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "familyCode" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "guardianCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "title" TEXT,
    "relationshipType" "GuardianRelationship" NOT NULL DEFAULT 'LEGAL_GUARDIAN',
    "phonePrimary" TEXT NOT NULL,
    "phoneSecondary" TEXT,
    "email" TEXT,
    "nationalId" TEXT,
    "ninLookupHash" TEXT,
    "passportNo" TEXT,
    "occupation" TEXT,
    "employer" TEXT,
    "workplaceAddress" TEXT,
    "residentialAddress" TEXT,
    "provenance" TEXT NOT NULL DEFAULT 'MANUAL_INTAKE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "familyGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" "GuardianRelationship" NOT NULL,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "isFinancialSponsor" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "hasPickupAuthorization" BOOLEAN NOT NULL DEFAULT false,
    "receivesAcademicReports" BOOLEAN NOT NULL DEFAULT true,
    "receivesSmsAlerts" BOOLEAN NOT NULL DEFAULT true,
    "accessPriority" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "targetClassId" TEXT NOT NULL,
    "targetStreamId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT NOT NULL DEFAULT 'Ugandan',
    "nin" TEXT,
    "ninLookupHash" TEXT,
    "linEmisNo" TEXT,
    "birthCertNo" TEXT,
    "passportNo" TEXT,
    "dayOrBoarding" "BoardingStatus" NOT NULL DEFAULT 'DAY',
    "residentialAddress" TEXT,
    "villageLCI" TEXT,
    "parish" TEXT,
    "subCounty" TEXT,
    "district" TEXT,
    "previousSchoolName" TEXT,
    "previousClass" TEXT,
    "pleIndexNo" TEXT,
    "pleAggregate" INTEGER,
    "pleDivision" TEXT,
    "uceIndexNo" TEXT,
    "uceAggregate" INTEGER,
    "medicalEmergencyNotes" TEXT,
    "allergies" TEXT,
    "bloodGroup" TEXT,
    "specialNeeds" TEXT,
    "intendedTransportRouteId" TEXT,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'INQUIRY',
    "applicationFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "applicationPaymentId" TEXT,
    "assessmentScore" DOUBLE PRECISION,
    "assessmentNotes" TEXT,
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "decisionById" TEXT,
    "decisionDate" TIMESTAMP(3),
    "offerValidUntil" TIMESTAMP(3),
    "enrolledStudentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantGuardian" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" "GuardianRelationship" NOT NULL,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "isFinancialSponsor" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "hasPickupAuthorization" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicantGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "sha256Checksum" TEXT,
    "verificationStatus" "DocVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantDocument" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "sha256Checksum" TEXT,
    "verificationStatus" "DocVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLifecycleLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromStatus" "StudentLifecycleStatus" NOT NULL,
    "toStatus" "StudentLifecycleStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizedById" TEXT,
    "clearanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentLifecycleLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentProvisioning" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "overallStatus" "ProvisioningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "billingStatus" "ProvisioningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "billingInvoiceId" TEXT,
    "billingError" TEXT,
    "requirementsStatus" "ProvisioningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "requirementsError" TEXT,
    "transportStatus" "ProvisioningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "transportError" TEXT,
    "storeOrderStatus" "ProvisioningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "storeOrderError" TEXT,
    "schoolPayStatus" "ProvisioningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "schoolPayError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrollmentProvisioning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionSequence_branchId_type_year_key" ON "AdmissionSequence"("branchId", "type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyGroup_branchId_familyCode_key" ON "FamilyGroup"("branchId", "familyCode");

-- CreateIndex
CREATE INDEX "Guardian_branchId_phonePrimary_idx" ON "Guardian"("branchId", "phonePrimary");

-- CreateIndex
CREATE INDEX "Guardian_branchId_ninLookupHash_idx" ON "Guardian"("branchId", "ninLookupHash");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_branchId_guardianCode_key" ON "Guardian"("branchId", "guardianCode");

-- CreateIndex
CREATE INDEX "StudentGuardian_branchId_studentId_idx" ON "StudentGuardian"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "StudentGuardian_branchId_guardianId_idx" ON "StudentGuardian"("branchId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_enrolledStudentId_key" ON "Applicant"("enrolledStudentId");

-- CreateIndex
CREATE INDEX "Applicant_branchId_status_idx" ON "Applicant"("branchId", "status");

-- CreateIndex
CREATE INDEX "Applicant_branchId_ninLookupHash_idx" ON "Applicant"("branchId", "ninLookupHash");

-- CreateIndex
CREATE INDEX "Applicant_branchId_targetClassId_idx" ON "Applicant"("branchId", "targetClassId");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_branchId_applicationNumber_key" ON "Applicant"("branchId", "applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantGuardian_applicantId_guardianId_key" ON "ApplicantGuardian"("applicantId", "guardianId");

-- CreateIndex
CREATE INDEX "StudentDocument_branchId_studentId_idx" ON "StudentDocument"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "StudentDocument_branchId_verificationStatus_idx" ON "StudentDocument"("branchId", "verificationStatus");

-- CreateIndex
CREATE INDEX "ApplicantDocument_branchId_applicantId_idx" ON "ApplicantDocument"("branchId", "applicantId");

-- CreateIndex
CREATE INDEX "StudentLifecycleLog_branchId_studentId_idx" ON "StudentLifecycleLog"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "StudentLifecycleLog_branchId_effectiveDate_idx" ON "StudentLifecycleLog"("branchId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentProvisioning_enrollmentId_key" ON "EnrollmentProvisioning"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentProvisioning_branchId_overallStatus_idx" ON "EnrollmentProvisioning"("branchId", "overallStatus");

-- CreateIndex
CREATE INDEX "EnrollmentProvisioning_nextRetryAt_idx" ON "EnrollmentProvisioning"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_applicantId_key" ON "Student"("applicantId");

-- CreateIndex
CREATE INDEX "Student_branchId_lifecycleStatus_idx" ON "Student"("branchId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "Student_branchId_ninLookupHash_idx" ON "Student"("branchId", "ninLookupHash");

-- CreateIndex
CREATE INDEX "Student_branchId_linEmisNo_idx" ON "Student"("branchId", "linEmisNo");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionSequence" ADD CONSTRAINT "AdmissionSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGroup" ADD CONSTRAINT "FamilyGroup_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_targetStreamId_fkey" FOREIGN KEY ("targetStreamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_decisionById_fkey" FOREIGN KEY ("decisionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantGuardian" ADD CONSTRAINT "ApplicantGuardian_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantGuardian" ADD CONSTRAINT "ApplicantGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLifecycleLog" ADD CONSTRAINT "StudentLifecycleLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLifecycleLog" ADD CONSTRAINT "StudentLifecycleLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLifecycleLog" ADD CONSTRAINT "StudentLifecycleLog_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentProvisioning" ADD CONSTRAINT "EnrollmentProvisioning_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentProvisioning" ADD CONSTRAINT "EnrollmentProvisioning_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentProvisioning" ADD CONSTRAINT "EnrollmentProvisioning_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
