import { db } from "../db";
import { ProvisioningTaskStatus } from "@prisma/client";
import { TenantContext } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { InvoiceDAO } from "./invoice.dao";
import { RequirementsDAO } from "./requirements.dao";
import { TransportDAO, Context as TransportContext } from "./transport.dao";
import { InventoryDAO, Context as InventoryContext } from "./inventory.dao";

export interface ProvisioningOptions {
  autoBill?: boolean;
  termId?: string | null;
  feeStructureId?: string | null;
  dueDate?: Date | string;
  transportRouteId?: string | null;
  transportStopId?: string | null;
  uniformStoreId?: string | null;
  uniformItems?: Array<{ itemId: string; quantity: number; unitPrice?: number }>;
}

export class ProvisioningRunner {
  /**
   * Runs the post-commit idempotent downstream provisioning tasks.
   */
  static async run(ctx: TenantContext, provisioningId: string, options?: ProvisioningOptions) {
    const prov = await db.enrollmentProvisioning.findUnique({
      where: { id: provisioningId },
      include: {
        student: true,
        enrollment: {
          include: {
            classRef: true,
            streamRef: true,
            academicYear: true
          }
        }
      }
    });

    if (!prov || prov.branchId !== ctx.branchId) {
      throw new Error("Enrollment provisioning record not found.");
    }

    const { student, enrollment } = prov;
    const updates: Partial<{
      billingStatus: ProvisioningTaskStatus;
      billingInvoiceId: string | null;
      billingError: string | null;
      requirementsStatus: ProvisioningTaskStatus;
      requirementsError: string | null;
      transportStatus: ProvisioningTaskStatus;
      transportError: string | null;
      storeOrderStatus: ProvisioningTaskStatus;
      storeOrderError: string | null;
      schoolPayStatus: ProvisioningTaskStatus;
      schoolPayError: string | null;
      overallStatus: ProvisioningTaskStatus;
      lastAttemptAt: Date;
      nextRetryAt: Date | null;
      retryCount: number;
    }> = {
      lastAttemptAt: new Date(),
      retryCount: prov.retryCount + 1
    };

    let hasFailures = false;

    const provCtx: TenantContext = {
      ...ctx,
      permissions: Array.from(new Set([
        ...(ctx.permissions || []),
        'fees:invoices:write',
        'fees:write',
        'requirements:assign',
        'inventory:write',
        'transport:write',
        'all'
      ]))
    };

    // ==========================================
    // 1. BILLING PROVISIONING (InvoiceDAO)
    // ==========================================
    if (prov.billingStatus !== ProvisioningTaskStatus.COMPLETED) {
      if (options?.autoBill === false) {
        updates.billingStatus = ProvisioningTaskStatus.SKIPPED;
      } else {
        try {
          // Resolve FeeStructure if not explicitly provided
          let feeStructureId = options?.feeStructureId;
          if (!feeStructureId) {
            const activeStructure = await db.feeStructure.findFirst({
              where: {
                branchId: ctx.branchId,
                classId: enrollment.classId,
                academicYearId: enrollment.academicYearId,
                isActive: true,
                ...(options?.termId ? { termId: options.termId } : {})
              }
            });
            feeStructureId = activeStructure?.id || null;
          }

          if (feeStructureId) {
            const dueDate = options?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const invoice = await InvoiceDAO.createIndividualInvoice(provCtx, {
              studentId: student.id,
              enrollmentId: enrollment.id,
              academicYearId: enrollment.academicYearId,
              termId: options?.termId || null,
              feeStructureId,
              dueDate,
              notes: `Admission Enrollment Billing - ${enrollment.classRef.name}`
            });

            updates.billingStatus = ProvisioningTaskStatus.COMPLETED;
            updates.billingInvoiceId = invoice.id;
            updates.billingError = null;
          } else {
            // No active fee structure found for class -> skip auto-billing
            updates.billingStatus = ProvisioningTaskStatus.SKIPPED;
          }
        } catch (err: unknown) {
          hasFailures = true;
          updates.billingStatus = ProvisioningTaskStatus.FAILED_RETRYABLE;
          updates.billingError = (err as Error).message || "Failed to generate initial enrollment invoice.";
        }
      }
    }

    // ==========================================
    // 2. REQUIREMENTS PROVISIONING (RequirementsDAO)
    // ==========================================
    if (prov.requirementsStatus !== ProvisioningTaskStatus.COMPLETED) {
      try {
        const blueprint = await db.classRequirement.findFirst({
          where: {
            branchId: ctx.branchId,
            classId: enrollment.classId,
            academicYearId: enrollment.academicYearId,
            isActive: true,
            ...(options?.termId ? { termId: options.termId } : {})
          }
        });

        if (blueprint) {
          await RequirementsDAO.bulkAssignRequirements(provCtx, {
            classRequirementId: blueprint.id,
            academicYearId: enrollment.academicYearId,
            termId: options?.termId || null,
            studentIds: [student.id]
          });
          updates.requirementsStatus = ProvisioningTaskStatus.COMPLETED;
          updates.requirementsError = null;
        } else {
          updates.requirementsStatus = ProvisioningTaskStatus.SKIPPED;
        }
      } catch (err: unknown) {
        hasFailures = true;
        updates.requirementsStatus = ProvisioningTaskStatus.FAILED_RETRYABLE;
        updates.requirementsError = (err as Error).message || "Failed to assign requirements blueprint.";
      }
    }

    // ==========================================
    // 3. TRANSPORT PROVISIONING (TransportDAO)
    // ==========================================
    if (prov.transportStatus !== ProvisioningTaskStatus.COMPLETED) {
      if (options?.transportRouteId) {
        try {
          const transportCtx: TransportContext = {
            branchId: ctx.branchId,
            userId: ctx.userId || "system",
            permissions: ctx.permissions || ["all"]
          };

          await TransportDAO.subscribeStudent(transportCtx, {
            studentId: student.id,
            routeId: options.transportRouteId,
            stopId: options.transportStopId || null,
            academicYearId: enrollment.academicYearId,
            termId: options?.termId || null
          });

          updates.transportStatus = ProvisioningTaskStatus.COMPLETED;
          updates.transportError = null;
        } catch (err: unknown) {
          hasFailures = true;
          updates.transportStatus = ProvisioningTaskStatus.FAILED_RETRYABLE;
          updates.transportError = (err as Error).message || "Failed to subscribe student to transport route.";
        }
      } else {
        updates.transportStatus = ProvisioningTaskStatus.SKIPPED;
      }
    }

    // ==========================================
    // 4. STORE / UNIFORM PROVISIONING (InventoryDAO)
    // ==========================================
    if (prov.storeOrderStatus !== ProvisioningTaskStatus.COMPLETED) {
      if (options?.uniformStoreId && options.uniformItems && options.uniformItems.length > 0) {
        try {
          const invCtx: InventoryContext = {
            branchId: ctx.branchId,
            userId: ctx.userId || "system",
            permissions: ctx.permissions || ["all"]
          };

          const invoiceId = updates.billingInvoiceId || prov.billingInvoiceId || null;
          const isInvoiceCharge = !!invoiceId;

          await InventoryDAO.recordStudentStoreSale(invCtx, {
            studentId: student.id,
            storeId: options.uniformStoreId,
            academicYearId: enrollment.academicYearId,
            termId: options?.termId || null,
            isInvoiceCharge,
            invoiceId: isInvoiceCharge ? invoiceId : null,
            notes: "Admission Uniform and Supplies Order",
            items: options.uniformItems.map(i => ({
              itemId: i.itemId,
              quantity: i.quantity,
              unitPrice: i.unitPrice
            }))
          });

          updates.storeOrderStatus = ProvisioningTaskStatus.COMPLETED;
          updates.storeOrderError = null;
        } catch (err: unknown) {
          hasFailures = true;
          updates.storeOrderStatus = ProvisioningTaskStatus.FAILED_RETRYABLE;
          updates.storeOrderError = (err as Error).message || "Failed to record student store sale.";
        }
      } else {
        updates.storeOrderStatus = ProvisioningTaskStatus.SKIPPED;
      }
    }

    // ==========================================
    // 5. SCHOOLPAY PROVISIONING (Local Mapping & Gateway Configuration)
    // ==========================================
    if (prov.schoolPayStatus !== ProvisioningTaskStatus.COMPLETED) {
      try {
        // Ensure student has local schoolPayCode set (defaults to admissionNo)
        if (!student.schoolPayCode) {
          await db.student.update({
            where: { id: student.id },
            data: { schoolPayCode: student.admissionNo }
          });
        }

        // Check if SchoolPay Gateway is configured and enabled
        const spConfig = await db.schoolPayConfig.findUnique({
          where: { branchId: ctx.branchId }
        });

        if (spConfig && spConfig.enabled) {
          // SchoolPay config exists and active
          updates.schoolPayStatus = ProvisioningTaskStatus.COMPLETED;
          updates.schoolPayError = null;
        } else {
          // SchoolPay not active -> local mapping is sufficient
          updates.schoolPayStatus = ProvisioningTaskStatus.COMPLETED;
          updates.schoolPayError = null;
        }
      } catch (err: unknown) {
        hasFailures = true;
        updates.schoolPayStatus = ProvisioningTaskStatus.FAILED_RETRYABLE;
        updates.schoolPayError = (err as Error).message || "Failed to configure SchoolPay code.";
      }
    }

    // ==========================================
    // OVERALL STATUS DETERMINATION
    // ==========================================
    if (hasFailures) {
      updates.overallStatus = ProvisioningTaskStatus.FAILED_RETRYABLE;
      // Exponential backoff: 2m, 10m, 30m, 2h, 6h
      const backoffMinutes = [2, 10, 30, 120, 360][Math.min(prov.retryCount, 4)] || 120;
      updates.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await AuditService.log(
        ctx,
        'provisioning.partially_failed',
        'EnrollmentProvisioning',
        provisioningId,
        `Provisioning partially failed for student ${student.admissionNo}. Next retry at ${updates.nextRetryAt.toISOString()}`
      );
    } else {
      updates.overallStatus = ProvisioningTaskStatus.COMPLETED;
      updates.nextRetryAt = null;

      await AuditService.log(
        ctx,
        'provisioning.completed',
        'EnrollmentProvisioning',
        provisioningId,
        `All provisioning tasks completed for student ${student.admissionNo}`
      );
    }

    return db.enrollmentProvisioning.update({
      where: { id: provisioningId },
      data: updates
    });
  }

  /**
   * Retries failed provisioning tasks.
   */
  static async retry(ctx: TenantContext, provisioningId: string, options?: ProvisioningOptions) {
    return this.run(ctx, provisioningId, options);
  }
}
