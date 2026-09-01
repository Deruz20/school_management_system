import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DiscountDAO } from './discount.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import { DiscountType, Student, FeeType, AcademicYear, Term } from '@prisma/client';

describe('DiscountDAO', () => {
  let orgId: string;
  let branchId1: string;
  let branchId2: string;
  let ctxBranch1: TenantContext;
  let ctxNoPerms: TenantContext;
  let student1: Student;
  let feeType1: FeeType;
  let ay1: AcademicYear;
  let term1: Term;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `DiscTestOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
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
        email: `disc_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        firstName: 'Finance',
        lastName: 'Admin',
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
      permissions: ['fees:read', 'fees:discount:write']
    };

    ctxNoPerms = {
      userId: user.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId1,
      role: 'Viewer',
      permissions: []
    };

    student1 = await db.student.create({
      data: {
        branchId: branchId1,
        admissionNo: `ADM_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        firstName: 'Grace',
        lastName: 'Nakato'
      }
    });

    feeType1 = await db.feeType.create({
      data: {
        branchId: branchId1,
        name: 'Tuition Fee',
        code: `TUI_${Date.now()}`
      }
    });

    ay1 = await db.academicYear.create({
      data: {
        branchId: branchId1,
        name: '2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31')
      }
    });

    term1 = await db.term.create({
      data: {
        academicYearId: ay1.id,
        name: 'Term 1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-04-30')
      }
    });
  });

  afterAll(async () => {
    if (orgId) {
      await db.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
  });

  it('creates percentage and fixed amount discounts with exact precision', async () => {
    const d1 = await DiscountDAO.create(ctxBranch1, {
      studentId: student1.id,
      feeTypeId: feeType1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      discountType: DiscountType.PERCENTAGE,
      value: 50,
      reason: 'Staff Child 50% Concession'
    });

    expect(d1.id).toBeDefined();
    expect(Number(d1.value)).toBe(50);
    expect(d1.reason).toBe('Staff Child 50% Concession');

    const d2 = await DiscountDAO.create(ctxBranch1, {
      studentId: student1.id,
      discountType: DiscountType.FIXED_AMOUNT,
      value: 250000.5,
      reason: 'Bursary Fund Support'
    });

    expect(d2.id).toBeDefined();
    expect(Number(d2.value)).toBe(250000.5);
  });

  it('rejects percentage discount greater than 100% or negative values', async () => {
    await expect(
      DiscountDAO.create(ctxBranch1, {
        studentId: student1.id,
        discountType: DiscountType.PERCENTAGE,
        value: 120,
        reason: 'Invalid 120%'
      })
    ).rejects.toThrow('Percentage discount cannot exceed 100%.');

    await expect(
      DiscountDAO.create(ctxBranch1, {
        studentId: student1.id,
        discountType: DiscountType.FIXED_AMOUNT,
        value: -500,
        reason: 'Negative'
      })
    ).rejects.toThrow('Discount value must be a positive number.');
  });

  it('rejects duplicate active discount rule for same student & target', async () => {
    await DiscountDAO.create(ctxBranch1, {
      studentId: student1.id,
      feeTypeId: feeType1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      discountType: DiscountType.PERCENTAGE,
      value: 25,
      reason: 'Merit 1'
    });

    await expect(
      DiscountDAO.create(ctxBranch1, {
        studentId: student1.id,
        feeTypeId: feeType1.id,
        academicYearId: ay1.id,
        termId: term1.id,
        discountType: DiscountType.PERCENTAGE,
        value: 50,
        reason: 'Merit 2'
      })
    ).rejects.toThrow('An active discount rule already exists for this student and target period.');
  });

  it('enforces branch isolation by rejecting cross-branch student or fee type', async () => {
    const studentInBranch2 = await db.student.create({
      data: {
        branchId: branchId2,
        admissionNo: `ADM_B2_${Date.now()}`,
        firstName: 'Bob',
        lastName: 'Kato'
      }
    });

    await expect(
      DiscountDAO.create(ctxBranch1, {
        studentId: studentInBranch2.id,
        discountType: DiscountType.PERCENTAGE,
        value: 20,
        reason: 'Cross branch'
      })
    ).rejects.toThrow('Invalid student: Student does not exist in this branch.');
  });

  it('updates, deletes, and audits discount mutations', async () => {
    const d = await DiscountDAO.create(ctxBranch1, {
      studentId: student1.id,
      discountType: DiscountType.PERCENTAGE,
      value: 30,
      reason: 'Initial bursary'
    });

    const updated = await DiscountDAO.update(ctxBranch1, d.id, {
      value: 40,
      reason: 'Updated bursary to 40%'
    });
    expect(Number(updated.value)).toBe(40);
    expect(updated.reason).toBe('Updated bursary to 40%');

    await DiscountDAO.delete(ctxBranch1, d.id);
    await expect(DiscountDAO.getById(ctxBranch1, d.id)).rejects.toThrow();

    const auditLogs = await db.auditLog.findMany({
      where: { resourceId: d.id }
    });
    expect(auditLogs.some(l => l.action === 'ASSIGN_BURSARY')).toBe(true);
    expect(auditLogs.some(l => l.action === 'UPDATE_BURSARY')).toBe(true);
    expect(auditLogs.some(l => l.action === 'DELETE_BURSARY')).toBe(true);
  });

  it('enforces RBAC permissions', async () => {
    await expect(
      DiscountDAO.list(ctxNoPerms)
    ).rejects.toThrow('Missing permission: fees:read');

    await expect(
      DiscountDAO.create(ctxNoPerms, {
        studentId: student1.id,
        discountType: DiscountType.PERCENTAGE,
        value: 10,
        reason: 'Test'
      })
    ).rejects.toThrow('Missing permission: fees:discount:write');
  });
});
