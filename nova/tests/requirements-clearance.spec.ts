import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — School Requirements & Student Financial Clearance Engine (Phase 3.1H)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `req_admin_${Date.now()}@test.com`;
  const adminPassword = 'password123';

  test.beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });

    let adminRole = await prisma.role.findFirst({ where: { name: 'Admin', organizationId: org?.id } });
    if (!adminRole) {
      adminRole = await prisma.role.create({ data: { name: 'Admin', permissions: ['all'], organizationId: org!.id } });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Requirements',
        lastName: 'Manager',
        passwordHash,
        userType: 'STAFF',
        organizationId: org!.id,
        branchAccess: {
          create: {
            branchId: branch!.id,
            roleId: adminRole.id,
          },
        },
      },
    });
  });

  test('Requirements Hub & Financial Clearance Navigation and Workflows', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Navigate to Finance Hub
    await page.goto('/finance');
    await expect(page.locator('text=Requirements & In-Kind')).toBeVisible();
    await expect(page.locator('text=Clearance & Exam Permits')).toBeVisible();

    // 3. Navigate to Requirements Hub
    await page.click('a[href="/finance/requirements"]:has-text("Requirements Hub")');
    await expect(page).toHaveURL('/finance/requirements');
    await expect(page.locator('h1')).toContainText('School Requirements & In-Kind Collections');

    // 4. Switch Tabs
    await page.click('button:has-text("Class Blueprints")');
    await expect(page.locator('button:has-text("Class Blueprints")')).toHaveClass(/bg-white/);

    await page.click('button:has-text("Item Catalog")');
    await expect(page.locator('text=Standard Requirement Catalog')).toBeVisible();

    await page.click('button:has-text("Storekeeper Tally")');
    await expect(page.locator('text=Storekeeper Physical Goods Custody Tally')).toBeVisible();

    // 5. Navigate to Clearance Hub
    await page.goto('/finance/clearance');
    await expect(page).toHaveURL('/finance/clearance');
    await expect(page.locator('h1')).toContainText('Student Financial Clearance & Exam Permits');
    await expect(page.locator('text=Issued Clearance Documents')).toBeVisible();
  });
});
