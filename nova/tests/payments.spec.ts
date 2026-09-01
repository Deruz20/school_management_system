import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('NOVA E2E Tests - Finance Payments, Receipts & Subledger (Phase 3.1C)', () => {
  const prisma = new PrismaClient();
  const adminEmail = `payments_admin_${Date.now()}@test.com`;
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
        firstName: 'Payments',
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

  test('Payment Capture, Receipt Issuance, and Subledger Inspection Workflow', async ({ page }) => {
    // 1. LOGIN
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. NAVIGATE TO FEE PAYMENTS
    await page.goto('/finance/payments');
    await expect(page.locator('h1')).toContainText('Fee Payments');

    // 3. NAVIGATE TO RECORD PAYMENT
    await page.click('a:has-text("Record Payment")');
    await expect(page).toHaveURL(/.*\/finance\/payments\/new/);
    await expect(page.locator('h1')).toContainText('Record Fee Payment');

    // Select the first student from dropdown
    const studentSelect = page.locator('#studentSelect');
    await studentSelect.waitFor({ state: 'visible' });
    const options = await studentSelect.locator('option').all();
    if (options.length > 1) {
      const secondOptionValue = await options[1].getAttribute('value');
      if (secondOptionValue) {
        await studentSelect.selectOption(secondOptionValue);
      }
    }

    // Enter Amount 500,000
    await page.fill('#amount', '500000');

    // Select Payment Method MTN MoMo
    await page.selectOption('#paymentMethod', 'MTN_MOMO');
    await page.fill('#externalReference', 'E2E-MOMO-TX-1002');
    await page.fill('#payerName', 'Jane Doe (Mother)');

    // Verify Amount in Words Banner appears
    await expect(page.locator('text=Five Hundred Thousand Uganda Shillings Only')).toBeVisible();

    // Submit Payment
    await page.click('button:has-text("Capture Payment & Issue Receipt")');

    // 4. VERIFY REDIRECTION TO OFFICIAL PRINTABLE RECEIPT
    await expect(page).toHaveURL(/.*\/finance\/receipts\/.+/);
    await expect(page.locator('text=OFFICIAL FEE RECEIPT')).toBeVisible();
    await expect(page.locator('text=UGX 500,000').first()).toBeVisible();
    await expect(page.locator('text=MTN MOMO')).toBeVisible();

    // 5. NAVIGATE TO STUDENT SUBLEDGER
    await page.goto('/finance/ledger');
    await expect(page.locator('h1')).toContainText('Student Subledger');
    await expect(page.locator('text=Accounts Receivable Subsidiary Journal').first()).toBeVisible();
  });
});
