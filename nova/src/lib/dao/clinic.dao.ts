import { db } from "../db";
import {
  Prisma,
  TriagePriority,
  DiagnosticCategory,
  StockMovementType,
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { WelfareSequenceDAO } from "./welfare-sequence.dao";
import { InventoryDAO } from "./inventory.dao";
import { encryptSecret, decryptSecret } from "../security/kyc-crypto";

export interface CreateEncounterInput {
  studentId: string;
  academicYearId: string;
  termId?: string;
  triagePriority?: TriagePriority;
  temperature?: number | Prisma.Decimal;
  pulseRate?: number;
  bloodPressure?: string;
  respiratoryRate?: number;
  weightKg?: number | Prisma.Decimal;
  chiefComplaint: string;
  diagnosticCategory?: DiagnosticCategory;
  symptoms?: string;
  clinicalNotes?: string;
  diagnosis?: string;
  outcome?: string;
}

export interface AdmitSickbayInput {
  encounterId: string;
  bedNumber: string;
  notes?: string;
}

export interface DischargeSickbayInput {
  admissionId: string;
  dischargeCondition: string;
  outcome?: string;
  notes?: string;
}

export interface CreateReferralInput {
  encounterId: string;
  externalFacilityName: string;
  referralReason: string;
  ambulanceDispatched?: boolean;
  escortStaffId?: string;
  guardianNotifiedAt?: Date | string;
  guardianNotificationNotes?: string;
}

export interface DispenseMedicineInput {
  encounterId: string;
  itemId: string;
  storeId: string;
  quantity: number;
  dosageInstructions: string;
}

export class ClinicDAO {
  private static checkPermission(ctx: TenantContext, requiredPermission: string) {
    if (!ctx.branchId || !ctx.userId) {
      throw new UnauthorizedError("Branch scope and authenticated user required.");
    }
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('clinic:admin') ||
      perms.includes(requiredPermission)
    ) {
      return true;
    }
    throw new UnauthorizedError(`Missing required permission: ${requiredPermission}`);
  }

  private static hasMedicalRecordsPermission(ctx: TenantContext): boolean {
    const perms = ctx.permissions || [];
    return perms.includes('all') || perms.includes('clinic:admin') || perms.includes('clinic:medical_records');
  }

  // ==========================================
  // ENCOUNTERS & TRIAGE
  // ==========================================

  static async createEncounter(ctx: TenantContext, input: CreateEncounterInput) {
    this.checkPermission(ctx, 'clinic:write');

    return db.$transaction(async (tx) => {
      // 1. Verify student exists in branch
      const student = await tx.student.findFirst({
        where: { id: input.studentId, branchId: ctx.branchId },
        select: {
          id: true,
          admissionNo: true,
          firstName: true,
          lastName: true,
          medicalEmergencyNotes: true,
          allergies: true,
        }
      });
      if (!student) throw new Error("Student not found in this branch.");

      // 2. Generate sequential encounter number
      const encounterNumber = await WelfareSequenceDAO.getNextSequence(ctx.branchId, 'CLN', undefined, tx);

      // 3. Encrypt sensitive health information
      const symptomsEncrypted = input.symptoms ? encryptSecret(input.symptoms) : null;
      const clinicalNotesEncrypted = input.clinicalNotes ? encryptSecret(input.clinicalNotes) : null;
      const diagnosisEncrypted = input.diagnosis ? encryptSecret(input.diagnosis) : null;

      // 4. Create encounter record
      const encounter = await tx.clinicEncounter.create({
        data: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          encounterNumber,
          attendingStaffId: ctx.userId,
          checkInAt: new Date(),
          triagePriority: input.triagePriority ?? TriagePriority.ROUTINE,
          temperature: input.temperature ? new Prisma.Decimal(input.temperature) : null,
          pulseRate: input.pulseRate || null,
          bloodPressure: input.bloodPressure || null,
          respiratoryRate: input.respiratoryRate || null,
          weightKg: input.weightKg ? new Prisma.Decimal(input.weightKg) : null,
          chiefComplaint: input.chiefComplaint.trim(),
          diagnosticCategory: input.diagnosticCategory ?? DiagnosticCategory.OTHER,
          symptomsEncrypted,
          clinicalNotesEncrypted,
          diagnosisEncrypted,
          outcome: input.outcome || "TREATED_AND_RETURNED",
        }
      });

      // 5. Audit Log
      await AuditService.log(
        ctx,
        'clinic.encounter_created',
        'ClinicEncounter',
        encounter.id,
        JSON.stringify({
          encounterNumber: encounter.encounterNumber,
          studentId: encounter.studentId,
          triagePriority: encounter.triagePriority,
          diagnosticCategory: encounter.diagnosticCategory,
        })
      );

      return {
        ...encounter,
        symptoms: input.symptoms || null,
        clinicalNotes: input.clinicalNotes || null,
        diagnosis: input.diagnosis || null,
        studentAllergyAlert: student.allergies || null,
        studentMedicalAlert: student.medicalEmergencyNotes || null,
      };
    });
  }

  static async getEncounterById(ctx: TenantContext, id: string) {
    this.checkPermission(ctx, 'clinic:read');

    const encounter = await db.clinicEncounter.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            firstName: true,
            lastName: true,
            gender: true,
            allergies: true,
            bloodGroup: true,
            medicalEmergencyNotes: true,
            guardians: {
              include: {
                guardian: {
                  select: { id: true, firstName: true, lastName: true, phonePrimary: true }
                }
              }
            }
          }
        },
        attendingStaff: { select: { id: true, firstName: true, lastName: true, email: true } },
        sickbayAdmission: true,
        referral: true,
        dispensations: {
          include: {
            item: { select: { id: true, code: true, name: true, unitOfMeasure: true } }
          }
        }
      }
    });

    if (!encounter) throw new Error("Clinic encounter not found.");

    const canViewMedical = this.hasMedicalRecordsPermission(ctx);

    return {
      ...encounter,
      symptoms: canViewMedical ? decryptSecret(encounter.symptomsEncrypted) : "[CONFIDENTIAL MEDICAL RECORD]",
      clinicalNotes: canViewMedical ? decryptSecret(encounter.clinicalNotesEncrypted) : "[CONFIDENTIAL MEDICAL RECORD]",
      diagnosis: canViewMedical ? decryptSecret(encounter.diagnosisEncrypted) : "[CONFIDENTIAL MEDICAL RECORD]",
      isRedacted: !canViewMedical,
    };
  }

  static async listEncounters(
    ctx: TenantContext,
    filters?: {
      studentId?: string;
      triagePriority?: TriagePriority;
      startDate?: Date | string;
      endDate?: Date | string;
    }
  ) {
    this.checkPermission(ctx, 'clinic:read');
    const canViewMedical = this.hasMedicalRecordsPermission(ctx);

    const where: Prisma.ClinicEncounterWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.studentId ? { studentId: filters.studentId } : {}),
      ...(filters?.triagePriority ? { triagePriority: filters.triagePriority } : {}),
      ...(filters?.startDate || filters?.endDate ? {
        checkInAt: {
          ...(filters?.startDate ? { gte: new Date(filters.startDate) } : {}),
          ...(filters?.endDate ? { lte: new Date(filters.endDate) } : {}),
        }
      } : {}),
    };

    const encounters = await db.clinicEncounter.findMany({
      where,
      orderBy: { checkInAt: 'desc' },
      include: {
        student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } },
        attendingStaff: { select: { id: true, firstName: true, lastName: true } },
        sickbayAdmission: { select: { id: true, bedNumber: true, dischargedAt: true } },
        referral: { select: { id: true, externalFacilityName: true } },
      }
    });

    return encounters.map((e) => ({
      ...e,
      symptoms: canViewMedical ? decryptSecret(e.symptomsEncrypted) : "[CONFIDENTIAL]",
      clinicalNotes: canViewMedical ? decryptSecret(e.clinicalNotesEncrypted) : "[CONFIDENTIAL]",
      diagnosis: canViewMedical ? decryptSecret(e.diagnosisEncrypted) : "[CONFIDENTIAL]",
      isRedacted: !canViewMedical,
    }));
  }

  // ==========================================
  // SICKBAY ADMISSION & DISCHARGE
  // ==========================================

  static async admitToSickbay(ctx: TenantContext, input: AdmitSickbayInput) {
    this.checkPermission(ctx, 'clinic:write');

    return db.$transaction(async (tx) => {
      const encounter = await tx.clinicEncounter.findFirst({
        where: { id: input.encounterId, branchId: ctx.branchId }
      });
      if (!encounter) throw new Error("Clinic encounter not found.");

      const admission = await tx.sickbayAdmission.create({
        data: {
          branchId: ctx.branchId,
          encounterId: input.encounterId,
          studentId: encounter.studentId,
          bedNumber: input.bedNumber.trim(),
          admittedAt: new Date(),
          attendingNurseId: ctx.userId,
          notes: input.notes || null,
        }
      });

      await tx.clinicEncounter.update({
        where: { id: input.encounterId },
        data: { outcome: "SICKBAY_ADMITTED" }
      });

      await AuditService.log(
        ctx,
        'clinic.sickbay_admitted',
        'SickbayAdmission',
        admission.id,
        JSON.stringify({ studentId: admission.studentId, bedNumber: admission.bedNumber })
      );

      return admission;
    });
  }

  static async dischargeFromSickbay(ctx: TenantContext, input: DischargeSickbayInput) {
    this.checkPermission(ctx, 'clinic:write');

    return db.$transaction(async (tx) => {
      const admission = await tx.sickbayAdmission.findFirst({
        where: { id: input.admissionId, branchId: ctx.branchId },
        include: { encounter: true }
      });
      if (!admission) throw new Error("Sickbay admission not found.");

      const discharged = await tx.sickbayAdmission.update({
        where: { id: input.admissionId },
        data: {
          dischargedAt: new Date(),
          dischargeCondition: input.dischargeCondition,
          notes: input.notes ? `${admission.notes || ''}\nDischarge Notes: ${input.notes}`.trim() : admission.notes,
        }
      });

      await tx.clinicEncounter.update({
        where: { id: admission.encounterId },
        data: {
          checkOutAt: new Date(),
          outcome: input.outcome || "TREATED_AND_RETURNED"
        }
      });

      await AuditService.log(
        ctx,
        'clinic.sickbay_discharged',
        'SickbayAdmission',
        discharged.id,
        JSON.stringify({ studentId: discharged.studentId, condition: input.dischargeCondition })
      );

      return discharged;
    });
  }

  // ==========================================
  // MEDICAL REFERRALS
  // ==========================================

  static async referStudent(ctx: TenantContext, input: CreateReferralInput) {
    this.checkPermission(ctx, 'clinic:write');

    return db.$transaction(async (tx) => {
      const encounter = await tx.clinicEncounter.findFirst({
        where: { id: input.encounterId, branchId: ctx.branchId }
      });
      if (!encounter) throw new Error("Clinic encounter not found.");

      const referral = await tx.medicalReferral.create({
        data: {
          branchId: ctx.branchId,
          encounterId: input.encounterId,
          studentId: encounter.studentId,
          externalFacilityName: input.externalFacilityName.trim(),
          referralReason: input.referralReason.trim(),
          ambulanceDispatched: input.ambulanceDispatched ?? false,
          escortStaffId: input.escortStaffId || null,
          guardianNotifiedAt: input.guardianNotifiedAt ? new Date(input.guardianNotifiedAt) : null,
          guardianNotificationNotes: input.guardianNotificationNotes || null,
          dispatchedAt: new Date(),
        }
      });

      await tx.clinicEncounter.update({
        where: { id: input.encounterId },
        data: {
          checkOutAt: new Date(),
          outcome: "REFERRED"
        }
      });

      await AuditService.log(
        ctx,
        'clinic.referral_created',
        'MedicalReferral',
        referral.id,
        JSON.stringify({
          studentId: referral.studentId,
          externalFacility: referral.externalFacilityName,
          ambulance: referral.ambulanceDispatched
        })
      );

      return referral;
    });
  }

  // ==========================================
  // DISPENSARY & INVENTORY INTEGRATION
  // ==========================================

  /**
   * Dispenses medication to student and mutates pharmacy store stock using InventoryDAO.
   * Decrements on-hand quantity with DEPARTMENT_ISSUE and tracks WAC cost.
   */
  static async dispenseMedicine(ctx: TenantContext, input: DispenseMedicineInput) {
    this.checkPermission(ctx, 'clinic:write');

    return db.$transaction(async (tx) => {
      // 1. Fetch encounter
      const encounter = await tx.clinicEncounter.findFirst({
        where: { id: input.encounterId, branchId: ctx.branchId },
        include: {
          student: {
            select: { id: true, admissionNo: true, firstName: true, lastName: true, allergies: true }
          }
        }
      });
      if (!encounter) throw new Error("Clinic encounter not found.");

      // 2. Fetch inventory item
      const item = await tx.inventoryItem.findFirst({
        where: { id: input.itemId, branchId: ctx.branchId, isActive: true }
      });
      if (!item) throw new Error("Active inventory item not found in this branch.");

      // 3. Allergy safety check
      if (encounter.student.allergies) {
        const lowerAllergies = encounter.student.allergies.toLowerCase();
        const lowerItemName = item.name.toLowerCase();
        if (lowerAllergies.includes(lowerItemName) || lowerItemName.includes(lowerAllergies)) {
          throw new Error(`CRITICAL MEDICAL ALERT: Student has recorded allergy to ${encounter.student.allergies}. Dispensing blocked.`);
        }
      }

      // 4. Mutate inventory stock atomically through InventoryDAO authority
      await InventoryDAO.recordStockMutation(tx, {
        branchId: ctx.branchId,
        storeId: input.storeId,
        itemId: input.itemId,
        movementType: StockMovementType.DEPARTMENT_ISSUE,
        quantityDelta: new Prisma.Decimal(input.quantity).mul(-1),
        referenceType: "CLINIC_ENCOUNTER",
        referenceId: encounter.encounterNumber,
        reason: `Clinic Dispensing for student ${encounter.student.admissionNo}: ${input.dosageInstructions}`,
        performedById: ctx.userId,
        allowNegative: false,
      });

      // 5. Create dispensing record
      const record = await tx.clinicDispensingRecord.create({
        data: {
          branchId: ctx.branchId,
          encounterId: input.encounterId,
          studentId: encounter.studentId,
          itemId: input.itemId,
          storeId: input.storeId,
          quantity: input.quantity,
          dosageInstructions: input.dosageInstructions.trim(),
          dispensedById: ctx.userId,
          dispensedAt: new Date(),
        },
        include: {
          item: { select: { code: true, name: true, unitOfMeasure: true } }
        }
      });

      await AuditService.log(
        ctx,
        'clinic.medicine_dispensed',
        'ClinicDispensingRecord',
        record.id,
        JSON.stringify({
          studentId: record.studentId,
          itemId: record.itemId,
          itemCode: record.item.code,
          quantity: record.quantity,
        })
      );

      return record;
    });
  }
}
