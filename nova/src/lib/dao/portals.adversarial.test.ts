import { LedgerDAO } from "./ledger.dao";
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
  let guardianAId: string;
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
        admissionNo: `ST-A-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        firstName: "Alice",
        lastName: "Nantongo",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE
      }
    });
    studentAId = studentA.id;

    const guardianA = await db.guardian.create({
      data: {
        branchId,
        guardianCode: `GRD-A-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        firstName: "Moses",
        lastName: "Nantongo",
        phonePrimary: "+256701000001",
        email: `moses_${Date.now()}@test.com`
      }
    });
    guardianAId = guardianA.id;

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
        admissionNo: `ST-B-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        firstName: "Bob",
        lastName: "Mugisha",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE
      }
    });

    const guardianB = await db.guardian.create({
      data: {
        branchId,
        guardianCode: `GRD-B-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
        name: "Senior Three", portalAccessEnabled: true
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

  // ATTACK 6: Unauthorized Financial Guardian Blocked
  it("ATTACK 6: Guardian without financial sponsorship or primary contact blocked from financial ledger", async () => {
    // Create an auxiliary guardian linked to Student A with no financial sponsorship
    const nonFinancialGuardian = await db.guardian.create({
      data: {
        branchId,
        guardianCode: `GRD-NONFIN-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 6)}`,
        firstName: "Uncle",
        lastName: "Ben",
        phonePrimary: "+256701555444",
        email: `ben_${Date.now()}@test.com`
      }
    });

    await db.studentGuardian.create({
      data: {
        branchId,
        studentId: studentAId,
        guardianId: nonFinancialGuardian.id,
        relationship: GuardianRelationship.OTHER,
        isPrimaryContact: false,
        isFinancialSponsor: false,
        receivesAcademicReports: true
      }
    });

    // Statement request must throw UnauthorizedError
    await expect(
      ParentPortalDAO.getChildFeeStatement(nonFinancialGuardian.id, studentAId)
    ).rejects.toThrow("Guardian is not authorized to view financial information for this student.");

    // Children list must redact balance
    const children = await ParentPortalDAO.getGuardianChildren(nonFinancialGuardian.id, branchId);
    const ward = children.find((c) => c.studentId === studentAId);
    expect(ward?.outstandingBalance).toBeNull();
    expect(ward?.isFinancialAuthorized).toBe(false);
  });

  // ATTACK 7: Inactive Student Status Blocked
  it("ATTACK 7: Inactive student is strictly blocked from student portal", async () => {
    await db.student.update({
      where: { id: studentAId },
      data: { status: "DROPPED_OUT" }
    });

    await expect(StudentPortalDAO.getStudentDashboard(studentAId)).rejects.toThrow(
      "Portal access denied: Student status is DROPPED_OUT."
    );
  });

  // ATTACK 8: Inactive Enrollment Blocked
  it("ATTACK 8: Student without active enrollment is blocked from student portal", async () => {
    // Restore active student status, but mark enrollment COMPLETED
    await db.student.update({
      where: { id: studentAId },
      data: { status: "ACTIVE" }
    });

    await db.enrollment.updateMany({
      where: { studentId: studentAId },
      data: { status: "COMPLETED" }
    });

    await expect(StudentPortalDAO.getStudentDashboard(studentAId)).rejects.toThrow(
      "Portal access denied: Student does not have an active academic enrollment."
    );
  });

  // ATTACK 9: Class portalAccessEnabled=false Blocked
  it("ATTACK 9: Student whose class has portalAccessEnabled=false is blocked", async () => {
    // Restore active enrollment
    await db.enrollment.updateMany({
      where: { studentId: studentAId },
      data: { status: "ACTIVE" }
    });

    // Disable portal access on class
    const student = await db.student.findUnique({
      where: { id: studentAId },
      include: { enrollments: true }
    });
    const classId = student!.enrollments[0].classId;

    await db.class.update({
      where: { id: classId },
      data: { portalAccessEnabled: false }
    });

    await expect(StudentPortalDAO.getStudentDashboard(studentAId)).rejects.toThrow(
      "Portal access denied: Portal access is not enabled for student's class."
    );
  });

  // VERIFICATION: Portal Balance Delegated to LedgerDAO.getBalance()
  it("VERIFICATION: Portal balance calculations match LedgerDAO.getBalance() exactly", async () => {
    // Post test debit and credit entries
    await db.studentLedgerEntry.create({
      data: {
        branchId,
        studentId: studentAId,
        direction: "DEBIT",
        entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
        amount: 850000,
        balanceAfter: 850000,
        referenceType: "INVOICE",
        referenceId: `inv-test-${Date.now()}`,
        description: "Term Tuition Fees"
      }
    });

    await db.studentLedgerEntry.create({
      data: {
        branchId,
        studentId: studentAId,
        direction: "CREDIT",
        entryType: "PAYMENT",
        amount: 350000,
        balanceAfter: 500000,
        referenceType: "PAYMENT",
        referenceId: `pay-test-${Date.now()}`,
        description: "Bank Slip Payment"
      }
    });

    const ledgerRes = await LedgerDAO.getBalance(ctx, studentAId);
    expect(ledgerRes.balance.toNumber()).toBe(500000);

    // Verify PortalAccessDAO delegation
    const portalAccess = await PortalAccessDAO.checkReportCardAccess(branchId, studentAId);
    expect(portalAccess.balance.toNumber()).toBe(ledgerRes.balance.toNumber());

    // Verify ParentPortalDAO delegation
    const feeStatement = await ParentPortalDAO.getChildFeeStatement(guardianAId, studentAId);
    expect(feeStatement.summary.outstandingBalance).toBe(ledgerRes.balance.toNumber());
    expect(feeStatement.summary.totalDebits).toBe(ledgerRes.totalDebits.toNumber());
    expect(feeStatement.summary.totalCredits).toBe(ledgerRes.totalCredits.toNumber());
  });
});
