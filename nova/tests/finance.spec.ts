import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests - Finance Fee Configuration (Phase 3.1A)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `finance_admin_${Date.now()}@test.com`;
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
        firstName: 'Finance',
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
    // Clean up created fee structures and fee types for this test
    const testStructures = await prisma.feeStructure.findMany({
      where: { name: { contains: 'E2E' } }
    });
    for (const s of testStructures) {
      await prisma.feeStructureItem.deleteMany({ where: { feeStructureId: s.id } });
      await prisma.feeStructure.delete({ where: { id: s.id } });
    }
    try {
      await prisma.user.deleteMany({ where: { email: adminEmail } });
    } catch {
      // Best-effort test cleanup
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Fee Configuration Workflow: FeeType CRUD & FeeStructure creation', async ({ page }) => {
    // 1. LOGIN
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'));

    // 2. NAVIGATE TO FEE TYPES
    await page.goto('/finance/fee-types');
    await expect(page.locator('h1')).toContainText('Fee Types Catalog');

    // 3. CREATE NEW FEE TYPE
    await page.click('button:has-text("Add Fee Type")');
    const feeTypeName = `E2E Lab Fee ${Date.now()}`;
    await page.fill('input[placeholder="e.g. Tuition Fee"]', feeTypeName);
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/fee-types') && res.request().method() === 'POST'),
      page.click('button:has-text("Create Fee Type")')
    ]);
    expect(response.ok()).toBeTruthy();

    // Verify fee type appears in table
    await expect(page.locator(`text=${feeTypeName}`)).toBeVisible({ timeout: 10000 });

    // 4. NAVIGATE TO FEE STRUCTURES
    await page.goto('/finance/fee-structures');
    await expect(page.locator('h1')).toContainText('Fee Structures');

    // 5. CREATE NEW FEE STRUCTURE
    await page.click('a:has-text("New Fee Structure")');
    await expect(page.locator('h1')).toContainText('New Fee Structure');

    const structureName = `E2E Primary 1 Fee Blueprint ${Date.now()}`;
    await page.fill('input[placeholder*="Standard Fees"]', structureName);
    
    // Fill first item amount
    await page.fill('input[type="number"]', '500000');

    // Submit form
    await page.click('button:has-text("Create Structure")');

    // 6. VERIFY IN FEE STRUCTURES LIST
    await expect(page).toHaveURL(/.*\/finance\/fee-structures/);
    await expect(page.locator(`text=${structureName}`)).toBeVisible();
  });
});
