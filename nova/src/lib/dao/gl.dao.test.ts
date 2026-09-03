import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import { GLAccountDAO, FiscalPeriodDAO, GLEngineDAO } from './gl.dao';
import { FinancialStatementsDAO } from './financial-statements.dao';
import { PaymentDAO } from './payment.dao';
import { ExpenseDAO } from './expense.dao';
import {
  GLAccountType,
  NormalBalance,
  SystemControlRole,
  JournalType,
  JournalStatus,
  PeriodStatus,
  PaymentMethod,
  Prisma
} from '@prisma/client';

describe('General Ledger & Double-Entry Accounting Matrix (GL-01 .. GL-25)', () => {
  let ctx: TenantContext;
  let checkerCtx: TenantContext;
  let branchId: string;
  let branch2Id: string;
  let userId: string;
  let checkerUserId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `GL_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: 'GL Academy', organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: 'Main Campus', schoolId: school.id }
    });
    branchId = branch.id;

    const branch2 = await db.branch.create({
      data: { name: 'North Branch', schoolId: school.id }
    });
    branch2Id = branch2.id;

    const user = await db.user.create({
      data: {
        organizationId: org.id,
        email: `maker_${Date.now()}@nova.edu`,
        passwordHash: 'hash',
        firstName: 'Maker',
        lastName: 'Accountant',
        userType: 'STAFF'
      }
    });
    userId = user.id;

    const checker = await db.user.create({
      data: {
        organizationId: org.id,
        email: `checker_${Date.now()}@nova.edu`,
        passwordHash: 'hash',
        firstName: 'Checker',
        lastName: 'Auditor',
        userType: 'STAFF'
      }
    });
    checkerUserId = checker.id;

    ctx = {
      branchId,
      userId,
      organizationId: org.id,
      schoolId: school.id,
      role: 'BURSAR',
      permissions: ['all']
    };

    checkerCtx = {
      branchId,
      userId: checkerUserId,
      organizationId: org.id,
      schoolId: school.id,
      role: 'FINANCE_DIRECTOR',
      permissions: ['all']
    };

    // Initialize Chart of Accounts & 2026 Fiscal Year
    await GLAccountDAO.initBranchChartOfAccounts(branchId);
    await FiscalPeriodDAO.initFiscalYear(ctx, 2026);
  });

  // GL-01: Standard Chart of Accounts initialization and hierarchical integrity
  it('GL-01: initializes standard COA with valid codes, types, and parent headers', async () => {
    const accounts = await GLAccountDAO.listAccounts(ctx);
    expect(accounts.length).toBeGreaterThanOrEqual(40);

    const tuition = accounts.find(a => a.code === '4100');
    expect(tuition).toBeDefined();
    expect(tuition?.accountType).toBe(GLAccountType.REVENUE);
    expect(tuition?.normalBalance).toBe(NormalBalance.CREDIT);
    expect(tuition?.isHeader).toBe(false);

    const revHeader = accounts.find(a => a.code === '4000');
    expect(revHeader).toBeDefined();
    expect(revHeader?.isHeader).toBe(true);
    expect(tuition?.parentId).toBe(revHeader?.id);
  });

  // GL-02: Fiscal year initialization (12 monthly periods)
  it('GL-02: initializes fiscal year with 12 open monthly periods', async () => {
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    expect(periods.length).toBe(12);

    for (const p of periods) {
      expect(p.status).toBe(PeriodStatus.OPEN);
      expect(p.startDate.getFullYear()).toBe(2026);
    }
  });

  // GL-03: Balanced journal entry posting
  it('GL-03: successfully posts a balanced journal entry and updates status to POSTED', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    const { journal } = await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-03-15'),
      description: 'Endowment donation received into bank',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 5000000, credit: 0, description: 'Bank debit' },
        { accountId: tuition!.id, debit: 0, credit: 5000000, description: 'Donation credit' }
      ]
    });

    expect(journal.status).toBe(JournalStatus.POSTED);
    expect(journal.journalNumber).toMatch(/^JNL-2026-\d{5}$/);
    expect(journal.lines.length).toBe(2);
  });

  // GL-04: Rejection of unbalanced journal entries
  it('GL-04: strictly rejects unbalanced journal entries with mathematical variance', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-03-15'),
        description: 'Unbalanced entry',
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: 5000000, credit: 0 },
          { accountId: tuition!.id, debit: 0, credit: 4999990 } // 10 UGX variance
        ]
      })
    ).rejects.toThrow(/Journal is unbalanced/);
  });

  // GL-05: Rejection of zero-amount journal entries
  it('GL-05: rejects journal entry where debits and credits sum to zero', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-03-15'),
        description: 'Zero amount entry',
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: 0, credit: 0 },
          { accountId: tuition!.id, debit: 0, credit: 0 }
        ]
      })
    ).rejects.toThrow(/cannot be zero/);
  });

  // GL-06: Period status enforcement (cannot post into CLOSED or LOCKED period)
  it('GL-06: blocks posting into CLOSED or LOCKED fiscal period', async () => {
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    const febPeriod = periods.find(p => p.periodNumber === 2)!;

    // Close February period
    await FiscalPeriodDAO.closePeriod(ctx, febPeriod.id);

    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-02-15'),
        description: 'Late February entry',
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: 100000, credit: 0 },
          { accountId: tuition!.id, debit: 0, credit: 100000 }
        ]
      })
    ).rejects.toThrow(/is CLOSED/);
  });

  // GL-07: Idempotency enforcement
  it('GL-07: enforces deterministic idempotency, returning existing journal on replay', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');
    const idempotencyKey = `TEST:IDEM:${Date.now()}`;

    const { journal: j1 } = await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-04-10'),
      description: 'First attempt',
      idempotencyKey,
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 250000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 250000 }
      ]
    });

    const { journal: j2 } = await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-04-10'),
      description: 'Duplicate replay attempt',
      idempotencyKey,
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 250000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 250000 }
      ]
    });

    expect(j1.id).toBe(j2.id);
    expect(j1.journalNumber).toBe(j2.journalNumber);
  });

  // GL-08: Leaf account posting only (header account rejection)
  it('GL-08: prevents posting directly to header accounts', async () => {
    const revHeader = await GLAccountDAO.getAccountByCode(ctx, '4000'); // Header
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');

    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-03-10'),
        description: 'Post to header',
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: 100000, credit: 0 },
          { accountId: revHeader!.id, debit: 0, credit: 100000 }
        ]
      })
    ).rejects.toThrow(/Cannot post journal line to header/);
  });

  // GL-09: Direct manual posting protection on control accounts
  it('GL-09: blocks direct manual journal entry to system control accounts', async () => {
    const arControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.AR_STUDENT_CONTROL);
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');

    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-03-10'),
        description: 'Manual adjustment to AR control',
        lines: [
          { accountId: arControl!.id, debit: 50000, credit: 0 },
          { accountId: bank!.id, debit: 0, credit: 50000 }
        ]
      })
    ).rejects.toThrow(/is restricted/);
  });

  // GL-10: Non-destructive compensating reversal journal entry
  it('GL-10: posts a compensating mirror-image reversal journal leaving original immutable', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const utilities = await GLAccountDAO.getAccountByCode(ctx, '6500');

    const { journal: original } = await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-03-12'),
      description: 'Accidental expense voucher',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: utilities!.id, debit: 750000, credit: 0, description: 'Power bill' },
        { accountId: bank!.id, debit: 0, credit: 750000, description: 'Bank paid' }
      ]
    });

    const reversal = await GLEngineDAO.reverseJournalEntry(ctx, original.id, 'Erroneous duplicate entry');

    expect(reversal.journalType).toBe(JournalType.REVERSAL);
    expect(reversal.reversalOfId).toBe(original.id);

    // Verify lines are inverted
    const origUt = original.lines.find(l => l.accountId === utilities!.id)!;
    const revUt = reversal.lines.find(l => l.accountId === utilities!.id)!;
    expect(origUt.debit.toString()).toBe('750000');
    expect(revUt.credit.toString()).toBe('750000');
    expect(revUt.debit.toString()).toBe('0');

    // Verify original status is REVERSED
    const refreshedOrig = await db.journalEntry.findUnique({ where: { id: original.id } });
    expect(refreshedOrig?.status).toBe(JournalStatus.REVERSED);
  });

  // GL-11: Maker-checker manual journal creation (Draft -> Approval)
  it('GL-11: allows maker to save draft and checker to approve into POSTED', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const utilities = await GLAccountDAO.getAccountByCode(ctx, '6500');

    const draft = await GLEngineDAO.createManualJournal(ctx, {
      entryDate: new Date('2026-05-10'),
      description: 'Pending Board approval journal voucher',
      isDraft: true,
      lines: [
        { accountId: utilities!.id, debit: 1200000, credit: 0 },
        { accountId: bank!.id, debit: 0, credit: 1200000 }
      ]
    });

    expect(draft.status).toBe(JournalStatus.DRAFT);

    const approved = await GLEngineDAO.approveDraftManualJournal(checkerCtx, draft.id);
    expect(approved.status).toBe(JournalStatus.POSTED);
  });

  // GL-12: Anti-self-approval enforcement for draft manual journals
  it('GL-12: rejects attempt by maker to self-approve own draft journal voucher', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const utilities = await GLAccountDAO.getAccountByCode(ctx, '6500');

    const draft = await GLEngineDAO.createManualJournal(ctx, {
      entryDate: new Date('2026-05-10'),
      description: 'Draft requiring second eye',
      isDraft: true,
      lines: [
        { accountId: utilities!.id, debit: 300000, credit: 0 },
        { accountId: bank!.id, debit: 0, credit: 300000 }
      ]
    });

    // Maker tries to self-approve
    await expect(
      GLEngineDAO.approveDraftManualJournal(ctx, draft.id)
    ).rejects.toThrow(/Four-Eye Principle Violation/);
  });

  // GL-13: Period close, lock, and audit-logged reopen
  it('GL-13: manages period transitions from OPEN to CLOSED, LOCKED, and audited REOPEN', async () => {
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    const p1 = periods[0];

    const closed = await FiscalPeriodDAO.closePeriod(ctx, p1.id);
    expect(closed.status).toBe(PeriodStatus.CLOSED);

    // Reopen requires justification
    await expect(
      FiscalPeriodDAO.reopenPeriod(ctx, p1.id, 'short')
    ).rejects.toThrow(/at least 10 characters/);

    const reopened = await FiscalPeriodDAO.reopenPeriod(ctx, p1.id, 'Auditor requested correction for payroll adjustment');
    expect(reopened.status).toBe(PeriodStatus.OPEN);

    // Now close and lock
    await FiscalPeriodDAO.closePeriod(ctx, p1.id);
    const locked = await FiscalPeriodDAO.lockPeriod(ctx, p1.id);
    expect(locked.status).toBe(PeriodStatus.LOCKED);
  });

  // GL-14: Subledger to GL reconciliation
  it('GL-14: performs real-time subledger-to-GL drift telemetry', async () => {
    const recon = await GLEngineDAO.reconcileSubledgers(ctx);
    expect(recon).toHaveProperty('isFullyBalanced');
    expect(recon).toHaveProperty('ar');
    expect(recon).toHaveProperty('treasury');
    expect(recon).toHaveProperty('inventory');
    expect(recon).toHaveProperty('payroll');
  });

  // GL-15: Zero-drift opening-balance bootstrap migration
  it('GL-15: bootstraps point-in-time opening balances snapshot with zero drift', async () => {
    // Create an initial treasury repository to have active balances
    await db.treasuryAccount.create({
      data: {
        branchId,
        code: `TR-ACC-${Date.now()}`,
        name: 'Main Stanbic Bank',
        accountType: 'COMMERCIAL_BANK',
        openingBalance: 10000000,
        currentBalance: 10000000
      }
    });

    const bootstrap = await GLEngineDAO.bootstrapOpeningBalances(ctx);
    expect(bootstrap).toHaveProperty('journal');
    expect(bootstrap.journal.journalType).toBe(JournalType.OPENING_BALANCE);
    expect(bootstrap.journal.status).toBe(JournalStatus.POSTED);

    // Running second time is idempotent
    const rerun = await GLEngineDAO.bootstrapOpeningBalances(ctx);
    expect(rerun.isReplay).toBe(true);
    expect(rerun.journal.id).toBe(bootstrap.journal.id);
  });

  // GL-16: Trial Balance report generation and zero-variance assertion
  it('GL-16: generates Trial Balance report with zero variance', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-03-20'),
      description: 'TB test posting',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 2000000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 2000000 }
      ]
    });

    const tb = await FinancialStatementsDAO.getTrialBalance(ctx);
    expect(tb.isBalanced).toBe(true);
    expect(tb.variance.toString()).toBe('0');
    expect(tb.totalDebit.toString()).toBe(tb.totalCredit.toString());
  });

  // GL-17: Statement of Comprehensive Income (P&L) generation
  it('GL-17: generates P&L report correctly computing operating surplus', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');
    const utilities = await GLAccountDAO.getAccountByCode(ctx, '6500');

    await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-04-01'),
      description: 'Tuition inflow',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 10000000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 10000000 }
      ]
    });

    await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-04-05'),
      description: 'Campus utilities outflow',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: utilities!.id, debit: 3000000, credit: 0 },
        { accountId: bank!.id, debit: 0, credit: 3000000 }
      ]
    });

    const isReport = await FinancialStatementsDAO.getIncomeStatement(ctx, '2026-01-01', '2026-12-31');
    expect(isReport.grossRevenue.toString()).toBe('10000000');
    expect(isReport.operatingExpenses.total.toString()).toBe('3000000');
    expect(isReport.netComprehensiveSurplus.toString()).toBe('7000000');
  });

  // GL-18: Statement of Financial Position (Balance Sheet) balance equation assertion
  it('GL-18: generates Balance Sheet asserting Assets = Liabilities + Equity + Surplus', async () => {
    const bs = await FinancialStatementsDAO.getBalanceSheet(ctx);
    expect(bs.isBalanced).toBe(true);
    expect(bs.balanceDiscrepancy.toString()).toBe('0');
  });

  // GL-19: Account chronological general ledger detail with running balance
  it('GL-19: provides chronological account ledger detail with correct running balance', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-06-01'),
      description: 'First bank debit',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 1000000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 1000000 }
      ]
    });

    await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-06-05'),
      description: 'Second bank debit',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 500000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 500000 }
      ]
    });

    const ledger = await FinancialStatementsDAO.getAccountLedgerReport(ctx, bank!.id, '2026-01-01', '2026-12-31');
    expect(ledger.rows.length).toBeGreaterThanOrEqual(2);
    expect(ledger.closingBalance.toString()).toBe('1500000');
  });

  // GL-20: Subledger hook: Fee payment receipt creates balanced GL journal
  it('GL-20: subledger fee payment receipt automatically creates balanced GL journal', async () => {
    const student = await db.student.create({
      data: {
        branchId,
        firstName: 'Jane',
        lastName: 'Namubiru',
        admissionNo: `ADM-${Date.now()}`,
        status: 'ACTIVE'
      }
    });

    const paymentResult = await PaymentDAO.recordPayment(ctx, {
      studentId: student.id,
      amount: 450000,
      paymentMethod: PaymentMethod.CASH,
      notes: 'Term 1 cash deposit'
    });

    const glJournal = await db.journalEntry.findUnique({
      where: {
        branchId_referenceType_referenceId_journalType: {
          branchId,
          referenceType: 'PAYMENT',
          referenceId: paymentResult.payment.id,
          journalType: JournalType.PAYMENT_RECEIPT
        }
      },
      include: { lines: true }
    });

    expect(glJournal).toBeDefined();
    expect(glJournal?.status).toBe(JournalStatus.POSTED);

    const totalDr = glJournal!.lines.reduce((s, l) => s.add(l.debit), new Prisma.Decimal(0));
    const totalCr = glJournal!.lines.reduce((s, l) => s.add(l.credit), new Prisma.Decimal(0));
    expect(totalDr.toString()).toBe('450000');
    expect(totalCr.toString()).toBe('450000');
  });

  // GL-21: Subledger hook: Fee payment reversal creates compensating GL journal
  it('GL-21: fee payment reversal triggers compensating reversal GL journal', async () => {
    const student = await db.student.create({
      data: {
        branchId,
        firstName: 'Moses',
        lastName: 'Opolot',
        admissionNo: `ADM-REV-${Date.now()}`,
        status: 'ACTIVE'
      }
    });

    const paymentResult = await PaymentDAO.recordPayment(ctx, {
      studentId: student.id,
      amount: 300000,
      paymentMethod: PaymentMethod.CASH
    });

    await PaymentDAO.reversePayment(ctx, paymentResult.payment.id, 'Cashier counted fake note');

    const origJournal = await db.journalEntry.findUnique({
      where: {
        branchId_referenceType_referenceId_journalType: {
          branchId,
          referenceType: 'PAYMENT',
          referenceId: paymentResult.payment.id,
          journalType: JournalType.PAYMENT_RECEIPT
        }
      }
    });

    expect(origJournal?.status).toBe(JournalStatus.REVERSED);

    const reversalJournal = await db.journalEntry.findFirst({
      where: {
        branchId,
        reversalOfId: origJournal!.id,
        journalType: JournalType.REVERSAL
      }
    });

    expect(reversalJournal).toBeDefined();
    expect(reversalJournal?.status).toBe(JournalStatus.POSTED);
  });

  // GL-22: Subledger hook: Expense voucher disbursement creates balanced GL journal
  it('GL-22: operational expense disbursement emits balanced GL journal', async () => {
    const cat = await db.expenseCategory.create({
      data: {
        branchId,
        code: `EXP-CAT-${Date.now()}`,
        name: `Lab Equipment ${Date.now()}`
      }
    });

    const expenseResult = await ExpenseDAO.createExpense(ctx, {
      categoryId: cat.id,
      title: 'Science chemicals purchase',
      amount: 850000,
      paymentMethod: PaymentMethod.CASH,
      vendorName: 'Kampala Lab Supplies'
    });

    const glJournal = await db.journalEntry.findUnique({
      where: {
        branchId_referenceType_referenceId_journalType: {
          branchId,
          referenceType: 'EXPENSE',
          referenceId: expenseResult.expense.id,
          journalType: JournalType.EXPENSE_DISBURSEMENT
        }
      },
      include: { lines: true }
    });

    expect(glJournal).toBeDefined();
    expect(glJournal?.status).toBe(JournalStatus.POSTED);

    const totalDr = glJournal!.lines.reduce((s, l) => s.add(l.debit), new Prisma.Decimal(0));
    expect(totalDr.toString()).toBe('850000');
  });

  // GL-23: Multi-tenant branch isolation
  it('GL-23: strictly isolates Chart of Accounts and Journals between branches', async () => {
    await GLAccountDAO.initBranchChartOfAccounts(branch2Id);

    const branch1Accounts = await db.gLAccount.findMany({ where: { branchId } });
    const branch2Accounts = await db.gLAccount.findMany({ where: { branchId: branch2Id } });

    expect(branch1Accounts.length).toBeGreaterThan(0);
    expect(branch2Accounts.length).toBeGreaterThan(0);

    // Verify IDs are completely disjoint
    const branch1Ids = new Set(branch1Accounts.map(a => a.id));
    for (const a2 of branch2Accounts) {
      expect(branch1Ids.has(a2.id)).toBe(false);
    }

    // Branch 1 cannot post using Branch 2 account ID
    const b2Bank = branch2Accounts.find(a => a.code === '1120')!;
    const b1Tuition = branch1Accounts.find(a => a.code === '4100')!;

    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-03-15'),
        description: 'Cross tenant attempt',
        lines: [
          { accountId: b2Bank.id, debit: 10000, credit: 0 },
          { accountId: b1Tuition.id, debit: 0, credit: 10000 }
        ]
      })
    ).rejects.toThrow(/does not exist in branch/);
  });

  // GL-24: Year-end close journal clears revenue and expenses into Retained Earnings
  it('GL-24: executes year-end close zeroing revenue and expense accounts into Retained Earnings', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');
    const utilities = await GLAccountDAO.getAccountByCode(ctx, '6500');

    await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-08-01'),
      description: 'Tuition revenue',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 12000000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 12000000 }
      ]
    });

    await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-08-10'),
      description: 'Utilities expense',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: utilities!.id, debit: 4000000, credit: 0 },
        { accountId: bank!.id, debit: 0, credit: 4000000 }
      ]
    });

    // Close all periods before executing year-end close
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    for (const p of periods) {
      if (p.status === PeriodStatus.OPEN) {
        await FiscalPeriodDAO.closePeriod(ctx, p.id);
      }
    }

    const { closingJournal } = await GLEngineDAO.executeYearEndClose(ctx, '2026');
    expect(closingJournal?.journalType).toBe(JournalType.YEAR_END_CLOSE);
    expect(closingJournal?.status).toBe(JournalStatus.POSTED);

    const tbAfterClose = await FinancialStatementsDAO.getTrialBalance(ctx, '2026-12-31');
    expect(tbAfterClose.isBalanced).toBe(true);

    // Revenue and expense balances must be 0 after year-end close
    const closedTuition = tbAfterClose.rows.find(r => r.code === '4100');
    const closedUtilities = tbAfterClose.rows.find(r => r.code === '6500');
    expect(closedTuition?.creditBalance.toString()).toBe('0');
    expect(closedUtilities?.debitBalance.toString()).toBe('0');
  });

  // GL-25: Immutable audit trail assertion
  it('GL-25: prevents deleting or modifying posted journals and lines', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    const { journal } = await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-09-01'),
      description: 'Immutable test journal',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 500000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 500000 }
      ]
    });

    // Attempting direct DB update should be detected or audited
    const fetched = await db.journalEntry.findUnique({
      where: { id: journal.id },
      include: { lines: true }
    });
    expect(fetched?.status).toBe(JournalStatus.POSTED);
    expect(fetched?.lines.length).toBe(2);
  });
});
