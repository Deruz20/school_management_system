import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RbacDAO } from './rbac.dao';
import { db } from '../db';

describe('RbacDAO', () => {
  let org: import('@prisma/client').Organization;
  let adminRole: import('@prisma/client').Role;
  let user: import('@prisma/client').User;
  let school: import('@prisma/client').School;
  let branch: import('@prisma/client').Branch;

  beforeAll(async () => {
    org = await db.organization.create({ data: { name: 'Rbac Test Org' } });
    school = await db.school.create({ data: { name: 'Rbac Test School', organizationId: org.id } });
    branch = await db.branch.create({ data: { name: 'Rbac Test Branch', schoolId: school.id } });
    
    adminRole = await db.role.create({
      data: { name: 'Admin Role', permissions: ['all'], organizationId: org.id }
    });

    user = await db.user.create({
      data: {
        email: 'admin@rbac.test',
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
      }
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

  it('lists roles for organization', async () => {
    const roles = await RbacDAO.listRoles(getCtx());
    expect(roles.length).toBeGreaterThan(0);
    expect(roles[0].organizationId).toBe(org.id);
  });

  it('prevents non-admins from creating roles', async () => {
    await expect(RbacDAO.createRole(getCtx([]), { name: 'Test', permissions: [] }))
      .rejects.toThrow("Only admins can create roles.");
  });

  it('prevents admin lockout when updating last admin role', async () => {
    await expect(RbacDAO.updateRole(getCtx(), adminRole.id, { permissions: ['read'] }))
      .rejects.toThrow("Cannot remove admin privileges from this role as it would leave the organization without any administrators.");
  });

  it('prevents admin lockout when deleting last admin role', async () => {
    // Note: The delete method also blocks if the role is currently in use, 
    // so we need to test the lockout specifically by creating a second admin role, 
    // assigning it, unassigning the first one, then trying to delete the second one...
    // Actually, delete role throws "Cannot delete role as it is currently assigned to users" 
    // before checking lockout if it is assigned, wait! 
    // Wait, in my code, lockout check is BEFORE usage check. So the lockout error will be thrown first!
    await expect(RbacDAO.deleteRole(getCtx(), adminRole.id))
      .rejects.toThrow("Cannot delete this role as it would leave the organization without any administrators.");
  });

  it('allows creating and deleting non-admin roles', async () => {
    const role = await RbacDAO.createRole(getCtx(), { name: 'Teacher', permissions: ['read'] });
    expect(role).toBeDefined();
    expect(role.name).toBe('Teacher');

    await RbacDAO.deleteRole(getCtx(), role.id);
    const roles = await RbacDAO.listRoles(getCtx());
    expect(roles.find(r => r.id === role.id)).toBeUndefined();
  });
});
