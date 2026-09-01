import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { InvoiceDAO } from './invoice.dao';
import { DiscountDAO } from './discount.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import {
  DiscountType,
  InvoiceStatus,
  Prisma,
  Student,
  FeeType,
  AcademicYear,
  Term,
  Class,
  FeeStructure,
  Enrollment
} from '@prisma/client';

describe('InvoiceDAO', () => {
  let orgId: string;
  let branchId1: string;
  let branchId2: string;
  let ctxBranch1: TenantContext;
  let ctxNoPerms: TenantContext;

  let class1: Class;
  let ay1: AcademicYear;
  let term1: Term;
  let feeTypeTuition: FeeType;
  let feeTypeDev: FeeType;
  let feeStructure1: FeeStructure;
  let student1: Student;
  let student2: Student;
  let enrollment1: Enrollment;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `InvoiceTestOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
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
        email: `inv_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        firstName: 'Finance',
        lastName: 'Manager',
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
      permissions: ['fees:read', 'fees:invoices:write', 'fees:discount:write']
    };

    ctxNoPerms = {
      userId: user.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId1,
      role: 'Viewer',
      permissions: []
    };

    class1 = await db.class.create({
      data: { branchId: branchId1, name: 'S.1 North' }
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

    feeTypeTuition = await db.feeType.create({
      data: { branchId: branchId1, name: 'Tuition Fee', code: `TUI_${Date.now()}` }
    });

    feeTypeDev = await db.feeType.create({
      data: { branchId: branchId1, name: 'Development Levy', code: `DEV_${Date.now()}` }
    });

    feeStructure1 = await db.feeStructure.create({
      data: {
        branchId: branchId1,
        name: 'S.1 Standard Blueprint',
        classId: class1.id,
        academicYearId: ay1.id,
        termId: term1.id,
        items: {
          create: [
            { feeTypeId: feeTypeTuition.id, amount: new Prisma.Decimal(800000), isOptional: false },
            { feeTypeId: feeTypeDev.id, amount: new Prisma.Decimal(200000), isOptional: false }
          ]
        }
      }
    });

    student1 = await db.student.create({
      data: {
        branchId: branchId1,
        admissionNo: `ADM_${Date.now()}_1`,
        firstName: 'Alice',
        lastName: 'Nalubega'
      }
    });

    student2 = await db.student.create({
      data: {
        branchId: branchId1,
        admissionNo: `ADM_${Date.now()}_2`,
        firstName: 'Brian',
        lastName: 'Kigozi'
      }
    });

    enrollment1 = await db.enrollment.create({
      data: {
        studentId: student1.id,
        classId: class1.id,
        academicYearId: ay1.id,
        status: 'ACTIVE'
      }
    });

    await db.enrollment.create({
      data: {
        studentId: student2.id,
        classId: class1.id,
        academicYearId: ay1.id,
        status: 'ACTIVE'
      }
    });
  });

  afterAll(async () => {
    if (orgId) {
      await db.feeStructureItem.deleteMany({
        where: { feeStructure: { branch: { school: { organizationId: orgId } } } }
      }).catch(() => {});
      await db.feeStructure.deleteMany({
        where: { branch: { school: { organizationId: orgId } } }
      }).catch(() => {});
      await db.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
  });

  it('generates sequential, collision-safe invoice numbers transactionally', async () => {
    const num1 = await db.$transaction(async (tx) => {
      return InvoiceDAO.generateNextInvoiceNumber(tx, branchId1, new Date('2026-02-01'));
    });
    expect(num1).toBe('INV-2026-00001');

    const num2 = await db.$transaction(async (tx) => {
      return InvoiceDAO.generateNextInvoiceNumber(tx, branchId1, new Date('2026-02-01'));
    });
    expect(num2).toBe('INV-2026-00002');

    // Concurrent generation
    const promises = Array.from({ length: 5 }, () =>
      db.$transaction(async (tx) => {
        return InvoiceDAO.generateNextInvoiceNumber(tx, branchId1, new Date('2026-02-01'));
      })
    );
    const nums = await Promise.all(promises);
    const uniqueNums = new Set(nums);
    expect(uniqueNums.size).toBe(5);
  });

  it('calculates deterministic discounts with line-item and general precedence and zero floor', async () => {
    const rawItems = [
      { feeTypeId: 'tui', feeTypeName: 'Tuition', unitAmount: new Prisma.Decimal(800000), quantity: 1 },
      { feeTypeId: 'dev', feeTypeName: 'Dev Fee', unitAmount: new Prisma.Decimal(200000), quantity: 1 }
    ];

    // 50% discount on Tuition only
    const discounts1 = [
      { feeTypeId: 'tui', discountType: DiscountType.PERCENTAGE, value: new Prisma.Decimal(50), isActive: true }
    ];
    const res1 = InvoiceDAO.calculateFinancials(rawItems, discounts1);
    expect(res1.grossAmount.toString()).toBe('1000000');
    expect(res1.discountAmount.toString()).toBe('400000');
    expect(res1.netAmount.toString()).toBe('600000');
    expect(res1.items[0].discount.toString()).toBe('400000');
    expect(res1.items[0].lineTotal.toString()).toBe('400000');
    expect(res1.items[1].discount.toString()).toBe('0');
    expect(res1.items[1].lineTotal.toString()).toBe('200000');

    // General discount of 1,500,000 on a 1,000,000 bill (caps at 1,000,000, net is 0)
    const discounts2 = [
      { feeTypeId: null, discountType: DiscountType.FIXED_AMOUNT, value: new Prisma.Decimal(1500000), isActive: true }
    ];
    const res2 = InvoiceDAO.calculateFinancials(rawItems, discounts2);
    expect(res2.grossAmount.toString()).toBe('1000000');
    expect(res2.discountAmount.toString()).toBe('1000000');
    expect(res2.netAmount.toString()).toBe('0');
  });

  it('creates individual template-based invoice with immutable snapshots and audit trail', async () => {
    // Assign 50% bursary to student 1
    await DiscountDAO.create(ctxBranch1, {
      studentId: student1.id,
      feeTypeId: feeTypeTuition.id,
      discountType: DiscountType.PERCENTAGE,
      value: 50,
      reason: 'Staff child discount'
    });

    const invoice = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      feeStructureId: feeStructure1.id,
      dueDate: new Date('2026-03-31'),
      notes: 'Term 1 Individual Bill'
    });

    expect(invoice.id).toBeDefined();
    expect(invoice.invoiceNumber).toMatch(/^INV-2026-\d{5}$/);
    expect(invoice.status).toBe(InvoiceStatus.PENDING);
    expect(Number(invoice.grossAmount)).toBe(1000000);
    expect(Number(invoice.discountAmount)).toBe(400000);
    expect(Number(invoice.netAmount)).toBe(600000);
    expect(invoice.items.length).toBe(2);

    const audit = await db.auditLog.findFirst({
      where: { resourceId: invoice.id, action: 'CREATE_INVOICE' }
    });
    expect(audit).not.toBeNull();
  });

  it('creates individual ad-hoc custom invoice with custom lines', async () => {
    const invoice = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      dueDate: new Date('2026-04-15'),
      items: [
        { feeTypeId: feeTypeTuition.id, feeTypeName: 'Custom Tuition', unitAmount: 300000, quantity: 1 },
        { feeTypeName: 'Late Registration Fine', unitAmount: 50000, quantity: 1 }
      ]
    });

    expect(invoice.id).toBeDefined();
    expect(Number(invoice.grossAmount)).toBe(350000);
    expect(invoice.items.length).toBe(2);
  });

  it('rejects cross-branch student, enrollment, or academic period mismatch', async () => {
    const studentInBranch2 = await db.student.create({
      data: {
        branchId: branchId2,
        admissionNo: `ADM_B2_${Date.now()}`,
        firstName: 'Charlie',
        lastName: 'Lwanga'
      }
    });

    await expect(
      InvoiceDAO.createIndividualInvoice(ctxBranch1, {
        studentId: studentInBranch2.id,
        enrollmentId: enrollment1.id,
        academicYearId: ay1.id,
        dueDate: new Date('2026-03-31')
      })
    ).rejects.toThrow('Invalid student: Student does not belong to this branch.');
  });

  it('executes bulk class billing idempotently with duplicate prevention', async () => {
    // Student 1 has 50% Tuition discount
    await DiscountDAO.create(ctxBranch1, {
      studentId: student1.id,
      feeTypeId: feeTypeTuition.id,
      discountType: DiscountType.PERCENTAGE,
      value: 50,
      reason: 'Bursary 50%'
    });

    // Run 1: Should bill 2 students
    const run1 = await InvoiceDAO.generateInvoicesForClass(ctxBranch1, {
      classId: class1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      feeStructureId: feeStructure1.id,
      dueDate: new Date('2026-03-31')
    });

    expect(run1.billedCount).toBe(2);
    expect(run1.skippedCount).toBe(0);
    expect(run1.invoices.length).toBe(2);

    // Verify student 1 has discount and student 2 has full amount
    const inv1 = run1.invoices.find((i) => i.studentId === student1.id);
    const inv2 = run1.invoices.find((i) => i.studentId === student2.id);
    expect(Number(inv1?.netAmount)).toBe(600000);
    expect(Number(inv2?.netAmount)).toBe(1000000);

    // Run 2: Should skip both students (idempotent, 0 new invoices)
    const run2 = await InvoiceDAO.generateInvoicesForClass(ctxBranch1, {
      classId: class1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      feeStructureId: feeStructure1.id,
      dueDate: new Date('2026-03-31')
    });

    expect(run2.billedCount).toBe(0);
    expect(run2.skippedCount).toBe(2);
    expect(run2.invoices.length).toBe(0);

    // Verify audit log for bulk billing
    const audit = await db.auditLog.findFirst({
      where: { action: 'GENERATE_BULK_INVOICES', resourceId: class1.id }
    });
    expect(audit).not.toBeNull();
  });

  it('guarantees historical immutability: changing originating FeeStructure or discounts does not alter issued invoices', async () => {
    const run = await InvoiceDAO.generateInvoicesForClass(ctxBranch1, {
      classId: class1.id,
      academicYearId: ay1.id,
      termId: term1.id,
      feeStructureId: feeStructure1.id,
      dueDate: new Date('2026-03-31')
    });

    const issuedInvoice = await InvoiceDAO.getById(ctxBranch1, run.invoices[0].id);
    const originalNet = Number(issuedInvoice.netAmount);

    // Modify originating FeeStructure item amounts
    await db.feeStructureItem.updateMany({
      where: { feeStructureId: feeStructure1.id },
      data: { amount: new Prisma.Decimal(2500000) }
    });

    // Re-fetch issued invoice
    const reFetched = await InvoiceDAO.getById(ctxBranch1, issuedInvoice.id);
    expect(Number(reFetched.netAmount)).toBe(originalNet);
    expect(Number(reFetched.items[0].unitAmount)).toBe(800000);
  });

  it('voids an invoice with mandatory reason and audit entry', async () => {
    const inv = await InvoiceDAO.createIndividualInvoice(ctxBranch1, {
      studentId: student1.id,
      enrollmentId: enrollment1.id,
      academicYearId: ay1.id,
      dueDate: new Date('2026-03-31'),
      items: [{ feeTypeName: 'Custom Item', unitAmount: 100000, quantity: 1 }]
    });

    await expect(
      InvoiceDAO.voidInvoice(ctxBranch1, inv.id, '')
    ).rejects.toThrow('Void reason is mandatory.');

    const voided = await InvoiceDAO.voidInvoice(ctxBranch1, inv.id, 'Student transferred to another school');
    expect(voided.status).toBe(InvoiceStatus.VOID);
    expect(voided.voidReason).toBe('Student transferred to another school');
    expect(voided.voidedAt).not.toBeNull();

    await expect(
      InvoiceDAO.voidInvoice(ctxBranch1, inv.id, 'Duplicate void')
    ).rejects.toThrow('Invoice is already voided.');

    const audit = await db.auditLog.findFirst({
      where: { resourceId: inv.id, action: 'VOID_INVOICE' }
    });
    expect(audit).not.toBeNull();
  });

  it('enforces RBAC permissions', async () => {
    await expect(
      InvoiceDAO.list(ctxNoPerms)
    ).rejects.toThrow('Missing permission: fees:read');

    await expect(
      InvoiceDAO.createIndividualInvoice(ctxNoPerms, {
        studentId: student1.id,
        enrollmentId: enrollment1.id,
        academicYearId: ay1.id,
        dueDate: new Date('2026-03-31')
      })
    ).rejects.toThrow('Missing permission: fees:invoices:write');
  });
});
