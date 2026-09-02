import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — School Stores, Inventory & Procurement Engine (Phase 3.1J)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `inv_admin_${Date.now()}@test.com`;
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
        firstName: 'Inventory',
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

  test('Inventory Workstation Navigation, Tabs, Catalog, and Actions', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Navigate to Finance Overview
    await page.goto('/finance');
    await expect(page.locator('text=Stores, Inventory & Procurement')).toBeVisible();

    // 3. Open Inventory Hub
    await page.click('a[href="/finance/inventory"]:has-text("Inventory Hub")');
    await expect(page).toHaveURL('/finance/inventory');
    await expect(page.locator('h1')).toContainText('School Stores, Procurement & Student Store Engine');

    // 4. Switch Tabs & Inspect
    await page.click('button:has-text("Stocks & Catalog")');
    await expect(page.locator('h2:has-text("Item Master & Stock Quantities")')).toBeVisible();

    await page.click('button:has-text("Procurement & GRN")');
    await expect(page.locator('h2:has-text("Purchase Orders & Goods Receiving")')).toBeVisible();

    await page.click('button:has-text("Student Store POS")');
    await expect(page.locator('h2:has-text("Student Store & Uniform Sales Counter")')).toBeVisible();

    await page.click('button:has-text("Department Requisitions")');
    await expect(page.locator('h2:has-text("Department Requisitions & Stock Issues")')).toBeVisible();

    await page.click('button:has-text("Audit & Valuation")');
    await expect(page.locator('h2:has-text("Inventory Valuation & Store Balances")')).toBeVisible();

    // 5. Open New Item Modal
    await page.click('button:has-text("+ New Item")');
    await expect(page.locator('h3:has-text("Add Catalog Item")')).toBeVisible();
    await page.click('button:has-text("Cancel")');

    // 6. Open Store Transfer Modal
    await page.click('button:has-text("⇄ Store Transfer")');
  });
});
