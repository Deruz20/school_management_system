import { db } from "../db";
import { Prisma, EnrollmentStatus, Enrollment } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface CreateEnrollmentInput {
  studentId: string;
  academicYearId: string;
  classId: string;
  streamId?: string | null;
}

export class EnrollmentDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError("Branch scope required.");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('students:read') ||
      perms.includes('admissions:read')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing read permission.");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError("Branch scope and authenticated user required.");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('students:write') ||
      perms.includes('admissions:enroll') ||
      perms.includes('admissions:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing write permission.");
  }

  /**
   * Creates an authoritative academic enrollment in the existing Enrollment table.
   */
  static async createEnrollment(
    ctx: TenantContext,
    data: CreateEnrollmentInput,
    txClient?: Prisma.TransactionClient
  ): Promise<Enrollment> {
    this.checkWritePermission(ctx);
    const client = txClient || db;

    // 1. Verify student belongs to branch
    const student = await client.student.findFirst({
      where: { id: data.studentId, branchId: ctx.branchId }
    });
    if (!student) {
      throw new Error("Student not found in this branch.");
    }

    // 2. Verify academic year belongs to branch
    const academicYear = await client.academicYear.findFirst({
      where: { id: data.academicYearId, branchId: ctx.branchId }
    });
    if (!academicYear) {
      throw new Error("Academic Year not found in this branch.");
    }

    // 3. Verify class belongs to branch
    const classRef = await client.class.findFirst({
      where: { id: data.classId, branchId: ctx.branchId },
      include: { streams: true }
    });
    if (!classRef) {
      throw new Error("Class not found in this branch.");
    }

    // 4. Verify stream if provided
    if (data.streamId) {
      const validStream = classRef.streams.some(s => s.id === data.streamId);
      if (!validStream) {
        throw new Error("Stream does not belong to the selected class.");
      }
    }

    // 5. Uniqueness invariant: exactly one enrollment per student per academic year
    const existing = await client.enrollment.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: data.studentId,
          academicYearId: data.academicYearId
        }
      }
    });
    if (existing) {
      throw new Error("Student is already enrolled for this academic year.");
    }

    // 6. Capacity check if specified
    if (classRef.capacity && classRef.capacity > 0) {
      const activeCount = await client.enrollment.count({
        where: {
          classId: data.classId,
          academicYearId: data.academicYearId,
          status: EnrollmentStatus.ACTIVE
        }
      });
      if (activeCount >= classRef.capacity) {
        throw new Error(`Class ${classRef.name} has reached its maximum capacity of ${classRef.capacity} students.`);
      }
    }

    // 7. Create enrollment record
    const enrollment = await client.enrollment.create({
      data: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        classId: data.classId,
        streamId: data.streamId || null,
        status: EnrollmentStatus.ACTIVE
      }
    });

    // 8. Update current class & stream on student master record
    await client.student.update({
      where: { id: data.studentId },
      data: {
        classId: data.classId,
        streamId: data.streamId || null
      }
    });

    await AuditService.log(
      ctx,
      'enrollment.created',
      'Enrollment',
      enrollment.id,
      `Enrolled student ${student.admissionNo} in ${classRef.name} for year ${academicYear.name}`
    );

    return enrollment;
  }

  /**
   * Retrieves an enrollment by ID.
   */
  static async getEnrollment(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const enrollment = await db.enrollment.findUnique({
      where: { id },
      include: {
        student: true,
        classRef: true,
        streamRef: true,
        academicYear: true,
        enrollmentSubjects: { include: { subject: true } },
        provisioning: true
      }
    });

    if (!enrollment || enrollment.student.branchId !== ctx.branchId) {
      throw new Error("Enrollment not found or access denied.");
    }

    return enrollment;
  }

  /**
   * Retrieves the active enrollment for a student.
   */
  static async getActiveEnrollment(ctx: TenantContext, studentId: string, academicYearId?: string) {
    this.checkReadPermission(ctx);

    return db.enrollment.findFirst({
      where: {
        studentId,
        student: { branchId: ctx.branchId },
        status: EnrollmentStatus.ACTIVE,
        ...(academicYearId ? { academicYearId } : {})
      },
      include: {
        classRef: true,
        streamRef: true,
        academicYear: true,
        provisioning: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Updates enrollment status and endedAt.
   */
  static async updateEnrollmentStatus(
    ctx: TenantContext,
    id: string,
    status: EnrollmentStatus,
    endedAt?: Date | null,
    txClient?: Prisma.TransactionClient
  ) {
    this.checkWritePermission(ctx);
    const client = txClient || db;

    const enrollment = await client.enrollment.findUnique({
      where: { id },
      include: { student: true }
    });
    if (!enrollment || enrollment.student.branchId !== ctx.branchId) {
      throw new Error("Enrollment not found or access denied.");
    }

    const updated = await client.enrollment.update({
      where: { id },
      data: {
        status,
        endedAt: endedAt !== undefined ? endedAt : (status !== EnrollmentStatus.ACTIVE ? new Date() : null)
      }
    });

    await AuditService.log(
      ctx,
      'enrollment.confirmed',
      'Enrollment',
      id,
      `Updated enrollment status to ${status} for student ${enrollment.student.admissionNo}`
    );

    return updated;
  }

  /**
   * Lists enrollments with filters.
   */
  static async listEnrollments(
    ctx: TenantContext,
    params?: {
      academicYearId?: string;
      classId?: string;
      streamId?: string;
      status?: EnrollmentStatus;
      skip?: number;
      take?: number;
    }
  ) {
    this.checkReadPermission(ctx);

    const where: Prisma.EnrollmentWhereInput = {
      student: { branchId: ctx.branchId },
      ...(params?.academicYearId ? { academicYearId: params.academicYearId } : {}),
      ...(params?.classId ? { classId: params.classId } : {}),
      ...(params?.streamId ? { streamId: params.streamId } : {}),
      ...(params?.status ? { status: params.status } : {})
    };

    const [total, items] = await Promise.all([
      db.enrollment.count({ where }),
      db.enrollment.findMany({
        where,
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              firstName: true,
              lastName: true,
              gender: true,
              lifecycleStatus: true
            }
          },
          classRef: { select: { id: true, name: true } },
          streamRef: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          provisioning: { select: { id: true, overallStatus: true } }
        }
      })
    ]);

    return { total, items };
  }
}
