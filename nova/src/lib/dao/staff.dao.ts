import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { EmployeeStatus } from "@prisma/client";
import { checkPermission } from "../auth/require-auth";

export class StaffDAO {
  static async list(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:read');
    return db.employee.findMany({
      where: { branchId: ctx.branchId },
      include: {
        department: true,
        employeeType: true,
        user: true
      },
      orderBy: { lastName: 'asc' }
    });
  }

  static async getById(ctx: TenantContext, id: string) {
    if (!ctx.branchId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:read');
    const emp = await db.employee.findUnique({
      where: { id },
      include: { department: true, employeeType: true, user: true }
    });
    if (!emp || emp.branchId !== ctx.branchId) return null;
    return emp;
  }

  static async create(ctx: TenantContext, data: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    departmentId?: string;
    employeeTypeId: string;
  }) {
    if (!ctx.branchId) throw new UnauthorizedError();
    if (!ctx.userId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:write');

    const et = await db.employeeType.findUnique({ where: { id: data.employeeTypeId } });
    if (!et || et.branchId !== ctx.branchId) throw new Error("Invalid Employee Type");

    if (data.departmentId) {
      const dept = await db.department.findUnique({ where: { id: data.departmentId } });
      if (!dept || dept.branchId !== ctx.branchId) throw new Error("Invalid Department");
    }

    const emp = await db.employee.create({
      data: {
        ...data,
        branchId: ctx.branchId
      }
    });

    await AuditService.log(ctx, 'CREATE_EMPLOYEE', 'EMPLOYEE', emp.id, JSON.stringify({ employeeCode: emp.employeeCode }));
    return emp;
  }

  static async update(ctx: TenantContext, id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    departmentId?: string | null;
    employeeTypeId?: string;
    status?: EmployeeStatus;
  }) {
    if (!ctx.branchId) throw new UnauthorizedError();
    if (!ctx.userId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:write');

    const existing = await this.getById(ctx, id);
    if (!existing) throw new Error("Employee not found");

    if (data.employeeTypeId) {
      const et = await db.employeeType.findUnique({ where: { id: data.employeeTypeId } });
      if (!et || et.branchId !== ctx.branchId) throw new Error("Invalid Employee Type");
    }

    if (data.departmentId) {
      const dept = await db.department.findUnique({ where: { id: data.departmentId } });
      if (!dept || dept.branchId !== ctx.branchId) throw new Error("Invalid Department");
    }

    const emp = await db.employee.update({
      where: { id },
      data: {
        ...data,
        terminatedAt: data.status === 'TERMINATED' && existing.status !== 'TERMINATED' ? new Date() : undefined
      }
    });

    const action = data.status && data.status !== existing.status ? `CHANGE_STATUS_${data.status}` : 'UPDATE_EMPLOYEE';
    await AuditService.log(ctx, action, 'EMPLOYEE', emp.id, JSON.stringify(data));
    return emp;
  }

  static async linkUser(ctx: TenantContext, employeeId: string, userId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();
    if (!ctx.userId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:write');
    
    const emp = await this.getById(ctx, employeeId);
    if (!emp) throw new Error("Employee not found");

    // Verify User has branch access
    const userAccess = await db.userBranchAccess.findUnique({
      where: { userId_branchId: { userId, branchId: ctx.branchId } }
    });
    if (!userAccess) throw new Error("User does not have access to this branch");

    const updated = await db.employee.update({
      where: { id: employeeId },
      data: { userId }
    });

    await AuditService.log(ctx, 'LINK_EMPLOYEE_USER', 'EMPLOYEE', emp.id, JSON.stringify({ userId }));
    return updated;
  }
}
