import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — Accounts Payable, Supplier Credit & 3-Way Matching (Phase 3.1N)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `ap_admin_${Date.now()}@test.com`;
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
        firstName: 'Payable',
        lastName: 'Officer',
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

  test('Accounts Payable Hub Navigation, Tabs, Invoices, Suppliers, Settlements and Zero-Drift Telemetry', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Direct Navigation to Accounts Payable Hub
    await page.goto('/finance/accounts-payable');
    await expect(page).toHaveURL('/finance/accounts-payable');
    await expect(page.locator('h1')).toContainText('Accounts Payable & Supplier Credit');

    // 3. KPI Summary Cards
    await expect(page.locator('text=Total Outstanding AP')).toBeVisible();
    await expect(page.locator('text=Overdue AP (31+ Days)')).toBeVisible();
    await expect(page.locator('text=GRNI Accrual (#2120)')).toBeVisible();
    await expect(page.locator('text=Zero-Drift Telemetry')).toBeVisible();

    // 4. Header action buttons
    await expect(page.locator('button:has-text("New Supplier Bill")')).toBeVisible();
    await expect(page.locator('button:has-text("Disburse Payment")')).toBeVisible();
    await expect(page.locator('button:has-text("Add Vendor")')).toBeVisible();

    // 5. Tab Navigation: Invoices
    await expect(page.locator('button:has-text("Invoices & 3-Way Match")')).toBeVisible();

    // 6. Tab Navigation: Vendors
    await page.click('button:has-text("Vendors")');
    await expect(page.locator('th:has-text("Supplier Name")')).toBeVisible();

    // 7. Tab Navigation: Credit Notes
    await page.click('button:has-text("Credit Notes")');
    await expect(page.locator('th:has-text("Credit Note #")')).toBeVisible();

    // 8. Tab Navigation: Settlements
    await page.click('button:has-text("Settlements")');
    await expect(page.locator('th:has-text("Payment #")')).toBeVisible();

    // 9. Tab Navigation: Aged Payables
    await page.click('button:has-text("Aged Payables")');
    await expect(page.locator('text=Aged Payables Schedule')).toBeVisible();
    await expect(page.locator('text=Current (0-30 Days)')).toBeVisible();

    // 10. Tab Navigation: GL Control #2110 Telemetry
    await page.click('button:has-text("GL Control #2110")');
    await expect(page.locator('text=Subledger-to-GL Zero-Drift Telemetry')).toBeVisible();
    await expect(page.locator('text=AP Suppliers Control (#2110)')).toBeVisible();
    await expect(page.locator('text=GRNI Clearing Accrual (#2120)')).toBeVisible();
  });
});
