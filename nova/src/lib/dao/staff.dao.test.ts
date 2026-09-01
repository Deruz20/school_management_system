 
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StaffDAO } from './staff.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';

describe('StaffDAO', () => {
  let org: import('@prisma/client').Organization, school: import('@prisma/client').School, branch1: import('@prisma/client').Branch, branch2: import('@prisma/client').Branch;
  let ctx1: TenantContext, ctx2: TenantContext;
  let user1: import('@prisma/client').User, user2: import('@prisma/client').User;
  let et1: import('@prisma/client').EmployeeType, et2: import('@prisma/client').EmployeeType;

  beforeAll(async () => {
    org = await db.organization.create({ data: { name: 'Staff Org' } });
    school = await db.school.create({ data: { name: 'Staff School', organizationId: org.id } });
    branch1 = await db.branch.create({ data: { name: 'Staff Branch 1', schoolId: school.id } });
    branch2 = await db.branch.create({ data: { name: 'Staff Branch 2', schoolId: school.id } });
    
    user1 = await db.user.create({
      data: {
        email: 'staff1@test.com',
        firstName: 'Staff',
        lastName: 'Admin1',
        passwordHash: 'hash',
        userType: 'STAFF',
        organizationId: org.id,
        branchAccess: { create: { branchId: branch1.id, roleId: (await db.role.create({ data: { name: 'R1', organizationId: org.id } })).id } }
      }
    });

    user2 = await db.user.create({
      data: {
        email: 'staff2@test.com',
        firstName: 'Staff',
        lastName: 'Admin2',
        passwordHash: 'hash',
        userType: 'STAFF',
        organizationId: org.id
      }
    });

    ctx1 = { userId: user1.id, organizationId: org.id, branchId: branch1.id, schoolId: school.id, role: 'ADMIN', permissions: ['all'] } as TenantContext;
    ctx2 = { userId: user2.id, organizationId: org.id, branchId: branch2.id, schoolId: school.id, role: 'ADMIN', permissions: ['all'] } as TenantContext;

    et1 = await db.employeeType.create({ data: { name: 'Teacher', branchId: branch1.id, isTeachingStaff: true } });
    et2 = await db.employeeType.create({ data: { name: 'Admin', branchId: branch2.id, isTeachingStaff: false } });
  });

  afterAll(async () => {
    await db.employee.deleteMany({ where: { email: { in: ['e1@test.com', 'e2@test.com'] } } });
    await db.employeeType.deleteMany({ where: { id: { in: [et1.id, et2.id] } } });
    await db.userBranchAccess.deleteMany({ where: { userId: user1.id } });
    await db.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });
    await db.branch.deleteMany({ where: { id: { in: [branch1.id, branch2.id] } } });
    await db.school.delete({ where: { id: school.id } });
    await db.role.deleteMany({ where: { organizationId: org.id } });
    await db.organization.delete({ where: { id: org.id } });
  });

  it('creates and isolates employees', async () => {
    const e1 = await StaffDAO.create(ctx1, {
      employeeCode: 'E1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'e1@test.com',
      employeeTypeId: et1.id
    });

    expect(e1.branchId).toBe(branch1.id);
    expect(e1.status).toBe('ACTIVE');

    const b1Staff = await StaffDAO.list(ctx1);
    expect(b1Staff.find(s => s.employeeCode === 'E1')).toBeDefined();

    const b2Staff = await StaffDAO.list(ctx2);
    expect(b2Staff.find(s => s.employeeCode === 'E1')).toBeUndefined();
  });

  it('rejects creation with invalid employee type from another branch', async () => {
    await expect(StaffDAO.create(ctx1, {
      employeeCode: 'E2',
      firstName: 'Bob',
      lastName: 'Jones',
      employeeTypeId: et2.id
    })).rejects.toThrow("Invalid Employee Type");
  });

  it('links user correctly if access exists', async () => {
    const e1 = await StaffDAO.list(ctx1).then(l => l[0]);
    const updated = await StaffDAO.linkUser(ctx1, e1.id, user1.id);
    expect(updated.userId).toBe(user1.id);
  });

  it('rejects user link if user lacks branch access', async () => {
    const e1 = await StaffDAO.list(ctx1).then(l => l[0]);
    await expect(StaffDAO.linkUser(ctx1, e1.id, user2.id)).rejects.toThrow("User does not have access to this branch");
  });

  it('updates status and records termination date', async () => {
    const e1 = await StaffDAO.list(ctx1).then(l => l[0]);
    const updated = await StaffDAO.update(ctx1, e1.id, { status: 'TERMINATED' });
    expect(updated.status).toBe('TERMINATED');
    expect(updated.terminatedAt).toBeDefined();
  });
});
