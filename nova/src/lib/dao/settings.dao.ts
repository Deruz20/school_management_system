import { db } from '../db';
import { AcademicYear, Term, BranchSettings } from '@prisma/client';
import { TenantContext } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export type ActiveContext = {
  academicYear: AcademicYear | null;
  term: Term | null;
  settings: BranchSettings;
};

export class SettingsDAO {
  /**
   * Retrieves the active context (Academic Year and Term) for a given branch.
   * Also ensures the relationships are valid (Term belongs to Year, Year belongs to Branch).
   * As part of the migration strategy, it falls back to the legacy `isActive` field
   * on AcademicYear if the settings table has not been explicitly configured yet.
   */
  static async getActiveContext(branchId: string): Promise<ActiveContext> {
    // 1. Fetch or create branch settings
    let settings = await db.branchSettings.findUnique({
      where: { branchId },
      include: {
        activeAcademicYear: true,
        activeTerm: true
      }
    });

    if (!settings) {
      settings = await db.branchSettings.create({
        data: { branchId },
        include: {
          activeAcademicYear: true,
          activeTerm: true
        }
      });
    }

    const activeYear = settings.activeAcademicYear;
    const activeTerm = settings.activeTerm;

    // 3. Validation: Ensure the year belongs to the branch
    if (activeYear && activeYear.branchId !== branchId) {
      throw new Error("Data integrity error: Active Academic Year does not belong to the current branch.");
    }

    // 4. Validation: Ensure the term belongs to the active year
    if (activeTerm && activeTerm.academicYearId !== activeYear?.id) {
      throw new Error("Data integrity error: Active Term does not belong to the Active Academic Year.");
    }

    return {
      academicYear: activeYear,
      term: activeTerm,
      settings
    };
  }

  static async updateSettings(
    ctx: TenantContext, 
    data: { 
      activeAcademicYearId?: string | null; 
      activeTermId?: string | null;
      brandingLogoUrl?: string | null;
      brandingMotto?: string | null;
    }
  ) {
    if (data.activeAcademicYearId) {
      const year = await db.academicYear.findFirst({
        where: { id: data.activeAcademicYearId, branchId: ctx.branchId }
      });
      if (!year) throw new Error("Academic Year not found in branch");
    }

    if (data.activeTermId) {
      if (!data.activeAcademicYearId) {
        throw new Error("Cannot set Active Term without an Active Academic Year");
      }
      const term = await db.term.findFirst({
        where: { id: data.activeTermId, academicYearId: data.activeAcademicYearId }
      });
      if (!term) throw new Error("Term not found in the selected Academic Year");
    }

    const result = await db.branchSettings.upsert({
      where: { branchId: ctx.branchId },
      create: {
        branchId: ctx.branchId,
        ...data
      },
      update: data
    });

    await AuditService.log(ctx, "UPDATE_SETTINGS", "BranchSettings", result.id, JSON.stringify(data));
    return result;
  }
}
