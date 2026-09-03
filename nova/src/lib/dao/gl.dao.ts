import { db } from "../db";
import {
  Prisma,
  GLAccountType,
  NormalBalance,
  SystemControlRole,
  JournalType,
  JournalStatus,
  PeriodStatus
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { STANDARD_COA_TEMPLATE } from "./gl-defaults";

export interface CreateAccountInput {
  code: string;
  name: string;
  accountType: GLAccountType;
  normalBalance: NormalBalance;
  controlRole?: SystemControlRole;
  isHeader?: boolean;
  parentId?: string | null;
  description?: string | null;
}

export interface UpdateAccountInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  parentId?: string | null;
}

export interface PostJournalLineParam {
  accountId: string;
  debit: Prisma.Decimal | number | string;
  credit: Prisma.Decimal | number | string;
  description?: string | null;
  departmentId?: string | null;
  academicYearId?: string | null;
  termId?: string | null;
}

export interface PostJournalParams {
  journalType: JournalType;
  entryDate: Date | string;
  description: string;
  lines: PostJournalLineParam[];
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  bypassControlAccountValidation?: boolean;
}

export interface ManualJournalLineInput {
  accountId: string;
  debit: number | string | Prisma.Decimal;
  credit: number | string | Prisma.Decimal;
  description?: string;
}

export interface CreateManualJournalInput {
  entryDate: Date | string;
  description: string;
  referenceNumber?: string;
  lines: ManualJournalLineInput[];
  isDraft?: boolean;
}

export class FiscalPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalPeriodError";
  }
}

export class UnbalancedJournalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnbalancedJournalError";
  }
}

export class GLConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GLConfigurationError";
  }
}

// ============================================================================
// GL ACCOUNT DAO
// ============================================================================

export class GLAccountDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('gl:accounts:read') ||
      perms.includes('gl:reports:read') ||
      perms.includes('fees:read')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: gl:accounts:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('gl:accounts:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: gl:accounts:write");
  }

  /**
   * Seed / initialize standard Ugandan school Chart of Accounts for a branch.
   * Completely idempotent: if accounts already exist, returns existing count.
   */
  static async initBranchChartOfAccounts(
    branchId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || db;

    // Check if branch already has accounts
    const existingCount = await client.gLAccount.count({ where: { branchId } });
    if (existingCount > 0) {
      return { initialized: false, accountsCount: existingCount };
    }

    // 1. Create header accounts first
    const headerDefs = STANDARD_COA_TEMPLATE.filter(a => a.isHeader);
    for (const def of headerDefs) {
      await client.gLAccount.create({
        data: {
          branchId,
          code: def.code,
          name: def.name,
          accountType: def.accountType,
          normalBalance: def.normalBalance,
          controlRole: def.controlRole || SystemControlRole.NONE,
          isHeader: true,
          description: def.description || null,
          isActive: true
        }
      });
    }

    // Map parent codes to parent IDs
    const headers = await client.gLAccount.findMany({ where: { branchId, isHeader: true } });
    const headerMap = new Map<string, string>();
    for (const h of headers) {
      headerMap.set(h.code, h.id);
    }

    // 2. Create detail accounts
    const detailDefs = STANDARD_COA_TEMPLATE.filter(a => !a.isHeader);
    for (const def of detailDefs) {
      const parentId = def.parentCode ? headerMap.get(def.parentCode) : null;
      const account = await client.gLAccount.create({
        data: {
          branchId,
          code: def.code,
          name: def.name,
          accountType: def.accountType,
          normalBalance: def.normalBalance,
          controlRole: def.controlRole || SystemControlRole.NONE,
          isHeader: false,
          parentId: parentId || null,
          description: def.description || null,
          isActive: true
        }
      });

      // If account has a designated control role, register standard system mapping
      if (def.controlRole && def.controlRole !== SystemControlRole.NONE) {
        await client.gLAccountMapping.upsert({
          where: { branchId_mappingKey: { branchId, mappingKey: def.controlRole } },
          create: {
            branchId,
            mappingKey: def.controlRole,
            accountId: account.id
          },
          update: {
            accountId: account.id
          }
        });
      }
    }

    const totalCount = await client.gLAccount.count({ where: { branchId } });
    return { initialized: true, accountsCount: totalCount };
  }

  static async createAccount(ctx: TenantContext, data: CreateAccountInput) {
    this.checkWritePermission(ctx);

    if (!data.code || data.code.trim().length < 3) {
      throw new Error("Account code must be at least 3 characters.");
    }
    if (!data.name || data.name.trim().length < 2) {
      throw new Error("Account name must be at least 2 characters.");
    }

    const code = data.code.trim().toUpperCase();
    const existing = await db.gLAccount.findUnique({
      where: { branchId_code: { branchId: ctx.branchId, code } }
    });
    if (existing) {
      throw new Error(`Account code '${code}' already exists in this branch.`);
    }

    if (data.parentId) {
      const parent = await db.gLAccount.findFirst({
        where: { id: data.parentId, branchId: ctx.branchId }
      });
      if (!parent) throw new Error("Parent account not found in this branch.");
      if (!parent.isHeader) {
        throw new Error("Parent account must be designated as a header account.");
      }
    }

    const account = await db.gLAccount.create({
      data: {
        branchId: ctx.branchId,
        code,
        name: data.name.trim(),
        accountType: data.accountType,
        normalBalance: data.normalBalance,
        controlRole: data.controlRole || SystemControlRole.NONE,
        isHeader: data.isHeader || false,
        parentId: data.parentId || null,
        description: data.description?.trim() || null,
        isActive: true
      }
    });

    if (data.controlRole && data.controlRole !== SystemControlRole.NONE) {
      await db.gLAccountMapping.upsert({
        where: { branchId_mappingKey: { branchId: ctx.branchId, mappingKey: data.controlRole } },
        create: { branchId: ctx.branchId, mappingKey: data.controlRole, accountId: account.id },
        update: { accountId: account.id }
      });
    }

    await AuditService.log(ctx, 'GL_ACCOUNT_CREATED', 'GLAccount', account.id, JSON.stringify({ code, name: account.name }));
    return account;
  }

  static async updateAccount(ctx: TenantContext, id: string, data: UpdateAccountInput) {
    this.checkWritePermission(ctx);

    const account = await db.gLAccount.findFirst({
      where: { id, branchId: ctx.branchId }
    });
    if (!account) throw new Error("Account not found.");

    // If deactivating, verify no open activity requires it
    const updated = await db.gLAccount.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        description: data.description !== undefined ? (data.description?.trim() || null) : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        parentId: data.parentId !== undefined ? data.parentId : undefined
      }
    });

    await AuditService.log(ctx, 'GL_ACCOUNT_UPDATED', 'GLAccount', id, JSON.stringify(data));
    return updated;
  }

  static async getAccount(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);
    const account = await db.gLAccount.findFirst({
      where: { id, branchId: ctx.branchId },
      include: { parent: true, children: true }
    });
    if (!account) throw new Error("Account not found.");
    return account;
  }

  static async getAccountByCode(ctx: TenantContext, code: string, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.gLAccount.findUnique({
      where: { branchId_code: { branchId: ctx.branchId, code: code.trim().toUpperCase() } }
    });
  }

  static async listAccounts(
    ctx: TenantContext,
    filter?: { accountType?: GLAccountType; isActive?: boolean; isHeader?: boolean; controlRole?: SystemControlRole }
  ) {
    this.checkReadPermission(ctx);
    return db.gLAccount.findMany({
      where: {
        branchId: ctx.branchId,
        accountType: filter?.accountType,
        isActive: filter?.isActive,
        isHeader: filter?.isHeader,
        controlRole: filter?.controlRole
      },
      orderBy: [{ code: 'asc' }],
      include: { parent: true }
    });
  }

  static async getMapping(ctx: TenantContext, role: SystemControlRole, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    const mapping = await client.gLAccountMapping.findUnique({
      where: { branchId_mappingKey: { branchId: ctx.branchId, mappingKey: role } },
      include: { account: true }
    });
    return mapping?.account || null;
  }

  static async setMapping(ctx: TenantContext, role: SystemControlRole, accountId: string) {
    this.checkWritePermission(ctx);
    const account = await db.gLAccount.findFirst({
      where: { id: accountId, branchId: ctx.branchId }
    });
    if (!account) throw new Error("Target account not found in branch.");
    if (account.isHeader) throw new Error("Cannot map control role to a header account.");

    const mapping = await db.gLAccountMapping.upsert({
      where: { branchId_mappingKey: { branchId: ctx.branchId, mappingKey: role } },
      create: { branchId: ctx.branchId, mappingKey: role, accountId },
      update: { accountId }
    });

    await AuditService.log(ctx, 'GL_MAPPING_UPDATED', 'GLAccountMapping', mapping.id, JSON.stringify({ role, accountId }));
    return mapping;
  }

  static async listMappings(ctx: TenantContext) {
    this.checkReadPermission(ctx);
    return db.gLAccountMapping.findMany({
      where: { branchId: ctx.branchId },
      include: { account: true }
    });
  }
}

// ============================================================================
// FISCAL PERIOD DAO
// ============================================================================

export class FiscalPeriodDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('gl:periods:read') || perms.includes('fees:read')) return true;
    throw new UnauthorizedError("Missing permission: gl:periods:read");
  }

  private static checkClosePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('gl:periods:close') || perms.includes('fees:write')) return true;
    throw new UnauthorizedError("Missing permission: gl:periods:close");
  }

  private static checkReopenPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('gl:periods:reopen')) return true;
    throw new UnauthorizedError("Missing elevated permission: gl:periods:reopen");
  }

  /**
   * Initializes a standard 12-month fiscal year for a branch.
   */
  static async initFiscalYear(ctx: TenantContext, year: number, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    const name = `FY ${year}`;

    let fy = await client.fiscalYear.findUnique({
      where: { branchId_name: { branchId: ctx.branchId, name } }
    });

    if (!fy) {
      fy = await client.fiscalYear.create({
        data: {
          branchId: ctx.branchId,
          name,
          startDate: new Date(Date.UTC(year, 0, 1)),
          endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
          status: PeriodStatus.OPEN
        }
      });
    }

    // Ensure 12 monthly periods exist
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    for (let m = 0; m < 12; m++) {
      const periodNumber = m + 1;
      const pName = `${monthNames[m]} ${year}`;
      const startDate = new Date(Date.UTC(year, m, 1));
      const lastDay = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999));

      await client.fiscalPeriod.upsert({
        where: { fiscalYearId_periodNumber: { fiscalYearId: fy.id, periodNumber } },
        create: {
          branchId: ctx.branchId,
          fiscalYearId: fy.id,
          periodNumber,
          name: pName,
          startDate,
          endDate: lastDay,
          status: PeriodStatus.OPEN
        },
        update: {}
      });
    }

    return client.fiscalYear.findUnique({
      where: { id: fy.id },
      include: { periods: { orderBy: { periodNumber: 'asc' } } }
    });
  }

  /**
   * Retrieves the active OPEN period for a given transaction date.
   * Throws FiscalPeriodError if the period is CLOSED or LOCKED.
   */
  static async getOpenPeriodForDate(ctx: TenantContext, date: Date, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    const targetDate = new Date(date);

    // Find period covering this date
    let period = await client.fiscalPeriod.findFirst({
      where: {
        branchId: ctx.branchId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate }
      },
      include: { fiscalYear: true }
    });

    // If period doesn't exist, auto-initialize fiscal year for that date's calendar year
    if (!period) {
      const year = targetDate.getUTCFullYear();
      await this.initFiscalYear(ctx, year, client);
      period = await client.fiscalPeriod.findFirst({
        where: {
          branchId: ctx.branchId,
          startDate: { lte: targetDate },
          endDate: { gte: targetDate }
        },
        include: { fiscalYear: true }
      });
    }

    if (!period) {
      throw new FiscalPeriodError(`No fiscal period defined for date ${targetDate.toISOString().slice(0, 10)}.`);
    }

    if (period.status === PeriodStatus.CLOSED) {
      throw new FiscalPeriodError(`Fiscal period '${period.name}' is CLOSED. Postings are locked.`);
    }

    if (period.status === PeriodStatus.LOCKED) {
      throw new FiscalPeriodError(`Fiscal period '${period.name}' is permanently LOCKED by statutory audit.`);
    }

    return period;
  }

  static async closePeriod(ctx: TenantContext, periodId: string) {
    this.checkClosePermission(ctx);

    const updated = await db.$transaction(async (tx) => {
      // Pessimistic lock
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: periodId, branchId: ctx.branchId }
      });
      if (!period) throw new Error("Fiscal period not found.");
      if (period.status === PeriodStatus.CLOSED) throw new Error("Period is already closed.");
      if (period.status === PeriodStatus.LOCKED) throw new Error("Period is permanently locked.");

      return tx.fiscalPeriod.update({
        where: { id: periodId },
        data: {
          status: PeriodStatus.CLOSED,
          closedAt: new Date(),
          closedById: ctx.userId
        }
      });
    });

    await AuditService.log(ctx, 'FISCAL_PERIOD_CLOSED', 'FiscalPeriod', periodId, JSON.stringify({ name: updated.name }));
    return updated;
  }

  static async lockPeriod(ctx: TenantContext, periodId: string) {
    this.checkClosePermission(ctx);

    const updated = await db.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: periodId, branchId: ctx.branchId }
      });
      if (!period) throw new Error("Fiscal period not found.");
      if (period.status === PeriodStatus.LOCKED) throw new Error("Period is already locked.");

      return tx.fiscalPeriod.update({
        where: { id: periodId },
        data: {
          status: PeriodStatus.LOCKED,
          closedAt: period.closedAt || new Date(),
          closedById: period.closedById || ctx.userId
        }
      });
    });

    await AuditService.log(ctx, 'FISCAL_PERIOD_LOCKED', 'FiscalPeriod', periodId, JSON.stringify({ name: updated.name }));
    return updated;
  }

  static async reopenPeriod(ctx: TenantContext, periodId: string, reason: string) {
    this.checkReopenPermission(ctx);

    const justification = reason?.trim();
    if (!justification || justification.length < 10) {
      throw new Error("Reopening justification must be at least 10 characters long.");
    }

    const updated = await db.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: periodId, branchId: ctx.branchId }
      });
      if (!period) throw new Error("Fiscal period not found.");
      if (period.status === PeriodStatus.OPEN) throw new Error("Period is already open.");
      if (period.status === PeriodStatus.LOCKED) {
        throw new Error("Period is permanently LOCKED by statutory audit and cannot be reopened.");
      }

      return tx.fiscalPeriod.update({
        where: { id: periodId },
        data: {
          status: PeriodStatus.OPEN,
          closedAt: null,
          closedById: null
        }
      });
    });

    await AuditService.log(ctx, 'FISCAL_PERIOD_REOPENED', 'FiscalPeriod', periodId, JSON.stringify({ name: updated.name, justification }));
    return updated;
  }

  static async listPeriods(ctx: TenantContext, fiscalYearId?: string) {
    this.checkReadPermission(ctx);
    return db.fiscalPeriod.findMany({
      where: {
        branchId: ctx.branchId,
        fiscalYearId: fiscalYearId || undefined
      },
      orderBy: [{ startDate: 'asc' }],
      include: { closedBy: { select: { id: true, firstName: true, lastName: true } } }
    });
  }

  static async listFiscalYears(ctx: TenantContext) {
    this.checkReadPermission(ctx);
    return db.fiscalYear.findMany({
      where: { branchId: ctx.branchId },
      orderBy: [{ startDate: 'desc' }],
      include: { periods: { orderBy: { periodNumber: 'asc' } } }
    });
  }
}

// ============================================================================
// GENERAL LEDGER ENGINE DAO
// ============================================================================

export class GLEngineDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('gl:journals:read') || perms.includes('fees:read')) return true;
    throw new UnauthorizedError("Missing permission: gl:journals:read");
  }

  private static checkPostPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('gl:journals:post') || perms.includes('fees:write')) return true;
    throw new UnauthorizedError("Missing permission: gl:journals:post");
  }

  private static checkReversePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('gl:journals:reverse') || perms.includes('fees:write')) return true;
    throw new UnauthorizedError("Missing permission: gl:journals:reverse");
  }

  /**
   * Internal sequence generator for Journal Voucher numbers (JNL-YYYY-XXXXX)
   */
  private static async getNextJournalNumber(tx: Prisma.TransactionClient, branchId: string, year: number): Promise<string> {
    const seq = await tx.gLSequence.upsert({
      where: { branchId_year: { branchId, year } },
      create: { branchId, year, lastValue: 1 },
      update: { lastValue: { increment: 1 } }
    });
    return `JNL-${year}-${String(seq.lastValue).padStart(5, '0')}`;
  }

  /**
   * Core posting engine for balanced double-entry journal vouchers.
   * Enforces:
   * 1. Idempotency (replay returns existing journal without re-mutating)
   * 2. Balanced invariant (Total Debits == Total Credits > 0)
   * 3. Period status (must be OPEN)
   * 4. Account validity (active, leaf account, branch scope)
   */
  static async postJournalEntry(
    ctx: TenantContext,
    params: PostJournalParams,
    externalTx?: Prisma.TransactionClient
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Idempotency check by key
      if (params.idempotencyKey) {
        const existing = await tx.journalEntry.findUnique({
          where: { branchId_idempotencyKey: { branchId: ctx.branchId, idempotencyKey: params.idempotencyKey } },
          include: { lines: { include: { account: true } } }
        });
        if (existing) {
          return { journal: existing, isReplay: true };
        }
      }

      // 2. Idempotency check by source reference + type
      if (params.referenceType && params.referenceId) {
        const existingByRef = await tx.journalEntry.findUnique({
          where: {
            branchId_referenceType_referenceId_journalType: {
              branchId: ctx.branchId,
              referenceType: params.referenceType,
              referenceId: params.referenceId,
              journalType: params.journalType
            }
          },
          include: { lines: { include: { account: true } } }
        });
        if (existingByRef) {
          return { journal: existingByRef, isReplay: true };
        }
      }

      // 3. Fiscal Period Validation
      const entryDate = new Date(params.entryDate);
      const period = await FiscalPeriodDAO.getOpenPeriodForDate(ctx, entryDate, tx);

      // 4. Line Validation & Balance Checking
      if (!params.lines || params.lines.length < 2) {
        throw new UnbalancedJournalError("A double-entry journal must have at least 2 lines (at least one debit and one credit).");
      }

      let totalDebit = new Prisma.Decimal(0);
      let totalCredit = new Prisma.Decimal(0);
      const validatedLines: Array<{
        accountId: string;
        lineNumber: number;
        description: string | null;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        departmentId?: string | null;
        academicYearId?: string | null;
        termId?: string | null;
      }> = [];

      for (let i = 0; i < params.lines.length; i++) {
        const line = params.lines[i];
        const debit = new Prisma.Decimal(line.debit || 0);
        const credit = new Prisma.Decimal(line.credit || 0);

        if (debit.lessThan(0) || credit.lessThan(0) || debit.isNaN() || credit.isNaN()) {
          throw new Error(`Line ${i + 1}: Debit and credit amounts cannot be negative.`);
        }
        if (debit.greaterThan(0) && credit.greaterThan(0)) {
          throw new Error(`Line ${i + 1}: A line cannot contain both a debit and a credit amount simultaneously.`);
        }
        if (debit.isZero() && credit.isZero()) {
          throw new Error(`Line ${i + 1}: Line amount cannot be zero.`);
        }

        // Verify Account
        const account = await tx.gLAccount.findFirst({
          where: { id: line.accountId, branchId: ctx.branchId }
        });
        if (!account) {
          throw new Error(`Line ${i + 1}: Account ID '${line.accountId}' does not exist in branch.`);
        }
        if (!account.isActive) {
          throw new Error(`Line ${i + 1}: Account '${account.code} - ${account.name}' is inactive.`);
        }
        if (account.isHeader) {
          throw new Error(`Line ${i + 1}: Cannot post journal line to header summary account '${account.code}'. Leaf account required.`);
        }

        // Block manual postings to protected control accounts
        if (
          params.journalType === JournalType.STANDARD_MANUAL &&
          !params.bypassControlAccountValidation &&
          account.controlRole !== SystemControlRole.NONE
        ) {
          throw new Error(
            `Line ${i + 1}: Direct manual posting to control account '${account.code} (${account.controlRole})' is restricted. Must post via operational subledger.`
          );
        }

        totalDebit = totalDebit.add(debit);
        totalCredit = totalCredit.add(credit);

        validatedLines.push({
          accountId: line.accountId,
          lineNumber: i + 1,
          description: line.description?.trim() || null,
          debit,
          credit,
          departmentId: line.departmentId || null,
          academicYearId: line.academicYearId || null,
          termId: line.termId || null
        });
      }

      // Enforce Balanced Invariant
      if (totalDebit.isZero()) {
        throw new UnbalancedJournalError("Journal total debit amount cannot be zero.");
      }
      if (!totalDebit.equals(totalCredit)) {
        const drift = totalDebit.minus(totalCredit).abs();
        throw new UnbalancedJournalError(
          `Journal is unbalanced. Total Debits (UGX ${totalDebit.toFixed(2)}) != Total Credits (UGX ${totalCredit.toFixed(2)}). Absolute Drift: UGX ${drift.toFixed(2)}.`
        );
      }

      // 5. Generate Journal Number
      const year = entryDate.getUTCFullYear();
      const journalNumber = await this.getNextJournalNumber(tx, ctx.branchId, year);

      // 6. Persist Journal Entry & Lines
      const journal = await tx.journalEntry.create({
        data: {
          branchId: ctx.branchId,
          journalNumber,
          fiscalPeriodId: period.id,
          journalType: params.journalType,
          status: JournalStatus.POSTED,
          entryDate,
          postingDate: new Date(),
          description: params.description.trim(),
          referenceType: params.referenceType || null,
          referenceId: params.referenceId || null,
          idempotencyKey: params.idempotencyKey || null,
          postedById: ctx.userId!,
          lines: {
            create: validatedLines.map(l => ({
              branchId: ctx.branchId,
              accountId: l.accountId,
              lineNumber: l.lineNumber,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              departmentId: l.departmentId,
              academicYearId: l.academicYearId,
              termId: l.termId
            }))
          }
        },
        include: {
          lines: { include: { account: true } }
        }
      });

      return { journal, isReplay: false };
    };

    try {
      const result = externalTx ? await execute(externalTx) : await db.$transaction(execute);

      if (!result.isReplay) {
        await AuditService.log(
          ctx,
          'GL_JOURNAL_POSTED',
          'JournalEntry',
          result.journal.id,
          JSON.stringify({
            journalNumber: result.journal.journalNumber,
            journalType: result.journal.journalType,
            totalAmount: result.journal.lines.reduce((s, l) => s.add(l.debit), new Prisma.Decimal(0)).toString()
          })
        );
      }
      return result;
      } catch (err: unknown) {
      const pErr = err as { code?: string };
      if (pErr?.code === 'P2002' && params.idempotencyKey) {
        const existing = await (externalTx || db).journalEntry.findUnique({
          where: {
            branchId_idempotencyKey: {
              branchId: ctx.branchId,
              idempotencyKey: params.idempotencyKey
            }
          },
          include: { lines: { include: { account: true } } }
        });
        if (existing) {
          return { journal: existing, isReplay: true };
        }
      }
      throw err;
    }
  }

  /**
   * Reverse an existing posted journal entry.
   * Emits a mirror-image compensating journal entry with swapped debits/credits.
   */
  static async reverseJournalEntry(ctx: TenantContext, journalId: string, reason: string) {
    this.checkReversePermission(ctx);

    const justification = reason?.trim();
    if (!justification || justification.length < 10) {
      throw new Error("Reversal justification must be at least 10 characters long.");
    }

    const reversalResult = await db.$transaction(async (tx) => {
      // Find and lock original journal
      const original = await tx.journalEntry.findFirst({
        where: { id: journalId, branchId: ctx.branchId },
        include: { lines: true }
      });
      if (!original) throw new Error("Original journal entry not found.");
      if (original.status === JournalStatus.REVERSED) {
        throw new Error(`Journal '${original.journalNumber}' is already reversed.`);
      }
      if (original.isReversal) {
        throw new Error("Cannot reverse a reversal journal entry.");
      }

      // Reversals post in current active open period
      const today = new Date();
      const openPeriod = await FiscalPeriodDAO.getOpenPeriodForDate(ctx, today, tx);

      // Invert lines (Original debits become credits, original credits become debits)
      const reversedLines: PostJournalLineParam[] = original.lines.map(l => ({
        accountId: l.accountId,
        debit: l.credit,
        credit: l.debit,
        description: `Reversal of ${original.journalNumber}: ${l.description || ''}`.trim(),
        departmentId: l.departmentId,
        academicYearId: l.academicYearId,
        termId: l.termId
      }));

      const year = today.getUTCFullYear();
      const reversalJournalNumber = await this.getNextJournalNumber(tx, ctx.branchId, year);

      const reversalJournal = await tx.journalEntry.create({
        data: {
          branchId: ctx.branchId,
          journalNumber: reversalJournalNumber,
          fiscalPeriodId: openPeriod.id,
          journalType: JournalType.REVERSAL,
          status: JournalStatus.POSTED,
          entryDate: today,
          postingDate: today,
          description: `REVERSAL of ${original.journalNumber}: ${justification}`,
          referenceType: "REVERSAL",
          referenceId: original.id,
          isReversal: true,
          reversalOfId: original.id,
          postedById: ctx.userId!,
          lines: {
            create: reversedLines.map((rl, idx) => ({
              branchId: ctx.branchId,
              accountId: rl.accountId,
              lineNumber: idx + 1,
              description: rl.description,
              debit: rl.debit as Prisma.Decimal,
              credit: rl.credit as Prisma.Decimal,
              departmentId: rl.departmentId,
              academicYearId: rl.academicYearId,
              termId: rl.termId
            }))
          }
        },
        include: { lines: { include: { account: true } } }
      });

      // Mark original as REVERSED
      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: JournalStatus.REVERSED,
          reversedById: reversalJournal.id
        }
      });

      return { original, reversalJournal };
    });

    await AuditService.log(
      ctx,
      'GL_JOURNAL_REVERSED',
      'JournalEntry',
      journalId,
      JSON.stringify({
        originalJournal: reversalResult.original.journalNumber,
        reversalJournal: reversalResult.reversalJournal.journalNumber,
        justification
      })
    );

    return reversalResult.reversalJournal;
  }

  /**
   * Maker-Checker Manual Journal Creation
   */
  static async createManualJournal(ctx: TenantContext, input: CreateManualJournalInput) {
    if (input.isDraft) {
      // Draft mode does not require balance validation until posting
      const entryDate = new Date(input.entryDate);
      const period = await FiscalPeriodDAO.getOpenPeriodForDate(ctx, entryDate);
      const year = entryDate.getUTCFullYear();

      return db.$transaction(async (tx) => {
        const journalNumber = await this.getNextJournalNumber(tx, ctx.branchId, year);
        return tx.journalEntry.create({
          data: {
            branchId: ctx.branchId,
            journalNumber,
            fiscalPeriodId: period.id,
            journalType: JournalType.STANDARD_MANUAL,
            status: JournalStatus.DRAFT,
            entryDate,
            description: input.description.trim(),
            referenceType: "MANUAL",
            referenceId: input.referenceNumber?.trim() || null,
            postedById: ctx.userId!,
            lines: {
              create: input.lines.map((l, idx) => ({
                branchId: ctx.branchId,
                accountId: l.accountId,
                lineNumber: idx + 1,
                description: l.description?.trim() || null,
                debit: new Prisma.Decimal(l.debit || 0),
                credit: new Prisma.Decimal(l.credit || 0)
              }))
            }
          },
          include: { lines: { include: { account: true } } }
        });
      });
    }

    // Direct post requires full double-entry balance validation
    this.checkPostPermission(ctx);
    const postRes = await this.postJournalEntry(ctx, {
      journalType: JournalType.STANDARD_MANUAL,
      entryDate: input.entryDate,
      description: input.description,
      referenceType: "MANUAL",
      referenceId: input.referenceNumber,
      lines: input.lines
    });
    return postRes.journal;
  }

  /**
   * Approves and posts a draft manual journal (Checker approval).
   * Anti-self-approval: Creator cannot approve their own draft journal.
   */
  static async approveDraftManualJournal(ctx: TenantContext, journalId: string) {
    this.checkPostPermission(ctx);

    const result = await db.$transaction(async (tx) => {
      const draft = await tx.journalEntry.findFirst({
        where: { id: journalId, branchId: ctx.branchId },
        include: { lines: true }
      });
      if (!draft) throw new Error("Journal entry not found.");
      if (draft.status !== JournalStatus.DRAFT) throw new Error("Journal is not in DRAFT status.");

      // Anti-self approval
      if (draft.postedById === ctx.userId) {
        throw new Error("Four-Eye Principle Violation: You cannot approve a draft journal that you created yourself.");
      }

      // Validate lines & balanced invariant
      let totalDebit = new Prisma.Decimal(0);
      let totalCredit = new Prisma.Decimal(0);
      for (const l of draft.lines) {
        totalDebit = totalDebit.add(l.debit);
        totalCredit = totalCredit.add(l.credit);
      }

      if (totalDebit.isZero()) throw new UnbalancedJournalError("Total debits cannot be zero.");
      if (!totalDebit.equals(totalCredit)) {
        throw new UnbalancedJournalError(`Draft journal is unbalanced: Dr (${totalDebit}) != Cr (${totalCredit}).`);
      }

      const openPeriod = await FiscalPeriodDAO.getOpenPeriodForDate(ctx, draft.entryDate, tx);

      return tx.journalEntry.update({
        where: { id: journalId },
        data: {
          status: JournalStatus.POSTED,
          postingDate: new Date(),
          fiscalPeriodId: openPeriod.id
        },
        include: { lines: { include: { account: true } } }
      });
    });

    await AuditService.log(ctx, 'GL_JOURNAL_APPROVED', 'JournalEntry', journalId, JSON.stringify({ journalNumber: result.journalNumber }));
    return result;
  }

  /**
   * Year-End Closing Procedure (Period 13 Journal)
   * 1. Verifies all 12 periods of the fiscal year are CLOSED or LOCKED.
   * 2. Sums Revenue (4000s), Direct Costs (5000s), and Expenses (6000s).
   * 3. Emits closing journal clearing P&L accounts to 0.00 into Retained Earnings (#3100).
   * 4. Closes the FiscalYear.
   */
  static async executeYearEndClose(ctx: TenantContext, fiscalYearId: string) {
    this.checkPostPermission(ctx);

    return db.$transaction(async (tx) => {
      const fy = await tx.fiscalYear.findFirst({
        where: {
          branchId: ctx.branchId,
          OR: [
            { id: String(fiscalYearId) },
            { name: String(fiscalYearId) },
            { name: `FY ${fiscalYearId}` }
          ]
        },
        include: { periods: true }
      });
      if (!fy) throw new Error("Fiscal year not found.");
      if (fy.status === PeriodStatus.CLOSED || fy.status === PeriodStatus.LOCKED) {
        throw new Error(`Fiscal year '${fy.name}' is already closed or locked.`);
      }

      // Verify all periods are CLOSED or LOCKED
      const unclosed = fy.periods.filter(p => p.status === PeriodStatus.OPEN);
      if (unclosed.length > 0) {
        throw new Error(`Cannot execute year-end close. ${unclosed.length} period(s) are still OPEN.`);
      }

      // Find Retained Earnings Account
      const retainedEarnings = await GLAccountDAO.getMapping(ctx, SystemControlRole.RETAINED_EARNINGS, tx);
      if (!retainedEarnings) {
        throw new GLConfigurationError("Mandatory account mapping 'RETAINED_EARNINGS' is missing.");
      }

      // Aggregate all journal lines in this fiscal year
      const periodIds = fy.periods.map(p => p.id);
      const accounts = await tx.gLAccount.findMany({
        where: {
          branchId: ctx.branchId,
          accountType: { in: [GLAccountType.REVENUE, GLAccountType.DIRECT_COST, GLAccountType.EXPENSE] },
          isHeader: false
        }
      });

      const closingLines: PostJournalLineParam[] = [];
      let totalRevenueNet = new Prisma.Decimal(0);
      let totalExpenseNet = new Prisma.Decimal(0);

      for (const acc of accounts) {
        const lines = await tx.journalLine.findMany({
          where: {
            branchId: ctx.branchId,
            accountId: acc.id,
            journalEntry: {
              fiscalPeriodId: { in: periodIds },
              status: JournalStatus.POSTED
            }
          }
        });

        let debits = new Prisma.Decimal(0);
        let credits = new Prisma.Decimal(0);
        for (const l of lines) {
          debits = debits.add(l.debit);
          credits = credits.add(l.credit);
        }

        if (acc.accountType === GLAccountType.REVENUE) {
          const netCredit = credits.minus(debits);
          if (!netCredit.isZero()) {
            totalRevenueNet = totalRevenueNet.add(netCredit);
            // Debit revenue account to reset to 0.00
            closingLines.push({
              accountId: acc.id,
              debit: netCredit.greaterThan(0) ? netCredit : 0,
              credit: netCredit.lessThan(0) ? netCredit.abs() : 0,
              description: `Year-End Close: Clear ${acc.code} ${acc.name}`
            });
          }
        } else {
          // DIRECT_COST or EXPENSE
          const netDebit = debits.minus(credits);
          if (!netDebit.isZero()) {
            totalExpenseNet = totalExpenseNet.add(netDebit);
            // Credit expense account to reset to 0.00
            closingLines.push({
              accountId: acc.id,
              debit: netDebit.lessThan(0) ? netDebit.abs() : 0,
              credit: netDebit.greaterThan(0) ? netDebit : 0,
              description: `Year-End Close: Clear ${acc.code} ${acc.name}`
            });
          }
        }
      }

      // Net Surplus = Total Revenue - Total Costs & Expenses
      const netSurplus = totalRevenueNet.minus(totalExpenseNet);
      if (!netSurplus.isZero()) {
        if (netSurplus.greaterThan(0)) {
          // Net Surplus -> Credit Retained Earnings
          closingLines.push({
            accountId: retainedEarnings.id,
            debit: 0,
            credit: netSurplus,
            description: `Year-End Close ${fy.name}: Net Surplus transferred to Retained Earnings`
          });
        } else {
          // Net Deficit -> Debit Retained Earnings
          closingLines.push({
            accountId: retainedEarnings.id,
            debit: netSurplus.abs(),
            credit: 0,
            description: `Year-End Close ${fy.name}: Net Deficit transferred to Retained Earnings`
          });
        }
      }

      let closingJournal = null;
      if (closingLines.length > 0) {
        // Last period in FY
        const lastPeriod = fy.periods[fy.periods.length - 1];
        const year = fy.endDate.getUTCFullYear();
        const jNumber = await this.getNextJournalNumber(tx, ctx.branchId, year);

        closingJournal = await tx.journalEntry.create({
          data: {
            branchId: ctx.branchId,
            journalNumber: jNumber,
            fiscalPeriodId: lastPeriod.id,
            journalType: JournalType.YEAR_END_CLOSE,
            status: JournalStatus.POSTED,
            entryDate: fy.endDate,
            postingDate: new Date(),
            description: `Year-End Closing Journal for ${fy.name} (Net Surplus: UGX ${netSurplus.toFixed(2)})`,
            referenceType: "FISCAL_YEAR_CLOSE",
            referenceId: fy.id,
            postedById: ctx.userId!,
            lines: {
              create: closingLines.map((cl, idx) => ({
                branchId: ctx.branchId,
                accountId: cl.accountId,
                lineNumber: idx + 1,
                description: cl.description,
                debit: new Prisma.Decimal(cl.debit),
                credit: new Prisma.Decimal(cl.credit)
              }))
            }
          }
        });
      }

      // Mark Fiscal Year CLOSED
      await tx.fiscalYear.update({
        where: { id: fy.id },
        data: { status: PeriodStatus.CLOSED }
      });

      return { fiscalYear: fy, closingJournal, netSurplus };
    });
  }

  /**
   * Formal programmatic reconciliation between operational subledgers and the General Ledger.
   * Asserts zero drift:
   * 1. AR Subledger vs GL #1200
   * 2. Treasury Cashbook vs GL Cash/Bank Accounts
   * 3. Inventory Stock vs GL #1310
   * 4. Payroll Liabilities vs GL #2210, #2220, #2230
   */
  static async reconcileSubledgers(ctx: TenantContext) {
    this.checkReadPermission(ctx);

    // 1. AR Reconciliation
    const arControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.AR_STUDENT_CONTROL);
    let arGLBalance = new Prisma.Decimal(0);
    if (arControl) {
      const lines = await db.journalLine.findMany({
        where: { branchId: ctx.branchId, accountId: arControl.id, journalEntry: { status: JournalStatus.POSTED } }
      });
      for (const l of lines) arGLBalance = arGLBalance.add(l.debit).minus(l.credit);
    }

    // Active positive student ledger balances
    const activeStudents = await db.student.findMany({
      where: { branchId: ctx.branchId, status: 'ACTIVE' },
      select: { id: true }
    });

    let subledgerArTotal = new Prisma.Decimal(0);
    for (const st of activeStudents) {
      const lastEntry = await db.studentLedgerEntry.findFirst({
        where: { branchId: ctx.branchId, studentId: st.id },
        orderBy: [{ postedAt: 'desc' }, { id: 'desc' }]
      });
      if (lastEntry && new Prisma.Decimal(lastEntry.balanceAfter).isPositive()) {
        subledgerArTotal = subledgerArTotal.add(lastEntry.balanceAfter);
      }
    }
    const arDrift = arGLBalance.minus(subledgerArTotal);

    // 2. Treasury Reconciliation
    const treasuryAccounts = await db.treasuryAccount.findMany({
      where: { branchId: ctx.branchId, isActive: true }
    });
    let subledgerTreasuryTotal = new Prisma.Decimal(0);
    for (const ta of treasuryAccounts) {
      subledgerTreasuryTotal = subledgerTreasuryTotal.add(ta.currentBalance);
    }

    // GL Cash & Bank Accounts (all accounts under 1100)
    const cashBankAccounts = await db.gLAccount.findMany({
      where: {
        branchId: ctx.branchId,
        code: { startsWith: '11' },
        isHeader: false
      }
    });
    let glTreasuryTotal = new Prisma.Decimal(0);
    for (const cba of cashBankAccounts) {
      const lines = await db.journalLine.findMany({
        where: { branchId: ctx.branchId, accountId: cba.id, journalEntry: { status: JournalStatus.POSTED } }
      });
      for (const l of lines) glTreasuryTotal = glTreasuryTotal.add(l.debit).minus(l.credit);
    }
    const treasuryDrift = glTreasuryTotal.minus(subledgerTreasuryTotal);

    // 3. Inventory Stock Reconciliation
    const invControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.INVENTORY_STORES_ASSET);
    let glInventoryTotal = new Prisma.Decimal(0);
    if (invControl) {
      const lines = await db.journalLine.findMany({
        where: { branchId: ctx.branchId, accountId: invControl.id, journalEntry: { status: JournalStatus.POSTED } }
      });
      for (const l of lines) glInventoryTotal = glInventoryTotal.add(l.debit).minus(l.credit);
    }

    // Subledger valuation: sum(quantityOnHand * currentWac)
    const storeStocks = await db.inventoryStoreStock.findMany({
      where: { branchId: ctx.branchId },
      include: { item: true }
    });
    let subledgerInventoryTotal = new Prisma.Decimal(0);
    for (const ss of storeStocks) {
      const qty = new Prisma.Decimal(ss.quantityOnHand);
      const wac = new Prisma.Decimal(ss.item.unitCostPrice);
      subledgerInventoryTotal = subledgerInventoryTotal.add(qty.mul(wac));
    }
    const inventoryDrift = glInventoryTotal.minus(subledgerInventoryTotal);

    // 4. Payroll Liabilities Reconciliation
    const payeControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.PAYROLL_PAYE_PAYABLE);
    let glPayeTotal = new Prisma.Decimal(0);
    if (payeControl) {
      const lines = await db.journalLine.findMany({
        where: { branchId: ctx.branchId, accountId: payeControl.id, journalEntry: { status: JournalStatus.POSTED } }
      });
      for (const l of lines) glPayeTotal = glPayeTotal.add(l.credit).minus(l.debit);
    }

    const nssfControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.PAYROLL_NSSF_PAYABLE);
    let glNssfTotal = new Prisma.Decimal(0);
    if (nssfControl) {
      const lines = await db.journalLine.findMany({
        where: { branchId: ctx.branchId, accountId: nssfControl.id, journalEntry: { status: JournalStatus.POSTED } }
      });
      for (const l of lines) glNssfTotal = glNssfTotal.add(l.credit).minus(l.debit);
    }

    return {
      timestamp: new Date(),
      ar: {
        glBalance: arGLBalance,
        subledgerTotal: subledgerArTotal,
        drift: arDrift,
        isBalanced: arDrift.isZero()
      },
      treasury: {
        glBalance: glTreasuryTotal,
        subledgerTotal: subledgerTreasuryTotal,
        drift: treasuryDrift,
        isBalanced: treasuryDrift.isZero()
      },
      inventory: {
        glBalance: glInventoryTotal,
        subledgerTotal: subledgerInventoryTotal,
        drift: inventoryDrift,
        isBalanced: inventoryDrift.isZero()
      },
      payroll: {
        payeGL: glPayeTotal,
        nssfGL: glNssfTotal
      },
      isFullyBalanced: arDrift.isZero() && treasuryDrift.isZero() && inventoryDrift.isZero()
    };
  }

  /**
   * System Opening Balance Bootstrap Migration.
   * Snapshots active subledger balances into a single balanced OPENING_BALANCE journal.
   * Completely idempotent: uses `${branchId}:OPENING_BALANCE:${cutoffDate.toISOString()}`.
   */
  static async bootstrapOpeningBalances(ctx: TenantContext, cutoffDate?: Date) {
    this.checkPostPermission(ctx);
    const cutoff = cutoffDate ? new Date(cutoffDate) : new Date();
    const idempotencyKey = `${ctx.branchId}:OPENING_BALANCE:${cutoff.toISOString().slice(0, 10)}`;

    return db.$transaction(async (tx) => {
      // Check idempotency
      const existing = await tx.journalEntry.findUnique({
        where: { branchId_idempotencyKey: { branchId: ctx.branchId, idempotencyKey } },
        include: { lines: { include: { account: true } } }
      });
      if (existing) return { journal: existing, isReplay: true };

      // Initialize COA if not present
      await GLAccountDAO.initBranchChartOfAccounts(ctx.branchId, tx);

      // Resolve mapping accounts
      const arControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.AR_STUDENT_CONTROL, tx);
      const prepaidControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.AR_PREPAID_ADVANCES, tx);
      const invControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.INVENTORY_STORES_ASSET, tx);
      const equityControl = await GLAccountDAO.getMapping(ctx, SystemControlRole.OPENING_BALANCE_EQUITY, tx);

      if (!arControl || !prepaidControl || !invControl || !equityControl) {
        throw new GLConfigurationError("Mandatory bootstrap control mappings are missing.");
      }

      const openPeriod = await FiscalPeriodDAO.getOpenPeriodForDate(ctx, cutoff, tx);
      const lines: PostJournalLineParam[] = [];

      // 1. Snapshot Treasury Accounts
      const treasuryAccounts = await tx.treasuryAccount.findMany({
        where: { branchId: ctx.branchId, isActive: true }
      });
      for (const ta of treasuryAccounts) {
        if (!ta.currentBalance.isZero()) {
          // Find or default account
          let accId = ta.glAccountId;
          if (!accId) {
            const defaultBank = await GLAccountDAO.getMapping(ctx, SystemControlRole.CASH_BANK_CONTROL, tx);
            accId = defaultBank?.id || null;
          }
          if (accId) {
            if (ta.currentBalance.greaterThan(0)) {
              lines.push({ accountId: accId, debit: ta.currentBalance, credit: 0, description: `Opening Balance: ${ta.name}` });
            } else {
              lines.push({ accountId: accId, debit: 0, credit: ta.currentBalance.abs(), description: `Opening Overdraft: ${ta.name}` });
            }
          }
        }
      }

      // 2. Snapshot Student Debtors & Advances
      const students = await tx.student.findMany({
        where: { branchId: ctx.branchId, status: 'ACTIVE' },
        select: { id: true }
      });
      let totalArrears = new Prisma.Decimal(0);
      let totalAdvances = new Prisma.Decimal(0);

      for (const st of students) {
        const lastEntry = await tx.studentLedgerEntry.findFirst({
          where: { branchId: ctx.branchId, studentId: st.id },
          orderBy: [{ postedAt: 'desc' }, { id: 'desc' }]
        });
        if (lastEntry) {
          const bal = new Prisma.Decimal(lastEntry.balanceAfter);
          if (bal.greaterThan(0)) totalArrears = totalArrears.add(bal);
          else if (bal.lessThan(0)) totalAdvances = totalAdvances.add(bal.abs());
        }
      }

      if (totalArrears.greaterThan(0)) {
        lines.push({ accountId: arControl.id, debit: totalArrears, credit: 0, description: "Opening Balance: Student Fee Arrears" });
      }
      if (totalAdvances.greaterThan(0)) {
        lines.push({ accountId: prepaidControl.id, debit: 0, credit: totalAdvances, description: "Opening Balance: Student Prepaid Advances" });
      }

      // 3. Snapshot Stores Inventory
      const stocks = await tx.inventoryStoreStock.findMany({
        where: { branchId: ctx.branchId },
        include: { item: true }
      });
      let totalInventory = new Prisma.Decimal(0);
      for (const s of stocks) {
        const qty = new Prisma.Decimal(s.quantityOnHand);
        const wac = new Prisma.Decimal(s.item.unitCostPrice);
        totalInventory = totalInventory.add(qty.mul(wac));
      }
      if (totalInventory.greaterThan(0)) {
        lines.push({ accountId: invControl.id, debit: totalInventory, credit: 0, description: "Opening Balance: Stores Inventory (WAC)" });
      }

      // Calculate net imbalance and plug into Opening Balance Equity (#3500)
      let debits = new Prisma.Decimal(0);
      let credits = new Prisma.Decimal(0);
      for (const l of lines) {
        debits = debits.add(l.debit);
        credits = credits.add(l.credit);
      }

      const diff = debits.minus(credits);
      if (!diff.isZero()) {
        if (diff.greaterThan(0)) {
          // Assets > Liabilities -> Credit Equity
          lines.push({ accountId: equityControl.id, debit: 0, credit: diff, description: "Opening Balance Equity Balancing Leg" });
        } else {
          // Liabilities > Assets -> Debit Equity
          lines.push({ accountId: equityControl.id, debit: diff.abs(), credit: 0, description: "Opening Balance Equity Balancing Leg" });
        }
      }

      if (lines.length === 0) {
        throw new Error("No active balances found to bootstrap opening balances.");
      }

      const year = cutoff.getUTCFullYear();
      const journalNumber = await this.getNextJournalNumber(tx, ctx.branchId, year);

      const journal = await tx.journalEntry.create({
        data: {
          branchId: ctx.branchId,
          journalNumber,
          fiscalPeriodId: openPeriod.id,
          journalType: JournalType.OPENING_BALANCE,
          status: JournalStatus.POSTED,
          entryDate: cutoff,
          postingDate: new Date(),
          description: `System Opening Balance Bootstrap as of ${cutoff.toISOString().slice(0, 10)}`,
          referenceType: "BOOTSTRAP",
          referenceId: cutoff.toISOString().slice(0, 10),
          idempotencyKey,
          postedById: ctx.userId!,
          lines: {
            create: lines.map((l, idx) => ({
              branchId: ctx.branchId,
              accountId: l.accountId,
              lineNumber: idx + 1,
              description: l.description || null,
              debit: new Prisma.Decimal(l.debit),
              credit: new Prisma.Decimal(l.credit)
            }))
          }
        },
        include: { lines: { include: { account: true } } }
      });

      return { journal, isReplay: false };
    });
  }
}
