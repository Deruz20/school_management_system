import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { checkPermission } from "../auth/require-auth";

export class DepartmentDAO {
  static async list(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:read');
    return db.department.findMany({
      where: { branchId: ctx.branchId },
      include: {
        hod: true,
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  static async getById(ctx: TenantContext, id: string) {
    if (!ctx.branchId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:read');
    const dept = await db.department.findUnique({
      where: { id },
      include: { hod: true, employees: true }
    });
    if (!dept || dept.branchId !== ctx.branchId) return null;
    return dept;
  }

  static async create(ctx: TenantContext, data: { name: string; description?: string; hodId?: string }) {
    if (!ctx.branchId) throw new UnauthorizedError();
    if (!ctx.userId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:write');

    if (data.hodId) {
      const hod = await db.employee.findUnique({ where: { id: data.hodId } });
      if (!hod || hod.branchId !== ctx.branchId) throw new Error("Invalid HOD selected");
    }

    const dept = await db.department.create({
      data: {
        ...data,
        branchId: ctx.branchId
      }
    });

    await AuditService.log(ctx, 'CREATE_DEPARTMENT', 'DEPARTMENT', dept.id, JSON.stringify({ name: dept.name }));
    return dept;
  }

  static async update(ctx: TenantContext, id: string, data: { name?: string; description?: string; hodId?: string | null }) {
    if (!ctx.branchId) throw new UnauthorizedError();
    if (!ctx.userId) throw new UnauthorizedError();
    checkPermission(ctx, 'staff:write');

    const existing = await this.getById(ctx, id);
    if (!existing) throw new Error("Department not found");

    if (data.hodId) {
      const hod = await db.employee.findUnique({ where: { id: data.hodId } });
      if (!hod || hod.branchId !== ctx.branchId) throw new Error("Invalid HOD selected");
    }

    const dept = await db.department.update({
      where: { id },
      data
    });

    await AuditService.log(ctx, 'UPDATE_DEPARTMENT', 'DEPARTMENT', dept.id, JSON.stringify(data));
    return dept;
  }
}
