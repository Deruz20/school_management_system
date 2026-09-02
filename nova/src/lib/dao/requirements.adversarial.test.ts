import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma } from '../db';
import {
  RequirementCategory,
  RequirementUnit,
  ClearanceType,
  PaymentMethod
} from '@prisma/client';
import { TenantContext } from './tenant-context';
import { RequirementsDAO } from './requirements.dao';
import { ClearanceDAO } from './clearance.dao';

describe('NOVA Finance Phase 3.1H — Adversarial & Security Tests (ADV-REQ-01 to ADV-REQ-10)', () => {
  let ctx: TenantContext;
  let unauthorizedCtx: TenantContext;
  let otherBranchCtx: TenantContext;
  let branchId: string;
  let otherBranchId: string;
  let academicYearId: string;
  let term1Id: string;
  let adminUserId: string;
  let classId: string;
  let studentId: string;

  beforeEach(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branches = await prisma.branch.findMany({ where: { schoolId: school?.id }, take: 2 });
    const user = await prisma.user.findFirst({ where: { organizationId: org?.id } });

    branchId = branches[0].id;
    adminUserId = user!.id;

    // Ensure secondary branch exists for isolation tests
    if (branches.length < 2) {
      const b2 = await prisma.branch.create({
        data: {
          schoolId: school!.id,
          name: 'Secondary Campus Branch',
        },
      });
      otherBranchId = b2.id;
    } else {
      otherBranchId = branches[1].id;
    }

    ctx = {
      organizationId: org!.id,
      schoolId: school!.id,
      branchId,
      userId: adminUserId,
      role: 'ADMIN',
      permissions: ['all'],
    };

    unauthorizedCtx = {
      organizationId: org!.id,
      schoolId: school!.id,
      branchId,
      userId: adminUserId,
      role: 'GUEST',
      permissions: [],
    };

    otherBranchCtx = {
      organizationId: org!.id,
      schoolId: school!.id,
      branchId: otherBranchId,
      userId: adminUserId,
      role: 'ADMIN',
      permissions: ['all'],
    };

    // Clean up
    await prisma.inKindHandoverLog.deleteMany({ where: { branchId } });
    await prisma.studentClearance.deleteMany({ where: { branchId } });
    await prisma.clearanceSequence.deleteMany({ where: { branchId } });
    await prisma.inKindReceiptSequence.deleteMany({ where: { branchId } });
    await prisma.receiptSequence.deleteMany({ where: { branchId } });
    await prisma.paymentSequence.deleteMany({ where: { branchId } });
    await prisma.studentRequirementItem.deleteMany({ where: { record: { branchId } } });
    await prisma.studentRequirementRecord.deleteMany({ where: { branchId } });
    await prisma.classRequirementItem.deleteMany({ where: { classRequirement: { branchId } } });
    await prisma.classRequirement.deleteMany({ where: { branchId } });
    await prisma.requirementCatalog.deleteMany({ where: { branchId } });
    await prisma.studentLedgerEntry.deleteMany({ where: { branchId } });
    await prisma.receipt.deleteMany({ where: { branchId } });
    await prisma.paymentAllocation.deleteMany({ where: { branchId } });
    await prisma.payment.deleteMany({ where: { branchId } });

    const year = await prisma.academicYear.upsert({
      where: { id: 'adv-req-year-2026' },
      create: {
        id: 'adv-req-year-2026',
        branchId,
        name: '2026 Academic Year',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
      update: {},
    });
    academicYearId = year.id;

    const term = await prisma.term.upsert({
      where: { id: 'adv-req-term-1-2026' },
      create: {
        id: 'adv-req-term-1-2026',
        academicYearId,
        name: 'Term 1 2026',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-04-30'),
      },
      update: {},
    });
    term1Id = term.id;

    const cls = await prisma.class.upsert({
      where: { id: 'adv-req-class' },
      create: {
        id: 'adv-req-class',
        branchId,
        name: 'Adversarial Test Class',
      },
      update: {},
    });
    classId = cls.id;

    const student = await prisma.student.upsert({
      where: { admissionNo: 'ADV-STU-001' },
      create: {
        id: 'adv-req-student-1',
        branchId,
        admissionNo: 'ADV-STU-001',
        firstName: 'Trevor',
        lastName: 'Musoke',
        classId,
        status: 'ACTIVE',
      },
      update: {},
    });
    studentId = student.id;

    await prisma.enrollment.upsert({
      where: { studentId_academicYearId: { studentId, academicYearId } },
      create: {
        studentId,
        academicYearId,
        classId,
        status: 'ACTIVE',
      },
      update: {},
    });
  });

  // ADV-REQ-01: Negative or Zero Delivery
  it('ADV-REQ-01: rejects negative or zero delivered quantity on physical handover', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId,
      academicYearId,
      termId: term1Id,
      title: 'Blueprint',
      items: [
        {
          name: 'Broom',
          category: RequirementCategory.CLEANING_HYGIENE,
          unit: RequirementUnit.PIECE,
          quantity: 1,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    await expect(
      RequirementsDAO.receiveInKindHandover(ctx, {
        studentRequirementItemId: itemId,
        deltaDelivered: -5,
      })
    ).rejects.toThrow(/Delivered quantity must be greater than zero/i);

    await expect(
      RequirementsDAO.receiveInKindHandover(ctx, {
        studentRequirementItemId: itemId,
        deltaDelivered: 0,
      })
    ).rejects.toThrow(/Delivered quantity must be greater than zero/i);
  });

  // ADV-REQ-02: Over-fulfillment Prevention
  it('ADV-REQ-02: rejects physical delivery exceeding required quantity unless explicitly allowed', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId,
      academicYearId,
      termId: term1Id,
      title: 'Blueprint',
      items: [
        {
          name: 'Scrubbing Brush',
          category: RequirementCategory.CLEANING_HYGIENE,
          unit: RequirementUnit.PIECE,
          quantity: 1,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    // Attempting to deliver 5 when only 1 is required without override
    await expect(
      RequirementsDAO.receiveInKindHandover(ctx, {
        studentRequirementItemId: itemId,
        deltaDelivered: 5,
        allowOverDelivery: false,
      })
    ).rejects.toThrow(/exceeds required quantity/i);

    // Allowed with explicit override
    const overRes = await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: itemId,
      deltaDelivered: 5,
      allowOverDelivery: true,
    });
    expect(Number(overRes.item.quantityDelivered)).toBe(5);
  });

  // ADV-REQ-03: Rejects Cash-in-Lieu on Already Fulfilled Items
  it('ADV-REQ-03: rejects cash-in-lieu monetization for already fulfilled requirement items', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId,
      academicYearId,
      termId: term1Id,
      title: 'Blueprint',
      items: [
        {
          name: 'A4 Paper',
          category: RequirementCategory.ACADEMIC_STATIONERY,
          unit: RequirementUnit.REAM,
          quantity: 1,
          cashInLieuAmount: 35000,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    // Deliver full quantity physically
    await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: itemId,
      deltaDelivered: 1,
    });

    // Attempt to monetize now
    await expect(
      RequirementsDAO.monetizeRequirementItem(ctx, {
        studentRequirementItemId: itemId,
        monetizedQuantity: 1,
        paymentMethod: PaymentMethod.CASH,
      })
    ).rejects.toThrow(/Remaining unfulfilled quantity is 0/i);
  });

  // ADV-REQ-04: Duplicate Cash-in-Lieu Monetization Prevention
  it('ADV-REQ-04: prevents duplicate cash-in-lieu monetization exceeding unfulfilled quantities', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId,
      academicYearId,
      termId: term1Id,
      title: 'Blueprint',
      items: [
        {
          name: 'Toilet Rolls (4-Pack)',
          category: RequirementCategory.CLEANING_HYGIENE,
          unit: RequirementUnit.ROLL,
          quantity: 4,
          cashInLieuAmount: 10000,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    // Monetize 3 rolls
    await RequirementsDAO.monetizeRequirementItem(ctx, {
      studentRequirementItemId: itemId,
      monetizedQuantity: 3,
      paymentMethod: PaymentMethod.CASH,
    });

    // Attempting to monetize 2 rolls when only 1 is remaining
    await expect(
      RequirementsDAO.monetizeRequirementItem(ctx, {
        studentRequirementItemId: itemId,
        monetizedQuantity: 2,
        paymentMethod: PaymentMethod.CASH,
      })
    ).rejects.toThrow(/Remaining unfulfilled quantity is 1/i);
  });

  // ADV-REQ-05: QR Payload Privacy & Sanitization
  it('ADV-REQ-05: proves QR verification response contains ZERO sensitive financial or private phone numbers', async () => {
    const permit = await ClearanceDAO.issueClearancePermit(ctx, {
      studentId,
      academicYearId,
      termId: term1Id,
      clearanceType: ClearanceType.EXAM_PERMIT,
    });

    const verifyRes = await ClearanceDAO.verifyClearanceToken(permit.verificationToken);
    expect(verifyRes.isValid).toBe(true);

    const payload = JSON.stringify(verifyRes);
    // Must NOT contain financial balance, password hashes, or bank accounts
    expect(payload).not.toContain('ledgerBalance');
    expect(payload).not.toContain('passwordHash');
    expect(payload).not.toContain('bankAccount');
    expect(payload).not.toContain('phoneNumber');
  });

  // ADV-REQ-06: Strict Multi-Tenant Branch Isolation
  it('ADV-REQ-06: strictly prevents cross-branch requirement or clearance access', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId,
      academicYearId,
      termId: term1Id,
      title: 'Branch 1 Blueprint',
      items: [
        {
          name: 'Item 1',
          category: RequirementCategory.GENERAL,
          unit: RequirementUnit.PIECE,
          quantity: 1,
        },
      ],
    });

    // Querying from other branch must return null
    const crossQuery = await RequirementsDAO.getClassRequirement(otherBranchCtx, blueprint.id);
    expect(crossQuery).toBeNull();
  });

  // ADV-REQ-07: Duplicate Active Permit Prevention
  it('ADV-REQ-07: prevents duplicate active permit issuance for same student, type, and term', async () => {
    await ClearanceDAO.issueClearancePermit(ctx, {
      studentId,
      academicYearId,
      termId: term1Id,
      clearanceType: ClearanceType.EXAM_PERMIT,
    });

    await expect(
      ClearanceDAO.issueClearancePermit(ctx, {
        studentId,
        academicYearId,
        termId: term1Id,
        clearanceType: ClearanceType.EXAM_PERMIT,
      })
    ).rejects.toThrow(/already exists for this student in this term/i);
  });

  // ADV-REQ-08: Transaction Concurrency Serialization
  it('ADV-REQ-08: safely serializes concurrent physical handover submissions inside transactions', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId,
      academicYearId,
      termId: term1Id,
      title: 'Blueprint',
      items: [
        {
          name: 'Soap',
          category: RequirementCategory.CLEANING_HYGIENE,
          unit: RequirementUnit.BAR,
          quantity: 10,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    // Concurrent deliveries: 3 bars and 4 bars
    const [res1, res2] = await Promise.all([
      RequirementsDAO.receiveInKindHandover(ctx, {
        studentRequirementItemId: itemId,
        deltaDelivered: 3,
      }),
      RequirementsDAO.receiveInKindHandover(ctx, {
        studentRequirementItemId: itemId,
        deltaDelivered: 4,
      }),
    ]);

    expect(res1.log.receiptNumber).not.toBe(res2.log.receiptNumber);

    const updated = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId,
      academicYearId,
      termId: term1Id,
    });
    expect(Number(updated?.items[0].quantityDelivered)).toBe(7);
  });

  // ADV-REQ-09: RBAC Unauthorized Rejection
  it('ADV-REQ-09: rejects unauthorized operations from users missing required permissions', async () => {
    await expect(
      RequirementsDAO.createCatalogItem(unauthorizedCtx, {
        code: 'HACK',
        name: 'Hacked Item',
      })
    ).rejects.toThrow(/Missing permission/i);

    await expect(
      ClearanceDAO.issueProvisionalClearance(unauthorizedCtx, {
        studentId,
        academicYearId,
        termId: term1Id,
        reason: 'Unauthorized bypass',
      })
    ).rejects.toThrow(/Missing permission/i);
  });

  // ADV-REQ-10: Audit Trail Verification
  it('ADV-REQ-10: emits structured AuditService events across all requirement & clearance lifecycles', async () => {
    const initialAuditCount = await prisma.auditLog.count({
      where: { branchId },
    });

    await RequirementsDAO.createCatalogItem(ctx, {
      code: 'AUDIT_ITEM',
      name: 'Audited Catalog Item',
    });

    const permit = await ClearanceDAO.issueClearancePermit(ctx, {
      studentId,
      academicYearId,
      termId: term1Id,
      clearanceType: ClearanceType.GATE_PASS,
    });

    await ClearanceDAO.revokeClearancePermit(ctx, {
      clearanceId: permit.id,
      reason: 'Audit verification test',
    });

    const finalAuditCount = await prisma.auditLog.count({
      where: { branchId },
    });

    expect(finalAuditCount).toBeGreaterThanOrEqual(initialAuditCount + 3);
  });
});
