import { db } from "../db";
import {
  Prisma,
  ExeatType,
  ExeatStatus,
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { WelfareSequenceDAO } from "./welfare-sequence.dao";
import crypto from "crypto";

export interface RequestExeatInput {
  studentId: string;
  academicYearId: string;
  termId?: string;
  exeatType: ExeatType;
  reason: string;
  intendedDeparture: Date | string;
  expectedReturn: Date | string;
  guardianId?: string;
  guardianConsent?: boolean;
  guardianConsentMethod?: string; // e.g. "PHONE_CONFIRMATION", "IN_PERSON", "SMS_TOKEN"
  accompanyingAdult?: string;
}

export interface GateActionInput {
  exeatId?: string;
  qrVerificationToken?: string;
}

export class ExeatDAO {
  private static checkPermission(ctx: TenantContext, requiredPermission: string) {
    if (!ctx.branchId || !ctx.userId) {
      throw new UnauthorizedError("Branch scope and authenticated user required.");
    }
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('exeat:admin') ||
      perms.includes(requiredPermission)
    ) {
      return true;
    }
    throw new UnauthorizedError(`Missing required permission: ${requiredPermission}`);
  }

  /**
   * Requests an exeat/gate-pass for a student.
   */
  static async requestExeat(ctx: TenantContext, input: RequestExeatInput) {
    this.checkPermission(ctx, 'exeat:request');

    return db.$transaction(async (tx) => {
      // 1. Verify student exists in branch
      const student = await tx.student.findFirst({
        where: { id: input.studentId, branchId: ctx.branchId }
      });
      if (!student) throw new Error("Student not found in this branch.");

      // 2. Validate guardian if provided
      if (input.guardianId) {
        const guardianLink = await tx.studentGuardian.findFirst({
          where: { studentId: input.studentId, guardianId: input.guardianId }
        });
        if (!guardianLink) {
          throw new Error("Specified guardian is not associated with this student.");
        }
      }

      // 3. Generate sequential exeat number and secure verification token
      const exeatNumber = await WelfareSequenceDAO.getNextSequence(ctx.branchId, 'EXT', undefined, tx);
      const qrVerificationToken = crypto.randomBytes(24).toString('hex');

      // 4. Create ExeatPass record
      const exeat = await tx.exeatPass.create({
        data: {
          branchId: ctx.branchId,
          exeatNumber,
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          exeatType: input.exeatType,
          reason: input.reason.trim(),
          intendedDeparture: new Date(input.intendedDeparture),
          expectedReturn: new Date(input.expectedReturn),
          guardianConsent: input.guardianConsent ?? true,
          guardianId: input.guardianId || null,
          guardianConsentMethod: input.guardianConsentMethod || "PHONE_CONFIRMATION",
          accompanyingAdult: input.accompanyingAdult?.trim() || null,
          status: ExeatStatus.PENDING,
          qrVerificationToken,
        }
      });

      await AuditService.log(
        ctx,
        'exeat.requested',
        'ExeatPass',
        exeat.id,
        JSON.stringify({
          exeatNumber: exeat.exeatNumber,
          studentId: exeat.studentId,
          exeatType: exeat.exeatType,
        })
      );

      return exeat;
    });
  }

  /**
   * Approves an exeat pass by authorized staff.
   */
  static async approveExeat(ctx: TenantContext, exeatId: string) {
    this.checkPermission(ctx, 'exeat:approve');

    return db.$transaction(async (tx) => {
      const exeat = await tx.exeatPass.findFirst({
        where: { id: exeatId, branchId: ctx.branchId, status: ExeatStatus.PENDING }
      });
      if (!exeat) throw new Error("Pending exeat pass not found.");

      const approved = await tx.exeatPass.update({
        where: { id: exeatId },
        data: {
          status: ExeatStatus.APPROVED,
          approvedById: ctx.userId,
          approvedAt: new Date(),
        }
      });

      await AuditService.log(
        ctx,
        'exeat.approved',
        'ExeatPass',
        approved.id,
        JSON.stringify({
          exeatNumber: approved.exeatNumber,
          approvedById: ctx.userId,
        })
      );

      return approved;
    });
  }

  /**
   * Gate Departure: Records departure when student exits school premises.
   * Can be verified using QR token or exeatId.
   */
  static async gateCheckout(ctx: TenantContext, input: GateActionInput) {
    this.checkPermission(ctx, 'exeat:gate');

    return db.$transaction(async (tx) => {
      const where: Prisma.ExeatPassWhereInput = {
        branchId: ctx.branchId,
        ...(input.exeatId ? { id: input.exeatId } : {}),
        ...(input.qrVerificationToken ? { qrVerificationToken: input.qrVerificationToken } : {}),
      };

      const exeat = await tx.exeatPass.findFirst({
        where,
        include: {
          student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } }
        }
      });

      if (!exeat) throw new Error("Exeat pass not found.");

      if (exeat.status !== ExeatStatus.APPROVED) {
        throw new Error(`Exeat pass is not in APPROVED state (current state: ${exeat.status}). Cannot depart.`);
      }

      const updated = await tx.exeatPass.update({
        where: { id: exeat.id },
        data: {
          status: ExeatStatus.DEPARTED,
          actualDeparture: new Date(),
          gateOfficerDepartId: ctx.userId,
        }
      });

      await AuditService.log(
        ctx,
        'exeat.gate_departed',
        'ExeatPass',
        updated.id,
        JSON.stringify({
          exeatNumber: updated.exeatNumber,
          studentId: updated.studentId,
          gateOfficerId: ctx.userId,
        })
      );

      return updated;
    });
  }

  /**
   * Gate Checkin: Records arrival when student returns to school premises.
   * Automatically calculates overdue status.
   */
  static async gateCheckin(ctx: TenantContext, input: GateActionInput) {
    this.checkPermission(ctx, 'exeat:gate');

    return db.$transaction(async (tx) => {
      const where: Prisma.ExeatPassWhereInput = {
        branchId: ctx.branchId,
        ...(input.exeatId ? { id: input.exeatId } : {}),
        ...(input.qrVerificationToken ? { qrVerificationToken: input.qrVerificationToken } : {}),
      };

      const exeat = await tx.exeatPass.findFirst({
        where,
        include: {
          student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } }
        }
      });

      if (!exeat) throw new Error("Exeat pass not found.");

      if (exeat.status !== ExeatStatus.DEPARTED) {
        throw new Error(`Exeat pass is not in DEPARTED state (current state: ${exeat.status}). Cannot return.`);
      }

      const now = new Date();
      const isOverdue = now.getTime() > new Date(exeat.expectedReturn).getTime();

      const updated = await tx.exeatPass.update({
        where: { id: exeat.id },
        data: {
          status: ExeatStatus.COMPLETED,
          actualReturn: now,
          gateOfficerReturnId: ctx.userId,
          isOverdue,
        }
      });

      await AuditService.log(
        ctx,
        'exeat.gate_returned',
        'ExeatPass',
        updated.id,
        JSON.stringify({
          exeatNumber: updated.exeatNumber,
          studentId: updated.studentId,
          isOverdue,
          gateOfficerId: ctx.userId,
        })
      );

      return updated;
    });
  }

  /**
   * Verifies an exeat pass by its QR verification token (for gate scanner / verification view).
   */
  static async verifyPassByToken(ctx: TenantContext, token: string) {
    this.checkPermission(ctx, 'exeat:read');

    const exeat = await db.exeatPass.findFirst({
      where: { qrVerificationToken: token, branchId: ctx.branchId },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            firstName: true,
            lastName: true,
            gender: true,
            classRef: { select: { name: true } },
            streamRef: { select: { name: true } }
          }
        },
        guardian: {
          select: { id: true, firstName: true, lastName: true, phonePrimary: true }
        },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        gateOfficerDepart: { select: { id: true, firstName: true, lastName: true } },
        gateOfficerReturn: { select: { id: true, firstName: true, lastName: true } },
      }
    });

    if (!exeat) throw new Error("Invalid or expired exeat QR token.");
    return exeat;
  }

  /**
   * Scans and updates overdue status on all departed exeat passes past their expected return.
   */
  static async updateOverduePasses(ctx: TenantContext) {
    this.checkPermission(ctx, 'exeat:read');

    const now = new Date();
    const result = await db.exeatPass.updateMany({
      where: {
        branchId: ctx.branchId,
        status: ExeatStatus.DEPARTED,
        expectedReturn: { lt: now },
        isOverdue: false,
      },
      data: {
        isOverdue: true,
      }
    });

    return { updatedCount: result.count };
  }

  static async listExeatPasses(
    ctx: TenantContext,
    filters?: {
      studentId?: string;
      status?: ExeatStatus;
      isOverdue?: boolean;
    }
  ) {
    this.checkPermission(ctx, 'exeat:read');

    return db.exeatPass.findMany({
      where: {
        branchId: ctx.branchId,
        ...(filters?.studentId ? { studentId: filters.studentId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.isOverdue !== undefined ? { isOverdue: filters.isOverdue } : {}),
      },
      orderBy: { intendedDeparture: 'desc' },
      include: {
        student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } },
        guardian: { select: { id: true, firstName: true, lastName: true, phonePrimary: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      }
    });
  }
}
