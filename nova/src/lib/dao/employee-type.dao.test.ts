 
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EmployeeTypeDAO } from './employee-type.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';

describe('EmployeeTypeDAO', () => {
  let org: import('@prisma/client').Organization, school: import('@prisma/client').School, branch1: import('@prisma/client').Branch, branch2: import('@prisma/client').Branch;
  let ctx1: TenantContext, ctx2: TenantContext;
  let user1: import('@prisma/client').User, user2: import('@prisma/client').User;

  beforeAll(async () => {
    org = await db.organization.create({ data: { name: 'Type Org' } });
    school = await db.school.create({ data: { name: 'Type School', organizationId: org.id } });
    branch1 = await db.branch.create({ data: { name: 'Type Branch 1', schoolId: school.id } });
    branch2 = await db.branch.create({ data: { name: 'Type Branch 2', schoolId: school.id } });
    
    user1 = await db.user.create({
      data: {
        email: 'type1@test.com',
        firstName: 'Type1',
        lastName: 'Admin',
        passwordHash: 'hash',
        userType: 'STAFF',
        organizationId: org.id
      }
    });

    user2 = await db.user.create({
      data: {
        email: 'type2@test.com',
        firstName: 'Type2',
        lastName: 'Admin',
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

  it('creates and isolates employee types by branch', async () => {
    const t1 = await EmployeeTypeDAO.create(ctx1, { name: 'Janitor', isTeachingStaff: false });
    const t2 = await EmployeeTypeDAO.create(ctx2, { name: 'Principal', isTeachingStaff: true });

    expect(t1.branchId).toBe(branch1.id);
    expect(t2.branchId).toBe(branch2.id);

    const b1Types = await EmployeeTypeDAO.list(ctx1);
    expect(b1Types.find(t => t.name === 'Janitor')).toBeDefined();
    expect(b1Types.find(t => t.name === 'Principal')).toBeUndefined();
  });

  it('rejects duplicate employee type names in same branch', async () => {
    await EmployeeTypeDAO.create(ctx1, { name: 'Nurse', isTeachingStaff: false });
    await expect(EmployeeTypeDAO.create(ctx1, { name: 'Nurse', isTeachingStaff: false })).rejects.toThrow();
  });
});
