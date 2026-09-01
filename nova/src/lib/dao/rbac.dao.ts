import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export class RbacDAO {
  /**
   * Retrieves all roles scoped to the organization.
   */
  static async listRoles(ctx: TenantContext) {
    if (!ctx.organizationId) throw new UnauthorizedError();
    return db.role.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Creates a new role for the organization.
   */
  static async createRole(ctx: TenantContext, data: { name: string; permissions: string[] }) {
    if (!ctx.organizationId) throw new UnauthorizedError();
    if (!ctx.permissions.includes('all')) throw new UnauthorizedError("Only admins can create roles.");

    const existing = await db.role.findUnique({
      where: {
        organizationId_name: {
          organizationId: ctx.organizationId,
          name: data.name
        }
      }
    });

    if (existing) {
      throw new Error(`Role with name ${data.name} already exists.`);
    }

    const result = await db.role.create({
      data: {
        organizationId: ctx.organizationId,
        name: data.name,
        permissions: data.permissions
      }
    });

    await AuditService.log(ctx, "CREATE_ROLE", "Role", result.id, JSON.stringify(data));
    return result;
  }

  /**
   * Updates an existing role's permissions.
   */
  static async updateRole(ctx: TenantContext, roleId: string, data: { name?: string; permissions?: string[] }) {
    if (!ctx.organizationId) throw new UnauthorizedError();
    if (!ctx.permissions.includes('all')) throw new UnauthorizedError("Only admins can update roles.");

    const role = await db.role.findFirst({
      where: { id: roleId, organizationId: ctx.organizationId }
    });

    if (!role) {
      throw new Error("Role not found");
    }

    // Lockout protection: If modifying permissions, ensure we don't remove 'all' if this is the last admin role with users
    if (data.permissions && !data.permissions.includes('all') && role.permissions.includes('all')) {
      const activeAdminsCount = await this.countEffectiveAdmins(ctx.organizationId, roleId);
      if (activeAdminsCount === 0) {
        throw new Error("Cannot remove admin privileges from this role as it would leave the organization without any administrators.");
      }
    }

    if (data.name && data.name !== role.name) {
      const existing = await db.role.findUnique({
        where: {
          organizationId_name: {
            organizationId: ctx.organizationId,
            name: data.name
          }
        }
      });
      if (existing) throw new Error(`Role with name ${data.name} already exists.`);
    }

    const result = await db.role.update({
      where: { id: roleId },
      data
    });

    await AuditService.log(ctx, "UPDATE_ROLE", "Role", roleId, JSON.stringify(data));
    return result;
  }

  /**
   * Deletes a role.
   */
  static async deleteRole(ctx: TenantContext, roleId: string) {
    if (!ctx.organizationId) throw new UnauthorizedError();
    if (!ctx.permissions.includes('all')) throw new UnauthorizedError("Only admins can delete roles.");

    const role = await db.role.findFirst({
      where: { id: roleId, organizationId: ctx.organizationId }
    });

    if (!role) throw new Error("Role not found");

    if (role.permissions.includes('all')) {
      const activeAdminsCount = await this.countEffectiveAdmins(ctx.organizationId, roleId);
      if (activeAdminsCount === 0) {
        throw new Error("Cannot delete this role as it would leave the organization without any administrators.");
      }
    }

    const usageCount = await db.userBranchAccess.count({
      where: { roleId }
    });

    if (usageCount > 0) {
      throw new Error("Cannot delete role as it is currently assigned to users.");
    }

    await db.role.delete({
      where: { id: roleId }
    });

    await AuditService.log(ctx, "DELETE_ROLE", "Role", roleId);
    return { success: true };
  }

  /**
   * Counts how many active users have 'all' permission in the organization,
   * excluding a specific role if it's being deleted or modified.
   */
  private static async countEffectiveAdmins(organizationId: string, excludeRoleId?: string): Promise<number> {
    const adminRoles = await db.role.findMany({
      where: {
        organizationId,
        permissions: { has: 'all' },
        ...(excludeRoleId ? { id: { not: excludeRoleId } } : {})
      }
    });

    if (adminRoles.length === 0) return 0;

    const count = await db.userBranchAccess.count({
      where: {
        roleId: { in: adminRoles.map(r => r.id) },
        user: { status: 'ACTIVE' }
      }
    });

    return count;
  }
}
