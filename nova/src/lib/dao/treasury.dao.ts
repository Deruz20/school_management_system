import { db } from "../db";
import {
  Prisma,
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
} from "@prisma/client";
import { TenantContext } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { GLIntegrationService } from "./gl-integration.service";
import crypto from "crypto";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export interface CreateTreasuryAccountInput {
  code: string;
  name: string;
  accountType: TreasuryAccountType;
  bankName?: string;
  accountNumber?: string;
  currency?: string;
  swiftCode?: string;
  branchSortCode?: string;
  openingBalance?: number | string | Prisma.Decimal;
  openingDate?: Date | string;
  isDefaultFeeCollection?: boolean;
  isDefaultOperations?: boolean;
  isDefaultPettyCash?: boolean;
  custodianId?: string;
}

export interface RecordMovementInput {
  accountId: string;
  movementType: CashbookMovementType;
  direction: CashDirection;
  amount: number | string | Prisma.Decimal;
  description: string;
  referenceNumber?: string;
  transactionDate?: Date | string;
  paymentId?: string;
  expenseId?: string;
  transferId?: string;
  payrollRunId?: string;
  storeSaleId?: string;
  pettyVoucherId?: string;
}

export interface OpenShiftInput {
  tillAccountId: string;
  openingFloat?: number | string | Prisma.Decimal;
}

export interface CloseShiftInput {
  sessionId: string;
  actualCashCounted: number | string | Prisma.Decimal;
  denominationsJson?: string;
  varianceNotes?: string;
  supervisorWitnessId?: string;
  sweepToSafe?: boolean;
  safeAccountId?: string;
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number | string | Prisma.Decimal;
  transferMethod: TransferMethod;
  depositSlipNumber?: string;
  securityEscortDetails?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface CreatePettyImprestInput {
  accountId: string;
  custodianId: string;
  name: string;
  floatCeiling: number | string | Prisma.Decimal;
  replenishmentThreshold: number | string | Prisma.Decimal;
  departmentId?: string;
}

export interface CreatePettyVoucherInput {
  imprestId: string;
  purpose: string;
  categoryId: string;
  budgetItemId?: string;
  requestedAmount: number | string | Prisma.Decimal;
}

export interface ImportStatementInput {
  accountId: string;
  statementIdentifier: string;
  startDate: Date | string;
  endDate: Date | string;
  openingBalance: number | string | Prisma.Decimal;
  closingBalance: number | string | Prisma.Decimal;
  fileContentRaw: string;
  lines: Array<{
    transactionDate: Date | string;
    valueDate?: Date | string;
    reference?: string;
    narrative: string;
    amount: number | string | Prisma.Decimal;
    direction: CashDirection;
    runningBalance?: number | string | Prisma.Decimal;
  }>;
}

export class TreasuryDAO {
  // ============================================================================
  // RBAC PERMISSION CHECKERS
  // ============================================================================

  static checkPermission(ctx: TenantContext, required: string) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (perms.includes("all") || perms.includes(required)) {
      return true;
    }
    throw new UnauthorizedError(`Missing permission: ${required}`);
  }

  // ============================================================================
  // SEQUENCE GENERATOR HELPER
  // ============================================================================

  static async getNextTreasurySequence(
    tx: Prisma.TransactionClient,
    branchId: string,
    prefix: "CBM" | "TRF" | "PCV" | "BRS",
    year: number = new Date().getFullYear()
  ): Promise<string> {
    const seq = await tx.treasurySequence.upsert({
      where: {
        branchId_prefix_year: {
          branchId,
          prefix,
          year,
        },
      },
      create: {
        branchId,
        prefix,
        year,
        lastValue: 1,
      },
      update: {
        lastValue: { increment: 1 },
      },
    });
    return `${prefix}-${year}-${seq.lastValue.toString().padStart(5, "0")}`;
  }

  // ============================================================================
  // 1. TREASURY ACCOUNTS MANAGEMENT
  // ============================================================================

  static async createTreasuryAccount(ctx: TenantContext, input: CreateTreasuryAccountInput) {
    this.checkPermission(ctx, "treasury:accounts:manage");

    const openingBalance = new Prisma.Decimal(input.openingBalance ?? 0);
    if (openingBalance.isNegative()) {
      throw new Error("Opening balance cannot be negative.");
    }

    return db.$transaction(async (tx) => {
      // Check code uniqueness per branch
      const existing = await tx.treasuryAccount.findUnique({
        where: {
          branchId_code: {
            branchId: ctx.branchId,
            code: input.code.trim().toUpperCase(),
          },
        },
      });
      if (existing) {
        throw new Error(`Treasury account with code '${input.code}' already exists in this branch.`);
      }

      // If marked default, unset prior default of that type
      if (input.isDefaultFeeCollection) {
        await tx.treasuryAccount.updateMany({
          where: { branchId: ctx.branchId, isDefaultFeeCollection: true },
          data: { isDefaultFeeCollection: false },
        });
      }
      if (input.isDefaultOperations) {
        await tx.treasuryAccount.updateMany({
          where: { branchId: ctx.branchId, isDefaultOperations: true },
          data: { isDefaultOperations: false },
        });
      }
      if (input.isDefaultPettyCash) {
        await tx.treasuryAccount.updateMany({
          where: { branchId: ctx.branchId, isDefaultPettyCash: true },
          data: { isDefaultPettyCash: false },
        });
      }

      const account = await tx.treasuryAccount.create({
        data: {
          branchId: ctx.branchId,
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          accountType: input.accountType,
          bankName: input.bankName?.trim() || null,
          accountNumber: input.accountNumber?.trim() || null,
          currency: input.currency || "UGX",
          swiftCode: input.swiftCode?.trim() || null,
          branchSortCode: input.branchSortCode?.trim() || null,
          openingBalance,
          currentBalance: openingBalance,
          openingDate: input.openingDate ? new Date(input.openingDate) : new Date(),
          isDefaultFeeCollection: input.isDefaultFeeCollection ?? false,
          isDefaultOperations: input.isDefaultOperations ?? false,
          isDefaultPettyCash: input.isDefaultPettyCash ?? false,
          custodianId: input.custodianId || null,
        },
      });

      // Record initial opening movement if opening balance > 0
      if (openingBalance.greaterThan(0)) {
        const movementNumber = await this.getNextTreasurySequence(tx, ctx.branchId, "CBM");
        await tx.cashbookMovement.create({
          data: {
            branchId: ctx.branchId,
            accountId: account.id,
            movementNumber,
            movementType: CashbookMovementType.OPENING_BALANCE,
            direction: CashDirection.INFLOW,
            amount: openingBalance,
            balanceBefore: new Prisma.Decimal(0),
            balanceAfter: openingBalance,
            description: "Opening Balance Initialization",
            createdById: ctx.userId,
          },
        });
      }

      await AuditService.log(
        ctx,
        "CREATE_TREASURY_ACCOUNT",
        "TreasuryAccount",
        account.id,
        JSON.stringify({ code: account.code, name: account.name, type: account.accountType })
      );

      return account;
    });
  }

  static async getTreasuryAccounts(
    ctx: TenantContext,
    filter?: { accountType?: TreasuryAccountType; isActive?: boolean }
  ) {
    this.checkPermission(ctx, "treasury:accounts:read");
    return db.treasuryAccount.findMany({
      where: {
        branchId: ctx.branchId,
        ...(filter?.accountType ? { accountType: filter.accountType } : {}),
        ...(filter?.isActive !== undefined ? { isActive: filter.isActive } : {}),
      },
      include: {
        custodian: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ accountType: "asc" }, { name: "asc" }],
    });
  }

  static async getTreasuryAccountById(ctx: TenantContext, id: string) {
    this.checkPermission(ctx, "treasury:accounts:read");
    const account = await db.treasuryAccount.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        custodian: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!account) {
      throw new Error("Treasury account not found or access denied.");
    }
    return account;
  }

  static async getDefaultAccount(
    ctx: TenantContext,
    purpose: "FEE_COLLECTION" | "OPERATIONS" | "PETTY_CASH"
  ) {
    this.checkPermission(ctx, "treasury:accounts:read");
    const whereClause: Prisma.TreasuryAccountWhereInput = {
      branchId: ctx.branchId,
      isActive: true,
    };
    if (purpose === "FEE_COLLECTION") whereClause.isDefaultFeeCollection = true;
    else if (purpose === "OPERATIONS") whereClause.isDefaultOperations = true;
    else if (purpose === "PETTY_CASH") whereClause.isDefaultPettyCash = true;

    return db.treasuryAccount.findFirst({
      where: whereClause,
    });
  }

  // ============================================================================
  // 2. ATOMIC CASHBOOK MOVEMENTS & PESSIMISTIC LOCKING
  // ============================================================================

  static async recordCashbookMovement(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    input: RecordMovementInput
  ) {
    const amount = new Prisma.Decimal(input.amount);
    if (amount.isNegative() || amount.isZero() || amount.isNaN()) {
      throw new Error("Movement amount must be a positive number.");
    }

    // Pessimistic row locking on TreasuryAccount
    const accounts = await tx.$queryRaw<
      Array<{
        id: string;
        branchId: string;
        currentBalance: Prisma.Decimal;
        accountType: TreasuryAccountType;
        name: string;
      }>
    >`
      SELECT "id", "branchId", "currentBalance", "accountType", "name"
      FROM "TreasuryAccount"
      WHERE "id" = ${input.accountId} AND "branchId" = ${ctx.branchId}
      FOR UPDATE;
    `;

    const account = accounts[0];
    if (!account) {
      throw new Error(`Treasury account ${input.accountId} not found in this branch.`);
    }

    const currentBal = new Prisma.Decimal(account.currentBalance);
    let newBalance: Prisma.Decimal;

    if (input.direction === CashDirection.INFLOW) {
      newBalance = currentBal.add(amount);
    } else {
      // Outflow
      const isPhysical = (
        [
          TreasuryAccountType.CASHIER_TILL,
          TreasuryAccountType.CASH_OFFICE_SAFE,
          TreasuryAccountType.PETTY_CASH_FLOAT,
        ] as TreasuryAccountType[]
      ).includes(account.accountType);

      if (isPhysical && currentBal.lessThan(amount)) {
        throw new Error(
          `Insufficient physical cash in ${account.name}. Available: ${currentBal.toString()} UGX, Requested: ${amount.toString()} UGX.`
        );
      }
      newBalance = currentBal.minus(amount);
    }

    // Update account balance
    await tx.treasuryAccount.update({
      where: { id: account.id },
      data: { currentBalance: newBalance },
    });

    // Generate sequential movement number
    const movementNumber = await this.getNextTreasurySequence(tx, ctx.branchId, "CBM");

    // Insert immutable movement
    const movement = await tx.cashbookMovement.create({
      data: {
        branchId: ctx.branchId,
        accountId: account.id,
        movementNumber,
        movementType: input.movementType,
        direction: input.direction,
        amount,
        balanceBefore: currentBal,
        balanceAfter: newBalance,
        transactionDate: input.transactionDate ? new Date(input.transactionDate) : new Date(),
        referenceNumber: input.referenceNumber || null,
        description: input.description,
        paymentId: input.paymentId || null,
        expenseId: input.expenseId || null,
        transferId: input.transferId || null,
        payrollRunId: input.payrollRunId || null,
        storeSaleId: input.storeSaleId || null,
        pettyVoucherId: input.pettyVoucherId || null,
        createdById: ctx.userId,
      },
    });

    return movement;
  }

  static async getCashbookMovements(
    ctx: TenantContext,
    accountId: string,
    filter?: { startDate?: Date; endDate?: Date; movementType?: CashbookMovementType; limit?: number }
  ) {
    this.checkPermission(ctx, "treasury:accounts:read");
    return db.cashbookMovement.findMany({
      where: {
        branchId: ctx.branchId,
        accountId,
        ...(filter?.movementType ? { movementType: filter.movementType } : {}),
        ...(filter?.startDate || filter?.endDate
          ? {
              transactionDate: {
                ...(filter.startDate ? { gte: filter.startDate } : {}),
                ...(filter.endDate ? { lte: filter.endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: filter?.limit || 200,
    });
  }

  // ============================================================================
  // 3. CASHIER SHIFTS & TILL RECONCILIATION
  // ============================================================================

  static async openShiftSession(ctx: TenantContext, input: OpenShiftInput) {
    this.checkPermission(ctx, "treasury:shifts:operate");

    const openingFloat = new Prisma.Decimal(input.openingFloat ?? 0);
    if (openingFloat.isNegative()) {
      throw new Error("Opening float cannot be negative.");
    }

    return db.$transaction(async (tx) => {
      // Ensure till exists and belongs to branch
      const till = await tx.treasuryAccount.findFirst({
        where: { id: input.tillAccountId, branchId: ctx.branchId, accountType: TreasuryAccountType.CASHIER_TILL },
      });
      if (!till) {
        throw new Error("Specified account is not a valid Cashier Till in this branch.");
      }

      // Check if cashier already has an OPEN shift
      const activeShift = await tx.cashierShiftSession.findFirst({
        where: {
          branchId: ctx.branchId,
          cashierId: ctx.userId,
          status: SessionStatus.OPEN,
        },
      });
      if (activeShift) {
        throw new Error("Cashier already has an active open shift session. Close it before opening a new one.");
      }

      // Set till current balance to opening float if opening float declared
      if (openingFloat.greaterThan(0)) {
        await tx.treasuryAccount.update({
          where: { id: till.id },
          data: { currentBalance: openingFloat },
        });

        const movementNumber = await this.getNextTreasurySequence(tx, ctx.branchId, "CBM");
        await tx.cashbookMovement.create({
          data: {
            branchId: ctx.branchId,
            accountId: till.id,
            movementNumber,
            movementType: CashbookMovementType.OPENING_BALANCE,
            direction: CashDirection.INFLOW,
            amount: openingFloat,
            balanceBefore: new Prisma.Decimal(0),
            balanceAfter: openingFloat,
            description: "Cashier Shift Opening Float",
            createdById: ctx.userId,
          },
        });
      }

      const session = await tx.cashierShiftSession.create({
        data: {
          branchId: ctx.branchId,
          cashierId: ctx.userId,
          tillAccountId: till.id,
          openingFloat,
          status: SessionStatus.OPEN,
        },
        include: {
          tillAccount: true,
        },
      });

      await AuditService.log(
        ctx,
        "OPEN_CASHIER_SHIFT",
        "CashierShiftSession",
        session.id,
        JSON.stringify({ tillAccountId: till.id, openingFloat: openingFloat.toString() })
      );

      return session;
    });
  }

  static async recordShiftCashCountAndClose(ctx: TenantContext, input: CloseShiftInput) {
    this.checkPermission(ctx, "treasury:shifts:operate");

    const actualCash = new Prisma.Decimal(input.actualCashCounted);
    if (actualCash.isNegative()) {
      throw new Error("Actual cash counted cannot be negative.");
    }

    return db.$transaction(async (tx) => {
      // Row lock session
      const sessions = await tx.$queryRaw<
        Array<{
          id: string;
          branchId: string;
          cashierId: string;
          tillAccountId: string;
          openedAt: Date;
          openingFloat: Prisma.Decimal;
          status: SessionStatus;
        }>
      >`
        SELECT "id", "branchId", "cashierId", "tillAccountId", "openedAt", "openingFloat", "status"
        FROM "CashierShiftSession"
        WHERE "id" = ${input.sessionId} AND "branchId" = ${ctx.branchId}
        FOR UPDATE;
      `;

      const session = sessions[0];
      if (!session) {
        throw new Error("Shift session not found or access denied.");
      }
      if (session.status === SessionStatus.CLOSED) {
        throw new Error("This shift session is already closed.");
      }

      // Calculate movements during this shift on the till account
      const movements = await tx.cashbookMovement.findMany({
        where: {
          branchId: ctx.branchId,
          accountId: session.tillAccountId,
          transactionDate: { gte: session.openedAt },
          movementType: { not: CashbookMovementType.OPENING_BALANCE },
        },
      });

      let netShiftDelta = new Prisma.Decimal(0);
      for (const m of movements) {
        if (m.direction === CashDirection.INFLOW) {
          netShiftDelta = netShiftDelta.add(m.amount);
        } else {
          netShiftDelta = netShiftDelta.minus(m.amount);
        }
      }

      const expectedClosing = new Prisma.Decimal(session.openingFloat).add(netShiftDelta);
      const cashVariance = actualCash.minus(expectedClosing);

      if (!cashVariance.isZero() && (!input.varianceNotes || input.varianceNotes.trim().length === 0)) {
        throw new Error(
          `Cash variance detected (${cashVariance.toString()} UGX). Variance explanatory notes are mandatory.`
        );
      }

      // If sweepToSafe requested, transfer remaining till cash to safe
      if (input.sweepToSafe && input.safeAccountId && actualCash.greaterThan(0)) {
        const transferNumber = await this.getNextTreasurySequence(tx, ctx.branchId, "TRF");
        const sweepTransfer = await tx.treasuryTransfer.create({
          data: {
            branchId: ctx.branchId,
            transferNumber,
            fromAccountId: session.tillAccountId,
            toAccountId: input.safeAccountId,
            amount: actualCash,
            transferMethod: TransferMethod.TILL_TO_SAFE_SWEEP,
            notes: `Cashier Shift Close Sweep (${session.id})`,
            status: TransferStatus.COMPLETED,
            initiatedById: ctx.userId,
            approvedById: input.supervisorWitnessId || ctx.userId,
            completedAt: new Date(),
          },
        });

        // Mutate balances
        await this.recordCashbookMovement(tx, ctx, {
          accountId: session.tillAccountId,
          movementType: CashbookMovementType.INTER_ACCOUNT_TRANSFER_OUT,
          direction: CashDirection.OUTFLOW,
          amount: actualCash,
          description: `Shift Close Sweep to Safe (Transfer #${transferNumber})`,
          transferId: sweepTransfer.id,
        });

        await this.recordCashbookMovement(tx, ctx, {
          accountId: input.safeAccountId,
          movementType: CashbookMovementType.INTER_ACCOUNT_TRANSFER_IN,
          direction: CashDirection.INFLOW,
          amount: actualCash,
          description: `Shift Close Sweep Receipt from Till (Transfer #${transferNumber})`,
          transferId: sweepTransfer.id,
        });
      }

      const closed = await tx.cashierShiftSession.update({
        where: { id: session.id },
        data: {
          closedAt: new Date(),
          expectedClosingBalance: expectedClosing,
          actualCashCounted: actualCash,
          cashVariance,
          denominationsJson: input.denominationsJson || null,
          varianceNotes: input.varianceNotes?.trim() || null,
          supervisorWitnessId: input.supervisorWitnessId || null,
          status: SessionStatus.CLOSED,
        },
        include: {
          tillAccount: true,
          supervisorWitness: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await AuditService.log(
        ctx,
        "CLOSE_CASHIER_SHIFT",
        "CashierShiftSession",
        closed.id,
        JSON.stringify({
          actualCashCounted: actualCash.toString(),
          expectedClosingBalance: expectedClosing.toString(),
          cashVariance: cashVariance.toString(),
        })
      );

      return closed;
    });
  }

  static async getShiftSessions(
    ctx: TenantContext,
    filter?: { cashierId?: string; status?: SessionStatus }
  ) {
    this.checkPermission(ctx, "treasury:shifts:operate");
    return db.cashierShiftSession.findMany({
      where: {
        branchId: ctx.branchId,
        ...(filter?.cashierId ? { cashierId: filter.cashierId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      include: {
        cashier: { select: { id: true, firstName: true, lastName: true } },
        tillAccount: true,
        supervisorWitness: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { openedAt: "desc" },
    });
  }

  // ============================================================================
  // 4. TREASURY TRANSFERS & BANK DEPOSITS
  // ============================================================================

  static async createTreasuryTransfer(ctx: TenantContext, input: CreateTransferInput) {
    this.checkPermission(ctx, "treasury:transfers:initiate");

    const amount = new Prisma.Decimal(input.amount);
    if (amount.isNegative() || amount.isZero() || amount.isNaN()) {
      throw new Error("Transfer amount must be a positive number.");
    }
    if (input.fromAccountId === input.toAccountId) {
      throw new Error("Source and destination accounts must be distinct.");
    }

    const idempotencyKey = input.idempotencyKey?.trim() || `TRF:${crypto.randomUUID()}`;

    return db.$transaction(async (tx) => {
      // Check existing transfer with idempotency key
      const existing = await tx.treasuryTransfer.findUnique({
        where: {
          branchId_idempotencyKey: {
            branchId: ctx.branchId,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        return { transfer: existing, isReplay: true };
      }

      // Check both accounts belong to branch
      const fromAcc = await tx.treasuryAccount.findFirst({
        where: { id: input.fromAccountId, branchId: ctx.branchId },
      });
      const toAcc = await tx.treasuryAccount.findFirst({
        where: { id: input.toAccountId, branchId: ctx.branchId },
      });
      if (!fromAcc || !toAcc) {
        throw new Error("One or both treasury accounts not found in this branch.");
      }

      // Check physical cash sufficiency
      const isPhysical = (
        [
          TreasuryAccountType.CASHIER_TILL,
          TreasuryAccountType.CASH_OFFICE_SAFE,
          TreasuryAccountType.PETTY_CASH_FLOAT,
        ] as TreasuryAccountType[]
      ).includes(fromAcc.accountType);

      if (isPhysical && fromAcc.currentBalance.lessThan(amount)) {
        throw new Error(
          `Insufficient physical cash in ${fromAcc.name}. Available: ${fromAcc.currentBalance.toString()} UGX, Requested: ${amount.toString()} UGX.`
        );
      }

      const transferNumber = await this.getNextTreasurySequence(tx, ctx.branchId, "TRF");

      // Determine initial status:
      // High-value transfers (> 5,000,000 UGX) require four-eye approval unless Cash Banking
      const highValueThreshold = new Prisma.Decimal(5000000);
      const requiresApproval =
        amount.greaterThan(highValueThreshold) &&
        input.transferMethod !== TransferMethod.TILL_TO_SAFE_SWEEP &&
        input.transferMethod !== TransferMethod.CASH_BANKING_DEPOSIT;

      if (requiresApproval) {
        const transfer = await tx.treasuryTransfer.create({
          data: {
            branchId: ctx.branchId,
            transferNumber,
            fromAccountId: fromAcc.id,
            toAccountId: toAcc.id,
            amount,
            transferMethod: input.transferMethod,
            depositSlipNumber: input.depositSlipNumber?.trim() || null,
            securityEscortDetails: input.securityEscortDetails?.trim() || null,
            notes: input.notes?.trim() || null,
            status: TransferStatus.PENDING_APPROVAL,
            initiatedById: ctx.userId,
            idempotencyKey,
          },
          include: { fromAccount: true, toAccount: true },
        });

        await AuditService.log(
          ctx,
          "INITIATE_TREASURY_TRANSFER",
          "TreasuryTransfer",
          transfer.id,
          JSON.stringify({ transferNumber, amount: amount.toString(), status: transfer.status })
        );

        return { transfer, isReplay: false };
      }

      // If Cash Banking Deposit: starts IN_TRANSIT, deducted from Safe immediately
      if (input.transferMethod === TransferMethod.CASH_BANKING_DEPOSIT) {
        const transfer = await tx.treasuryTransfer.create({
          data: {
            branchId: ctx.branchId,
            transferNumber,
            fromAccountId: fromAcc.id,
            toAccountId: toAcc.id,
            amount,
            transferMethod: input.transferMethod,
            depositSlipNumber: input.depositSlipNumber?.trim() || null,
            securityEscortDetails: input.securityEscortDetails?.trim() || null,
            notes: input.notes?.trim() || null,
            status: TransferStatus.IN_TRANSIT,
            initiatedById: ctx.userId,
            idempotencyKey,
          },
          include: { fromAccount: true, toAccount: true },
        });

        // Deduct from Cash Safe immediately
        await this.recordCashbookMovement(tx, ctx, {
          accountId: fromAcc.id,
          movementType: CashbookMovementType.BANK_DEPOSIT_OUT,
          direction: CashDirection.OUTFLOW,
          amount,
          description: `Cash Banking Dispatch to ${toAcc.name} (Transfer #${transferNumber})`,
          transferId: transfer.id,
        });

        await AuditService.log(
          ctx,
          "DISPATCH_CASH_BANKING",
          "TreasuryTransfer",
          transfer.id,
          JSON.stringify({ transferNumber, amount: amount.toString(), status: "IN_TRANSIT" })
        );

        return { transfer, isReplay: false };
      }

      // Standard immediate transfer
      const transfer = await tx.treasuryTransfer.create({
        data: {
          branchId: ctx.branchId,
          transferNumber,
          fromAccountId: fromAcc.id,
          toAccountId: toAcc.id,
          amount,
          transferMethod: input.transferMethod,
          depositSlipNumber: input.depositSlipNumber?.trim() || null,
          securityEscortDetails: input.securityEscortDetails?.trim() || null,
          notes: input.notes?.trim() || null,
          status: TransferStatus.COMPLETED,
          initiatedById: ctx.userId,
          approvedById: ctx.userId,
          completedAt: new Date(),
          idempotencyKey,
        },
        include: { fromAccount: true, toAccount: true },
      });

      // Leg 1: Outflow from source
      await this.recordCashbookMovement(tx, ctx, {
        accountId: fromAcc.id,
        movementType: CashbookMovementType.INTER_ACCOUNT_TRANSFER_OUT,
        direction: CashDirection.OUTFLOW,
        amount,
        description: `Transfer to ${toAcc.name} (Transfer #${transferNumber})`,
        transferId: transfer.id,
      });

      // Leg 2: Inflow to destination
      await this.recordCashbookMovement(tx, ctx, {
        accountId: toAcc.id,
        movementType: CashbookMovementType.INTER_ACCOUNT_TRANSFER_IN,
        direction: CashDirection.INFLOW,
        amount,
        description: `Transfer receipt from ${fromAcc.name} (Transfer #${transferNumber})`,
        transferId: transfer.id,
      });

      await AuditService.log(
        ctx,
        "EXECUTE_TREASURY_TRANSFER",
        "TreasuryTransfer",
        transfer.id,
        JSON.stringify({ transferNumber, amount: amount.toString(), status: "COMPLETED" })
      );

      return { transfer, isReplay: false };
    });
  }

  static async approveTreasuryTransfer(ctx: TenantContext, transferId: string) {
    this.checkPermission(ctx, "treasury:transfers:approve");

    return db.$transaction(async (tx) => {
      const lockedTransfers = await tx.$queryRaw<
        Array<{ id: string; status: TransferStatus; initiatedById: string }>
      >`
        SELECT "id", "status", "initiatedById"
        FROM "TreasuryTransfer"
        WHERE "id" = ${transferId} AND "branchId" = ${ctx.branchId}
        FOR UPDATE;
      `;
      const lockedTransfer = lockedTransfers[0];
      if (!lockedTransfer) {
        throw new Error("Transfer not found or access denied.");
      }
      if (lockedTransfer.status !== TransferStatus.PENDING_APPROVAL) {
        throw new Error(`Transfer cannot be approved in its current status: ${lockedTransfer.status}`);
      }

      const transfer = await tx.treasuryTransfer.findFirst({
        where: { id: transferId, branchId: ctx.branchId },
        include: { fromAccount: true, toAccount: true },
      });
      if (!transfer) {
        throw new Error("Transfer not found or access denied.");
      }

      // Anti-self-approval rule (Four-Eye principle)
      if (transfer.initiatedById === ctx.userId) {
        throw new Error("Self-approval of treasury transfers is strictly forbidden (Four-Eye principle).");
      }

      // Deduct from source
      await this.recordCashbookMovement(tx, ctx, {
        accountId: transfer.fromAccountId,
        movementType: CashbookMovementType.INTER_ACCOUNT_TRANSFER_OUT,
        direction: CashDirection.OUTFLOW,
        amount: transfer.amount,
        description: `Transfer to ${transfer.toAccount.name} (Transfer #${transfer.transferNumber})`,
        transferId: transfer.id,
      });

      // Credit destination
      await this.recordCashbookMovement(tx, ctx, {
        accountId: transfer.toAccountId,
        movementType: CashbookMovementType.INTER_ACCOUNT_TRANSFER_IN,
        direction: CashDirection.INFLOW,
        amount: transfer.amount,
        description: `Transfer receipt from ${transfer.fromAccount.name} (Transfer #${transfer.transferNumber})`,
        transferId: transfer.id,
      });

      const updated = await tx.treasuryTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.COMPLETED,
          approvedById: ctx.userId,
          completedAt: new Date(),
        },
        include: { fromAccount: true, toAccount: true },
      });

      await AuditService.log(
        ctx,
        "APPROVE_TREASURY_TRANSFER",
        "TreasuryTransfer",
        updated.id,
        JSON.stringify({ transferNumber: updated.transferNumber, approvedBy: ctx.userId })
      );

      return updated;
    });
  }

  static async confirmCashBankingDeposit(
    ctx: TenantContext,
    transferId: string,
    input: { depositSlipNumber: string; confirmedAt?: Date | string }
  ) {
    this.checkPermission(ctx, "treasury:transfers:approve");

    if (!input.depositSlipNumber || input.depositSlipNumber.trim().length === 0) {
      throw new Error("Stamped bank deposit slip number is mandatory.");
    }

    return db.$transaction(async (tx) => {
      const lockedTransfers = await tx.$queryRaw<
        Array<{ id: string; status: TransferStatus }>
      >`
        SELECT "id", "status"
        FROM "TreasuryTransfer"
        WHERE "id" = ${transferId} AND "branchId" = ${ctx.branchId}
        FOR UPDATE;
      `;
      const lockedTransfer = lockedTransfers[0];
      if (!lockedTransfer) {
        throw new Error("Bank deposit transfer not found or access denied.");
      }
      if (lockedTransfer.status !== TransferStatus.IN_TRANSIT) {
        throw new Error(`Deposit transfer is not in transit (current status: ${lockedTransfer.status}).`);
      }

      const transfer = await tx.treasuryTransfer.findFirst({
        where: { id: transferId, branchId: ctx.branchId },
        include: { fromAccount: true, toAccount: true },
      });
      if (!transfer) {
        throw new Error("Bank deposit transfer not found or access denied.");
      }

      // Credit Bank Account
      await this.recordCashbookMovement(tx, ctx, {
        accountId: transfer.toAccountId,
        movementType: CashbookMovementType.BANK_DEPOSIT_IN,
        direction: CashDirection.INFLOW,
        amount: transfer.amount,
        description: `Cash Banking Confirmation (Slip #${input.depositSlipNumber.trim()})`,
        referenceNumber: input.depositSlipNumber.trim(),
        transactionDate: input.confirmedAt ? new Date(input.confirmedAt) : new Date(),
        transferId: transfer.id,
      });

      const updated = await tx.treasuryTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.COMPLETED,
          depositSlipNumber: input.depositSlipNumber.trim(),
          approvedById: ctx.userId,
          completedAt: new Date(),
        },
        include: { fromAccount: true, toAccount: true },
      });

      await AuditService.log(
        ctx,
        "CONFIRM_CASH_BANKING_DEPOSIT",
        "TreasuryTransfer",
        updated.id,
        JSON.stringify({
          transferNumber: updated.transferNumber,
          depositSlipNumber: input.depositSlipNumber.trim(),
        })
      );

      // Post Cash Banking Confirmation to General Ledger (Phase 3.1L)
      try {
        await GLIntegrationService.postCashBankingConfirmation(tx, ctx, updated.id);
      } catch {
        // GL posting failure must not abort subledger transaction
      }

      return updated;
    });
  }

  // ============================================================================
  // 5. PETTY CASH IMPREST SUBSYSTEM
  // ============================================================================

  static async createPettyCashImprest(ctx: TenantContext, input: CreatePettyImprestInput) {
    this.checkPermission(ctx, "treasury:petty:replenish");

    const floatCeiling = new Prisma.Decimal(input.floatCeiling);
    const replenishmentThreshold = new Prisma.Decimal(input.replenishmentThreshold);

    if (floatCeiling.isNegative() || floatCeiling.isZero()) {
      throw new Error("Float ceiling must be positive.");
    }
    if (replenishmentThreshold.isNegative() || replenishmentThreshold.greaterThanOrEqualTo(floatCeiling)) {
      throw new Error("Replenishment threshold must be less than float ceiling.");
    }

    return db.pettyCashImprest.create({
      data: {
        branchId: ctx.branchId,
        accountId: input.accountId,
        custodianId: input.custodianId,
        name: input.name.trim(),
        floatCeiling,
        replenishmentThreshold,
        departmentId: input.departmentId || null,
      },
      include: {
        account: true,
        custodian: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  static async getPettyCashImprests(ctx: TenantContext) {
    this.checkPermission(ctx, "treasury:accounts:read");
    return db.pettyCashImprest.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      include: {
        account: true,
        custodian: { select: { id: true, firstName: true, lastName: true } },
        department: true,
      },
    });
  }

  static async createPettyCashVoucher(ctx: TenantContext, input: CreatePettyVoucherInput) {
    this.checkPermission(ctx, "treasury:petty:request");

    const requestedAmount = new Prisma.Decimal(input.requestedAmount);
    if (requestedAmount.isNegative() || requestedAmount.isZero()) {
      throw new Error("Requested petty cash amount must be positive.");
    }

    return db.$transaction(async (tx) => {
      const imprest = await tx.pettyCashImprest.findFirst({
        where: { id: input.imprestId, branchId: ctx.branchId, isActive: true },
      });
      if (!imprest) {
        throw new Error("Petty cash imprest not found or inactive.");
      }

      const voucherNumber = await this.getNextTreasurySequence(tx, ctx.branchId, "PCV");

      return tx.pettyCashVoucher.create({
        data: {
          branchId: ctx.branchId,
          imprestId: imprest.id,
          voucherNumber,
          requesterId: ctx.userId,
          purpose: input.purpose.trim(),
          categoryId: input.categoryId,
          budgetItemId: input.budgetItemId || null,
          requestedAmount,
          status: PettyVoucherStatus.SUBMITTED,
        },
        include: { imprest: true, category: true, requester: true },
      });
    });
  }

  static async approvePettyCashVoucher(
    ctx: TenantContext,
    voucherId: string,
    input: { approvedAmount: number | string | Prisma.Decimal }
  ) {
    this.checkPermission(ctx, "treasury:petty:approve");

    const approvedAmount = new Prisma.Decimal(input.approvedAmount);
    if (approvedAmount.isNegative() || approvedAmount.isZero()) {
      throw new Error("Approved amount must be positive.");
    }

    return db.pettyCashVoucher.update({
      where: { id: voucherId },
      data: {
        approvedAmount,
        status: PettyVoucherStatus.APPROVED,
        approvedById: ctx.userId,
      },
      include: { imprest: true, requester: true },
    });
  }

  static async disbursePettyCashVoucher(ctx: TenantContext, voucherId: string) {
    this.checkPermission(ctx, "treasury:petty:disburse");

    return db.$transaction(async (tx) => {
      const lockedVouchers = await tx.$queryRaw<
        Array<{ id: string; status: PettyVoucherStatus }>
      >`
        SELECT "id", "status"
        FROM "PettyCashVoucher"
        WHERE "id" = ${voucherId} AND "branchId" = ${ctx.branchId}
        FOR UPDATE;
      `;
      const lockedVoucher = lockedVouchers[0];
      if (!lockedVoucher) {
        throw new Error("Petty cash voucher not found or access denied.");
      }
      if (lockedVoucher.status !== PettyVoucherStatus.APPROVED) {
        throw new Error(`Voucher cannot be disbursed in current status: ${lockedVoucher.status}.`);
      }

      const voucher = await tx.pettyCashVoucher.findFirst({
        where: { id: voucherId, branchId: ctx.branchId },
        include: { imprest: { include: { account: true } } },
      });
      if (!voucher) {
        throw new Error("Petty cash voucher not found or access denied.");
      }

      const amountToDisburse = voucher.approvedAmount || voucher.requestedAmount;

      // Deduct from petty cash float account
      await this.recordCashbookMovement(tx, ctx, {
        accountId: voucher.imprest.accountId,
        movementType: CashbookMovementType.PETTY_CASH_DISBURSEMENT,
        direction: CashDirection.OUTFLOW,
        amount: amountToDisburse,
        description: `Petty Cash Voucher Disbursal (${voucher.voucherNumber}: ${voucher.purpose})`,
        pettyVoucherId: voucher.id,
      });

      return tx.pettyCashVoucher.update({
        where: { id: voucher.id },
        data: {
          disbursedAmount: amountToDisburse,
          status: PettyVoucherStatus.DISBURSED,
          disbursedAt: new Date(),
        },
      });
    });
  }

  static async retirePettyCashVoucher(
    ctx: TenantContext,
    voucherId: string,
    input: {
      spentAmount: number | string | Prisma.Decimal;
      changeReturned: number | string | Prisma.Decimal;
      receiptUrl?: string;
    }
  ) {
    this.checkPermission(ctx, "treasury:petty:disburse");

    const spent = new Prisma.Decimal(input.spentAmount);
    const change = new Prisma.Decimal(input.changeReturned);

    return db.$transaction(async (tx) => {
      const lockedVouchers = await tx.$queryRaw<
        Array<{ id: string; status: PettyVoucherStatus }>
      >`
        SELECT "id", "status"
        FROM "PettyCashVoucher"
        WHERE "id" = ${voucherId} AND "branchId" = ${ctx.branchId}
        FOR UPDATE;
      `;
      const lockedVoucher = lockedVouchers[0];
      if (!lockedVoucher) {
        throw new Error("Petty cash voucher not found or access denied.");
      }
      if (lockedVoucher.status !== PettyVoucherStatus.DISBURSED) {
        throw new Error(`Voucher cannot be retired in current status: ${lockedVoucher.status}.`);
      }

      const voucher = await tx.pettyCashVoucher.findFirst({
        where: { id: voucherId, branchId: ctx.branchId },
        include: { imprest: true },
      });
      if (!voucher) {
        throw new Error("Petty cash voucher not found or access denied.");
      }

      const disbursed = voucher.disbursedAmount || new Prisma.Decimal(0);
      if (!spent.add(change).equals(disbursed)) {
        throw new Error(
          `Retirement math mismatch: Spent (${spent.toString()}) + Change (${change.toString()}) != Disbursed (${disbursed.toString()}).`
        );
      }

      // If change was returned, credit float account
      if (change.greaterThan(0)) {
        await this.recordCashbookMovement(tx, ctx, {
          accountId: voucher.imprest.accountId,
          movementType: CashbookMovementType.PETTY_CASH_CHANGE_RETURN,
          direction: CashDirection.INFLOW,
          amount: change,
          description: `Change returned on Voucher #${voucher.voucherNumber}`,
          pettyVoucherId: voucher.id,
        });
      }

      return tx.pettyCashVoucher.update({
        where: { id: voucher.id },
        data: {
          spentAmount: spent,
          changeReturned: change,
          receiptUrl: input.receiptUrl || null,
          status: PettyVoucherStatus.RETIRED,
          retiredAt: new Date(),
        },
      });
    });
  }

  static async replenishPettyCashImprest(
    ctx: TenantContext,
    imprestId: string,
    input: { sourceAccountId: string }
  ) {
    this.checkPermission(ctx, "treasury:petty:replenish");

    return db.$transaction(async (tx) => {
      const imprest = await tx.pettyCashImprest.findFirst({
        where: { id: imprestId, branchId: ctx.branchId },
        include: { account: true },
      });
      if (!imprest) {
        throw new Error("Petty cash imprest not found or access denied.");
      }

      const retiredVouchers = await tx.pettyCashVoucher.findMany({
        where: {
          branchId: ctx.branchId,
          imprestId: imprest.id,
          status: PettyVoucherStatus.RETIRED,
          expenseId: null,
        },
      });

      if (retiredVouchers.length === 0) {
        throw new Error("No retired vouchers eligible for replenishment.");
      }

      const totalSpent = retiredVouchers.reduce(
        (acc, v) => acc.add(v.spentAmount || 0),
        new Prisma.Decimal(0)
      );

      if (totalSpent.isZero() || totalSpent.isNegative()) {
        throw new Error("Total spent amount on retired vouchers must be positive.");
      }

      // Outflow from Source Bank/Safe
      await this.recordCashbookMovement(tx, ctx, {
        accountId: input.sourceAccountId,
        movementType: CashbookMovementType.PETTY_CASH_REPLENISHMENT_OUT,
        direction: CashDirection.OUTFLOW,
        amount: totalSpent,
        description: `Petty Cash Float Replenishment for ${imprest.name} (${retiredVouchers.length} vouchers)`,
      });

      // Inflow to Petty Cash Float Account
      await this.recordCashbookMovement(tx, ctx, {
        accountId: imprest.accountId,
        movementType: CashbookMovementType.PETTY_CASH_REPLENISHMENT_IN,
        direction: CashDirection.INFLOW,
        amount: totalSpent,
        description: `Petty Cash Float Replenishment Restored (${retiredVouchers.length} vouchers)`,
      });

      // Create Expense record linking to ExpenseDAO
      const seqYear = new Date().getFullYear();
      const expSeq = await tx.expenseSequence.upsert({
        where: { branchId_year: { branchId: ctx.branchId, year: seqYear } },
        create: { branchId: ctx.branchId, year: seqYear, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      });
      const voucherNumber = `EXP-${seqYear}-${expSeq.lastValue.toString().padStart(5, '0')}`;
      const categoryId = retiredVouchers[0]?.categoryId;

      const expense = await tx.expense.create({
        data: {
          branchId: ctx.branchId,
          categoryId,
          idempotencyKey: `REPLENISH:${crypto.randomUUID()}`,
          voucherNumber,
          title: `Petty Cash Float Replenishment (${imprest.name})`,
          amount: totalSpent,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          status: 'COMPLETED',
          recordedById: ctx.userId,
          treasuryAccountId: input.sourceAccountId,
        },
      });

      // Mark vouchers as reimbursed
      await tx.pettyCashVoucher.updateMany({
        where: { id: { in: retiredVouchers.map((v) => v.id) } },
        data: { expenseId: expense.id },
      });

      return {
        imprestId: imprest.id,
        vouchersReplenished: retiredVouchers.length,
        totalReplenished: totalSpent,
      };
    });
  }

  // ============================================================================
  // 6. BANK STATEMENT IMPORT & DEDUPLICATION
  // ============================================================================

  static async importBankStatement(ctx: TenantContext, input: ImportStatementInput) {
    this.checkPermission(ctx, "treasury:statements:import");

    const fileHash = crypto.createHash("sha256").update(input.fileContentRaw).digest("hex");

    return db.$transaction(async (tx) => {
      // Check file duplicate by SHA-256
      const duplicate = await tx.bankStatement.findUnique({
        where: {
          branchId_fileHash: {
            branchId: ctx.branchId,
            fileHash,
          },
        },
      });
      if (duplicate) {
        throw new Error("Duplicate bank statement file detected (SHA-256 collision).");
      }

      // Check identifier uniqueness
      const existingId = await tx.bankStatement.findUnique({
        where: {
          branchId_accountId_statementIdentifier: {
            branchId: ctx.branchId,
            accountId: input.accountId,
            statementIdentifier: input.statementIdentifier.trim(),
          },
        },
      });
      if (existingId) {
        throw new Error(`Statement identifier '${input.statementIdentifier}' already imported for this account.`);
      }

      const statement = await tx.bankStatement.create({
        data: {
          branchId: ctx.branchId,
          accountId: input.accountId,
          statementIdentifier: input.statementIdentifier.trim(),
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          openingBalance: new Prisma.Decimal(input.openingBalance),
          closingBalance: new Prisma.Decimal(input.closingBalance),
          fileHash,
          importedById: ctx.userId,
        },
      });

      for (const line of input.lines) {
        await tx.bankStatementLine.create({
          data: {
            statementId: statement.id,
            branchId: ctx.branchId,
            transactionDate: new Date(line.transactionDate),
            valueDate: line.valueDate ? new Date(line.valueDate) : null,
            reference: line.reference?.trim() || null,
            narrative: line.narrative.trim(),
            amount: new Prisma.Decimal(line.amount),
            direction: line.direction,
            runningBalance: line.runningBalance ? new Prisma.Decimal(line.runningBalance) : null,
            matchStatus: StatementLineMatchStatus.UNRECONCILED,
          },
        });
      }

      await AuditService.log(
        ctx,
        "IMPORT_BANK_STATEMENT",
        "BankStatement",
        statement.id,
        JSON.stringify({ statementIdentifier: statement.statementIdentifier, linesCount: input.lines.length })
      );

      return statement;
    });
  }

  // ============================================================================
  // 7. DETERMINISTIC RECONCILIATION ENGINE & BRS
  // ============================================================================

  static async runDeterministicMatching(
    ctx: TenantContext,
    accountId: string,
    statementId: string
  ) {
    this.checkPermission(ctx, "treasury:reconcile:match");

    return db.$transaction(async (tx) => {
      const statement = await tx.bankStatement.findFirst({
        where: { id: statementId, accountId, branchId: ctx.branchId },
      });
      if (!statement) {
        throw new Error("Bank statement not found for specified account.");
      }

      // Unreconciled statement lines
      const lines = await tx.bankStatementLine.findMany({
        where: {
          statementId,
          branchId: ctx.branchId,
          matchStatus: StatementLineMatchStatus.UNRECONCILED,
        },
      });

      // Unreconciled cashbook movements for this account
      const movements = await tx.cashbookMovement.findMany({
        where: {
          branchId: ctx.branchId,
          accountId,
          isReconciled: false,
        },
      });

      let matchedCount = 0;

      for (const line of lines) {
        if (!line.reference || line.reference.trim().length === 0) continue;

        // Deterministic Match: Reference exact match + Amount exact match + Direction match
        const matchingMovement = movements.find(
          (m) =>
            !m.isReconciled &&
            m.referenceNumber &&
            m.referenceNumber.trim().toUpperCase() === line.reference!.trim().toUpperCase() &&
            m.amount.equals(line.amount) &&
            ((line.direction === CashDirection.INFLOW && m.direction === CashDirection.INFLOW) ||
              (line.direction === CashDirection.OUTFLOW && m.direction === CashDirection.OUTFLOW))
        );

        if (matchingMovement) {
          // Bind line and movement
          await tx.bankStatementLine.update({
            where: { id: line.id },
            data: {
              matchStatus: StatementLineMatchStatus.AUTO_MATCHED,
              matchedById: ctx.userId,
              matchedAt: new Date(),
            },
          });

          await tx.cashbookMovement.update({
            where: { id: matchingMovement.id },
            data: {
              isReconciled: true,
              reconciledAt: new Date(),
              statementLineId: line.id,
            },
          });

          matchingMovement.isReconciled = true;
          matchedCount++;
        }
      }

      await AuditService.log(
        ctx,
        "RUN_DETERMINISTIC_RECONCILIATION",
        "BankStatement",
        statementId,
        JSON.stringify({ matchedCount })
      );

      return { matchedCount };
    });
  }

  static async manualMatchLine(
    ctx: TenantContext,
    input: { statementLineId: string; cashbookMovementIds: string[]; notes: string }
  ) {
    this.checkPermission(ctx, "treasury:reconcile:match");

    if (!input.notes || input.notes.trim().length === 0) {
      throw new Error("Audit justification notes are mandatory for manual reconciliation matching.");
    }
    if (input.cashbookMovementIds.length === 0) {
      throw new Error("At least one cashbook movement must be selected for matching.");
    }

    return db.$transaction(async (tx) => {
      const line = await tx.bankStatementLine.findFirst({
        where: { id: input.statementLineId, branchId: ctx.branchId },
      });
      if (!line) {
        throw new Error("Bank statement line not found.");
      }

      const movements = await tx.cashbookMovement.findMany({
        where: { id: { in: input.cashbookMovementIds }, branchId: ctx.branchId },
      });

      const totalMovements = movements.reduce((acc, m) => acc.add(m.amount), new Prisma.Decimal(0));
      if (!totalMovements.equals(line.amount)) {
        throw new Error(
          `Amount mismatch: Selected movements total (${totalMovements.toString()}) does not match statement line (${line.amount.toString()}).`
        );
      }

      await tx.bankStatementLine.update({
        where: { id: line.id },
        data: {
          matchStatus: StatementLineMatchStatus.MANUALLY_MATCHED,
          matchNotes: input.notes.trim(),
          matchedById: ctx.userId,
          matchedAt: new Date(),
        },
      });

      for (const m of movements) {
        await tx.cashbookMovement.update({
          where: { id: m.id },
          data: {
            isReconciled: true,
            reconciledAt: new Date(),
            statementLineId: line.id,
          },
        });
      }

      await AuditService.log(
        ctx,
        "MANUAL_MATCH_RECONCILIATION_LINE",
        "BankStatementLine",
        line.id,
        JSON.stringify({ notes: input.notes, movementCount: movements.length })
      );

      return { success: true };
    });
  }

  static async calculateBankReconciliation(
    ctx: TenantContext,
    accountId: string,
    statementId: string
  ) {
    this.checkPermission(ctx, "treasury:accounts:read");

    const statement = await db.bankStatement.findFirst({
      where: { id: statementId, accountId, branchId: ctx.branchId },
    });
    if (!statement) {
      throw new Error("Bank statement not found.");
    }

    const account = await db.treasuryAccount.findFirst({
      where: { id: accountId, branchId: ctx.branchId },
    });
    if (!account) {
      throw new Error("Treasury account not found.");
    }

    // Unmatched movements up to statement end date
    const unmatchedMovements = await db.cashbookMovement.findMany({
      where: {
        branchId: ctx.branchId,
        accountId,
        isReconciled: false,
        transactionDate: { lte: statement.endDate },
      },
    });

    let totalDepositsInTransit = new Prisma.Decimal(0);
    let totalUnpresentedCheques = new Prisma.Decimal(0);

    for (const m of unmatchedMovements) {
      if (m.direction === CashDirection.INFLOW) {
        totalDepositsInTransit = totalDepositsInTransit.add(m.amount);
      } else {
        totalUnpresentedCheques = totalUnpresentedCheques.add(m.amount);
      }
    }

    // Unmatched statement lines
    const unmatchedLines = await db.bankStatementLine.findMany({
      where: {
        statementId,
        branchId: ctx.branchId,
        matchStatus: StatementLineMatchStatus.UNRECONCILED,
      },
    });

    let totalBankCharges = new Prisma.Decimal(0);
    let totalBankInterest = new Prisma.Decimal(0);

    for (const l of unmatchedLines) {
      if (l.direction === CashDirection.OUTFLOW) {
        totalBankCharges = totalBankCharges.add(l.amount);
      } else {
        totalBankInterest = totalBankInterest.add(l.amount);
      }
    }

    const statementClosingBalance = statement.closingBalance;
    const cashbookClosingBalance = account.currentBalance;

    const adjustedBankBalance = statementClosingBalance
      .add(totalDepositsInTransit)
      .minus(totalUnpresentedCheques);

    const adjustedCashbookBalance = cashbookClosingBalance
      .minus(totalBankCharges)
      .add(totalBankInterest);

    const variance = adjustedBankBalance.minus(adjustedCashbookBalance).abs();

    return {
      statementId: statement.id,
      accountId: account.id,
      statementClosingBalance,
      cashbookClosingBalance,
      totalDepositsInTransit,
      totalUnpresentedCheques,
      totalBankCharges,
      totalBankInterest,
      adjustedBankBalance,
      adjustedCashbookBalance,
      variance,
      isBalanced: variance.isZero(),
    };
  }

  static async certifyAndLockBankReconciliation(
    ctx: TenantContext,
    input: { statementId: string; accountId: string; notes?: string }
  ) {
    this.checkPermission(ctx, "treasury:reconcile:certify");

    const calc = await this.calculateBankReconciliation(ctx, input.accountId, input.statementId);

    if (!calc.isBalanced) {
      throw new Error(
        `Cannot certify BRS with non-zero reconciliation variance (${calc.variance.toString()} UGX). Statement must balance to zero.`
      );
    }

    return db.$transaction(async (tx) => {
      const statement = await tx.bankStatement.findUnique({
        where: { id: input.statementId },
      });
      if (!statement) throw new Error("Statement not found.");

      const reconciliationNumber = await this.getNextTreasurySequence(tx, ctx.branchId, "BRS");

      const reconciliation = await tx.bankReconciliation.create({
        data: {
          branchId: ctx.branchId,
          accountId: input.accountId,
          statementId: input.statementId,
          reconciliationNumber,
          periodStartDate: statement.startDate,
          periodEndDate: statement.endDate,
          statementClosingBalance: calc.statementClosingBalance,
          cashbookClosingBalance: calc.cashbookClosingBalance,
          totalDepositsInTransit: calc.totalDepositsInTransit,
          totalUnpresentedCheques: calc.totalUnpresentedCheques,
          totalBankCharges: calc.totalBankCharges,
          totalBankInterest: calc.totalBankInterest,
          adjustedBankBalance: calc.adjustedBankBalance,
          adjustedCashbookBalance: calc.adjustedCashbookBalance,
          variance: calc.variance,
          status: BRSStatus.LOCKED,
          certifiedById: ctx.userId,
          certifiedAt: new Date(),
          notes: input.notes?.trim() || null,
        },
      });

      await AuditService.log(
        ctx,
        "CERTIFY_BANK_RECONCILIATION",
        "BankReconciliation",
        reconciliation.id,
        JSON.stringify({ reconciliationNumber, adjustedBalance: calc.adjustedBankBalance.toString() })
      );

      return reconciliation;
    });
  }

  // ============================================================================
  // 8. EXECUTIVE REPORTING & INTEGRITY AUDIT
  // ============================================================================

  static async getLiquiditySummary(ctx: TenantContext) {
    this.checkPermission(ctx, "treasury:accounts:read");

    const accounts = await db.treasuryAccount.findMany({
      where: { branchId: ctx.branchId, isActive: true },
    });

    const summary = {
      commercialBanks: new Prisma.Decimal(0),
      cashSafes: new Prisma.Decimal(0),
      cashierTills: new Prisma.Decimal(0),
      mobileMoneyFloats: new Prisma.Decimal(0),
      pettyCashFloats: new Prisma.Decimal(0),
      totalLiquidity: new Prisma.Decimal(0),
    };

    for (const acc of accounts) {
      summary.totalLiquidity = summary.totalLiquidity.add(acc.currentBalance);
      if (acc.accountType === TreasuryAccountType.COMMERCIAL_BANK) {
        summary.commercialBanks = summary.commercialBanks.add(acc.currentBalance);
      } else if (acc.accountType === TreasuryAccountType.CASH_OFFICE_SAFE) {
        summary.cashSafes = summary.cashSafes.add(acc.currentBalance);
      } else if (acc.accountType === TreasuryAccountType.CASHIER_TILL) {
        summary.cashierTills = summary.cashierTills.add(acc.currentBalance);
      } else if (acc.accountType === TreasuryAccountType.MOBILE_MONEY_FLOAT) {
        summary.mobileMoneyFloats = summary.mobileMoneyFloats.add(acc.currentBalance);
      } else if (acc.accountType === TreasuryAccountType.PETTY_CASH_FLOAT) {
        summary.pettyCashFloats = summary.pettyCashFloats.add(acc.currentBalance);
      }
    }

    return summary;
  }

  static async assertLedgerIntegrity(ctx: TenantContext, accountId: string) {
    const account = await db.treasuryAccount.findFirst({
      where: { id: accountId, branchId: ctx.branchId },
    });
    if (!account) throw new Error("Account not found.");

    const movements = await db.cashbookMovement.findMany({
      where: { branchId: ctx.branchId, accountId },
    });

    let sum = new Prisma.Decimal(account.openingBalance);
    for (const m of movements) {
      if (m.movementType === CashbookMovementType.OPENING_BALANCE) continue;
      if (m.direction === CashDirection.INFLOW) sum = sum.add(m.amount);
      else sum = sum.minus(m.amount);
    }

    const drift = account.currentBalance.minus(sum);
    return {
      accountId: account.id,
      storedBalance: account.currentBalance,
      ledgerDerivedBalance: sum,
      drift,
      isExactMatch: drift.isZero(),
    };
  }
}
