import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";

export class SubjectDAO {
  /**
   * SUBJECTS
   */
  static async listSubjects(ctx: TenantContext, includeInactive = false) {
    if (!ctx.branchId) throw new UnauthorizedError();
    return db.subject.findMany({
      where: { 
        branchId: ctx.branchId,
        ...(includeInactive ? {} : { isActive: true })
      },
      orderBy: { name: 'asc' },
    });
  }

  static async getSubject(ctx: TenantContext, subjectId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();
    const subject = await db.subject.findUnique({ where: { id: subjectId } });
    if (!subject || subject.branchId !== ctx.branchId) {
      throw new Error("Subject not found or access denied");
    }
    return subject;
  }

  static async createSubject(ctx: TenantContext, data: { name: string; code: string; description?: string }) {
    if (!ctx.branchId) throw new UnauthorizedError();
    
    // Enforce uniqueness of code within branch (handled by application logic if not DB unique index)
    const existing = await db.subject.findFirst({
      where: { branchId: ctx.branchId, code: data.code }
    });
    if (existing) throw new Error(`Subject with code ${data.code} already exists`);

    return db.subject.create({
      data: {
        ...data,
        branchId: ctx.branchId,
        isActive: true,
      }
    });
  }

  static async updateSubject(ctx: TenantContext, subjectId: string, data: { name?: string; code?: string; description?: string; isActive?: boolean }) {
    if (!ctx.branchId) throw new UnauthorizedError();
    await this.getSubject(ctx, subjectId); // verify ownership
    
    if (data.code) {
      const existing = await db.subject.findFirst({
        where: { branchId: ctx.branchId, code: data.code, id: { not: subjectId } }
      });
      if (existing) throw new Error(`Subject with code ${data.code} already exists`);
    }

    return db.subject.update({
      where: { id: subjectId },
      data
    });
  }

  /**
   * SUBJECT COMBINATIONS
   */
  static async listCombinations(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError();
    return db.subjectCombination.findMany({
      where: { branchId: ctx.branchId },
      include: {
        combinationSubjects: {
          include: { subject: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  static async createCombination(ctx: TenantContext, name: string, subjectIds: { subjectId: string, isCore: boolean }[]) {
    if (!ctx.branchId) throw new UnauthorizedError();
    
    // Verify all subjects belong to branch
    const subjectsCount = await db.subject.count({
      where: { branchId: ctx.branchId, id: { in: subjectIds.map(s => s.subjectId) } }
    });
    if (subjectsCount !== subjectIds.length) {
      throw new Error("One or more subjects do not exist or belong to another branch");
    }

    return db.subjectCombination.create({
      data: {
        name,
        branchId: ctx.branchId,
        combinationSubjects: {
          create: subjectIds.map(s => ({
            subjectId: s.subjectId,
            isCore: s.isCore
          }))
        }
      },
      include: {
        combinationSubjects: true
      }
    });
  }

  static async deleteCombination(ctx: TenantContext, combinationId: string) {
    if (!ctx.branchId) throw new UnauthorizedError();
    const combo = await db.subjectCombination.findUnique({ where: { id: combinationId } });
    if (!combo || combo.branchId !== ctx.branchId) throw new Error("Combination not found");
    
    return db.subjectCombination.delete({ where: { id: combinationId } });
  }
}
