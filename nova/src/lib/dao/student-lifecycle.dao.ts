import { db } from "../db";
import { StudentLifecycleStatus, EnrollmentStatus, Prisma } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { ClearanceDAO } from "./clearance.dao";

export interface TransitionLifecycleInput {
  studentId: string;
  targetStatus: StudentLifecycleStatus;
  reason: string;
  notes?: string;
  clearanceId?: string;
  effectiveDate?: Date;
}

export class StudentLifecycleDAO {
  private static checkLifecyclePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError("Branch scope and authenticated user required.");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('students:lifecycle') ||
      perms.includes('students:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: students:lifecycle");
  }

  /**
   * Transitions a student across authoritative lifecycle states with invariant enforcement.
   */
  static async transitionStatus(
    ctx: TenantContext,
    input: TransitionLifecycleInput,
    txClient?: Prisma.TransactionClient
  ) {
    this.checkLifecyclePermission(ctx);
    const client = txClient || db;
    const effectiveDate = input.effectiveDate || new Date();

    // 1. Fetch student
    const student = await client.student.findFirst({
      where: { id: input.studentId, branchId: ctx.branchId },
      include: {
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!student) {
      throw new Error("Student not found in this branch.");
    }

    const currentStatus = student.lifecycleStatus;
    const targetStatus = input.targetStatus;

    if (currentStatus === targetStatus) {
      throw new Error(`Student is already in ${targetStatus} status.`);
    }

    // 2. Validate transition rules
    const isValidTransition = this.validateTransitionPath(currentStatus, targetStatus);
    if (!isValidTransition) {
      throw new Error(`Invalid lifecycle transition from ${currentStatus} to ${targetStatus}.`);
    }

    // 3. Special Invariant: TRANSFERRED_OUT requires Financial & Requirements Clearance
    if (targetStatus === StudentLifecycleStatus.TRANSFERRED_OUT) {
      let isCleared = false;

      if (input.clearanceId) {
        const clearance = await client.studentClearance.findFirst({
          where: {
            id: input.clearanceId,
            studentId: input.studentId,
            branchId: ctx.branchId,
            status: 'CLEARED'
          }
        });
        if (clearance) isCleared = true;
      }

      if (!isCleared) {
        // Evaluate real-time ledger balance to ensure zero debt
        const activeEnrollment = student.enrollments[0];
        if (activeEnrollment) {
          const evalResult = await ClearanceDAO.evaluateStudentClearance(ctx, {
            studentId: input.studentId,
            academicYearId: activeEnrollment.academicYearId,
            maxAllowedDebt: 0,
            requiredPaidPercent: 100
          });

          if (!evalResult.isFinanciallyCleared || !evalResult.areRequirementsFulfilled) {
            const reasons = evalResult.blockingReasons.join("; ");
            throw new Error(`Cannot transfer student out: Uncleared obligations exist (${reasons || 'Outstanding balance or unreturned items'}).`);
          }
        }
      }
    }

    // 4. Update Student master record
    const studentUpdateData: Prisma.StudentUpdateInput = {
      lifecycleStatus: targetStatus
    };

    if (targetStatus === StudentLifecycleStatus.TRANSFERRED_OUT) {
      studentUpdateData.withdrawnDate = effectiveDate;
    } else if (targetStatus === StudentLifecycleStatus.DEFERRED) {
      studentUpdateData.withdrawnDate = effectiveDate;
    } else if (targetStatus === StudentLifecycleStatus.GRADUATED) {
      studentUpdateData.graduatedDate = effectiveDate;
    }

    await client.student.update({
      where: { id: input.studentId },
      data: studentUpdateData
    });

    // 5. Update active Enrollment status according to lifecycle impact
    const activeEnrollment = student.enrollments[0];
    if (activeEnrollment) {
      if (targetStatus === StudentLifecycleStatus.TRANSFERRED_OUT) {
        await client.enrollment.update({
          where: { id: activeEnrollment.id },
          data: { status: EnrollmentStatus.TRANSFERRED, endedAt: effectiveDate }
        });
      } else if (targetStatus === StudentLifecycleStatus.DEFERRED || targetStatus === StudentLifecycleStatus.EXPELLED) {
        await client.enrollment.update({
          where: { id: activeEnrollment.id },
          data: { status: EnrollmentStatus.WITHDRAWN, endedAt: effectiveDate }
        });
      } else if (targetStatus === StudentLifecycleStatus.GRADUATED) {
        await client.enrollment.update({
          where: { id: activeEnrollment.id },
          data: { status: EnrollmentStatus.COMPLETED, endedAt: effectiveDate }
        });
      }
      // Note: If SUSPENDED, enrollment remains ACTIVE (registered, but suspended from campus)
    }

    // 6. Insert immutable StudentLifecycleLog
    const log = await client.studentLifecycleLog.create({
      data: {
        branchId: ctx.branchId,
        studentId: input.studentId,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        reason: input.reason.trim(),
        notes: input.notes?.trim() || null,
        effectiveDate,
        authorizedById: ctx.userId,
        clearanceId: input.clearanceId || null
      }
    });

    // 7. Emit audit event
    const auditAction = this.getAuditAction(currentStatus, targetStatus);
    await AuditService.log(
      ctx,
      auditAction,
      'Student',
      input.studentId,
      `Transitioned ${student.admissionNo} from ${currentStatus} to ${targetStatus}: ${input.reason}`
    );

    return log;
  }

  /**
   * Retrieves all immutable lifecycle transition logs for a student.
   */
  static async getLifecycleHistory(ctx: TenantContext, studentId: string) {
    if (!ctx.branchId) throw new UnauthorizedError("Branch scope required.");

    return db.studentLifecycleLog.findMany({
      where: { studentId, branchId: ctx.branchId },
      include: {
        authorizedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  private static validateTransitionPath(
    from: StudentLifecycleStatus,
    to: StudentLifecycleStatus
  ): boolean {
    if (to === StudentLifecycleStatus.DECEASED) return true;

    switch (from) {
      case StudentLifecycleStatus.PROSPECTIVE:
        return to === StudentLifecycleStatus.ACTIVE;

      case StudentLifecycleStatus.ACTIVE: {
        const allowed: StudentLifecycleStatus[] = [
          StudentLifecycleStatus.SUSPENDED,
          StudentLifecycleStatus.DEFERRED,
          StudentLifecycleStatus.TRANSFERRED_OUT,
          StudentLifecycleStatus.EXPELLED,
          StudentLifecycleStatus.GRADUATED
        ];
        return allowed.includes(to);
      }

      case StudentLifecycleStatus.SUSPENDED:
        return to === StudentLifecycleStatus.ACTIVE || to === StudentLifecycleStatus.EXPELLED;

      case StudentLifecycleStatus.DEFERRED:
        return to === StudentLifecycleStatus.ACTIVE;

      case StudentLifecycleStatus.TRANSFERRED_OUT:
        return to === StudentLifecycleStatus.ACTIVE; // Re-admission

      case StudentLifecycleStatus.EXPELLED:
        return false; // Permanent

      case StudentLifecycleStatus.GRADUATED:
        return false; // Terminal

      case StudentLifecycleStatus.DECEASED:
        return false; // Terminal

      default:
        return false;
    }
  }

  private static getAuditAction(from: StudentLifecycleStatus, to: StudentLifecycleStatus): string {
    if (to === StudentLifecycleStatus.SUSPENDED) return 'student.suspended';
    if (from === StudentLifecycleStatus.SUSPENDED && to === StudentLifecycleStatus.ACTIVE) return 'student.reinstated';
    if (to === StudentLifecycleStatus.DEFERRED) return 'student.deferred';
    if (from === StudentLifecycleStatus.DEFERRED && to === StudentLifecycleStatus.ACTIVE) return 'student.resumed';
    if (to === StudentLifecycleStatus.TRANSFERRED_OUT) return 'student.transferred_out';
    if (from === StudentLifecycleStatus.TRANSFERRED_OUT && to === StudentLifecycleStatus.ACTIVE) return 'student.readmitted';
    if (to === StudentLifecycleStatus.EXPELLED) return 'student.expelled';
    if (to === StudentLifecycleStatus.GRADUATED) return 'student.graduated';
    return 'student.status_changed';
  }
}
