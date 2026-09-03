import { db } from "../db";
import { Prisma, ApplicantStatus, BoardingStatus, StudentLifecycleStatus, GuardianRelationship } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { AdmissionSequenceDAO } from "./admissions-sequence.dao";
import { computeBlindIndex, encryptSecret, decryptSecret, maskIdentifier } from "../security/kyc-crypto";
import { ProvisioningRunner, ProvisioningOptions } from "./provisioning.runner";

export interface CreateInquiryInput {
  academicYearId: string;
  targetClassId: string;
  targetStreamId?: string | null;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: string;
  dateOfBirth?: Date | string;
  nationality?: string;
  dayOrBoarding?: BoardingStatus;
  guardianId?: string;
  guardianPhone?: string;
  guardianName?: string;
}

export interface SubmitApplicationInput {
  nin?: string;
  linEmisNo?: string;
  birthCertNo?: string;
  passportNo?: string;
  residentialAddress?: string;
  villageLCI?: string;
  parish?: string;
  subCounty?: string;
  district?: string;
  previousSchoolName?: string;
  previousClass?: string;
  pleIndexNo?: string;
  pleAggregate?: number;
  pleDivision?: string;
  uceIndexNo?: string;
  uceAggregate?: number;
  medicalEmergencyNotes?: string;
  allergies?: string;
  bloodGroup?: string;
  specialNeeds?: string;
  intendedTransportRouteId?: string | null;
}

export class AdmissionsDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError("Branch scope required.");
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('admissions:read') || perms.includes('students:read')) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: admissions:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError("Branch scope and authenticated user required.");
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('admissions:write')) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: admissions:write");
  }

  private static checkApprovePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError("Branch scope and authenticated user required.");
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('admissions:approve')) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: admissions:approve");
  }

  private static checkEnrollPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError("Branch scope and authenticated user required.");
    const perms = ctx.permissions || [];
    if (perms.includes('all') || perms.includes('admissions:enroll') || perms.includes('admissions:approve')) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: admissions:enroll");
  }

  /**
   * Creates an initial applicant inquiry.
   */
  static async createInquiry(ctx: TenantContext, input: CreateInquiryInput) {
    this.checkWritePermission(ctx);

    // Validate class belongs to branch
    const classRef = await db.class.findFirst({
      where: { id: input.targetClassId, branchId: ctx.branchId }
    });
    if (!classRef) throw new Error("Target class not found in this branch.");

    // Validate academic year
    const academicYear = await db.academicYear.findFirst({
      where: { id: input.academicYearId, branchId: ctx.branchId }
    });
    if (!academicYear) throw new Error("Academic Year not found in this branch.");

    const applicationNumber = await AdmissionSequenceDAO.getNextSequence(ctx.branchId, 'APP');

    const applicant = await db.applicant.create({
      data: {
        branchId: ctx.branchId,
        applicationNumber,
        academicYearId: input.academicYearId,
        targetClassId: input.targetClassId,
        targetStreamId: input.targetStreamId || null,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        middleName: input.middleName?.trim() || null,
        gender: input.gender || null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        nationality: input.nationality || "Ugandan",
        dayOrBoarding: input.dayOrBoarding || BoardingStatus.DAY,
        status: ApplicantStatus.INQUIRY,
        createdById: ctx.userId
      }
    });

    // If guardianId provided, link immediately
    if (input.guardianId) {
      const guardian = await db.guardian.findFirst({
        where: { id: input.guardianId, branchId: ctx.branchId }
      });
      if (guardian) {
        await db.applicantGuardian.create({
          data: {
            applicantId: applicant.id,
            guardianId: guardian.id,
            relationship: guardian.relationshipType || GuardianRelationship.LEGAL_GUARDIAN,
            isPrimaryContact: true
          }
        });
      }
    }

    await AuditService.log(
      ctx,
      'applicant.created',
      'Applicant',
      applicant.id,
      `Created inquiry ${applicant.applicationNumber} for ${applicant.firstName} ${applicant.lastName}`
    );

    return applicant;
  }

  /**
   * Submits complete application details with KYC and prior academics.
   */
  static async submitApplication(ctx: TenantContext, applicantId: string, input: SubmitApplicationInput) {
    this.checkWritePermission(ctx);

    const applicant = await db.applicant.findFirst({
      where: { id: applicantId, branchId: ctx.branchId }
    });
    if (!applicant) throw new Error("Applicant not found in this branch.");

    const ninLookupHash = input.nin ? computeBlindIndex(input.nin, ctx.branchId) : null;

    // Check duplicate student NIN within branch
    if (ninLookupHash) {
      const existingStudent = await db.student.findFirst({
        where: { branchId: ctx.branchId, ninLookupHash, status: 'ACTIVE' }
      });
      if (existingStudent) {
        throw new Error(`An active student with this National ID (NIN) already exists: ${existingStudent.admissionNo}`);
      }
    }

    // Check duplicate LIN/EMIS within branch
    if (input.linEmisNo) {
      const existingLin = await db.student.findFirst({
        where: { branchId: ctx.branchId, linEmisNo: input.linEmisNo.trim(), status: 'ACTIVE' }
      });
      if (existingLin) {
        throw new Error(`An active student with this Learner ID (LIN/EMIS) already exists: ${existingLin.admissionNo}`);
      }
    }

    const updated = await db.applicant.update({
      where: { id: applicantId },
      data: {
        status: ApplicantStatus.SUBMITTED,
        nin: input.nin ? encryptSecret(input.nin.trim().toUpperCase()) : undefined,
        ninLookupHash: ninLookupHash || undefined,
        linEmisNo: input.linEmisNo?.trim() || undefined,
        birthCertNo: input.birthCertNo?.trim() || undefined,
        passportNo: input.passportNo ? encryptSecret(input.passportNo.trim()) : undefined,
        residentialAddress: input.residentialAddress || undefined,
        villageLCI: input.villageLCI || undefined,
        parish: input.parish || undefined,
        subCounty: input.subCounty || undefined,
        district: input.district || undefined,
        previousSchoolName: input.previousSchoolName || undefined,
        previousClass: input.previousClass || undefined,
        pleIndexNo: input.pleIndexNo || undefined,
        pleAggregate: input.pleAggregate !== undefined ? input.pleAggregate : undefined,
        pleDivision: input.pleDivision || undefined,
        uceIndexNo: input.uceIndexNo || undefined,
        uceAggregate: input.uceAggregate !== undefined ? input.uceAggregate : undefined,
        medicalEmergencyNotes: input.medicalEmergencyNotes ? encryptSecret(input.medicalEmergencyNotes) : undefined,
        allergies: input.allergies || undefined,
        bloodGroup: input.bloodGroup || undefined,
        specialNeeds: input.specialNeeds || undefined,
        intendedTransportRouteId: input.intendedTransportRouteId !== undefined ? input.intendedTransportRouteId : undefined,
        reviewedById: ctx.userId,
        reviewedAt: new Date()
      }
    });

    await AuditService.log(
      ctx,
      'applicant.reviewed',
      'Applicant',
      applicantId,
      `Submitted full application for ${updated.applicationNumber}`
    );

    return updated;
  }

  /**
   * Records entrance diagnostic exam and interview rubrics.
   */
  static async recordAssessment(
    ctx: TenantContext,
    applicantId: string,
    data: { score: number; notes?: string; assessedById?: string }
  ) {
    this.checkWritePermission(ctx);

    const applicant = await db.applicant.findFirst({
      where: { id: applicantId, branchId: ctx.branchId }
    });
    if (!applicant) throw new Error("Applicant not found in this branch.");

    const updated = await db.applicant.update({
      where: { id: applicantId },
      data: {
        status: ApplicantStatus.ASSESSMENT_SCHEDULED,
        assessmentScore: data.score,
        assessmentNotes: data.notes || null,
        assessedById: data.assessedById || ctx.userId,
        assessedAt: new Date()
      }
    });

    await AuditService.log(
      ctx,
      'applicant.assessed',
      'Applicant',
      applicantId,
      `Recorded assessment score ${data.score} for ${applicant.applicationNumber}`
    );

    return updated;
  }

  /**
   * Issues formal admission offer. Enforces 4-Eye Maker-Checker governance.
   */
  static async issueAdmissionOffer(
    ctx: TenantContext,
    applicantId: string,
    data: { decisionReason: string; validDays?: number }
  ) {
    this.checkApprovePermission(ctx);

    const applicant = await db.applicant.findFirst({
      where: { id: applicantId, branchId: ctx.branchId }
    });
    if (!applicant) throw new Error("Applicant not found in this branch.");

    // 4-Eye Maker-Checker Invariant: Maker cannot self-approve admission offer
    if (applicant.createdById === ctx.userId || applicant.reviewedById === ctx.userId) {
      throw new Error("Maker-Checker violation: The user who created or reviewed this application cannot approve the admission offer. A second authorized checker is required.");
    }

    const validDays = data.validDays && data.validDays > 0 ? data.validDays : 14;
    const offerValidUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

    const updated = await db.applicant.update({
      where: { id: applicantId },
      data: {
        status: ApplicantStatus.ADMISSION_OFFERED,
        decisionReason: data.decisionReason.trim(),
        decisionById: ctx.userId,
        decisionDate: new Date(),
        offerValidUntil
      }
    });

    await AuditService.log(
      ctx,
      'offer.issued',
      'Applicant',
      applicantId,
      `Issued admission offer for ${applicant.applicationNumber}, valid until ${offerValidUntil.toISOString()}`
    );

    return updated;
  }

  /**
   * Records guardian offer acceptance and payment deposit.
   */
  static async acceptOffer(ctx: TenantContext, applicantId: string, data?: { applicationPaymentId?: string }) {
    this.checkWritePermission(ctx);

    const applicant = await db.applicant.findFirst({
      where: { id: applicantId, branchId: ctx.branchId }
    });
    if (!applicant) throw new Error("Applicant not found in this branch.");

    if (applicant.status !== ApplicantStatus.ADMISSION_OFFERED) {
      throw new Error(`Cannot accept offer: Applicant is currently in status ${applicant.status}, expected ADMISSION_OFFERED.`);
    }

    // Expiration check
    if (applicant.offerValidUntil && new Date() > applicant.offerValidUntil) {
      throw new Error("Cannot accept offer: The admission offer has expired.");
    }

    const updated = await db.applicant.update({
      where: { id: applicantId },
      data: {
        status: ApplicantStatus.OFFER_ACCEPTED,
        applicationFeePaid: data?.applicationPaymentId ? true : applicant.applicationFeePaid,
        applicationPaymentId: data?.applicationPaymentId || applicant.applicationPaymentId
      }
    });

    await AuditService.log(
      ctx,
      'offer.accepted',
      'Applicant',
      applicantId,
      `Accepted admission offer for ${applicant.applicationNumber}`
    );

    return updated;
  }

  /**
   * Rejects an application or offer.
   */
  static async rejectOffer(ctx: TenantContext, applicantId: string, reason: string) {
    this.checkApprovePermission(ctx);

    const applicant = await db.applicant.findFirst({
      where: { id: applicantId, branchId: ctx.branchId }
    });
    if (!applicant) throw new Error("Applicant not found in this branch.");

    const updated = await db.applicant.update({
      where: { id: applicantId },
      data: {
        status: ApplicantStatus.OFFER_REJECTED,
        decisionReason: reason.trim(),
        decisionById: ctx.userId,
        decisionDate: new Date()
      }
    });

    await AuditService.log(
      ctx,
      'offer.rejected',
      'Applicant',
      applicantId,
      `Rejected offer for ${applicant.applicationNumber}: ${reason}`
    );

    return updated;
  }

  /**
   * Executes the Single-Click Onboarding Pipeline:
   * 1. Local Database Transaction (Atomic Sub-ms Boundary)
   * 2. Post-Commit Asynchronous Provisioning Runner
   */
  static async enrollApplicant(
    ctx: TenantContext,
    applicantId: string,
    options?: ProvisioningOptions & {
      targetClassId?: string;
      targetStreamId?: string | null;
    }
  ) {
    this.checkEnrollPermission(ctx);

    // 1. Verify Applicant State
    const applicant = await db.applicant.findFirst({
      where: { id: applicantId, branchId: ctx.branchId },
      include: {
        guardians: { include: { guardian: true } },
        documents: true,
        academicYear: true
      }
    });

    if (!applicant) {
      throw new Error("Applicant not found in this branch.");
    }

    if (applicant.status === ApplicantStatus.ENROLLED || applicant.enrolledStudentId) {
      throw new Error(`Applicant ${applicant.applicationNumber} is already enrolled.`);
    }

    if (
      applicant.status !== ApplicantStatus.OFFER_ACCEPTED &&
      applicant.status !== ApplicantStatus.ADMISSION_OFFERED
    ) {
      throw new Error(`Cannot enroll applicant in status ${applicant.status}. Expected OFFER_ACCEPTED or ADMISSION_OFFERED.`);
    }

    // Check expiration
    if (applicant.offerValidUntil && new Date() > applicant.offerValidUntil) {
      throw new Error("Cannot enroll applicant: The admission offer has expired.");
    }

    const classId = options?.targetClassId || applicant.targetClassId;
    const streamId = options?.targetStreamId !== undefined ? options.targetStreamId : applicant.targetStreamId;

    // Verify target class exists in branch
    const classRef = await db.class.findFirst({
      where: { id: classId, branchId: ctx.branchId }
    });
    if (!classRef) throw new Error("Target class not found in this branch.");

    // ==========================================
    // LOCAL ATOMIC DATABASE TRANSACTION
    // ==========================================
    const txResult = await db.$transaction(async (tx) => {
      // a. Generate sequential admission number
      const admissionNo = await AdmissionSequenceDAO.getNextSequence(ctx.branchId, 'ADM', undefined, tx);

      // b. Create Student master record
      const student = await tx.student.create({
        data: {
          branchId: ctx.branchId,
          admissionNo,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          middleName: applicant.middleName,
          gender: applicant.gender,
          dateOfBirth: applicant.dateOfBirth,
          nationality: applicant.nationality,
          nin: applicant.nin,
          ninLookupHash: applicant.ninLookupHash,
          linEmisNo: applicant.linEmisNo,
          birthCertNo: applicant.birthCertNo,
          passportNo: applicant.passportNo,
          dayOrBoarding: applicant.dayOrBoarding,
          residentialAddress: applicant.residentialAddress,
          villageLCI: applicant.villageLCI,
          parish: applicant.parish,
          subCounty: applicant.subCounty,
          district: applicant.district,
          medicalEmergencyNotes: applicant.medicalEmergencyNotes,
          allergies: applicant.allergies,
          bloodGroup: applicant.bloodGroup,
          specialNeeds: applicant.specialNeeds,
          previousSchoolName: applicant.previousSchoolName,
          previousClass: applicant.previousClass,
          pleIndexNo: applicant.pleIndexNo,
          pleAggregate: applicant.pleAggregate,
          pleDivision: applicant.pleDivision,
          uceIndexNo: applicant.uceIndexNo,
          uceAggregate: applicant.uceAggregate,
          classId,
          streamId,
          schoolPayCode: admissionNo, // Deterministic local default
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
          admissionDate: new Date(),
          applicantId: applicant.id
        }
      });

      // c. Create Academic Enrollment record
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          academicYearId: applicant.academicYearId,
          classId,
          streamId,
          status: 'ACTIVE'
        }
      });

      // d. Link Guardians
      for (const ag of applicant.guardians) {
        await tx.studentGuardian.create({
          data: {
            branchId: ctx.branchId,
            studentId: student.id,
            guardianId: ag.guardianId,
            relationship: ag.relationship,
            isPrimaryContact: ag.isPrimaryContact,
            isFinancialSponsor: ag.isFinancialSponsor,
            isEmergencyContact: ag.isEmergencyContact,
            hasPickupAuthorization: ag.hasPickupAuthorization
          }
        });

        // Sibling detection: Check if guardian already has another student in this branch
        const otherLinks = await tx.studentGuardian.findMany({
          where: {
            branchId: ctx.branchId,
            guardianId: ag.guardianId,
            studentId: { not: student.id }
          },
          include: { student: true }
        });

        if (otherLinks.length > 0) {
          // Found siblings! Group into FamilyGroup
          let familyGroupId = ag.guardian.familyGroupId;
          if (!familyGroupId) {
            const familyCode = await AdmissionSequenceDAO.getNextSequence(ctx.branchId, 'FAM', undefined, tx);
            const fam = await tx.familyGroup.create({
              data: {
                branchId: ctx.branchId,
                familyCode,
                familyName: `The ${student.lastName} Family`
              }
            });
            familyGroupId = fam.id;
            await tx.guardian.update({
              where: { id: ag.guardianId },
              data: { familyGroupId }
            });
          }

          // Link student to family group
          await tx.student.update({
            where: { id: student.id },
            data: { familyGroupId }
          });
        }
      }

      // e. Copy Applicant documents to Student documents
      for (const doc of applicant.documents) {
        await tx.studentDocument.create({
          data: {
            branchId: ctx.branchId,
            studentId: student.id,
            documentType: doc.documentType,
            documentTitle: doc.documentTitle,
            storageKey: doc.storageKey,
            fileSizeBytes: doc.fileSizeBytes,
            mimeType: doc.mimeType,
            sha256Checksum: doc.sha256Checksum,
            verificationStatus: doc.verificationStatus,
            verificationNotes: doc.verificationNotes,
            verifiedById: doc.verifiedById,
            verifiedAt: doc.verifiedAt
          }
        });
      }

      // f. Insert initial StudentLifecycleLog
      await tx.studentLifecycleLog.create({
        data: {
          branchId: ctx.branchId,
          studentId: student.id,
          fromStatus: StudentLifecycleStatus.PROSPECTIVE,
          toStatus: StudentLifecycleStatus.ACTIVE,
          reason: `Initial enrollment from application ${applicant.applicationNumber}`,
          effectiveDate: new Date(),
          authorizedById: ctx.userId
        }
      });

      // g. Create EnrollmentProvisioning record (Status: PENDING)
      const provisioning = await tx.enrollmentProvisioning.create({
        data: {
          branchId: ctx.branchId,
          studentId: student.id,
          enrollmentId: enrollment.id,
          overallStatus: 'PENDING'
        }
      });

      // h. Update Applicant to ENROLLED
      const updatedApplicant = await tx.applicant.update({
        where: { id: applicant.id },
        data: {
          status: ApplicantStatus.ENROLLED,
          enrolledStudentId: student.id
        }
      });

      return { student, enrollment, provisioning, applicant: updatedApplicant };
    });

    await AuditService.log(
      ctx,
      'enrollment.confirmed',
      'Student',
      txResult.student.id,
      `Successfully enrolled applicant ${applicant.applicationNumber} as student ${txResult.student.admissionNo}`
    );

    // ==========================================
    // POST-COMMIT ASYNCHRONOUS PROVISIONING RUNNER
    // ==========================================
    const provisioningResult = await ProvisioningRunner.run(ctx, txResult.provisioning.id, {
      ...options,
      transportRouteId: options?.transportRouteId !== undefined ? options.transportRouteId : applicant.intendedTransportRouteId
    });

    return {
      student: txResult.student,
      enrollment: txResult.enrollment,
      provisioning: provisioningResult,
      applicant: txResult.applicant
    };
  }

  /**
   * Retrieves an applicant by ID with masked PII.
   */
  static async getApplicant(ctx: TenantContext, id: string) {
    this.checkReadPermission(ctx);

    const applicant = await db.applicant.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        targetClass: true,
        targetStream: true,
        academicYear: true,
        guardians: { include: { guardian: true } },
        documents: true,
        enrolledStudent: true
      }
    });

    if (!applicant) throw new Error("Applicant not found or access denied.");

    const canDecrypt = (ctx.permissions || []).some(p => p === 'all' || p === 'kyc:decrypt');

    if (canDecrypt && (applicant.nin || applicant.passportNo)) {
      await AuditService.log(
        ctx,
        'pii.unmasked',
        'Applicant',
        applicant.id,
        `Unmasked sensitive identity PII for applicant ${applicant.applicationNumber}`
      );
    }

    return {
      ...applicant,
      nin: canDecrypt ? decryptSecret(applicant.nin) : maskIdentifier(decryptSecret(applicant.nin)),
      passportNo: canDecrypt ? decryptSecret(applicant.passportNo) : maskIdentifier(decryptSecret(applicant.passportNo)),
      isPlaintextUnmasked: canDecrypt
    };
  }

  /**
   * Lists applicants with pipeline filters.
   */
  static async listApplicants(
    ctx: TenantContext,
    params?: {
      status?: ApplicantStatus;
      targetClassId?: string;
      academicYearId?: string;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    this.checkReadPermission(ctx);

    const where: Prisma.ApplicantWhereInput = {
      branchId: ctx.branchId,
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.targetClassId ? { targetClassId: params.targetClassId } : {}),
      ...(params?.academicYearId ? { academicYearId: params.academicYearId } : {}),
      ...(params?.search ? {
        OR: [
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { lastName: { contains: params.search, mode: 'insensitive' } },
          { applicationNumber: { contains: params.search, mode: 'insensitive' } }
        ]
      } : {})
    };

    const [total, items] = await Promise.all([
      db.applicant.count({ where }),
      db.applicant.findMany({
        where,
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          targetClass: { select: { id: true, name: true } },
          targetStream: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          enrolledStudent: { select: { id: true, admissionNo: true } }
        }
      })
    ]);

    const formatted = items.map(a => ({
      ...a,
      nin: maskIdentifier(decryptSecret(a.nin))
    }));

    return { total, items: formatted };
  }

  /**
   * Computes the Admissions Conversion Funnel metrics.
   */
  static async getFunnelMetrics(ctx: TenantContext, academicYearId?: string) {
    this.checkReadPermission(ctx);

    const where: Prisma.ApplicantWhereInput = {
      branchId: ctx.branchId,
      ...(academicYearId ? { academicYearId } : {})
    };

    const [inquiries, submitted, assessed, offered, accepted, enrolled, waitlisted, rejected] = await Promise.all([
      db.applicant.count({ where }),
      db.applicant.count({ where: { ...where, status: { in: ['SUBMITTED', 'ASSESSMENT_SCHEDULED', 'ADMISSION_OFFERED', 'OFFER_ACCEPTED', 'ENROLLED'] } } }),
      db.applicant.count({ where: { ...where, assessmentScore: { not: null } } }),
      db.applicant.count({ where: { ...where, status: { in: ['ADMISSION_OFFERED', 'OFFER_ACCEPTED', 'ENROLLED'] } } }),
      db.applicant.count({ where: { ...where, status: { in: ['OFFER_ACCEPTED', 'ENROLLED'] } } }),
      db.applicant.count({ where: { ...where, status: 'ENROLLED' } }),
      db.applicant.count({ where: { ...where, status: 'WAITLISTED' } }),
      db.applicant.count({ where: { ...where, status: { in: ['OFFER_REJECTED', 'WITHDRAWN'] } } })
    ]);

    return {
      inquiries,
      submitted,
      assessed,
      offered,
      accepted,
      enrolled,
      waitlisted,
      rejected,
      inquiryToSubmittedPct: inquiries > 0 ? (submitted / inquiries) * 100 : 0,
      offerToAcceptedPct: offered > 0 ? (accepted / offered) * 100 : 0,
      acceptedToEnrolledPct: accepted > 0 ? (enrolled / accepted) * 100 : 0
    };
  }
}
