import { test, expect } from '@playwright/test';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests — Staff Payroll & Compensation Engine (Phase 3.1F)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `payroll_admin_${Date.now()}@test.com`;
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
        firstName: 'Payroll',
        lastName: 'Officer',
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

    // Clean up any previous test payroll runs in this branch
    await prisma.payslipItem.deleteMany({ where: { payslip: { branchId: branch!.id } } });
    await prisma.payslip.deleteMany({ where: { branchId: branch!.id } });
    await prisma.payrollRun.deleteMany({ where: { branchId: branch!.id } });

    // Ensure active employee and compensation profile
    let emp = await prisma.employee.findFirst({ where: { branchId: branch!.id, status: 'ACTIVE' } });
    if (!emp) {
      let empType = await prisma.employeeType.findFirst({ where: { branchId: branch!.id } });
      if (!empType) {
        empType = await prisma.employeeType.create({
          data: {
            name: 'Teaching Staff',
            branchId: branch!.id,
            isTeachingStaff: true,
          },
        });
      }

      emp = await prisma.employee.create({
        data: {
          branchId: branch!.id,
          employeeTypeId: empType.id,
          employeeCode: `EMP_E2E_${Date.now()}`,
          firstName: 'E2E Teacher',
          lastName: 'Musoke',
          status: 'ACTIVE',
        },
      });
    }

    await prisma.employeeCompensation.upsert({
      where: { employeeId: emp.id },
      create: {
        branchId: branch!.id,
        employeeId: emp.id,
        baseSalary: new Prisma.Decimal('1500000.00'),
        paymentMethod: 'BANK_TRANSFER',
        bankName: 'Stanbic Bank',
        accountNumber: '9030012345678',
        accountName: `${emp.firstName} ${emp.lastName}`,
        isActive: true,
      },
      update: {
        baseSalary: new Prisma.Decimal('1500000.00'),
        isActive: true,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Staff Payroll Hub, Run Generation, Payslip Modal and Compensation Settings Flow', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'));

    // 2. Navigate to Payroll Hub
    await page.goto('/finance/payroll');
    await expect(page.locator('h1')).toContainText('Staff Payroll & Compensation');

    // 3. Open Generate Payroll Modal
    await page.click('button:has-text("Generate Monthly Payroll")');
    await expect(page.locator('h3:has-text("Generate Monthly Payroll Run")')).toBeVisible();

    // 4. Generate Payroll Run with unique period
    await page.locator('form select').selectOption('11');
    await page.locator('form input[type="number"]').fill('2029');
    await page.fill('input[placeholder*="Staff Payroll"]', `E2E Test Run ${Date.now()}`);
    await page.click('button[type="submit"]:has-text("Generate Run")');

    // 5. Lands on Run Detail page
    await expect(page).toHaveURL(/\/finance\/payroll\/.+/);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Employee Payslip Register')).toBeVisible();

    // 6. Check Payslip view modal
    const viewButton = page.locator('button[title="View Official Payslip"]').first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await expect(page.locator('text=Official Remuneration Advice')).toBeVisible();
      await expect(page.locator('text=Take-Home Net Salary')).toBeVisible();
      await expect(page.locator('button:has-text("Print Payslip")')).toBeVisible();
      await page.keyboard.press('Escape');
    }

    // 7. Check Export Schedules Modal
    await page.click('button:has-text("Export Schedules")');
    await expect(page.locator('h3:has-text("Export Schedules & Returns")')).toBeVisible();
    await expect(page.locator('text=Bank Payment Schedule')).toBeVisible();
    await expect(page.locator('text=NSSF Form C Monthly Return')).toBeVisible();
    await expect(page.locator('text=URA PAYE Monthly Tax Return')).toBeVisible();
    await page.click('button:has-text("Close")');

    // 8. Navigate to Compensation Profiles & Salary Rules
    await page.goto('/finance/payroll/compensation');
    await expect(page.locator('h1')).toContainText('Staff Compensation Profiles');
    await expect(page.locator('text=Employee Salaries')).toBeVisible();

    // Switch to Salary Components Catalog tab
    await page.click('button:has-text("Salary Components Catalog")');
    await expect(page.locator('text=Standard Salary Components')).toBeVisible();
    await expect(page.locator('text=NSSF Employee Contribution')).toBeVisible();
  });
});
