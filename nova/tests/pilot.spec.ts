import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('NOVA E2E Tests - Pilot Verification', () => {
  const prisma = new PrismaClient();

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/students');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Full Workflow: Login, Create Student, Attendance, Verify Database', async ({ page }) => {
    // 1. LOGIN
    await page.goto('/login');
    await page.fill('input[name="email"]', 'teacher@alpha.edu');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.locator('h1')).toHaveText('Dashboard');

    // Verify LOGIN audit log
    const loginAudit = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN' },
      orderBy: { timestamp: 'desc' }
    });
    expect(loginAudit).not.toBeNull();

    // 2. STUDENTS LISTING
    await page.goto('/students');
    await expect(page.locator('h1')).toHaveText('Students');

    // 3. CREATE STUDENT
    await page.click('text=New Student');
    await expect(page).toHaveURL(/.*\/students\/new/);
    
    const uniqueId = Date.now().toString().slice(-4);
    const newStudentName = `TestStudent${uniqueId}`;
    const newAdmissionNo = `E2E${uniqueId}`;

    await page.fill('input[name="firstName"]', newStudentName);
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="admissionNo"]', newAdmissionNo);
    await page.click('button:has-text("Create Student")');

    // Verify redirect back to listing and student appears
    await expect(page).toHaveURL(/.*\/students/);
    await expect(page.locator('table')).toContainText(newAdmissionNo);

    // Verify in database
    const dbStudent = await prisma.student.findUnique({
      where: { admissionNo: newAdmissionNo }
    });
    expect(dbStudent).not.toBeNull();
    expect(dbStudent?.firstName).toBe(newStudentName);

    // Assign student to the teacher's branch class to appear in Attendance view via Enrollment
    const teacherUser = await prisma.user.findFirst({ where: { email: 'teacher@alpha.edu' }, include: { branchAccess: true } });
    const teacherBranchId = teacherUser?.branchAccess[0]?.branchId;
    const firstClass = await prisma.class.findFirst({ where: { branchId: teacherBranchId } });
    const settings = await prisma.branchSettings.findFirst({ where: { branchId: teacherBranchId } });
    const activeYear = settings?.activeAcademicYearId ? await prisma.academicYear.findFirst({ where: { id: settings.activeAcademicYearId } }) : null;
    if (firstClass && dbStudent && activeYear) {
      await prisma.enrollment.create({
        data: {
          studentId: dbStudent.id,
          classId: firstClass.id,
          academicYearId: activeYear.id,
          status: 'ACTIVE'
        }
      });
    }

    // 4. ATTENDANCE WORKFLOW
    await page.goto('/attendance');
    await expect(page.locator('h1')).toHaveText('Daily Attendance');
    
    // Select the newly created student and mark present
    const row = page.locator('tr', { hasText: newStudentName });
    await row.locator('button:has-text("Present")').click();
    
    await page.click('button:has-text("Save Attendance")');
    
    // Wait for save to complete (button text changes back from Saving...)
    await expect(page.locator('button:has-text("Saving...")')).toBeHidden({ timeout: 10000 });

    // Verify database directly
    const dbAttendance = await prisma.dailyAttendanceRecord.findFirst({
      where: { studentId: dbStudent?.id }
    });
    expect(dbAttendance).not.toBeNull();
    expect(dbAttendance?.status).toBe('PRESENT');

    // Verify SAVE_ATTENDANCE audit log
    const attendanceAudit = await prisma.auditLog.findFirst({
      where: { action: 'SAVE_ATTENDANCE' },
      orderBy: { timestamp: 'desc' }
    });
    expect(attendanceAudit).not.toBeNull();
  });
});
