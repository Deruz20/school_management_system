import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { checkPermission } from "../auth/require-auth";

export class EmployeeTypeDAO {
  static async list(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:read');
    return db.employeeType.findMany({
      where: { branchId: ctx.branchId },
      orderBy: { name: 'asc' }
    });
  }

  static async getById(ctx: TenantContext, id: string) {
    if (!ctx.branchId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:read');
    const type = await db.employeeType.findUnique({ where: { id } });
    if (!type || type.branchId !== ctx.branchId) return null;
    return type;
  }

  static async create(ctx: TenantContext, data: { name: string; description?: string; isTeachingStaff: boolean }) {
    if (!ctx.branchId) throw new UnauthorizedError();
    if (!ctx.userId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:write');

    const type = await db.employeeType.create({
      data: {
        ...data,
        branchId: ctx.branchId
      }
    });

    await AuditService.log(ctx, 'CREATE_EMPLOYEE_TYPE', 'EMPLOYEE_TYPE', type.id, JSON.stringify({ name: type.name }));
    return type;
  }

  static async update(ctx: TenantContext, id: string, data: { name?: string; description?: string; isTeachingStaff?: boolean }) {
    if (!ctx.branchId) throw new UnauthorizedError();
    if (!ctx.userId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:write');

    const existing = await this.getById(ctx, id);
    if (!existing) throw new Error("EmployeeType not found");

    const type = await db.employeeType.update({
      where: { id },
      data
    });

    await AuditService.log(ctx, 'UPDATE_EMPLOYEE_TYPE', 'EMPLOYEE_TYPE', type.id, JSON.stringify(data));
    return type;
  }
}
