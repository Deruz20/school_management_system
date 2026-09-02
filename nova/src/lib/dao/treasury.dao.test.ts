import { describe, it, expect, beforeEach } from 'vitest';
import { TreasuryDAO } from './treasury.dao';
import { PaymentDAO } from './payment.dao';
import { ExpenseDAO } from './expense.dao';
import { InvoiceDAO } from './invoice.dao';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import {
  TreasuryAccountType,
  CashbookMovementType,
  CashDirection,
  TransferMethod,
  TransferStatus,
  SessionStatus,
  PettyVoucherStatus,
  StatementLineMatchStatus,
  BRSStatus,
  PaymentMethod,
} from '@prisma/client';

describe('TreasuryDAO & Unit Tests Matrix (TR-01 .. TR-20)', () => {
  let ctx: TenantContext;
  let branchId: string;
  let userId: string;
  let studentId: string;
  let expenseCategoryId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `TreasuryOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` },
    });

    const school = await db.school.create({
      data: { name: 'Treasury School', organizationId: org.id },
    });

    const branch = await db.branch.create({
      data: { name: 'Main Campus', schoolId: school.id },
    });
    branchId = branch.id;

    const user = await db.user.create({
      data: {
        organizationId: org.id,
        email: `bursar_${Date.now()}@novaschool.com`,
        passwordHash: 'hash',
        firstName: 'Bursar',
        lastName: 'Primary',
        userType: 'STAFF',
      },
    });
    userId = user.id;

    ctx = {
      organizationId: org.id,
      schoolId: school.id,
      branchId,
      userId,
      role: 'BURSAR',
      permissions: ['all'],
    };

    // Create Academic Year & Student for Fee Payments
    const ay = await db.academicYear.create({
      data: {
        branchId,
        name: '2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });

    const student = await db.student.create({
      data: {
        branchId,
        admissionNo: `ADM-${Date.now()}`,
        firstName: 'Joel',
        lastName: 'Musoke',
        dateOfBirth: new Date('2010-05-15'),
        gender: 'MALE',
        status: 'ACTIVE',
      },
    });
    studentId = student.id;

    // Create class and enrollment so invoice can be generated
    const cls = await db.class.create({ data: { branchId, name: `Class_${Date.now()}` } });
    const enrollment = await db.enrollment.create({
      data: { studentId, classId: cls.id, academicYearId: ay.id },
    });
    await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId,
      enrollmentId: enrollment.id,
      academicYearId: ay.id,
      dueDate: new Date('2026-03-31'),
      items: [{ feeTypeName: 'Tuition Fee', unitAmount: 500000, quantity: 1 }],
    });

    // Create Expense Category
    const expCat = await db.expenseCategory.create({
      data: {
        branchId,
        name: `General Operations_${Date.now()}`,
        code: `OPS_${Date.now()}`,
      },
    });
    expenseCategoryId = expCat.id;
  });

  // TR-01: Create Treasury Accounts & Assert Code Uniqueness
  it('TR-01: should create accounts of all types and enforce unique codes', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'STANBIC-01',
      name: 'Stanbic Fees Collection',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      bankName: 'Stanbic Bank Uganda',
      accountNumber: '9030012345678',
      openingBalance: 10000000,
    });
    expect(bank.code).toBe('STANBIC-01');
    expect(bank.currentBalance.toNumber()).toBe(10000000);

    const safe = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'SAFE-01',
      name: 'Bursar Main Safe',
      accountType: TreasuryAccountType.CASH_OFFICE_SAFE,
      openingBalance: 2000000,
    });
    expect(safe.code).toBe('SAFE-01');

    const till = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'TILL-01',
      name: 'Registration Counter Till',
      accountType: TreasuryAccountType.CASHIER_TILL,
      openingBalance: 0,
    });
    expect(till.code).toBe('TILL-01');

    // Duplicate code must fail
    await expect(
      TreasuryDAO.createTreasuryAccount(ctx, {
        code: 'STANBIC-01',
        name: 'Duplicate Stanbic',
        accountType: TreasuryAccountType.COMMERCIAL_BANK,
      })
    ).rejects.toThrow(/already exists/i);
  });

  // TR-02: Enforce Default Account Designations
  it('TR-02: should maintain single default account per operational purpose', async () => {
    const bank1 = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'BANK-A',
      name: 'Bank A',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      isDefaultFeeCollection: true,
    });
    expect(bank1.isDefaultFeeCollection).toBe(true);

    // Creating second default should unset the first
    const bank2 = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'BANK-B',
      name: 'Bank B',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      isDefaultFeeCollection: true,
    });
    expect(bank2.isDefaultFeeCollection).toBe(true);

    const refetchedBank1 = await TreasuryDAO.getTreasuryAccountById(ctx, bank1.id);
    expect(refetchedBank1.isDefaultFeeCollection).toBe(false);

    const defaultFeeAcc = await TreasuryDAO.getDefaultAccount(ctx, 'FEE_COLLECTION');
    expect(defaultFeeAcc?.id).toBe(bank2.id);
  });

  // TR-03: Post Fee Payment via PaymentDAO -> Treasury Inflow
  it('TR-03: should automatically post cashbook inflow and increment balance when PaymentDAO records payment', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'FEES-BANK',
      name: 'Fees Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      isDefaultFeeCollection: true,
      openingBalance: 1000000,
    });

    const paymentResult = await PaymentDAO.recordPayment(ctx, {
      studentId,
      amount: 250000,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
    });

    // Check account balance incremented
    const updatedBank = await TreasuryDAO.getTreasuryAccountById(ctx, bank.id);
    expect(updatedBank.currentBalance.toNumber()).toBe(1250000);

    // Check cashbook movement exists
    const movements = await TreasuryDAO.getCashbookMovements(ctx, bank.id);
    const feeMovement = movements.find((m) => m.paymentId === paymentResult.payment.id);
    expect(feeMovement).toBeDefined();
    expect(feeMovement?.movementType).toBe(CashbookMovementType.FEE_PAYMENT_RECEIPT);
    expect(feeMovement?.amount.toNumber()).toBe(250000);
    expect(feeMovement?.direction).toBe(CashDirection.INFLOW);
  });

  // TR-04: Post Expense via ExpenseDAO -> Treasury Outflow
  it('TR-04: should automatically post cashbook outflow and decrement balance when ExpenseDAO creates expense', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'OPS-BANK',
      name: 'Operations Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      isDefaultOperations: true,
      openingBalance: 5000000,
    });

    const expenseResult = await ExpenseDAO.createExpense(ctx, {
      categoryId: expenseCategoryId,
      title: 'Science Lab Chemicals',
      amount: 400000,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
    });

    const updatedBank = await TreasuryDAO.getTreasuryAccountById(ctx, bank.id);
    expect(updatedBank.currentBalance.toNumber()).toBe(4600000);

    const movements = await TreasuryDAO.getCashbookMovements(ctx, bank.id);
    const expMovement = movements.find((m) => m.expenseId === expenseResult.expense.id);
    expect(expMovement).toBeDefined();
    expect(expMovement?.movementType).toBe(CashbookMovementType.OPERATIONAL_EXPENSE);
    expect(expMovement?.amount.toNumber()).toBe(400000);
    expect(expMovement?.direction).toBe(CashDirection.OUTFLOW);
  });

  // TR-05: Atomic Inter-Account Transfer
  it('TR-05: should atomically deduct source and credit target account on transfer', async () => {
    const safe = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'SAFE-05',
      name: 'Safe',
      accountType: TreasuryAccountType.CASH_OFFICE_SAFE,
      openingBalance: 3000000,
    });

    const till = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'TILL-05',
      name: 'Till',
      accountType: TreasuryAccountType.CASHIER_TILL,
      openingBalance: 500000,
    });

    const result = await TreasuryDAO.createTreasuryTransfer(ctx, {
      fromAccountId: safe.id,
      toAccountId: till.id,
      amount: 1000000,
      transferMethod: TransferMethod.SAFE_TO_PETTY_FLOAT,
      notes: 'Replenishing counter cash',
    });

    expect(result.transfer.status).toBe(TransferStatus.COMPLETED);

    const safeAfter = await TreasuryDAO.getTreasuryAccountById(ctx, safe.id);
    const tillAfter = await TreasuryDAO.getTreasuryAccountById(ctx, till.id);

    expect(safeAfter.currentBalance.toNumber()).toBe(2000000);
    expect(tillAfter.currentBalance.toNumber()).toBe(1500000);
  });

  // TR-06: Open Cashier Shift Session
  it('TR-06: should open cashier shift session and initialize till float balance', async () => {
    const till = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'TILL-06',
      name: 'Counter Till 1',
      accountType: TreasuryAccountType.CASHIER_TILL,
      openingBalance: 0,
    });

    const session = await TreasuryDAO.openShiftSession(ctx, {
      tillAccountId: till.id,
      openingFloat: 50000,
    });

    expect(session.status).toBe(SessionStatus.OPEN);
    expect(session.openingFloat.toNumber()).toBe(50000);

    const tillAfter = await TreasuryDAO.getTreasuryAccountById(ctx, till.id);
    expect(tillAfter.currentBalance.toNumber()).toBe(50000);
  });

  // TR-07: Cash Payments Accumulate in Shift Till
  it('TR-07: should route cash payments directly into active cashier shift till', async () => {
    const till = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'TILL-07',
      name: 'Counter Till 2',
      accountType: TreasuryAccountType.CASHIER_TILL,
      openingBalance: 0,
    });

    await TreasuryDAO.openShiftSession(ctx, {
      tillAccountId: till.id,
      openingFloat: 100000,
    });

    // Post CASH payment by this cashier
    await PaymentDAO.recordPayment(ctx, {
      studentId,
      amount: 150000,
      paymentMethod: PaymentMethod.CASH,
    });

    const tillAfter = await TreasuryDAO.getTreasuryAccountById(ctx, till.id);
    expect(tillAfter.currentBalance.toNumber()).toBe(250000); // 100k float + 150k payment
  });

  // TR-08: Close Cashier Shift with Exact Cash Count
  it('TR-08: should close shift session with zero variance when counted cash matches expected', async () => {
    const till = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'TILL-08',
      name: 'Counter Till 3',
      accountType: TreasuryAccountType.CASHIER_TILL,
      openingBalance: 0,
    });

    const session = await TreasuryDAO.openShiftSession(ctx, {
      tillAccountId: till.id,
      openingFloat: 50000,
    });

    await PaymentDAO.recordPayment(ctx, {
      studentId,
      amount: 100000,
      paymentMethod: PaymentMethod.CASH,
    });

    const closed = await TreasuryDAO.recordShiftCashCountAndClose(ctx, {
      sessionId: session.id,
      actualCashCounted: 150000, // 50k float + 100k payment
      denominationsJson: JSON.stringify({ notes50k: 3 }),
    });

    expect(closed.status).toBe(SessionStatus.CLOSED);
    expect(closed.expectedClosingBalance?.toNumber()).toBe(150000);
    expect(closed.cashVariance?.toNumber()).toBe(0);
  });

  // TR-09: Close Cashier Shift with Cash Shortage
  it('TR-09: should record shortage variance and enforce explanatory notes requirement', async () => {
    const till = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'TILL-09',
      name: 'Counter Till 4',
      accountType: TreasuryAccountType.CASHIER_TILL,
      openingBalance: 0,
    });

    const session = await TreasuryDAO.openShiftSession(ctx, {
      tillAccountId: till.id,
      openingFloat: 100000,
    });

    // Close without notes on variance must fail
    await expect(
      TreasuryDAO.recordShiftCashCountAndClose(ctx, {
        sessionId: session.id,
        actualCashCounted: 80000, // 20k shortage
      })
    ).rejects.toThrow(/explanatory notes are mandatory/i);

    // Close with notes succeeds
    const closed = await TreasuryDAO.recordShiftCashCountAndClose(ctx, {
      sessionId: session.id,
      actualCashCounted: 80000,
      varianceNotes: 'Damaged note rejected at counter',
    });

    expect(closed.status).toBe(SessionStatus.CLOSED);
    expect(closed.cashVariance?.toNumber()).toBe(-20000);
  });

  // TR-10: Cash Handover at Shift Close: Sweep to Safe
  it('TR-10: should automatically sweep till cash to cash safe at shift close', async () => {
    const safe = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'SAFE-10',
      name: 'Main Safe',
      accountType: TreasuryAccountType.CASH_OFFICE_SAFE,
      openingBalance: 1000000,
    });

    const till = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'TILL-10',
      name: 'Sweep Till',
      accountType: TreasuryAccountType.CASHIER_TILL,
      openingBalance: 0,
    });

    const session = await TreasuryDAO.openShiftSession(ctx, {
      tillAccountId: till.id,
      openingFloat: 200000,
    });

    await TreasuryDAO.recordShiftCashCountAndClose(ctx, {
      sessionId: session.id,
      actualCashCounted: 200000,
      sweepToSafe: true,
      safeAccountId: safe.id,
    });

    const safeAfter = await TreasuryDAO.getTreasuryAccountById(ctx, safe.id);
    const tillAfter = await TreasuryDAO.getTreasuryAccountById(ctx, till.id);

    expect(safeAfter.currentBalance.toNumber()).toBe(1200000);
    expect(tillAfter.currentBalance.toNumber()).toBe(0);
  });

  // TR-11: Cash Banking Deposit Lifecycle
  it('TR-11: should handle Cash Banking from Safe to Bank via IN_TRANSIT and deposit confirmation', async () => {
    const safe = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'SAFE-11',
      name: 'Cash Safe',
      accountType: TreasuryAccountType.CASH_OFFICE_SAFE,
      openingBalance: 5000000,
    });

    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'BANK-11',
      name: 'Stanbic Operations',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 10000000,
    });

    // Step 1: Dispatch cash to bank
    const transferResult = await TreasuryDAO.createTreasuryTransfer(ctx, {
      fromAccountId: safe.id,
      toAccountId: bank.id,
      amount: 2000000,
      transferMethod: TransferMethod.CASH_BANKING_DEPOSIT,
      securityEscortDetails: 'Securitas Escort Van #UG-0452',
    });

    expect(transferResult.transfer.status).toBe(TransferStatus.IN_TRANSIT);

    // Safe is deducted immediately
    const safeMid = await TreasuryDAO.getTreasuryAccountById(ctx, safe.id);
    const bankMid = await TreasuryDAO.getTreasuryAccountById(ctx, bank.id);
    expect(safeMid.currentBalance.toNumber()).toBe(3000000);
    expect(bankMid.currentBalance.toNumber()).toBe(10000000); // Bank not credited yet!

    // Step 2: Confirm deposit with stamped slip
    const confirmed = await TreasuryDAO.confirmCashBankingDeposit(ctx, transferResult.transfer.id, {
      depositSlipNumber: 'SLIP-STANBIC-99881',
    });

    expect(confirmed.status).toBe(TransferStatus.COMPLETED);
    const bankFinal = await TreasuryDAO.getTreasuryAccountById(ctx, bank.id);
    expect(bankFinal.currentBalance.toNumber()).toBe(12000000); // Now credited
  });

  // TR-12: Setup Petty Cash Imprest
  it('TR-12: should configure petty cash imprest float ceiling and threshold', async () => {
    const floatAcc = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'PETTY-ACC-12',
      name: 'Admin Petty Cash Float',
      accountType: TreasuryAccountType.PETTY_CASH_FLOAT,
      openingBalance: 500000,
    });

    const imprest = await TreasuryDAO.createPettyCashImprest(ctx, {
      accountId: floatAcc.id,
      custodianId: userId,
      name: 'Administration Float',
      floatCeiling: 500000,
      replenishmentThreshold: 150000,
    });

    expect(imprest.name).toBe('Administration Float');
    expect(imprest.floatCeiling.toNumber()).toBe(500000);
    expect(imprest.replenishmentThreshold.toNumber()).toBe(150000);
  });

  // TR-13: Request, Approve & Disburse Petty Cash Voucher
  it('TR-13: should handle voucher request, approval and disbursement from petty float', async () => {
    const floatAcc = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'PETTY-ACC-13',
      name: 'Kitchen Petty Cash',
      accountType: TreasuryAccountType.PETTY_CASH_FLOAT,
      openingBalance: 300000,
    });

    const imprest = await TreasuryDAO.createPettyCashImprest(ctx, {
      accountId: floatAcc.id,
      custodianId: userId,
      name: 'Kitchen Float',
      floatCeiling: 300000,
      replenishmentThreshold: 100000,
    });

    // Request
    const voucher = await TreasuryDAO.createPettyCashVoucher(ctx, {
      imprestId: imprest.id,
      purpose: 'Emergency kitchen cooking oil',
      categoryId: expenseCategoryId,
      requestedAmount: 80000,
    });
    expect(voucher.status).toBe(PettyVoucherStatus.SUBMITTED);

    // Approve
    const approved = await TreasuryDAO.approvePettyCashVoucher(ctx, voucher.id, {
      approvedAmount: 80000,
    });
    expect(approved.status).toBe(PettyVoucherStatus.APPROVED);

    // Disburse
    const disbursed = await TreasuryDAO.disbursePettyCashVoucher(ctx, voucher.id);
    expect(disbursed.status).toBe(PettyVoucherStatus.DISBURSED);

    const floatAfter = await TreasuryDAO.getTreasuryAccountById(ctx, floatAcc.id);
    expect(floatAfter.currentBalance.toNumber()).toBe(220000);
  });

  // TR-14: Retire Petty Cash Voucher with Change Returned
  it('TR-14: should retire voucher with receipts and re-credit unspent change to float', async () => {
    const floatAcc = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'PETTY-ACC-14',
      name: 'Science Petty Cash',
      accountType: TreasuryAccountType.PETTY_CASH_FLOAT,
      openingBalance: 200000,
    });

    const imprest = await TreasuryDAO.createPettyCashImprest(ctx, {
      accountId: floatAcc.id,
      custodianId: userId,
      name: 'Science Float',
      floatCeiling: 200000,
      replenishmentThreshold: 50000,
    });

    const voucher = await TreasuryDAO.createPettyCashVoucher(ctx, {
      imprestId: imprest.id,
      purpose: 'Chemistry test tubes',
      categoryId: expenseCategoryId,
      requestedAmount: 50000,
    });
    await TreasuryDAO.approvePettyCashVoucher(ctx, voucher.id, { approvedAmount: 50000 });
    await TreasuryDAO.disbursePettyCashVoucher(ctx, voucher.id);

    // Retire: Spent 42,000, Change returned 8,000
    const retired = await TreasuryDAO.retirePettyCashVoucher(ctx, voucher.id, {
      spentAmount: 42000,
      changeReturned: 8000,
      receiptUrl: 'https://docs.school.com/receipts/chem-tubes.pdf',
    });

    expect(retired.status).toBe(PettyVoucherStatus.RETIRED);

    // Balance was 150,000 + 8,000 change returned = 158,000
    const floatAfter = await TreasuryDAO.getTreasuryAccountById(ctx, floatAcc.id);
    expect(floatAfter.currentBalance.toNumber()).toBe(158000);
  });

  // TR-15: Replenish Petty Cash Imprest Float
  it('TR-15: should replenish petty cash float from bank and restore balance to ceiling', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'BANK-15',
      name: 'Ops Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 5000000,
    });

    const floatAcc = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'PETTY-ACC-15',
      name: 'Staffroom Float',
      accountType: TreasuryAccountType.PETTY_CASH_FLOAT,
      openingBalance: 400000,
    });

    const imprest = await TreasuryDAO.createPettyCashImprest(ctx, {
      accountId: floatAcc.id,
      custodianId: userId,
      name: 'Staffroom Imprest',
      floatCeiling: 400000,
      replenishmentThreshold: 100000,
    });

    // Create, disburse and retire a voucher for 120,000
    const voucher = await TreasuryDAO.createPettyCashVoucher(ctx, {
      imprestId: imprest.id,
      purpose: 'Staff tea provisions',
      categoryId: expenseCategoryId,
      requestedAmount: 120000,
    });
    await TreasuryDAO.approvePettyCashVoucher(ctx, voucher.id, { approvedAmount: 120000 });
    await TreasuryDAO.disbursePettyCashVoucher(ctx, voucher.id);
    await TreasuryDAO.retirePettyCashVoucher(ctx, voucher.id, { spentAmount: 120000, changeReturned: 0 });

    // Replenish from bank
    const result = await TreasuryDAO.replenishPettyCashImprest(ctx, imprest.id, {
      sourceAccountId: bank.id,
    });

    expect(result.vouchersReplenished).toBe(1);
    expect(result.totalReplenished.toNumber()).toBe(120000);

    const floatAfter = await TreasuryDAO.getTreasuryAccountById(ctx, floatAcc.id);
    const bankAfter = await TreasuryDAO.getTreasuryAccountById(ctx, bank.id);

    // Float restored back to 400,000
    expect(floatAfter.currentBalance.toNumber()).toBe(400000);
    expect(bankAfter.currentBalance.toNumber()).toBe(4880000);
  });

  // TR-16: Ingest CSV Bank Statement
  it('TR-16: should ingest bank statement and parse lines into immutable BankStatementLine records', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'BANK-16',
      name: 'Stanbic Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 50000000,
    });

    const rawCsv = `Date,Reference,Narrative,Debit,Credit,Balance
2026-03-01,TXN-001,SchoolPay Fees Inflow,,5000000,55000000
2026-03-02,TXN-002,Ledger Maintenance Fee,25000,,54975000`;

    const statement = await TreasuryDAO.importBankStatement(ctx, {
      accountId: bank.id,
      statementIdentifier: 'STANBIC-2026-03',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      openingBalance: 50000000,
      closingBalance: 54975000,
      fileContentRaw: rawCsv,
      lines: [
        {
          transactionDate: new Date('2026-03-01'),
          reference: 'TXN-001',
          narrative: 'SchoolPay Fees Inflow',
          amount: 5000000,
          direction: CashDirection.INFLOW,
          runningBalance: 55000000,
        },
        {
          transactionDate: new Date('2026-03-02'),
          reference: 'TXN-002',
          narrative: 'Ledger Maintenance Fee',
          amount: 25000,
          direction: CashDirection.OUTFLOW,
          runningBalance: 54975000,
        },
      ],
    });

    expect(statement.statementIdentifier).toBe('STANBIC-2026-03');

    const lines = await db.bankStatementLine.findMany({ where: { statementId: statement.id } });
    expect(lines).toHaveLength(2);
    expect(lines[0].matchStatus).toBe(StatementLineMatchStatus.UNRECONCILED);
  });

  // TR-17: Deterministic Matching
  it('TR-17: should auto-match statement lines against cashbook movements by reference and amount', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'BANK-17',
      name: 'DFCU Collection',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 10000000,
    });

    // Create cashbook movement
    await db.$transaction(async (tx) => {
      await TreasuryDAO.recordCashbookMovement(tx, ctx, {
        accountId: bank.id,
        movementType: CashbookMovementType.FEE_PAYMENT_RECEIPT,
        direction: CashDirection.INFLOW,
        amount: 2000000,
        referenceNumber: 'REF-DFCU-7711',
        description: 'Term 1 Tuition Batch',
      });
    });

    // Import statement containing that reference
    const statement = await TreasuryDAO.importBankStatement(ctx, {
      accountId: bank.id,
      statementIdentifier: 'DFCU-MAR-2026',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      openingBalance: 10000000,
      closingBalance: 12000000,
      fileContentRaw: 'Date,Ref,Amt\n2026-03-05,REF-DFCU-7711,2000000',
      lines: [
        {
          transactionDate: new Date('2026-03-05'),
          reference: 'REF-DFCU-7711',
          narrative: 'Cash deposit REF-DFCU-7711',
          amount: 2000000,
          direction: CashDirection.INFLOW,
          runningBalance: 12000000,
        },
      ],
    });

    const matchResult = await TreasuryDAO.runDeterministicMatching(ctx, bank.id, statement.id);
    expect(matchResult.matchedCount).toBe(1);

    const line = await db.bankStatementLine.findFirst({ where: { statementId: statement.id } });
    expect(line?.matchStatus).toBe(StatementLineMatchStatus.AUTO_MATCHED);

    const movement = await db.cashbookMovement.findFirst({ where: { accountId: bank.id, referenceNumber: 'REF-DFCU-7711' } });
    expect(movement?.isReconciled).toBe(true);
    expect(movement?.statementLineId).toBe(line?.id);
  });

  // TR-18: Timing Differences: Deposits in Transit & Unpresented Cheques
  it('TR-18: should classify unmatched inflows as Deposits in Transit and unmatched outflows as Unpresented Cheques', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'BANK-18',
      name: 'Centenary Ops',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 10000000,
    });

    // Unmatched Inflow -> Deposit in Transit (500k)
    await db.$transaction(async (tx) => {
      await TreasuryDAO.recordCashbookMovement(tx, ctx, {
        accountId: bank.id,
        movementType: CashbookMovementType.BANK_DEPOSIT_IN,
        direction: CashDirection.INFLOW,
        amount: 500000,
        referenceNumber: 'SLIP-TRANSIT-01',
        description: 'End of month deposit in transit',
        transactionDate: new Date('2026-03-30'),
      });
    });

    // Unmatched Outflow -> Unpresented Cheque (300k)
    await db.$transaction(async (tx) => {
      await TreasuryDAO.recordCashbookMovement(tx, ctx, {
        accountId: bank.id,
        movementType: CashbookMovementType.OPERATIONAL_EXPENSE,
        direction: CashDirection.OUTFLOW,
        amount: 300000,
        referenceNumber: 'CHQ-99120',
        description: 'Supplier Cheque unpresented',
        transactionDate: new Date('2026-03-30'),
      });
    });

    // Bank statement closing balance = 10,000,000 (neither transaction cleared bank yet)
    const statement = await TreasuryDAO.importBankStatement(ctx, {
      accountId: bank.id,
      statementIdentifier: 'CENTENARY-2026-03',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      openingBalance: 10000000,
      closingBalance: 10000000,
      fileContentRaw: 'Date,Narrative,Balance\n2026-03-31,Closing,10000000',
      lines: [],
    });

    const bsr = await TreasuryDAO.calculateBankReconciliation(ctx, bank.id, statement.id);
    expect(bsr.totalDepositsInTransit.toNumber()).toBe(500000);
    expect(bsr.totalUnpresentedCheques.toNumber()).toBe(300000);

    // Adjusted Bank = 10M + 500k - 300k = 10,200,000
    expect(bsr.adjustedBankBalance.toNumber()).toBe(10200000);
    // Adjusted Cashbook = 10M + 500k - 300k = 10,200,000
    expect(bsr.adjustedCashbookBalance.toNumber()).toBe(10200000);
    expect(bsr.variance.toNumber()).toBe(0);
    expect(bsr.isBalanced).toBe(true);
  });

  // TR-19: Bank Reconciliation Mathematical Proof
  it('TR-19: should verify Adjusted Bank Balance equals Adjusted Cashbook Balance with zero variance', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'BANK-19',
      name: 'Stanbic Balance Proof',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 20000000,
    });

    const statement = await TreasuryDAO.importBankStatement(ctx, {
      accountId: bank.id,
      statementIdentifier: 'PROOF-03-2026',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      openingBalance: 20000000,
      closingBalance: 20000000,
      fileContentRaw: 'Statement balance matches',
      lines: [],
    });

    const recon = await TreasuryDAO.calculateBankReconciliation(ctx, bank.id, statement.id);
    expect(recon.isBalanced).toBe(true);
    expect(recon.variance.toNumber()).toBe(0);
    expect(recon.adjustedBankBalance.equals(recon.adjustedCashbookBalance)).toBe(true);
  });

  // TR-20: Certify and Lock BRS
  it('TR-20: should certify and lock Bank Reconciliation Statement when variance is zero', async () => {
    const bank = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: 'BANK-20',
      name: 'Reconciled Bank',
      accountType: TreasuryAccountType.COMMERCIAL_BANK,
      openingBalance: 15000000,
    });

    const statement = await TreasuryDAO.importBankStatement(ctx, {
      accountId: bank.id,
      statementIdentifier: 'LOCK-03-2026',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      openingBalance: 15000000,
      closingBalance: 15000000,
      fileContentRaw: 'Clean statement',
      lines: [],
    });

    const certified = await TreasuryDAO.certifyAndLockBankReconciliation(ctx, {
      accountId: bank.id,
      statementId: statement.id,
      notes: 'Certified clean by Head of Finance',
    });

    expect(certified.status).toBe(BRSStatus.LOCKED);
    expect(certified.reconciliationNumber).toMatch(/^BRS-\d{4}-\d{5}$/);
    expect(certified.certifiedById).toBe(userId);
  });
});
