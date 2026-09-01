import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { FeeTypeDAO } from './fee-type.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';

describe('FeeTypeDAO', () => {
  let orgId: string;
  let branchId1: string;
  let branchId2: string;
  let ctxBranch1: TenantContext;
  let ctxBranch2: TenantContext;
  let ctxNoPerms: TenantContext;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `FeeTypeTestOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
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
        email: `feetype_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
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
  });

  afterEach(async () => {
    if (orgId) {
      await db.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('creates and lists fee types within branch', async () => {
    const ft1 = await FeeTypeDAO.create(ctxBranch1, {
      name: 'Tuition Fee',
      code: 'TUITION',
      description: 'Standard academic tuition'
    });

    expect(ft1.id).toBeDefined();
    expect(ft1.name).toBe('Tuition Fee');
    expect(ft1.code).toBe('TUITION');
    expect(ft1.branchId).toBe(branchId1);

    const list1 = await FeeTypeDAO.list(ctxBranch1);
    expect(list1.length).toBe(1);
    expect(list1[0].name).toBe('Tuition Fee');

    // Branch isolation: Branch 2 should see 0 fee types
    const list2 = await FeeTypeDAO.list(ctxBranch2);
    expect(list2.length).toBe(0);
  });

  it('enforces uniqueness of name and code within branch but allows across branches', async () => {
    await FeeTypeDAO.create(ctxBranch1, {
      name: 'Boarding Fee',
      code: 'BOARDING'
    });

    // Duplicate name in same branch
    await expect(FeeTypeDAO.create(ctxBranch1, {
      name: 'Boarding Fee',
      code: 'BOARDING_2'
    })).rejects.toThrow(/already exists/);

    // Duplicate code in same branch
    await expect(FeeTypeDAO.create(ctxBranch1, {
      name: 'Hostel Fee',
      code: 'BOARDING'
    })).rejects.toThrow(/already exists/);

    // Same name & code in Branch 2 should succeed
    const ftB2 = await FeeTypeDAO.create(ctxBranch2, {
      name: 'Boarding Fee',
      code: 'BOARDING'
    });
    expect(ftB2.branchId).toBe(branchId2);
  });

  it('updates fee type properties with validation', async () => {
    const ft = await FeeTypeDAO.create(ctxBranch1, {
      name: 'Uniform',
      code: 'UNIFORM'
    });

    const updated = await FeeTypeDAO.update(ctxBranch1, ft.id, {
      name: 'School Uniform Set',
      description: 'Includes 2 shirts and trousers'
    });

    expect(updated.name).toBe('School Uniform Set');
    expect(updated.description).toBe('Includes 2 shirts and trousers');
  });

  it('deletes fee type only when not in use', async () => {
    const ft = await FeeTypeDAO.create(ctxBranch1, {
      name: 'Library Fee',
      code: 'LIBRARY'
    });

    const res = await FeeTypeDAO.delete(ctxBranch1, ft.id);
    expect(res.success).toBe(true);

    const check = await FeeTypeDAO.getById(ctxBranch1, ft.id);
    expect(check).toBeNull();
  });

  it('enforces authorization rules', async () => {
    await expect(FeeTypeDAO.list(ctxNoPerms)).rejects.toThrow(/Missing permission/);

    await expect(FeeTypeDAO.create(ctxNoPerms, {
      name: 'PTA Levy',
      code: 'PTA'
    })).rejects.toThrow(/Missing permission/);
  });

  it('emits structured audit logs on mutations', async () => {
    const ft = await FeeTypeDAO.create(ctxBranch1, {
      name: 'Sports Fee',
      code: 'SPORTS'
    });

    const logs = await db.auditLog.findMany({
      where: {
        resourceType: 'FeeType',
        resourceId: ft.id,
        action: 'CREATE_FEE_TYPE'
      }
    });

    expect(logs.length).toBe(1);
    expect(logs[0].branchId).toBe(branchId1);
  });
});
