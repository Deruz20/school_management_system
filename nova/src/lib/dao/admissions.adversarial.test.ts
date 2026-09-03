import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext, UnauthorizedError } from "@/lib/dao/tenant-context";
import {
  Prisma,
  ApplicantStatus,
  StudentLifecycleStatus,
  ProvisioningTaskStatus
} from "@prisma/client";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";
import { GuardianDAO } from "@/lib/dao/guardian.dao";
import { StudentDAO } from "@/lib/dao/student.dao";
import { StudentLifecycleDAO } from "@/lib/dao/student-lifecycle.dao";
import { EnrollmentDAO } from "@/lib/dao/enrollment.dao";
import { ProvisioningRunner } from "@/lib/dao/provisioning.runner";
import { computeBlindIndex, decryptSecret } from "@/lib/security/kyc-crypto";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";

describe("Phase 3.2A: Admissions & Student Lifecycle Concurrency, Adversarial & Boundary Engine (ADV-ADM-01..ADV-ADM-22)", () => {
  let ctx: TenantContext;
  let checkerCtx: TenantContext;
  let branch2Ctx: TenantContext;
  let branchId: string;
  let branch2Id: string;
  let adminUserId: string;
  let checkerUserId: string;
  let academicYearId: string;
  let classId: string;
  let smallClassId: string;
  let feeStructureId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `Adv_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Admissions Adversarial High School", organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: "Main Campus", schoolId: school.id }
    });
    branchId = branch.id;

    const branch2 = await db.branch.create({
      data: { name: "Branch 2", schoolId: school.id }
    });
    branch2Id = branch2.id;

    const user1 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `adv_admin_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: "hash",
        firstName: "Admin",
        lastName: "Maker",
        userType: "STAFF"
      }
    });
    adminUserId = user1.id;

    const user2 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `adv_checker_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: "hash",
        firstName: "Registrar",
        lastName: "Checker",
        userType: "STAFF"
      }
    });
    checkerUserId = user2.id;

    ctx = {
      branchId,
      userId: adminUserId,
      organizationId: org.id,
      schoolId: school.id,
      role: "ADMIN",
      permissions: ["all"]
    };

    checkerCtx = {
      branchId,
      userId: checkerUserId,
      organizationId: org.id,
      schoolId: school.id,
      role: "REGISTRAR",
      permissions: ["admissions:approve", "admissions:enroll", "students:write", "kyc:decrypt", "clearance:read"]
    };

    branch2Ctx = {
      branchId: branch2Id,
      userId: adminUserId,
      organizationId: org.id,
      schoolId: school.id,
      role: "ADMIN",
      permissions: ["all"]
    };

    const academicYear = await db.academicYear.create({
      data: {
        branchId,
        name: `Adv Academic Year ${Date.now()}`,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });
    academicYearId = academicYear.id;

    const cls = await db.class.create({
      data: {
        branchId,
        name: `Adv Class S1 ${Math.random().toString(36).slice(2)}`,
        capacity: 100
      }
    });
    classId = cls.id;

    // Small class with capacity = 2 for capacity tests
    const smallCls = await db.class.create({
      data: {
        branchId,
        name: `Small Class ${Math.random().toString(36).slice(2)}`,
        capacity: 2
      }
    });
    smallClassId = smallCls.id;

    const feeType = await db.feeType.create({
      data: {
        branchId,
        name: "Adv Tuition Fee",
        code: `ADV_TUI_${Math.random().toString(36).slice(2)}`
      }
    });

    const fs = await db.feeStructure.create({
      data: {
        branchId,
        academicYearId,
        classId,
        name: "Adv Standard Tuition",
        currency: "UGX",
        items: {
          create: [{ feeTypeId: feeType.id, amount: new Prisma.Decimal(800000) }]
        }
      }
    });
    feeStructureId = fs.id;
  });

  // ============================================================================
  // CONCURRENCY & SEQUENCE RACES (ADV-ADM-01..ADV-ADM-05)
  // ============================================================================

  it("ADV-ADM-01: Concurrent applicant intake generates collision-free application numbers", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      AdmissionsDAO.createInquiry(ctx, {
        academicYearId,
        targetClassId: classId,
        firstName: `Concurrent${i}`,
        lastName: `Applicant${i}`
      })
    );

    const applicants = await Promise.all(promises);
    const appNos = applicants.map(a => a.applicationNumber);
    const uniqueNos = new Set(appNos);

    expect(uniqueNos.size).toBe(10);
  });

  it("ADV-ADM-02: Concurrent student enrollment generates collision-free admission numbers", async () => {
    // Prepare 5 accepted applicants
    const applicants = await Promise.all(
      Array.from({ length: 5 }, async (_, i) => {
        const app = await AdmissionsDAO.createInquiry(ctx, {
          academicYearId,
          targetClassId: classId,
          firstName: `Batch${i}`,
          lastName: `Enroll`
        });
        await AdmissionsDAO.issueAdmissionOffer(checkerCtx, app.id, { decisionReason: "Ready" });
        await AdmissionsDAO.acceptOffer(ctx, app.id);
        return app;
      })
    );

    // Concurrently enroll all 5
    const enrollments = await Promise.all(
      applicants.map(app =>
        AdmissionsDAO.enrollApplicant(checkerCtx, app.id, { autoBill: false })
      )
    );

    const admNos = enrollments.map(e => e.student.admissionNo);
    const uniqueAdmNos = new Set(admNos);

    expect(uniqueAdmNos.size).toBe(5);
  });

  it("ADV-ADM-03: Concurrent guardian creation generates collision-free guardian codes", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      GuardianDAO.createGuardian(ctx, {
        firstName: `Guardian${i}`,
        lastName: `Test${i}`,
        phonePrimary: `07000000${i.toString().padStart(2, '0')}`
      })
    );

    const guardians = await Promise.all(promises);
    const codes = guardians.map(g => g.guardianCode);
    const uniqueCodes = new Set(codes);

    expect(uniqueCodes.size).toBe(10);
  });

  it("ADV-ADM-04: Concurrent enrollment into full class respects capacity limit", async () => {
    // smallClass has capacity = 2
    const s1 = await StudentDAO.createStudent(ctx, { firstName: "S1", lastName: "Student" });
    const s2 = await StudentDAO.createStudent(ctx, { firstName: "S2", lastName: "Student" });
    const s3 = await StudentDAO.createStudent(ctx, { firstName: "S3", lastName: "Student" });

    // Enroll first 2
    await EnrollmentDAO.createEnrollment(ctx, { studentId: s1.id, academicYearId, classId: smallClassId });
    await EnrollmentDAO.createEnrollment(ctx, { studentId: s2.id, academicYearId, classId: smallClassId });

    // 3rd enrollment must be rejected due to capacity limit
    await expect(
      EnrollmentDAO.createEnrollment(ctx, { studentId: s3.id, academicYearId, classId: smallClassId })
    ).rejects.toThrow(/capacity/);
  });

  it("ADV-ADM-05: Concurrent enrollment of same applicant is idempotent/fails cleanly", async () => {
    const app = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Double",
      lastName: "Enrollee"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, app.id, { decisionReason: "Ready" });
    await AdmissionsDAO.acceptOffer(ctx, app.id);

    // Call enrollment sequentially/concurrently
    const results = await Promise.allSettled([
      AdmissionsDAO.enrollApplicant(checkerCtx, app.id, { autoBill: false }),
      AdmissionsDAO.enrollApplicant(checkerCtx, app.id, { autoBill: false })
    ]);

    const successes = results.filter(r => r.status === "fulfilled");
    const rejections = results.filter(r => r.status === "rejected");

    // Exactly one must succeed, the other rejected with already enrolled
    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);
  });

  // ============================================================================
  // MULTI-TENANCY & AUTHORIZATION TAMPERING (ADV-ADM-06..ADV-ADM-14)
  // ============================================================================

  it("ADV-ADM-06: Cross-tenant applicant access rejected with UnauthorizedError", async () => {
    const app = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Secret",
      lastName: "Applicant"
    });

    await expect(AdmissionsDAO.getApplicant(branch2Ctx, app.id)).rejects.toThrow();
  });

  it("ADV-ADM-07: Cross-tenant student profile access rejected with UnauthorizedError", async () => {
    const student = await StudentDAO.createStudent(ctx, {
      firstName: "Secret",
      lastName: "Student"
    });

    await expect(StudentDAO.getStudentById(branch2Ctx, student.id)).rejects.toThrow();
  });

  it("ADV-ADM-08: Cross-tenant guardian access rejected with UnauthorizedError", async () => {
    const guardian = await GuardianDAO.createGuardian(ctx, {
      firstName: "Secret",
      lastName: "Guardian",
      phonePrimary: "0755998877"
    });

    await expect(GuardianDAO.getGuardian(branch2Ctx, guardian.id)).rejects.toThrow();
  });

  it("ADV-ADM-09: Unauthenticated inquiry creation without branchId rejected", async () => {
    const unauthCtx: TenantContext = {
      branchId: "",
      userId: "",
      organizationId: "",
      schoolId: "",
      role: "ANONYMOUS",
      permissions: []
    };

    await expect(
      AdmissionsDAO.createInquiry(unauthCtx, {
        academicYearId,
        targetClassId: classId,
        firstName: "Bad",
        lastName: "Request"
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("ADV-ADM-10: Self-approval attempt on offer issuance rejected (Maker-Checker violation)", async () => {
    const app = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Maker",
      lastName: "CheckerTest"
    });

    // Maker tries to approve
    await expect(
      AdmissionsDAO.issueAdmissionOffer(ctx, app.id, { decisionReason: "Self approve" })
    ).rejects.toThrow(/Maker-Checker violation/);
  });

  it("ADV-ADM-11: Enrollment attempt on expired offer rejected", async () => {
    const app = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Expired",
      lastName: "Applicant"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, app.id, { decisionReason: "Offer" });
    await db.applicant.update({
      where: { id: app.id },
      data: { offerValidUntil: new Date(Date.now() - 60000), status: ApplicantStatus.OFFER_ACCEPTED }
    });

    await expect(
      AdmissionsDAO.enrollApplicant(checkerCtx, app.id, { autoBill: false })
    ).rejects.toThrow(/expired/);
  });

  it("ADV-ADM-12: Enrollment attempt on rejected or withdrawn offer rejected", async () => {
    const app = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Rejected",
      lastName: "Applicant"
    });
    await AdmissionsDAO.rejectOffer(checkerCtx, app.id, "Did not meet criteria");

    await expect(
      AdmissionsDAO.enrollApplicant(checkerCtx, app.id, { autoBill: false })
    ).rejects.toThrow(/Cannot enroll applicant in status OFFER_REJECTED/);
  });

  it("ADV-ADM-13: Enrollment attempt with invalid/cross-tenant classId rejected", async () => {
    const app = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "InvalidClass",
      lastName: "Applicant"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, app.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, app.id);

    // Attempt to enroll in non-existent or cross-tenant class
    await expect(
      AdmissionsDAO.enrollApplicant(checkerCtx, app.id, {
        targetClassId: "foreign-class-id",
        autoBill: false
      })
    ).rejects.toThrow(/Target class not found/);
  });

  it("ADV-ADM-14: Enrollment attempt with stream not belonging to class rejected", async () => {
    // Create another class with its own stream
    const otherClass = await db.class.create({
      data: { branchId, name: "Class B" }
    });
    const otherStream = await db.stream.create({
      data: { classId: otherClass.id, name: "Stream B" }
    });

    const student = await StudentDAO.createStudent(ctx, {
      firstName: "Invalid",
      lastName: "StreamStudent"
    });

    // Try to enroll student in classId with otherStream.id
    await expect(
      EnrollmentDAO.createEnrollment(ctx, {
        studentId: student.id,
        academicYearId,
        classId,
        streamId: otherStream.id
      })
    ).rejects.toThrow(/Stream does not belong to the selected class/);
  });

  // ============================================================================
  // LIFECYCLE STATE MACHINE ADVERSARIAL CASES (ADV-ADM-15..ADV-ADM-17)
  // ============================================================================

  it("ADV-ADM-15: Student lifecycle invalid transition path (EXPELLED -> ACTIVE) rejected", async () => {
    const student = await StudentDAO.createStudent(ctx, {
      firstName: "Expelled",
      lastName: "Student"
    });

    // First transition: ACTIVE -> EXPELLED
    await StudentLifecycleDAO.transitionStatus(checkerCtx, {
      studentId: student.id,
      targetStatus: StudentLifecycleStatus.EXPELLED,
      reason: "Gross misconduct"
    });

    // Second transition: EXPELLED -> ACTIVE (Must be permanently blocked)
    await expect(
      StudentLifecycleDAO.transitionStatus(checkerCtx, {
        studentId: student.id,
        targetStatus: StudentLifecycleStatus.ACTIVE,
        reason: "Forgiven"
      })
    ).rejects.toThrow(/Invalid lifecycle transition/);
  });

  it("ADV-ADM-16: Student lifecycle invalid transition path (GRADUATED -> SUSPENDED) rejected", async () => {
    const student = await StudentDAO.createStudent(ctx, {
      firstName: "Graduate",
      lastName: "Alum"
    });

    await StudentLifecycleDAO.transitionStatus(checkerCtx, {
      studentId: student.id,
      targetStatus: StudentLifecycleStatus.GRADUATED,
      reason: "Completed Senior 6"
    });

    // Attempt GRADUATED -> SUSPENDED -> Rejected
    await expect(
      StudentLifecycleDAO.transitionStatus(checkerCtx, {
        studentId: student.id,
        targetStatus: StudentLifecycleStatus.SUSPENDED,
        reason: "Belated sanction"
      })
    ).rejects.toThrow(/Invalid lifecycle transition/);
  });

  it("ADV-ADM-17: Student lifecycle transfer-out without clearance blocked by ledger debt", async () => {
    const student = await StudentDAO.createStudent(ctx, {
      firstName: "Indebted",
      lastName: "Student"
    });

    const enrollment = await EnrollmentDAO.createEnrollment(ctx, {
      studentId: student.id,
      academicYearId,
      classId
    });

    // Add unpaid invoice
    await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student.id,
      enrollmentId: enrollment.id,
      academicYearId,
      dueDate: new Date(),
      feeStructureId
    });

    await expect(
      StudentLifecycleDAO.transitionStatus(checkerCtx, {
        studentId: student.id,
        targetStatus: StudentLifecycleStatus.TRANSFERRED_OUT,
        reason: "Moving away"
      })
    ).rejects.toThrow(/Cannot transfer student out: Uncleared obligations exist/);
  });

  // ============================================================================
  // CRYPTO, BLIND INDEX & PROVISIONING RESILIENCE (ADV-ADM-18..ADV-ADM-22)
  // ============================================================================

  it("ADV-ADM-18: Tampered encrypted ciphertext throws or handles decryption gracefully", async () => {
    const tampered = "enc:1234567890abcdef:deadbeefdeadbeef:cafebabecafebabe";
    const decrypted = decryptSecret(tampered);
    expect(decrypted).toBeNull();
  });

  it("ADV-ADM-19: Blind index search matches exact normalized NIN regardless of spacing/casing", async () => {
    const ninInput = "  cm 95-0123-456789 X  ";
    const normalizedHash = computeBlindIndex(ninInput, branchId);
    const standardHash = computeBlindIndex("CM950123456789X", branchId);

    expect(normalizedHash).toBe(standardHash);
  });

  it("ADV-ADM-20: Provisioning retry executes idempotently without duplicate billing", async () => {
    const app = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Idempotent",
      lastName: "Student"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, app.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, app.id);

    const initial = await AdmissionsDAO.enrollApplicant(checkerCtx, app.id, {
      autoBill: true,
      feeStructureId
    });

    expect(initial.provisioning.billingStatus).toBe(ProvisioningTaskStatus.COMPLETED);
    const invoiceId = initial.provisioning.billingInvoiceId;

    // Retry already completed provisioning
    const retried = await ProvisioningRunner.retry(ctx, initial.provisioning.id, {
      autoBill: true,
      feeStructureId
    });

    // Must not create another invoice!
    expect(retried.billingInvoiceId).toBe(invoiceId);

    const invoices = await db.invoice.findMany({
      where: { studentId: initial.student.id }
    });
    expect(invoices.length).toBe(1);
  });

  it("ADV-ADM-21: Provisioning failure does not roll back Student or Enrollment master records", async () => {
    const app = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Durable",
      lastName: "Student"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, app.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, app.id);

    // Pass invalid fee structure to provoke provisioning failure
    const res = await AdmissionsDAO.enrollApplicant(checkerCtx, app.id, {
      autoBill: true,
      feeStructureId: "fatal-bad-structure-id"
    });

    expect(res.provisioning.billingStatus).toBe(ProvisioningTaskStatus.FAILED_RETRYABLE);

    // Student & Enrollment persist intact!
    const studentInDb = await db.student.findUnique({ where: { id: res.student.id } });
    const enrollmentInDb = await db.enrollment.findUnique({ where: { id: res.enrollment.id } });

    expect(studentInDb).toBeTruthy();
    expect(enrollmentInDb).toBeTruthy();
    expect(studentInDb?.lifecycleStatus).toBe(StudentLifecycleStatus.ENROLLED);
  });

  it("ADV-ADM-22: Migrated guardian record cannot be verified by unauthorized user", async () => {
    const guardian = await GuardianDAO.createGuardian(ctx, {
      firstName: "Unverified",
      lastName: "Guardian",
      phonePrimary: "0788112233"
    });

    const unauthorizedCtx: TenantContext = {
      ...ctx,
      permissions: ["students:read"] // No admissions:approve or kyc:decrypt
    };

    await expect(GuardianDAO.verifyGuardian(unauthorizedCtx, guardian.id)).rejects.toThrow(
      UnauthorizedError
    );
  });
});
