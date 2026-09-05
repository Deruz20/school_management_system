import { LedgerDAO } from "./ledger.dao";
import { db } from "../db";
import { Prisma, PortalAccessPolicy } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export type ReportCardAccessStatus = 'UNRESTRICTED' | 'DEBTOR_BLOCKED' | 'FEE_THRESHOLD_MET';
export const ReportCardAccessStatus = {
  UNRESTRICTED: 'UNRESTRICTED' as ReportCardAccessStatus,
  DEBTOR_BLOCKED: 'DEBTOR_BLOCKED' as ReportCardAccessStatus,
  FEE_THRESHOLD_MET: 'FEE_THRESHOLD_MET' as ReportCardAccessStatus,
};

export interface UpsertPortalAccessPolicyInput {
  allowStudentAccess?: boolean;
  allowParentAccess?: boolean;
  enforceFeeBlockOnReports?: boolean;
  outstandingFeeThreshold?: number | string | Prisma.Decimal;
  blockMessage?: string;
}

export interface ReportCardAccessEvaluation {
  isBlocked: boolean;
  status: ReportCardAccessStatus;
  balance: Prisma.Decimal;
  threshold: Prisma.Decimal;
  message?: string;
}

export class PortalAccessDAO {
  private static checkAdminPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) {
      throw new UnauthorizedError("Branch scope and authenticated user required.");
    }
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('portal:admin') ||
      perms.includes('settings:write') ||
      perms.includes('settings:admin')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing required permission: portal:admin or settings:write");
  }

  /**
   * Retrieves the portal access policy for a branch or returns defaults if none configured.
   */
  static async getPolicy(branchId: string): Promise<PortalAccessPolicy> {
    const policy = await db.portalAccessPolicy.findUnique({
      where: { branchId }
    });

    if (policy) return policy;

    return {
      id: `default-${branchId}`,
      branchId,
      allowStudentAccess: true,
      allowParentAccess: true,
      enforceFeeBlockOnReports: true,
      outstandingFeeThreshold: new Prisma.Decimal(0),
      blockMessage: "Your account has an outstanding fee balance. Please contact the accounts office to clear payments and access your academic reports.",
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Configures or updates the portal access policy for the current branch.
   */
  static async upsertPolicy(ctx: TenantContext, input: UpsertPortalAccessPolicyInput): Promise<PortalAccessPolicy> {
    this.checkAdminPermission(ctx);

    const threshold = input.outstandingFeeThreshold !== undefined
      ? new Prisma.Decimal(input.outstandingFeeThreshold.toString())
      : undefined;

    const policy = await db.portalAccessPolicy.upsert({
      where: { branchId: ctx.branchId },
      create: {
        branchId: ctx.branchId,
        allowStudentAccess: input.allowStudentAccess ?? true,
        allowParentAccess: input.allowParentAccess ?? true,
        enforceFeeBlockOnReports: input.enforceFeeBlockOnReports ?? true,
        outstandingFeeThreshold: threshold ?? new Prisma.Decimal(0),
        blockMessage: input.blockMessage ?? "Your account has an outstanding fee balance. Please contact the accounts office to clear payments and access your academic reports."
      },
      update: {
        ...(input.allowStudentAccess !== undefined ? { allowStudentAccess: input.allowStudentAccess } : {}),
        ...(input.allowParentAccess !== undefined ? { allowParentAccess: input.allowParentAccess } : {}),
        ...(input.enforceFeeBlockOnReports !== undefined ? { enforceFeeBlockOnReports: input.enforceFeeBlockOnReports } : {}),
        ...(threshold !== undefined ? { outstandingFeeThreshold: threshold } : {}),
        ...(input.blockMessage !== undefined ? { blockMessage: input.blockMessage } : {})
      }
    });

    await AuditService.log(
      ctx,
      'portal.policy.upsert',
      'PortalAccessPolicy',
      policy.id,
      JSON.stringify({ policy })
    );

    return policy;
  }

  /**
   * Evaluates whether a student's report card access is blocked due to outstanding debtor balance.
   * Debits minus credits on StudentLedgerEntry against GL #1200 student AR ledger.
   */
  static async checkReportCardAccess(branchId: string, studentId: string): Promise<ReportCardAccessEvaluation> {
    const policy = await this.getPolicy(branchId);

    // If branch policy disabled fee enforcement, allow unrestricted access
    if (!policy.enforceFeeBlockOnReports) {
      return {
        isBlocked: false,
        status: ReportCardAccessStatus.UNRESTRICTED,
        balance: new Prisma.Decimal(0),
        threshold: policy.outstandingFeeThreshold
      };
    }

    // Compute balance from authoritative ledger delegated to LedgerDAO
    const branch = await db.branch.findUnique({
      where: { id: branchId },
      include: { school: true }
    });
    const ctx: TenantContext = {
      branchId,
      userId: "system:portal",
      organizationId: branch?.school.organizationId || "",
      schoolId: branch?.schoolId || "",
      role: "SYSTEM",
      permissions: ["fees:read", "fees:ledger:read"]
    };
    const balanceRes = await LedgerDAO.getBalance(ctx, studentId);
    const currentBalance = balanceRes.balance;
    const threshold = policy.outstandingFeeThreshold;

    if (currentBalance.greaterThan(threshold)) {
      return {
        isBlocked: true,
        status: ReportCardAccessStatus.DEBTOR_BLOCKED,
        balance: currentBalance,
        threshold,
        message: policy.blockMessage || "Your account has an outstanding fee balance. Please contact the accounts office to clear payments and access your academic reports."
      };
    }

    return {
      isBlocked: false,
      status: ReportCardAccessStatus.FEE_THRESHOLD_MET,
      balance: currentBalance,
      threshold
    };
  }
}
