import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — Expenses & Financial Reports (Phase 3.1D)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `exp_rep_admin_${Date.now()}@test.com`;
  const adminPassword = 'password123';

  test.beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });

    let adminRole = await prisma.role.findFirst({ where: { name: 'Admin', organizationId: org?.id } });
    if (!adminRole) {
      adminRole = await prisma.role.create({ data: { name: 'Admin', permissions: ['all'], organizationId: org!.id } });
    }

    let cat = await prisma.expenseCategory.findFirst({ where: { branchId: branch!.id } });
    if (!cat) {
      cat = await prisma.expenseCategory.create({
        data: {
          branchId: branch!.id,
          name: 'Laboratory Supplies',
          code: `LAB_${Date.now()}`,
          isActive: true
        }
      });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Report',
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
    try {
      await prisma.expense.deleteMany({ where: { title: { contains: 'E2E' } } });
      await prisma.user.deleteMany({ where: { email: adminEmail } });
    } catch {
      // Best-effort test cleanup
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Expenses & Financial Reports Workflow', async ({ page }) => {
    // 1. LOGIN
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. NAVIGATE TO EXPENSES
    await page.goto('/finance/expenses');
    await expect(page.locator('h1')).toContainText('School Expenses');
    await expect(page.getByText('Total Expenses This Month')).toBeVisible();
    await expect(page.getByText('Total Expenses This Year')).toBeVisible();

    // 3. RECORD OPERATIONAL EXPENSE VIA MODAL
    await page.click('button:has-text("Record Expense")');
    await expect(page.getByText('Record Operational Expense')).toBeVisible();

    await page.fill('input[placeholder*="Generator"]', 'E2E Science Chemicals Outflow');
    await page.fill('input[placeholder*="450000"]', '175000');
    await page.fill('input[placeholder*="TotalEnergies"]', 'E2E Lab Supplies Ltd');

    const [postRes] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/expenses') && res.request().method() === 'POST'),
      page.click('form button[type="submit"]:has-text("Record Expense")')
    ]);
    const postStatus = postRes.status();
    const postText = await postRes.text();
    if (postStatus !== 201) {
      console.log('API POST /api/expenses FAILED WITH:', postStatus, postText);
    }
    expect(postStatus).toBe(201);

    // Verify row appears in list
    await expect(page.getByText('E2E Science Chemicals Outflow')).toBeVisible();

    // 4. VOID THE EXPENSE VOUCHER
    const voidBtn = page.locator('tr:has-text("E2E Science Chemicals Outflow") button:has-text("Void")');
    if (await voidBtn.isVisible()) {
      await voidBtn.click();
      await expect(page.getByText('Void Expense Voucher')).toBeVisible();
      await page.fill('textarea', 'E2E cancellation testing');
      await page.click('button:has-text("Confirm Void")');
      await expect(page.locator('tr:has-text("E2E Science Chemicals Outflow")').getByText('Voided')).toBeVisible();
    }

    // 5. NAVIGATE TO FINANCIAL REPORTS & ANALYTICS
    await page.goto('/finance/reports');
    await expect(page.locator('h1')).toContainText('Executive Financial Reports & Analytics');

    // Verify KPI Cards
    await expect(page.getByText('Net Billed').first()).toBeVisible();
    await expect(page.getByText('Collected').first()).toBeVisible();
    await expect(page.getByText('Outstanding AR')).toBeVisible();
    await expect(page.getByText('Collection Rate', { exact: true })).toBeVisible();

    // Verify Inflow / Outflow ribbon
    await expect(page.getByText('Total Fee Cash Inflows')).toBeVisible();
    await expect(page.getByText('Total Operational Outflows')).toBeVisible();
    await expect(page.getByText('Net Operating Cash Flow')).toBeVisible();

    // Verify Class Collection & Cash Flow Chart
    await expect(page.getByText('Collection by Class')).toBeVisible();
    await expect(page.getByText('Cash Flow — Last 12 Months')).toBeVisible();
    await expect(page.getByText('Top Outstanding Balances & Defaulters')).toBeVisible();
  });
});
