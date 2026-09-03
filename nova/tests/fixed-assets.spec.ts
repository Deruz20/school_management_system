import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — Fixed Assets, Capital Asset Register & Depreciation Engine (Phase 3.1M)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `asset_admin_${Date.now()}@test.com`;
  const adminPassword = 'password123';

  test.beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });

    let adminRole = await prisma.role.findFirst({ where: { name: 'Admin', organizationId: org?.id } });
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: { name: 'Admin', permissions: ['all'], organizationId: org!.id },
      });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Asset',
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

  test('Fixed Assets Register Hub Navigation, Tabs, Acquisition, Depreciation, and Zero-Drift Telemetry', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Direct Navigation to Fixed Assets Hub
    await page.goto('/finance/assets');
    await expect(page).toHaveURL('/finance/assets');
    await expect(page.locator('h1')).toContainText('Fixed Assets & Depreciation');

    // 3. KPI Summary Cards
    await expect(page.locator('text=Gross Asset Value (Cost)')).toBeVisible();
    await expect(page.locator('text=Accumulated Depreciation').first()).toBeVisible();
    await expect(page.locator('text=Net Book Value (Balance Sheet)')).toBeVisible();
    await expect(page.locator('text=Subledger / GL Telemetry')).toBeVisible();

    // 4. Header action buttons
    await expect(page.locator('button:has-text("Acquire Asset")')).toBeVisible();
    await expect(page.locator('button:has-text("Opening Assets")')).toBeVisible();
    await expect(page.locator('button:has-text("New Deprec Run")')).toBeVisible();

    // 5. Tab 1: Asset Register
    await expect(page.locator('button:has-text("Asset Register")')).toBeVisible();

    // 6. Tab 2: Depreciation Engine
    await page.click('button:has-text("Depreciation Engine")');
    await expect(page.locator('text=Periodic Depreciation Runs (Maker-Checker)')).toBeVisible();
    await expect(page.locator('button:has-text("Schedule New Run")')).toBeVisible();

    // 7. Tab 3: GL Reconciliation & Telemetry
    await page.click('button:has-text("GL Reconciliation & Telemetry")');
    await expect(page.locator('text=Fixed Assets vs General Ledger Audit')).toBeVisible();
    await expect(page.locator('text=Gross PPE Cost')).toBeVisible();

    // 8. Tab 4: Categories & Locations
    await page.click('button:has-text("Categories & Locations")');
    await expect(page.locator('text=Asset Categories')).toBeVisible();
    await expect(page.locator('text=Campus Locations')).toBeVisible();
  });
});
