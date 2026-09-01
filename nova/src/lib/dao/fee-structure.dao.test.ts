import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { FeeStructureDAO } from './fee-structure.dao';
import { FeeTypeDAO } from './fee-type.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';

describe('FeeStructureDAO', () => {
  let orgId: string;
  let branchId1: string;
  let branchId2: string;
  let class1Id: string;
  let class2Id: string;
  let ay1Id: string;
  let ay2Id: string;
  let term1Id: string;
  let term2Id: string;
  let feeTypeTuitionId: string;
  let feeTypeBoardingId: string;
  let feeTypeBranch2Id: string;

  let ctxBranch1: TenantContext;
  let ctxBranch2: TenantContext;
  let ctxNoPerms: TenantContext;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `FeeStructTestOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });
    orgId = org.id;

    const school = await db.school.create({
      data: { name: 'Test School', organizationId: org.id }
    });

    const b1 = await db.branch.create({
      data: { name: 'Branch 1', schoolId: school.id }
    });
    branchId1 = b1.id;

    const b2 = await db.branch.create({
      data: { name: 'Branch 2', schoolId: school.id }
    });
    branchId2 = b2.id;

    const user = await db.user.create({
      data: {
        organizationId: org.id,
        email: `feestruct_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        firstName: 'Finance',
        lastName: 'Manager',
        passwordHash: 'hash',
        userType: 'STAFF'
      }
    });

    ctxBranch1 = {
      userId: user.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId1,
      role: 'Bursar',
      permissions: ['fees:read', 'fees:structure:write']
    };

    ctxBranch2 = {
      userId: user.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId2,
      role: 'Bursar',
      permissions: ['fees:read', 'fees:structure:write']
    };

    ctxNoPerms = {
      userId: user.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId1,
      role: 'Guest',
      permissions: []
    };

    // Branch 1 Academics & Classes
    const c1 = await db.class.create({
      data: { name: 'Senior 1', branchId: branchId1 }
    });
    class1Id = c1.id;

    const ay1 = await db.academicYear.create({
      data: { name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), branchId: branchId1 }
    });
    ay1Id = ay1.id;

    const t1 = await db.term.create({
      data: { name: 'Term 1', startDate: new Date('2026-01-10'), endDate: new Date('2026-04-30'), academicYearId: ay1.id }
    });
    term1Id = t1.id;

    // Branch 2 Academics & Classes
    const c2 = await db.class.create({
      data: { name: 'Grade 10 Arts', branchId: branchId2 }
    });
    class2Id = c2.id;

    const ay2 = await db.academicYear.create({
      data: { name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), branchId: branchId2 }
    });
    ay2Id = ay2.id;

    const t2 = await db.term.create({
      data: { name: 'Term 1', startDate: new Date('2026-01-10'), endDate: new Date('2026-04-30'), academicYearId: ay2.id }
    });
    term2Id = t2.id;

    // Fee Types
    const ft1 = await FeeTypeDAO.create(ctxBranch1, { name: 'Tuition', code: 'TUITION' });
    feeTypeTuitionId = ft1.id;

    const ft2 = await FeeTypeDAO.create(ctxBranch1, { name: 'Boarding', code: 'BOARDING' });
    feeTypeBoardingId = ft2.id;

    const ftB2 = await FeeTypeDAO.create(ctxBranch2, { name: 'Tuition B2', code: 'TUITION_B2' });
    feeTypeBranch2Id = ftB2.id;
  });

  afterEach(async () => {
    if (orgId) {
      await db.feeStructureItem.deleteMany({
        where: { feeStructure: { branch: { school: { organizationId: orgId } } } }
      }).catch(() => {});
      await db.feeStructure.deleteMany({
        where: { branch: { school: { organizationId: orgId } } }
      }).catch(() => {});
      await db.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('creates and lists fee structures with items', async () => {
    const fs = await FeeStructureDAO.create(ctxBranch1, {
      name: 'S.1 Standard Fees',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      description: 'Term 1 standard fees for S.1',
      items: [
        { feeTypeId: feeTypeTuitionId, amount: 800000, isOptional: false },
        { feeTypeId: feeTypeBoardingId, amount: 400000, isOptional: true }
      ]
    });

    expect(fs.id).toBeDefined();
    expect(fs.name).toBe('S.1 Standard Fees');
    expect(fs.items.length).toBe(2);
    expect(fs.items[0].feeType.code).toBe('TUITION');

    const list = await FeeStructureDAO.list(ctxBranch1);
    expect(list.length).toBe(1);
    expect(list[0].items.length).toBe(2);

    // Branch isolation: Branch 2 should see 0
    const listB2 = await FeeStructureDAO.list(ctxBranch2);
    expect(listB2.length).toBe(0);
  });

  it('rejects cross-branch references (Class from Branch 2)', async () => {
    await expect(FeeStructureDAO.create(ctxBranch1, {
      name: 'Invalid Cross-Branch Class',
      classId: class2Id, // from branch 2
      academicYearId: ay1Id,
      termId: term1Id,
      items: [{ feeTypeId: feeTypeTuitionId, amount: 500000 }]
    })).rejects.toThrow(/Class does not belong to the active branch/);
  });

  it('rejects cross-branch references (AcademicYear from Branch 2)', async () => {
    await expect(FeeStructureDAO.create(ctxBranch1, {
      name: 'Invalid Cross-Branch Year',
      classId: class1Id,
      academicYearId: ay2Id, // from branch 2
      termId: term2Id,
      items: [{ feeTypeId: feeTypeTuitionId, amount: 500000 }]
    })).rejects.toThrow(/Academic year does not belong to the active branch/);
  });

  it('rejects Term that does not belong to the selected AcademicYear', async () => {
    await expect(FeeStructureDAO.create(ctxBranch1, {
      name: 'Invalid Term Pairing',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term2Id, // term 2 belongs to ay2
      items: [{ feeTypeId: feeTypeTuitionId, amount: 500000 }]
    })).rejects.toThrow(/Term does not belong to the selected academic year/);
  });

  it('rejects FeeType belonging to another branch', async () => {
    await expect(FeeStructureDAO.create(ctxBranch1, {
      name: 'Invalid Fee Type Branch',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      items: [{ feeTypeId: feeTypeBranch2Id, amount: 500000 }] // from branch 2
    })).rejects.toThrow(/invalid or belong to a different branch/);
  });

  it('prevents duplicate structure definition for the same Class/Year/Term/Name', async () => {
    await FeeStructureDAO.create(ctxBranch1, {
      name: 'S.1 Standard Fees',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      items: [{ feeTypeId: feeTypeTuitionId, amount: 800000 }]
    });

    await expect(FeeStructureDAO.create(ctxBranch1, {
      name: 'S.1 Standard Fees',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      items: [{ feeTypeId: feeTypeTuitionId, amount: 850000 }]
    })).rejects.toThrow(/already exists/);
  });

  it('updates fee structure items and metadata atomically', async () => {
    const fs = await FeeStructureDAO.create(ctxBranch1, {
      name: 'Initial Structure',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      items: [{ feeTypeId: feeTypeTuitionId, amount: 700000 }]
    });

    const updated = await FeeStructureDAO.update(ctxBranch1, fs.id, {
      name: 'Updated Structure Name',
      items: [
        { feeTypeId: feeTypeTuitionId, amount: 750000 },
        { feeTypeId: feeTypeBoardingId, amount: 450000, isOptional: true }
      ]
    });

    expect(updated.name).toBe('Updated Structure Name');
    expect(updated.items.length).toBe(2);
  });

  it('prevents deleting a fee type that is referenced by a fee structure', async () => {
    await FeeStructureDAO.create(ctxBranch1, {
      name: 'Structure With Tuition',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      items: [{ feeTypeId: feeTypeTuitionId, amount: 700000 }]
    });

    await expect(FeeTypeDAO.delete(ctxBranch1, feeTypeTuitionId)).rejects.toThrow(
      /Cannot delete fee type because it is currently assigned/
    );
  });

  it('deletes fee structure cleanly with cascading items', async () => {
    const fs = await FeeStructureDAO.create(ctxBranch1, {
      name: 'To Delete',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      items: [{ feeTypeId: feeTypeTuitionId, amount: 100000 }]
    });

    const res = await FeeStructureDAO.delete(ctxBranch1, fs.id);
    expect(res.success).toBe(true);

    const check = await FeeStructureDAO.getById(ctxBranch1, fs.id);
    expect(check).toBeNull();
  });

  it('enforces authorization rules on structure operations', async () => {
    await expect(FeeStructureDAO.list(ctxNoPerms)).rejects.toThrow(/Missing permission/);

    await expect(FeeStructureDAO.create(ctxNoPerms, {
      name: 'Unauthorized Structure',
      classId: class1Id,
      academicYearId: ay1Id,
      items: [{ feeTypeId: feeTypeTuitionId, amount: 100000 }]
    })).rejects.toThrow(/Missing permission/);
  });

  it('logs audit records upon creation and modification', async () => {
    const fs = await FeeStructureDAO.create(ctxBranch1, {
      name: 'Audited Structure',
      classId: class1Id,
      academicYearId: ay1Id,
      termId: term1Id,
      items: [{ feeTypeId: feeTypeTuitionId, amount: 200000 }]
    });

    const logs = await db.auditLog.findMany({
      where: {
        resourceType: 'FeeStructure',
        resourceId: fs.id,
        action: 'CREATE_FEE_STRUCTURE'
      }
    });

    expect(logs.length).toBe(1);
    expect(logs[0].branchId).toBe(branchId1);
  });
});
