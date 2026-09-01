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
    
    // Admins see all org logs; branch managers might only see branch logs.
    // Since Phase 1 focuses on branch context but roles are org-wide, we'll scope it
    // to the branch if they aren't org admins, or the whole org if they are.
    // For simplicity in Phase 1, we just return logs for the current branch, unless they have 'all', then maybe org.
    // Actually, let's keep it simple: return logs for the current branch.
    
    const where: import('@prisma/client').Prisma.AuditLogWhereInput = { 
      organizationId: ctx.organizationId,
      branchId: ctx.branchId // Scoping to branch level for now to maintain tenancy consistency
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
