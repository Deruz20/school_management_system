import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";

export class EnrollmentSubjectDAO {
  /**
   * Assigns individual subjects to a student's enrollment
   */
  static async assignSubjects(ctx: TenantContext, enrollmentId: string, subjectIds: string[], isElective = false) {
    if (!ctx.branchId) throw new UnauthorizedError();

    // Verify enrollment
    const enrollment = await db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true, classRef: true }
    });

    if (!enrollment || enrollment.student.branchId !== ctx.branchId) {
      throw new Error("Enrollment not found");
    }

    // Verify subjects belong to branch
    const subjects = await db.subject.count({
      where: { branchId: ctx.branchId, id: { in: subjectIds } }
    });
    if (subjects !== subjectIds.length) {
      throw new Error("One or more subjects do not exist or belong to another branch");
    }

    // Optionally check if the subject is taught in the class?
    // We can allow students to take subjects across classes (e.g. cross-class electives), but usually it's bounded by ClassSubject.
    // For now, let's keep it simple and just assign them.

    await db.$transaction(async (tx) => {
      for (const subjectId of subjectIds) {
        await tx.enrollmentSubject.upsert({
          where: {
            enrollmentId_subjectId: {
              enrollmentId,
              subjectId
            }
          },
          update: {
            isElective
          },
          create: {
            enrollmentId,
            subjectId,
            isElective
          }
        });
      }
    });

    return this.getEnrollmentSubjects(ctx, enrollmentId);
  }

  /**
   * Assigns all subjects from a SubjectCombination to an enrollment
   */
  static async assignCombination(ctx: TenantContext, enrollmentId: string, combinationId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();

    const combo = await db.subjectCombination.findUnique({
      where: { id: combinationId },
      include: { combinationSubjects: true }
    });

    if (!combo || combo.branchId !== ctx.branchId) {
      throw new Error("Subject Combination not found");
    }


    
    // We can assume combination subjects are core, but we could use the combo's isCore flag
    await db.$transaction(async (tx) => {
      for (const cs of combo.combinationSubjects) {
        await tx.enrollmentSubject.upsert({
          where: {
            enrollmentId_subjectId: {
              enrollmentId,
              subjectId: cs.subjectId
            }
          },
          update: {
            isElective: !cs.isCore
          },
          create: {
            enrollmentId,
            subjectId: cs.subjectId,
            isElective: !cs.isCore
          }
        });
      }
    });

    return this.getEnrollmentSubjects(ctx, enrollmentId);
  }

  static async removeSubject(ctx: TenantContext, enrollmentId: string, subjectId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();

    const enrollment = await db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true }
    });

    if (!enrollment || enrollment.student.branchId !== ctx.branchId) {
      throw new Error("Enrollment not found");
    }

    return db.enrollmentSubject.delete({
      where: {
        enrollmentId_subjectId: {
          enrollmentId,
          subjectId
        }
      }
    });
  }

  static async getEnrollmentSubjects(ctx: TenantContext, enrollmentId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();
    
    // Verify enrollment ownership
    const enrollment = await db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true }
    });

    if (!enrollment || enrollment.student.branchId !== ctx.branchId) {
      throw new Error("Enrollment not found");
    }

    return db.enrollmentSubject.findMany({
      where: { enrollmentId },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } }
    });
  }
}
