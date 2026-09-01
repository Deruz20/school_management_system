import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests - Finance Invoicing & Billing Engine (Phase 3.1B)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `invoicing_admin_${Date.now()}@test.com`;
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
        firstName: 'Invoicing',
        lastName: 'Admin',
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
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    await prisma.$disconnect();
  });

  test('Invoicing & Billing Workflow: Bursaries, Bulk Billing, Invoices, Detail View & Voiding', async ({ page }) => {
    // 1. LOGIN
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. NAVIGATE TO STUDENT DISCOUNTS & BURSARIES
    await page.goto('/finance/discounts');
    await expect(page.locator('h1')).toContainText('Student Discounts & Bursaries');

    // Open Create Modal
    await page.click('button:has-text("New Discount / Bursary")');
    await page.fill('input[placeholder*="Staff Child"]', 'E2E Merit Scholarship');
    await page.click('button:has-text("Create Rule")');

    // Verify discount appears in table
    await expect(page.locator('table')).toContainText('E2E Merit Scholarship');

    // 3. NAVIGATE TO BULK CLASS BILLING
    await page.goto('/finance/invoices/bulk');
    await expect(page.locator('h1')).toContainText('Bulk Class Billing Engine');

    // Select fee structure (if needed)
    const selectOptions = await page.locator('select').nth(3).locator('option').allInnerTexts();
    if (selectOptions.length > 1) {
      await page.locator('select').nth(3).selectOption({ index: 1 });
    }

    // Submit bulk generation
    await page.click('button:has-text("Generate Invoices")');
    await expect(page.locator('text=Bulk Billing Completed Successfully!')).toBeVisible({ timeout: 15000 });

    // 4. NAVIGATE TO INVOICES LIST
    await page.goto('/finance/invoices');
    await expect(page.locator('h1')).toContainText('Student Invoices');
    await expect(page.locator('table')).toContainText('INV-2026-');

    // 5. VIEW INVOICE DETAIL
    await page.click('table tbody tr:first-child a:has-text("View")');
    await expect(page.locator('h1')).toContainText('Invoice #INV-2026-');
    await expect(page.locator('text=PENDING PAYMENT')).toBeVisible();

    // 6. VOID INVOICE
    await page.click('button:has-text("Void Invoice")');
    await page.fill('textarea', 'E2E Test Void Confirmation');
    await page.click('button:has-text("Confirm Void")');

    // Verify void state
    await expect(page.locator('text=This invoice has been VOIDED')).toBeVisible();
    await expect(page.locator('text=E2E Test Void Confirmation')).toBeVisible();
  });
});
