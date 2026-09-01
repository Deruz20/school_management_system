import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { AuditService } from './audit.service';
import { db } from '../db';

describe('AuditService', () => {
  let org: import('@prisma/client').Organization;
  let org2: import('@prisma/client').Organization;
  let user: import('@prisma/client').User;
  let school: import('@prisma/client').School;
  let branch: import('@prisma/client').Branch;
  let branch2: import('@prisma/client').Branch;

  beforeAll(async () => {
    org = await db.organization.create({ data: { name: `Audit Test Org ${Date.now()}` } });
    org2 = await db.organization.create({ data: { name: `Audit Test Org 2 ${Date.now()}` } });
    school = await db.school.create({ data: { name: 'Audit Test School', organizationId: org.id } });
    branch = await db.branch.create({ data: { name: 'Audit Test Branch', schoolId: school.id } });
    branch2 = await db.branch.create({ data: { name: 'Audit Test Branch 2', schoolId: school.id } });
    
    user = await db.user.create({
      data: {
        email: `audit_${Date.now()}@test.com`,
        firstName: 'Audit',
        lastName: 'User',
        passwordHash: 'hash',
        userType: 'STAFF',
        status: 'ACTIVE',
        organizationId: org.id
      }
    });
  });

  afterAll(async () => {
    await db.organization.delete({ where: { id: org.id } }).catch(() => {});
    await db.organization.delete({ where: { id: org2.id } }).catch(() => {});
  });

  afterEach(async () => {
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { organizationId: { in: [org.id, org2.id] } },
          { branchId: { in: [branch.id, branch2.id] } },
          { userId: user.id },
          { action: 'SYSTEM_BOOT' }
        ]
      }
    });
  });

  const getCtx = (branchIdToUse = branch.id) => ({
    userId: user.id,
    organizationId: org.id,
    schoolId: school.id,
    branchId: branchIdToUse,
    role: 'Admin',
    permissions: ['all']
  });

  it('logs actions correctly', async () => {
    await AuditService.log(getCtx(), 'TEST_ACTION', 'Resource', '123', 'Details here');
    const logs = await db.auditLog.findMany({ where: { action: 'TEST_ACTION', branchId: branch.id } });
    expect(logs.length).toBe(1);
    expect(logs[0].branchId).toBe(branch.id);
  });

  it('retrieves logs scoped to branch and organization', async () => {
    // Log for branch 1
    await AuditService.log(getCtx(branch.id), 'ACTION_B1', 'Res', '1');
    // Log for branch 2
    await AuditService.log(getCtx(branch2.id), 'ACTION_B2', 'Res', '2');

    // Retrieve for branch 1
    const logsB1 = await AuditService.getLogs(getCtx(branch.id));
    expect(logsB1.length).toBe(1);
    expect(logsB1[0].action).toBe('ACTION_B1');

    // Retrieve for branch 2
    const logsB2 = await AuditService.getLogs(getCtx(branch2.id));
    expect(logsB2.length).toBe(1);
    expect(logsB2[0].action).toBe('ACTION_B2');
  });

  it('allows system-level logging (null context)', async () => {
    await AuditService.log(null, 'SYSTEM_BOOT', 'System');
    const logs = await db.auditLog.findMany({ where: { action: 'SYSTEM_BOOT' } });
    expect(logs.length).toBe(1);
    expect(logs[0].organizationId).toBeNull();
  });
});
