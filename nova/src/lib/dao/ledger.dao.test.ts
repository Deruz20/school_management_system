import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerDAO } from './ledger.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import {
  LedgerDirection,
  Prisma,
  Student,
  AcademicYear,
  Class
} from '@prisma/client';

describe('LedgerDAO', () => {
  let branchId1: string;
  let branchId2: string;
  let ctxBranch1: TenantContext;
  let ctxNoPerms: TenantContext;
  let user1Id: string;

  let class1: Class;
  let ay1: AcademicYear;
  let student1: Student;
  let student2: Student;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `LedgerTestOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: 'Ledger School', organizationId: org.id }
    });

    const b1 = await db.branch.create({
      data: { name: 'Branch 1', schoolId: school.id }
    });
    branchId1 = b1.id;

    const b2 = await db.branch.create({
      data: { name: 'Branch 2', schoolId: school.id }
    });
    branchId2 = b2.id;

    const user1 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `bursar_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: 'hashed',
        firstName: 'Bursar',
        lastName: 'Officer',
        userType: 'STAFF'
      }
    });
    user1Id = user1.id;

    ctxBranch1 = {
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId1,
      userId: user1Id,
      role: 'Admin',
      permissions: ['fees:read', 'fees:write', 'fees:ledger:adjust']
    };

    ctxNoPerms = {
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId1,
      userId: user1Id,
      role: 'Staff',
      permissions: []
    };

    class1 = await db.class.create({
      data: { branchId: branchId1, name: 'Senior 1' }
    });

    ay1 = await db.academicYear.create({
      data: {
        branchId: branchId1,
        name: '2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31')
      }
    });

    await db.term.create({
      data: {
        academicYearId: ay1.id,
        name: 'Term 1',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-04-15')
      }
    });

    student1 = await db.student.create({
      data: {
        branchId: branchId1,
        admissionNo: `ADM-L1-${Date.now()}`,
        firstName: 'John',
        lastName: 'Mukasa',
        classId: class1.id
      }
    });

    student2 = await db.student.create({
      data: {
        branchId: branchId2,
        admissionNo: `ADM-L2-${Date.now()}`,
        firstName: 'Sarah',
        lastName: 'Nalwanga'
      }
    });
  });

  it('calculates initial zero balance for new student', async () => {
    const bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('0');
    expect(bal.totalDebits.toString()).toBe('0');
    expect(bal.totalCredits.toString()).toBe('0');
  });

  it('posts opening balance arrears (debit) and computes balance correctly', async () => {
    const entry = await LedgerDAO.postOpeningBalance(ctxBranch1, {
      studentId: student1.id,
      academicYearId: ay1.id,
      direction: LedgerDirection.DEBIT,
      amount: '350000.00',
      reason: '2025 Term 3 Arrears'
    });

    expect(entry.direction).toBe(LedgerDirection.DEBIT);
    expect(entry.amount.toString()).toBe('350000');
    expect(entry.balanceAfter.toString()).toBe('350000');

    const bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('350000');
    expect(bal.totalDebits.toString()).toBe('350000');
    expect(bal.totalCredits.toString()).toBe('0');
  });

  it('posts opening balance advance credit (credit) correctly', async () => {
    const entry = await LedgerDAO.postOpeningBalance(ctxBranch1, {
      studentId: student1.id,
      direction: LedgerDirection.CREDIT,
      amount: '150000.00',
      reason: 'Advance deposit brought forward'
    });

    expect(entry.direction).toBe(LedgerDirection.CREDIT);
    expect(entry.balanceAfter.toString()).toBe('-150000');

    const bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.balance.toString()).toBe('-150000');
  });

  it('rejects opening balance if active invoice exists on or before cutoff date', async () => {
    const enrollment = await db.enrollment.create({
      data: {
        studentId: student1.id,
        classId: class1.id,
        academicYearId: ay1.id
      }
    });

    await db.invoice.create({
      data: {
        branchId: branchId1,
        studentId: student1.id,
        enrollmentId: enrollment.id,
        academicYearId: ay1.id,
        invoiceNumber: `INV-TEST-001`,
        billingKey: `KEY-001`,
        issueDate: new Date('2026-01-10'),
        dueDate: new Date('2026-02-10'),
        grossAmount: new Prisma.Decimal('500000.00'),
        discountAmount: new Prisma.Decimal('0.00'),
        netAmount: new Prisma.Decimal('500000.00'),
        status: 'PENDING'
      }
    });

    await expect(
      LedgerDAO.postOpeningBalance(ctxBranch1, {
        studentId: student1.id,
        direction: LedgerDirection.DEBIT,
        amount: '200000.00',
        reason: 'Arrears',
        cutoffDate: new Date('2026-01-15')
      })
    ).rejects.toThrow(/Conflict: Active invoices already exist/);
  });

  it('posts debit and credit adjustments with audit trail', async () => {
    await LedgerDAO.postAdjustment(ctxBranch1, {
      studentId: student1.id,
      direction: LedgerDirection.DEBIT,
      amount: '25000.00',
      reason: 'Late registration fee'
    });

    await LedgerDAO.postAdjustment(ctxBranch1, {
      studentId: student1.id,
      direction: LedgerDirection.CREDIT,
      amount: '10000.00',
      reason: 'Early payment discount'
    });

    const bal = await LedgerDAO.getBalance(ctxBranch1, student1.id);
    expect(bal.totalDebits.toString()).toBe('25000');
    expect(bal.totalCredits.toString()).toBe('10000');
    expect(bal.balance.toString()).toBe('15000');
  });

  it('generates chronological statement with accurate running balance', async () => {
    await LedgerDAO.postAdjustment(ctxBranch1, {
      studentId: student1.id,
      direction: LedgerDirection.DEBIT,
      amount: '500000.00',
      reason: 'Tuition Charge'
    });

    await LedgerDAO.postAdjustment(ctxBranch1, {
      studentId: student1.id,
      direction: LedgerDirection.CREDIT,
      amount: '200000.00',
      reason: 'Bursary Concession'
    });

    await LedgerDAO.postAdjustment(ctxBranch1, {
      studentId: student1.id,
      direction: LedgerDirection.CREDIT,
      amount: '150000.00',
      reason: 'Payment 1'
    });

    const stmt = await LedgerDAO.getStatement(ctxBranch1, student1.id);
    expect(stmt.student.fullName).toBe('John Mukasa');
    expect(stmt.transactions.length).toBe(3);
    expect(stmt.transactions[0].balanceAfter.toString()).toBe('500000');
    expect(stmt.transactions[1].balanceAfter.toString()).toBe('300000');
    expect(stmt.transactions[2].balanceAfter.toString()).toBe('150000');
    expect(stmt.summary.closingBalance.toString()).toBe('150000');
  });

  it('enforces branch isolation', async () => {
    // Branch 1 cannot access Branch 2 student
    await expect(LedgerDAO.getBalance(ctxBranch1, student2.id)).rejects.toThrow(
      /Student not found or access denied/
    );

    // Missing permissions
    await expect(LedgerDAO.getBalance(ctxNoPerms, student1.id)).rejects.toThrow(
      /Missing permission: fees:read/
    );
  });
});
