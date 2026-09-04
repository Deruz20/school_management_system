import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — Student Welfare, Boarding, Clinic, Discipline & Exeat (Phase 3.2B)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `welfare_e2e_admin_${Date.now()}@test.com`;
  const adminPassword = 'password123';
  test.beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });
    if (!branch) throw new Error("No branch found");

    let adminRole = await prisma.role.findFirst({ where: { name: 'Admin', organizationId: org?.id } });
    if (!adminRole) {
      adminRole = await prisma.role.create({ data: { name: 'Admin', permissions: ['all'], organizationId: org!.id } });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Welfare',
        lastName: 'Director',
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
  });

  test.afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { email: adminEmail } });
    } catch {
      // Best-effort cleanup
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Hostel & Dormitory Boarding Dashboard Navigation & Workflows', async ({ page }) => {
    // 1. Authenticate
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to Boarding
    await page.goto('/welfare/boarding');
    await expect(page.locator('h1')).toContainText('Hostel & Boarding Management');
    await expect(page.locator('text=Total Bed Capacity').first()).toBeVisible();
    await expect(page.locator('text=Boarding Occupancy').first()).toBeVisible();
    await expect(page.locator('button:has-text("Allocate Bed")')).toBeVisible();
  });

  test('Infirmary & Clinical Encounters Dashboard Navigation & Triage', async ({ page }) => {
    // 1. Authenticate
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to Clinic
    await page.goto('/welfare/clinic');
    await expect(page.locator('h1')).toContainText('Clinic & Infirmary Management');
    await expect(page.locator('text=Total Consultations').first()).toBeVisible();
    await expect(page.locator('text=Sickbay Admitted').first()).toBeVisible();
    await expect(page.locator('button:has-text("New Clinic Triage Encounter")')).toBeVisible();
  });

  test('Disciplinary Board & Governance Dashboard Navigation', async ({ page }) => {
    // 1. Authenticate
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to Discipline
    await page.goto('/welfare/discipline');
    await expect(page.locator('h1')).toContainText('Student Discipline & Behavior');
    await expect(page.locator('text=Total Incidents').first()).toBeVisible();
    await expect(page.locator('text=Hearings Resolved').first()).toBeVisible();
    await expect(page.locator('button:has-text("Log Disciplinary Incident")')).toBeVisible();
  });

  test('Exeat Passes & Gate Security Station Navigation', async ({ page }) => {
    // 1. Authenticate
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to Exeat
    await page.goto('/welfare/exeat');
    await expect(page.locator('h1')).toContainText('Exeat & Gate-Pass Management');
    await expect(page.locator('text=Currently Off-Campus').first()).toBeVisible();
    await expect(page.locator('text=Overdue Passes').first()).toBeVisible();
    await expect(page.locator('button:has-text("Issue New Exeat")')).toBeVisible();
    await expect(page.locator('input[placeholder*="48-char QR Token"]')).toBeVisible();
  });
});
