import { db } from "../db";
import {
  StudentLifecycleStatus,
  ExeatType,
  ExeatStatus,
} from "@prisma/client";
import { UnauthorizedError } from "./tenant-context";
import { PortalAccessDAO, ReportCardAccessStatus } from "./portal-access.dao";
import { WelfareSequenceDAO } from "./welfare-sequence.dao";
import { PortalActivityDAO } from "./portal-activity.dao";
import crypto from "crypto";

export interface StudentRequestExeatInput {
  exeatType: ExeatType;
  reason: string;
  intendedDeparture: Date | string;
  expectedReturn: Date | string;
  accompanyingAdult?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class StudentPortalDAO {
  /**
   * Validates student existence and active status.
   * Suspended or expelled students are rejected with explanatory errors.
   */
  static async validateStudentAccess(studentId: string) {
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        branch: { select: { id: true, name: true } },
        classRef: true,
        streamRef: { select: { id: true, name: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          include: { classRef: true },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    if (!student) {
      throw new UnauthorizedError("Student record not found.");
    }

    // Gate 1: Active Student status and non-suspended lifecycle
    if (
      student.lifecycleStatus === StudentLifecycleStatus.SUSPENDED ||
      student.lifecycleStatus === StudentLifecycleStatus.EXPELLED
    ) {
      throw new UnauthorizedError(`Portal access denied: Student lifecycle status is ${student.lifecycleStatus}.`);
    }

    if (student.status !== "ACTIVE") {
      throw new UnauthorizedError(`Portal access denied: Student status is ${student.status}.`);
    }

    // Gate 2: Active Enrollment
    const activeEnrollment = student.enrollments[0];
    if (!activeEnrollment || activeEnrollment.status !== "ACTIVE") {
      throw new UnauthorizedError("Portal access denied: Student does not have an active academic enrollment.");
    }

    // Gate 3: Class portalAccessEnabled
    const targetClass = activeEnrollment.classRef || student.classRef;
    if (!targetClass || !targetClass.portalAccessEnabled) {
      throw new UnauthorizedError("Portal access denied: Portal access is not enabled for student's class.");
    }

    return student;
  }

  /**
   * Retrieves comprehensive dashboard payload for authenticated student.
   */
  static async getStudentDashboard(studentId: string) {
    const student = await this.validateStudentAccess(studentId);

    // 1. Bed allocation
    const bedAllocation = await db.bedAllocation.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: {
        bed: {
          include: {
            room: {
              include: {
                hostel: true
              }
            }
          }
        }
      }
    });

    // 2. Active subjects enrollment
    const activeEnrollment = await db.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: {
        academicYear: true,
        classRef: true,
        streamRef: true,
        enrollmentSubjects: {
          include: {
            subject: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Attendance metrics
    const attendanceRecords = await db.dailyAttendanceRecord.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 60
    });

    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    const absentDays = attendanceRecords.filter((a) => a.status === 'ABSENT').length;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

    // 4. Report card access status check
    const reportAccess = await PortalAccessDAO.checkReportCardAccess(student.branchId, studentId);

    // 5. Active Exeats
    const activeExeats = await db.exeatPass.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // 6. Active sanctions / demerit points
    const activeSanctions = await db.disciplinarySanction.findMany({
      where: { studentId, status: 'ACTIVE' },
      include: {
        hearing: {
          include: {
            incident: true
          }
        }
      }
    });

    return {
      profile: {
        id: student.id,
        admissionNo: student.admissionNo,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        gender: student.gender,
        branch: student.branch,
        className: student.classRef?.name || null,
        streamName: student.streamRef?.name || null,
        lifecycleStatus: student.lifecycleStatus
      },
      hostel: bedAllocation ? {
        hostelName: bedAllocation.bed.room.hostel.name,
        roomNumber: bedAllocation.bed.room.roomNumber,
        bedNumber: bedAllocation.bed.bedNumber,
        bedType: bedAllocation.bed.bedType
      } : null,
      enrollment: activeEnrollment ? {
        academicYear: activeEnrollment.academicYear.name,
        className: activeEnrollment.classRef.name,
        streamName: activeEnrollment.streamRef?.name || null,
        subjects: activeEnrollment.enrollmentSubjects.map((s) => ({
          id: s.subject.id,
          code: s.subject.code,
          name: s.subject.name
        }))
      } : null,
      attendance: {
        totalDays,
        presentDays,
        absentDays,
        attendancePercentage
      },
      reportAccess: {
        isBlocked: reportAccess.isBlocked,
        status: reportAccess.status,
        message: reportAccess.message || null
      },
      activeExeats: activeExeats.map((e) => ({
        id: e.id,
        exeatNumber: e.exeatNumber,
        exeatType: e.exeatType,
        reason: e.reason,
        intendedDeparture: e.intendedDeparture,
        expectedReturn: e.expectedReturn,
        guardianConsent: e.guardianConsent,
        status: e.status,
        isOverdue: e.isOverdue,
        qrVerificationToken: e.qrVerificationToken
      })),
      activeSanctions: activeSanctions.map((s) => ({
        id: s.id,
        sanctionType: s.sanctionType,
        startDate: s.startDate,
        endDate: s.endDate,
        incidentTitle: s.hearing.incident.title
      }))
    };
  }

  /**
   * Retrieves academic results for the student, enforcing debtor block.
   */
  static async getAcademicReports(studentId: string, termId?: string) {
    const student = await this.validateStudentAccess(studentId);

    const reportAccess = await PortalAccessDAO.checkReportCardAccess(student.branchId, studentId);
    if (reportAccess.isBlocked) {
      return {
        accessStatus: ReportCardAccessStatus.DEBTOR_BLOCKED,
        isBlocked: true,
        message: reportAccess.message,
        results: null
      };
    }

    const enrollments = await db.enrollment.findMany({
      where: {
        studentId,
        status: 'ACTIVE'
      },
      include: {
        academicYear: true,
        classRef: true,
        termResults: {
          where: {
            status: 'FINALIZED',
            ...(termId ? { termId } : {})
          },
          include: {
            term: true,
            subjects: {
              include: {
                subject: true
              }
            }
          },
          orderBy: { finalizedAt: 'desc' }
        }
      }
    });

    const reportCards = enrollments.flatMap((enrollment) =>
      enrollment.termResults.map((tr) => ({
        termResultId: tr.id,
        termName: tr.term.name,
        academicYear: enrollment.academicYear.name,
        className: enrollment.classRef.name,
        totalScore: tr.totalScore,
        aggregatePoints: tr.aggregatePoints,
        division: tr.division,
        subjects: tr.subjects.map((sub) => ({
          subjectCode: sub.subject.code,
          subjectName: sub.subject.name,
          score: sub.score,
          grade: sub.grade,
          points: sub.points,
          remarks: sub.remarks
        }))
      }))
    );

    return {
      accessStatus: reportAccess.status,
      isBlocked: false,
      message: null,
      results: reportCards
    };
  }

  /**
   * Allows student to initiate an exeat pass request with guardianConsent = false.
   * Guardian will then receive prompt and grant consent via Parent Portal.
   */
  static async requestExeat(studentId: string, input: StudentRequestExeatInput) {
    const student = await this.validateStudentAccess(studentId);

    const activeEnrollment = await db.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
      select: { academicYearId: true }
    });

    if (!activeEnrollment) {
      throw new Error("Student has no active enrollment for the current academic period.");
    }

    // Identify primary guardian if configured
    const primaryGuardianLink = await db.studentGuardian.findFirst({
      where: { studentId, isPrimaryContact: true },
      select: { guardianId: true }
    });

    return db.$transaction(async (tx) => {
      const exeatNumber = await WelfareSequenceDAO.getNextSequence(student.branchId, 'EXT', undefined, tx);
      const qrVerificationToken = crypto.randomBytes(24).toString('hex');

      const exeat = await tx.exeatPass.create({
        data: {
          branchId: student.branchId,
          studentId,
          academicYearId: activeEnrollment.academicYearId,
          exeatNumber,
          exeatType: input.exeatType,
          reason: input.reason,
          intendedDeparture: new Date(input.intendedDeparture),
          expectedReturn: new Date(input.expectedReturn),
          guardianConsent: false, // Must be approved by guardian via portal or admin
          guardianId: primaryGuardianLink?.guardianId || null,
          guardianConsentMethod: "PENDING_PORTAL_CONSENT",
          accompanyingAdult: input.accompanyingAdult || null,
          status: ExeatStatus.PENDING,
          qrVerificationToken
        }
      });

      // Log activity
      const studentUser = await tx.user.findFirst({
        where: { studentId }
      });

      if (studentUser) {
        await PortalActivityDAO.logActivity({
          branchId: student.branchId,
          userId: studentUser.id,
          action: 'exeat.requested',
          details: { exeatId: exeat.id, exeatNumber },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent
        });
      }

      return exeat;
    });
  }

  /**
   * Retrieves full exeat history with QR verification tokens for gate checking.
   */
  static async getExeatHistory(studentId: string) {
    await this.validateStudentAccess(studentId);

    return db.exeatPass.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
