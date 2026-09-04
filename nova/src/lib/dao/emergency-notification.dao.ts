import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface LogEmergencyNotificationInput {
  studentId: string;
  guardianId: string;
  notificationReason: string;
  phoneDialed: string;
  guardianResponseNotes?: string;
  status?: string;
}

export class EmergencyNotificationDAO {
  private static checkPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) {
      throw new UnauthorizedError("Branch scope and authenticated user required.");
    }
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('clinic:write') ||
      perms.includes('discipline:write') ||
      perms.includes('boarding:write') ||
      perms.includes('welfare:admin')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission to log emergency notifications.");
  }

  static async logNotification(ctx: TenantContext, input: LogEmergencyNotificationInput) {
    this.checkPermission(ctx);

    const log = await db.emergencyNotificationLog.create({
      data: {
        branchId: ctx.branchId,
        studentId: input.studentId,
        guardianId: input.guardianId,
        notificationReason: input.notificationReason.trim(),
        phoneDialed: input.phoneDialed.trim(),
        guardianResponseNotes: input.guardianResponseNotes?.trim() || null,
        status: input.status || "COMPLETED",
        callerStaffId: ctx.userId,
      },
      include: {
        student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } },
        guardian: { select: { id: true, firstName: true, lastName: true, phonePrimary: true } },
        callerStaff: { select: { id: true, firstName: true, lastName: true } },
      }
    });

    await AuditService.log(
      ctx,
      'welfare.emergency_notification_logged',
      'EmergencyNotificationLog',
      log.id,
      JSON.stringify({
        studentId: log.studentId,
        guardianId: log.guardianId,
        phoneDialed: log.phoneDialed,
        reason: log.notificationReason,
      })
    );

    return log;
  }

  static async listStudentNotifications(ctx: TenantContext, studentId: string) {
    this.checkPermission(ctx);

    return db.emergencyNotificationLog.findMany({
      where: { branchId: ctx.branchId, studentId },
      orderBy: { timestamp: 'desc' },
      include: {
        guardian: { select: { id: true, firstName: true, lastName: true, phonePrimary: true } },
        callerStaff: { select: { id: true, firstName: true, lastName: true } },
      }
    });
  }
}
