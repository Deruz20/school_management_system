import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — SchoolPay Gateway & Reconciliation (Phase 3.1E)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `schoolpay_e2e_admin_${Date.now()}@test.com`;
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
        firstName: 'SchoolPay',
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
      await prisma.user.deleteMany({ where: { email: adminEmail } });
    } catch {
      // Best-effort test cleanup
    } finally {
      await prisma.$disconnect();
    }
  });

  test('SchoolPay Uganda Reconciliation Dashboard & Workflows', async ({ page }) => {
    // 1. Authenticate as Admin/Bursar
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to SchoolPay Reconciliation
    await page.goto('/finance/schoolpay');
    await expect(page.locator('h1')).toContainText('SchoolPay Uganda Reconciliation');

    // 3. Verify Metric Cards Render
    await expect(page.locator('text=Posted to Ledger')).toBeVisible();
    await expect(page.locator('span', { hasText: 'Needs Review' }).first()).toBeVisible();

    // 4. Verify Configuration Accordion
    const configBtn = page.locator('button:has-text("SchoolPay Uganda Connection Settings")');
    await expect(configBtn).toBeVisible();

    // 5. Verify Filter Controls
    await expect(page.locator('input[placeholder*="Search receipt"]')).toBeVisible();
  });
});
