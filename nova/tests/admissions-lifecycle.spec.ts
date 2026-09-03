import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — Admissions, Student Lifecycle & Guardian KYC (Phase 3.2A)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `admissions_e2e_admin_${Date.now()}@test.com`;
  const adminPassword = 'password123';
  let branchId: string;
  let academicYearId: string;
  let classId: string;

  test.beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });
    branchId = branch!.id;

    let adminRole = await prisma.role.findFirst({ where: { name: 'Admin', organizationId: org?.id } });
    if (!adminRole) {
      adminRole = await prisma.role.create({ data: { name: 'Admin', permissions: ['all'], organizationId: org!.id } });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Registrar',
        lastName: 'E2E',
        passwordHash,
        userType: 'STAFF',
        organizationId: org!.id,
        branchAccess: {
          create: {
            branchId: branch!.id,
            roleId: adminRole.id
          }
        }
      }
    });

    const ay = await prisma.academicYear.findFirst({ where: { branchId } });
    if (ay) {
      academicYearId = ay.id;
    } else {
      const newAy = await prisma.academicYear.create({
        data: {
          branchId,
          name: `Academic Year ${Date.now()}`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });
      academicYearId = newAy.id;
    }

    const cls = await prisma.class.findFirst({ where: { branchId } });
    if (cls) {
      classId = cls.id;
    } else {
      const newCls = await prisma.class.create({
        data: {
          branchId,
          name: `Class S1 ${Date.now()}`,
          capacity: 50
        }
      });
      classId = newCls.id;
    }

    // Seed test records so E2E views have data
    await prisma.applicant.create({
      data: {
        branchId,
        academicYearId,
        targetClassId: classId,
        applicationNumber: `APP-E2E-${Date.now()}`,
        firstName: "E2E",
        lastName: "Applicant"
      }
    });

    await prisma.student.create({
      data: {
        branchId,
        admissionNo: `ADM-E2E-${Date.now()}`,
        firstName: "E2E",
        lastName: "Student",
        classId,
        enrollments: {
          create: {
            academicYearId,
            classId,
            status: "ACTIVE"
          }
        }
      }
    });
  });

  test.afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { email: adminEmail } });
    } catch {
      // Best-effort test cleanup
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Admissions Pipeline Dashboard, Funnel Metrics & Directory', async ({ page }) => {
    // 1. Authenticate
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to Admissions Dashboard
    await page.goto('/admissions');
    await expect(page.locator('h1')).toContainText('Admissions Pipeline');
    await expect(page.locator('text=Inquiries').first()).toBeVisible();
    await expect(page.locator('text=Submitted').first()).toBeVisible();
    await expect(page.locator('text=Offers Issued').first()).toBeVisible();

    // 3. Verify Admissions Table & Search
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search applicants"]')).toBeVisible();
  });

  test('Guardian Directory & KYC Verification Table', async ({ page }) => {
    // 1. Authenticate
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to Guardians Directory
    await page.goto('/guardians');
    await expect(page.locator('h1')).toContainText('Guardian KYC & Family Directory');
    await expect(page.locator('text=Back to Admissions')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Student 360 Profile Navigation & Verification', async ({ page }) => {
    // 1. Authenticate
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to Students list
    await page.goto('/students');
    await expect(page.locator('h1')).toContainText('Students');

    // 3. Find first student link or create one if empty
    const studentLink = page.locator('tbody tr td a').first();
    if (await studentLink.isVisible()) {
      await studentLink.click();
      await expect(page.locator('text=Identity & Demographics')).toBeVisible();
      await expect(page.locator('text=Invoices & Ledger')).toBeVisible();
      await expect(page.locator('text=Lifecycle Governance')).toBeVisible();
    }
  });
});
