import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  UserType,
  StudentLifecycleStatus,
  LedgerEntryType,
  ParentConsentType,
  ExeatType,
  GuardianRelationship
} from "@prisma/client";
import { PortalAccessDAO, ReportCardAccessStatus } from "@/lib/dao/portal-access.dao";
import { ParentPortalDAO } from "@/lib/dao/parent-portal.dao";
import { StudentPortalDAO } from "@/lib/dao/student-portal.dao";

describe("Phase 3.3: Self-Service Portals Adversarial & Security Invariant Tests", () => {
  let ctx: TenantContext;
  let branchId: string;
  let studentAId: string;
  let guardianBId: string;
  let termId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `Portal_AdvOrg_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Adversarial Test School", organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: "Secure Branch", schoolId: school.id }
    });
    branchId = branch.id;

    const admin = await db.user.create({
      data: {
        organizationId: org.id,
        email: `adv_admin_${Date.now()}@test.com`,
        passwordHash: "hash",
        firstName: "Admin",
        lastName: "Sec",
        userType: UserType.STAFF
      }
    });

    ctx = {
      userId: admin.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId,
      role: "ADMIN",
      permissions: ["all"]
    };

    const ay = await db.academicYear.create({
      data: {
        branchId,
        name: "2026 AY",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      }
    });

    const term = await db.term.create({
      data: {
        academicYearId: ay.id,
        name: "Term 1",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-04-10")
      }
    });
    termId = term.id;

    // Student A and Guardian A
    const studentA = await db.student.create({
      data: {
        branchId,
        admissionNo: `ST-A-${Date.now().toString().slice(-4)}`,
        firstName: "Alice",
        lastName: "Nantongo",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE
      }
    });
    studentAId = studentA.id;

    const guardianA = await db.guardian.create({
      data: {
        branchId,
        guardianCode: `GRD-A-${Date.now().toString().slice(-4)}`,
        firstName: "Moses",
        lastName: "Nantongo",
        phonePrimary: "+256701000001",
        email: `moses_${Date.now()}@test.com`
      }
    });

    await db.studentGuardian.create({
      data: {
        branchId,
        studentId: studentA.id,
        guardianId: guardianA.id,
        relationship: GuardianRelationship.LEGAL_GUARDIAN,
        isPrimaryContact: true,
        receivesAcademicReports: true
      }
    });

    // Student B and Guardian B (Isolated Family)
    const studentB = await db.student.create({
      data: {
        branchId,
        admissionNo: `ST-B-${Date.now().toString().slice(-4)}`,
        firstName: "Bob",
        lastName: "Mugisha",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE
      }
    });

    const guardianB = await db.guardian.create({
      data: {
        branchId,
        guardianCode: `GRD-B-${Date.now().toString().slice(-4)}`,
        firstName: "Grace",
        lastName: "Mugisha",
        phonePrimary: "+256702000002",
        email: `grace_${Date.now()}@test.com`
      }
    });
    guardianBId = guardianB.id;

    await db.studentGuardian.create({
      data: {
        branchId,
        studentId: studentB.id,
        guardianId: guardianB.id,
        relationship: GuardianRelationship.LEGAL_GUARDIAN,
        isPrimaryContact: true,
        receivesAcademicReports: true
      }
    });
    const cls = await db.class.create({
      data: {
        branchId,
        name: "Senior Three"
      }
    });

    await db.enrollment.create({
      data: {
        studentId: studentA.id,
        classId: cls.id,
        academicYearId: ay.id,
        status: "ACTIVE"
      }
    });

    await db.enrollment.create({
      data: {
        studentId: studentB.id,
        classId: cls.id,
        academicYearId: ay.id,
        status: "ACTIVE"
      }
    });
  });

  // ATTACK 1: Cross-Guardian Unauthorized Ward Access Attempt
  it("ATTACK 1: Guardian B must be strictly forbidden from accessing Student A fee ledger", async () => {
    await expect(
      ParentPortalDAO.getChildFeeStatement(guardianBId, studentAId)
    ).rejects.toThrow("Guardian is not authorized to access records for this student.");
  });

  // ATTACK 2: Cross-Guardian Unauthorized Academic Report Access Attempt
  it("ATTACK 2: Guardian B must be strictly forbidden from accessing Student A academic report", async () => {
    await expect(
      ParentPortalDAO.getChildAcademicReport(guardianBId, studentAId, termId)
    ).rejects.toThrow("Guardian is not authorized to access records for this student.");
  });

  // ATTACK 3: Debtor Report Card Block Bypass Attempt
  it("ATTACK 3: Student with unpaid debt cannot view grades even if term results are published", async () => {
    // Incur large tuition debt
    await db.studentLedgerEntry.create({
      data: {
        branchId,
        studentId: studentAId,
        entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
        direction: "DEBIT",
        amount: 1500000,
        balanceAfter: 1500000,
        referenceType: "INVOICE",
        description: "School Fees Invoice",
        createdById: ctx.userId
      }
    });

    // Enforce 0 tolerance policy
    await PortalAccessDAO.upsertPolicy(ctx, {
      enforceFeeBlockOnReports: true,
      outstandingFeeThreshold: 0
    });

    const report = await StudentPortalDAO.getAcademicReports(studentAId, termId);
    expect(report.accessStatus).toBe(ReportCardAccessStatus.DEBTOR_BLOCKED);
    expect(report.isBlocked).toBe(true);
    expect(report.results).toBeNull();
    expect(report.message).toContain("fee balance");
  });

  // ATTACK 4: Unauthorized Exeat Digital Consent Tampering
  it("ATTACK 4: Guardian B cannot digitally sign an exeat pass for Student A", async () => {
    const exeat = await StudentPortalDAO.requestExeat(studentAId, {
      exeatType: ExeatType.OFFICIAL_SCHOOL_EVENT,
      reason: "Dental appointment",
      intendedDeparture: "2026-09-15T09:00:00Z",
      expectedReturn: "2026-09-15T16:00:00Z"
    });

    await expect(
      ParentPortalDAO.recordConsent({
        guardianId: guardianBId, // Intruder Guardian
        studentId: studentAId,
        consentType: ParentConsentType.EXEAT_PASS,
        referenceType: "ExeatPass",
        referenceId: exeat.id,
        granted: true,
        digitalSignature: "Forged Signature"
      })
    ).rejects.toThrow("Guardian is not authorized to access records for this student.");
  });

  // ATTACK 5: Suspended / Expelled Student Cannot Request Exeat Passes
  it("ATTACK 5: Suspended or expelled student cannot request exeat passes", async () => {
    // Suspend student A
    await db.student.update({
      where: { id: studentAId },
      data: { lifecycleStatus: StudentLifecycleStatus.SUSPENDED }
    });

    await expect(
      StudentPortalDAO.requestExeat(studentAId, {
        exeatType: ExeatType.WEEKEND_EXEAT,
        reason: "Going home",
        intendedDeparture: "2026-09-12T08:00:00Z",
        expectedReturn: "2026-09-14T17:00:00Z"
      })
    ).rejects.toThrow("Portal access denied: Student lifecycle status is SUSPENDED.");
  });
});
