import { db } from '../db';
import { Prisma, SchoolPayTxStatus, PaymentMethod, SchoolPayTransaction, SchoolPaySourceChannel } from '@prisma/client';
import { TenantContext } from './tenant-context';
import { AuditService } from '../services/audit.service';
import { PaymentDAO } from './payment.dao';
import { SchoolPayInboundDTO, schoolPayAdapter } from '../adapters/schoolpay.adapter';

export interface SchoolPayTransactionFilter {
  status?: SchoolPayTxStatus | 'ALL';
  search?: string;
  channel?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface StudentCandidateSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  schoolPayCode: string | null;
  className: string;
  streamName: string;
  matchScore: number;
}

export type SchoolPayTransactionWithRelations = SchoolPayTransaction & {
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNo: string;
    classRef: { name: string } | null;
    streamRef: { name: string } | null;
  } | null;
  payment?: {
    id: string;
    paymentNumber: string;
    receipt: { receiptNumber: string } | null;
  } | null;
};

export class SchoolPayDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId) throw new Error("Unauthorized");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:read') ||
      perms.includes('fees:schoolpay:read') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new Error("Missing permission: fees:schoolpay:read");
  }

  private static checkPostPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new Error("Unauthorized");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:write') ||
      perms.includes('fees:schoolpay:post') ||
      perms.includes('fees:payments:write')
    ) {
      return true;
    }
    throw new Error("Missing permission: fees:schoolpay:post");
  }

  private static checkAssignPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new Error("Unauthorized");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:write') ||
      perms.includes('fees:schoolpay:assign') ||
      perms.includes('fees:payments:write')
    ) {
      return true;
    }
    throw new Error("Missing permission: fees:schoolpay:assign");
  }

  private static checkIgnorePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new Error("Unauthorized");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:write') ||
      perms.includes('fees:schoolpay:ignore')
    ) {
      return true;
    }
    throw new Error("Missing permission: fees:schoolpay:ignore");
  }

  private static checkRetryPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new Error("Unauthorized");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:write') ||
      perms.includes('fees:schoolpay:retry')
    ) {
      return true;
    }
    throw new Error("Missing permission: fees:schoolpay:retry");
  }

  private static checkSyncPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new Error("Unauthorized");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:write') ||
      perms.includes('fees:schoolpay:sync')
    ) {
      return true;
    }
    throw new Error("Missing permission: fees:schoolpay:sync");
  }

  /**
   * Stages an incoming inbound transaction durably before accounting execution.
   * Handles strict database idempotency replay detection.
   */
  static async stageInboundTransaction(
    branchId: string,
    inbound: SchoolPayInboundDTO
  ): Promise<{ transaction: SchoolPayTransaction; isReplay: boolean }> {
    const amountDec = new Prisma.Decimal(inbound.amount);
    if (amountDec.lessThanOrEqualTo(0)) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const receiptNo = inbound.schoolPayReceiptNo.trim();
    const txId = inbound.transactionId.trim();

    // 1. Check existing record by receipt number or transaction reference
    const existing = await db.schoolPayTransaction.findFirst({
      where: {
        branchId,
        OR: [
          { schoolPayReceiptNo: receiptNo },
          { transactionId: txId }
        ]
      },
      include: { student: true, payment: true }
    });

    if (existing) {
      return { transaction: existing, isReplay: true };
    }

    // 2. Insert new staged transaction with status RECEIVED
    const staged = await db.schoolPayTransaction.create({
      data: {
        branchId,
        schoolPayReceiptNo: receiptNo,
        transactionId: txId,
        schoolPayCode: inbound.schoolPayCode.trim(),
        amount: amountDec,
        feeAmount: inbound.feeAmount ? new Prisma.Decimal(inbound.feeAmount) : null,
        payerName: inbound.payerName || null,
        payerPhone: inbound.payerPhone || null,
        channel: inbound.channel,
        paymentDate: inbound.paymentDate,
        status: SchoolPayTxStatus.RECEIVED,
        rawPayload: inbound.rawPayload as Prisma.InputJsonValue
      },
      include: { student: true, payment: true }
    });

    return { transaction: staged, isReplay: false };
  }

  /**
   * Deterministically matches a staged transaction against students in the branch.
   * If high-confidence match is found and autoPostMatched is enabled, triggers PaymentDAO.
   */
  static async matchAndProcessTransaction(
    branchId: string,
    transactionId: string,
    systemUserId?: string
  ): Promise<SchoolPayTransaction> {
    const tx = await db.schoolPayTransaction.findUnique({
      where: { id: transactionId },
      include: { student: true, payment: true }
    });

    if (!tx || tx.branchId !== branchId) {
      throw new Error("SchoolPay transaction not found");
    }

    // If already posted or ignored, return immediately
    if (tx.status === SchoolPayTxStatus.POSTED || tx.status === SchoolPayTxStatus.IGNORED) {
      return tx;
    }

    const config = await db.schoolPayConfig.findUnique({
      where: { branchId }
    });

    const autoPost = config ? config.autoPostMatched : true;

    // 1. DETERMINISTIC MATCHING
    const code = tx.schoolPayCode.trim();

    // Tier 1: Match by exact schoolPayCode
    let matchedStudents = await db.student.findMany({
      where: {
        branchId,
        schoolPayCode: code,
        status: 'ACTIVE'
      }
    });

    // Tier 2: Fallback exact match on admissionNo
    if (matchedStudents.length === 0) {
      matchedStudents = await db.student.findMany({
        where: {
          branchId,
          admissionNo: code,
          status: 'ACTIVE'
        }
      });
    }

    // 2. EVALUATE MATCH CONFIDENCE
    if (matchedStudents.length === 1) {
      const student = matchedStudents[0];

      if (autoPost) {
        // Execute authoritative PaymentDAO pipeline
        try {
          let resolvedUserId = systemUserId || tx.resolvedById;
          if (resolvedUserId === 'SYSTEM_WEBHOOK' || resolvedUserId === 'SYSTEM_SCHOOLPAY_ROBOT' || !resolvedUserId) {
            const adminUser = await db.user.findFirst({
              where: {
                branchAccess: { some: { branchId } }
              }
            });
            resolvedUserId = adminUser?.id || '';
          }

          const sysContext: TenantContext = {
            organizationId: '',
            schoolId: '',
            branchId,
            userId: resolvedUserId,
            role: 'ADMIN',
            permissions: ['all']
          };

          const paymentResult = await PaymentDAO.recordPayment(sysContext, {
            studentId: student.id,
            amount: new Prisma.Decimal(tx.amount),
            paymentDate: tx.paymentDate,
            paymentMethod: PaymentMethod.SCHOOLPAY,
            externalReference: tx.transactionId,
            payerName: tx.payerName || undefined,
            payerPhone: tx.payerPhone || undefined,
            notes: `SchoolPay Receipt: ${tx.schoolPayReceiptNo} | Channel: ${tx.channel}`,
            idempotencyKey: `SPAY_${branchId}_${tx.schoolPayReceiptNo}`
          });

          const createdPaymentId = paymentResult.payment.id;

          const updated = await db.schoolPayTransaction.update({
            where: { id: tx.id },
            data: {
              status: SchoolPayTxStatus.POSTED,
              studentId: student.id,
              paymentId: createdPaymentId,
              errorMessage: null,
              resolvedAt: new Date()
            },
            include: { student: true, payment: true }
          });

          await AuditService.log(
            sysContext,
            'AUTO_POSTED',
            'SchoolPayTransaction',
            updated.id,
            JSON.stringify({
              schoolPayReceiptNo: tx.schoolPayReceiptNo,
              studentId: student.id,
              paymentId: createdPaymentId,
              amount: tx.amount.toString()
            })
          );

          return updated;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Payment recording failed';
          return await db.schoolPayTransaction.update({
            where: { id: tx.id },
            data: {
              status: SchoolPayTxStatus.FAILED,
              studentId: student.id,
              errorMessage: errMsg
            },
            include: { student: true, payment: true }
          });
        }
      } else {
        // Matched, waiting for 1-click bursar post
        return await db.schoolPayTransaction.update({
          where: { id: tx.id },
          data: {
            status: SchoolPayTxStatus.MATCHED,
            studentId: student.id,
            errorMessage: null
          },
          include: { student: true, payment: true }
        });
      }
    } else {
      // Ambiguous (multiple matches) or No Match -> Route to review queue
      return await db.schoolPayTransaction.update({
        where: { id: tx.id },
        data: {
          status: SchoolPayTxStatus.NEEDS_REVIEW,
          studentId: null,
          errorMessage: matchedStudents.length > 1
            ? `Ambiguous code match (${matchedStudents.length} active students share code ${code})`
            : `No active student found matching code ${code}`
        },
        include: { student: true, payment: true }
      });
    }
  }

  /**
   * 1-Click posting for high-confidence MATCHED transactions.
   */
  static async postMatchedTransaction(ctx: TenantContext, id: string): Promise<SchoolPayTransaction> {
    this.checkPostPermission(ctx);
    const branchId = ctx.branchId!;

    const tx = await db.schoolPayTransaction.findUnique({
      where: { id },
      include: { student: true }
    });

    if (!tx || tx.branchId !== branchId) {
      throw new Error("SchoolPay transaction not found");
    }

    if (tx.status === SchoolPayTxStatus.POSTED) {
      return tx;
    }

    if (!tx.studentId || !tx.student) {
      throw new Error("Cannot post transaction: No student matched. Use Manual Assign instead.");
    }

    const paymentResult = await PaymentDAO.recordPayment(ctx, {
      studentId: tx.studentId,
      amount: new Prisma.Decimal(tx.amount),
      paymentDate: tx.paymentDate,
      paymentMethod: PaymentMethod.SCHOOLPAY,
      externalReference: tx.transactionId,
      payerName: tx.payerName || undefined,
      payerPhone: tx.payerPhone || undefined,
      notes: `SchoolPay Receipt: ${tx.schoolPayReceiptNo} | Channel: ${tx.channel}`,
      idempotencyKey: `SPAY_${branchId}_${tx.schoolPayReceiptNo}`
    });

    const createdPaymentId = paymentResult.payment.id;

    const updated = await db.schoolPayTransaction.update({
      where: { id: tx.id },
      data: {
        status: SchoolPayTxStatus.POSTED,
        paymentId: createdPaymentId,
        resolvedById: ctx.userId,
        resolvedAt: new Date(),
        errorMessage: null
      },
      include: { student: true, payment: true }
    });

    await AuditService.log(
      ctx,
      'ONE_CLICK_POSTED',
      'SchoolPayTransaction',
      updated.id,
      JSON.stringify({
        schoolPayReceiptNo: tx.schoolPayReceiptNo,
        studentId: tx.studentId,
        paymentId: createdPaymentId,
        amount: tx.amount.toString()
      })
    );

    return updated;
  }

  /**
   * Manually assigns a transaction from NEEDS_REVIEW to a student, optionally links the code, and posts via PaymentDAO.
   */
  static async assignAndPostTransaction(
    ctx: TenantContext,
    id: string,
    studentId: string,
    linkSchoolPayCode = false,
    reviewNotes?: string
  ): Promise<SchoolPayTransaction> {
    this.checkAssignPermission(ctx);
    const branchId = ctx.branchId!;

    const tx = await db.schoolPayTransaction.findUnique({
      where: { id }
    });

    if (!tx || tx.branchId !== branchId) {
      throw new Error("SchoolPay transaction not found");
    }

    if (tx.status === SchoolPayTxStatus.POSTED) {
      throw new Error("Transaction is already posted to student ledger.");
    }

    const student = await db.student.findUnique({
      where: { id: studentId }
    });

    if (!student || student.branchId !== branchId) {
      throw new Error("Student not found in this branch.");
    }

    // 1. Optionally link student's schoolPayCode for future automatic matching
    if (linkSchoolPayCode && tx.schoolPayCode) {
      await db.student.update({
        where: { id: student.id },
        data: { schoolPayCode: tx.schoolPayCode.trim() }
      });
    }

    // 2. Post payment via authoritative PaymentDAO pipeline
    const paymentResult = await PaymentDAO.recordPayment(ctx, {
      studentId: student.id,
      amount: new Prisma.Decimal(tx.amount),
      paymentDate: tx.paymentDate,
      paymentMethod: PaymentMethod.SCHOOLPAY,
      externalReference: tx.transactionId,
      payerName: tx.payerName || undefined,
      payerPhone: tx.payerPhone || undefined,
      notes: `SchoolPay Receipt: ${tx.schoolPayReceiptNo} | Channel: ${tx.channel}${reviewNotes ? ' | ' + reviewNotes : ''}`,
      idempotencyKey: `SPAY_${branchId}_${tx.schoolPayReceiptNo}`
    });

    const createdPaymentId = paymentResult.payment.id;

    // 3. Update SchoolPayTransaction state
    const updated = await db.schoolPayTransaction.update({
      where: { id: tx.id },
      data: {
        status: SchoolPayTxStatus.POSTED,
        studentId: student.id,
        paymentId: createdPaymentId,
        reviewNotes: reviewNotes?.trim() || null,
        resolvedById: ctx.userId,
        resolvedAt: new Date(),
        errorMessage: null
      },
      include: { student: true, payment: true }
    });

    await AuditService.log(
      ctx,
      'MANUALLY_ASSIGNED_POSTED',
      'SchoolPayTransaction',
      updated.id,
      JSON.stringify({
        schoolPayReceiptNo: tx.schoolPayReceiptNo,
        studentId: student.id,
        paymentId: createdPaymentId,
        linkSchoolPayCode,
        amount: tx.amount.toString(),
        notes: reviewNotes
      })
    );

    return updated;
  }

  /**
   * Marks an unmatched/erroneous/test transaction as IGNORED with a mandatory reason.
   */
  static async ignoreTransaction(ctx: TenantContext, id: string, reason: string): Promise<SchoolPayTransaction> {
    this.checkIgnorePermission(ctx);
    const branchId = ctx.branchId!;

    if (!reason || reason.trim().length < 5) {
      throw new Error("A valid reason of at least 5 characters is required to ignore a transaction.");
    }

    const tx = await db.schoolPayTransaction.findUnique({
      where: { id }
    });

    if (!tx || tx.branchId !== branchId) {
      throw new Error("SchoolPay transaction not found");
    }

    if (tx.status === SchoolPayTxStatus.POSTED) {
      throw new Error("Cannot ignore an already posted transaction. Use Payment Reversal instead.");
    }

    const updated = await db.schoolPayTransaction.update({
      where: { id: tx.id },
      data: {
        status: SchoolPayTxStatus.IGNORED,
        reviewNotes: reason.trim(),
        resolvedById: ctx.userId,
        resolvedAt: new Date()
      },
      include: { student: true, payment: true }
    });

    await AuditService.log(
      ctx,
      'MARKED_IGNORED',
      'SchoolPayTransaction',
      updated.id,
      JSON.stringify({
        schoolPayReceiptNo: tx.schoolPayReceiptNo,
        reason: reason.trim()
      })
    );

    return updated;
  }

  /**
   * Retries matching & processing for FAILED or RECEIVED transactions.
   */
  static async retryTransaction(ctx: TenantContext, id: string): Promise<SchoolPayTransaction> {
    this.checkRetryPermission(ctx);
    const branchId = ctx.branchId!;

    const tx = await db.schoolPayTransaction.findUnique({
      where: { id }
    });

    if (!tx || tx.branchId !== branchId) {
      throw new Error("SchoolPay transaction not found");
    }

    if (tx.status === SchoolPayTxStatus.POSTED) {
      return tx;
    }

    return await this.matchAndProcessTransaction(branchId, id, ctx.userId);
  }

  /**
   * Executes batch sync against the SchoolPay REST API for a specified date range.
   */
  static async syncTransactions(ctx: TenantContext, from: Date, to: Date): Promise<{
    totalFetched: number;
    newReceived: number;
    autoPosted: number;
    needsReview: number;
    skippedExisting: number;
  }> {
    this.checkSyncPermission(ctx);
    const branchId = ctx.branchId!;

    const config = await db.schoolPayConfig.findUnique({
      where: { branchId }
    });

    if (!config || !config.enabled) {
      throw new Error("SchoolPay syncing is disabled or not configured for this branch.");
    }

    // Call adapter
    const result = await schoolPayAdapter.fetchTransactions(
      { schoolCode: config.schoolCode, apiPassword: config.apiPasswordEnc || '' },
      from,
      to
    );

    let newReceived = 0;
    let autoPosted = 0;
    let needsReview = 0;
    let skippedExisting = 0;

    for (const inbound of result.transactions) {
      const { transaction, isReplay } = await this.stageInboundTransaction(branchId, inbound);
      if (isReplay) {
        skippedExisting++;
      } else {
        newReceived++;
        const processed = await this.matchAndProcessTransaction(branchId, transaction.id, ctx.userId);
        if (processed.status === SchoolPayTxStatus.POSTED) {
          autoPosted++;
        } else {
          needsReview++;
        }
      }
    }

    // Log sync summary
    await db.schoolPaySyncLog.create({
      data: {
        branchId,
        configId: config.id,
        dateFrom: from,
        dateTo: to,
        totalFetched: result.transactions.length,
        newReceived,
        autoPosted,
        needsReview,
        skippedExisting,
        status: 'SUCCESS',
        syncedById: ctx.userId
      }
    });

    await db.schoolPayConfig.update({
      where: { branchId },
      data: { lastSyncedAt: new Date() }
    });

    await AuditService.log(
      ctx,
      'SYNCED',
      'SchoolPaySyncLog',
      config.id,
      JSON.stringify({
        from: from.toISOString(),
        to: to.toISOString(),
        totalFetched: result.transactions.length,
        autoPosted,
        needsReview,
        skippedExisting
      })
    );

    return {
      totalFetched: result.transactions.length,
      newReceived,
      autoPosted,
      needsReview,
      skippedExisting
    };
  }

  /**
   * Retrieves summary statistics for the SchoolPay dashboard.
   */
  static async getStats(ctx: TenantContext): Promise<{
    postedCount: number;
    postedAmount: string;
    needsReviewCount: number;
    needsReviewAmount: string;
    matchedCount: number;
    matchedAmount: string;
    ignoredCount: number;
    ignoredAmount: string;
    failedCount: number;
    totalLinkedStudents: number;
    totalActiveStudents: number;
  }> {
    this.checkReadPermission(ctx);
    const branchId = ctx.branchId!;

    const txs = await db.schoolPayTransaction.findMany({
      where: { branchId },
      select: { status: true, amount: true }
    });

    let postedCount = 0;
    let postedSum = new Prisma.Decimal(0);
    let needsReviewCount = 0;
    let needsReviewSum = new Prisma.Decimal(0);
    let matchedCount = 0;
    let matchedSum = new Prisma.Decimal(0);
    let ignoredCount = 0;
    let ignoredSum = new Prisma.Decimal(0);
    let failedCount = 0;

    for (const t of txs) {
      if (t.status === SchoolPayTxStatus.POSTED) {
        postedCount++;
        postedSum = postedSum.add(t.amount);
      } else if (t.status === SchoolPayTxStatus.NEEDS_REVIEW) {
        needsReviewCount++;
        needsReviewSum = needsReviewSum.add(t.amount);
      } else if (t.status === SchoolPayTxStatus.MATCHED) {
        matchedCount++;
        matchedSum = matchedSum.add(t.amount);
      } else if (t.status === SchoolPayTxStatus.IGNORED) {
        ignoredCount++;
        ignoredSum = ignoredSum.add(t.amount);
      } else if (t.status === SchoolPayTxStatus.FAILED) {
        failedCount++;
      }
    }

    const [linkedCount, activeCount] = await Promise.all([
      db.student.count({
        where: { branchId, status: 'ACTIVE', schoolPayCode: { not: null } }
      }),
      db.student.count({
        where: { branchId, status: 'ACTIVE' }
      })
    ]);

    return {
      postedCount,
      postedAmount: postedSum.toFixed(2),
      needsReviewCount,
      needsReviewAmount: needsReviewSum.toFixed(2),
      matchedCount,
      matchedAmount: matchedSum.toFixed(2),
      ignoredCount,
      ignoredAmount: ignoredSum.toFixed(2),
      failedCount,
      totalLinkedStudents: linkedCount,
      totalActiveStudents: activeCount
    };
  }

  /**
   * Retrieves paginated transactions with optional filters.
   */
  static async getTransactions(ctx: TenantContext, filter: SchoolPayTransactionFilter = {}): Promise<{
    transactions: SchoolPayTransactionWithRelations[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.checkReadPermission(ctx);
    const branchId = ctx.branchId!;

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SchoolPayTransactionWhereInput = { branchId };

    if (filter.status && filter.status !== 'ALL') {
      where.status = filter.status;
    }

    if (filter.channel) {
      where.channel = filter.channel as SchoolPaySourceChannel;
    }

    if (filter.startDate || filter.endDate) {
      where.paymentDate = {};
      if (filter.startDate) {
        where.paymentDate.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        where.paymentDate.lte = end;
      }
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { schoolPayReceiptNo: { contains: q, mode: 'insensitive' } },
        { transactionId: { contains: q, mode: 'insensitive' } },
        { schoolPayCode: { contains: q, mode: 'insensitive' } },
        { payerName: { contains: q, mode: 'insensitive' } },
        { payerPhone: { contains: q, mode: 'insensitive' } },
        { student: { firstName: { contains: q, mode: 'insensitive' } } },
        { student: { lastName: { contains: q, mode: 'insensitive' } } },
        { student: { admissionNo: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const [total, rows] = await Promise.all([
      db.schoolPayTransaction.count({ where }),
      db.schoolPayTransaction.findMany({
        where,
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
          payment: {
            select: {
              id: true,
              paymentNumber: true,
              receipt: { select: { receiptNumber: true } }
            }
          }
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit
      })
    ]);

    return {
      transactions: rows as SchoolPayTransactionWithRelations[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Fast student search for assignment modal with fuzzy candidate scoring.
   */
  static async searchStudentsForAssignment(
    ctx: TenantContext,
    query: string,
    txPayerName?: string
  ): Promise<StudentCandidateSearchResult[]> {
    this.checkReadPermission(ctx);
    const branchId = ctx.branchId!;

    const q = query.trim();
    const students = await db.student.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
        ...(q.length >= 1 ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { admissionNo: { contains: q, mode: 'insensitive' } },
            { schoolPayCode: { contains: q, mode: 'insensitive' } }
          ]
        } : {})
      },
      include: {
        classRef: { select: { name: true } },
        streamRef: { select: { name: true } }
      },
      take: 25
    });

    // Score candidates if payer name is provided
    return students.map(s => {
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
      let matchScore = 0;

      if (txPayerName) {
        const cleanPayer = txPayerName.toLowerCase();
        const payerWords = cleanPayer.split(/\s+/).filter(w => w.length > 2);
        for (const word of payerWords) {
          if (fullName.includes(word)) {
            matchScore += 40;
          }
        }
      }

      return {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNo: s.admissionNo,
        schoolPayCode: s.schoolPayCode,
        className: s.classRef?.name || 'Unassigned',
        streamName: s.streamRef?.name || '',
        matchScore: Math.min(100, matchScore)
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }
}
