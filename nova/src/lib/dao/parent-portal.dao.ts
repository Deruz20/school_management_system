import { LedgerDAO } from "./ledger.dao";
import { db } from "../db";
import {
  ParentConsentType,
  ExeatStatus,
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { PortalAccessDAO, ReportCardAccessStatus } from "./portal-access.dao";
import { PortalActivityDAO } from "./portal-activity.dao";

export interface RecordConsentInput {
  guardianId: string;
  studentId: string;
  consentType: ParentConsentType;
  referenceType?: string;
  referenceId?: string;
  granted: boolean;
  digitalSignature?: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

export class ParentPortalDAO {
  /**
   * Authorizes that a guardian has a valid relationship to the specified student.
   */
  static async validateGuardianAccess(guardianId: string, studentId: string) {
    const relation = await db.studentGuardian.findFirst({
      where: {
        guardianId,
        studentId
      },
      include: {
        student: {
          include: {
            branch: { select: { id: true, name: true } },
            classRef: { select: { id: true, name: true } },
            streamRef: { select: { id: true, name: true } }
          }
        },
        guardian: true
      }
    });

    if (!relation) {
      throw new UnauthorizedError("Guardian is not authorized to access records for this student.");
    }

    return relation;
  }

  /**
   * Retrieves all children/wards linked to the authenticated guardian with high-level summaries.
   */
  static async getGuardianChildren(guardianId: string, branchId?: string) {
    const relations = await db.studentGuardian.findMany({
      where: {
        guardianId,
        ...(branchId ? { branchId } : {})
      },
      include: {
        student: {
          include: {
            branch: { select: { id: true, name: true } },
            classRef: { select: { id: true, name: true } },
            streamRef: { select: { id: true, name: true } },
            bedAllocations: {
              where: { status: 'ACTIVE' },
              include: {
                bed: {
                  include: {
                    room: {
                      include: {
                        hostel: true
                      }
                    }
                  }
                }
              },
              take: 1
            }
          }
        }
      },
      orderBy: { accessPriority: 'asc' }
    });

    // Enrich each child with fee balance and pending consents
    const results = await Promise.all(
      relations.map(async (rel) => {
        const student = rel.student;

        // Calculate current fee balance with guardian financial authorization check
        const isFinancialAuthorized = rel.isFinancialSponsor || rel.isPrimaryContact;
        let outstandingBalance: number | null = null;
        let isDebtor: boolean | null = null;

        if (isFinancialAuthorized) {
          const branch = await db.branch.findUnique({
            where: { id: student.branchId },
            include: { school: true }
          });
          const ctx: TenantContext = {
            branchId: student.branchId,
            userId: guardianId,
            organizationId: branch?.school.organizationId || "",
            schoolId: branch?.schoolId || "",
            role: "PARENT",
            permissions: ["fees:read", "fees:ledger:read"]
          };
          const ledgerRes = await LedgerDAO.getBalance(ctx, student.id);
          outstandingBalance = ledgerRes.balance.toNumber();
          isDebtor = ledgerRes.balance.greaterThan(0);
        }

        // Check pending exeat requests requiring parent consent
        const pendingExeatCount = await db.exeatPass.count({
          where: {
            studentId: student.id,
            status: ExeatStatus.PENDING,
            guardianConsent: false
          }
        });

        // Active hostel bed
        const activeBed = student.bedAllocations[0] ? {
          hostelName: student.bedAllocations[0].bed.room.hostel.name,
          roomNumber: student.bedAllocations[0].bed.room.roomNumber,
          bedNumber: student.bedAllocations[0].bed.bedNumber
        } : null;

        return {
          studentId: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: `${student.firstName} ${student.lastName}`.trim(),
          admissionNo: student.admissionNo,
          gender: student.gender,
          lifecycleStatus: student.lifecycleStatus,
          branch: student.branch,
          className: student.classRef?.name || null,
          streamName: student.streamRef?.name || null,
          relationship: rel.relationship,
          isPrimaryContact: rel.isPrimaryContact,
          isFinancialSponsor: rel.isFinancialSponsor,
          receivesAcademicReports: rel.receivesAcademicReports,
          outstandingBalance,
          isDebtor,
          isFinancialAuthorized,
          pendingExeatCount,
          activeBed
        };
      })
    );

    return results;
  }

  /**
   * Retrieves academic performance and report cards for a child, enforcing Debtor Block if configured.
   */
  static async getChildAcademicReport(guardianId: string, studentId: string, termId?: string) {
    const relation = await this.validateGuardianAccess(guardianId, studentId);
    const student = relation.student;

    const canViewAcademics = relation.receivesAcademicReports || relation.isPrimaryContact;
    if (!canViewAcademics) {
      throw new UnauthorizedError("Guardian account is not configured to receive academic reports for this student.");
    }

    // Evaluate debtor report card block policy
    const evaluation = await PortalAccessDAO.checkReportCardAccess(student.branchId, studentId);

    if (evaluation.isBlocked) {
      return {
        accessStatus: ReportCardAccessStatus.DEBTOR_BLOCKED,
        isBlocked: true,
        outstandingBalance: evaluation.balance.toNumber(),
        threshold: evaluation.threshold.toNumber(),
        message: evaluation.message,
        results: null
      };
    }

    // Retrieve academic results
    const enrollments = await db.enrollment.findMany({
      where: {
        studentId,
        status: 'ACTIVE'
      },
      include: {
        academicYear: true,
        classRef: true,
        termResults: {
          where: {
            status: 'FINALIZED',
            ...(termId ? { termId } : {})
          },
          include: {
            term: true,
            subjects: {
              include: {
                subject: true
              }
            }
          },
          orderBy: { finalizedAt: 'desc' }
        }
      }
    });

    const reportCards = enrollments.flatMap((enrollment) =>
      enrollment.termResults.map((tr) => ({
        termResultId: tr.id,
        termId: tr.termId,
        termName: tr.term.name,
        academicYear: enrollment.academicYear.name,
        className: enrollment.classRef.name,
        totalScore: tr.totalScore,
        aggregatePoints: tr.aggregatePoints,
        division: tr.division,
        finalizedAt: tr.finalizedAt,
        subjects: tr.subjects.map((sub) => ({
          subjectId: sub.subjectId,
          subjectCode: sub.subject.code,
          subjectName: sub.subject.name,
          score: sub.score,
          grade: sub.grade,
          points: sub.points,
          remarks: sub.remarks
        }))
      }))
    );

    return {
      accessStatus: evaluation.status,
      isBlocked: false,
      outstandingBalance: evaluation.balance.toNumber(),
      threshold: evaluation.threshold.toNumber(),
      message: null,
      results: reportCards
    };
  }

  /**
   * Retrieves full chronological financial statement and invoices for a child.
   */
  static async getChildFeeStatement(guardianId: string, studentId: string) {
    const relation = await this.validateGuardianAccess(guardianId, studentId);

    // Enforce Financial Authorization Gate
    if (!relation.isFinancialSponsor && !relation.isPrimaryContact) {
      throw new UnauthorizedError("Guardian is not authorized to view financial information for this student.");
    }

    const student = relation.student;

    // Authoritative balance delegated to LedgerDAO
    const branch = await db.branch.findUnique({
      where: { id: student.branchId },
      include: { school: true }
    });
    const ctx: TenantContext = {
      branchId: student.branchId,
      userId: guardianId,
      organizationId: branch?.school.organizationId || "",
      schoolId: branch?.schoolId || "",
      role: "PARENT",
      permissions: ["fees:read", "fees:ledger:read"]
    };
    const ledgerRes = await LedgerDAO.getBalance(ctx, studentId);
    const currentBalance = ledgerRes.balance;

    const ledgerEntries = await db.studentLedgerEntry.findMany({
      where: { studentId, branchId: student.branchId },
      orderBy: [{ postedAt: 'asc' }, { id: 'asc' }]
    });

    const transactions = ledgerEntries.map((e) => {
      return {
        id: e.id,
        postedAt: e.postedAt,
        entryType: e.entryType,
        direction: e.direction,
        amount: Number(e.amount),
        referenceType: e.referenceType,
        description: e.description,
        balanceAfter: Number(e.balanceAfter)
      };
    });

    // Invoices list
    const invoices = await db.invoice.findMany({
      where: { studentId, branchId: student.branchId },
      include: {
        items: true,
        term: true
      },
      orderBy: { issueDate: 'desc' }
    });

    return {
      student: {
        id: student.id,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo
      },
      summary: {
        totalDebits: ledgerRes.totalDebits.toNumber(),
        totalCredits: ledgerRes.totalCredits.toNumber(),
        outstandingBalance: currentBalance.toNumber(),
        isDebtor: currentBalance.greaterThan(0)
      },
      transactions,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.issueDate,
        dueDate: inv.dueDate,
        termName: inv.term?.name || null,
        grossAmount: Number(inv.grossAmount),
        discountAmount: Number(inv.discountAmount),
        netAmount: Number(inv.netAmount),
        status: inv.status,
        items: inv.items.map((item) => ({
          voteHead: item.feeTypeName,
          amount: Number(item.lineTotal),
          narrative: item.description
        }))
      }))
    };
  }

  /**
   * Retrieves welfare, hostel room allocation, exeat pass status, and non-confidential clinic history.
   */
  static async getChildWelfareAndBoarding(guardianId: string, studentId: string) {
    const relation = await this.validateGuardianAccess(guardianId, studentId);
    const student = relation.student;

    // 1. Bed allocation
    const bedAllocation = await db.bedAllocation.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: {
        bed: {
          include: {
            room: {
              include: {
                hostel: true
              }
            }
          }
        }
      }
    });

    // 2. Exeat passes
    const exeatPasses = await db.exeatPass.findMany({
      where: { studentId, branchId: student.branchId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // 3. Clinic encounters (Sanitized triage log: dates and priority only to protect medical privacy)
    const clinicEncounters = await db.clinicEncounter.findMany({
      where: { studentId, branchId: student.branchId },
      select: {
        id: true,
        encounterNumber: true,
        createdAt: true,
        triagePriority: true,
        outcome: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // 4. Disciplinary records
    const sanctions = await db.disciplinarySanction.findMany({
      where: { studentId, branchId: student.branchId },
      include: {
        hearing: {
          include: {
            incident: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return {
      hostel: bedAllocation ? {
        hostelName: bedAllocation.bed.room.hostel.name,
        roomNumber: bedAllocation.bed.room.roomNumber,
        bedNumber: bedAllocation.bed.bedNumber,
        bedType: bedAllocation.bed.bedType,
        allocatedAt: bedAllocation.createdAt
      } : null,
      exeats: exeatPasses.map((e) => ({
        id: e.id,
        exeatNumber: e.exeatNumber,
        exeatType: e.exeatType,
        reason: e.reason,
        intendedDeparture: e.intendedDeparture,
        expectedReturn: e.expectedReturn,
        actualDeparture: e.actualDeparture,
        actualReturn: e.actualReturn,
        guardianConsent: e.guardianConsent,
        status: e.status,
        isOverdue: e.isOverdue
      })),
      clinicVisits: clinicEncounters.map((c) => ({
        id: c.id,
        visitNumber: c.encounterNumber,
        visitDate: c.createdAt,
        priority: c.triagePriority,
        outcome: c.outcome
      })),
      discipline: sanctions.map((s) => ({
        id: s.id,
        sanctionType: s.sanctionType,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        incidentTitle: s.hearing?.incident?.title || 'Disciplinary Incident',
        category: s.hearing?.incident?.category || null
      }))
    };
  }

  /**
   * Records guardian digital consent (e.g. for exeat pass, medical care, or field trip).
   */
  static async recordConsent(input: RecordConsentInput) {
    const relation = await this.validateGuardianAccess(input.guardianId, input.studentId);
    const student = relation.student;

    return db.$transaction(async (tx) => {
      // 1. Create audit-proof consent record
      const consent = await tx.parentConsentRecord.create({
        data: {
          branchId: student.branchId,
          guardianId: input.guardianId,
          studentId: input.studentId,
          consentType: input.consentType,
          referenceType: input.referenceType || null,
          referenceId: input.referenceId || null,
          granted: input.granted,
          digitalSignature: input.digitalSignature || null,
          recordedIp: input.ipAddress || null,
          userAgent: input.userAgent || null,
          notes: input.notes || null
        }
      });

      // 2. If consent is for an ExeatPass, update the Exeat record directly
      if (input.consentType === ParentConsentType.EXEAT_PASS) {
        const canAuthorizeExeat = relation.hasPickupAuthorization || relation.isPrimaryContact;
        if (!canAuthorizeExeat) {
          throw new UnauthorizedError("Guardian is not authorized to grant exeat approvals for this student.");
        }
      }

      if (input.consentType === ParentConsentType.EXEAT_PASS && input.referenceId) {
        const exeat = await tx.exeatPass.findFirst({
          where: {
            id: input.referenceId,
            studentId: input.studentId,
            branchId: student.branchId
          }
        });

        if (exeat) {
          await tx.exeatPass.update({
            where: { id: exeat.id },
            data: {
              guardianConsent: input.granted,
              guardianConsentMethod: "PARENT_PORTAL",
              guardianId: input.guardianId
            }
          });
        }
      }

      // 3. Log portal activity
      const guardianUser = await tx.user.findFirst({
        where: { guardianId: input.guardianId }
      });

      if (guardianUser) {
        await PortalActivityDAO.logActivity({
          branchId: student.branchId,
          userId: guardianUser.id,
          action: `consent.${input.consentType.toLowerCase()}`,
          details: {
            consentId: consent.id,
            granted: input.granted,
            studentId: input.studentId,
            referenceId: input.referenceId
          },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent
        });
      }

      return consent;
    });
  }

  /**
   * Retrieves pending items requiring guardian consent across all wards.
   */
  static async getPendingConsents(guardianId: string) {
    const wards = await db.studentGuardian.findMany({
      where: { guardianId },
      select: { studentId: true }
    });

    const studentIds = wards.map((w) => w.studentId);
    if (studentIds.length === 0) return [];

    const pendingExeats = await db.exeatPass.findMany({
      where: {
        studentId: { in: studentIds },
        status: ExeatStatus.PENDING,
        guardianConsent: false
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } }
      },
      orderBy: { intendedDeparture: 'asc' }
    });

    return pendingExeats.map((e) => ({
      consentType: ParentConsentType.EXEAT_PASS,
      referenceType: 'ExeatPass',
      referenceId: e.id,
      exeatNumber: e.exeatNumber,
      studentId: e.student.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`.trim(),
      admissionNo: e.student.admissionNo,
      reason: e.reason,
      intendedDeparture: e.intendedDeparture,
      expectedReturn: e.expectedReturn,
      status: e.status
    }));
  }
}
