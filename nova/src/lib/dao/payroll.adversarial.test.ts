import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma } from '../db';
import {
  Prisma,
  PayrollStatus,
  SalaryComponentType,
  SalaryPaymentMethod,
  ExpenseStatus,
} from '@prisma/client';
import { TenantContext } from './tenant-context';
import { EmployeeCompensationDAO } from './employee-compensation.dao';
import { PayrollDAO } from './payroll.dao';
import { UgandaStatutoryEngine } from '../payroll/uganda-statutory';
import { FinancialReportDAO } from './financial-report.dao';

describe('NOVA Finance Phase 3.1F — Final Payroll Integrity & Adversarial Audit Suite', () => {
  let ctx: TenantContext;
  let branchId: string;
  let branch2Id: string;
  let employee1Id: string;
  let employee2Id: string;
  let departmentId: string;
  let employeeTypeId: string;
  let adminUserId: string;
  let approverUserId: string;

  beforeEach(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const user = await prisma.user.findFirst({ where: { organizationId: org?.id } });

    // Create / ensure dedicated Branch 1 and Branch 2 for adversarial testing
    let branch1 = await prisma.branch.findFirst({
      where: { schoolId: school!.id, name: 'Adv Audit Branch 1' },
    });
    if (!branch1) {
      branch1 = await prisma.branch.create({
        data: {
          schoolId: school!.id,
          name: 'Adv Audit Branch 1',
        },
      });
    }
    branchId = branch1.id;
    adminUserId = user!.id;

    let branch2 = await prisma.branch.findFirst({
      where: { schoolId: school!.id, name: 'Adv Audit Branch 2' },
    });
    if (!branch2) {
      branch2 = await prisma.branch.create({
        data: {
          schoolId: school!.id,
          name: 'Adv Audit Branch 2',
        },
      });
    }
    branch2Id = branch2.id;

    // Create secondary user for approval segregation test
    const approverUser = await prisma.user.upsert({
      where: { email: 'auditor_approver@test.com' },
      create: {
        organizationId: org!.id,
        email: 'auditor_approver@test.com',
        passwordHash: 'hashed_password',
        firstName: 'Auditor',
        lastName: 'Director',
        userType: 'STAFF',
      },
      update: {},
    });
    approverUserId = approverUser.id;

    ctx = {
      organizationId: org!.id,
      schoolId: school!.id,
      branchId,
      userId: adminUserId,
      role: 'ADMIN',
      permissions: ['all'],
    };

    // Clean up test branch payroll and expense data
    await prisma.payslipItem.deleteMany({ where: { payslip: { branchId: { in: [branchId, branch2Id] } } } });
    await prisma.payslip.deleteMany({ where: { branchId: { in: [branchId, branch2Id] } } });
    await prisma.payrollRun.deleteMany({ where: { branchId: { in: [branchId, branch2Id] } } });
    await prisma.expense.deleteMany({ where: { branchId: { in: [branchId, branch2Id] } } });
    await prisma.employeeSalaryItem.deleteMany({ where: { compensation: { branchId: { in: [branchId, branch2Id] } } } });
    await prisma.employeeCompensation.deleteMany({ where: { branchId: { in: [branchId, branch2Id] } } });

    // Ensure department and employeeType in Branch 1
    const dept = await prisma.department.upsert({
      where: { branchId_name: { branchId, name: 'Adv Math Dept' } },
      create: { branchId, name: 'Adv Math Dept' },
      update: {},
    });
    departmentId = dept.id;

    const empType = await prisma.employeeType.upsert({
      where: { branchId_name: { branchId, name: 'Adv Senior Teacher' } },
      create: { branchId, name: 'Adv Senior Teacher', isTeachingStaff: true },
      update: {},
    });
    employeeTypeId = empType.id;

    // Create Employee 1
    const emp1 = await prisma.employee.upsert({
      where: { branchId_employeeCode: { branchId, employeeCode: 'EMP_ADV_001' } },
      create: {
        branchId,
        employeeCode: 'EMP_ADV_001',
        firstName: 'Samuel',
        lastName: 'Kakooza',
        departmentId,
        employeeTypeId,
        status: 'ACTIVE',
        joinedAt: new Date('2024-01-01'),
      },
      update: { status: 'ACTIVE', firstName: 'Samuel', lastName: 'Kakooza' },
    });
    employee1Id = emp1.id;

    // Create Employee 2
    const emp2 = await prisma.employee.upsert({
      where: { branchId_employeeCode: { branchId, employeeCode: 'EMP_ADV_002' } },
      create: {
        branchId,
        employeeCode: 'EMP_ADV_002',
        firstName: 'Florence',
        lastName: 'Nalubega',
        departmentId,
        employeeTypeId,
        status: 'ACTIVE',
        joinedAt: new Date('2024-01-01'),
      },
      update: { status: 'ACTIVE', firstName: 'Florence', lastName: 'Nalubega' },
    });
    employee2Id = emp2.id;

    // Setup base compensations
    await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: employee1Id,
      baseSalary: '2000000.00', // 2,000,000 UGX
      paymentMethod: SalaryPaymentMethod.BANK_TRANSFER,
      bankName: 'Stanbic Bank',
      accountNumber: '903000112233',
      accountName: 'Samuel Kakooza',
      tinNumber: '1000112233',
      nssfNumber: '1234567890123',
    });

    await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: employee2Id,
      baseSalary: '1000000.00', // 1,000,000 UGX
      paymentMethod: SalaryPaymentMethod.MOBILE_MONEY,
      mobileMoneyNumber: '256772000111',
      tinNumber: '1000445566',
      nssfNumber: '9876543210987',
    });
  });

  // =========================================================================
  // 1. PAYROLL CALCULATIONS & DEDUCTION OVERFLOW AUDIT
  // =========================================================================
  describe('1. Payroll Calculations & Strict Deduction Overflow Integrity', () => {
    it('AUDIT-01: Verifies gross, taxable pay, statutory brackets, net and employer cost exact equality', async () => {
      // 2,000,000 base pay
      // Gross = 2,000,000
      // NSSF 5% = 100,000
      // NSSF Employer 10% = 200,000
      // Taxable Pay = 2,000,000
      // PAYE: Band 4 (410,001 - 10,000,000): 25,000 + (2,000,000 - 410,000) * 30% = 25,000 + 477,000 = 502,000
      // Total Deductions = 100,000 + 502,000 = 602,000
      // Net Salary = 2,000,000 - 602,000 = 1,398,000
      // Employer Total Cost = 2,000,000 + 200,000 = 2,200,000

      const breakdown = UgandaStatutoryEngine.calculatePayslipBreakdown({
        baseSalary: new Prisma.Decimal('2000000.00'),
        allowances: [],
        customDeductions: [],
      });

      expect(breakdown.grossSalary.toString()).toBe('2000000');
      expect(breakdown.employeeNSSF.toString()).toBe('100000');
      expect(breakdown.employerNSSF.toString()).toBe('200000');
      expect(breakdown.payeTax.toString()).toBe('502000');
      expect(breakdown.totalDeductions.toString()).toBe('602000');
      expect(breakdown.netSalary.toString()).toBe('1398000');
      expect(breakdown.employerTotalCost.toString()).toBe('2200000');

      // Universal accounting equality check
      expect(breakdown.netSalary.plus(breakdown.totalDeductions).equals(breakdown.grossSalary)).toBe(true);
      expect(
        breakdown.netSalary
          .plus(breakdown.employeeNSSF)
          .plus(breakdown.payeTax)
          .plus(breakdown.employerNSSF)
          .equals(breakdown.employerTotalCost)
      ).toBe(true);
    });

    it('AUDIT-02: Strictly rejects deduction overflow (Total Deductions > Gross Earnings)', async () => {
      // Base = 500,000
      // NSSF 5% = 25,000
      // Attempt custom voluntary deduction of 600,000 (exceeds gross 500,000)
      expect(() => {
        UgandaStatutoryEngine.calculatePayslipBreakdown({
          baseSalary: new Prisma.Decimal('500000.00'),
          allowances: [],
          customDeductions: [
            {
              code: 'ADVANCE_REC',
              name: 'Salary Advance Recovery',
              amount: new Prisma.Decimal('600000.00'),
            },
          ],
        });
      }).toThrow(/PAYROLL_CALCULATION_ERROR.*exceed gross salary/);
    });

    it('AUDIT-03: Permitted zero net pay edge case (Total Deductions == Gross Earnings)', async () => {
      // Base = 100,000 (tax free PAYE, NSSF 5% = 5,000)
      // Custom deduction = 95,000 -> Total Deductions = 100,000 -> Net = 0.00
      const breakdown = UgandaStatutoryEngine.calculatePayslipBreakdown({
        baseSalary: new Prisma.Decimal('100000.00'),
        allowances: [],
        customDeductions: [
          {
            code: 'WELFARE',
            name: 'Welfare Recovery',
            amount: new Prisma.Decimal('95000.00'),
          },
        ],
      });

      expect(breakdown.grossSalary.toString()).toBe('100000');
      expect(breakdown.totalDeductions.toString()).toBe('100000');
      expect(breakdown.netSalary.toString()).toBe('0');
      expect(breakdown.netSalary.plus(breakdown.totalDeductions).equals(breakdown.grossSalary)).toBe(true);
    });
  });

  // =========================================================================
  // 2. STATUTORY RULE VERSIONING & HISTORICAL REPRODUCIBILITY
  // =========================================================================
  describe('2. Statutory Rule Versioning & Historical Reproducibility', () => {
    it('AUDIT-04: Historical payroll calculation remains reproducible when effective date changes', async () => {
      const historicalDate = new Date('2024-06-15T00:00:00Z');
      const config = UgandaStatutoryEngine.getRuleConfig(historicalDate);
      expect(config.version).toBe('UG_2026_V1');

      const nssf = UgandaStatutoryEngine.calculateNSSF(new Prisma.Decimal('1000000.00'), historicalDate);
      expect(nssf.employeeNSSF.toString()).toBe('50000');
      expect(nssf.employerNSSF.toString()).toBe('100000');
    });
  });

  // =========================================================================
  // 3. SNAPSHOT IMMUTABILITY
  // =========================================================================
  describe('3. Snapshot Immutability Across Employee & Profile Changes', () => {
    it('AUDIT-05: Modifying employee HR details or compensation after run generation preserves frozen snapshots', async () => {
      const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
        year: 2028,
        month: 1,
      });

      const ps1 = run.payslips.find((p) => p.employeeId === employee1Id)!;
      const initialGross = ps1.grossSalary.toString();
      const initialNet = ps1.netSalary.toString();
      const initialBank = ps1.bankName;
      const initialName = ps1.employeeName;

      // Mutate Employee in HR Core
      await prisma.employee.update({
        where: { id: employee1Id },
        data: {
          firstName: 'Professor Samuel',
          lastName: 'Kakooza PhD',
          status: 'TERMINATED',
          terminatedAt: new Date(),
        },
      });

      // Mutate Compensation
      await EmployeeCompensationDAO.setCompensation(ctx, {
        employeeId: employee1Id,
        baseSalary: '99999999.00',
        bankName: 'Equity Bank Uganda',
        accountNumber: '0000000000',
      });

      // Reload payslip
      const reloadedPayslip = await prisma.payslip.findUnique({
        where: { id: ps1.id },
      });

      expect(reloadedPayslip?.grossSalary.toString()).toBe(initialGross);
      expect(reloadedPayslip?.netSalary.toString()).toBe(initialNet);
      expect(reloadedPayslip?.bankName).toBe(initialBank);
      expect(reloadedPayslip?.employeeName).toBe(initialName);
    });
  });

  // =========================================================================
  // 4. STATE MACHINE & SEGREGATION OF DUTIES
  // =========================================================================
  describe('4. State Machine & Segregation of Duties', () => {
    it('AUDIT-06: Strict rejection of self-approval (Submitter cannot approve)', async () => {
      const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
        year: 2028,
        month: 2,
      });

      // User A submits
      await PayrollDAO.submitPayrollRun(ctx, run.id);

      // User A attempts to self-approve
      await expect(PayrollDAO.approvePayrollRun(ctx, run.id)).rejects.toThrow(
        /Segregation of duties violation/
      );
    });

    it('AUDIT-07: Rejection with feedback returns run to DRAFT and clears approval metadata', async () => {
      const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
        year: 2028,
        month: 3,
      });

      await PayrollDAO.submitPayrollRun(ctx, run.id);

      const approverCtx: TenantContext = { ...ctx, userId: approverUserId };
      const rejected = await PayrollDAO.rejectPayrollRun(
        approverCtx,
        run.id,
        'Please verify overtime line item on science staff payslips.'
      );

      expect(rejected.status).toBe(PayrollStatus.DRAFT);
      expect(rejected.submittedById).toBeNull();
      expect(rejected.approvedById).toBeNull();
      expect(rejected.notes).toContain('Please verify overtime');
    });

    it('AUDIT-08: Rejects editing payslips once payroll run is APPROVED or PAID', async () => {
      const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
        year: 2028,
        month: 4,
      });

      await PayrollDAO.submitPayrollRun(ctx, run.id);
      const approverCtx: TenantContext = { ...ctx, userId: approverUserId };
      await PayrollDAO.approvePayrollRun(approverCtx, run.id);

      const payslip = run.payslips[0];

      // Attempt to add ad-hoc line item on APPROVED run
      await expect(
        PayrollDAO.adjustDraftPayslipItem(ctx, {
          payslipId: payslip.id,
          name: 'Unauthorized Bonus',
          code: 'BONUS_UNAUTH',
          type: SalaryComponentType.ALLOWANCE,
          amount: '100000.00',
        })
      ).rejects.toThrow(/Cannot adjust payslip items on a payroll run in status APPROVED/);
    });
  });

  // =========================================================================
  // 5. PAYROLL -> EXPENSE -> CASH FLOW RECONCILIATION (ZERO DOUBLE COUNTING)
  // =========================================================================
  describe('5. Payroll -> Expense -> Cash Flow Reconciliation (Zero Double-Counting Proof)', () => {
    it('AUDIT-09: Proves net pay expense + statutory remittances reconcile exactly to employer cost', async () => {
      const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
        year: 2028,
        month: 5,
      });

      await PayrollDAO.submitPayrollRun(ctx, run.id);
      const approverCtx: TenantContext = { ...ctx, userId: approverUserId };
      await PayrollDAO.approvePayrollRun(approverCtx, run.id);

      const paymentDate = new Date('2028-05-15T00:00:00Z');
      const disburseRes = await PayrollDAO.disbursePayrollRun(ctx, {
        id: run.id,
        paymentReference: 'BANK_DISB_MAY2028',
        paymentDate,
      });

      const expense = await prisma.expense.findUnique({
        where: { id: disburseRes.payrollRun.expenseId! },
        include: { category: true },
      });

      expect(expense).toBeDefined();
      expect(expense?.category.code).toBe('SALARIES_AND_WAGES');
      expect(expense?.amount.toString()).toBe(run.totalNet.toString());
      expect(expense?.status).toBe(ExpenseStatus.COMPLETED);

      // Verify that Total Employer Cost = Net Pay Expense + Employee NSSF + Employer NSSF + PAYE
      // In this run:
      // Moses: Gross 2M, NSSF Emp 100k, NSSF Empr 200k, PAYE 502k, Net 1398k
      // Florence: Gross 1M, NSSF Emp 50k, NSSF Empr 100k, PAYE 202k, Net 748k
      // Total Gross = 3,000,000
      // Total Net = 2,146,000
      // Total PAYE = 704,000
      // Total NSSF (15%) = 450,000 (Emp 150k + Empr 300k)
      // Total Employer Cost = Gross + Empr NSSF = 3,300,000
      // 2,146,000 + 704,000 + 450,000 = 3,300,000 (Exact Equality)

      const totalNetExpense = expense!.amount;
      const totalStatutoryPayable = new Prisma.Decimal('704000.00').plus(new Prisma.Decimal('450000.00'));
      const combinedCashOutflows = totalNetExpense.plus(totalStatutoryPayable);

      expect(combinedCashOutflows.equals(run.totalEmployerCost)).toBe(true);

      // Verify FinancialReportDAO cash-flow inclusion
      const summary = await FinancialReportDAO.getExecutiveSummary(ctx, {
        startDate: new Date('2028-05-01'),
        endDate: new Date('2028-05-31'),
      });

      expect(summary.cashFlow.totalOperationalExpenses.greaterThan(0)).toBe(true);
      expect(summary.cashFlow.totalOperationalExpenses.toString()).toBe(run.totalNet.toString());
    });

    it('AUDIT-10: Payroll reversal voids the linked Expense and removes it from active cash outflow', async () => {
      const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
        year: 2028,
        month: 6,
      });

      await PayrollDAO.submitPayrollRun(ctx, run.id);
      const approverCtx: TenantContext = { ...ctx, userId: approverUserId };
      await PayrollDAO.approvePayrollRun(approverCtx, run.id);

      const paymentDate = new Date('2028-06-15T00:00:00Z');
      const disburseRes = await PayrollDAO.disbursePayrollRun(ctx, {
        id: run.id,
        paymentDate,
      });

      const expenseId = disburseRes.payrollRun.expenseId!;

      // Reverse the payroll run
      const reversedRun = await PayrollDAO.reversePayrollRun(
        ctx,
        run.id,
        'Duplicate banking instruction issued by treasury'
      );

      expect(reversedRun.status).toBe(PayrollStatus.CANCELLED);

      // Verify Expense was VOIDED
      const voidedExpense = await prisma.expense.findUnique({
        where: { id: expenseId },
      });

      expect(voidedExpense?.status).toBe(ExpenseStatus.VOID);
      expect(voidedExpense?.voidReason).toContain('Duplicate banking instruction');

      // Verify excluded from active cash flow summary
      const summaryAfterVoid = await FinancialReportDAO.getExecutiveSummary(ctx, {
        startDate: new Date('2028-06-01'),
        endDate: new Date('2028-06-30'),
      });

      expect(summaryAfterVoid.cashFlow.totalOperationalExpenses.toString()).toBe('0');
    });
  });

  // =========================================================================
  // 6. DISBURSEMENT IDEMPOTENCY & CONCURRENCY
  // =========================================================================
  describe('6. Disbursement Idempotency & Concurrent Payouts', () => {
    it('AUDIT-11: Serializes concurrent disbursement calls without creating duplicate Expense vouchers', async () => {
      const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
        year: 2028,
        month: 7,
      });

      await PayrollDAO.submitPayrollRun(ctx, run.id);
      const approverCtx: TenantContext = { ...ctx, userId: approverUserId };
      await PayrollDAO.approvePayrollRun(approverCtx, run.id);

      // Execute 2 concurrent disbursements
      const [res1, res2] = await Promise.all([
        PayrollDAO.disbursePayrollRun(ctx, { id: run.id }),
        PayrollDAO.disbursePayrollRun(ctx, { id: run.id }),
      ]);

      // Exactly one was the primary execution, the other is replay
      const replayCount = (res1.isReplay ? 1 : 0) + (res2.isReplay ? 1 : 0);
      expect(replayCount).toBe(1);

      // Verify exactly 1 expense voucher was created in database
      const expenses = await prisma.expense.findMany({
        where: {
          branchId,
          idempotencyKey: `EXP_PR_${run.payrollNumber}`,
        },
      });

      expect(expenses.length).toBe(1);
    });
  });

  // =========================================================================
  // 7. MULTI-TENANT BRANCH ISOLATION & RBAC
  // =========================================================================
  describe('7. Multi-Tenant Branch Isolation & RBAC', () => {
    it('AUDIT-12: Strict cross-branch access denial across all DAO operations', async () => {
      const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
        year: 2028,
        month: 8,
      });

      const ctxBranch2: TenantContext = {
        ...ctx,
        branchId: branch2Id,
      };

      // Branch 2 cannot view Branch 1 run
      const detail = await PayrollDAO.getPayrollRunDetail(ctxBranch2, run.id);
      expect(detail).toBeNull();

      // Branch 2 cannot submit Branch 1 run
      await expect(PayrollDAO.submitPayrollRun(ctxBranch2, run.id)).rejects.toThrow(
        /not found or access denied/
      );

      // Branch 2 cannot approve Branch 1 run
      await expect(PayrollDAO.approvePayrollRun(ctxBranch2, run.id)).rejects.toThrow(
        /not found or access denied/
      );

      // Branch 2 cannot disburse Branch 1 run
      await expect(PayrollDAO.disbursePayrollRun(ctxBranch2, { id: run.id })).rejects.toThrow(
        /not found or access denied/
      );

      // Branch 2 cannot cancel Branch 1 run
      await expect(
        PayrollDAO.reversePayrollRun(ctxBranch2, run.id, 'Unauthorized cross-branch cancellation')
      ).rejects.toThrow(/not found or access denied/);

      // Branch 2 cannot export Branch 1 schedules
      await expect(PayrollDAO.generateBankScheduleExport(ctxBranch2, run.id)).rejects.toThrow(
        /not found/
      );
    });
  });
});
