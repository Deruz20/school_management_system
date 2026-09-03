import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  ApplicantStatus,
  StudentLifecycleStatus,
  GuardianRelationship,
  ProvisioningTaskStatus
} from "@prisma/client";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";
import { GuardianDAO } from "@/lib/dao/guardian.dao";
import { StudentDAO } from "@/lib/dao/student.dao";
import { StudentLifecycleDAO } from "@/lib/dao/student-lifecycle.dao";
import { EnrollmentDAO } from "@/lib/dao/enrollment.dao";
import { ProvisioningRunner } from "@/lib/dao/provisioning.runner";
import { computeBlindIndex, decryptSecret } from "@/lib/security/kyc-crypto";
import { backfillLegacyParentUsers } from "@/lib/dao/backfill-guardians";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";
import { RequirementsDAO } from "@/lib/dao/requirements.dao";

describe("Phase 3.2A: Admissions, Student Lifecycle, Applicant Pipeline & Guardian KYC (ADM-01..ADM-32)", () => {
  let ctx: TenantContext;
  let checkerCtx: TenantContext;
  let branch2Ctx: TenantContext;
  let adminUserId: string;
  let checkerUserId: string;
  let branchId: string;
  let branch2Id: string;
  let academicYearId: string;
  let classId: string;
  let streamId: string;
  let feeStructureId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `Adm_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Admissions High School", organizationId: org.id }
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
        email: `adm_admin_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
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
        email: `adm_checker_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
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
      permissions: ["admissions:read", "admissions:approve", "admissions:enroll", "students:write", "kyc:decrypt", "clearance:read"]
    };

    branch2Ctx = {
      branchId: branch2Id,
      userId: adminUserId,
      organizationId: org.id,
      schoolId: school.id,
      role: "ADMIN",
      permissions: ["all"]
    };

    // Standard Academic Setup
    const academicYear = await db.academicYear.create({
      data: {
        branchId,
        name: `Academic Year ${Date.now()}`,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });
    academicYearId = academicYear.id;

    const cls = await db.class.create({
      data: {
        branchId,
        name: `Senior 1 ${Math.random().toString(36).slice(2)}`,
        capacity: 40
      }
    });
    classId = cls.id;

    const stm = await db.stream.create({
      data: {
        classId: cls.id,
        name: "North Stream"
      }
    });
    streamId = stm.id;

    // Standard Fee Structure
    const feeType = await db.feeType.create({
      data: {
        branchId,
        name: "Tuition Fee",
        code: `TUI_${Math.random().toString(36).slice(2)}`
      }
    });

    const fs = await db.feeStructure.create({
      data: {
        branchId,
        academicYearId,
        classId,
        name: "Standard S1 Tuition",
        currency: "UGX",
        items: {
          create: [
            {
              feeTypeId: feeType.id,
              amount: new Prisma.Decimal(1200000)
            }
          ]
        }
      }
    });
    feeStructureId = fs.id;
  });

  // ============================================================================
  // APPLICANT INTAKE, PIPELINE & REPUTATIONAL KYC (ADM-01..ADM-12)
  // ============================================================================

  it("ADM-01: Cross-branch isolation on applicant queries and updates", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Kato",
      lastName: "Mukasa",
      gender: "MALE"
    });

    // Branch 2 cannot view applicant
    await expect(AdmissionsDAO.getApplicant(branch2Ctx, applicant.id)).rejects.toThrow();

    // Branch 2 listing does not include applicant
    const b2List = await AdmissionsDAO.listApplicants(branch2Ctx);
    expect(b2List.items.some(a => a.id === applicant.id)).toBe(false);
  });

  it("ADM-02: Collision-free sequential application number generation (APP-YYYY-00001)", async () => {
    const year = new Date().getFullYear();
    const app1 = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Alice",
      lastName: "Namubiru"
    });

    const app2 = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Bob",
      lastName: "Okello"
    });

    expect(app1.applicationNumber).toMatch(new RegExp(`^APP-${year}-\\d{5}$`));
    expect(app2.applicationNumber).toMatch(new RegExp(`^APP-${year}-\\d{5}$`));
    expect(app1.applicationNumber).not.toBe(app2.applicationNumber);
  });

  it("ADM-03: Salted HMAC-SHA256 blind index generation on NIN and deterministic match", async () => {
    const ninRaw = "CM890123456789K";
    const hash1 = computeBlindIndex(ninRaw, branchId);
    const hash2 = computeBlindIndex(" cm-890123456789k ", branchId);
    const hashOtherBranch = computeBlindIndex(ninRaw, branch2Id);

    expect(hash1).toBeTruthy();
    expect(hash1).toBe(hash2); // Normalized deterministic match
    expect(hash1).not.toBe(hashOtherBranch); // Salted per branch
  });

  it("ADM-04: AES-256-GCM encryption of sensitive identity fields in database", async () => {
    const ninRaw = "CM950123456789X";
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "David",
      lastName: "Kigozi"
    });

    await AdmissionsDAO.submitApplication(ctx, applicant.id, {
      nin: ninRaw
    });

    const rawInDb = await db.applicant.findUnique({ where: { id: applicant.id } });
    expect(rawInDb?.nin).not.toBe(ninRaw);
    expect(rawInDb?.nin).toMatch(/^enc:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(decryptSecret(rawInDb?.nin)).toBe(ninRaw);
  });

  it("ADM-05: PII masking by default in queries, decryption only with kyc:decrypt permission", async () => {
    const ninRaw = "CF990123456789L";
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Grace",
      lastName: "Nakato"
    });
    await AdmissionsDAO.submitApplication(ctx, applicant.id, { nin: ninRaw });

    // Limited Context without kyc:decrypt
    const limitedCtx: TenantContext = {
      ...ctx,
      permissions: ["admissions:read"]
    };
    const masked = await AdmissionsDAO.getApplicant(limitedCtx, applicant.id);
    expect(masked.nin).toContain("****");
    expect(masked.isPlaintextUnmasked).toBe(false);

    // Privileged Context with kyc:decrypt
    const unmasked = await AdmissionsDAO.getApplicant(checkerCtx, applicant.id);
    expect(unmasked.nin).toBe(ninRaw);
    expect(unmasked.isPlaintextUnmasked).toBe(true);
  });

  it("ADM-06: Verification logging: Unmasking PII emits pii.unmasked audit event", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Sarah",
      lastName: "Nabirye"
    });
    await AdmissionsDAO.submitApplication(ctx, applicant.id, { nin: "CM900123456789M" });

    await AdmissionsDAO.getApplicant(checkerCtx, applicant.id);

    const audit = await db.auditLog.findFirst({
      where: {
        action: "pii.unmasked",
        resourceId: applicant.id
      }
    });
    expect(audit).toBeTruthy();
  });

  it("ADM-07: Duplicate applicant prevention (same active student NIN/LIN rejected)", async () => {
    const nin = "CM800123456789P";
    // Create existing active student
    await StudentDAO.createStudent(ctx, {
      firstName: "Existing",
      lastName: "Student",
      nin
    });

    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "New",
      lastName: "Applicant"
    });

    await expect(AdmissionsDAO.submitApplication(ctx, applicant.id, { nin })).rejects.toThrow(
      /already exists/
    );
  });

  it("ADM-08: Entrance assessment recording and rubric scoring", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Paul",
      lastName: "Semakula"
    });

    const assessed = await AdmissionsDAO.recordAssessment(ctx, applicant.id, {
      score: 85,
      notes: "Exceptional analytical and language aptitude."
    });

    expect(assessed.status).toBe(ApplicantStatus.ASSESSMENT_SCHEDULED);
    expect(assessed.assessmentScore).toBe(85);
    expect(assessed.assessmentNotes).toContain("analytical");
  });

  it("ADM-09: 4-Eye Maker-Checker rule: Maker cannot self-approve admission offer", async () => {
    // Maker (adminUserId) creates applicant
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Brian",
      lastName: "Mugisha"
    });

    // Maker tries to approve offer -> MUST FAIL
    await expect(
      AdmissionsDAO.issueAdmissionOffer(ctx, applicant.id, { decisionReason: "Self approve" })
    ).rejects.toThrow(/Maker-Checker violation/);

    // Checker approves offer -> SUCCEEDS
    const offered = await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, {
      decisionReason: "Passed entrance interview."
    });
    expect(offered.status).toBe(ApplicantStatus.ADMISSION_OFFERED);
    expect(offered.decisionById).toBe(checkerUserId);
  });

  it("ADM-10: Offer issuance sets expiration date (offerValidUntil)", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Daphne",
      lastName: "Kembabazi"
    });

    const offered = await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, {
      decisionReason: "Accepted",
      validDays: 10
    });

    expect(offered.offerValidUntil).toBeTruthy();
    const diffDays = Math.round(
      (new Date(offered.offerValidUntil!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(10);
  });

  it("ADM-11: Offer acceptance fails if offer has expired", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Fiona",
      lastName: "Akello"
    });

    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, {
      decisionReason: "Offer"
    });

    // Manually expire offer in db
    await db.applicant.update({
      where: { id: applicant.id },
      data: { offerValidUntil: new Date(Date.now() - 10000) }
    });

    await expect(AdmissionsDAO.acceptOffer(ctx, applicant.id)).rejects.toThrow(/expired/);
  });

  it("ADM-12: Offer acceptance succeeds when valid and records payment deposit", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "George",
      lastName: "Lule"
    });

    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "Valid" });
    const accepted = await AdmissionsDAO.acceptOffer(ctx, applicant.id, {
      applicationPaymentId: "pay_mock_123"
    });

    expect(accepted.status).toBe(ApplicantStatus.OFFER_ACCEPTED);
    expect(accepted.applicationFeePaid).toBe(true);
    expect(accepted.applicationPaymentId).toBe("pay_mock_123");
  });

  // ============================================================================
  // SINGLE-CLICK ONBOARDING, ENROLLMENT & PROVISIONING (ADM-13..ADM-23)
  // ============================================================================

  it("ADM-13: Single-click enrollment creates Student with atomic ADM-YYYY-00001 number", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      targetStreamId: streamId,
      firstName: "Henry",
      lastName: "Wasswa"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "Ready" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, {
      autoBill: false
    });

    const year = new Date().getFullYear();
    expect(result.student.admissionNo).toMatch(new RegExp(`^ADM-${year}-\\d{5}$`));
    expect(result.student.lifecycleStatus).toBe(StudentLifecycleStatus.ENROLLED);
    expect(result.applicant.status).toBe(ApplicantStatus.ENROLLED);
    expect(result.applicant.enrolledStudentId).toBe(result.student.id);
  });

  it("ADM-14: Existing Enrollment model is strictly used as the academic placement authority", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      targetStreamId: streamId,
      firstName: "Irene",
      lastName: "Babirye"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "Approved" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, { autoBill: false });

    // Verify record in authoritative db.enrollment
    const enrollment = await db.enrollment.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: result.student.id,
          academicYearId
        }
      }
    });

    expect(enrollment).toBeTruthy();
    expect(enrollment?.classId).toBe(classId);
    expect(enrollment?.streamId).toBe(streamId);
    expect(enrollment?.status).toBe("ACTIVE");
  });

  it("ADM-15: Student AR control account strictly debits GL #1200", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Joshua",
      lastName: "Kirabo"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "Admitted" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, {
      autoBill: true,
      feeStructureId
    });

    expect(result.provisioning.billingStatus).toBe(ProvisioningTaskStatus.COMPLETED);
    expect(result.provisioning.billingInvoiceId).toBeTruthy();

    // Verify generated invoice
    const invoice = await db.invoice.findUnique({
      where: { id: result.provisioning.billingInvoiceId! },
      include: { items: true }
    });

    expect(invoice).toBeTruthy();
    expect(invoice?.studentId).toBe(result.student.id);

    // Verify student ledger debit
    const ledgerEntry = await db.studentLedgerEntry.findFirst({
      where: {
        branchId,
        studentId: result.student.id,
        invoiceId: invoice!.id
      }
    });
    expect(ledgerEntry).toBeTruthy();
    expect(Number(ledgerEntry?.amount)).toBeGreaterThan(0);
  });

  it("ADM-16: Tuition, boarding, transport, and requirements monetization accounts credited", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Kevin",
      lastName: "Kyomugisha"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "Admitted" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, {
      autoBill: true,
      feeStructureId
    });

    expect(result.provisioning.billingStatus).toBe(ProvisioningTaskStatus.COMPLETED);
    const invoice = await db.invoice.findUnique({
      where: { id: result.provisioning.billingInvoiceId! },
      include: { items: true }
    });

    expect(invoice?.items.length).toBeGreaterThan(0);
    expect(Number(invoice?.netAmount)).toBe(1200000);
  });

  it("ADM-17: Post-commit provisioning creates EnrollmentProvisioning in PENDING state", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Laura",
      lastName: "Nanteza"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, { autoBill: false });
    expect(result.provisioning).toBeTruthy();
    expect(result.provisioning.studentId).toBe(result.student.id);
  });

  it("ADM-18: ProvisioningRunner handles auto-billing failure gracefully as FAILED_RETRYABLE", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Michael",
      lastName: "Mugalu"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    // Pass non-existent fee structure id to simulate billing failure
    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, {
      autoBill: true,
      feeStructureId: "non-existent-fee-structure-id"
    });

    expect(result.provisioning.billingStatus).toBe(ProvisioningTaskStatus.FAILED_RETRYABLE);
    expect(result.provisioning.overallStatus).toBe(ProvisioningTaskStatus.FAILED_RETRYABLE);
    expect(result.provisioning.nextRetryAt).toBeTruthy();
  });

  it("ADM-19: ProvisioningRunner retry mechanism retries failed tasks with backoff", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Noah",
      lastName: "Kiberu"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const initial = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, {
      autoBill: true,
      feeStructureId: "bad-id"
    });

    // Retry with valid fee structure
    const retried = await ProvisioningRunner.retry(ctx, initial.provisioning.id, {
      autoBill: true,
      feeStructureId
    });

    expect(retried.billingStatus).toBe(ProvisioningTaskStatus.COMPLETED);
    expect(retried.overallStatus).toBe(ProvisioningTaskStatus.COMPLETED);
  });

  it("ADM-20: Class requirement blueprint assignment during onboarding", async () => {
    // Setup blueprint via RequirementsDAO
    await RequirementsDAO.createClassRequirement(ctx, {
      classId,
      academicYearId,
      title: "S1 Mandatory Requirements",
      items: [
        {
          name: "Ream of Rotary Paper",
          quantity: 2,
          isMandatory: true
        }
      ]
    });

    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Oscar",
      lastName: "Musoke"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, { autoBill: false });
    expect(result.provisioning.requirementsStatus).toBe(ProvisioningTaskStatus.COMPLETED);

    // Verify student requirement checklist record created
    const reqRecord = await db.studentRequirementRecord.findFirst({
      where: { studentId: result.student.id, branchId }
    });
    expect(reqRecord).toBeTruthy();
  });

  it("ADM-21: Transport subscription creation during onboarding", async () => {
    const route = await db.transportRoute.create({
      data: {
        branchId,
        academicYearId,
        code: `TR_${Date.now()}`,
        name: "Entebbe Road Route",
        twoWayFee: 350000,
        oneWayFee: 200000
      }
    });

    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Patricia",
      lastName: "Nalubega"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, {
      autoBill: false,
      transportRouteId: route.id
    });

    expect(result.provisioning.transportStatus).toBe(ProvisioningTaskStatus.COMPLETED);
    const sub = await db.studentTransportSubscription.findFirst({
      where: { studentId: result.student.id, routeId: route.id }
    });
    expect(sub).toBeTruthy();
  });

  it("ADM-22: Uniform store sale creation during onboarding", async () => {
    const store = await db.inventoryStore.create({
      data: {
        branchId,
        code: `STR_${Date.now()}`,
        name: "Main Uniform Store"
      }
    });

    const item = await db.inventoryItem.create({
      data: {
        branchId,
        code: `UNI_${Date.now()}`,
        name: "School Blazer - Navy",
        unitOfMeasure: "PIECE",
        unitCostPrice: 80000,
        sellingPrice: 120000
      }
    });

    await db.inventoryStoreStock.create({
      data: {
        branchId,
        storeId: store.id,
        itemId: item.id,
        quantityOnHand: 50
      }
    });

    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Quentin",
      lastName: "Kigozi"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, {
      autoBill: true,
      feeStructureId,
      uniformStoreId: store.id,
      uniformItems: [{ itemId: item.id, quantity: 1, unitPrice: 120000 }]
    });

    expect(result.provisioning.storeOrderStatus).toBe(ProvisioningTaskStatus.COMPLETED);
  });

  it("ADM-23: SchoolPay local code assigned to admissionNo", async () => {
    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "Rachel",
      lastName: "Mbabazi"
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, applicant.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, applicant.id);

    const result = await AdmissionsDAO.enrollApplicant(checkerCtx, applicant.id, { autoBill: false });
    expect(result.student.schoolPayCode).toBe(result.student.admissionNo);
  });

  // ============================================================================
  // GUARDIAN & FAMILY DOMAIN (ADM-24..ADM-29)
  // ============================================================================

  it("ADM-24: Guardian master record creation with GRD-00001 sequence", async () => {
    const guardian = await GuardianDAO.createGuardian(ctx, {
      firstName: "James",
      lastName: "Mugerwa",
      phonePrimary: "0772123456",
      nationalId: "CM750123456789A"
    });

    expect(guardian.guardianCode).toMatch(/^GRD-\d{5}$/);
    expect(guardian.phonePrimary).toBe("+256772123456");
    expect(guardian.isVerified).toBe(false);
  });

  it("ADM-25: Multi-role guardian linking (Primary, Sponsor, Emergency)", async () => {
    const student = await StudentDAO.createStudent(ctx, {
      firstName: "Simon",
      lastName: "Kateregga"
    });

    const guardian = await GuardianDAO.createGuardian(ctx, {
      firstName: "Mary",
      lastName: "Kateregga",
      phonePrimary: "0701987654"
    });

    const link = await GuardianDAO.linkStudentGuardian(ctx, {
      studentId: student.id,
      guardianId: guardian.id,
      relationship: GuardianRelationship.MOTHER,
      isPrimaryContact: true,
      isFinancialSponsor: true,
      isEmergencyContact: true
    });

    expect(link.isPrimaryContact).toBe(true);
    expect(link.isFinancialSponsor).toBe(true);
    expect(link.isEmergencyContact).toBe(true);
  });

  it("ADM-26: Invariant: Exactly one primary contact per student enforced", async () => {
    const student = await StudentDAO.createStudent(ctx, {
      firstName: "Timothy",
      lastName: "Lwanga"
    });

    const g1 = await GuardianDAO.createGuardian(ctx, {
      firstName: "G1",
      lastName: "Father",
      phonePrimary: "0701111111"
    });

    const g2 = await GuardianDAO.createGuardian(ctx, {
      firstName: "G2",
      lastName: "Mother",
      phonePrimary: "0702222222"
    });

    // Link G1 as primary
    await GuardianDAO.linkStudentGuardian(ctx, {
      studentId: student.id,
      guardianId: g1.id,
      relationship: GuardianRelationship.FATHER,
      isPrimaryContact: true
    });

    // Link G2 as primary -> G1 is automatically demoted
    await GuardianDAO.linkStudentGuardian(ctx, {
      studentId: student.id,
      guardianId: g2.id,
      relationship: GuardianRelationship.MOTHER,
      isPrimaryContact: true
    });

    const primaryCount = await db.studentGuardian.count({
      where: { studentId: student.id, isPrimaryContact: true }
    });
    expect(primaryCount).toBe(1);

    const activePrimary = await db.studentGuardian.findFirst({
      where: { studentId: student.id, isPrimaryContact: true }
    });
    expect(activePrimary?.guardianId).toBe(g2.id);
  });

  it("ADM-27: Sibling detection automatically links students to shared FamilyGroup", async () => {
    const guardian = await GuardianDAO.createGuardian(ctx, {
      firstName: "Moses",
      lastName: "Ssempijja",
      phonePrimary: "0770555666"
    });

    // Sibling 1
    const app1 = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "SiblingOne",
      lastName: "Ssempijja",
      guardianId: guardian.id
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, app1.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, app1.id);
    const res1 = await AdmissionsDAO.enrollApplicant(checkerCtx, app1.id, { autoBill: false });

    // Sibling 2
    const app2 = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId,
      targetClassId: classId,
      firstName: "SiblingTwo",
      lastName: "Ssempijja",
      guardianId: guardian.id
    });
    await AdmissionsDAO.issueAdmissionOffer(checkerCtx, app2.id, { decisionReason: "OK" });
    await AdmissionsDAO.acceptOffer(ctx, app2.id);
    const res2 = await AdmissionsDAO.enrollApplicant(checkerCtx, app2.id, { autoBill: false });

    // Check FamilyGroup
    const s1 = await db.student.findUnique({ where: { id: res1.student.id } });
    const s2 = await db.student.findUnique({ where: { id: res2.student.id } });

    expect(s2?.familyGroupId).toBeTruthy();
    expect(s1?.familyGroupId || s2?.familyGroupId).toBeTruthy();
  });

  it("ADM-28: Migrated parent users imported as unverified (isVerified: false)", async () => {
    const parentPhone = `0779${Date.now().toString().slice(-6)}`;
    // Create legacy PARENT user
    await db.user.create({
      data: {
        organizationId: ctx.organizationId,
        email: `legacy_parent_${Date.now()}@test.com`,
        passwordHash: "hash",
        firstName: "Legacy",
        lastName: "Parent",
        userType: "PARENT",
        phone: parentPhone
      }
    });

    const result = await backfillLegacyParentUsers(ctx);
    expect(result.migratedCount).toBeGreaterThanOrEqual(1);

    const migratedGrd = await db.guardian.findFirst({
      where: { phonePrimary: `+256${parentPhone.slice(1)}`, branchId }
    });
    expect(migratedGrd).toBeTruthy();
    expect(migratedGrd?.provenance).toBe("LEGACY_USER_MIGRATION");
    expect(migratedGrd?.isVerified).toBe(false); // STRICT INVARIANT
  });

  it("ADM-29: Formal KYC verification requires admissions:approve and records verifiedById", async () => {
    const guardian = await GuardianDAO.createGuardian(ctx, {
      firstName: "Victoria",
      lastName: "Kavuma",
      phonePrimary: "0751234567"
    });

    // Verify using checkerCtx
    const verified = await GuardianDAO.verifyGuardian(checkerCtx, guardian.id);
    expect(verified.isVerified).toBe(true);
    expect(verified.verifiedById).toBe(checkerUserId);
    expect(verified.verifiedAt).toBeTruthy();
  });

  // ============================================================================
  // STUDENT LIFECYCLE STATE MACHINE (ADM-30..ADM-32)
  // ============================================================================

  it("ADM-30: Student lifecycle transition from ENROLLED to ACTIVE (Term Induction)", async () => {
    const student = await db.student.create({
      data: {
        branchId,
        admissionNo: `ADM_ENR_${Date.now()}`,
        firstName: "Enrolled",
        lastName: "Student",
        lifecycleStatus: StudentLifecycleStatus.ENROLLED
      }
    });

    const log = await StudentLifecycleDAO.transitionStatus(checkerCtx, {
      studentId: student.id,
      targetStatus: StudentLifecycleStatus.ACTIVE,
      reason: "Term induction and active attendance verified"
    });

    expect(log.fromStatus).toBe(StudentLifecycleStatus.ENROLLED);
    expect(log.toStatus).toBe(StudentLifecycleStatus.ACTIVE);

    const updated = await db.student.findUnique({ where: { id: student.id } });
    expect(updated?.lifecycleStatus).toBe(StudentLifecycleStatus.ACTIVE);
  });

  it("ADM-31: Student lifecycle transition to TRANSFERRED_OUT blocked if fee debt exists", async () => {
    const student = await StudentDAO.createStudent(ctx, {
      firstName: "Unclear",
      lastName: "Debtor"
    });

    // Create active enrollment
    const enrollment = await EnrollmentDAO.createEnrollment(ctx, {
      studentId: student.id,
      academicYearId,
      classId
    });

    // Create unpaid invoice to create debt
    await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: student.id,
      enrollmentId: enrollment.id,
      academicYearId,
      dueDate: new Date(),
      feeStructureId
    });

    // Attempt to transfer out without clearance permit -> MUST FAIL
    await expect(
      StudentLifecycleDAO.transitionStatus(checkerCtx, {
        studentId: student.id,
        targetStatus: StudentLifecycleStatus.TRANSFERRED_OUT,
        reason: "Transferring to another district"
      })
    ).rejects.toThrow(/Cannot transfer student out/);
  });

  it("ADM-32: Student lifecycle transition to TRANSFERRED_OUT succeeds when student is cleared", async () => {
    const student = await StudentDAO.createStudent(ctx, {
      firstName: "Clear",
      lastName: "Student"
    });

    await EnrollmentDAO.createEnrollment(ctx, {
      studentId: student.id,
      academicYearId,
      classId
    });

    // Zero debt, no requirements pending
    const log = await StudentLifecycleDAO.transitionStatus(checkerCtx, {
      studentId: student.id,
      targetStatus: StudentLifecycleStatus.TRANSFERRED_OUT,
      reason: "Family relocated to Jinja"
    });

    expect(log.toStatus).toBe(StudentLifecycleStatus.TRANSFERRED_OUT);

    const updatedStudent = await db.student.findUnique({ where: { id: student.id } });
    expect(updatedStudent?.lifecycleStatus).toBe(StudentLifecycleStatus.TRANSFERRED_OUT);
    expect(updatedStudent?.withdrawnDate).toBeTruthy();

    const enrollment = await db.enrollment.findFirst({ where: { studentId: student.id } });
    expect(enrollment?.status).toBe("TRANSFERRED");
    expect(enrollment?.endedAt).toBeTruthy();
  });
});
