import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";

export class ClassSubjectDAO {
  /**
   * Assigns a subject to a class for a specific academic year
   */
  static async assignSubject(ctx: TenantContext, data: {
    classId: string;
    subjectId: string;
    academicYearId: string;
    teacherId?: string;
  }) {
    if (!ctx.branchId) throw new UnauthorizedError();

    // Verify ownership of class, subject, and academic year
    const [cls, subject, academicYear] = await Promise.all([
      db.class.findUnique({ where: { id: data.classId } }),
      db.subject.findUnique({ where: { id: data.subjectId } }),
      db.academicYear.findUnique({ where: { id: data.academicYearId } })
    ]);

    if (!cls || cls.branchId !== ctx.branchId) throw new Error("Class not found");
    if (!subject || subject.branchId !== ctx.branchId) throw new Error("Subject not found");
    if (!academicYear || academicYear.branchId !== ctx.branchId) throw new Error("Academic Year not found");

    if (data.teacherId) {
      const teacher = await db.employee.findUnique({ 
        where: { id: data.teacherId },
        include: { employeeType: true }
      });
      if (!teacher || teacher.branchId !== ctx.branchId) throw new Error("Teacher not found");
      if (!teacher.employeeType.isTeachingStaff) throw new Error("Employee is not teaching staff");
      if (teacher.status !== 'ACTIVE') throw new Error("Teacher is not active");
    }

    // Check duplicate
    const existing = await db.classSubject.findUnique({
      where: {
        classId_subjectId_academicYearId: {
          classId: data.classId,
          subjectId: data.subjectId,
          academicYearId: data.academicYearId
        }
      }
    });

    if (existing) throw new Error("Subject is already assigned to this class for the given academic year");

    return db.classSubject.create({
      data: {
        classId: data.classId,
        subjectId: data.subjectId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId
      },
      include: {
        subject: true
      }
    });
  }

  static async listClassSubjects(ctx: TenantContext, classId: string, academicYearId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();
    
    // Verify class ownership
    const cls = await db.class.findUnique({ where: { id: classId } });
    if (!cls || cls.branchId !== ctx.branchId) throw new Error("Class not found");

    return db.classSubject.findMany({
      where: {
        classId,
        academicYearId
      },
      include: {
        subject: true,
        teacher: { include: { user: true } }
      },
      orderBy: {
        subject: { name: 'asc' }
      }
    });
  }

  static async removeSubjectAssignment(ctx: TenantContext, classSubjectId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();

    const classSubject = await db.classSubject.findUnique({
      where: { id: classSubjectId },
      include: { classRef: true }
    });

    if (!classSubject || classSubject.classRef.branchId !== ctx.branchId) {
      throw new Error("ClassSubject not found or access denied");
    }

    // Determine if assessments exist? For now, DB cascade handles it or we could prevent it if marks exist.
    // Let's rely on Prisma to throw if there's a restriction, but since we used Cascade in schema, it will delete.
    return db.classSubject.delete({
      where: { id: classSubjectId }
    });
  }
}
