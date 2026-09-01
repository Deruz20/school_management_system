import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AssessmentDAO } from "./assessment.dao";
import { MarkStatus } from "@prisma/client";

export class MarkDAO {
  /**
   * Enter or update a mark for a student on a specific assessment
   */
  static async upsertMark(ctx: TenantContext, data: {
    studentId: string;
    assessmentId: string;
    score?: number | null;
    status: MarkStatus;
  }) {
    if (!ctx.branchId) throw new UnauthorizedError();

    // 1. Get assessment and verify branch context
    const assessment = await AssessmentDAO.getAssessment(ctx, data.assessmentId);

    // 2. Validate score ranges if status is SCORED
    if (data.status === MarkStatus.SCORED) {
      if (data.score === undefined || data.score === null) {
        throw new Error("Score is required when status is SCORED");
      }
      if (data.score < 0 || data.score > assessment.maxScore) {
        throw new Error(`Score must be between 0 and ${assessment.maxScore}`);
      }
    } else {
      // If NOT_ENTERED, ABSENT, EXEMPT, MALPRACTICE, enforce score is null
      // We do not collapse 0 and ABSENT.
      data.score = null;
    }

    // 3. Verify student is actually enrolled in the class for the term's academic year
    const enrollment = await db.enrollment.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: data.studentId,
          academicYearId: assessment.term.academicYearId
        }
      },
      include: {
        student: true,
        enrollmentSubjects: true
      }
    });

    if (!enrollment || enrollment.student.branchId !== ctx.branchId) {
      throw new Error("Student is not enrolled in the correct academic year");
    }

    // Ensure student is in the same class as the ClassSubject
    if (enrollment.classId !== assessment.classSubject.classId) {
      throw new Error("Student is not enrolled in the class tied to this assessment");
    }

    // Ensure student is actually taking the subject
    const takesSubject = enrollment.enrollmentSubjects.some(
      es => es.subjectId === assessment.classSubject.subjectId
    );

    if (!takesSubject) {
      throw new Error("Student is not enrolled in this subject");
    }

    // 4. Upsert the mark
    return db.mark.upsert({
      where: {
        studentId_assessmentId: {
          studentId: data.studentId,
          assessmentId: data.assessmentId
        }
      },
      update: {
        score: data.score,
        status: data.status
      },
      create: {
        studentId: data.studentId,
        assessmentId: data.assessmentId,
        score: data.score,
        status: data.status
      }
    });
  }

  /**
   * Retrieves all students in the class who are enrolled in the subject,
   * along with any existing marks for the specified assessment.
   */
  static async getEligibleMarksForAssessment(ctx: TenantContext, assessmentId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();

    const assessment = await AssessmentDAO.getAssessment(ctx, assessmentId);

    // Find all active enrollments for this class & academic year
    // Where the student is also enrolled in this subject via enrollmentSubjects
    const enrollments = await db.enrollment.findMany({
      where: {
        classId: assessment.classSubject.classId,
        academicYearId: assessment.term.academicYearId,
        status: 'ACTIVE',
        enrollmentSubjects: {
          some: {
            subjectId: assessment.classSubject.subjectId
          }
        }
      },
      include: {
        student: true,
      },
      orderBy: {
        student: { lastName: 'asc' }
      }
    });

    // Find existing marks
    const marks = await db.mark.findMany({
      where: {
        assessmentId
      }
    });

    const markMap = new Map(marks.map(m => [m.studentId, m]));

    // Combine them
    return enrollments.map(e => {
      const existingMark = markMap.get(e.studentId);
      return {
        student: e.student,
        mark: existingMark || null
      };
    });
  }
}
