import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — School Transport & Fleet Operations Hub (Phase 3.1I)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `trans_admin_${Date.now()}@test.com`;
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
        firstName: 'Transport',
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

  test('Transport Hub Navigation, Fleet Directories, Logs, and Modals', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Navigate to Finance Overview
    await page.goto('/finance');
    await expect(page.locator('text=Transport & Fleet Operations')).toBeVisible();

    // 3. Open Transport Hub
    await page.click('a[href="/finance/transport"]:has-text("Transport Hub")');
    await expect(page).toHaveURL('/finance/transport');
    await expect(page.locator('h1')).toContainText('School Transport & Fleet Operations Hub');

    // 4. Switch Tabs
    await page.click('button:has-text("Routes & Stages")');
    await expect(page.locator('h2:has-text("Transport Routes & Pricing Catalog")')).toBeVisible();

    await page.click('button:has-text("Fleet & Drivers")');
    await expect(page.locator('h2:has-text("School Fleet Directory")')).toBeVisible();
    await expect(page.locator('h2:has-text("Licensed Drivers Directory")')).toBeVisible();

    await page.click('button:has-text("Fuel & Maintenance")');
    await expect(page.locator('h2:has-text("Vehicle Fuel Purchases")')).toBeVisible();
    await expect(page.locator('h2:has-text("Vehicle Maintenance & Repairs")')).toBeVisible();

    await page.click('button:has-text("Profitability & Analytics")');
    await expect(page.locator('h2:has-text("Fleet Operating Efficiency & Utilization")')).toBeVisible();

    // 5. Test Modals
    await page.click('button:has-text("+ Enroll Student")');
    await expect(page.locator('h3:has-text("Enroll Student in Transport Route")')).toBeVisible();
    await page.click('button:has-text("Cancel")');

    await page.click('button:has-text("📋 Daily Manifest")');
    await expect(page.locator('h3:has-text("Daily Passenger Commute Manifest")')).toBeVisible();
    await page.click('button:has-text("✕")');
  });
});
