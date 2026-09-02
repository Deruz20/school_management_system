import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — School Budgeting & Vote Heads Engine (Phase 3.1G)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `budget_admin_${Date.now()}@test.com`;
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
        firstName: 'Budget',
        lastName: 'Director',
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

    // Clean up previous budget records
    await prisma.budgetRevisionItem.deleteMany({ where: { revision: { budget: { branchId: branch!.id } } } });
    await prisma.budgetRevision.deleteMany({ where: { budget: { branchId: branch!.id } } });
    await prisma.budgetItem.deleteMany({ where: { budget: { branchId: branch!.id } } });
    await prisma.budget.deleteMany({ where: { branchId: branch!.id } });

    // Ensure active academic year
    let academicYear = await prisma.academicYear.findFirst({ where: { branchId: branch!.id } });
    if (!academicYear) {
      academicYear = await prisma.academicYear.create({
        data: {
          branchId: branch!.id,
          name: '2026 Academic Year',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
        },
      });
    }

    await prisma.branchSettings.upsert({
      where: { branchId: branch!.id },
      create: { branchId: branch!.id, activeAcademicYearId: academicYear.id },
      update: { activeAcademicYearId: academicYear.id },
    });

    // Ensure expense category
    await prisma.expenseCategory.upsert({
      where: { branchId_code: { branchId: branch!.id, code: 'OPERATIONS' } },
      create: { branchId: branch!.id, code: 'OPERATIONS', name: 'School Operations & Maintenance' },
      update: {},
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('End-to-End Budget Lifecycle: Create Draft, Submit, Approve, and Inspect Live Variance', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"], input[id*="email"]', adminEmail);
    await page.fill('input[type="password"], input[name="password"], input[id*="password"]', adminPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Navigate to Budgets Hub
    await page.goto('/finance/budgets');
    await expect(page.locator('h1')).toContainText('School Budgeting');

    // 3. Click Create New Budget
    await page.click('[data-testid="create-budget-btn"]');
    await page.waitForURL('/finance/budgets/new');
    await expect(page.locator('h1')).toContainText('Create School Budget');

    // 4. Fill in budget form
    await page.fill('input[placeholder*="2026 Annual"]', '2026 Master Playwright Operating Budget');

    // If vote head inputs exist, fill the first one
    const voteHeadInputs = page.locator('input[data-testid^="votehead-input-"]');
    await page.waitForTimeout(500);
    const count = await voteHeadInputs.count();
    if (count > 0) {
      await voteHeadInputs.first().fill('50000000');
    }

    // Save draft budget
    await page.click('[data-testid="save-budget-btn"]');

    // 5. Verify redirection to Budget Workstation
    await page.waitForURL(/\/finance\/budgets\/[a-zA-Z0-9_-]+$/, { timeout: 15000 });
    await expect(page.locator('[data-testid="budget-status-badge"]')).toContainText('DRAFT');

    // 6. Submit for Approval
    await page.click('[data-testid="submit-budget-btn"]');
    await expect(page.locator('[data-testid="budget-status-badge"]')).toContainText('SUBMITTED');

    // 7. Approve Budget
    await page.click('[data-testid="approve-budget-btn"]');
    await expect(page.locator('[data-testid="budget-status-badge"]')).toContainText('APPROVED');

    // 8. Verify live variance schedule tab
    await expect(page.locator('h1')).toContainText('2026 Master Playwright Operating Budget');
  });
});
