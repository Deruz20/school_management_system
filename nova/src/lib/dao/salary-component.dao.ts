import { db } from "../db";
import { Prisma, SalaryComponentType, CalculationType } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface CreateSalaryComponentInput {
  name: string;
  code: string;
  type: SalaryComponentType;
  calculationType: CalculationType;
  defaultAmount?: number | string | Prisma.Decimal | null;
  percentageRate?: number | string | Prisma.Decimal | null;
  isStatutory?: boolean;
  isTaxable?: boolean;
  description?: string | null;
}

export interface UpdateSalaryComponentInput {
  name?: string;
  defaultAmount?: number | string | Prisma.Decimal | null;
  percentageRate?: number | string | Prisma.Decimal | null;
  isTaxable?: boolean;
  description?: string | null;
  isActive?: boolean;
}

export class SalaryComponentDAO {
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

  /**
   * Seed standard salary components if they don't exist for the branch.
   */
  static async ensureDefaultComponents(ctx: TenantContext) {
    if (!ctx.branchId) return;

    const defaults: Array<{
      name: string;
      code: string;
      type: SalaryComponentType;
      calculationType: CalculationType;
      defaultAmount?: number;
      percentageRate?: number;
      isStatutory: boolean;
      isTaxable: boolean;
      description: string;
    }> = [
      {
        name: "Housing Allowance",
        code: "HOUSING_ALLOWANCE",
        type: SalaryComponentType.ALLOWANCE,
        calculationType: CalculationType.PERCENTAGE_OF_BASIC,
        percentageRate: 15.0,
        isStatutory: false,
        isTaxable: true,
        description: "Standard housing allowance (15% of basic salary)",
      },
      {
        name: "Transport Allowance",
        code: "TRANSPORT_ALLOWANCE",
        type: SalaryComponentType.ALLOWANCE,
        calculationType: CalculationType.FIXED_AMOUNT,
        defaultAmount: 100000,
        isStatutory: false,
        isTaxable: true,
        description: "Monthly staff transport stipend",
      },
      {
        name: "Responsibility Allowance",
        code: "RESPONSIBILITY_ALLOWANCE",
        type: SalaryComponentType.ALLOWANCE,
        calculationType: CalculationType.FIXED_AMOUNT,
        defaultAmount: 150000,
        isStatutory: false,
        isTaxable: true,
        description: "Allowance for HODs, House Masters, and Special Duties",
      },
      {
        name: "NSSF Employee Contribution (5%)",
        code: "NSSF_EMPLOYEE",
        type: SalaryComponentType.DEDUCTION,
        calculationType: CalculationType.NSSF_STANDARD,
        percentageRate: 5.0,
        isStatutory: true,
        isTaxable: false,
        description: "Statutory 5% NSSF employee deduction from gross pay",
      },
      {
        name: "URA PAYE Income Tax",
        code: "PAYE_TAX",
        type: SalaryComponentType.DEDUCTION,
        calculationType: CalculationType.UGANDA_PAYE_TIER,
        isStatutory: true,
        isTaxable: false,
        description: "Statutory URA progressive monthly PAYE tax",
      },
      {
        name: "Staff SACCO Savings",
        code: "STAFF_SACCO",
        type: SalaryComponentType.DEDUCTION,
        calculationType: CalculationType.FIXED_AMOUNT,
        defaultAmount: 50000,
        isStatutory: false,
        isTaxable: false,
        description: "Voluntary staff SACCO monthly contribution",
      },
      {
        name: "Staff Welfare Fund",
        code: "STAFF_WELFARE",
        type: SalaryComponentType.DEDUCTION,
        calculationType: CalculationType.FIXED_AMOUNT,
        defaultAmount: 20000,
        isStatutory: false,
        isTaxable: false,
        description: "School staff welfare and emergency pool",
      },
      {
        name: "Salary Advance Recovery",
        code: "SALARY_ADVANCE",
        type: SalaryComponentType.DEDUCTION,
        calculationType: CalculationType.FIXED_AMOUNT,
        isStatutory: false,
        isTaxable: false,
        description: "Recovery of approved mid-month staff salary advances",
      },
      {
        name: "NSSF Employer Contribution (10%)",
        code: "NSSF_EMPLOYER",
        type: SalaryComponentType.EMPLOYER_CONTRIBUTION,
        calculationType: CalculationType.NSSF_STANDARD,
        percentageRate: 10.0,
        isStatutory: true,
        isTaxable: false,
        description: "Statutory 10% NSSF employer institutional contribution",
      },
    ];

    for (const item of defaults) {
      await db.salaryComponent.upsert({
        where: {
          branchId_code: {
            branchId: ctx.branchId,
            code: item.code,
          },
        },
        create: {
          branchId: ctx.branchId,
          name: item.name,
          code: item.code,
          type: item.type,
          calculationType: item.calculationType,
          defaultAmount: item.defaultAmount ? new Prisma.Decimal(item.defaultAmount) : null,
          percentageRate: item.percentageRate ? new Prisma.Decimal(item.percentageRate) : null,
          isStatutory: item.isStatutory,
          isTaxable: item.isTaxable,
          description: item.description,
          isActive: true,
        },
        update: {},
      });
    }
  }

  /**
   * List all components for branch.
   */
  static async listComponents(ctx: TenantContext, options?: { type?: SalaryComponentType; activeOnly?: boolean }) {
    this.checkReadPermission(ctx);

    const where: Prisma.SalaryComponentWhereInput = {
      branchId: ctx.branchId,
    };

    if (options?.type) {
      where.type = options.type;
    }
    if (options?.activeOnly) {
      where.isActive = true;
    }

    return db.salaryComponent.findMany({
      where,
      orderBy: [{ isStatutory: 'desc' }, { type: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Create a custom salary component.
   */
  static async createComponent(ctx: TenantContext, input: CreateSalaryComponentInput) {
    this.checkWritePermission(ctx);

    const normalizedCode = input.code.trim().toUpperCase().replace(/\s+/g, '_');
    const normalizedName = input.name.trim();

    if (!normalizedName) throw new Error("Component name is required.");
    if (!normalizedCode) throw new Error("Component code is required.");

    const created = await db.salaryComponent.create({
      data: {
        branchId: ctx.branchId!,
        name: normalizedName,
        code: normalizedCode,
        type: input.type,
        calculationType: input.calculationType,
        defaultAmount: input.defaultAmount !== undefined && input.defaultAmount !== null ? new Prisma.Decimal(input.defaultAmount.toString()) : null,
        percentageRate: input.percentageRate !== undefined && input.percentageRate !== null ? new Prisma.Decimal(input.percentageRate.toString()) : null,
        isStatutory: input.isStatutory || false,
        isTaxable: input.isTaxable !== false,
        description: input.description?.trim() || null,
        isActive: true,
      },
    });

    await AuditService.log(
      ctx,
      'PAYROLL_COMPONENT_CREATED',
      'SalaryComponent',
      created.id,
      JSON.stringify({ code: created.code, name: created.name, type: created.type })
    );

    return created;
  }

  /**
   * Update component.
   */
  static async updateComponent(ctx: TenantContext, id: string, input: UpdateSalaryComponentInput) {
    this.checkWritePermission(ctx);

    const component = await db.salaryComponent.findFirst({
      where: { id, branchId: ctx.branchId },
    });

    if (!component) throw new Error("Salary component not found or access denied.");

    const updated = await db.salaryComponent.update({
      where: { id },
      data: {
        name: input.name?.trim() || component.name,
        defaultAmount: input.defaultAmount !== undefined ? (input.defaultAmount !== null ? new Prisma.Decimal(input.defaultAmount.toString()) : null) : component.defaultAmount,
        percentageRate: input.percentageRate !== undefined ? (input.percentageRate !== null ? new Prisma.Decimal(input.percentageRate.toString()) : null) : component.percentageRate,
        isTaxable: input.isTaxable !== undefined ? input.isTaxable : component.isTaxable,
        description: input.description !== undefined ? input.description?.trim() || null : component.description,
        isActive: input.isActive !== undefined ? input.isActive : component.isActive,
      },
    });

    await AuditService.log(
      ctx,
      'PAYROLL_COMPONENT_UPDATED',
      'SalaryComponent',
      id,
      JSON.stringify({ code: updated.code, name: updated.name, isActive: updated.isActive })
    );

    return updated;
  }
}
