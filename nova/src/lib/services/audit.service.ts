import { db } from "../db";
import { TenantContext } from "../dao/tenant-context";

export class AuditService {
  /**
   * Logs an action to the audit trail.
   */
  static async log(
    ctx: TenantContext | null, // null allowed for system-level actions (e.g. login)
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: string
  ) {
    try {
      await db.auditLog.create({
        data: {
          organizationId: ctx?.organizationId || null,
          schoolId: ctx?.schoolId || null,
          branchId: ctx?.branchId || null,
          userId: ctx?.userId || null,
          action,
          resourceType,
          resourceId,
          details
        }
      });
    } catch (error) {
      // We don't want audit failures to block critical operations in most cases,
      // but in a real-world secure system, this might be a configurable fatal error.
      console.error("Failed to write audit log:", error);
    }
  }

  /**
   * Retrieves audit logs for the organization/branch.
   */
  static async getLogs(ctx: TenantContext, options?: { limit?: number; offset?: number; resourceType?: string; action?: string }) {
    if (!ctx.organizationId) {
      return [];
    }
    
    const where: import('@prisma/client').Prisma.AuditLogWhereInput = { 
      organizationId: ctx.organizationId,
      branchId: ctx.branchId
    };

    if (options?.resourceType) where.resourceType = options.resourceType;
    if (options?.action) where.action = options.action;

    return db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } }
      }
    });
  }
}
