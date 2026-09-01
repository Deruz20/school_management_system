 
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DepartmentDAO } from './department.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';

describe('DepartmentDAO', () => {
  let org: import('@prisma/client').Organization, school: import('@prisma/client').School, branch1: import('@prisma/client').Branch, branch2: import('@prisma/client').Branch;
  let ctx1: TenantContext, ctx2: TenantContext;
  let user1: import('@prisma/client').User, user2: import('@prisma/client').User;

  beforeAll(async () => {
    org = await db.organization.create({ data: { name: 'Dept Org' } });
    school = await db.school.create({ data: { name: 'Dept School', organizationId: org.id } });
    branch1 = await db.branch.create({ data: { name: 'Dept Branch 1', schoolId: school.id } });
    branch2 = await db.branch.create({ data: { name: 'Dept Branch 2', schoolId: school.id } });
    
    user1 = await db.user.create({
      data: {
        email: 'dept1@test.com',
        firstName: 'Dept',
        lastName: 'Admin1',
        passwordHash: 'hash',
        userType: 'STAFF',
        organizationId: org.id
      }
    });

    user2 = await db.user.create({
      data: {
        email: 'dept2@test.com',
        firstName: 'Dept',
        lastName: 'Admin2',
        passwordHash: 'hash',
        userType: 'STAFF',
        organizationId: org.id
      }
    });

    ctx1 = { userId: user1.id, organizationId: org.id, branchId: branch1.id, schoolId: school.id, role: 'ADMIN', permissions: ['all'] } as TenantContext;
    ctx2 = { userId: user2.id, organizationId: org.id, branchId: branch2.id, schoolId: school.id, role: 'ADMIN', permissions: ['all'] } as TenantContext;
  });

  afterAll(async () => {
    await db.user.delete({ where: { id: user1.id } });
    await db.user.delete({ where: { id: user2.id } });
    await db.branch.delete({ where: { id: branch1.id } });
    await db.branch.delete({ where: { id: branch2.id } });
    await db.school.delete({ where: { id: school.id } });
    await db.organization.delete({ where: { id: org.id } });
  });

  it('creates and isolates departments by branch', async () => {
    const d1 = await DepartmentDAO.create(ctx1, { name: 'Math' });
    const d2 = await DepartmentDAO.create(ctx2, { name: 'Science' });

    expect(d1.branchId).toBe(branch1.id);
    expect(d2.branchId).toBe(branch2.id);

    const b1Depts = await DepartmentDAO.list(ctx1);
    expect(b1Depts.length).toBe(1);
    expect(b1Depts[0].name).toBe('Math');

    const b2Depts = await DepartmentDAO.list(ctx2);
    expect(b2Depts.length).toBe(1);
    expect(b2Depts[0].name).toBe('Science');
  });

  it('rejects duplicate department names in same branch', async () => {
    await DepartmentDAO.create(ctx1, { name: 'History' });
    await expect(DepartmentDAO.create(ctx1, { name: 'History' })).rejects.toThrow();
  });

  it('allows duplicate department names across branches', async () => {
    const d2 = await DepartmentDAO.create(ctx2, { name: 'History' });
    expect(d2.name).toBe('History');
  });
});
