import { db } from "../db";
import {
  Prisma,
  DisciplineCategory,
  IncidentSeverity,
  IncidentStatus,
  HearingPlea,
  SanctionType,
  SanctionStatus,
  StudentLifecycleStatus,
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { WelfareSequenceDAO } from "./welfare-sequence.dao";
import { StudentLifecycleDAO } from "./student-lifecycle.dao";

export interface ReportIncidentInput {
  title: string;
  incidentDate?: Date | string;
  location?: string;
  category: DisciplineCategory;
  severity: IncidentSeverity;
  description: string;
  witnessNotes?: string;
  involvedStudents: Array<{
    studentId: string;
    role?: string;
    statement?: string;
  }>;
}

export interface RecordHearingInput {
  incidentId: string;
  hearingDate?: Date | string;
  location?: string;
  panelChairId: string;
  panelMembers?: string;
  studentPlea: HearingPlea;
  guardianPresent?: boolean;
  guardianId?: string;
  hearingMinutes: string;
  findings: string;
}

export interface PrescribeSanctionInput {
  hearingId: string;
  studentId: string;
  sanctionType: SanctionType;
  startDate?: Date | string;
  endDate?: Date | string;
  terms: string;
  demeritPoints?: number;
}

export class DisciplineDAO {
  private static checkPermission(ctx: TenantContext, requiredPermission: string) {
    if (!ctx.branchId || !ctx.userId) {
      throw new UnauthorizedError("Branch scope and authenticated user required.");
    }
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('discipline:admin') ||
      perms.includes(requiredPermission)
    ) {
      return true;
    }
    throw new UnauthorizedError(`Missing required permission: ${requiredPermission}`);
  }

  // ==========================================
  // INCIDENTS
  // ==========================================

  static async reportIncident(ctx: TenantContext, input: ReportIncidentInput) {
    this.checkPermission(ctx, 'discipline:write');

    if (!input.involvedStudents || input.involvedStudents.length === 0) {
      throw new Error("At least one student must be associated with the incident.");
    }

    return db.$transaction(async (tx) => {
      // 1. Verify students exist in branch
      for (const inv of input.involvedStudents) {
        const student = await tx.student.findFirst({
          where: { id: inv.studentId, branchId: ctx.branchId }
        });
        if (!student) throw new Error(`Student ${inv.studentId} not found in this branch.`);
      }

      // 2. Generate sequential incident number
      const incidentNumber = await WelfareSequenceDAO.getNextSequence(ctx.branchId, 'DISC', undefined, tx);

      // 3. Create Incident
      const incident = await tx.disciplinaryIncident.create({
        data: {
          branchId: ctx.branchId,
          incidentNumber,
          title: input.title.trim(),
          incidentDate: input.incidentDate ? new Date(input.incidentDate) : new Date(),
          location: input.location?.trim() || null,
          reportedById: ctx.userId,
          category: input.category,
          severity: input.severity,
          description: input.description.trim(),
          witnessNotes: input.witnessNotes || null,
          status: IncidentStatus.REPORTED,
        }
      });

      // 4. Create IncidentStudent associations
      for (const inv of input.involvedStudents) {
        await tx.incidentStudent.create({
          data: {
            branchId: ctx.branchId,
            incidentId: incident.id,
            studentId: inv.studentId,
            role: inv.role || "PRIMARY_OFFENDER",
            statement: inv.statement || null,
            plea: HearingPlea.NO_CONTEST,
          }
        });
      }

      await AuditService.log(
        ctx,
        'discipline.incident_reported',
        'DisciplinaryIncident',
        incident.id,
        JSON.stringify({
          incidentNumber: incident.incidentNumber,
          severity: incident.severity,
          studentCount: input.involvedStudents.length,
        })
      );

      return incident;
    });
  }

  static async getIncidentById(ctx: TenantContext, id: string) {
    this.checkPermission(ctx, 'discipline:read');

    const incident = await db.disciplinaryIncident.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        students: {
          include: {
            student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } }
          }
        },
        hearings: {
          include: {
            panelChair: { select: { id: true, firstName: true, lastName: true } },
            guardian: { select: { id: true, firstName: true, lastName: true, phonePrimary: true } },
            sanctions: {
              include: {
                student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } },
                approvedBy: { select: { id: true, firstName: true, lastName: true } },
              }
            }
          }
        }
      }
    });

    if (!incident) throw new Error("Disciplinary incident not found.");
    return incident;
  }

  static async listIncidents(
    ctx: TenantContext,
    filters?: {
      status?: IncidentStatus;
      severity?: IncidentSeverity;
      category?: DisciplineCategory;
      studentId?: string;
    }
  ) {
    this.checkPermission(ctx, 'discipline:read');

    const where: Prisma.DisciplinaryIncidentWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.severity ? { severity: filters.severity } : {}),
      ...(filters?.category ? { category: filters.category } : {}),
      ...(filters?.studentId ? {
        students: { some: { studentId: filters.studentId } }
      } : {}),
    };

    return db.disciplinaryIncident.findMany({
      where,
      orderBy: { incidentDate: 'desc' },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        students: {
          include: {
            student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } }
          }
        },
      }
    });
  }

  // ==========================================
  // HEARINGS
  // ==========================================

  static async recordHearing(ctx: TenantContext, input: RecordHearingInput) {
    this.checkPermission(ctx, 'discipline:write');

    return db.$transaction(async (tx) => {
      const incident = await tx.disciplinaryIncident.findFirst({
        where: { id: input.incidentId, branchId: ctx.branchId }
      });
      if (!incident) throw new Error("Disciplinary incident not found.");

      const hearing = await tx.disciplinaryHearing.create({
        data: {
          branchId: ctx.branchId,
          incidentId: input.incidentId,
          hearingDate: input.hearingDate ? new Date(input.hearingDate) : new Date(),
          location: input.location?.trim() || null,
          panelChairId: input.panelChairId,
          panelMembers: input.panelMembers || null,
          studentPlea: input.studentPlea,
          guardianPresent: input.guardianPresent ?? false,
          guardianId: input.guardianId || null,
          hearingMinutes: input.hearingMinutes.trim(),
          findings: input.findings.trim(),
          status: "COMPLETED",
        }
      });

      await tx.disciplinaryIncident.update({
        where: { id: input.incidentId },
        data: { status: IncidentStatus.RESOLVED }
      });

      await AuditService.log(
        ctx,
        'discipline.hearing_recorded',
        'DisciplinaryHearing',
        hearing.id,
        JSON.stringify({
          incidentId: hearing.incidentId,
          panelChairId: hearing.panelChairId,
          plea: hearing.studentPlea,
        })
      );

      return hearing;
    });
  }

  // ==========================================
  // SANCTIONS & STUDENT LIFECYCLE INTEGRATION
  // ==========================================

  /**
   * Prescribes a sanction resulting from a hearing with Maker-Checker verification.
   * If sanction is SUSPENSION or EXPULSION:
   * 1. Requires `discipline:approve` permission.
   * 2. Maker-Checker: Approver cannot be the same user who originally reported the incident.
   * 3. Transitions StudentLifecycleStatus through StudentLifecycleDAO authority in transaction.
   */
  static async prescribeSanction(ctx: TenantContext, input: PrescribeSanctionInput) {
    this.checkPermission(ctx, 'discipline:approve');

    return db.$transaction(async (tx) => {
      // 1. Fetch hearing and parent incident
      const hearing = await tx.disciplinaryHearing.findFirst({
        where: { id: input.hearingId, branchId: ctx.branchId },
        include: { incident: true }
      });
      if (!hearing) throw new Error("Disciplinary hearing not found.");

      // 2. Maker-Checker enforcement for major sanctions (SUSPENSION, EXPULSION)
      const isMajorSanction =
        input.sanctionType === SanctionType.SUSPENSION ||
        input.sanctionType === SanctionType.EXPULSION;

      if (isMajorSanction) {
        if (hearing.incident.reportedById === ctx.userId) {
          throw new Error("Maker-Checker Violation: Sanction approver cannot be the staff member who reported the incident.");
        }
      }

      // 3. Verify student exists in branch
      const student = await tx.student.findFirst({
        where: { id: input.studentId, branchId: ctx.branchId }
      });
      if (!student) throw new Error("Student not found in this branch.");

      // 4. Create Sanction
      const sanction = await tx.disciplinarySanction.create({
        data: {
          branchId: ctx.branchId,
          hearingId: input.hearingId,
          studentId: input.studentId,
          sanctionType: input.sanctionType,
          startDate: input.startDate ? new Date(input.startDate) : new Date(),
          endDate: input.endDate ? new Date(input.endDate) : null,
          terms: input.terms.trim(),
          demeritPoints: input.demeritPoints ?? 0,
          approvedById: ctx.userId,
          status: SanctionStatus.ACTIVE,
        }
      });

      // 5. Authoritative StudentLifecycleDAO invocation
      if (input.sanctionType === SanctionType.SUSPENSION) {
        await StudentLifecycleDAO.transitionStatus(
          ctx,
          {
            studentId: input.studentId,
            targetStatus: StudentLifecycleStatus.SUSPENDED,
            reason: `Disciplinary Suspension: ${input.terms}`,
            notes: `Hearing ID: ${hearing.id}; Incident: ${hearing.incident.incidentNumber}`,
            effectiveDate: input.startDate ? new Date(input.startDate) : new Date(),
          },
          tx
        );
      } else if (input.sanctionType === SanctionType.EXPULSION) {
        await StudentLifecycleDAO.transitionStatus(
          ctx,
          {
            studentId: input.studentId,
            targetStatus: StudentLifecycleStatus.EXPELLED,
            reason: `Disciplinary Expulsion: ${input.terms}`,
            notes: `Hearing ID: ${hearing.id}; Incident: ${hearing.incident.incidentNumber}`,
            effectiveDate: input.startDate ? new Date(input.startDate) : new Date(),
          },
          tx
        );
      }

      await AuditService.log(
        ctx,
        'discipline.sanction_approved',
        'DisciplinarySanction',
        sanction.id,
        JSON.stringify({
          studentId: sanction.studentId,
          sanctionType: sanction.sanctionType,
          demeritPoints: sanction.demeritPoints,
          approvedById: sanction.approvedById,
        })
      );

      return sanction;
    });
  }

  /**
   * Reinstates a student from suspension back to ACTIVE.
   */
  static async reinstateStudent(ctx: TenantContext, sanctionId: string, notes?: string) {
    this.checkPermission(ctx, 'discipline:approve');

    return db.$transaction(async (tx) => {
      const sanction = await tx.disciplinarySanction.findFirst({
        where: { id: sanctionId, branchId: ctx.branchId, status: SanctionStatus.ACTIVE },
        include: { student: true }
      });
      if (!sanction) throw new Error("Active disciplinary sanction not found.");

      const updatedSanction = await tx.disciplinarySanction.update({
        where: { id: sanctionId },
        data: {
          status: SanctionStatus.SERVED,
        }
      });

      // Re-instate student to ACTIVE status
      if (sanction.sanctionType === SanctionType.SUSPENSION) {
        await StudentLifecycleDAO.transitionStatus(
          ctx,
          {
            studentId: sanction.studentId,
            targetStatus: StudentLifecycleStatus.ACTIVE,
            reason: `Reinstatement from Suspension: ${notes || 'Sanction terms served'}`,
          },
          tx
        );
      }

      await AuditService.log(
        ctx,
        'discipline.student_reinstated',
        'DisciplinarySanction',
        updatedSanction.id,
        JSON.stringify({ studentId: sanction.studentId, sanctionId })
      );

      return updatedSanction;
    });
  }

  /**
   * Retrieves full disciplinary record and accumulated demerit points for a student.
   */
  static async getStudentDisciplineHistory(ctx: TenantContext, studentId: string) {
    this.checkPermission(ctx, 'discipline:read');

    const sanctions = await db.disciplinarySanction.findMany({
      where: { studentId, branchId: ctx.branchId },
      orderBy: { startDate: 'desc' },
      include: {
        hearing: {
          include: {
            incident: true,
            panelChair: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        approvedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    const totalDemerits = sanctions
      .filter(s => s.status === SanctionStatus.ACTIVE || s.status === SanctionStatus.SERVED)
      .reduce((sum, s) => sum + s.demeritPoints, 0);

    return {
      studentId,
      totalDemerits,
      sanctions,
    };
  }
}
