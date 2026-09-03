import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { Prisma, BoardingStatus, StudentLifecycleStatus } from "@prisma/client";
import { AuditService } from "../services/audit.service";
import { AdmissionSequenceDAO } from "./admissions-sequence.dao";
import { computeBlindIndex, encryptSecret, decryptSecret, maskIdentifier } from "../security/kyc-crypto";

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  admissionNo?: string;
  gender?: string;
  dateOfBirth?: Date | string;
  nationality?: string;
  nin?: string;
  linEmisNo?: string;
  birthCertNo?: string;
  passportNo?: string;
  dayOrBoarding?: BoardingStatus;
  residentialAddress?: string;
  villageLCI?: string;
  parish?: string;
  subCounty?: string;
  district?: string;
  medicalEmergencyNotes?: string;
  allergies?: string;
  bloodGroup?: string;
  specialNeeds?: string;
  previousSchoolName?: string;
  previousClass?: string;
  pleIndexNo?: string;
  pleAggregate?: number;
  pleDivision?: string;
  uceIndexNo?: string;
  uceAggregate?: number;
  classId?: string;
  streamId?: string;
  schoolPayCode?: string;
  familyGroupId?: string;
  applicantId?: string;
}

export interface UpdateStudentProfileInput {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  gender?: string;
  dateOfBirth?: Date | string;
  nationality?: string;
  nin?: string;
  linEmisNo?: string;
  birthCertNo?: string;
  passportNo?: string;
  dayOrBoarding?: BoardingStatus;
  residentialAddress?: string;
  villageLCI?: string;
  parish?: string;
  subCounty?: string;
  district?: string;
  medicalEmergencyNotes?: string;
  allergies?: string;
  bloodGroup?: string;
  specialNeeds?: string;
  previousSchoolName?: string;
  previousClass?: string;
  pleIndexNo?: string;
  pleAggregate?: number;
  pleDivision?: string;
  uceIndexNo?: string;
  uceAggregate?: number;
  classId?: string;
  streamId?: string;
}

export class StudentDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError("Branch scope required to fetch students.");
    const perms = ctx.permissions || [];
    if (perms.length === 0 || perms.includes('all') || perms.includes('students:read') || perms.includes('admissions:read')) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: students:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError("Branch scope and authenticated user required.");
    const perms = ctx.permissions || [];
    if (perms.length === 0 || perms.includes('all') || perms.includes('students:write') || perms.includes('admissions:write')) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: students:write");
  }

  /**
   * Retrieves all students for the current tenant branch with filtering and search.
   */
  static async getStudents(
    ctx: TenantContext,
    params?: {
      skip?: number;
      take?: number;
      search?: string;
      classId?: string;
      streamId?: string;
      lifecycleStatus?: StudentLifecycleStatus;
      dayOrBoarding?: BoardingStatus;
    }
  ) {
    this.checkReadPermission(ctx);

    const where: Prisma.StudentWhereInput = {
      branchId: ctx.branchId, // ENFORCED TENANT ISOLATION
      ...(params?.classId ? { classId: params.classId } : {}),
      ...(params?.streamId ? { streamId: params.streamId } : {}),
      ...(params?.lifecycleStatus ? { lifecycleStatus: params.lifecycleStatus } : {}),
      ...(params?.dayOrBoarding ? { dayOrBoarding: params.dayOrBoarding } : {}),
      ...(params?.search && {
        OR: [
          { firstName: { contains: params.search, mode: "insensitive" } },
          { lastName: { contains: params.search, mode: "insensitive" } },
          { admissionNo: { contains: params.search, mode: "insensitive" } },
          { linEmisNo: { contains: params.search, mode: "insensitive" } },
        ],
      }),
    };

    const [total, students] = await Promise.all([
      db.student.count({ where }),
      db.student.findMany({
        where,
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        include: {
          classRef: true,
          streamRef: true,
          guardians: {
            where: { isPrimaryContact: true },
            include: { guardian: true },
            take: 1
          }
        },
      }),
    ]);

    const formatted = students.map(s => ({
      ...s,
      nin: maskIdentifier(decryptSecret(s.nin)),
      passportNo: maskIdentifier(decryptSecret(s.passportNo)),
      primaryGuardian: s.guardians[0]?.guardian || null
    }));

    return { total, students: formatted };
  }

  /**
   * Retrieves a 360-degree comprehensive profile for a student.
   */
  static async getStudentById(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const student = await db.student.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        classRef: true,
        streamRef: true,
        familyGroup: true,
        guardians: {
          include: { guardian: true },
          orderBy: { accessPriority: 'asc' }
        },
        enrollments: {
          include: {
            academicYear: true,
            classRef: true,
            streamRef: true
          },
          orderBy: { createdAt: 'desc' }
        },
        invoices: {
          orderBy: { issueDate: 'desc' },
          take: 10
        },
        ledgerEntries: {
          orderBy: { postedAt: 'desc' },
          take: 15
        },
        requirementRecords: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        clearances: {
          orderBy: { issuedAt: 'desc' },
          take: 5
        },
        transportSubscriptions: {
          where: { status: 'ACTIVE' },
          include: { route: true, stop: true }
        },
        documents: {
          include: { verifiedBy: { select: { id: true, firstName: true, lastName: true } } }
        },
        lifecycleLogs: {
          include: { authorizedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { effectiveDate: 'desc' }
        }
      }
    });

    if (!student) {
      throw new Error("Student not found or access denied.");
    }

    const canDecryptKyc = (ctx.permissions || []).some(p => p === 'all' || p === 'kyc:decrypt');
    const canViewMedical = (ctx.permissions || []).some(p => p === 'all' || p === 'students:medical:view');

    if (canDecryptKyc) {
      await AuditService.log(ctx, 'pii.unmasked', 'Student', student.id, `Decrypted NIN for student ${student.admissionNo}`);
    }

    return {
      ...student,
      nin: canDecryptKyc ? decryptSecret(student.nin) : maskIdentifier(decryptSecret(student.nin)),
      passportNo: canDecryptKyc ? decryptSecret(student.passportNo) : maskIdentifier(decryptSecret(student.passportNo)),
      medicalEmergencyNotes: canViewMedical ? decryptSecret(student.medicalEmergencyNotes) : (student.medicalEmergencyNotes ? '*** [Restricted Medical Data]' : null),
      isKycUnmasked: canDecryptKyc,
      isMedicalUnmasked: canViewMedical
    };
  }

  /**
   * Updates student demographic details.
   */
  static async updateStudentProfile(ctx: TenantContext, id: string, data: UpdateStudentProfileInput) {
    this.checkWritePermission(ctx);

    const student = await db.student.findFirst({
      where: { id, branchId: ctx.branchId }
    });
    if (!student) throw new Error("Student not found in this branch.");

    const ninLookupHash = data.nin !== undefined
      ? (data.nin ? computeBlindIndex(data.nin, ctx.branchId) : null)
      : undefined;

    const updateData: Prisma.StudentUpdateInput = {
      firstName: data.firstName?.trim() || undefined,
      lastName: data.lastName?.trim() || undefined,
      middleName: data.middleName !== undefined ? data.middleName?.trim() || null : undefined,
      gender: data.gender || undefined,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      nationality: data.nationality || undefined,
      nin: data.nin !== undefined ? (data.nin ? encryptSecret(data.nin.trim().toUpperCase()) : null) : undefined,
      ninLookupHash,
      linEmisNo: data.linEmisNo !== undefined ? data.linEmisNo?.trim() || null : undefined,
      birthCertNo: data.birthCertNo !== undefined ? data.birthCertNo?.trim() || null : undefined,
      passportNo: data.passportNo !== undefined ? (data.passportNo ? encryptSecret(data.passportNo.trim()) : null) : undefined,
      dayOrBoarding: data.dayOrBoarding || undefined,
      residentialAddress: data.residentialAddress !== undefined ? data.residentialAddress || null : undefined,
      villageLCI: data.villageLCI !== undefined ? data.villageLCI || null : undefined,
      parish: data.parish !== undefined ? data.parish || null : undefined,
      subCounty: data.subCounty !== undefined ? data.subCounty || null : undefined,
      district: data.district !== undefined ? data.district || null : undefined,
      medicalEmergencyNotes: data.medicalEmergencyNotes !== undefined ? (data.medicalEmergencyNotes ? encryptSecret(data.medicalEmergencyNotes) : null) : undefined,
      allergies: data.allergies !== undefined ? data.allergies || null : undefined,
      bloodGroup: data.bloodGroup !== undefined ? data.bloodGroup || null : undefined,
      specialNeeds: data.specialNeeds !== undefined ? data.specialNeeds || null : undefined,
      previousSchoolName: data.previousSchoolName !== undefined ? data.previousSchoolName || null : undefined,
      previousClass: data.previousClass !== undefined ? data.previousClass || null : undefined,
      pleIndexNo: data.pleIndexNo !== undefined ? data.pleIndexNo || null : undefined,
      pleAggregate: data.pleAggregate !== undefined ? data.pleAggregate : undefined,
      pleDivision: data.pleDivision !== undefined ? data.pleDivision || null : undefined,
      uceIndexNo: data.uceIndexNo !== undefined ? data.uceIndexNo || null : undefined,
      uceAggregate: data.uceAggregate !== undefined ? data.uceAggregate : undefined,
      classRef: data.classId ? { connect: { id: data.classId } } : (data.classId === null ? { disconnect: true } : undefined),
      streamRef: data.streamId ? { connect: { id: data.streamId } } : (data.streamId === null ? { disconnect: true } : undefined),
    };

    const updated = await db.student.update({
      where: { id },
      data: updateData
    });

    await AuditService.log(
      ctx,
      'student.status_changed',
      'Student',
      id,
      `Updated student profile for ${updated.admissionNo}`
    );

    return updated;
  }

  /**
   * Creates a new student ensuring it belongs to the current tenant branch.
   * Auto-generates admission number if not explicitly specified.
   */
  static async createStudent(ctx: TenantContext, data: CreateStudentInput) {
    if (!ctx.branchId) throw new UnauthorizedError("Branch scope required to create a student.");

    const admissionNo = data.admissionNo || await AdmissionSequenceDAO.getNextSequence(ctx.branchId, 'ADM');
    const ninLookupHash = data.nin ? computeBlindIndex(data.nin, ctx.branchId) : null;

    if (ninLookupHash) {
      const existingNin = await db.student.findFirst({
        where: { branchId: ctx.branchId, ninLookupHash, status: 'ACTIVE' }
      });
      if (existingNin) {
        throw new Error(`Student with this National ID (NIN) already exists: ${existingNin.admissionNo}`);
      }
    }

    return db.student.create({
      data: {
        branchId: ctx.branchId, // ENFORCED TENANT ISOLATION
        admissionNo,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        middleName: data.middleName?.trim() || null,
        gender: data.gender || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        nationality: data.nationality || "Ugandan",
        nin: data.nin ? encryptSecret(data.nin.trim().toUpperCase()) : null,
        ninLookupHash,
        linEmisNo: data.linEmisNo?.trim() || null,
        birthCertNo: data.birthCertNo?.trim() || null,
        passportNo: data.passportNo ? encryptSecret(data.passportNo.trim()) : null,
        dayOrBoarding: data.dayOrBoarding || BoardingStatus.DAY,
        residentialAddress: data.residentialAddress || null,
        villageLCI: data.villageLCI || null,
        parish: data.parish || null,
        subCounty: data.subCounty || null,
        district: data.district || null,
        medicalEmergencyNotes: data.medicalEmergencyNotes ? encryptSecret(data.medicalEmergencyNotes) : null,
        allergies: data.allergies || null,
        bloodGroup: data.bloodGroup || null,
        specialNeeds: data.specialNeeds || null,
        previousSchoolName: data.previousSchoolName || null,
        previousClass: data.previousClass || null,
        pleIndexNo: data.pleIndexNo || null,
        pleAggregate: data.pleAggregate || null,
        pleDivision: data.pleDivision || null,
        uceIndexNo: data.uceIndexNo || null,
        uceAggregate: data.uceAggregate || null,
        classId: data.classId || null,
        streamId: data.streamId || null,
        schoolPayCode: data.schoolPayCode || admissionNo,
        familyGroupId: data.familyGroupId || null,
        applicantId: data.applicantId || null,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        admissionDate: new Date()
      },
    });
  }
}
