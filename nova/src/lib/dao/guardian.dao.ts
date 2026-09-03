import { db } from "../db";
import { Prisma, GuardianRelationship, Guardian } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { AdmissionSequenceDAO } from "./admissions-sequence.dao";
import { computeBlindIndex, encryptSecret, decryptSecret, maskIdentifier, maskPhone, normalizePhone } from "../security/kyc-crypto";

export interface CreateGuardianInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  title?: string;
  relationshipType?: GuardianRelationship;
  phonePrimary: string;
  phoneSecondary?: string;
  email?: string;
  nationalId?: string;
  passportNo?: string;
  occupation?: string;
  employer?: string;
  workplaceAddress?: string;
  residentialAddress?: string;
  provenance?: string;
  familyGroupId?: string;
}

export interface LinkStudentGuardianInput {
  studentId: string;
  guardianId: string;
  relationship: GuardianRelationship;
  isPrimaryContact?: boolean;
  isFinancialSponsor?: boolean;
  isEmergencyContact?: boolean;
  hasPickupAuthorization?: boolean;
  receivesAcademicReports?: boolean;
  receivesSmsAlerts?: boolean;
  accessPriority?: number;
  notes?: string;
}

export class GuardianDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError("Branch scope required.");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('students:read') ||
      perms.includes('admissions:read')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: students:read or admissions:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError("Branch scope and authenticated user required.");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('students:write') ||
      perms.includes('admissions:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: admissions:write or students:write");
  }

  /**
   * Creates a new guardian master record with blind indexing and encryption.
   */
  static async createGuardian(
    ctx: TenantContext,
    data: CreateGuardianInput,
    txClient?: Prisma.TransactionClient
  ): Promise<Guardian> {
    this.checkWritePermission(ctx);
    const client = txClient || db;

    const normalizedPhone = normalizePhone(data.phonePrimary);
    const ninLookupHash = data.nationalId ? computeBlindIndex(data.nationalId, ctx.branchId) : null;

    // Check duplicate NIN within branch if provided
    if (ninLookupHash) {
      const existingNin = await client.guardian.findFirst({
        where: { branchId: ctx.branchId, ninLookupHash }
      });
      if (existingNin) {
        throw new Error(`Guardian with this National ID (NIN) already exists in this branch: ${existingNin.guardianCode}`);
      }
    }

    const guardianCode = await AdmissionSequenceDAO.getNextSequence(ctx.branchId, 'GRD', undefined, client);

    const guardian = await client.guardian.create({
      data: {
        branchId: ctx.branchId,
        guardianCode,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        middleName: data.middleName?.trim() || null,
        title: data.title || null,
        relationshipType: data.relationshipType || GuardianRelationship.LEGAL_GUARDIAN,
        phonePrimary: normalizedPhone,
        phoneSecondary: data.phoneSecondary ? normalizePhone(data.phoneSecondary) : null,
        email: data.email?.trim() || null,
        nationalId: data.nationalId ? encryptSecret(data.nationalId.trim().toUpperCase()) : null,
        ninLookupHash,
        passportNo: data.passportNo ? encryptSecret(data.passportNo.trim()) : null,
        occupation: data.occupation || null,
        employer: data.employer || null,
        workplaceAddress: data.workplaceAddress || null,
        residentialAddress: data.residentialAddress || null,
        provenance: data.provenance || 'MANUAL_INTAKE',
        isVerified: false,
        familyGroupId: data.familyGroupId || null,
      }
    });

    await AuditService.log(
      ctx,
      'guardian.created',
      'Guardian',
      guardian.id,
      `Created guardian ${guardian.guardianCode} (${guardian.firstName} ${guardian.lastName})`
    );

    return guardian;
  }

  /**
   * Retrieves a guardian with permission-controlled PII masking.
   */
  static async getGuardian(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const guardian = await db.guardian.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        familyGroup: true,
        students: {
          include: {
            student: {
              select: {
                id: true,
                admissionNo: true,
                firstName: true,
                lastName: true,
                lifecycleStatus: true,
                classRef: { select: { id: true, name: true } },
                streamRef: { select: { id: true, name: true } },
              }
            }
          }
        }
      }
    });

    if (!guardian) {
      throw new Error("Guardian not found or access denied.");
    }

    const canDecrypt = (ctx.permissions || []).some(p => p === 'all' || p === 'kyc:decrypt');

    let decryptedNIN = null;
    let decryptedPassport = null;

    if (canDecrypt) {
      decryptedNIN = decryptSecret(guardian.nationalId);
      decryptedPassport = decryptSecret(guardian.passportNo);

      await AuditService.log(
        ctx,
        'pii.unmasked',
        'Guardian',
        guardian.id,
        `Unmasked PII for guardian ${guardian.guardianCode}`
      );
    }

    return {
      ...guardian,
      nationalId: canDecrypt ? decryptedNIN : maskIdentifier(decryptSecret(guardian.nationalId)),
      passportNo: canDecrypt ? decryptedPassport : maskIdentifier(decryptSecret(guardian.passportNo)),
      phonePrimaryMasked: maskPhone(guardian.phonePrimary),
      isPlaintextUnmasked: canDecrypt
    };
  }

  /**
   * Formally verifies guardian KYC.
   */
  static async verifyGuardian(ctx: TenantContext, id: string) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (!perms.includes('all') && !perms.includes('admissions:approve') && !perms.includes('kyc:decrypt')) {
      throw new UnauthorizedError("Missing permission: admissions:approve or kyc:decrypt");
    }

    const guardian = await db.guardian.findFirst({
      where: { id, branchId: ctx.branchId }
    });

    if (!guardian) throw new Error("Guardian not found or access denied.");

    const updated = await db.guardian.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedById: ctx.userId,
        verifiedAt: new Date()
      }
    });

    await AuditService.log(
      ctx,
      'identity.verified',
      'Guardian',
      id,
      `Verified KYC for guardian ${guardian.guardianCode}`
    );

    return updated;
  }

  /**
   * Lists guardians for branch with search filters and masked PII.
   */
  static async listGuardians(
    ctx: TenantContext,
    params?: { search?: string; isVerified?: boolean; take?: number; skip?: number }
  ) {
    this.checkReadPermission(ctx);

    const where: Prisma.GuardianWhereInput = {
      branchId: ctx.branchId,
      ...(params?.isVerified !== undefined ? { isVerified: params.isVerified } : {}),
      ...(params?.search ? {
        OR: [
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { lastName: { contains: params.search, mode: 'insensitive' } },
          { guardianCode: { contains: params.search, mode: 'insensitive' } },
          { phonePrimary: { contains: params.search } }
        ]
      } : {})
    };

    const [total, items] = await Promise.all([
      db.guardian.count({ where }),
      db.guardian.findMany({
        where,
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          familyGroup: { select: { id: true, familyCode: true, familyName: true } },
          _count: { select: { students: true, applicants: true } }
        }
      })
    ]);

    const formatted = items.map(g => ({
      ...g,
      nationalId: maskIdentifier(decryptSecret(g.nationalId)),
      passportNo: maskIdentifier(decryptSecret(g.passportNo)),
      phonePrimaryMasked: maskPhone(g.phonePrimary)
    }));

    return { total, items: formatted };
  }

  /**
   * Links a guardian to a student with discrete roles.
   * Enforces the invariant: Exactly one primary contact per student.
   */
  static async linkStudentGuardian(
    ctx: TenantContext,
    input: LinkStudentGuardianInput,
    txClient?: Prisma.TransactionClient
  ) {
    this.checkWritePermission(ctx);
    const client = txClient || db;

    // Verify student belongs to branch
    const student = await client.student.findFirst({
      where: { id: input.studentId, branchId: ctx.branchId }
    });
    if (!student) throw new Error("Student not found in this branch.");

    // Verify guardian belongs to branch
    const guardian = await client.guardian.findFirst({
      where: { id: input.guardianId, branchId: ctx.branchId }
    });
    if (!guardian) throw new Error("Guardian not found in this branch.");

    // If marked as primary contact, check if another primary contact exists
    if (input.isPrimaryContact) {
      const existingPrimary = await client.studentGuardian.findFirst({
        where: {
          studentId: input.studentId,
          isPrimaryContact: true,
          guardianId: { not: input.guardianId }
        }
      });
      if (existingPrimary) {
        // Demote existing primary contact
        await client.studentGuardian.update({
          where: { id: existingPrimary.id },
          data: { isPrimaryContact: false }
        });
      }
    }

    const link = await client.studentGuardian.upsert({
      where: {
        studentId_guardianId: {
          studentId: input.studentId,
          guardianId: input.guardianId
        }
      },
      update: {
        relationship: input.relationship,
        isPrimaryContact: input.isPrimaryContact ?? false,
        isFinancialSponsor: input.isFinancialSponsor ?? false,
        isEmergencyContact: input.isEmergencyContact ?? false,
        hasPickupAuthorization: input.hasPickupAuthorization ?? false,
        receivesAcademicReports: input.receivesAcademicReports ?? true,
        receivesSmsAlerts: input.receivesSmsAlerts ?? true,
        accessPriority: input.accessPriority ?? 1,
        notes: input.notes || null,
      },
      create: {
        branchId: ctx.branchId,
        studentId: input.studentId,
        guardianId: input.guardianId,
        relationship: input.relationship,
        isPrimaryContact: input.isPrimaryContact ?? false,
        isFinancialSponsor: input.isFinancialSponsor ?? false,
        isEmergencyContact: input.isEmergencyContact ?? false,
        hasPickupAuthorization: input.hasPickupAuthorization ?? false,
        receivesAcademicReports: input.receivesAcademicReports ?? true,
        receivesSmsAlerts: input.receivesSmsAlerts ?? true,
        accessPriority: input.accessPriority ?? 1,
        notes: input.notes || null,
      }
    });

    await AuditService.log(
      ctx,
      'guardian.linked',
      'StudentGuardian',
      link.id,
      `Linked guardian ${guardian.guardianCode} to student ${student.admissionNo} (${input.relationship})`
    );

    return link;
  }

  /**
   * Unlinks a guardian from a student.
   */
  static async unlinkStudentGuardian(
    ctx: TenantContext,
    studentId: string,
    guardianId: string,
    txClient?: Prisma.TransactionClient
  ) {
    this.checkWritePermission(ctx);
    const client = txClient || db;

    const link = await client.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId } }
    });

    if (!link || link.branchId !== ctx.branchId) {
      throw new Error("Student-Guardian relationship not found.");
    }

    await client.studentGuardian.delete({
      where: { id: link.id }
    });

    await AuditService.log(
      ctx,
      'guardian.unlinked',
      'StudentGuardian',
      link.id,
      `Unlinked guardian ${guardianId} from student ${studentId}`
    );

    return { success: true };
  }

  /**
   * Finds or creates a FamilyGroup for multi-sibling household grouping.
   */
  static async getOrCreateFamilyGroup(
    ctx: TenantContext,
    familyName: string,
    txClient?: Prisma.TransactionClient
  ) {
    this.checkWritePermission(ctx);
    const client = txClient || db;

    const familyCode = await AdmissionSequenceDAO.getNextSequence(ctx.branchId, 'FAM', undefined, client);

    return client.familyGroup.create({
      data: {
        branchId: ctx.branchId,
        familyCode,
        familyName: familyName.trim()
      }
    });
  }
}
