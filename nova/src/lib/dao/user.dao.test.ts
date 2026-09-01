import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { UserDAO } from './user.dao';
import { db } from '../db';

describe('UserDAO', () => {
  let org: import('@prisma/client').Organization;
  let adminRole: import('@prisma/client').Role;
  let teacherRole: import('@prisma/client').Role;
  let user: import('@prisma/client').User;
  let school: import('@prisma/client').School;
  let branch: import('@prisma/client').Branch;

  beforeAll(async () => {
    org = await db.organization.create({ data: { name: 'UserDAO Test Org' } });
    school = await db.school.create({ data: { name: 'UserDAO Test School', organizationId: org.id } });
    branch = await db.branch.create({ data: { name: 'UserDAO Test Branch', schoolId: school.id } });
    
    adminRole = await db.role.create({
      data: { name: 'Admin Role', permissions: ['all'], organizationId: org.id }
    });

    teacherRole = await db.role.create({
      data: { name: 'Teacher Role', permissions: ['students:read'], organizationId: org.id }
    });

    user = await db.user.create({
      data: {
        email: 'admin.userdao@test.com',
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: 'hash',
        userType: 'STAFF',
        status: 'ACTIVE',
        organizationId: org.id,
        branchAccess: {
          create: {
            branchId: branch.id,
            roleId: adminRole.id
          }
        }
      },
      include: { branchAccess: true }
    });
  });

  afterAll(async () => {
    await db.organization.delete({ where: { id: org.id } });
  });

  const getCtx = (permissions: string[] = ['all']) => ({
    userId: user.id,
    organizationId: org.id,
    schoolId: school.id,
    branchId: branch.id,
    role: 'Admin Role',
    permissions
  });

  it('lists branch users', async () => {
    const users = await UserDAO.listBranchUsers(getCtx());
    expect(users.length).toBeGreaterThan(0);
    expect(users[0].userId).toBe(user.id);
    expect(users[0].role.id).toBe(adminRole.id);
  });

  it('prevents non-admins from assigning users', async () => {
    await expect(UserDAO.assignUserToBranch(getCtx([]), user.id, adminRole.id))
      .rejects.toThrow("Only admins can assign users.");
  });

  it('prevents admin lockout when removing last admin', async () => {
    await expect(UserDAO.removeUserFromBranch(getCtx(), user.id))
      .rejects.toThrow("Cannot remove this user as it would leave the organization without any administrators.");
  });

  it('prevents admin lockout when changing role of last admin', async () => {
    await expect(UserDAO.updateUserBranchRole(getCtx(), user.id, teacherRole.id))
      .rejects.toThrow("Cannot remove admin privileges from this user as it would leave the organization without any administrators.");
  });

  it('allows assigning and removing a non-admin user', async () => {
    const user2 = await db.user.create({
      data: {
        email: 'teacher.userdao@test.com',
        firstName: 'Teacher',
        lastName: 'User2',
        passwordHash: 'hash',
        userType: 'STAFF',
        status: 'ACTIVE',
        organizationId: org.id
      }
    });

    const assignment = await UserDAO.assignUserToBranch(getCtx(), user2.id, teacherRole.id);
    expect(assignment.roleId).toBe(teacherRole.id);

    // Update role
    const updated = await UserDAO.updateUserBranchRole(getCtx(), user2.id, adminRole.id);
    expect(updated.roleId).toBe(adminRole.id);

    // Can now safely downgrade the first user because user2 is now an admin
    await UserDAO.updateUserBranchRole(getCtx(), user.id, teacherRole.id);

    // Clean up to restore original state
    await UserDAO.updateUserBranchRole(getCtx(), user.id, adminRole.id);
    await UserDAO.removeUserFromBranch(getCtx(), user2.id);
  });
});
