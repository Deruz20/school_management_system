import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  UserType,
  StudentLifecycleStatus,
  LedgerEntryType,
  ParentConsentType,
  ExeatType,
  ExeatStatus,
  GuardianRelationship
} from "@prisma/client";
import { PortalAccessDAO, ReportCardAccessStatus } from "@/lib/dao/portal-access.dao";
import { ParentPortalDAO } from "@/lib/dao/parent-portal.dao";
import { StudentPortalDAO } from "@/lib/dao/student-portal.dao";
import { NotificationPreferenceDAO } from "@/lib/dao/notification-preference.dao";
import { PortalActivityDAO } from "@/lib/dao/portal-activity.dao";

describe("Phase 3.3: Self-Service Portals (Parent & Student) Engine (PORT-01..PORT-25)", () => {
  let ctx: TenantContext;
  let branchId: string;
  let studentId: string;
  let guardianId: string;
  let guardianUserId: string;
  let termId: string;
  let enrollmentId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `Portal_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Nova Portal Academy", organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: "Kampala Central Campus", schoolId: school.id }
    });
    branchId = branch.id;

    const staffUser = await db.user.create({
      data: {
        organizationId: org.id,
        email: `portal_admin_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: "hash",
        firstName: "Portal",
        lastName: "Admin",
        userType: UserType.STAFF
      }
    });

    ctx = {
      userId: staffUser.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId,
      role: "ADMIN",
      permissions: ["all"]
    };

    // Academic setup
    const ay = await db.academicYear.create({
      data: {
        branchId,
        name: "2026 Academic Year",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-12-05")
      }
    });

    const term = await db.term.create({
      data: {
        academicYearId: ay.id,
        name: "Term 1",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-04-15")
      }
    });
    termId = term.id;

    const cls = await db.class.create({
      data: {
        branchId,
        name: "Senior Four"
      }
    });

    // Create Student
    const student = await db.student.create({
      data: {
        branchId,
        admissionNo: `S4-${Date.now().toString().slice(-4)}`,
        firstName: "Ivan",
        lastName: "Kato",
        gender: "MALE",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE
      }
    });
    studentId = student.id;

    // Create Guardian
    const guardian = await db.guardian.create({
      data: {
        branchId,
        guardianCode: `GRD-${Date.now().toString().slice(-4)}`,
        firstName: "Paul",
        lastName: "Kato",
        phonePrimary: "+256700112233",
        email: `paul.kato_${Date.now()}@test.com`
      }
    });
    guardianId = guardian.id;

    // Link Guardian to Student
    await db.studentGuardian.create({
      data: {
        branchId,
        studentId: student.id,
        guardianId: guardian.id,
        relationship: GuardianRelationship.FATHER,
        isPrimaryContact: true,
        isFinancialSponsor: true,
        receivesAcademicReports: true
      }
    });

    // Create User accounts
    const gUser = await db.user.create({
      data: {
        organizationId: org.id,
        guardianId: guardian.id,
        email: guardian.email,
        passwordHash: "hash",
        firstName: "Paul",
        lastName: "Kato",
        userType: UserType.PARENT
      }
    });
    guardianUserId = gUser.id;

    await db.user.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        email: `ivan.kato_${Date.now()}@test.com`,
        passwordHash: "hash",
        firstName: "Ivan",
        lastName: "Kato",
        userType: UserType.STUDENT
      }
    });

    const enrollment = await db.enrollment.create({
      data: {
        studentId: student.id,
        classId: cls.id,
        academicYearId: ay.id,
        status: "ACTIVE"
      }
    });
    enrollmentId = enrollment.id;
  });

  // 1. PORTAL ACCESS POLICY
  describe("Portal Access Policy Configuration", () => {
    it("should initialize default policy if none exists", async () => {
      const policy = await PortalAccessDAO.getPolicy(branchId);
      expect(policy).toBeDefined();
      expect(policy.allowStudentAccess).toBe(true);
      expect(policy.allowParentAccess).toBe(true);
      expect(policy.enforceFeeBlockOnReports).toBe(true);
      expect(Number(policy.outstandingFeeThreshold)).toBe(0);
    });

    it("should upsert portal policy updates cleanly", async () => {
      const updated = await PortalAccessDAO.upsertPolicy(ctx, {
        allowStudentAccess: true,
        allowParentAccess: true,
        enforceFeeBlockOnReports: true,
        outstandingFeeThreshold: 50000,
        blockMessage: "Clear at least UGX 50,000 to unlock report cards."
      });

      expect(Number(updated.outstandingFeeThreshold)).toBe(50000);
      expect(updated.blockMessage).toBe("Clear at least UGX 50,000 to unlock report cards.");
    });
  });

  // 2. PARENT PORTAL - WARDS & STATEMENT
  describe("Parent Portal: Wards & Ledger Invariants", () => {
    it("should list all wards linked to guardian with accurate balances", async () => {
      // Add a fee invoice (Debit)
      await db.studentLedgerEntry.create({
        data: {
          branchId,
          studentId,
          entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
          direction: "DEBIT",
          amount: 850000,
          balanceAfter: 850000,
          referenceType: "INVOICE",
          description: "Term 1 Tuition Fee",
          createdById: ctx.userId
        }
      });

      const wards = await ParentPortalDAO.getGuardianChildren(guardianId);
      expect(wards).toHaveLength(1);
      expect(wards[0].studentId).toBe(studentId);
      expect(wards[0].outstandingBalance).toBe(850000);
      expect(wards[0].isDebtor).toBe(true);
    });

    it("should retrieve full chronological fee statement with invoices and payments", async () => {
      // Post invoice (DEBIT)
      await db.studentLedgerEntry.create({
        data: {
          branchId,
          studentId,
          entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
          direction: "DEBIT",
          amount: 1000000,
          balanceAfter: 1000000,
          referenceType: "INVOICE",
          description: "Tuition and Boarding Fees",
          createdById: ctx.userId
        }
      });

      // Post SchoolPay payment (CREDIT)
      await db.studentLedgerEntry.create({
        data: {
          branchId,
          studentId,
          entryType: LedgerEntryType.PAYMENT,
          direction: "CREDIT",
          amount: 400000,
          balanceAfter: 600000,
          referenceType: "PAYMENT",
          description: "SchoolPay PRN Payment",
          createdById: ctx.userId
        }
      });

      const statement = await ParentPortalDAO.getChildFeeStatement(guardianId, studentId);
      expect(statement.summary.totalDebits).toBe(1000000);
      expect(statement.summary.totalCredits).toBe(400000);
      expect(statement.summary.outstandingBalance).toBe(600000);
      expect(statement.summary.isDebtor).toBe(true);
      expect(statement.transactions).toHaveLength(2);
    });
  });

  // 3. DEBTOR REPORT CARD HOLD (Uganda School Invariant)
  describe("Debtor Report Card Access Control", () => {
    beforeEach(async () => {
      const subject = await db.subject.create({
        data: {
          branchId,
          code: `MATH_${Date.now()}`,
          name: "Mathematics"
        }
      });

      await db.termResult.create({
        data: {
          enrollmentId,
          termId,
          totalScore: 480,
          aggregatePoints: 12,
          division: "DIVISION 1",
          status: "FINALIZED",
          version: 1,
          subjects: {
            create: [
              {
                subjectId: subject.id,
                score: 85,
                grade: "D1",
                points: 1,
                remarks: "Distinction One"
              }
            ]
          }
        }
      });
    });

    it("should BLOCK report card when student has outstanding debt above threshold", async () => {
      // Incur debt of UGX 500,000
      await db.studentLedgerEntry.create({
        data: {
          branchId,
          studentId,
          entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
          direction: "DEBIT",
          amount: 500000,
          balanceAfter: 500000,
          referenceType: "INVOICE",
          description: "Term Tuition",
          createdById: ctx.userId
        }
      });

      // Threshold is 0
      await PortalAccessDAO.upsertPolicy(ctx, {
        enforceFeeBlockOnReports: true,
        outstandingFeeThreshold: 0
      });

      // Guardian checks report
      const guardianReport = await ParentPortalDAO.getChildAcademicReport(guardianId, studentId, termId);
      expect(guardianReport.accessStatus).toBe(ReportCardAccessStatus.DEBTOR_BLOCKED);
      expect(guardianReport.isBlocked).toBe(true);
      expect(guardianReport.results).toBeNull();
      expect(guardianReport.outstandingBalance).toBe(500000);

      // Student checks report
      const studentReport = await StudentPortalDAO.getAcademicReports(studentId, termId);
      expect(studentReport.accessStatus).toBe(ReportCardAccessStatus.DEBTOR_BLOCKED);
      expect(studentReport.isBlocked).toBe(true);
      expect(studentReport.results).toBeNull();
    });

    it("should UNLOCK report card once debt is cleared below threshold", async () => {
      // Incur debt of UGX 500,000
      await db.studentLedgerEntry.create({
        data: {
          branchId,
          studentId,
          entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
          direction: "DEBIT",
          amount: 500000,
          balanceAfter: 500000,
          referenceType: "INVOICE",
          description: "Term Tuition",
          createdById: ctx.userId
        }
      });

      // Settle full payment of UGX 500,000
      await db.studentLedgerEntry.create({
        data: {
          branchId,
          studentId,
          entryType: LedgerEntryType.PAYMENT,
          direction: "CREDIT",
          amount: 500000,
          balanceAfter: 0,
          referenceType: "PAYMENT",
          description: "Full Payment Clearance",
          createdById: ctx.userId
        }
      });

      const report = await ParentPortalDAO.getChildAcademicReport(guardianId, studentId, termId);
      expect(report.accessStatus).toBe(ReportCardAccessStatus.FEE_THRESHOLD_MET);
      expect(report.isBlocked).toBe(false);
      expect(report.results).toHaveLength(1);
      expect(report.results![0].division).toBe("DIVISION 1");
      expect(report.results![0].subjects).toHaveLength(1);
      expect(report.results![0].subjects[0].grade).toBe("D1");
    });
  });

  // 4. DIGITAL CONSENTS & EXEAT WORKFLOW
  describe("Digital Parental Consents & Exeat Approvals", () => {
    it("should record guardian digital consent and update exeat gate pass", async () => {
      // Student requests an exeat pass
      const exeat = await StudentPortalDAO.requestExeat(studentId, {
        exeatType: ExeatType.WEEKEND_EXEAT,
        reason: "Attending sister wedding ceremony",
        intendedDeparture: "2026-09-12T08:00:00Z",
        expectedReturn: "2026-09-14T17:00:00Z",
        accompanyingAdult: "Paul Kato"
      });

      expect(exeat.status).toBe(ExeatStatus.PENDING);
      expect(exeat.guardianConsent).toBe(false);
      expect(exeat.qrVerificationToken).toHaveLength(48);

      // Check pending consents on guardian portal
      const pending = await ParentPortalDAO.getPendingConsents(guardianId);
      expect(pending).toHaveLength(1);
      expect(pending[0].referenceId).toBe(exeat.id);

      // Guardian digitally signs consent
      const consentRecord = await ParentPortalDAO.recordConsent({
        guardianId,
        studentId,
        consentType: ParentConsentType.EXEAT_PASS,
        referenceType: "ExeatPass",
        referenceId: exeat.id,
        granted: true,
        digitalSignature: "Paul Kato (Signed Electronically)",
        notes: "Granted approval for family wedding"
      });

      expect(consentRecord.granted).toBe(true);
      expect(consentRecord.digitalSignature).toContain("Paul Kato");

      // Verify exeat pass is now flagged with guardian consent
      const updatedExeat = await db.exeatPass.findUnique({
        where: { id: exeat.id }
      });
      expect(updatedExeat?.guardianConsent).toBe(true);
    });
  });

  // 5. STUDENT DASHBOARD & NOTIFICATION PREFERENCES
  describe("Student Dashboard & Preference Configurations", () => {
    it("should load student self-service dashboard with enrolled subjects & attendance meter", async () => {
      const dashboard = await StudentPortalDAO.getStudentDashboard(studentId);
      expect(dashboard.profile.admissionNo).toContain("S4-");
      expect(dashboard.attendance.attendancePercentage).toBe(100);
      expect(dashboard.reportAccess).toBeDefined();
    });

    it("should configure and persist guardian and student notification channels", async () => {
      const gPrefs = await NotificationPreferenceDAO.upsertGuardianPreferences(branchId, guardianId, {
        smsEnabled: true,
        emailEnabled: true,
        whatsappEnabled: false,
        feeAlerts: true,
        academicAlerts: true,
        attendanceAlerts: true
      });
      expect(gPrefs.smsEnabled).toBe(true);
      expect(gPrefs.whatsappEnabled).toBe(false);

      const sPrefs = await NotificationPreferenceDAO.upsertStudentPreferences(branchId, studentId, {
        smsEnabled: false,
        emailEnabled: true,
        academicAlerts: true
      });
      expect(sPrefs.emailEnabled).toBe(true);
      expect(sPrefs.smsEnabled).toBe(false);
    });

    it("should log portal activity and retrieve user activity feed", async () => {
      await PortalActivityDAO.logActivity({
        branchId,
        userId: guardianUserId,
        action: "VIEW_FEE_STATEMENT",
        details: { studentId }
      });

      const activities = await PortalActivityDAO.getUserActivity(guardianUserId);
      expect(activities.length).toBeGreaterThanOrEqual(1);
      expect(activities[0].action).toBe("VIEW_FEE_STATEMENT");
    });
  });
});
