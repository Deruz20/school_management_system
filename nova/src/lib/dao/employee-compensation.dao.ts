import { db } from "../db";
import { Prisma, SalaryPaymentMethod } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface SetEmployeeCompensationInput {
  employeeId: string;
  baseSalary: number | string | Prisma.Decimal;
  currency?: string;
  paymentMethod?: SalaryPaymentMethod;
  bankName?: string | null;
  bankBranch?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  mobileMoneyNumber?: string | null;
  mobileMoneyProvider?: string | null;
  tinNumber?: string | null;
  nssfNumber?: string | null;
  isActive?: boolean;
  recurringItems?: Array<{
    componentId: string;
    amount?: number | string | Prisma.Decimal | null;
    percentageRate?: number | string | Prisma.Decimal | null;
    isActive?: boolean;
  }>;
}

export class EmployeeCompensationDAO {
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
   * Get single employee compensation profile with items.
   */
  static async getCompensationByEmployeeId(ctx: TenantContext, employeeId: string) {
    this.checkReadPermission(ctx);

    return db.employeeCompensation.findFirst({
      where: {
        branchId: ctx.branchId,
        employeeId,
      },
      include: {
        employee: {
          include: {
            department: true,
            employeeType: true,
          },
        },
        items: {
          include: {
            component: true,
          },
        },
      },
    });
  }

  /**
   * List all compensation profiles in branch.
   */
  static async listCompensations(
    ctx: TenantContext,
    options?: {
      departmentId?: string;
      employeeTypeId?: string;
      search?: string;
      isActive?: boolean;
    }
  ) {
    this.checkReadPermission(ctx);

    const where: Prisma.EmployeeCompensationWhereInput = {
      branchId: ctx.branchId,
    };

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options?.departmentId || options?.employeeTypeId || options?.search) {
      where.employee = {
        branchId: ctx.branchId,
      };

      if (options?.departmentId) {
        where.employee.departmentId = options.departmentId;
      }
      if (options?.employeeTypeId) {
        where.employee.employeeTypeId = options.employeeTypeId;
      }
      if (options?.search) {
        const q = options.search.trim();
        where.employee.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { employeeCode: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    return db.employeeCompensation.findMany({
      where,
      include: {
        employee: {
          include: {
            department: true,
            employeeType: true,
          },
        },
        items: {
          include: {
            component: true,
          },
        },
      },
      orderBy: [{ employee: { firstName: 'asc' } }, { employee: { lastName: 'asc' } }],
    });
  }

  /**
   * Upsert an employee compensation profile and assigned recurring items.
   */
  static async setCompensation(ctx: TenantContext, input: SetEmployeeCompensationInput) {
    this.checkWritePermission(ctx);

    const employee = await db.employee.findFirst({
      where: {
        id: input.employeeId,
        branchId: ctx.branchId,
      },
    });

    if (!employee) {
      throw new Error("Employee not found or access denied.");
    }

    const baseSalaryDecimal = new Prisma.Decimal(input.baseSalary.toString());
    if (baseSalaryDecimal.lessThan(0)) {
      throw new Error("Base salary cannot be negative.");
    }

    const result = await db.$transaction(async (tx) => {
      const compensation = await tx.employeeCompensation.upsert({
        where: {
          branchId_employeeId: {
            branchId: ctx.branchId!,
            employeeId: input.employeeId,
          },
        },
        create: {
          branchId: ctx.branchId!,
          employeeId: input.employeeId,
          baseSalary: baseSalaryDecimal,
          currency: input.currency || 'UGX',
          paymentMethod: input.paymentMethod || SalaryPaymentMethod.BANK_TRANSFER,
          bankName: input.bankName?.trim() || null,
          bankBranch: input.bankBranch?.trim() || null,
          accountNumber: input.accountNumber?.trim() || null,
          accountName: input.accountName?.trim() || null,
          mobileMoneyNumber: input.mobileMoneyNumber?.trim() || null,
          mobileMoneyProvider: input.mobileMoneyProvider?.trim() || null,
          tinNumber: input.tinNumber?.trim() || null,
          nssfNumber: input.nssfNumber?.trim() || null,
          isActive: input.isActive !== false,
        },
        update: {
          baseSalary: baseSalaryDecimal,
          currency: input.currency || 'UGX',
          paymentMethod: input.paymentMethod || undefined,
          bankName: input.bankName !== undefined ? input.bankName?.trim() || null : undefined,
          bankBranch: input.bankBranch !== undefined ? input.bankBranch?.trim() || null : undefined,
          accountNumber: input.accountNumber !== undefined ? input.accountNumber?.trim() || null : undefined,
          accountName: input.accountName !== undefined ? input.accountName?.trim() || null : undefined,
          mobileMoneyNumber: input.mobileMoneyNumber !== undefined ? input.mobileMoneyNumber?.trim() || null : undefined,
          mobileMoneyProvider: input.mobileMoneyProvider !== undefined ? input.mobileMoneyProvider?.trim() || null : undefined,
          tinNumber: input.tinNumber !== undefined ? input.tinNumber?.trim() || null : undefined,
          nssfNumber: input.nssfNumber !== undefined ? input.nssfNumber?.trim() || null : undefined,
          isActive: input.isActive !== undefined ? input.isActive : undefined,
        },
      });

      // Handle recurring items if provided
      if (input.recurringItems !== undefined) {
        // Delete items not in the list
        const activeCompIds = input.recurringItems.map((i) => i.componentId);
        await tx.employeeSalaryItem.deleteMany({
          where: {
            compensationId: compensation.id,
            componentId: { notIn: activeCompIds },
          },
        });

        // Upsert items
        for (const item of input.recurringItems) {
          const itemAmt = item.amount !== undefined && item.amount !== null ? new Prisma.Decimal(item.amount.toString()) : null;
          const itemRate = item.percentageRate !== undefined && item.percentageRate !== null ? new Prisma.Decimal(item.percentageRate.toString()) : null;

          await tx.employeeSalaryItem.upsert({
            where: {
              compensationId_componentId: {
                compensationId: compensation.id,
                componentId: item.componentId,
              },
            },
            create: {
              compensationId: compensation.id,
              componentId: item.componentId,
              amount: itemAmt,
              percentageRate: itemRate,
              isActive: item.isActive !== false,
            },
            update: {
              amount: itemAmt,
              percentageRate: itemRate,
              isActive: item.isActive !== false,
            },
          });
        }
      }

      return tx.employeeCompensation.findUnique({
        where: { id: compensation.id },
        include: {
          employee: {
            include: {
              department: true,
              employeeType: true,
            },
          },
          items: {
            include: {
              component: true,
            },
          },
        },
      });
    });

    await AuditService.log(
      ctx,
      'PAYROLL_COMPENSATION_UPDATED',
      'EmployeeCompensation',
      result?.id,
      JSON.stringify({
        employeeId: input.employeeId,
        baseSalary: baseSalaryDecimal.toString(),
        paymentMethod: input.paymentMethod,
      })
    );

    return result!;
  }
}
