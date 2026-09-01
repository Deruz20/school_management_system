import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";

export class AssessmentDAO {
  static async createAssessment(ctx: TenantContext, data: {
    classSubjectId: string;
    termId: string;
    name: string;
    maxScore: number;
    weight: number;
  }) {
    if (!ctx.branchId) throw new UnauthorizedError();
    if (data.maxScore <= 0) throw new Error("Maximum score must be greater than 0");
    if (data.weight < 0) throw new Error("Weight cannot be negative");

    // Verify ownership and consistent context
    const classSubject = await db.classSubject.findUnique({
      where: { id: data.classSubjectId },
      include: { classRef: true }
    });

    const term = await db.term.findUnique({
      where: { id: data.termId },
      include: { academicYear: true }
    });

    if (!classSubject || classSubject.classRef.branchId !== ctx.branchId) {
      throw new Error("ClassSubject not found or access denied");
    }

    if (!term || term.academicYear.branchId !== ctx.branchId) {
      throw new Error("Term not found or access denied");
    }

    // Ensure the term belongs to the same academic year as the ClassSubject
    if (term.academicYearId !== classSubject.academicYearId) {
      throw new Error("Term does not belong to the Academic Year of this Class Subject");
    }

    // Duplicate check
    const existing = await db.assessment.findUnique({
      where: {
        classSubjectId_termId_name: {
          classSubjectId: data.classSubjectId,
          termId: data.termId,
          name: data.name
        }
      }
    });

    if (existing) {
      throw new Error(`Assessment '${data.name}' already exists for this term and class subject`);
    }

    return db.assessment.create({ data });
  }

  static async getAssessment(ctx: TenantContext, id: string) {
    if (!ctx.branchId) throw new UnauthorizedError();

    const assessment = await db.assessment.findUnique({
      where: { id },
      include: {
        classSubject: {
          include: {
            classRef: true,
            subject: true
          }
        },
        term: true
      }
    });

    if (!assessment || assessment.classSubject.classRef.branchId !== ctx.branchId) {
      throw new Error("Assessment not found");
    }

    return assessment;
  }

  static async listAssessments(ctx: TenantContext, classSubjectId: string, termId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();

    const classSubject = await db.classSubject.findUnique({
      where: { id: classSubjectId },
      include: { classRef: true }
    });

    if (!classSubject || classSubject.classRef.branchId !== ctx.branchId) {
      throw new Error("ClassSubject not found");
    }

    return db.assessment.findMany({
      where: {
        classSubjectId,
        termId
      },
      orderBy: { name: 'asc' }
    });
  }

  static async updateAssessment(ctx: TenantContext, id: string, data: { name?: string; maxScore?: number; weight?: number; }) {
    if (!ctx.branchId) throw new UnauthorizedError();

    const assessment = await this.getAssessment(ctx, id);

    if (data.maxScore !== undefined && data.maxScore <= 0) throw new Error("Maximum score must be greater than 0");
    if (data.weight !== undefined && data.weight < 0) throw new Error("Weight cannot be negative");

    if (data.name) {
      const existing = await db.assessment.findUnique({
        where: {
          classSubjectId_termId_name: {
            classSubjectId: assessment.classSubjectId,
            termId: assessment.termId,
            name: data.name
          }
        }
      });
      if (existing && existing.id !== id) {
        throw new Error(`Assessment '${data.name}' already exists for this term and class subject`);
      }
    }

    return db.assessment.update({
      where: { id },
      data
    });
  }
}
