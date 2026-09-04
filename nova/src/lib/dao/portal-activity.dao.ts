import { db } from "../db";

export interface LogPortalActivityInput {
  branchId: string;
  userId: string;
  action: string;
  details?: string | Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class PortalActivityDAO {
  /**
   * Logs a portal action performed by a student or guardian user.
   */
  static async logActivity(input: LogPortalActivityInput) {
    const detailsStr = typeof input.details === 'object'
      ? JSON.stringify(input.details)
      : input.details || null;

    return db.portalActivityLog.create({
      data: {
        branchId: input.branchId,
        userId: input.userId,
        action: input.action,
        details: detailsStr,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null
      }
    });
  }

  /**
   * Retrieves recent portal activity logs for auditing and security monitoring.
   */
  static async getLogs(
    branchId: string,
    filter?: {
      userId?: string;
      action?: string;
      limit?: number;
    }
  ) {
    return db.portalActivityLog.findMany({
      where: {
        branchId,
        ...(filter?.userId ? { userId: filter.userId } : {}),
        ...(filter?.action ? { action: filter.action } : {})
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userType: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: filter?.limit || 50
    });
  }

  /**
   * Retrieves user activity feed for a specific user.
   */
  static async getUserActivity(userId: string, limit = 50) {
    return db.portalActivityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }
}
