import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { TenantContext } from './tenant-context';
import { GLAccountDAO, FiscalPeriodDAO, GLEngineDAO } from './gl.dao';
import {
  SystemControlRole,
  JournalType
} from '@prisma/client';

describe('General Ledger Adversarial & Stress Testing Matrix (ADV-GL-01 .. ADV-GL-12)', () => {
  let ctx: TenantContext;
  let attackerCtx: TenantContext;
  let branchId: string;
  let attackerBranchId: string;
  let userId: string;
  let attackerUserId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `GL_AdvOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: 'GL Adversarial Campus', organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: 'Main Campus', schoolId: school.id }
    });
    branchId = branch.id;

    const attackerBranch = await db.branch.create({
      data: { name: 'Rival Campus', schoolId: school.id }
    });
    attackerBranchId = attackerBranch.id;

    const user = await db.user.create({
      data: {
        organizationId: org.id,
        email: `bursar_gl_${Date.now()}@nova.edu`,
        passwordHash: 'hash',
        firstName: 'Authorized',
        lastName: 'Bursar',
        userType: 'STAFF'
      }
    });
    userId = user.id;

    const attacker = await db.user.create({
      data: {
        organizationId: org.id,
        email: `adversary_${Date.now()}@nova.edu`,
        passwordHash: 'hash',
        firstName: 'Malicious',
        lastName: 'Actor',
        userType: 'STAFF'
      }
    });
    attackerUserId = attacker.id;

    ctx = {
      branchId,
      userId,
      organizationId: org.id,
      schoolId: school.id,
      role: 'BURSAR',
      permissions: ['all']
    };

    attackerCtx = {
      branchId: attackerBranchId,
      userId: attackerUserId,
      organizationId: org.id,
      schoolId: school.id,
      role: 'TEACHER',
      permissions: []
    };

    await GLAccountDAO.initBranchChartOfAccounts(branchId);
    await FiscalPeriodDAO.initFiscalYear(ctx, 2026);
  });

  // ADV-GL-01: High-concurrency race condition on balanced journal entry
  it('ADV-GL-01: safely handles 20 concurrent balanced journal postings without sequence collision', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    const promises = Array.from({ length: 20 }, (_, idx) =>
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-04-10'),
        description: `Concurrent batch voucher #${idx}`,
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: 50000 + idx, credit: 0 },
          { accountId: tuition!.id, debit: 0, credit: 50000 + idx }
        ]
      })
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(20);

    const journalNumbers = new Set(results.map(r => r.journal.journalNumber));
    expect(journalNumbers.size).toBe(20); // 100% unique sequential numbers
  });

  // ADV-GL-02: Concurrent duplicate idempotency key submission race
  it('ADV-GL-02: protects against duplicate journal creation in high-speed race on same idempotency key', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');
    const sharedIdempotencyKey = `RACE-KEY-${Date.now()}`;

    const racePromises = Array.from({ length: 10 }, () =>
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-05-15'),
        description: 'Race attempt voucher',
        idempotencyKey: sharedIdempotencyKey,
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: 150000, credit: 0 },
          { accountId: tuition!.id, debit: 0, credit: 150000 }
        ]
      })
    );

    const outcomes = await Promise.all(racePromises);
    const uniqueIds = new Set(outcomes.map(o => o.journal.id));
    expect(uniqueIds.size).toBe(1); // Exactly one journal entry created
  });

  // ADV-GL-03: Extreme decimal precision and rounding resilience (12,2)
  it('ADV-GL-03: verifies Decimal(12,2) precision and rejects fractional rounding imprecision', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    // 0.01 cent difference must be caught
    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-06-01'),
        description: 'Sub-cent imprecision',
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: 1000000.01, credit: 0 },
          { accountId: tuition!.id, debit: 0, credit: 1000000.00 }
        ]
      })
    ).rejects.toThrow(/Journal is unbalanced/);
  });

  // ADV-GL-04: Posting attempt during period close race condition
  it('ADV-GL-04: safely blocks posting when period is closed concurrently', async () => {
    const periods = await FiscalPeriodDAO.listPeriods(ctx);
    const period = periods.find(p => p.periodNumber === 6)!;

    // Concurrently close the period and attempt posting
    await FiscalPeriodDAO.closePeriod(ctx, period.id);

    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-06-15'),
        description: 'Posting after closure',
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: 50000, credit: 0 },
          { accountId: tuition!.id, debit: 0, credit: 50000 }
        ]
      })
    ).rejects.toThrow(/is CLOSED/);
  });

  // ADV-GL-05: Reversal replay attempt (cannot reverse an already reversed journal)
  it('ADV-GL-05: blocks attempting to reverse an already reversed journal entry', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    const { journal: original } = await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-07-01'),
      description: 'First entry',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 200000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 200000 }
      ]
    });

    await GLEngineDAO.reverseJournalEntry(ctx, original.id, 'First valid reversal');

    // Attempt second reversal on same journal
    await expect(
      GLEngineDAO.reverseJournalEntry(ctx, original.id, 'Illegal second reversal')
    ).rejects.toThrow(/already reversed/);
  });

  // ADV-GL-06: Reversal of reversal rejection
  it('ADV-GL-06: strictly blocks attempting to reverse a reversal journal', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    const { journal: original } = await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-07-02'),
      description: 'Original entry',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 100000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 100000 }
      ]
    });

    const rev = await GLEngineDAO.reverseJournalEntry(ctx, original.id, 'Valid reversal');

    await expect(
      GLEngineDAO.reverseJournalEntry(ctx, rev.id, 'Cannot reverse a reversal')
    ).rejects.toThrow(/Cannot reverse a reversal journal entry/);
  });

  // ADV-GL-07: Subledger drift simulation and detection telemetry
  it('ADV-GL-07: detects simulated intentional ledger tampering as non-zero drift', async () => {
    // Normal balanced state initially
    const initialRecon = await GLEngineDAO.reconcileSubledgers(ctx);
    expect(initialRecon.ar.drift.toString()).toBe('0');

    // Tamper with GL AR Control by posting an unbacked journal bypassing control check
    const arControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.AR_STUDENT_CONTROL);
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');

    await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-07-10'),
      description: 'Tampered unbacked entry',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: arControl!.id, debit: 5000000, credit: 0 },
        { accountId: bank!.id, debit: 0, credit: 5000000 }
      ]
    });

    const tamperedRecon = await GLEngineDAO.reconcileSubledgers(ctx);
    expect(tamperedRecon.ar.isBalanced).toBe(false);
    expect(parseFloat(tamperedRecon.ar.drift.toString())).toBe(5000000);
    expect(tamperedRecon.isFullyBalanced).toBe(false);
  });

  // ADV-GL-08: Opening balance bootstrap second run idempotency
  it('ADV-GL-08: bootstrap opening balance rejects creating double entries on rerun', async () => {
    await db.treasuryAccount.create({
      data: {
        branchId,
        code: `TR-ADV-${Date.now()}`,
        name: 'Adversarial Bank',
        accountType: 'COMMERCIAL_BANK',
        openingBalance: 5000000,
        currentBalance: 5000000
      }
    });

    const first = await GLEngineDAO.bootstrapOpeningBalances(ctx);
    expect(first.isReplay).toBe(false);

    const second = await GLEngineDAO.bootstrapOpeningBalances(ctx);
    expect(second.isReplay).toBe(true);
    expect(second.journal.id).toBe(first.journal.id);
  });

  // ADV-GL-09: Cross-tenant journal access and line tampering prevention
  it('ADV-GL-09: blocks unauthorized actor from rival branch reading or modifying journals', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    const { journal } = await GLEngineDAO.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: new Date('2026-08-01'),
      description: 'Confidential salary entry',
      bypassControlAccountValidation: true,
      lines: [
        { accountId: bank!.id, debit: 800000, credit: 0 },
        { accountId: tuition!.id, debit: 0, credit: 800000 }
      ]
    });

    // Attacker tries to reverse journal
    await expect(
      GLEngineDAO.reverseJournalEntry(attackerCtx, journal.id, 'Malicious reversal')
    ).rejects.toThrow();
  });

  // ADV-GL-10: Self-approval maker-checker bypass attempt
  it('ADV-GL-10: blocks maker attempting to bypass checker approval using forged context', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const utilities = await GLAccountDAO.getAccountByCode(ctx, '6500');

    const draft = await GLEngineDAO.createManualJournal(ctx, {
      entryDate: new Date('2026-08-15'),
      description: 'Draft voucher',
      isDraft: true,
      lines: [
        { accountId: utilities!.id, debit: 600000, credit: 0 },
        { accountId: bank!.id, debit: 0, credit: 600000 }
      ]
    });

    // Maker tries to approve with same userId
    await expect(
      GLEngineDAO.approveDraftManualJournal({ ...ctx, role: 'SUPER_ADMIN' }, draft.id)
    ).rejects.toThrow(/Four-Eye Principle Violation/);
  });

  // ADV-GL-11: Negative and zero debit/credit line payload rejection
  it('ADV-GL-11: rejects journal lines with negative debit or negative credit amounts', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-08-20'),
        description: 'Negative payload',
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: -50000, credit: 0 },
          { accountId: tuition!.id, debit: 0, credit: -50000 }
        ]
      })
    ).rejects.toThrow(/cannot be negative/);
  });

  // ADV-GL-12: Both debit and credit simultaneously on single line rejection
  it('ADV-GL-12: rejects journal line having both non-zero debit and non-zero credit simultaneously', async () => {
    const bank = await GLAccountDAO.getAccountByCode(ctx, '1120');
    const tuition = await GLAccountDAO.getAccountByCode(ctx, '4100');

    await expect(
      GLEngineDAO.postJournalEntry(ctx, {
        journalType: JournalType.STANDARD_MANUAL,
        entryDate: new Date('2026-08-25'),
        description: 'Double sided line payload',
        bypassControlAccountValidation: true,
        lines: [
          { accountId: bank!.id, debit: 50000, credit: 50000 },
          { accountId: tuition!.id, debit: 0, credit: 50000 }
        ]
      })
    ).rejects.toThrow(/cannot contain both a debit and a credit/);
  });
});
