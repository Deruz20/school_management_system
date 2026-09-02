import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma } from '../db';
import {
  RequirementCategory,
  RequirementUnit,
  RequirementItemStatus,
  ClearanceStatus,
  ClearanceType,
  ClearanceDocStatus,
  PaymentMethod
} from '@prisma/client';
import { TenantContext } from './tenant-context';
import { RequirementsDAO } from './requirements.dao';
import { ClearanceDAO } from './clearance.dao';
import { LedgerDAO } from './ledger.dao';
import { PaymentDAO } from './payment.dao';

describe('NOVA Finance Phase 3.1H — Requirements & Student Financial Clearance Engine (REQ-01 to REQ-20)', () => {
  let ctx: TenantContext;
  let branchId: string;
  let academicYearId: string;
  let term1Id: string;
  let adminUserId: string;
  let classSenior1Id: string;
  let student1Id: string;
  let student2Id: string;
  let feeTypeReqId: string;

  beforeEach(async () => {
    const org = await prisma.organization.findFirst();
    const school = await prisma.school.findFirst({ where: { organizationId: org?.id } });
    const branch = await prisma.branch.findFirst({ where: { schoolId: school?.id } });
    const user = await prisma.user.findFirst({ where: { organizationId: org?.id } });

    branchId = branch!.id;
    adminUserId = user!.id;

    ctx = {
      organizationId: org!.id,
      schoolId: school!.id,
      branchId,
      userId: adminUserId,
      role: 'ADMIN',
      permissions: ['all'],
    };

    // Clean up requirement & clearance records for clean test run
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
    await prisma.invoiceItem.deleteMany({ where: { invoice: { branchId } } });
    await prisma.invoice.deleteMany({ where: { branchId } });

    // Setup Academic Year and Term
    const year = await prisma.academicYear.upsert({
      where: { id: 'test-req-year-2026' },
      create: {
        id: 'test-req-year-2026',
        branchId,
        name: '2026 Academic Year',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
      update: {},
    });
    academicYearId = year.id;

    const term1 = await prisma.term.upsert({
      where: { id: 'test-req-term-1-2026' },
      create: {
        id: 'test-req-term-1-2026',
        academicYearId,
        name: 'Term 1 2026',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-04-30'),
      },
      update: {},
    });
    term1Id = term1.id;

    // Setup Class
    const cls = await prisma.class.upsert({
      where: { id: 'test-req-class-s1' },
      create: {
        id: 'test-req-class-s1',
        branchId,
        name: 'Senior 1 Requirements Test',
      },
      update: {},
    });
    classSenior1Id = cls.id;

    // Setup Students
    const student1 = await prisma.student.upsert({
      where: { admissionNo: 'REQ-STU-001' },
      create: {
        id: 'test-req-student-1',
        branchId,
        admissionNo: 'REQ-STU-001',
        firstName: 'Moses',
        lastName: 'Kigozi',
        classId: classSenior1Id,
        status: 'ACTIVE',
      },
      update: {},
    });
    student1Id = student1.id;

    const student2 = await prisma.student.upsert({
      where: { admissionNo: 'REQ-STU-002' },
      create: {
        id: 'test-req-student-2',
        branchId,
        admissionNo: 'REQ-STU-002',
        firstName: 'Sarah',
        lastName: 'Namubiru',
        classId: classSenior1Id,
        status: 'ACTIVE',
      },
      update: {},
    });
    student2Id = student2.id;

    // Enroll students
    await prisma.enrollment.upsert({
      where: { studentId_academicYearId: { studentId: student1Id, academicYearId } },
      create: {
        studentId: student1Id,
        academicYearId,
        classId: classSenior1Id,
        status: 'ACTIVE',
      },
      update: {},
    });

    await prisma.enrollment.upsert({
      where: { studentId_academicYearId: { studentId: student2Id, academicYearId } },
      create: {
        studentId: student2Id,
        academicYearId,
        classId: classSenior1Id,
        status: 'ACTIVE',
      },
      update: {},
    });

    // Setup Requirements FeeType
    const feeType = await prisma.feeType.upsert({
      where: { branchId_code: { branchId, code: 'REQ_FEE' } },
      create: {
        branchId,
        code: 'REQ_FEE',
        name: 'School Requirements Cash-in-Lieu',
      },
      update: {},
    });
    feeTypeReqId = feeType.id;
  });

  // REQ-01: Catalog Item Creation
  it('REQ-01: creates requirement catalog items with categories, units, and default cash-in-lieu prices', async () => {
    const item = await RequirementsDAO.createCatalogItem(ctx, {
      code: 'A4_REAM',
      name: 'Rotatrim A4 Copier Paper 500 Sheets',
      category: RequirementCategory.ACADEMIC_STATIONERY,
      unit: RequirementUnit.REAM,
      defaultCashInLieu: 35000,
      description: 'Standard 80gsm pure white paper',
    });

    expect(item.id).toBeDefined();
    expect(item.code).toBe('A4_REAM');
    expect(item.category).toBe(RequirementCategory.ACADEMIC_STATIONERY);
    expect(item.unit).toBe(RequirementUnit.REAM);
    expect(Number(item.defaultCashInLieu)).toBe(35000);

    const retrieved = await RequirementsDAO.getCatalogItem(ctx, item.id);
    expect(retrieved?.name).toBe('Rotatrim A4 Copier Paper 500 Sheets');
  });

  // REQ-02: Class Requirement Blueprint Creation
  it('REQ-02: creates class requirement blueprint with mandatory and optional items', async () => {
    const reamCatalog = await RequirementsDAO.createCatalogItem(ctx, {
      code: 'A4_PAPER',
      name: 'A4 Paper',
      category: RequirementCategory.ACADEMIC_STATIONERY,
      unit: RequirementUnit.REAM,
      defaultCashInLieu: 35000,
    });

    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'Senior 1 Term 1 Standard Requirements',
      items: [
        {
          catalogItemId: reamCatalog.id,
          feeTypeId: feeTypeReqId,
          name: 'A4 Paper',
          category: RequirementCategory.ACADEMIC_STATIONERY,
          unit: RequirementUnit.REAM,
          quantity: 1,
          cashInLieuAmount: 35000,
          isMandatory: true,
        },
        {
          name: 'Toilet Rolls (4-Pack)',
          category: RequirementCategory.CLEANING_HYGIENE,
          unit: RequirementUnit.ROLL,
          quantity: 4,
          cashInLieuAmount: 10000,
          isMandatory: true,
        },
        {
          name: 'Scrubbing Brush',
          category: RequirementCategory.CLEANING_HYGIENE,
          unit: RequirementUnit.PIECE,
          quantity: 1,
          cashInLieuAmount: 5000,
          isMandatory: false,
        },
      ],
    });

    expect(blueprint.id).toBeDefined();
    expect(blueprint.items.length).toBe(3);
    expect(blueprint.items[0].name).toBe('A4 Paper');
    expect(blueprint.items[0].isMandatory).toBe(true);
    expect(blueprint.items[2].isMandatory).toBe(false);
  });

  // REQ-03: Bulk Assignment to Enrolled Students
  it('REQ-03: bulk assigns blueprint to enrolled class students idempotently', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'A4 Paper',
          category: RequirementCategory.ACADEMIC_STATIONERY,
          unit: RequirementUnit.REAM,
          quantity: 1,
          cashInLieuAmount: 35000,
          isMandatory: true,
        },
      ],
    });

    const res1 = await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
    });

    expect(res1.assignedCount).toBe(2);
    expect(res1.skippedCount).toBe(0);

    // Second run must be idempotent and skip already assigned
    const res2 = await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
    });

    expect(res2.assignedCount).toBe(0);
    expect(res2.skippedCount).toBe(2);
  });

  // REQ-04: Historical Snapshot Immutability
  it('REQ-04: historical student checklist items remain frozen even if class blueprint is updated', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'Original Item Name',
          category: RequirementCategory.GENERAL,
          unit: RequirementUnit.PIECE,
          quantity: 1,
          cashInLieuAmount: 10000,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
    });

    // Update blueprint with new name and price
    await RequirementsDAO.updateClassRequirement(ctx, blueprint.id, {
      title: 'Modified S1 T1 Blueprint',
      items: [
        {
          name: 'Changed Item Name (Higher Price)',
          category: RequirementCategory.GENERAL,
          unit: RequirementUnit.PIECE,
          quantity: 2,
          cashInLieuAmount: 25000,
          isMandatory: true,
        },
      ],
    });

    // Student record should still hold the frozen original snapshot
    const studentRecord = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });

    expect(studentRecord?.items[0].name).toBe('Original Item Name');
    expect(Number(studentRecord?.items[0].quantityRequired)).toBe(1);
    expect(Number(studentRecord?.items[0].cashInLieuAmount)).toBe(10000);
  });

  // REQ-05: Physical Goods Delivery Tracking (Partial and Fulfilled)
  it('REQ-05: records physical goods delivery and updates status deterministically', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'Toilet Rolls',
          category: RequirementCategory.CLEANING_HYGIENE,
          unit: RequirementUnit.ROLL,
          quantity: 4,
          cashInLieuAmount: 10000,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
      studentIds: [student1Id],
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    // Partial delivery: 2 rolls of 4
    const partialRes = await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: itemId,
      deltaDelivered: 2,
      notes: 'Brought 2 rolls in morning',
    });

    expect(Number(partialRes.item.quantityDelivered)).toBe(2);
    expect(partialRes.item.status).toBe(RequirementItemStatus.PARTIAL);
    expect(partialRes.log.receiptNumber).toMatch(/^INK-2026-\d{5}$/);

    // Remaining delivery: 2 more rolls
    const fullRes = await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: itemId,
      deltaDelivered: 2,
      notes: 'Brought remaining 2 rolls in afternoon',
    });

    expect(Number(fullRes.item.quantityDelivered)).toBe(4);
    expect(fullRes.item.status).toBe(RequirementItemStatus.FULFILLED);

    const updatedRecord = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    expect(updatedRecord?.isFullyCompliant).toBe(true);
    expect(updatedRecord?.fulfilledCount).toBe(1);
    expect(updatedRecord?.pendingCount).toBe(0);
  });

  // REQ-06: Append-only Handover Log with Receipt Numbers
  it('REQ-06: maintains append-only InKindHandoverLogs with chronological history', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'Exercise Books',
          category: RequirementCategory.ACADEMIC_STATIONERY,
          unit: RequirementUnit.BOOK,
          quantity: 10,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
      studentIds: [student1Id],
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: itemId,
      deltaDelivered: 4,
    });
    await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: itemId,
      deltaDelivered: 6,
    });

    const itemWithLogs = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });

    expect(itemWithLogs!.items[0].handoverLogs.length).toBe(2);
    expect(Number(itemWithLogs!.items[0].handoverLogs[0].deltaDelivered)).toBe(6);
    expect(Number(itemWithLogs!.items[0].handoverLogs[1].deltaDelivered)).toBe(4);
  });

  // REQ-07: Non-Destructive Handover Reversal
  it('REQ-07: reverses handover cleanly with negative delta and maintains audit trail without deletion', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'A4 Ream',
          category: RequirementCategory.ACADEMIC_STATIONERY,
          unit: RequirementUnit.REAM,
          quantity: 1,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
      studentIds: [student1Id],
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: itemId,
      deltaDelivered: 1,
    });

    // Erroneous delivery reversed
    const reversal = await RequirementsDAO.reverseInKindHandover(ctx, {
      studentRequirementItemId: itemId,
      deltaReduction: 1,
      reason: 'Entered for wrong student by mistake',
    });

    expect(Number(reversal.item.quantityDelivered)).toBe(0);
    expect(reversal.item.status).toBe(RequirementItemStatus.PENDING);
    expect(reversal.log.isCorrection).toBe(true);
    expect(reversal.log.correctionReason).toBe('Entered for wrong student by mistake');
    expect(Number(reversal.log.deltaDelivered)).toBe(-1);
  });

  // REQ-08: Cash-in-Lieu Monetization via PaymentDAO
  it('REQ-08: monetizes requirement item via PaymentDAO, creating formal Payment and ledger credit', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'A4 Ream Paper',
          category: RequirementCategory.ACADEMIC_STATIONERY,
          unit: RequirementUnit.REAM,
          quantity: 1,
          cashInLieuAmount: 35000,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
      studentIds: [student1Id],
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    const monetizeRes = await RequirementsDAO.monetizeRequirementItem(ctx, {
      studentRequirementItemId: itemId,
      monetizedQuantity: 1,
      paymentMethod: PaymentMethod.CASH,
      payerName: 'Parent of Moses',
    });

    expect(Number(monetizeRes.item.quantityMonetized)).toBe(1);
    expect(monetizeRes.item.status).toBe(RequirementItemStatus.MONETIZED);
    expect(monetizeRes.payment.paymentNumber).toMatch(/^PAY-2026-\d{5}$/);
    expect(Number(monetizeRes.payment.amount)).toBe(35000);

    // Ledger balance should show credit of 35000
    const ledger = await prisma.studentLedgerEntry.findFirst({
      where: { branchId, studentId: student1Id },
      orderBy: { postedAt: 'desc' },
    });
    expect(ledger?.entryType).toBe('PAYMENT');
    expect(Number(ledger?.amount)).toBe(35000);
    expect(Number(ledger?.balanceAfter)).toBe(-35000); // Advance credit
  });

  // REQ-09: Zero Double-Counting Proof
  it('REQ-09: physical delivery has ZERO ledger impact; cash-in-lieu produces exact single ledger credit', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'Bar Soap',
          category: RequirementCategory.CLEANING_HYGIENE,
          unit: RequirementUnit.BAR,
          quantity: 2,
          cashInLieuAmount: 8000,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
      studentIds: [student1Id],
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    // Physical delivery of 1 bar
    await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: itemId,
      deltaDelivered: 1,
    });

    // Ledger entries count must be 0
    let ledgerEntriesCount = await prisma.studentLedgerEntry.count({
      where: { branchId, studentId: student1Id },
    });
    expect(ledgerEntriesCount).toBe(0);

    // Monetization of remaining 1 bar @ 8000
    await RequirementsDAO.monetizeRequirementItem(ctx, {
      studentRequirementItemId: itemId,
      monetizedQuantity: 1,
      paymentMethod: PaymentMethod.MTN_MOMO,
    });

    // Ledger entries count must be exactly 1
    ledgerEntriesCount = await prisma.studentLedgerEntry.count({
      where: { branchId, studentId: student1Id },
    });
    expect(ledgerEntriesCount).toBe(1);
  });

  // REQ-10: Exemption Workflow
  it('REQ-10: exempts requirement item for scholarship student and updates compliance', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'Special Biology Kit',
          category: RequirementCategory.ACADEMIC_STATIONERY,
          unit: RequirementUnit.SET,
          quantity: 1,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
      studentIds: [student1Id],
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    const itemId = record!.items[0].id;

    const exemptRes = await RequirementsDAO.exemptRequirementItem(ctx, {
      studentRequirementItemId: itemId,
      reason: 'Sponsored by Mastercard Foundation full scholarship',
    });

    expect(exemptRes.status).toBe(RequirementItemStatus.EXEMPTED);
    expect(exemptRes.exemptionReason).toBe('Sponsored by Mastercard Foundation full scholarship');

    const updatedRecord = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    expect(updatedRecord?.isFullyCompliant).toBe(true);
  });

  // REQ-11: Clearance Evaluation - Full Compliance (Status CLEARED)
  it('REQ-11: evaluates student with 0 balance and 100% requirements as CLEARED', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'A4 Ream',
          category: RequirementCategory.ACADEMIC_STATIONERY,
          unit: RequirementUnit.REAM,
          quantity: 1,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
      studentIds: [student1Id],
    });

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: record!.items[0].id,
      deltaDelivered: 1,
    });

    const evalRes = await ClearanceDAO.evaluateStudentClearance(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });

    expect(evalRes.isFinanciallyCleared).toBe(true);
    expect(evalRes.areRequirementsFulfilled).toBe(true);
    expect(evalRes.overallStatus).toBe(ClearanceStatus.CLEARED);
    expect(evalRes.blockingReasons.length).toBe(0);
  });

  // REQ-12: Clearance with Advance Credit
  it('REQ-12: student with advance credit (negative balance) achieves full financial clearance', async () => {
    // Post advance payment of UGX 100,000
    await PaymentDAO.recordPayment(ctx, {
      studentId: student1Id,
      amount: 100000,
      paymentMethod: PaymentMethod.CASH,
      notes: 'Advance fee payment',
    });

    const evalRes = await ClearanceDAO.evaluateStudentClearance(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });

    expect(Number(evalRes.ledgerBalance)).toBe(-100000);
    expect(evalRes.isFinanciallyCleared).toBe(true);
    expect(evalRes.overallStatus).toBe(ClearanceStatus.CLEARED);
  });

  // REQ-13: Clearance Blocked by Outstanding Debt
  it('REQ-13: blocks clearance for student with outstanding fee balance', async () => {
    // Post debit opening balance (debt) of UGX 500,000
    await LedgerDAO.postOpeningBalance(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
      direction: 'DEBIT',
      amount: 500000,
      reason: 'Term 1 Tuition Arrears',
    });

    const evalRes = await ClearanceDAO.evaluateStudentClearance(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
      maxAllowedDebt: 0,
    });

    expect(Number(evalRes.ledgerBalance)).toBe(500000);
    expect(evalRes.isFinanciallyCleared).toBe(false);
    expect(evalRes.overallStatus).toBe(ClearanceStatus.BLOCKED);
    expect(evalRes.blockingReasons[0]).toContain('Outstanding fee balance of UGX 500000');
  });

  // REQ-14: Clearance Blocked by Missing Requirements
  it('REQ-14: blocks clearance for student with 0 balance but pending mandatory requirement', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'Mandatory Lab Coat',
          category: RequirementCategory.GENERAL,
          unit: RequirementUnit.PIECE,
          quantity: 1,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
      studentIds: [student1Id],
    });

    const evalRes = await ClearanceDAO.evaluateStudentClearance(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });

    expect(evalRes.isFinanciallyCleared).toBe(true);
    expect(evalRes.areRequirementsFulfilled).toBe(false);
    expect(evalRes.overallStatus).toBe(ClearanceStatus.BLOCKED);
    expect(evalRes.blockingReasons[0]).toContain('pending mandatory school requirement');
  });

  // REQ-15: Provisional Clearance Authorization
  it('REQ-15: grants provisional clearance override with mandatory justification and expiration', async () => {
    // Student owes 200,000
    await LedgerDAO.postOpeningBalance(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
      direction: 'DEBIT',
      amount: 200000,
      reason: 'Unpaid fee balance',
    });

    const expiryDate = new Date('2026-04-15');
    const provPermit = await ClearanceDAO.issueProvisionalClearance(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
      clearanceType: ClearanceType.EXAM_PERMIT,
      reason: 'Parent signed commitment letter to pay by 15th April',
      validUntil: expiryDate,
    });

    expect(provPermit.id).toBeDefined();
    expect(provPermit.status).toBe(ClearanceStatus.PROVISIONAL);
    expect(provPermit.provisionalReason).toBe('Parent signed commitment letter to pay by 15th April');
    expect(provPermit.clearanceNumber).toMatch(/^CLR-2026-\d{5}$/);
    expect(provPermit.verificationToken.length).toBe(64);
  });

  // REQ-16: Permit Sequential Numbering
  it('REQ-16: generates sequential, collision-safe clearance permit numbers (CLR-YYYY-NNNNN)', async () => {
    const permit1 = await ClearanceDAO.issueClearancePermit(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
      clearanceType: ClearanceType.GATE_PASS,
    });

    const permit2 = await ClearanceDAO.issueClearancePermit(ctx, {
      studentId: student2Id,
      academicYearId,
      termId: term1Id,
      clearanceType: ClearanceType.GATE_PASS,
    });

    expect(permit1.clearanceNumber).toBe('CLR-2026-00001');
    expect(permit2.clearanceNumber).toBe('CLR-2026-00002');
  });

  // REQ-17: Permit Revocation
  it('REQ-17: revokes active permit, records revocation reason, and invalidates verification', async () => {
    const permit = await ClearanceDAO.issueClearancePermit(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
      clearanceType: ClearanceType.EXAM_PERMIT,
    });

    const revoked = await ClearanceDAO.revokeClearancePermit(ctx, {
      clearanceId: permit.id,
      reason: 'Cheque bounced after permit issuance',
    });

    expect(revoked.docStatus).toBe(ClearanceDocStatus.REVOKED);
    expect(revoked.revocationReason).toBe('Cheque bounced after permit issuance');

    const verifyRes = await ClearanceDAO.verifyClearanceToken(permit.verificationToken);
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.reason).toBe('REVOKED');
    expect(verifyRes.permit?.revocationReason).toBe('Cheque bounced after permit issuance');
  });

  // REQ-18: Cryptographic QR Token Verification
  it('REQ-18: verifies 256-bit cryptographic token and returns sanitized verification payload', async () => {
    const permit = await ClearanceDAO.issueClearancePermit(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
      clearanceType: ClearanceType.EXAM_PERMIT,
    });

    const verifyRes = await ClearanceDAO.verifyClearanceToken(permit.verificationToken);
    expect(verifyRes.isValid).toBe(true);
    expect(verifyRes.reason).toBe('VALID');
    expect(verifyRes.permit?.studentName).toBe('Moses Kigozi');
    expect(verifyRes.permit?.studentAdmissionNo).toBe('REQ-STU-001');
    expect(verifyRes.permit?.clearanceType).toBe(ClearanceType.EXAM_PERMIT);
  });

  // REQ-19: Token Expiration
  it('REQ-19: returns EXPIRED for tokens past validUntil date', async () => {
    const pastDate = new Date('2026-01-01');
    const permit = await ClearanceDAO.issueClearancePermit(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
      clearanceType: ClearanceType.GATE_PASS,
      validUntil: pastDate,
    });

    const verifyRes = await ClearanceDAO.verifyClearanceToken(permit.verificationToken);
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.reason).toBe('EXPIRED');
  });

  // REQ-20: Storekeeper Reconciliation Tally
  it('REQ-20: aggregates physical goods received per item across all classes with accurate net totals', async () => {
    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: classSenior1Id,
      academicYearId,
      termId: term1Id,
      title: 'S1 T1 Blueprint',
      items: [
        {
          name: 'A4 Ream',
          category: RequirementCategory.ACADEMIC_STATIONERY,
          unit: RequirementUnit.REAM,
          quantity: 2,
          cashInLieuAmount: 35000,
          isMandatory: true,
        },
      ],
    });

    await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: blueprint.id,
      academicYearId,
      termId: term1Id,
    });

    const rec1 = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student1Id,
      academicYearId,
      termId: term1Id,
    });
    const rec2 = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: student2Id,
      academicYearId,
      termId: term1Id,
    });

    // Student 1 delivers 2 reams physically
    await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: rec1!.items[0].id,
      deltaDelivered: 2,
    });

    // Student 2 monetizes 1 ream and delivers 1 ream physically
    await RequirementsDAO.monetizeRequirementItem(ctx, {
      studentRequirementItemId: rec2!.items[0].id,
      monetizedQuantity: 1,
      paymentMethod: PaymentMethod.CASH,
    });
    await RequirementsDAO.receiveInKindHandover(ctx, {
      studentRequirementItemId: rec2!.items[0].id,
      deltaDelivered: 1,
    });

    const tally = await RequirementsDAO.getStorekeeperTally(ctx, {
      academicYearId,
      termId: term1Id,
    });

    expect(tally.items.length).toBe(1);
    expect(tally.items[0].name).toBe('A4 Ream');
    expect(tally.items[0].totalRequired).toBe(4);
    expect(tally.items[0].totalDelivered).toBe(3);
    expect(tally.items[0].totalMonetized).toBe(1);
    expect(tally.items[0].totalPending).toBe(0);
    expect(tally.items[0].fulfillmentRate).toBe(100);
    expect(tally.totalDeliveredPhysical).toBe(3);
    expect(tally.totalMonetizedItems).toBe(1);
  });
});
