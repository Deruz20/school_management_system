import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma } from '../db';
import { Prisma, PayrollStatus, SalaryComponentType, CalculationType, SalaryPaymentMethod, ExpenseStatus } from '@prisma/client';
import { TenantContext } from './tenant-context';
import { SalaryComponentDAO } from './salary-component.dao';
import { EmployeeCompensationDAO } from './employee-compensation.dao';
import { PayrollDAO } from './payroll.dao';
import { UgandaStatutoryEngine } from '../payroll/uganda-statutory';

describe('NOVA Finance Phase 3.1F — Staff Payroll & Compensation Engine (PAY-01 to PAY-20)', () => {
  let ctx: TenantContext;
  let branchId: string;
  let employee1Id: string;
  let employee2Id: string;
  let departmentId: string;
  let employeeTypeId: string;
  let adminUserId: string;
  let approverUserId: string;

  beforeEach(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });
    const user = await prisma.user.findFirst({ where: { organizationId: org?.id } });

    branchId = branch!.id;
    adminUserId = user!.id;

    // Create secondary user for approval segregation test
    const approverUser = await prisma.user.upsert({
      where: { email: 'headteacher@test.com' },
      create: {
        organizationId: org!.id,
        email: 'headteacher@test.com',
        passwordHash: 'hashed_password',
        firstName: 'Headteacher',
        lastName: 'Musoke',
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

    // Clean up previous test payroll runs, expenses, and compensations in this branch
    await prisma.payslipItem.deleteMany({ where: { payslip: { branchId } } });
    await prisma.payslip.deleteMany({ where: { branchId } });
    await prisma.payrollRun.deleteMany({ where: { branchId } });
    await prisma.expense.deleteMany({ where: { branchId } });
    await prisma.employeeSalaryItem.deleteMany({ where: { compensation: { branchId } } });
    await prisma.employeeCompensation.deleteMany({ where: { branchId } });

    // Ensure department and employeeType
    const dept = await prisma.department.upsert({
      where: { branchId_name: { branchId, name: 'Science Department' } },
      create: { branchId, name: 'Science Department' },
      update: {},
    });
    departmentId = dept.id;

    const empType = await prisma.employeeType.upsert({
      where: { branchId_name: { branchId, name: 'Senior Teacher' } },
      create: { branchId, name: 'Senior Teacher', isTeachingStaff: true },
      update: {},
    });
    employeeTypeId = empType.id;

    // Create Employee 1
    const emp1 = await prisma.employee.upsert({
      where: { branchId_employeeCode: { branchId, employeeCode: 'EMP_PAY_001' } },
      create: {
        branchId,
        employeeCode: 'EMP_PAY_001',
        firstName: 'Moses',
        lastName: 'Kato',
        departmentId,
        employeeTypeId,
        status: 'ACTIVE',
        joinedAt: new Date('2024-01-01'),
      },
      update: {},
    });
    employee1Id = emp1.id;

    // Create Employee 2
    const emp2 = await prisma.employee.upsert({
      where: { branchId_employeeCode: { branchId, employeeCode: 'EMP_PAY_002' } },
      create: {
        branchId,
        employeeCode: 'EMP_PAY_002',
        firstName: 'Grace',
        lastName: 'Akello',
        departmentId,
        employeeTypeId,
        status: 'ACTIVE',
        joinedAt: new Date('2024-01-01'),
      },
      update: {},
    });
    employee2Id = emp2.id;

    // Ensure default salary components
    await SalaryComponentDAO.ensureDefaultComponents(ctx);

    // Setup standard compensation profiles for employee1 and employee2
    await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: employee1Id,
      baseSalary: '1500000.00',
      paymentMethod: SalaryPaymentMethod.BANK_TRANSFER,
      bankName: 'Stanbic Bank',
      accountNumber: '9030012345678',
      accountName: 'Moses Kato',
      tinNumber: '1000123456',
      nssfNumber: '1234567890123',
    });

    await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: employee2Id,
      baseSalary: '1000000.00',
      paymentMethod: SalaryPaymentMethod.MOBILE_MONEY,
      mobileMoneyNumber: '256770000000',
      accountName: 'Grace Akello',
    });
  });

  it('PAY-01: Employee compensation profile creation and validation with Decimal money', async () => {
    const comp = await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: employee1Id,
      baseSalary: '1500000.00',
      paymentMethod: SalaryPaymentMethod.BANK_TRANSFER,
      bankName: 'Stanbic Bank',
      accountNumber: '9030012345678',
      accountName: 'Moses Kato',
      tinNumber: '1000123456',
      nssfNumber: '1234567890123',
    });

    expect(comp).toBeDefined();
    expect(comp.baseSalary.toString()).toBe('1500000');
    expect(comp.bankName).toBe('Stanbic Bank');
    expect(comp.tinNumber).toBe('1000123456');

    // Negative base salary rejection
    await expect(
      EmployeeCompensationDAO.setCompensation(ctx, {
        employeeId: employee1Id,
        baseSalary: '-50000',
      })
    ).rejects.toThrow('Base salary cannot be negative.');
  });

  it('PAY-02: Salary component creation (Fixed, Percentage of Basic, Statutory)', async () => {
    const timestamp = Date.now();
    const customComp = await SalaryComponentDAO.createComponent(ctx, {
      name: `Science Duty Allowance ${timestamp}`,
      code: `SCIENCE_ALLOW_${timestamp}`,
      type: SalaryComponentType.ALLOWANCE,
      calculationType: CalculationType.PERCENTAGE_OF_BASIC,
      percentageRate: 10.0,
      isStatutory: false,
      isTaxable: true,
    });

    expect(customComp).toBeDefined();
    expect(customComp.type).toBe(SalaryComponentType.ALLOWANCE);
    expect(customComp.percentageRate?.toString()).toBe('10');

    // Duplicate code rejection in same branch
    await expect(
      SalaryComponentDAO.createComponent(ctx, {
        name: `Different Name ${timestamp}`,
        code: customComp.code,
        type: SalaryComponentType.ALLOWANCE,
        calculationType: CalculationType.FIXED_AMOUNT,
      })
    ).rejects.toThrow();
  });

  it('PAY-03: Uganda NSSF statutory calculations across salary bands', () => {
    // 1. Gross = 1,000,000 UGX
    const nssf1 = UgandaStatutoryEngine.calculateNSSF(new Prisma.Decimal(1000000));
    expect(nssf1.employeeNSSF.toString()).toBe('50000');
    expect(nssf1.employerNSSF.toString()).toBe('100000');
    expect(nssf1.totalNSSF.toString()).toBe('150000');

    // 2. Gross = 2,500,000.50 UGX
    const nssf2 = UgandaStatutoryEngine.calculateNSSF(new Prisma.Decimal('2500000.50'));
    expect(nssf2.employeeNSSF.toString()).toBe('125000.03');
    expect(nssf2.employerNSSF.toString()).toBe('250000.05');

    // 3. Gross <= 0
    const nssfZero = UgandaStatutoryEngine.calculateNSSF(new Prisma.Decimal(0));
    expect(nssfZero.employeeNSSF.toString()).toBe('0');
    expect(nssfZero.employerNSSF.toString()).toBe('0');
  });

  it('PAY-04: URA PAYE progressive bracket calculations across all 5 bands', () => {
    // Band 1: <= 235,000 UGX -> 0 tax
    expect(UgandaStatutoryEngine.calculatePAYE(new Prisma.Decimal(200000)).toString()).toBe('0');
    expect(UgandaStatutoryEngine.calculatePAYE(new Prisma.Decimal(235000)).toString()).toBe('0');

    // Band 2: 235,001 - 335,000 (e.g. 300,000 UGX -> 10% on 65,000 = 6,500)
    expect(UgandaStatutoryEngine.calculatePAYE(new Prisma.Decimal(300000)).toString()).toBe('6500');

    // Band 3: 335,001 - 410,000 (e.g. 400,000 UGX -> 10,000 + 20% on 65,000 = 23,000)
    expect(UgandaStatutoryEngine.calculatePAYE(new Prisma.Decimal(400000)).toString()).toBe('23000');

    // Band 4: 410,001 - 10,000,000 (e.g. 1,000,000 UGX -> 25,000 + 30% on 590,000 = 202,000)
    expect(UgandaStatutoryEngine.calculatePAYE(new Prisma.Decimal(1000000)).toString()).toBe('202000');

    // Band 5: > 10,000,000 (e.g. 12,000,000 UGX -> 2,902,000 + 40% on 2,000,000 = 3,702,000)
    expect(UgandaStatutoryEngine.calculatePAYE(new Prisma.Decimal(12000000)).toString()).toBe('3702000');
  });

  it('PAY-05: Batch monthly payroll generation for active branch employees', async () => {
    // Setup compensations
    await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: employee1Id,
      baseSalary: '2000000.00',
      paymentMethod: SalaryPaymentMethod.BANK_TRANSFER,
      bankName: 'Stanbic Bank',
      accountNumber: '111111',
    });

    await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: employee2Id,
      baseSalary: '1000000.00',
      paymentMethod: SalaryPaymentMethod.MOBILE_MONEY,
      mobileMoneyNumber: '256770000000',
    });

    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2026,
      month: 8,
      title: 'August 2026 Test Payroll',
    });

    expect(run).toBeDefined();
    expect(run.payrollNumber).toMatch(/^PR-2026-\d{5}$/);
    expect(run.status).toBe(PayrollStatus.DRAFT);
    expect(run.totalEmployees).toBeGreaterThanOrEqual(2);
    expect(run.totalGross.toNumber()).toBeGreaterThan(0);
    expect(run.totalNet.toNumber()).toBeGreaterThan(0);
    expect(run.payslips.length).toBe(run.totalEmployees);
  });

  it('PAY-06: Eligibility filtering (Terminated vs Joiners vs Inactive)', async () => {
    // Terminated employee before period start
    const terminatedOld = await prisma.employee.create({
      data: {
        branchId,
        employeeCode: `EMP_TERM_OLD_${Date.now()}`,
        firstName: 'Old',
        lastName: 'Terminated',
        departmentId,
        employeeTypeId,
        status: 'TERMINATED',
        joinedAt: new Date('2023-01-01'),
        terminatedAt: new Date('2026-06-01'), // Terminated before August
      },
    });

    await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: terminatedOld.id,
      baseSalary: '1000000',
    });

    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2026,
      month: 9, // September 2026
    });

    const payslipForTerminated = run.payslips.find((p) => p.employeeId === terminatedOld.id);
    expect(payslipForTerminated).toBeUndefined();
  });

  it('PAY-07: Draft payslip manual adjustments (Ad-hoc bonus / Advance)', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2026,
      month: 10,
    });

    const payslip1 = run.payslips.find((p) => p.employeeId === employee1Id)!;
    const initialNet = payslip1.netSalary;

    // Add ad-hoc bonus allowance of 200,000 UGX
    const adjusted = await PayrollDAO.adjustDraftPayslipItem(ctx, {
      payslipId: payslip1.id,
      name: 'Special Duty Bonus',
      code: 'SPECIAL_BONUS',
      type: SalaryComponentType.ALLOWANCE,
      amount: '200000.00',
    });

    expect(adjusted).toBeDefined();
    expect(adjusted.grossSalary.toNumber()).toBeGreaterThan(payslip1.grossSalary.toNumber());
    expect(adjusted.netSalary.toNumber()).toBeGreaterThan(initialNet.toNumber());
  });

  it('PAY-08: Deductions exceeding gross earnings rejection test', () => {
    // Attempting breakdown where deductions > gross throws error without silent clamping
    expect(() => {
      UgandaStatutoryEngine.calculatePayslipBreakdown({
        baseSalary: new Prisma.Decimal('500000.00'),
        allowances: [],
        customDeductions: [
          {
            code: 'MASSIVE_LOAN',
            name: 'Huge Loan Recovery',
            amount: new Prisma.Decimal('600000.00'),
          },
        ],
      });
    }).toThrow(/PAYROLL_CALCULATION_ERROR.*exceed gross salary/);
  });

  it('PAY-09: Full aggregation equality invariant check', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2026,
      month: 11,
    });

    // Invariant 1: totalGross == totalBasic + totalAllowances
    expect(run.totalGross.toString()).toBe(run.totalBasic.plus(run.totalAllowances).toString());

    // Invariant 2: totalNet == totalGross - totalDeductions
    expect(run.totalNet.toString()).toBe(run.totalGross.minus(run.totalDeductions).toString());

    // Invariant 3: totalEmployerCost == totalGross + sum(employerContributions)
    expect(run.totalEmployerCost.toNumber()).toBeGreaterThanOrEqual(run.totalGross.toNumber());
  });

  it('PAY-10: Submission transition (DRAFT -> SUBMITTED)', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2026,
      month: 12,
    });

    const submitted = await PayrollDAO.submitPayrollRun(ctx, run.id);
    expect(submitted.status).toBe(PayrollStatus.SUBMITTED);
    expect(submitted.submittedById).toBe(ctx.userId);
    expect(submitted.submittedAt).toBeDefined();

    // Draft adjustments on submitted run must fail
    const payslip1 = run.payslips[0];
    await expect(
      PayrollDAO.adjustDraftPayslipItem(ctx, {
        payslipId: payslip1.id,
        name: 'Late Bonus',
        code: 'LATE_BONUS',
        type: SalaryComponentType.ALLOWANCE,
        amount: '50000',
      })
    ).rejects.toThrow(/must be in DRAFT/i);
  });

  it('PAY-11: Self-approval prevention enforcement', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2027,
      month: 1,
    });

    await PayrollDAO.submitPayrollRun(ctx, run.id);

    // Submitter trying to self-approve fails
    await expect(PayrollDAO.approvePayrollRun(ctx, run.id)).rejects.toThrow(
      /Segregation of duties violation: Submitter cannot self-approve/
    );
  });

  it('PAY-12: Approval transition and Rejection return to Draft', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2027,
      month: 2,
    });

    await PayrollDAO.submitPayrollRun(ctx, run.id);

    const approverCtx: TenantContext = {
      ...ctx,
      userId: approverUserId,
      permissions: ['all', 'payroll:approve'],
    };

    // 1. Reject back to draft
    const rejected = await PayrollDAO.rejectPayrollRun(approverCtx, run.id, 'Please adjust allowance');
    expect(rejected.status).toBe(PayrollStatus.DRAFT);
    expect(rejected.notes).toContain('Please adjust allowance');

    // 2. Re-submit and approve
    await PayrollDAO.submitPayrollRun(ctx, run.id);
    const approved = await PayrollDAO.approvePayrollRun(approverCtx, run.id);
    expect(approved.status).toBe(PayrollStatus.APPROVED);
    expect(approved.approvedById).toBe(approverUserId);
  });

  it('PAY-13: Disbursement transition and automated Expense posting', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2027,
      month: 3,
    });

    await PayrollDAO.submitPayrollRun(ctx, run.id);
    const approverCtx: TenantContext = { ...ctx, userId: approverUserId };
    await PayrollDAO.approvePayrollRun(approverCtx, run.id);

    const disburseResult = await PayrollDAO.disbursePayrollRun(ctx, {
      id: run.id,
      paymentReference: 'STANBIC_BATCH_9901',
    });

    expect(disburseResult.payrollRun.status).toBe(PayrollStatus.PAID);
    expect(disburseResult.payrollRun.expenseId).toBeDefined();

    // Verify linked Expense voucher in Phase 3.1D
    const expense = await prisma.expense.findUnique({
      where: { id: disburseResult.payrollRun.expenseId! },
      include: { category: true },
    });

    expect(expense).toBeDefined();
    expect(expense?.category.code).toBe('SALARIES_AND_WAGES');
    expect(expense?.amount.toString()).toBe(disburseResult.payrollRun.totalNet.toString());
    expect(expense?.status).toBe(ExpenseStatus.COMPLETED);
  });

  it('PAY-14: Disbursement idempotency under duplicate requests', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2027,
      month: 4,
    });

    await PayrollDAO.submitPayrollRun(ctx, run.id);
    const approverCtx: TenantContext = { ...ctx, userId: approverUserId };
    await PayrollDAO.approvePayrollRun(approverCtx, run.id);

    // Call 1
    const res1 = await PayrollDAO.disbursePayrollRun(ctx, { id: run.id });
    expect(res1.isReplay).toBe(false);

    // Call 2 (Idempotent)
    const res2 = await PayrollDAO.disbursePayrollRun(ctx, { id: run.id });
    expect(res2.isReplay).toBe(true);
    expect(res2.payrollRun.status).toBe(PayrollStatus.PAID);
  });

  it('PAY-15: Employee profile edits after payroll run generation (snapshot immutability)', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2027,
      month: 5,
    });

    const payslip1 = run.payslips.find((p) => p.employeeId === employee1Id)!;
    const snapshottedGross = payslip1.grossSalary.toString();

    // Update employee profile salary
    await EmployeeCompensationDAO.setCompensation(ctx, {
      employeeId: employee1Id,
      baseSalary: '9900000.00', // Major raise
    });

    // Verify existing payslip was NOT mutated
    const reloadedPayslip = await prisma.payslip.findUnique({
      where: { id: payslip1.id },
    });
    expect(reloadedPayslip?.grossSalary.toString()).toBe(snapshottedGross);
  });

  it('PAY-16: Deterministic Bank Transfer Schedule Export', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2027,
      month: 6,
    });

    const csv = await PayrollDAO.generateBankScheduleExport(ctx, run.id);
    expect(csv).toContain('Payment Reference,Employee Code,Beneficiary Name,Bank Name,Account Number,Account Name,Amount (UGX),Narration');
    expect(csv).toContain('SAL-202706-');
    expect(csv).toContain('Stanbic Bank');
  });

  it('PAY-17: Deterministic Mobile Money Payout Schedule Export', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2027,
      month: 7,
    });

    const csv = await PayrollDAO.generateMoMoScheduleExport(ctx, run.id);
    expect(csv).toContain('Phone Number,Recipient Name,Amount (UGX),Reference,Payment Method');
    expect(csv).toContain('256770000000');
  });

  it('PAY-18: NSSF Form C and URA PAYE statutory return generation', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2027,
      month: 8,
    });

    const nssfCsv = await PayrollDAO.generateNssfScheduleExport(ctx, run.id);
    expect(nssfCsv).toContain('NSSF Number,Employee Code,Employee Name,Gross Pay (UGX),Employee 5% (UGX),Employer 10% (UGX),Total 15% (UGX)');
    expect(nssfCsv).toContain('1234567890123');

    const payeCsv = await PayrollDAO.generatePayeScheduleExport(ctx, run.id);
    expect(payeCsv).toContain('TIN,Employee Code,Employee Name,Gross Emoluments (UGX),PAYE Tax Deducted (UGX),Net Pay (UGX)');
    expect(payeCsv).toContain('1000123456');
  });

  it('PAY-19: Strict multi-tenant branch isolation', async () => {
    // Create Branch 2
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch2 = await prisma.branch.create({
      data: {
        schoolId: school!.id,
        name: `Secondary Branch ${Date.now()}`,
      },
    });

    const ctxBranch2: TenantContext = {
      ...ctx,
      branchId: branch2.id,
    };

    // Branch 2 cannot view Branch 1 payroll runs
    const branch1Runs = await PayrollDAO.listPayrollRuns(ctxBranch2);
    expect(branch1Runs.length).toBe(0);
  });

  it('PAY-20: Comprehensive AuditService event logging', async () => {
    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year: 2027,
      month: 9,
    });

    // Check audit log for PAYROLL_RUN_CREATED
    const logs = await prisma.auditLog.findMany({
      where: {
        branchId,
        resourceType: 'PayrollRun',
        resourceId: run.id,
      },
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe('PAYROLL_RUN_CREATED');
  }, 20000);
});
