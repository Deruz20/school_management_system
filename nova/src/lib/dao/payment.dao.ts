import { db } from "../db";
import {
  Prisma,
  PaymentMethod,
  PaymentStatus,
  AllocationStatus,
  ReceiptStatus,
  InvoiceStatus,
  LedgerEntryType,
  LedgerDirection,
  CashbookMovementType,
  CashDirection,
  TreasuryAccountType,
  SessionStatus
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { LedgerDAO } from "./ledger.dao";
import { TreasuryDAO } from "./treasury.dao";
import { amountToWords } from "../utils/number-to-words";
import crypto from "crypto";

export interface ManualAllocationItem {
  invoiceId: string;
  amount: number | string | Prisma.Decimal;
}

export interface RecordPaymentInput {
  studentId: string;
  amount: number | string | Prisma.Decimal;
  paymentMethod: PaymentMethod;
  paymentDate?: Date | string;
  externalReference?: string | null;
  payerName?: string | null;
  payerPhone?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  manualAllocations?: ManualAllocationItem[];
  treasuryAccountId?: string | null;
}

export interface ListPaymentsFilters {
  studentId?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  startDate?: Date | string;
  endDate?: Date | string;
  page?: number;
  limit?: number;
}

export class PaymentDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:read') ||
      perms.includes('fees:payments:read') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:payments:write') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:payments:write");
  }

  private static checkReversePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:payments:reverse') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:payments:reverse");
  }

  /**
   * Concurrency-safe atomic sequence generator for Payment Numbers (e.g. PAY-2026-00001).
   */
  static async generateNextPaymentNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
    date: Date = new Date()
  ): Promise<string> {
    const year = date.getFullYear();
    const fallbackId = crypto.randomUUID();

    const result = await tx.$queryRaw<{ lastValue: number }[]>`
      INSERT INTO "PaymentSequence" ("id", "branchId", "year", "lastValue", "updatedAt")
      VALUES (${fallbackId}, ${branchId}, ${year}, 1, NOW())
      ON CONFLICT ("branchId", "year")
      DO UPDATE SET "lastValue" = "PaymentSequence"."lastValue" + 1, "updatedAt" = NOW()
      RETURNING "lastValue";
    `;

    const seq = result[0]?.lastValue ?? 1;
    return `PAY-${year}-${seq.toString().padStart(5, '0')}`;
  }

  /**
   * Concurrency-safe atomic sequence generator for Receipt Numbers (e.g. REC-2026-00001).
   */
  static async generateNextReceiptNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
    date: Date = new Date()
  ): Promise<string> {
    const year = date.getFullYear();
    const fallbackId = crypto.randomUUID();

    const result = await tx.$queryRaw<{ lastValue: number }[]>`
      INSERT INTO "ReceiptSequence" ("id", "branchId", "year", "lastValue", "updatedAt")
      VALUES (${fallbackId}, ${branchId}, ${year}, 1, NOW())
      ON CONFLICT ("branchId", "year")
      DO UPDATE SET "lastValue" = "ReceiptSequence"."lastValue" + 1, "updatedAt" = NOW()
      RETURNING "lastValue";
    `;

    const seq = result[0]?.lastValue ?? 1;
    return `REC-${year}-${seq.toString().padStart(5, '0')}`;
  }

  /**
   * Record a Payment with atomic FIFO allocation (or manual override), subledger credit, and receipt snapshot.
   * Idempotent against duplicated client requests or webhook replays.
   */
  static async recordPayment(ctx: TenantContext, input: RecordPaymentInput) {
    this.checkWritePermission(ctx);

    // 1. Validate student
    const student = await db.student.findFirst({
      where: { id: input.studentId, branchId: ctx.branchId },
      include: {
        classRef: { select: { name: true } },
        streamRef: { select: { name: true } }
      }
    });
    if (!student) {
      throw new Error("Student not found or access denied.");
    }

    // 2. Validate amount
    const paymentAmount = new Prisma.Decimal(input.amount);
    if (paymentAmount.isNegative() || paymentAmount.isZero() || paymentAmount.isNaN()) {
      throw new Error("Payment amount must be a positive number.");
    }

    // 3. Resolve idempotency key
    const idempotencyKey = input.idempotencyKey?.trim() || `MANUAL:${crypto.randomUUID()}`;

    // 4. Idempotency Check (Duplicate Request / Webhook Replay)
    const existingPayment = await db.payment.findUnique({
      where: {
        branchId_idempotencyKey: {
          branchId: ctx.branchId,
          idempotencyKey
        }
      },
      include: {
        allocations: { include: { invoice: true } },
        receipt: true,
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } }
      }
    });

    if (existingPayment) {
      return {
        payment: existingPayment,
        isReplay: true
      };
    }

    // 5. Fetch cashier user info
    const cashier = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { firstName: true, lastName: true }
    });
    const cashierName = cashier ? `${cashier.firstName} ${cashier.lastName}`.trim() : "Cashier";

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();

    // 6. Execute atomic transaction
    const createdPayment = await db.$transaction(async (tx) => {
      // Step A: Pessimistic Row Lock on Student
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${input.studentId} FOR UPDATE`;

      // Step B: Generate unique sequential identifiers
      const paymentNumber = await this.generateNextPaymentNumber(tx, ctx.branchId, paymentDate);
      const receiptNumber = await this.generateNextReceiptNumber(tx, ctx.branchId, paymentDate);

      // Step C: Determine Allocations
      interface PlannedAlloc {
        invoiceId: string;
        amount: Prisma.Decimal;
        newStatus: InvoiceStatus;
      }
      const plannedAllocations: PlannedAlloc[] = [];

      if (input.manualAllocations && input.manualAllocations.length > 0) {
        // Manual Allocation Override
        let totalManualAlloc = new Prisma.Decimal(0);

        for (const item of input.manualAllocations) {
          const itemAmt = new Prisma.Decimal(item.amount);
          if (itemAmt.isNegative() || itemAmt.isZero() || itemAmt.isNaN()) {
            throw new Error("Manual allocation amount must be positive.");
          }
          totalManualAlloc = totalManualAlloc.add(itemAmt);

          const invoice = await tx.invoice.findFirst({
            where: { id: item.invoiceId, branchId: ctx.branchId, studentId: input.studentId },
            include: { allocations: { where: { status: AllocationStatus.ACTIVE } } }
          });

          if (!invoice || invoice.status === InvoiceStatus.VOID) {
            throw new Error(`Invoice #${item.invoiceId} is invalid, voided, or belongs to another student.`);
          }

          const existingPaid = invoice.allocations.reduce(
            (acc, a) => acc.add(a.amount),
            new Prisma.Decimal(0)
          );
          const outstanding = invoice.netAmount.minus(existingPaid);

          if (itemAmt.greaterThan(outstanding)) {
            throw new Error(
              `Allocation of ${itemAmt.toString()} exceeds outstanding invoice balance of ${outstanding.toString()} on Invoice #${invoice.invoiceNumber}.`
            );
          }

          const totalPaidAfter = existingPaid.add(itemAmt);
          const newStatus = totalPaidAfter.equals(invoice.netAmount) ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

          plannedAllocations.push({
            invoiceId: invoice.id,
            amount: itemAmt,
            newStatus
          });
        }

        if (totalManualAlloc.greaterThan(paymentAmount)) {
          throw new Error(
            `Total allocated amounts (${totalManualAlloc.toString()}) cannot exceed the payment amount (${paymentAmount.toString()}).`
          );
        }
      } else {
        // Deterministic FIFO Allocation
        // Order: dueDate ASC, issueDate ASC, invoiceNumber ASC, id ASC
        const candidateInvoices = await tx.invoice.findMany({
          where: {
            branchId: ctx.branchId,
            studentId: input.studentId,
            status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] }
          },
          include: {
            allocations: { where: { status: AllocationStatus.ACTIVE } }
          },
          orderBy: [
            { dueDate: 'asc' },
            { issueDate: 'asc' },
            { invoiceNumber: 'asc' },
            { id: 'asc' }
          ]
        });

        let remainingPayment = new Prisma.Decimal(paymentAmount);

        for (const invoice of candidateInvoices) {
          if (remainingPayment.isZero() || remainingPayment.isNegative()) break;

          const alreadyPaid = invoice.allocations.reduce(
            (acc, a) => acc.add(a.amount),
            new Prisma.Decimal(0)
          );
          const outstanding = invoice.netAmount.minus(alreadyPaid);

          if (outstanding.greaterThan(0)) {
            const allocAmount = remainingPayment.greaterThan(outstanding)
              ? outstanding
              : remainingPayment;

            const totalPaidAfter = alreadyPaid.add(allocAmount);
            const newStatus = totalPaidAfter.equals(invoice.netAmount) ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

            plannedAllocations.push({
              invoiceId: invoice.id,
              amount: allocAmount,
              newStatus
            });

            remainingPayment = remainingPayment.minus(allocAmount);
          }
        }
      }

      // Step D0: Resolve Treasury Account (Phase 3.1K)
      let resolvedTreasuryAccountId = input.treasuryAccountId || null;
      if (!resolvedTreasuryAccountId) {
        if (input.paymentMethod === PaymentMethod.CASH) {
          const activeShift = await tx.cashierShiftSession.findFirst({
            where: { branchId: ctx.branchId, cashierId: ctx.userId, status: SessionStatus.OPEN },
          });
          if (activeShift) {
            resolvedTreasuryAccountId = activeShift.tillAccountId;
          } else {
            const defaultCash = await tx.treasuryAccount.findFirst({
              where: {
                branchId: ctx.branchId,
                accountType: { in: [TreasuryAccountType.CASHIER_TILL, TreasuryAccountType.CASH_OFFICE_SAFE] },
                isActive: true,
              },
            });
            if (defaultCash) resolvedTreasuryAccountId = defaultCash.id;
          }
        } else {
          const defaultBank = await tx.treasuryAccount.findFirst({
            where: {
              branchId: ctx.branchId,
              isDefaultFeeCollection: true,
              isActive: true,
            },
          });
          if (defaultBank) resolvedTreasuryAccountId = defaultBank.id;
        }
      }

      // Step D: Create Payment Record
      const payment = await tx.payment.create({
        data: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          idempotencyKey,
          paymentNumber,
          amount: paymentAmount,
          paymentDate,
          paymentMethod: input.paymentMethod,
          externalReference: input.externalReference?.trim() || null,
          payerName: input.payerName?.trim() || null,
          payerPhone: input.payerPhone?.trim() || null,
          status: PaymentStatus.COMPLETED,
          notes: input.notes?.trim() || null,
          collectedById: ctx.userId,
          treasuryAccountId: resolvedTreasuryAccountId,
        }
      });

      // Step E: Create Payment Allocations & Update Invoices
      for (const alloc of plannedAllocations) {
        await tx.paymentAllocation.create({
          data: {
            branchId: ctx.branchId,
            paymentId: payment.id,
            invoiceId: alloc.invoiceId,
            amount: alloc.amount,
            status: AllocationStatus.ACTIVE
          }
        });

        await tx.invoice.update({
          where: { id: alloc.invoiceId },
          data: { status: alloc.newStatus }
        });
      }

      // Step F: Post to Student Subledger (CREDIT)
      await LedgerDAO.postEntry(tx, {
        branchId: ctx.branchId,
        studentId: input.studentId,
        entryType: LedgerEntryType.PAYMENT,
        direction: LedgerDirection.CREDIT,
        amount: paymentAmount,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        description: `Payment via ${input.paymentMethod} (Receipt #${receiptNumber})`,
        createdById: ctx.userId
      });

      // Step G: Create Dedicated Immutable Receipt
      const studentFullName = `${student.firstName} ${student.lastName}`.trim();
      const studentClass = student.classRef?.name || "-";
      const amountWords = amountToWords(paymentAmount.toString(), "Uganda Shillings");

      const receipt = await tx.receipt.create({
        data: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          paymentId: payment.id,
          receiptNumber,
          issuedAt: paymentDate,
          cashierName,
          studentName: studentFullName,
          admissionNo: student.admissionNo,
          className: studentClass,
          amountFigures: paymentAmount,
          amountWords,
          paymentMethod: input.paymentMethod,
          externalRef: input.externalReference?.trim() || null,
          status: ReceiptStatus.ISSUED
        }
      });

      // Step H: Record Cashbook Movement in Treasury (Phase 3.1K)
      if (resolvedTreasuryAccountId) {
        await TreasuryDAO.recordCashbookMovement(tx, ctx, {
          accountId: resolvedTreasuryAccountId,
          movementType: CashbookMovementType.FEE_PAYMENT_RECEIPT,
          direction: CashDirection.INFLOW,
          amount: paymentAmount,
          description: `Fee Payment Receipt #${receiptNumber} (${studentFullName})`,
          referenceNumber: receiptNumber,
          paymentId: payment.id,
          transactionDate: paymentDate,
        });
      }

      return {
        ...payment,
        receipt,
        allocations: plannedAllocations
      };
    });

    // 7. Audit Log
    await AuditService.log(
      ctx,
      'CREATE_PAYMENT',
      'Payment',
      createdPayment.id,
      JSON.stringify({
        studentId: input.studentId,
        paymentNumber: createdPayment.paymentNumber,
        receiptNumber: createdPayment.receipt.receiptNumber,
        amount: paymentAmount.toString(),
        paymentMethod: input.paymentMethod,
        allocatedCount: createdPayment.allocations.length
      })
    );

    return {
      payment: createdPayment,
      isReplay: false
    };
  }

  /**
   * Non-destructive payment reversal.
   * Marks Payment REVERSED, marks Receipt VOID, reverses allocations,
   * recalculates affected invoices' statuses, and posts compensating DEBIT to subledger.
   */
  static async reversePayment(ctx: TenantContext, paymentId: string, reason: string) {
    this.checkReversePermission(ctx);

    const reversalReason = reason?.trim();
    if (!reversalReason) {
      throw new Error("Reversal reason is mandatory.");
    }

    const payment = await db.payment.findFirst({
      where: { id: paymentId, branchId: ctx.branchId },
      include: {
        receipt: true,
        allocations: { where: { status: AllocationStatus.ACTIVE } }
      }
    });

    if (!payment) {
      throw new Error("Payment not found or access denied.");
    }

    if (payment.status === PaymentStatus.REVERSED) {
      throw new Error("Payment is already reversed.");
    }

    const reversed = await db.$transaction(async (tx) => {
      // 1. Lock student row
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${payment.studentId} FOR UPDATE`;

      // 2. Mark Payment as REVERSED
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REVERSED,
          reversalReason,
          reversedAt: new Date(),
          reversedById: ctx.userId
        }
      });

      // 3. Mark Receipt as VOID
      if (payment.receipt) {
        await tx.receipt.update({
          where: { id: payment.receipt.id },
          data: {
            status: ReceiptStatus.VOID,
            voidReason: `Payment Reversed: ${reversalReason}`,
            voidedAt: new Date()
          }
        });
      }

      // 4. Mark linked allocations as REVERSED
      const affectedInvoiceIds: string[] = [];
      for (const alloc of payment.allocations) {
        await tx.paymentAllocation.update({
          where: { id: alloc.id },
          data: { status: AllocationStatus.REVERSED }
        });
        affectedInvoiceIds.push(alloc.invoiceId);
      }

      // 5. Recalculate each affected invoice from surviving ACTIVE allocations
      for (const invId of affectedInvoiceIds) {
        const invoice = await tx.invoice.findUnique({
          where: { id: invId },
          include: { allocations: { where: { status: AllocationStatus.ACTIVE } } }
        });

        if (invoice && invoice.status !== InvoiceStatus.VOID) {
          const survivingPaid = invoice.allocations.reduce(
            (acc, a) => acc.add(a.amount),
            new Prisma.Decimal(0)
          );

          let newStatus: InvoiceStatus = InvoiceStatus.PENDING;
          if (survivingPaid.greaterThanOrEqualTo(invoice.netAmount)) {
            newStatus = InvoiceStatus.PAID;
          } else if (survivingPaid.greaterThan(0)) {
            newStatus = InvoiceStatus.PARTIAL;
          } else {
            newStatus = invoice.dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.PENDING;
          }

          await tx.invoice.update({
            where: { id: invId },
            data: { status: newStatus }
          });
        }
      }

      // 6. Post Compensating Subledger Entry (DEBIT)
      const receiptRef = payment.receipt?.receiptNumber || payment.paymentNumber;
      await LedgerDAO.postEntry(tx, {
        branchId: ctx.branchId,
        studentId: payment.studentId,
        entryType: LedgerEntryType.PAYMENT_REVERSAL,
        direction: LedgerDirection.DEBIT,
        amount: payment.amount,
        referenceType: "PAYMENT_REVERSAL",
        referenceId: payment.id,
        description: `Payment Reversal of Receipt #${receiptRef}: ${reversalReason}`,
        createdById: ctx.userId
      });

      // 6b. Reverse Treasury Movement if linked (Phase 3.1K)
      if (payment.treasuryAccountId) {
        await TreasuryDAO.recordCashbookMovement(tx, ctx, {
          accountId: payment.treasuryAccountId,
          movementType: CashbookMovementType.PAYMENT_REVERSAL_OUT,
          direction: CashDirection.OUTFLOW,
          amount: payment.amount,
          description: `Payment Reversal of Receipt #${receiptRef}: ${reversalReason}`,
          referenceNumber: receiptRef,
          paymentId: payment.id,
        });
      }

      return updatedPayment;
    });

    // 7. Audit Log
    await AuditService.log(
      ctx,
      'REVERSE_PAYMENT',
      'Payment',
      paymentId,
      JSON.stringify({
        paymentId,
        paymentNumber: payment.paymentNumber,
        receiptNumber: payment.receipt?.receiptNumber,
        amount: payment.amount.toString(),
        reason: reversalReason
      })
    );

    return reversed;
  }

  /**
   * Get single Payment by ID with full details.
   */
  static async getPayment(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const payment = await db.payment.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNo: true,
            classRef: { select: { name: true } },
            streamRef: { select: { name: true } }
          }
        },
        receipt: true,
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                grossAmount: true,
                discountAmount: true,
                netAmount: true,
                dueDate: true,
                status: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new Error("Payment not found or access denied.");
    }

    const totalAllocated = payment.allocations
      .filter(a => a.status === AllocationStatus.ACTIVE)
      .reduce((acc, a) => acc.add(a.amount), new Prisma.Decimal(0));

    return {
      ...payment,
      allocatedAmount: totalAllocated,
      unallocatedAmount: payment.amount.minus(totalAllocated)
    };
  }

  /**
   * List payments with filtering and pagination.
   */
  static async listPayments(ctx: TenantContext, filters: ListPaymentsFilters = {}) {
    this.checkReadPermission(ctx);

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      branchId: ctx.branchId,
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            paymentDate: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {})
            }
          }
        : {})
    };

    const [total, payments] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNo: true,
              classRef: { select: { name: true } }
            }
          },
          receipt: { select: { id: true, receiptNumber: true, status: true } },
          allocations: {
            where: { status: AllocationStatus.ACTIVE },
            select: { amount: true }
          }
        },
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit
      })
    ]);

    const formatted = payments.map(p => {
      const allocated = p.allocations.reduce((acc, a) => acc.add(a.amount), new Prisma.Decimal(0));
      return {
        id: p.id,
        paymentNumber: p.paymentNumber,
        receiptNumber: p.receipt?.receiptNumber || "-",
        receiptId: p.receipt?.id || null,
        student: p.student,
        amount: p.amount,
        allocatedAmount: allocated,
        unallocatedAmount: p.amount.minus(allocated),
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        externalReference: p.externalReference,
        payerName: p.payerName,
        status: p.status,
        createdAt: p.createdAt
      };
    });

    return {
      payments: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get printable receipt data DTO.
   */
  static async getReceipt(ctx: TenantContext, receiptIdOrPaymentId: string) {
    this.checkReadPermission(ctx);

    const receipt = await db.receipt.findFirst({
      where: {
        branchId: ctx.branchId,
        OR: [
          { id: receiptIdOrPaymentId },
          { paymentId: receiptIdOrPaymentId }
        ]
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            school: { select: { name: true } },
            settings: { select: { brandingLogoUrl: true, brandingMotto: true } }
          }
        },
        payment: {
          include: {
            allocations: {
              where: { status: AllocationStatus.ACTIVE },
              include: {
                invoice: {
                  select: {
                    id: true,
                    invoiceNumber: true,
                    netAmount: true,
                    dueDate: true
                  }
                }
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNo: true,
            classRef: { select: { name: true } },
            streamRef: { select: { name: true } }
          }
        }
      }
    });

    if (!receipt) {
      throw new Error("Receipt not found or access denied.");
    }

    // Get current student balance for receipt footer
    const ledger = await LedgerDAO.getBalance(ctx, receipt.studentId);

    return {
      receipt: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        issuedAt: receipt.issuedAt,
        cashierName: receipt.cashierName,
        status: receipt.status,
        voidedAt: receipt.voidedAt,
        voidReason: receipt.voidReason,
        amountFigures: receipt.amountFigures,
        amountWords: receipt.amountWords,
        paymentMethod: receipt.paymentMethod,
        externalReference: receipt.externalRef
      },
      school: {
        name: receipt.branch.school.name,
        branchName: receipt.branch.name,
        logoUrl: receipt.branch.settings?.brandingLogoUrl || null,
        motto: receipt.branch.settings?.brandingMotto || null
      },
      student: {
        id: receipt.student.id,
        fullName: `${receipt.student.firstName} ${receipt.student.lastName}`.trim(),
        admissionNo: receipt.student.admissionNo,
        className: receipt.student.classRef?.name || "-",
        streamName: receipt.student.streamRef?.name || null
      },
      settlementBreakdown: receipt.payment.allocations.map(a => ({
        invoiceNumber: a.invoice.invoiceNumber,
        allocatedAmount: a.amount,
        invoiceNetAmount: a.invoice.netAmount,
        dueDate: a.invoice.dueDate
      })),
      accountSummary: {
        currentStudentBalance: ledger.balance,
        totalBilledToDate: ledger.totalDebits,
        totalPaidToDate: ledger.totalCredits
      }
    };
  }
}
