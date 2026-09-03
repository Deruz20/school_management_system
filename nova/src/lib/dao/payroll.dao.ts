import { db } from "../db";
import {
  Prisma,
  PayrollStatus,
  PayslipStatus,
  SalaryComponentType,
  SalaryPaymentMethod,
  PaymentMethod,
  ExpenseStatus,
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { UgandaStatutoryEngine } from "../payroll/uganda-statutory";
import { ExpenseDAO } from "./expense.dao";
import { GLIntegrationService } from "./gl-integration.service";
import crypto from "crypto";

export class PayrollDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('payroll:read') ||
      perms.includes('payroll:write') ||
      perms.includes('fees:read')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: payroll:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('payroll:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: payroll:write");
  }

  private static checkSubmitPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('payroll:submit') ||
      perms.includes('payroll:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: payroll:submit");
  }

  private static checkApprovePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('payroll:approve') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: payroll:approve");
  }

  private static checkDisbursePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('payroll:disburse') ||
      perms.includes('payroll:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: payroll:disburse");
  }

  private static checkCancelPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('payroll:cancel') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: payroll:cancel");
  }

  /**
   * Atomic sequential sequence generator for Payroll Runs and Payslips.
   */
  static async generateSequenceNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
    type: 'PAYROLL_RUN' | 'PAYSLIP',
    year: number
  ): Promise<string> {
    const fallbackId = crypto.randomUUID();

    const result = await tx.$queryRaw<{ nextValue: number }[]>`
      INSERT INTO "PayrollSequence" ("id", "branchId", "type", "year", "nextValue", "updatedAt")
      VALUES (${fallbackId}, ${branchId}, ${type}, ${year}, 2, NOW())
      ON CONFLICT ("branchId", "type", "year")
      DO UPDATE SET "nextValue" = "PayrollSequence"."nextValue" + 1, "updatedAt" = NOW()
      RETURNING "nextValue" - 1 AS "nextValue";
    `;

    const seq = result[0]?.nextValue ?? 1;
    const prefix = type === 'PAYROLL_RUN' ? 'PR' : 'PS';
    return `${prefix}-${year}-${seq.toString().padStart(5, '0')}`;
  }

  /**
   * Generates a monthly payroll run for all active eligible employees in the branch.
   */
  static async generateMonthlyPayrollRun(
    ctx: TenantContext,
    params: {
      year: number;
      month: number;
      title?: string;
    }
  ) {
    this.checkWritePermission(ctx);

    const { year, month } = params;
    if (month < 1 || month > 12) {
      throw new Error("Invalid month: must be between 1 and 12.");
    }

    const branchId = ctx.branchId!;
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const defaultTitle = `${monthNames[month - 1]} ${year} Staff Payroll`;
    const title = params.title?.trim() || defaultTitle;

    // Check if payroll run already exists for this branch/year/month
    const existingRun = await db.payrollRun.findUnique({
      where: {
        branchId_year_month: { branchId, year, month },
      },
    });

    if (existingRun) {
      if (existingRun.status !== PayrollStatus.CANCELLED) {
        throw new Error(
          `A payroll run for ${monthNames[month - 1]} ${year} already exists (${existingRun.payrollNumber}) in status ${existingRun.status}.`
        );
      }
    }

    const periodStartDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const periodEndDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Fetch active eligible employees with active compensation
    const eligibleCompensations = await db.employeeCompensation.findMany({
      where: {
        branchId,
        isActive: true,
        baseSalary: { gt: 0 },
        employee: {
          branchId,
          joinedAt: { lte: periodEndDate },
          OR: [
            { status: 'ACTIVE' },
            {
              status: 'TERMINATED',
              terminatedAt: { gte: periodStartDate },
            },
          ],
        },
      },
      include: {
        employee: {
          include: {
            department: true,
            employeeType: true,
          },
        },
        items: {
          where: { isActive: true },
          include: { component: true },
        },
      },
    });

    if (eligibleCompensations.length === 0) {
      throw new Error("No eligible active employees with salary profiles found for this period.");
    }

    const createdRun = await db.$transaction(async (tx) => {
      // If there was a cancelled run with same branch/year/month, delete or overwrite
      if (existingRun && existingRun.status === PayrollStatus.CANCELLED) {
        await tx.payslipItem.deleteMany({
          where: { payslip: { payrollRunId: existingRun.id } },
        });
        await tx.payslip.deleteMany({
          where: { payrollRunId: existingRun.id },
        });
        await tx.payrollRun.delete({
          where: { id: existingRun.id },
        });
      }

      const payrollNumber = await this.generateSequenceNumber(tx, branchId, 'PAYROLL_RUN', year);

      let totalBasic = new Prisma.Decimal(0);
      let totalAllowances = new Prisma.Decimal(0);
      let totalGross = new Prisma.Decimal(0);
      let totalDeductions = new Prisma.Decimal(0);
      let totalNet = new Prisma.Decimal(0);
      let totalEmployerCost = new Prisma.Decimal(0);

      const payslipRecordsToCreate: Array<{
        employeeId: string;
        payslipNumber: string;
        employeeCode: string;
        employeeName: string;
        departmentName: string | null;
        employeeTypeName: string | null;
        tinNumber: string | null;
        nssfNumber: string | null;
        baseSalary: Prisma.Decimal;
        totalAllowances: Prisma.Decimal;
        grossSalary: Prisma.Decimal;
        totalDeductions: Prisma.Decimal;
        netSalary: Prisma.Decimal;
        employerContribution: Prisma.Decimal;
        paymentMethod: SalaryPaymentMethod;
        bankName: string | null;
        accountNumber: string | null;
        accountName: string | null;
        mobileMoneyNumber: string | null;
        items: Array<{
          componentId?: string;
          code: string;
          name: string;
          type: SalaryComponentType;
          amount: Prisma.Decimal;
          rateApplied: Prisma.Decimal | null;
          isStatutory: boolean;
          isTaxable: boolean;
        }>;
      }> = [];

      for (const comp of eligibleCompensations) {
        const emp = comp.employee;
        const payslipNumber = await this.generateSequenceNumber(tx, branchId, 'PAYSLIP', year);

        // Build allowances and custom deductions
        const allowances: Array<{
          componentId?: string;
          code: string;
          name: string;
          amount: Prisma.Decimal;
          rateApplied?: Prisma.Decimal | null;
          isTaxable?: boolean;
        }> = [];

        const customDeductions: Array<{
          componentId?: string;
          code: string;
          name: string;
          amount: Prisma.Decimal;
          rateApplied?: Prisma.Decimal | null;
        }> = [];

        for (const item of comp.items) {
          const compDef = item.component;
          if (!compDef || !compDef.isActive) continue;

          let calculatedAmount = new Prisma.Decimal(0);
          let rateApplied: Prisma.Decimal | null = null;

          if (compDef.calculationType === 'PERCENTAGE_OF_BASIC') {
            const rate = item.percentageRate || compDef.percentageRate || new Prisma.Decimal(0);
            rateApplied = rate;
            calculatedAmount = comp.baseSalary.times(rate).dividedBy(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          } else if (compDef.calculationType === 'FIXED_AMOUNT') {
            calculatedAmount = item.amount || compDef.defaultAmount || new Prisma.Decimal(0);
          }

          if (compDef.type === 'ALLOWANCE') {
            allowances.push({
              componentId: compDef.id,
              code: compDef.code,
              name: compDef.name,
              amount: calculatedAmount,
              rateApplied,
              isTaxable: compDef.isTaxable,
            });
          } else if (compDef.type === 'DEDUCTION' && !compDef.isStatutory) {
            customDeductions.push({
              componentId: compDef.id,
              code: compDef.code,
              name: compDef.name,
              amount: calculatedAmount,
              rateApplied,
            });
          }
        }

        const breakdown = UgandaStatutoryEngine.calculatePayslipBreakdown({
          baseSalary: comp.baseSalary,
          allowances,
          customDeductions,
          effectiveDate: periodEndDate,
        });

        totalBasic = totalBasic.plus(breakdown.baseSalary);
        totalAllowances = totalAllowances.plus(breakdown.totalAllowances);
        totalGross = totalGross.plus(breakdown.grossSalary);
        totalDeductions = totalDeductions.plus(breakdown.totalDeductions);
        totalNet = totalNet.plus(breakdown.netSalary);
        totalEmployerCost = totalEmployerCost.plus(breakdown.employerTotalCost);

        payslipRecordsToCreate.push({
          employeeId: emp.id,
          payslipNumber,
          employeeCode: emp.employeeCode,
          employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
          departmentName: emp.department?.name || null,
          employeeTypeName: emp.employeeType?.name || null,
          tinNumber: comp.tinNumber,
          nssfNumber: comp.nssfNumber,
          baseSalary: breakdown.baseSalary,
          totalAllowances: breakdown.totalAllowances,
          grossSalary: breakdown.grossSalary,
          totalDeductions: breakdown.totalDeductions,
          netSalary: breakdown.netSalary,
          employerContribution: breakdown.employerNSSF,
          paymentMethod: comp.paymentMethod,
          bankName: comp.bankName,
          accountNumber: comp.accountNumber,
          accountName: comp.accountName,
          mobileMoneyNumber: comp.mobileMoneyNumber,
          items: breakdown.calculatedItems.map((ci) => ({
            componentId: ci.componentId,
            code: ci.code,
            name: ci.name,
            type: ci.type as SalaryComponentType,
            amount: ci.amount,
            rateApplied: ci.rateApplied ? new Prisma.Decimal(ci.rateApplied.toString()) : null,
            isStatutory: ci.isStatutory,
            isTaxable: ci.isTaxable,
          })),
        });
      }

      // Create PayrollRun
      const run = await tx.payrollRun.create({
        data: {
          branchId,
          payrollNumber,
          year,
          month,
          title,
          status: PayrollStatus.DRAFT,
          totalBasic,
          totalAllowances,
          totalGross,
          totalDeductions,
          totalNet,
          totalEmployerCost,
          totalEmployees: payslipRecordsToCreate.length,
          paidEmployees: 0,
          createdById: ctx.userId!,
        },
      });

      // Create Payslips & Line Items
      for (const pr of payslipRecordsToCreate) {
        const payslip = await tx.payslip.create({
          data: {
            branchId,
            payrollRunId: run.id,
            employeeId: pr.employeeId,
            payslipNumber: pr.payslipNumber,
            status: PayslipStatus.PENDING,
            employeeCode: pr.employeeCode,
            employeeName: pr.employeeName,
            departmentName: pr.departmentName,
            employeeTypeName: pr.employeeTypeName,
            tinNumber: pr.tinNumber,
            nssfNumber: pr.nssfNumber,
            baseSalary: pr.baseSalary,
            totalAllowances: pr.totalAllowances,
            grossSalary: pr.grossSalary,
            totalDeductions: pr.totalDeductions,
            netSalary: pr.netSalary,
            employerContribution: pr.employerContribution,
            paymentMethod: pr.paymentMethod,
            bankName: pr.bankName,
            accountNumber: pr.accountNumber,
            accountName: pr.accountName,
            mobileMoneyNumber: pr.mobileMoneyNumber,
          },
        });

        if (pr.items.length > 0) {
          await tx.payslipItem.createMany({
            data: pr.items.map((it) => ({
              payslipId: payslip.id,
              componentId: it.componentId || null,
              name: it.name,
              code: it.code,
              type: it.type,
              amount: it.amount,
              rateApplied: it.rateApplied,
              isStatutory: it.isStatutory,
              isTaxable: it.isTaxable,
            })),
          });
        }
      }

      return tx.payrollRun.findUnique({
        where: { id: run.id },
        include: {
          payslips: {
            include: { items: true },
          },
        },
      });
    });

    await AuditService.log(
      ctx,
      'PAYROLL_RUN_CREATED',
      'PayrollRun',
      createdRun?.id,
      JSON.stringify({
        payrollNumber: createdRun?.payrollNumber,
        year,
        month,
        totalEmployees: createdRun?.totalEmployees,
        totalGross: createdRun?.totalGross.toString(),
        totalNet: createdRun?.totalNet.toString(),
      })
    );

    return createdRun!;
  }

  /**
   * Adjust or add an ad-hoc line item on a draft payslip.
   */
  static async adjustDraftPayslipItem(
    ctx: TenantContext,
    params: {
      payslipId: string;
      name: string;
      code: string;
      type: SalaryComponentType;
      amount: number | string | Prisma.Decimal;
      isTaxable?: boolean;
      notes?: string;
    }
  ) {
    this.checkWritePermission(ctx);

    const payslip = await db.payslip.findFirst({
      where: {
        id: params.payslipId,
        branchId: ctx.branchId,
      },
      include: {
        payrollRun: true,
        items: true,
      },
    });

    if (!payslip) throw new Error("Payslip not found or access denied.");
    if (payslip.payrollRun.status !== PayrollStatus.DRAFT) {
      throw new Error(`Cannot adjust payslip items on a payroll run in status ${payslip.payrollRun.status}. Run must be in DRAFT.`);
    }

    const itemAmt = new Prisma.Decimal(params.amount.toString());
    if (itemAmt.lessThanOrEqualTo(0)) {
      throw new Error("Item amount must be greater than zero.");
    }

    const result = await db.$transaction(async (tx) => {
      // Add line item
      await tx.payslipItem.create({
        data: {
          payslipId: payslip.id,
          name: params.name.trim(),
          code: params.code.trim().toUpperCase(),
          type: params.type,
          amount: itemAmt,
          isStatutory: false,
          isTaxable: params.isTaxable !== false,
          notes: params.notes?.trim() || null,
        },
      });

      // Refetch all items and recalculate payslip
      const allItems = await tx.payslipItem.findMany({
        where: { payslipId: payslip.id },
      });

      const allowances: Array<{
        componentId?: string;
        code: string;
        name: string;
        amount: Prisma.Decimal;
        rateApplied?: Prisma.Decimal | null;
        isTaxable?: boolean;
      }> = [];

      const customDeductions: Array<{
        componentId?: string;
        code: string;
        name: string;
        amount: Prisma.Decimal;
        rateApplied?: Prisma.Decimal | null;
      }> = [];

      for (const it of allItems) {
        if (it.isStatutory) continue; // Statutory will be recomputed
        if (it.type === SalaryComponentType.ALLOWANCE) {
          allowances.push({
            componentId: it.componentId || undefined,
            code: it.code,
            name: it.name,
            amount: it.amount,
            rateApplied: it.rateApplied,
            isTaxable: it.isTaxable,
          });
        } else if (it.type === SalaryComponentType.DEDUCTION) {
          customDeductions.push({
            componentId: it.componentId || undefined,
            code: it.code,
            name: it.name,
            amount: it.amount,
            rateApplied: it.rateApplied,
          });
        }
      }

      // Recompute breakdown
      const breakdown = UgandaStatutoryEngine.calculatePayslipBreakdown({
        baseSalary: payslip.baseSalary,
        allowances,
        customDeductions,
      });

      // Update statutory items on payslip
      await tx.payslipItem.deleteMany({
        where: { payslipId: payslip.id, isStatutory: true },
      });

      const statutoryItems = breakdown.calculatedItems.filter((ci) => ci.isStatutory);
      if (statutoryItems.length > 0) {
        await tx.payslipItem.createMany({
          data: statutoryItems.map((si) => ({
            payslipId: payslip.id,
            name: si.name,
            code: si.code,
            type: si.type as SalaryComponentType,
            amount: si.amount,
            rateApplied: si.rateApplied ? new Prisma.Decimal(si.rateApplied.toString()) : null,
            isStatutory: true,
            isTaxable: false,
          })),
        });
      }

      // Update Payslip
      await tx.payslip.update({
        where: { id: payslip.id },
        data: {
          totalAllowances: breakdown.totalAllowances,
          grossSalary: breakdown.grossSalary,
          totalDeductions: breakdown.totalDeductions,
          netSalary: breakdown.netSalary,
          employerContribution: breakdown.employerNSSF,
        },
      });

      // Re-aggregate parent PayrollRun totals
      const allBranchPayslips = await tx.payslip.findMany({
        where: { payrollRunId: payslip.payrollRunId },
      });

      let totalBasic = new Prisma.Decimal(0);
      let totalAllowancesSum = new Prisma.Decimal(0);
      let totalGrossSum = new Prisma.Decimal(0);
      let totalDeductionsSum = new Prisma.Decimal(0);
      let totalNetSum = new Prisma.Decimal(0);
      let totalEmployerCostSum = new Prisma.Decimal(0);

      for (const ps of allBranchPayslips) {
        totalBasic = totalBasic.plus(ps.baseSalary);
        totalAllowancesSum = totalAllowancesSum.plus(ps.totalAllowances);
        totalGrossSum = totalGrossSum.plus(ps.grossSalary);
        totalDeductionsSum = totalDeductionsSum.plus(ps.totalDeductions);
        totalNetSum = totalNetSum.plus(ps.netSalary);
        totalEmployerCostSum = totalEmployerCostSum.plus(ps.grossSalary.plus(ps.employerContribution));
      }

      await tx.payrollRun.update({
        where: { id: payslip.payrollRunId },
        data: {
          totalBasic,
          totalAllowances: totalAllowancesSum,
          totalGross: totalGrossSum,
          totalDeductions: totalDeductionsSum,
          totalNet: totalNetSum,
          totalEmployerCost: totalEmployerCostSum,
        },
      });

      return tx.payslip.findUnique({
        where: { id: payslip.id },
        include: { items: true },
      });
    });

    await AuditService.log(
      ctx,
      'PAYSLIP_ITEM_ADJUSTED',
      'Payslip',
      payslip.id,
      JSON.stringify({
        payslipNumber: payslip.payslipNumber,
        itemName: params.name,
        amount: itemAmt.toString(),
        type: params.type,
      })
    );

    return result!;
  }

  /**
   * Submit draft payroll run for approval.
   */
  static async submitPayrollRun(ctx: TenantContext, id: string) {
    this.checkSubmitPermission(ctx);

    const run = await db.payrollRun.findFirst({
      where: { id, branchId: ctx.branchId },
    });

    if (!run) throw new Error("Payroll run not found or access denied.");
    if (run.status !== PayrollStatus.DRAFT) {
      throw new Error(`Only DRAFT payroll runs can be submitted. Current status: ${run.status}.`);
    }

    const updated = await db.payrollRun.update({
      where: { id },
      data: {
        status: PayrollStatus.SUBMITTED,
        submittedById: ctx.userId,
        submittedAt: new Date(),
      },
    });

    await AuditService.log(
      ctx,
      'PAYROLL_RUN_SUBMITTED',
      'PayrollRun',
      id,
      JSON.stringify({ payrollNumber: run.payrollNumber, totalNet: run.totalNet.toString() })
    );

    return updated;
  }

  /**
   * Approve submitted payroll run.
   * Enforces segregation of duties: submitter cannot self-approve.
   */
  static async approvePayrollRun(ctx: TenantContext, id: string) {
    this.checkApprovePermission(ctx);

    const run = await db.payrollRun.findFirst({
      where: { id, branchId: ctx.branchId },
    });

    if (!run) throw new Error("Payroll run not found or access denied.");
    if (run.status !== PayrollStatus.SUBMITTED) {
      throw new Error(`Only SUBMITTED payroll runs can be approved. Current status: ${run.status}.`);
    }

    // Segregation of duties check: prevent self-approval (allow if bypass enabled for single-user dev testing)
    const isSingleAdminMode = process.env.ALLOW_SELF_APPROVAL === 'true';
    if (!isSingleAdminMode && run.submittedById && run.submittedById === ctx.userId) {
      throw new Error("Segregation of duties violation: Submitter cannot self-approve payroll run.");
    }

    const updated = await db.$transaction(async (tx) => {
      const up = await tx.payrollRun.update({
        where: { id },
        data: {
          status: PayrollStatus.APPROVED,
          approvedById: ctx.userId,
          approvedAt: new Date(),
        },
      });

      // Post Payroll Accrual to General Ledger (Phase 3.1L)
      try {
        await GLIntegrationService.postPayrollAccrual(tx, ctx, id);
      } catch {
        // Non-blocking fallback
      }

      return up;
    });

    await AuditService.log(
      ctx,
      'PAYROLL_RUN_APPROVED',
      'PayrollRun',
      id,
      JSON.stringify({ payrollNumber: run.payrollNumber, approvedBy: ctx.userId })
    );

    return updated;
  }

  /**
   * Reject / return payroll run to DRAFT with feedback.
   */
  static async rejectPayrollRun(ctx: TenantContext, id: string, reason: string) {
    this.checkApprovePermission(ctx);

    const feedback = reason?.trim();
    if (!feedback || feedback.length < 5) {
      throw new Error("Rejection feedback must be at least 5 characters long.");
    }

    const run = await db.payrollRun.findFirst({
      where: { id, branchId: ctx.branchId },
    });

    if (!run) throw new Error("Payroll run not found or access denied.");
    if (run.status !== PayrollStatus.SUBMITTED && run.status !== PayrollStatus.APPROVED) {
      throw new Error(`Cannot reject payroll run in status ${run.status}. Must be SUBMITTED or APPROVED.`);
    }

    const updated = await db.payrollRun.update({
      where: { id },
      data: {
        status: PayrollStatus.DRAFT,
        approvedById: null,
        approvedAt: null,
        submittedById: null,
        submittedAt: null,
        notes: `Returned to DRAFT: ${feedback}`,
      },
    });

    await AuditService.log(
      ctx,
      'PAYROLL_RUN_REJECTED',
      'PayrollRun',
      id,
      JSON.stringify({ payrollNumber: run.payrollNumber, feedback })
    );

    return updated;
  }

  /**
   * Disburse payroll run and automatically create Phase 3.1D Expense voucher for net salary payout.
   */
  static async disbursePayrollRun(
    ctx: TenantContext,
    params: {
      id: string;
      paymentReference?: string;
      paymentDate?: Date;
    }
  ) {
    this.checkDisbursePermission(ctx);

    const { id, paymentReference, paymentDate = new Date() } = params;
    const branchId = ctx.branchId!;

    const run = await db.payrollRun.findFirst({
      where: { id, branchId },
      include: { payslips: true },
    });

    if (!run) throw new Error("Payroll run not found or access denied.");

    // Idempotency check: if already PAID, return cleanly
    if (run.status === PayrollStatus.PAID) {
      return { payrollRun: run, isReplay: true };
    }

    if (run.status !== PayrollStatus.APPROVED) {
      throw new Error(`Only APPROVED payroll runs can be disbursed. Current status: ${run.status}.`);
    }

    try {
      const disbursedResult = await db.$transaction(async (tx) => {
        // Re-check inside transaction
        const freshRun = await tx.payrollRun.findFirst({
          where: { id, branchId },
          include: { payslips: true, expense: true },
        });

        if (!freshRun) throw new Error("Payroll run not found or access denied.");
        if (freshRun.status === PayrollStatus.PAID) {
          return { payrollRun: freshRun, expense: freshRun.expense!, isReplay: true };
        }

        if (freshRun.status !== PayrollStatus.APPROVED) {
          throw new Error(`Only APPROVED payroll runs can be disbursed. Current status: ${freshRun.status}.`);
        }

        // Ensure Salaries & Wages category exists
        let salaryCategory = await tx.expenseCategory.findFirst({
          where: { branchId, code: 'SALARIES_AND_WAGES' },
        });

        if (!salaryCategory) {
          salaryCategory = await tx.expenseCategory.create({
            data: {
              branchId,
              name: 'Salaries & Wages',
              code: 'SALARIES_AND_WAGES',
              description: 'Staff payroll remuneration and net salary disbursements',
              isActive: true,
            },
          });
        }

        // Generate Expense Voucher Number
        const voucherNumber = await ExpenseDAO.generateNextVoucherNumber(tx, branchId, paymentDate);
        const idempotencyKey = `EXP_PR_${freshRun.payrollNumber}`;

        // Create linked Expense voucher in Phase 3.1D
        const expense = await tx.expense.create({
          data: {
            branchId,
            categoryId: salaryCategory.id,
            idempotencyKey,
            voucherNumber,
            title: `Staff Payroll Disbursed - ${freshRun.title}`,
            amount: freshRun.totalNet,
            expenseDate: paymentDate,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            vendorName: 'School Staff Remuneration',
            receiptRef: paymentReference?.trim() || freshRun.payrollNumber,
            notes: `Payroll Run ${freshRun.payrollNumber} (Gross: UGX ${freshRun.totalGross.toFixed(2)}, Deductions: UGX ${freshRun.totalDeductions.toFixed(2)}, Net: UGX ${freshRun.totalNet.toFixed(2)}, Employer NSSF: UGX ${freshRun.totalEmployerCost.minus(freshRun.totalGross).toFixed(2)})`,
            status: ExpenseStatus.COMPLETED,
            recordedById: ctx.userId!,
          },
        });

        // Update all payslips to PAID
        await tx.payslip.updateMany({
          where: { payrollRunId: freshRun.id },
          data: {
            status: PayslipStatus.PAID,
            paymentDate,
            paymentReference: paymentReference?.trim() || `DISB-${freshRun.payrollNumber}`,
          },
        });

        // Update PayrollRun to PAID
        const updatedRun = await tx.payrollRun.update({
          where: { id: freshRun.id },
          data: {
            status: PayrollStatus.PAID,
            paidEmployees: freshRun.payslips.length,
            disbursedById: ctx.userId,
            disbursedAt: paymentDate,
            expenseId: expense.id,
          },
          include: {
            payslips: { include: { items: true } },
            expense: true,
          },
        });

        // Post Payroll Net Disbursement to General Ledger (Phase 3.1L)
        try {
          await GLIntegrationService.postPayrollDisbursement(tx, ctx, freshRun.id);
        } catch {
          // Non-blocking fallback
        }

        return { payrollRun: updatedRun, expense, isReplay: false };
      });

      if (!disbursedResult.isReplay) {
        await AuditService.log(
          ctx,
          'PAYROLL_RUN_DISBURSED',
          'PayrollRun',
          id,
          JSON.stringify({
            payrollNumber: run.payrollNumber,
            totalNet: run.totalNet.toString(),
            expenseVoucher: disbursedResult.expense.voucherNumber,
          })
        );
      }

      return disbursedResult;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const reloaded = await db.payrollRun.findFirst({
          where: { id, branchId },
          include: { expense: true, payslips: { include: { items: true } } },
        });
        if (reloaded && reloaded.status === PayrollStatus.PAID) {
          return { payrollRun: reloaded, expense: reloaded.expense!, isReplay: true };
        }
      }
      throw err;
    }
  }

  /**
   * Reverse/Cancel an approved or paid payroll run with full audit trail and voiding of linked Expense voucher.
   */
  static async reversePayrollRun(ctx: TenantContext, id: string, reason: string) {
    this.checkCancelPermission(ctx);

    const cancellationReason = reason?.trim();
    if (!cancellationReason || cancellationReason.length < 10) {
      throw new Error("Cancellation / reversal reason must be at least 10 characters long.");
    }

    const run = await db.payrollRun.findFirst({
      where: { id, branchId: ctx.branchId },
      include: { expense: true },
    });

    if (!run) throw new Error("Payroll run not found or access denied.");
    if (run.status === PayrollStatus.CANCELLED) {
      throw new Error("Payroll run is already cancelled/reversed.");
    }

    const reversed = await db.$transaction(async (tx) => {
      // If run was PAID and has a linked Expense, void it
      if (run.expenseId) {
        await tx.expense.update({
          where: { id: run.expenseId },
          data: {
            status: ExpenseStatus.VOID,
            voidedAt: new Date(),
            voidReason: `Reversed via Payroll Run ${run.payrollNumber}: ${cancellationReason}`,
            voidedById: ctx.userId,
          },
        });
      }

      // Update Payslips to CANCELLED
      await tx.payslip.updateMany({
        where: { payrollRunId: run.id },
        data: {
          status: PayslipStatus.CANCELLED,
        },
      });

      // Update PayrollRun to CANCELLED
      return tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollStatus.CANCELLED,
          cancellationReason,
        },
        include: { payslips: true, expense: true },
      });
    });

    await AuditService.log(
      ctx,
      'PAYROLL_RUN_CANCELLED',
      'PayrollRun',
      id,
      JSON.stringify({
        payrollNumber: run.payrollNumber,
        previousStatus: run.status,
        reason: cancellationReason,
      })
    );

    return reversed;
  }

  /**
   * Get single payroll run detail.
   */
  static async getPayrollRunDetail(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    return db.payrollRun.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        submittedBy: { select: { firstName: true, lastName: true, email: true } },
        approvedBy: { select: { firstName: true, lastName: true, email: true } },
        disbursedBy: { select: { firstName: true, lastName: true, email: true } },
        expense: true,
        payslips: {
          include: { items: true },
          orderBy: [{ employeeName: 'asc' }],
        },
      },
    });
  }

  /**
   * List payroll runs.
   */
  static async listPayrollRuns(
    ctx: TenantContext,
    options?: {
      year?: number;
      status?: PayrollStatus;
      limit?: number;
      offset?: number;
    }
  ) {
    this.checkReadPermission(ctx);

    const where: Prisma.PayrollRunWhereInput = {
      branchId: ctx.branchId,
    };

    if (options?.year) where.year = options.year;
    if (options?.status) where.status = options.status;

    return db.payrollRun.findMany({
      where,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        expense: { select: { voucherNumber: true, status: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  /**
   * Get single payslip detail.
   */
  static async getPayslipDetail(ctx: TenantContext, payslipId: string) {
    this.checkReadPermission(ctx);

    return db.payslip.findFirst({
      where: { id: payslipId, branchId: ctx.branchId },
      include: {
        payrollRun: true,
        items: true,
        employee: {
          include: {
            department: true,
            employeeType: true,
          },
        },
      },
    });
  }

  /**
   * Generate Bank Transfer Schedule CSV string.
   */
  static async generateBankScheduleExport(ctx: TenantContext, payrollRunId: string): Promise<string> {
    this.checkReadPermission(ctx);

    const run = await db.payrollRun.findFirst({
      where: { id: payrollRunId, branchId: ctx.branchId },
      include: {
        payslips: {
          orderBy: [{ employeeName: 'asc' }],
        },
      },
    });

    if (!run) throw new Error("Payroll run not found.");

    const headers = [
      "Payment Reference",
      "Employee Code",
      "Beneficiary Name",
      "Bank Name",
      "Account Number",
      "Account Name",
      "Amount (UGX)",
      "Narration",
    ];

    const rows = run.payslips.map((ps) => {
      const ref = `SAL-${run.year}${run.month.toString().padStart(2, '0')}-${ps.employeeCode}`;
      return [
        ref,
        `"${ps.employeeCode}"`,
        `"${ps.employeeName}"`,
        `"${ps.bankName || 'N/A'}"`,
        `"${ps.accountNumber || 'N/A'}"`,
        `"${ps.accountName || ps.employeeName}"`,
        ps.netSalary.toFixed(2),
        `"Salary for ${run.title}"`,
      ].join(',');
    });

    await AuditService.log(
      ctx,
      'PAYROLL_RUN_EXPORTED',
      'PayrollRun',
      payrollRunId,
      JSON.stringify({ type: 'BANK_SCHEDULE', payrollNumber: run.payrollNumber, count: rows.length })
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate Mobile Money Payout Schedule CSV string.
   */
  static async generateMoMoScheduleExport(ctx: TenantContext, payrollRunId: string): Promise<string> {
    this.checkReadPermission(ctx);

    const run = await db.payrollRun.findFirst({
      where: { id: payrollRunId, branchId: ctx.branchId },
      include: {
        payslips: {
          orderBy: [{ employeeName: 'asc' }],
        },
      },
    });

    if (!run) throw new Error("Payroll run not found.");

    const headers = [
      "Phone Number",
      "Recipient Name",
      "Amount (UGX)",
      "Reference",
      "Payment Method",
    ];

    const rows = run.payslips
      .filter((ps) => ps.paymentMethod === SalaryPaymentMethod.MOBILE_MONEY || ps.mobileMoneyNumber)
      .map((ps) => {
        const ref = `SAL-${run.year}${run.month.toString().padStart(2, '0')}-${ps.employeeCode}`;
        return [
          `"${ps.mobileMoneyNumber || ''}"`,
          `"${ps.employeeName}"`,
          ps.netSalary.toFixed(2),
          ref,
          ps.paymentMethod,
        ].join(',');
      });

    await AuditService.log(
      ctx,
      'PAYROLL_RUN_EXPORTED',
      'PayrollRun',
      payrollRunId,
      JSON.stringify({ type: 'MOMO_SCHEDULE', payrollNumber: run.payrollNumber, count: rows.length })
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate NSSF Form C Monthly Returns Schedule CSV string.
   */
  static async generateNssfScheduleExport(ctx: TenantContext, payrollRunId: string): Promise<string> {
    this.checkReadPermission(ctx);

    const run = await db.payrollRun.findFirst({
      where: { id: payrollRunId, branchId: ctx.branchId },
      include: {
        payslips: {
          orderBy: [{ employeeName: 'asc' }],
        },
      },
    });

    if (!run) throw new Error("Payroll run not found.");

    const headers = [
      "NSSF Number",
      "Employee Code",
      "Employee Name",
      "Gross Pay (UGX)",
      "Employee 5% (UGX)",
      "Employer 10% (UGX)",
      "Total 15% (UGX)",
    ];

    const rows = run.payslips.map((ps) => {
      const empNssf = ps.grossSalary.times(0.05).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const emprNssf = ps.grossSalary.times(0.10).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const totalNssf = empNssf.plus(emprNssf);

      return [
        `"${ps.nssfNumber || 'N/A'}"`,
        `"${ps.employeeCode}"`,
        `"${ps.employeeName}"`,
        ps.grossSalary.toFixed(2),
        empNssf.toFixed(2),
        emprNssf.toFixed(2),
        totalNssf.toFixed(2),
      ].join(',');
    });

    await AuditService.log(
      ctx,
      'PAYROLL_RUN_EXPORTED',
      'PayrollRun',
      payrollRunId,
      JSON.stringify({ type: 'NSSF_SCHEDULE', payrollNumber: run.payrollNumber, count: rows.length })
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate URA PAYE Monthly Tax Return Schedule CSV string.
   */
  static async generatePayeScheduleExport(ctx: TenantContext, payrollRunId: string): Promise<string> {
    this.checkReadPermission(ctx);

    const run = await db.payrollRun.findFirst({
      where: { id: payrollRunId, branchId: ctx.branchId },
      include: {
        payslips: {
          include: { items: true },
          orderBy: [{ employeeName: 'asc' }],
        },
      },
    });

    if (!run) throw new Error("Payroll run not found.");

    const headers = [
      "TIN",
      "Employee Code",
      "Employee Name",
      "Gross Emoluments (UGX)",
      "PAYE Tax Deducted (UGX)",
      "Net Pay (UGX)",
    ];

    const rows = run.payslips.map((ps) => {
      const payeItem = ps.items.find((it) => it.code === 'PAYE');
      const payeAmt = payeItem ? payeItem.amount.toFixed(2) : '0.00';

      return [
        `"${ps.tinNumber || 'N/A'}"`,
        `"${ps.employeeCode}"`,
        `"${ps.employeeName}"`,
        ps.grossSalary.toFixed(2),
        payeAmt,
        ps.netSalary.toFixed(2),
      ].join(',');
    });

    await AuditService.log(
      ctx,
      'PAYROLL_RUN_EXPORTED',
      'PayrollRun',
      payrollRunId,
      JSON.stringify({ type: 'PAYE_SCHEDULE', payrollNumber: run.payrollNumber, count: rows.length })
    );

    return [headers.join(','), ...rows].join('\n');
  }
}
