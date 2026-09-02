import { describe, it, expect, beforeEach } from 'vitest';
import { TreasuryDAO } from './treasury.dao';
import { PaymentDAO } from './payment.dao';
import { InvoiceDAO } from './invoice.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import {
  TreasuryAccountType,
  CashbookMovementType,
  CashDirection,
  TransferMethod,
  TransferStatus,
  PaymentMethod,
} from '@prisma/client';

describe('TreasuryDAO & Adversarial Invariant Matrix (ADV-TR-01 .. ADV-TR-10)', () => {
  let ctx1: TenantContext;
  let ctx2: TenantContext;
  let branchId1: string;
  let branchId2: string;
  let user1Id: string;
  let user2Id: string;
  let student1Id: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `AdvTreasuryOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` },
    });

    const school = await db.school.create({
      data: { name: 'Adv Treasury School', organizationId: org.id },
    });

    const b1 = await db.branch.create({
      data: { name: 'Branch 1', schoolId: school.id },
    });
    branchId1 = b1.id;

    const b2 = await db.branch.create({
      data: { name: 'Branch 2', schoolId: school.id },
    });
    branchId2 = b2.id;

    const user1 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `bursar1_${Date.now()}@novaschool.com`,
        passwordHash: 'hash',
        firstName: 'Bursar',
        lastName: 'One',
        userType: 'STAFF',
      },
    });
    user1Id = user1.id;

    const user2 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `bursar2_${Date.now()}@novaschool.com`,
        passwordHash: 'hash',
        firstName: 'Auditor',
        lastName: 'Two',
        userType: 'STAFF',
      },
    });
    user2Id = user2.id;

    ctx1 = {
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId1,
      userId: user1Id,
      role: 'BURSAR',
      permissions: ['all'],
    };

    ctx2 = {
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchId2,
      userId: user2Id,
      role: 'AUDITOR',
      permissions: ['all'],
    };

    const ay = await db.academicYear.create({
      data: {
        branchId: branchId1,
        name: '2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });

    const student = await db.student.create({
      data: {
        branchId: branchId1,
        admissionNo: `ADV-ADM-${Date.now()}`,
        firstName: 'Moses',
        lastName: 'Kato',
        dateOfBirth: new Date('2011-02-10'),
        gender: 'MALE',
        status: 'ACTIVE',
      },
    });
    student1Id = student.id;

    const cls = await db.class.create({ data: { branchId: branchId1, name: `AdvClass_${Date.now()}` } });
    const enrollment = await db.enrollment.create({
      data: { studentId: student1Id, classId: cls.id, academicYearId: ay.id },
    });
    await InvoiceDAO.createIndividualInvoice(ctx1, {
      studentId: student1Id,
      enrollmentId: enrollment.id,
      academicYearId: ay.id,
      dueDate: new Date('2026-04-30'),
      items: [{ feeTypeName: 'Term Tuition', unitAmount: 800000, quantity: 1 }],
    });
  });

  // ADV-TR-01: Negative Physical Balance Guard
  it('ADV-TR-01: should reject physical cash outflow that exceeds available till or safe balance', async () => {
    const till = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-TILL-01',
      name: 'Adv Till',
      accountType: TreasuryAccountType.CASHIER_TILL,
      openingBalance: 100000, // Only 100,000 available
    });

    await expect(
      db.$transaction(async (tx) => {
        await TreasuryDAO.recordCashbookMovement(tx, ctx1, {
          accountId: till.id,
          movementType: CashbookMovementType.OPERATIONAL_EXPENSE,
          direction: CashDirection.OUTFLOW,
          amount: 250000, // Exceeds balance!
          description: 'Excessive cash disbursement',
        });
      })
    ).rejects.toThrow(/Insufficient physical cash/i);

    // Balance remains unmodified
    const tillAfter = await TreasuryDAO.getTreasuryAccountById(ctx1, till.id);
    expect(tillAfter.currentBalance.toNumber()).toBe(100000);
  });

  // ADV-TR-02: Transfer Four-Eye Enforcement
  it('ADV-TR-02: should require approval for high-value transfers and reject self-approval', async () => {
    const safe = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-SAFE-02',
      name: 'Main Vault',
      accountType: TreasuryAccountType.CASH_OFFICE_SAFE,
      openingBalance: 20000000,
    });

    const bank = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-BANK-02',
      name: 'Stanbic Ops',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 10000000,
    });

    // Transfer > 5M UGX (e.g. 8,000,000)
    const result = await TreasuryDAO.createTreasuryTransfer(ctx1, {
      fromAccountId: safe.id,
      toAccountId: bank.id,
      amount: 8000000,
      transferMethod: TransferMethod.BANK_TO_BANK_EFT,
    });

    expect(result.transfer.status).toBe(TransferStatus.PENDING_APPROVAL);

    // Initiator (user1Id) cannot self-approve
    await expect(
      TreasuryDAO.approveTreasuryTransfer(ctx1, result.transfer.id)
    ).rejects.toThrow(/Self-approval of treasury transfers is strictly forbidden/i);

    // Second authorized user (user2 in branch 1) approves
    const ctx1Approver: TenantContext = { ...ctx1, userId: user2Id };
    const approved = await TreasuryDAO.approveTreasuryTransfer(ctx1Approver, result.transfer.id);
    expect(approved.status).toBe(TransferStatus.COMPLETED);
  });

  // ADV-TR-03: Transfer Atomic Rollback
  it('ADV-TR-03: should rollback entire transfer if either leg fails', async () => {
    const safe = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-SAFE-03',
      name: 'Vault 3',
      accountType: TreasuryAccountType.CASH_OFFICE_SAFE,
      openingBalance: 200000, // Only 200k in safe
    });

    const bank = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-BANK-03',
      name: 'Bank 3',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 1000000,
    });

    // Attempting to transfer 500k from safe (insufficient funds)
    await expect(
      TreasuryDAO.createTreasuryTransfer(ctx1, {
        fromAccountId: safe.id,
        toAccountId: bank.id,
        amount: 500000,
        transferMethod: TransferMethod.CASH_BANKING_DEPOSIT,
      })
    ).rejects.toThrow(/Insufficient physical cash/i);

    // Assert balances untouched
    const safeAfter = await TreasuryDAO.getTreasuryAccountById(ctx1, safe.id);
    const bankAfter = await TreasuryDAO.getTreasuryAccountById(ctx1, bank.id);
    expect(safeAfter.currentBalance.toNumber()).toBe(200000);
    expect(bankAfter.currentBalance.toNumber()).toBe(1000000);
  });

  // ADV-TR-04: Duplicate Payment Cashbook Guard
  it('ADV-TR-04: should protect against duplicate cashbook movement posting on replayed payment', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-BANK-04',
      name: 'Fees Bank 4',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      isDefaultFeeCollection: true,
      openingBalance: 5000000,
    });

    const idempotencyKey = `PAY-IDEM-${Date.now()}`;

    // First payment post
    await PaymentDAO.recordPayment(ctx1, {
      studentId: student1Id,
      amount: 300000,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      idempotencyKey,
    });

    const bankAfterFirst = await TreasuryDAO.getTreasuryAccountById(ctx1, bank.id);
    expect(bankAfterFirst.currentBalance.toNumber()).toBe(5300000);

    // Replay exact same payment with same idempotency key
    const replayResult = await PaymentDAO.recordPayment(ctx1, {
      studentId: student1Id,
      amount: 300000,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      idempotencyKey,
    });

    expect(replayResult.isReplay).toBe(true);

    // Account balance must not be credited a second time!
    const bankAfterReplay = await TreasuryDAO.getTreasuryAccountById(ctx1, bank.id);
    expect(bankAfterReplay.currentBalance.toNumber()).toBe(5300000);
  });

  // ADV-TR-05: Duplicate Statement Import Guard (SHA-256 Collision)
  it('ADV-TR-05: should reject duplicate statement file import via SHA-256 hash detection', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-BANK-05',
      name: 'Bank 5',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 10000000,
    });

    const fileContent = 'Date,Ref,Amt\n2026-03-01,REF-001,1000000\n2026-03-02,REF-002,2000000';

    await TreasuryDAO.importBankStatement(ctx1, {
      accountId: bank.id,
      statementIdentifier: 'STMT-A-2026',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      openingBalance: 10000000,
      closingBalance: 13000000,
      fileContentRaw: fileContent,
      lines: [],
    });

    // Re-importing same file content
    await expect(
      TreasuryDAO.importBankStatement(ctx1, {
        accountId: bank.id,
        statementIdentifier: 'STMT-B-2026',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        openingBalance: 10000000,
        closingBalance: 13000000,
        fileContentRaw: fileContent, // Same raw content!
        lines: [],
      })
    ).rejects.toThrow(/Duplicate bank statement file detected/i);
  });

  // ADV-TR-06: Concurrent Balance Mutation Lock
  it('ADV-TR-06: should serialize concurrent balance updates without lost updates', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-BANK-06',
      name: 'Concurrent Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 0,
    });

    // Run 5 parallel cashbook inflows of 100,000 each
    const promises = Array.from({ length: 5 }).map((_, i) =>
      db.$transaction(async (tx) => {
        return TreasuryDAO.recordCashbookMovement(tx, ctx1, {
          accountId: bank.id,
          movementType: CashbookMovementType.FEE_PAYMENT_RECEIPT,
          direction: CashDirection.INFLOW,
          amount: 100000,
          description: `Concurrent payment #${i + 1}`,
        });
      })
    );

    await Promise.all(promises);

    const bankFinal = await TreasuryDAO.getTreasuryAccountById(ctx1, bank.id);
    expect(bankFinal.currentBalance.toNumber()).toBe(500000); // Exact 500,000 without lost update

    const integrity = await TreasuryDAO.assertLedgerIntegrity(ctx1, bank.id);
    expect(integrity.isExactMatch).toBe(true);
    expect(integrity.drift.toNumber()).toBe(0);
  });

  // ADV-TR-07: Reconciliation Variance Lockdown Block
  it('ADV-TR-07: should reject certification of Bank Reconciliation Statement when variance is non-zero', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-BANK-07',
      name: 'Unbalanced Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 10000000,
    });

    // Cashbook shows 10,000,000, but statement closing balance shows 10,500,000 (500k unexplained discrepancy)
    const statement = await TreasuryDAO.importBankStatement(ctx1, {
      accountId: bank.id,
      statementIdentifier: 'UNBALANCED-2026',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      openingBalance: 10000000,
      closingBalance: 10500000,
      fileContentRaw: 'Discrepancy statement content',
      lines: [],
    });

    await expect(
      TreasuryDAO.certifyAndLockBankReconciliation(ctx1, {
        accountId: bank.id,
        statementId: statement.id,
      })
    ).rejects.toThrow(/Cannot certify BRS with non-zero reconciliation variance/i);
  });

  // ADV-TR-08: Manual Match Requires Audit Justification
  it('ADV-TR-08: should enforce mandatory audit notes when manually matching statement line', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-BANK-08',
      name: 'Manual Match Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 5000000,
    });

    let mId = '';
    await db.$transaction(async (tx) => {
      const m = await TreasuryDAO.recordCashbookMovement(tx, ctx1, {
        accountId: bank.id,
        movementType: CashbookMovementType.FEE_PAYMENT_RECEIPT,
        direction: CashDirection.INFLOW,
        amount: 500000,
        description: 'Cheque deposit',
      });
      mId = m.id;
    });

    const statement = await TreasuryDAO.importBankStatement(ctx1, {
      accountId: bank.id,
      statementIdentifier: 'MANUAL-2026-03',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      openingBalance: 5000000,
      closingBalance: 5500000,
      fileContentRaw: 'Date,Amt\n2026-03-10,500000',
      lines: [
        {
          transactionDate: new Date('2026-03-10'),
          narrative: 'Cheque cleared 500k',
          amount: 500000,
          direction: CashDirection.INFLOW,
        },
      ],
    });

    const line = await db.bankStatementLine.findFirst({ where: { statementId: statement.id } });

    // Empty notes must fail
    await expect(
      TreasuryDAO.manualMatchLine(ctx1, {
        statementLineId: line!.id,
        cashbookMovementIds: [mId],
        notes: '',
      })
    ).rejects.toThrow(/Audit justification notes are mandatory/i);

    // With notes succeeds
    const matched = await TreasuryDAO.manualMatchLine(ctx1, {
      statementLineId: line!.id,
      cashbookMovementIds: [mId],
      notes: 'Cheque serial confirmed by bank slip photo',
    });
    expect(matched.success).toBe(true);
  });

  // ADV-TR-09: Reversal After Reconciliation
  it('ADV-TR-09: should record compensating outflow movement on reversed payment without mutating original record', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'ADV-BANK-09',
      name: 'Reversal Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      isDefaultFeeCollection: true,
      openingBalance: 2000000,
    });

    const paymentResult = await PaymentDAO.recordPayment(ctx1, {
      studentId: student1Id,
      amount: 400000,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
    });

    const bankAfterPay = await TreasuryDAO.getTreasuryAccountById(ctx1, bank.id);
    expect(bankAfterPay.currentBalance.toNumber()).toBe(2400000);

    // Reverse payment
    await PaymentDAO.reversePayment(ctx1, paymentResult.payment.id, 'Bounced EFT transfer');

    // Balance restored back to 2,000,000
    const bankAfterReverse = await TreasuryDAO.getTreasuryAccountById(ctx1, bank.id);
    expect(bankAfterReverse.currentBalance.toNumber()).toBe(2000000);

    // Assert movements list has both the original INFLOW and compensating OUTFLOW
    const movements = await TreasuryDAO.getCashbookMovements(ctx1, bank.id);
    const revMovement = movements.find(
      (m) => m.paymentId === paymentResult.payment.id && m.movementType === CashbookMovementType.PAYMENT_REVERSAL_OUT
    );
    expect(revMovement).toBeDefined();
    expect(revMovement?.direction).toBe(CashDirection.OUTFLOW);
    expect(revMovement?.amount.toNumber()).toBe(400000);
  });

  // ADV-TR-10: Strict Branch Isolation
  it('ADV-TR-10: should strictly isolate accounts and block cross-branch transfers', async () => {
    const branch1Bank = await TreasuryDAO.createTreasuryAccount(ctx1, {
      code: 'B1-BANK',
      name: 'Branch 1 Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 5000000,
    });

    const branch2Bank = await TreasuryDAO.createTreasuryAccount(ctx2, {
      code: 'B2-BANK',
      name: 'Branch 2 Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 3000000,
    });

    // Branch 1 cannot access or view Branch 2 accounts
    const b1Accounts = await TreasuryDAO.getTreasuryAccounts(ctx1);
    expect(b1Accounts.find((a) => a.id === branch2Bank.id)).toBeUndefined();

    // Cross-branch transfer attempt must fail
    await expect(
      TreasuryDAO.createTreasuryTransfer(ctx1, {
        fromAccountId: branch1Bank.id,
        toAccountId: branch2Bank.id, // Cross-branch!
        amount: 500000,
        transferMethod: TransferMethod.BANK_TO_BANK_EFT,
      })
    ).rejects.toThrow(/not found in this branch/i);
  });
});
