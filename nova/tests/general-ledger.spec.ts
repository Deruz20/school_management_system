import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — General Ledger & Double-Entry Accounting (Phase 3.1L)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `gl_admin_${Date.now()}@test.com`;
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
        firstName: 'Chief',
        lastName: 'Accountant',
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

  test('General Ledger Hub Navigation, Tabs, Financial Statements, and Reconciliation Telemetry', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Direct Navigation to General Ledger
    await page.goto('/finance/general-ledger');
    await expect(page).toHaveURL('/finance/general-ledger');
    await expect(page.locator('h1')).toContainText('General Ledger & Double-Entry Accounting');

    // 3. Tab 1: Chart of Accounts
    await expect(page.locator('button:has-text("Chart of Accounts")')).toBeVisible();
    await expect(page.locator('text=Commercial Bank Accounts')).toBeVisible();

    // 4. Tab 2: Journal Entries
    await page.click('button:has-text("Journal Entries")');
    await expect(page.locator('text=Double-Entry Journal Vouchers')).toBeVisible();

    // 5. Tab 3: Financial Statements
    await page.click('button:has-text("Financial Statements")');
    await expect(page.locator('button:has-text("Trial Balance (TB)")')).toBeVisible();
    await expect(page.locator('button:has-text("Statement of Comprehensive Income (P&L)")')).toBeVisible();
    await expect(page.locator('button:has-text("Statement of Financial Position (Balance Sheet)")')).toBeVisible();

    // 6. Tab 4: Fiscal Periods
    await page.click('button:has-text("Fiscal Periods")');
    await expect(page.locator('text=Fiscal Period Controls')).toBeVisible();

    // 7. Tab 5: Subledger Reconciliation
    await page.click('button:has-text("Subledger Drift")');
    await expect(page.locator('text=Subledger-to-GL Real-Time Reconciliation')).toBeVisible();
    await expect(page.locator('text=1. Accounts Receivable (AR)')).toBeVisible();
    await expect(page.locator('text=2. Treasury & Cashbook')).toBeVisible();
    await expect(page.locator('text=3. Stores Inventory Asset')).toBeVisible();
  });
});
