-- AlterTable
ALTER TABLE "User" ADD COLUMN "guardianId" TEXT;
ALTER TABLE "User" ADD COLUMN "studentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_guardianId_key" ON "User"("guardianId");
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
