-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "organizationId" TEXT;
UPDATE "Role" SET "organizationId" = (SELECT id FROM "Organization" LIMIT 1);
ALTER TABLE "Role" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateTable
CREATE TABLE "BranchSettings" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "brandingLogoUrl" TEXT,
    "brandingMotto" TEXT,
    "activeAcademicYearId" TEXT,
    "activeTermId" TEXT,

    CONSTRAINT "BranchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchSettings_branchId_key" ON "BranchSettings"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_name_key" ON "Role"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "BranchSettings" ADD CONSTRAINT "BranchSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSettings" ADD CONSTRAINT "BranchSettings_activeAcademicYearId_fkey" FOREIGN KEY ("activeAcademicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSettings" ADD CONSTRAINT "BranchSettings_activeTermId_fkey" FOREIGN KEY ("activeTermId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

