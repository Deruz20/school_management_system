-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MarkStatus" AS ENUM ('NOT_ENTERED', 'SCORED', 'ABSENT', 'EXEMPT', 'MALPRACTICE');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('FINALIZED', 'SUPERSEDED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "streamId" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubject" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT,

    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectCombination" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SubjectCombination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombinationSubject" (
    "id" TEXT NOT NULL,
    "combinationId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isCore" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CombinationSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentSubject" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isElective" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EnrollmentSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "classSubjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mark" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "status" "MarkStatus" NOT NULL DEFAULT 'NOT_ENTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeScale" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "grade" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "GradeScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermResult" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION,
    "aggregatePoints" INTEGER,
    "division" INTEGER,
    "status" "ResultStatus" NOT NULL DEFAULT 'FINALIZED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedById" TEXT,
    "supersededById" TEXT,
    "correctionReason" TEXT,

    CONSTRAINT "TermResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermResultSubject" (
    "id" TEXT NOT NULL,
    "termResultId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "grade" TEXT,
    "points" INTEGER,
    "remarks" TEXT,

    CONSTRAINT "TermResultSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_academicYearId_key" ON "Enrollment"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubject_classId_subjectId_academicYearId_key" ON "ClassSubject"("classId", "subjectId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "CombinationSubject_combinationId_subjectId_key" ON "CombinationSubject"("combinationId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentSubject_enrollmentId_subjectId_key" ON "EnrollmentSubject"("enrollmentId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_classSubjectId_termId_name_key" ON "Assessment"("classSubjectId", "termId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_studentId_assessmentId_key" ON "Mark"("studentId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TermResult_enrollmentId_termId_version_key" ON "TermResult"("enrollmentId", "termId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TermResultSubject_termResultId_subjectId_key" ON "TermResultSubject"("termResultId", "subjectId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectCombination" ADD CONSTRAINT "SubjectCombination_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombinationSubject" ADD CONSTRAINT "CombinationSubject_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "SubjectCombination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombinationSubject" ADD CONSTRAINT "CombinationSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeScale" ADD CONSTRAINT "GradeScale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermResult" ADD CONSTRAINT "TermResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermResult" ADD CONSTRAINT "TermResult_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermResult" ADD CONSTRAINT "TermResult_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermResult" ADD CONSTRAINT "TermResult_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "TermResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermResultSubject" ADD CONSTRAINT "TermResultSubject_termResultId_fkey" FOREIGN KEY ("termResultId") REFERENCES "TermResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermResultSubject" ADD CONSTRAINT "TermResultSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom Data Migration: Insert Enrollments for existing Students based on current classId/streamId and active AcademicYear
INSERT INTO "Enrollment" ("id", "studentId", "academicYearId", "classId", "streamId", "status", "createdAt")
SELECT 
    gen_random_uuid()::text,
    s.id,
    ay.id,
    s."classId",
    s."streamId",
    'ACTIVE',
    now()
FROM "Student" s
JOIN "AcademicYear" ay ON s."branchId" = ay."branchId" AND ay."isActive" = true
WHERE s."classId" IS NOT NULL;
