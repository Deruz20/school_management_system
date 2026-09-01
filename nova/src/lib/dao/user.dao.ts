import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export class UserDAO {
  /**
   * Retrieves all users assigned to the current branch.
   */
  static async listBranchUsers(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError();
    
    return db.userBranchAccess.findMany({
      where: { branchId: ctx.branchId },
      include: {
        user: true,
        role: true
      },
      orderBy: { user: { firstName: 'asc' } }
    });
  }

  /**
   * Retrieves all users in the organization (for adding to a branch).
   */
  static async listOrganizationUsers(ctx: TenantContext) {
    if (!ctx.organizationId) throw new UnauthorizedError();

    return db.user.findMany({
      where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
      orderBy: { firstName: 'asc' }
    });
  }

  /**
   * Assigns a user to the branch with a specific role.
   */
  static async assignUserToBranch(ctx: TenantContext, userId: string, roleId: string) {
    if (!ctx.organizationId || !ctx.branchId) throw new UnauthorizedError();
    if (!ctx.permissions.includes('all')) throw new UnauthorizedError("Only admins can assign users.");

    // Verify role belongs to organization
    const role = await db.role.findFirst({
      where: { id: roleId, organizationId: ctx.organizationId }
    });
    if (!role) throw new Error("Role not found");

    // Verify user belongs to organization
    const user = await db.user.findFirst({
      where: { id: userId, organizationId: ctx.organizationId }
    });
    if (!user) throw new Error("User not found");

    // Check if already assigned
    const existing = await db.userBranchAccess.findUnique({
      where: {
        userId_branchId: { userId, branchId: ctx.branchId }
      }
    });

    if (existing) {
      // Just update the role
      return this.updateUserBranchRole(ctx, userId, roleId);
    }

    const result = await db.userBranchAccess.create({
      data: {
        userId,
        branchId: ctx.branchId,
        roleId
      }
    });

    await AuditService.log(ctx, "ASSIGN_USER", "UserBranchAccess", result.id, JSON.stringify({ userId, roleId }));
    return result;
  }

  /**
   * Updates a user's role in the branch.
   */
  static async updateUserBranchRole(ctx: TenantContext, userId: string, newRoleId: string) {
    if (!ctx.organizationId || !ctx.branchId) throw new UnauthorizedError();
    if (!ctx.permissions.includes('all')) throw new UnauthorizedError("Only admins can update user roles.");

    const existingAccess = await db.userBranchAccess.findUnique({
      where: { userId_branchId: { userId, branchId: ctx.branchId } },
      include: { role: true }
    });

    if (!existingAccess) throw new Error("User is not assigned to this branch.");

    const newRole = await db.role.findFirst({
      where: { id: newRoleId, organizationId: ctx.organizationId }
    });

    if (!newRole) throw new Error("New role not found");

    // Lockout check: if they are currently an admin, and the new role is not, check if they are the last
    if (existingAccess.role.permissions.includes('all') && !newRole.permissions.includes('all')) {
      const activeAdminsCount = await this.countEffectiveAdmins(ctx.organizationId, existingAccess.id);
      if (activeAdminsCount === 0) {
        throw new Error("Cannot remove admin privileges from this user as it would leave the organization without any administrators.");
      }
    }

    const result = await db.userBranchAccess.update({
      where: { id: existingAccess.id },
      data: { roleId: newRoleId }
    });

    await AuditService.log(ctx, "UPDATE_USER_ROLE", "UserBranchAccess", existingAccess.id, JSON.stringify({ roleId: newRoleId }));
    return result;
  }

  /**
   * Removes a user's access to the branch.
   */
  static async removeUserFromBranch(ctx: TenantContext, userId: string) {
    if (!ctx.organizationId || !ctx.branchId) throw new UnauthorizedError();
    if (!ctx.permissions.includes('all')) throw new UnauthorizedError("Only admins can remove users.");

    const existingAccess = await db.userBranchAccess.findUnique({
      where: { userId_branchId: { userId, branchId: ctx.branchId } },
      include: { role: true }
    });

    if (!existingAccess) throw new Error("User is not assigned to this branch.");

    if (existingAccess.role.permissions.includes('all')) {
      const activeAdminsCount = await this.countEffectiveAdmins(ctx.organizationId, existingAccess.id);
      if (activeAdminsCount === 0) {
        throw new Error("Cannot remove this user as it would leave the organization without any administrators.");
      }
    }

    await db.userBranchAccess.delete({
      where: { id: existingAccess.id }
    });

    await AuditService.log(ctx, "REMOVE_USER", "UserBranchAccess", existingAccess.id, JSON.stringify({ userId }));
    return { success: true };
  }

  private static async countEffectiveAdmins(organizationId: string, excludeAccessId?: string): Promise<number> {
    const adminRoles = await db.role.findMany({
      where: {
        organizationId,
        permissions: { has: 'all' }
      }
    });

    if (adminRoles.length === 0) return 0;

    const count = await db.userBranchAccess.count({
      where: {
        roleId: { in: adminRoles.map(r => r.id) },
        user: { status: 'ACTIVE' },
        ...(excludeAccessId ? { id: { not: excludeAccessId } } : {})
      }
    });

    return count;
  }
}
