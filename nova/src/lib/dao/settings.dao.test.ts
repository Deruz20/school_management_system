import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { SettingsDAO } from './settings.dao';

describe('SettingsDAO', () => {
  let org: import('@prisma/client').Organization;
  let school: import('@prisma/client').School;
  let branch: import('@prisma/client').Branch;

  beforeAll(async () => {
    org = await db.organization.create({ data: { name: 'Settings Test Org' } });
    school = await db.school.create({ data: { name: 'Settings Test School', organizationId: org.id } });
    branch = await db.branch.create({ data: { name: 'Settings Test Branch', schoolId: school.id } });
  });

  afterAll(async () => {
    await db.organization.delete({ where: { id: org.id } });
  });

  it('creates default settings if none exist', async () => {
    const context = await SettingsDAO.getActiveContext(branch.id);
    expect(context.settings).toBeDefined();
    expect(context.settings.branchId).toBe(branch.id);
    expect(context.academicYear).toBeNull();
    expect(context.term).toBeNull();
  });

  it('enforces term belongs to active academic year', async () => {
    const year1 = await db.academicYear.create({
      data: { name: 'Year 1', startDate: new Date(), endDate: new Date(), branchId: branch.id }
    });
    const year2 = await db.academicYear.create({
      data: { name: 'Year 2', startDate: new Date(), endDate: new Date(), branchId: branch.id }
    });
    const termInYear2 = await db.term.create({
      data: { name: 'Term Y2', startDate: new Date(), endDate: new Date(), academicYearId: year2.id }
    });

    // Force bad data directly into DB
    await db.branchSettings.update({
      where: { branchId: branch.id },
      data: {
        activeAcademicYearId: year1.id,
        activeTermId: termInYear2.id
      }
    });

    await expect(SettingsDAO.getActiveContext(branch.id)).rejects.toThrow(
      "Data integrity error: Active Term does not belong to the Active Academic Year."
    );
  });
});
