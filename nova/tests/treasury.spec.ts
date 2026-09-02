import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — School Treasury, Cashbook & Bank Reconciliation (Phase 3.1K)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `treasury_admin_${Date.now()}@test.com`;
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
        firstName: 'Treasury',
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

  test('Treasury Hub Navigation, Tab Switching, and Account Creation Modal', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Navigate to Finance Overview
    await page.goto('/finance');
    await expect(page.locator('text=Treasury & Bank Reconciliation')).toBeVisible();

    // 3. Open Treasury Hub
    await page.click('a[href="/finance/treasury"]:has-text("Treasury Hub")');
    await expect(page).toHaveURL('/finance/treasury');
    await expect(page.locator('h1')).toContainText('School Treasury, Multi-Account Cashbook');

    // 4. Switch Tabs
    await page.click('button:has-text("Cashier Shifts")');
    await expect(page.locator('h2:has-text("Cashier Drawer Shift Sessions")')).toBeVisible();

    await page.click('button:has-text("Transfers & Banking Deposits")');
    await expect(page.locator('h2:has-text("Inter-Account Transfers")')).toBeVisible();

    await page.click('button:has-text("Petty Cash Imprest")');
    await expect(page.locator('h2:has-text("Petty Cash Imprest Floats")')).toBeVisible();

    await page.click('button:has-text("Bank Reconciliation & BRS")');
    await expect(page.locator('h2:has-text("Certified Statutory Bank Reconciliation")')).toBeVisible();

    // 5. Open New Treasury Account Modal
    await page.click('button:has-text("New Treasury Account")');
    await expect(page.locator('h3:has-text("Create New Treasury Account")')).toBeVisible();

    // Fill form
    const code = `E2E-BNK-${Date.now().toString().slice(-4)}`;
    await page.fill('input[placeholder="e.g. STANBIC-MAIN"]', code);
    await page.fill('input[placeholder="e.g. Stanbic School Fees Collection"]', 'E2E Test Account');
    await page.fill('input[placeholder="e.g. Stanbic Bank"]', 'E2E Bank Ltd');
    await page.fill('input[placeholder="e.g. 9030012345"]', '1122334455');
    await page.fill('input[type="number"]', '500000');

    // Submit form
    await page.click('button[type="submit"]:has-text("Create Account")');

    // 6. Verify success alert and account row in table
    await expect(page.locator(`text=Treasury account E2E Test Account successfully created.`)).toBeVisible();
    await page.click('button:has-text("Accounts & Cashbook")');
    await expect(page.locator(`text=${code}`)).toBeVisible();
  });
});
