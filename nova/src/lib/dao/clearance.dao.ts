import { db } from "../db";
import {
  Prisma,
  StudentClearance,
  ClearanceStatus,
  ClearanceType,
  ClearanceDocStatus,
  RequirementItemStatus
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import crypto from "crypto";

export interface ClearanceEvaluationResult {
  studentId: string;
  academicYearId: string;
  termId: string | null;
  ledgerBalance: Prisma.Decimal;
  isFinanciallyCleared: boolean;
  totalInvoiced: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  feesPaidPercent: Prisma.Decimal;
  requirementsRecordId: string | null;
  totalRequirements: number;
  fulfilledRequirements: number;
  pendingRequirements: number;
  areRequirementsFulfilled: boolean;
  overallStatus: ClearanceStatus;
  blockingReasons: string[];
}

export interface IssueClearanceInput {
  studentId: string;
  academicYearId: string;
  termId?: string | null;
  clearanceType?: ClearanceType;
  maxAllowedDebt?: number | string | Prisma.Decimal;
  requiredPaidPercent?: number | string;
  validUntil?: Date | string | null;
}

export interface IssueProvisionalClearanceInput {
  studentId: string;
  academicYearId: string;
  termId?: string | null;
  clearanceType?: ClearanceType;
  reason: string;
  validUntil?: Date | string | null;
}

export interface RevokeClearanceInput {
  clearanceId: string;
  reason: string;
}

export interface ListClearanceFilters {
  academicYearId?: string;
  termId?: string | null;
  classId?: string;
  studentId?: string;
  clearanceType?: ClearanceType;
  status?: ClearanceStatus;
  docStatus?: ClearanceDocStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface VerificationResult {
  isValid: boolean;
  docStatus: ClearanceDocStatus | "NOT_FOUND";
  reason?: "NOT_FOUND" | "REVOKED" | "EXPIRED" | "VALID";
  permit?: {
    clearanceNumber: string;
    clearanceType: ClearanceType;
    status: ClearanceStatus;
    docStatus: ClearanceDocStatus;
    studentName: string;
    studentAdmissionNo: string;
    className: string;
    academicYearName: string;
    termName: string | null;
    issuedAt: Date;
    validUntil: Date | null;
    authorizedByName: string;
    provisionalReason: string | null;
    revocationReason: string | null;
  };
}

export class ClearanceDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("clearance:read") ||
      perms.includes("clearance:evaluate") ||
      perms.includes("clearance:issue") ||
      perms.includes("fees:read") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: clearance:read");
  }

  private static checkIssuePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("clearance:issue") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: clearance:issue");
  }

  private static checkProvisionalPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("clearance:provisional") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: clearance:provisional");
  }

  private static checkRevokePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes("all") ||
      perms.includes("clearance:revoke") ||
      perms.includes("fees:write")
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: clearance:revoke");
  }

  /**
   * Concurrency-safe atomic sequence generator for Clearance Permit Numbers (e.g. CLR-2026-00001).
   */
  static async generateNextClearanceNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
    date: Date = new Date()
  ): Promise<string> {
    const year = date.getFullYear();
    const fallbackId = crypto.randomUUID();

    const result = await tx.$queryRaw<{ nextValue: number }[]>`
      INSERT INTO "ClearanceSequence" ("id", "branchId", "year", "nextValue", "updatedAt")
      VALUES (${fallbackId}, ${branchId}, ${year}, 2, NOW())
      ON CONFLICT ("branchId", "year")
      DO UPDATE SET "nextValue" = "ClearanceSequence"."nextValue" + 1, "updatedAt" = NOW()
      RETURNING "nextValue" - 1 AS "nextValue"
    `;

    const seqNumber = result[0]?.nextValue ?? 1;
    return `CLR-${year}-${String(seqNumber).padStart(5, "0")}`;
  }

  /**
   * Evaluates a student's real-time financial and requirements clearance state.
   */
  static async evaluateStudentClearance(
    ctx: TenantContext,
    params: {
      studentId: string;
      academicYearId: string;
      termId?: string | null;
      maxAllowedDebt?: number | string | Prisma.Decimal;
      requiredPaidPercent?: number | string;
    }
  ): Promise<ClearanceEvaluationResult> {
    this.checkReadPermission(ctx);

    const student = await db.student.findFirst({
      where: { id: params.studentId, branchId: ctx.branchId }
    });
    if (!student) {
      throw new Error("Student not found in current branch.");
    }

    const maxAllowedDebt = params.maxAllowedDebt != null
      ? new Prisma.Decimal(params.maxAllowedDebt.toString())
      : new Prisma.Decimal(0);

    const requiredPaidPercent = params.requiredPaidPercent != null
      ? Number(params.requiredPaidPercent)
      : 100;

    // 1. Authoritative Ledger Balance
    const lastLedgerEntry = await db.studentLedgerEntry.findFirst({
      where: {
        branchId: ctx.branchId,
        studentId: params.studentId
      },
      orderBy: [{ postedAt: "desc" }, { id: "desc" }]
    });

    const ledgerBalance = lastLedgerEntry
      ? new Prisma.Decimal(lastLedgerEntry.balanceAfter)
      : new Prisma.Decimal(0);

    let isFinanciallyCleared = false;
    if (ledgerBalance.lessThanOrEqualTo(0) || ledgerBalance.lessThanOrEqualTo(maxAllowedDebt)) {
      isFinanciallyCleared = true;
    }

    // 2. Term Invoiced vs Paid Ratio
    const termInvoices = await db.invoice.findMany({
      where: {
        branchId: ctx.branchId,
        studentId: params.studentId,
        academicYearId: params.academicYearId,
        ...(params.termId !== undefined ? { termId: params.termId } : {}),
        status: { not: "VOID" }
      },
      include: {
        allocations: {
          where: { status: "ACTIVE" }
        }
      }
    });

    let totalInvoiced = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);

    for (const inv of termInvoices) {
      totalInvoiced = totalInvoiced.add(inv.netAmount);
      const paidOnInv = inv.allocations.reduce(
        (acc, a) => acc.add(a.amount),
        new Prisma.Decimal(0)
      );
      totalPaid = totalPaid.add(paidOnInv);
    }

    let feesPaidPercent = new Prisma.Decimal(100);
    if (totalInvoiced.greaterThan(0)) {
      const pct = totalPaid.div(totalInvoiced).mul(100);
      feesPaidPercent = pct.greaterThan(100) ? new Prisma.Decimal(100) : pct;
      if (pct.toNumber() < requiredPaidPercent && ledgerBalance.greaterThan(maxAllowedDebt)) {
        isFinanciallyCleared = false;
      }
    }

    // 3. Requirements Compliance
    const reqRecord = await db.studentRequirementRecord.findFirst({
      where: {
        branchId: ctx.branchId,
        studentId: params.studentId,
        academicYearId: params.academicYearId,
        ...(params.termId !== undefined ? { termId: params.termId } : {})
      },
      include: { items: true }
    });

    let areRequirementsFulfilled = true;
    let totalRequirements = 0;
    let fulfilledRequirements = 0;
    let pendingRequirements = 0;

    if (reqRecord) {
      totalRequirements = reqRecord.items.length;
      for (const item of reqRecord.items) {
        const isItemFulfilled =
          item.status === RequirementItemStatus.FULFILLED ||
          item.status === RequirementItemStatus.MONETIZED ||
          item.status === RequirementItemStatus.EXEMPTED;

        if (isItemFulfilled) {
          fulfilledRequirements++;
        } else {
          pendingRequirements++;
          if (item.isMandatory) {
            areRequirementsFulfilled = false;
          }
        }
      }
    }

    // 4. Overall Evaluation
    const blockingReasons: string[] = [];
    if (!isFinanciallyCleared) {
      blockingReasons.push(
        `Outstanding fee balance of UGX ${ledgerBalance.toString()} exceeds allowed threshold of UGX ${maxAllowedDebt.toString()}.`
      );
    }
    if (!areRequirementsFulfilled) {
      blockingReasons.push(
        `Student has ${pendingRequirements} pending mandatory school requirement(s).`
      );
    }

    const overallStatus: ClearanceStatus =
      isFinanciallyCleared && areRequirementsFulfilled
        ? ClearanceStatus.CLEARED
        : ClearanceStatus.BLOCKED;

    return {
      studentId: params.studentId,
      academicYearId: params.academicYearId,
      termId: params.termId || null,
      ledgerBalance,
      isFinanciallyCleared,
      totalInvoiced,
      totalPaid,
      feesPaidPercent,
      requirementsRecordId: reqRecord?.id || null,
      totalRequirements,
      fulfilledRequirements,
      pendingRequirements,
      areRequirementsFulfilled,
      overallStatus,
      blockingReasons
    };
  }

  /**
   * Issues an authoritative Student Clearance Document (Exam Permit / Gate Pass).
   */
  static async issueClearancePermit(
    ctx: TenantContext,
    input: IssueClearanceInput
  ): Promise<StudentClearance> {
    this.checkIssuePermission(ctx);

    const evaluation = await this.evaluateStudentClearance(ctx, {
      studentId: input.studentId,
      academicYearId: input.academicYearId,
      termId: input.termId,
      maxAllowedDebt: input.maxAllowedDebt,
      requiredPaidPercent: input.requiredPaidPercent
    });

    if (evaluation.overallStatus === ClearanceStatus.BLOCKED) {
      throw new Error(
        `Cannot issue standard clearance permit: ${evaluation.blockingReasons.join(" ")} Use issueProvisionalClearance for administrative overrides.`
      );
    }

    return db.$transaction(async (tx) => {
      const existingActive = await tx.studentClearance.findFirst({
        where: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          clearanceType: input.clearanceType || ClearanceType.EXAM_PERMIT,
          docStatus: ClearanceDocStatus.ACTIVE
        }
      });

      if (existingActive) {
        throw new Error(
          `An active ${input.clearanceType || "EXAM_PERMIT"} (${existingActive.clearanceNumber}) already exists for this student in this term.`
        );
      }

      const clearanceNumber = await this.generateNextClearanceNumber(tx, ctx.branchId);
      const verificationToken = crypto.randomBytes(32).toString("hex");

      const clearance = await tx.studentClearance.create({
        data: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          requirementRecordId: evaluation.requirementsRecordId,
          clearanceType: input.clearanceType || ClearanceType.EXAM_PERMIT,
          clearanceNumber,
          status: ClearanceStatus.CLEARED,
          docStatus: ClearanceDocStatus.ACTIVE,
          ledgerBalance: evaluation.ledgerBalance,
          feesPaidPercent: evaluation.feesPaidPercent,
          requirementsFulfilled: evaluation.areRequirementsFulfilled,
          authorizedById: ctx.userId,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          verificationToken
        }
      });

      await AuditService.log(
        ctx,
        "CLEARANCE_PERMIT_ISSUED",
        "StudentClearance",
        clearance.id,
        `Issued ${clearance.clearanceType} #${clearance.clearanceNumber} for student ${input.studentId}.`
      );

      return clearance;
    });
  }

  /**
   * Issues a Provisional Clearance Override with mandatory administrative justification.
   */
  static async issueProvisionalClearance(
    ctx: TenantContext,
    input: IssueProvisionalClearanceInput
  ): Promise<StudentClearance> {
    this.checkProvisionalPermission(ctx);

    if (!input.reason?.trim()) {
      throw new Error("A reason is mandatory when authorizing provisional clearance.");
    }

    const evaluation = await this.evaluateStudentClearance(ctx, {
      studentId: input.studentId,
      academicYearId: input.academicYearId,
      termId: input.termId
    });

    return db.$transaction(async (tx) => {
      const existingActive = await tx.studentClearance.findFirst({
        where: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          clearanceType: input.clearanceType || ClearanceType.EXAM_PERMIT,
          docStatus: ClearanceDocStatus.ACTIVE
        }
      });

      if (existingActive) {
        throw new Error(
          `An active ${input.clearanceType || "EXAM_PERMIT"} (${existingActive.clearanceNumber}) already exists for this student in this term.`
        );
      }

      const clearanceNumber = await this.generateNextClearanceNumber(tx, ctx.branchId);
      const verificationToken = crypto.randomBytes(32).toString("hex");

      const clearance = await tx.studentClearance.create({
        data: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          requirementRecordId: evaluation.requirementsRecordId,
          clearanceType: input.clearanceType || ClearanceType.EXAM_PERMIT,
          clearanceNumber,
          status: ClearanceStatus.PROVISIONAL,
          docStatus: ClearanceDocStatus.ACTIVE,
          ledgerBalance: evaluation.ledgerBalance,
          feesPaidPercent: evaluation.feesPaidPercent,
          requirementsFulfilled: evaluation.areRequirementsFulfilled,
          provisionalReason: input.reason.trim(),
          authorizedById: ctx.userId,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          verificationToken
        }
      });

      await AuditService.log(
        ctx,
        "PROVISIONAL_CLEARANCE_GRANTED",
        "StudentClearance",
        clearance.id,
        `Granted Provisional ${clearance.clearanceType} #${clearance.clearanceNumber} for student ${input.studentId} (Reason: ${input.reason}).`
      );

      return clearance;
    });
  }

  /**
   * Revokes an active clearance permit.
   */
  static async revokeClearancePermit(
    ctx: TenantContext,
    input: RevokeClearanceInput
  ): Promise<StudentClearance> {
    this.checkRevokePermission(ctx);

    if (!input.reason?.trim()) {
      throw new Error("Revocation reason is mandatory.");
    }

    const clearance = await db.studentClearance.findFirst({
      where: { id: input.clearanceId, branchId: ctx.branchId }
    });

    if (!clearance) {
      throw new Error("Clearance permit not found in current branch.");
    }

    if (clearance.docStatus === ClearanceDocStatus.REVOKED) {
      throw new Error("Clearance permit has already been revoked.");
    }

    const updated = await db.studentClearance.update({
      where: { id: clearance.id },
      data: {
        docStatus: ClearanceDocStatus.REVOKED,
        revocationReason: input.reason.trim(),
        revokedById: ctx.userId,
        revokedAt: new Date()
      }
    });

    await AuditService.log(
      ctx,
      "CLEARANCE_PERMIT_REVOKED",
      "StudentClearance",
      updated.id,
      `Revoked ${updated.clearanceType} #${updated.clearanceNumber} (Reason: ${input.reason}).`
    );

    return updated;
  }

  /**
   * Public / internal server-side cryptographic QR verification endpoint.
   */
  static async verifyClearanceToken(token: string): Promise<VerificationResult> {
    if (!token || typeof token !== "string" || token.length < 32) {
      return { isValid: false, docStatus: "NOT_FOUND", reason: "NOT_FOUND" };
    }

    const clearance = await db.studentClearance.findUnique({
      where: { verificationToken: token },
      include: {
        student: {
          include: { classRef: true }
        },
        academicYear: true,
        term: true,
        authorizedBy: true
      }
    });

    if (!clearance) {
      return { isValid: false, docStatus: "NOT_FOUND", reason: "NOT_FOUND" };
    }

    const sanitizedPermit = {
      clearanceNumber: clearance.clearanceNumber,
      clearanceType: clearance.clearanceType,
      status: clearance.status,
      docStatus: clearance.docStatus,
      studentName: `${clearance.student.firstName} ${clearance.student.lastName}`,
      studentAdmissionNo: clearance.student.admissionNo,
      className: clearance.student.classRef?.name || "Unassigned",
      academicYearName: clearance.academicYear.name,
      termName: clearance.term?.name || null,
      issuedAt: clearance.issuedAt,
      validUntil: clearance.validUntil,
      authorizedByName: `${clearance.authorizedBy.firstName} ${clearance.authorizedBy.lastName}`,
      provisionalReason: clearance.provisionalReason,
      revocationReason: clearance.revocationReason
    };

    if (clearance.docStatus === ClearanceDocStatus.REVOKED) {
      return {
        isValid: false,
        docStatus: ClearanceDocStatus.REVOKED,
        reason: "REVOKED",
        permit: sanitizedPermit
      };
    }

    if (clearance.validUntil && clearance.validUntil < new Date()) {
      return {
        isValid: false,
        docStatus: ClearanceDocStatus.EXPIRED,
        reason: "EXPIRED",
        permit: sanitizedPermit
      };
    }

    return {
      isValid: true,
      docStatus: ClearanceDocStatus.ACTIVE,
      reason: "VALID",
      permit: sanitizedPermit
    };
  }

  static async getClearanceById(
    ctx: TenantContext,
    id: string
  ): Promise<(StudentClearance & { student: { firstName: string; lastName: string; admissionNo: string; classRef: { name: string } | null; [key: string]: unknown }; authorizedBy: { firstName: string; lastName: string; [key: string]: unknown }; revokedBy: { firstName: string; lastName: string; [key: string]: unknown } | null }) | null> {
    this.checkReadPermission(ctx);

    return db.studentClearance.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        student: { include: { classRef: true } },
        academicYear: true,
        term: true,
        authorizedBy: true,
        revokedBy: true,
        requirementRecord: { include: { items: true } }
      }
    });
  }

  static async listClearances(
    ctx: TenantContext,
    filters: ListClearanceFilters
  ): Promise<{
    records: (StudentClearance & { student: { firstName: string; lastName: string; admissionNo: string; classRef: { name: string } | null; [key: string]: unknown }; academicYear: { name: string }; term: { name: string } | null; authorizedBy: { firstName: string; lastName: string } })[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.checkReadPermission(ctx);

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.StudentClearanceWhereInput = {
      branchId: ctx.branchId,
      academicYearId: filters.academicYearId,
      ...(filters.termId !== undefined ? { termId: filters.termId } : {}),
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      ...(filters.clearanceType ? { clearanceType: filters.clearanceType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.docStatus ? { docStatus: filters.docStatus } : {}),
      ...(filters.classId ? { student: { classId: filters.classId } } : {}),
      ...(filters.search
        ? {
            OR: [
              { clearanceNumber: { contains: filters.search, mode: "insensitive" } },
              { student: { firstName: { contains: filters.search, mode: "insensitive" } } },
              { student: { lastName: { contains: filters.search, mode: "insensitive" } } },
              { student: { admissionNo: { contains: filters.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    const [records, total] = await Promise.all([
      db.studentClearance.findMany({
        where,
        include: {
          student: { include: { classRef: true } },
          academicYear: true,
          term: true,
          authorizedBy: true
        },
        skip,
        take: limit,
        orderBy: [{ issuedAt: "desc" }]
      }),
      db.studentClearance.count({ where })
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
