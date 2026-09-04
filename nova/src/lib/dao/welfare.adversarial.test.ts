import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  HostelGender,
  BedAllocationStatus,
  DisciplineCategory,
  IncidentSeverity,
  HearingPlea,
  SanctionType,
  StudentLifecycleStatus,
  ExeatType,
  InventoryItemCategory,
  StoreLocationType,
  UserType,
} from "@prisma/client";
import { HostelDAO } from "@/lib/dao/hostel.dao";
import { ClinicDAO } from "@/lib/dao/clinic.dao";
import { DisciplineDAO } from "@/lib/dao/discipline.dao";
import { ExeatDAO } from "@/lib/dao/exeat.dao";

describe("Phase 3.2B: Adversarial & Stress Testing (ADV-WEL-01..ADV-WEL-07)", () => {
  let ctxA: TenantContext;
  let ctxB: TenantContext;
  let branchAId: string;
  let branchBId: string;
  let studentA1Id: string;
  let studentA2Id: string;
  let studentBId: string;
  let academicYearAId: string;
  let academicYearBId: string;
  let storeAId: string;
  let itemAId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `Adv_Welfare_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Adversarial Academy", organizationId: org.id }
    });

    // Branch A
    const branchA = await db.branch.create({
      data: { name: "Branch Alpha", schoolId: school.id }
    });
    branchAId = branchA.id;

    // Branch B (Rival / Isolated Branch)
    const branchB = await db.branch.create({
      data: { name: "Branch Beta", schoolId: school.id }
    });
    branchBId = branchB.id;

    const userA = await db.user.create({
      data: {
        organizationId: org.id,
        email: `staff_a_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: "hash",
        firstName: "Staff",
        lastName: "Alpha",
        userType: UserType.STAFF,
      }
    });

    const userB = await db.user.create({
      data: {
        organizationId: org.id,
        email: `staff_b_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: "hash",
        firstName: "Staff",
        lastName: "Beta",
        userType: UserType.STAFF,
      }
    });

    ctxA = {
      userId: userA.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchAId,
      role: "ADMIN",
      permissions: ["all"],
    };

    ctxB = {
      userId: userB.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId: branchBId,
      role: "ADMIN",
      permissions: ["all"],
    };

    const ayA = await db.academicYear.create({
      data: {
        branchId: branchAId,
        name: `AY-A-${Date.now()}`,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-12-15"),
      }
    });
    academicYearAId = ayA.id;

    const ayB = await db.academicYear.create({
      data: {
        branchId: branchBId,
        name: `AY-B-${Date.now()}`,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-12-15"),
      }
    });
    academicYearBId = ayB.id;

    // Students
    const sA1 = await db.student.create({
      data: {
        branchId: branchAId,
        admissionNo: `ADV-A1-${Date.now()}`,
        firstName: "John",
        lastName: "Alpha",
        gender: "MALE",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      }
    });
    studentA1Id = sA1.id;

    const sA2 = await db.student.create({
      data: {
        branchId: branchAId,
        admissionNo: `ADV-A2-${Date.now()}`,
        firstName: "Peter",
        lastName: "Alpha",
        gender: "MALE",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      }
    });
    studentA2Id = sA2.id;

    const sB = await db.student.create({
      data: {
        branchId: branchBId,
        admissionNo: `ADV-B-${Date.now()}`,
        firstName: "Sarah",
        lastName: "Beta",
        gender: "FEMALE",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      }
    });
    studentBId = sB.id;

    // Pharmacy Store & Item in Branch A
    const store = await db.inventoryStore.create({
      data: {
        branchId: branchAId,
        code: `STR-ADV-${Date.now()}`,
        name: "Branch A Dispensary",
        storeType: StoreLocationType.OTHER,
      }
    });
    storeAId = store.id;

    const item = await db.inventoryItem.create({
      data: {
        branchId: branchAId,
        code: `MED-ADV-${Date.now()}`,
        name: "Amoxicillin 250mg",
        category: InventoryItemCategory.GENERAL,
        unitOfMeasure: "CAPSULES",
        unitCostPrice: 300,
      }
    });
    itemAId = item.id;

    await db.inventoryStoreStock.create({
      data: {
        branchId: branchAId,
        storeId: storeAId,
        itemId: itemAId,
        quantityOnHand: 20, // Limited stock of 20
        quantityReserved: 0,
      }
    });
  });

  it("ADV-WEL-01: Concurrent race condition on identical bed allocation ensures exactly one winner", async () => {
    const hostel = await HostelDAO.createHostel(ctxA, {
      code: "H-RACE",
      name: "Race Hall",
      gender: HostelGender.MALE,
    });
    const room = await HostelDAO.createRoom(ctxA, { hostelId: hostel.id, roomNumber: "R1", capacity: 2 });
    const bed = await HostelDAO.createBed(ctxA, { roomId: room.id, bedNumber: "1" });

    // Concurrently trigger 2 allocations for the same bed
    const [res1, res2] = await Promise.allSettled([
      HostelDAO.allocateBed(ctxA, {
        studentId: studentA1Id,
        bedId: bed.id,
        academicYearId: academicYearAId,
      }),
      HostelDAO.allocateBed(ctxA, {
        studentId: studentA2Id,
        bedId: bed.id,
        academicYearId: academicYearAId,
      }),
    ]);

    const successes = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejections = [res1, res2].filter((r) => r.status === "rejected");

    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);

    // Bed status should be OCCUPIED with exactly 1 active allocation in DB
    const activeAllocations = await db.bedAllocation.findMany({
      where: { bedId: bed.id, status: BedAllocationStatus.ACTIVE }
    });
    expect(activeAllocations.length).toBe(1);
  });

  it("ADV-WEL-02: Student cannot hold two active bed allocations simultaneously in same academic year", async () => {
    const hostel = await HostelDAO.createHostel(ctxA, {
      code: "H-DBL",
      name: "Double Alloc Hall",
      gender: HostelGender.MALE,
    });
    const room = await HostelDAO.createRoom(ctxA, { hostelId: hostel.id, roomNumber: "R2", capacity: 4 });
    const bed1 = await HostelDAO.createBed(ctxA, { roomId: room.id, bedNumber: "A" });
    const bed2 = await HostelDAO.createBed(ctxA, { roomId: room.id, bedNumber: "B" });

    await HostelDAO.allocateBed(ctxA, {
      studentId: studentA1Id,
      bedId: bed1.id,
      academicYearId: academicYearAId,
    });

    // Attempting to allocate bed2 to studentA1 in the same academic year must fail
    await expect(
      HostelDAO.allocateBed(ctxA, {
        studentId: studentA1Id,
        bedId: bed2.id,
        academicYearId: academicYearAId,
      })
    ).rejects.toThrow(/Student already has an active bed allocation/);
  });

  it("ADV-WEL-03: Cross-branch isolation prevents Branch A staff from manipulating Branch B resources", async () => {
    // Create hostel in Branch B
    const hostelB = await HostelDAO.createHostel(ctxB, {
      code: "H-BET",
      name: "Beta Hostel",
      gender: HostelGender.FEMALE,
    });
    const roomB = await HostelDAO.createRoom(ctxB, { hostelId: hostelB.id, roomNumber: "B1", capacity: 2 });
    const bedB = await HostelDAO.createBed(ctxB, { roomId: roomB.id, bedNumber: "1" });

    // Staff in Branch A attempts to allocate bed in Branch B
    await expect(
      HostelDAO.allocateBed(ctxA, {
        studentId: studentA1Id,
        bedId: bedB.id,
        academicYearId: academicYearAId,
      })
    ).rejects.toThrow(/Bed not found in this branch/);

    // Create encounter in Branch B
    const encounterB = await ClinicDAO.createEncounter(ctxB, {
      studentId: studentBId,
      academicYearId: academicYearBId,
      chiefComplaint: "Migraine",
    });

    // Staff in Branch A attempts to fetch Branch B encounter
    await expect(
      ClinicDAO.getEncounterById(ctxA, encounterB.id)
    ).rejects.toThrow(/Clinic encounter not found/);

    // Create exeat in Branch B
    const exeatB = await ExeatDAO.requestExeat(ctxB, {
      studentId: studentBId,
      academicYearId: academicYearBId,
      exeatType: ExeatType.MEDICAL,
      reason: "Dental checkup",
      intendedDeparture: new Date(),
      expectedReturn: new Date(Date.now() + 3600000),
    });

    // Staff in Branch A attempts to checkout Branch B exeat
    await expect(
      ExeatDAO.gateCheckout(ctxA, { exeatId: exeatB.id })
    ).rejects.toThrow(/Exeat pass not found/);
  });

  it("ADV-WEL-04: Negative pharmacy inventory attack is strictly rejected and protects stock", async () => {
    const encounter = await ClinicDAO.createEncounter(ctxA, {
      studentId: studentA1Id,
      academicYearId: academicYearAId,
      chiefComplaint: "Bacterial infection",
    });

    // Stock on hand is 20; attempt to dispense 100 capsules
    await expect(
      ClinicDAO.dispenseMedicine(ctxA, {
        encounterId: encounter.id,
        itemId: itemAId,
        storeId: storeAId,
        quantity: 100,
        dosageInstructions: "Take 10 capsules daily",
      })
    ).rejects.toThrow(/Insufficient stock for item in store/);

    // Verify stock remains untouched at 20
    const stock = await db.inventoryStoreStock.findUniqueOrThrow({
      where: { storeId_itemId: { storeId: storeAId, itemId: itemAId } }
    });
    expect(Number(stock.quantityOnHand)).toBe(20);
  });

  it("ADV-WEL-05: Tampered clinical ciphertext causes authenticated decryption rejection", async () => {
    const encounter = await ClinicDAO.createEncounter(ctxA, {
      studentId: studentA1Id,
      academicYearId: academicYearAId,
      chiefComplaint: "Confidential checkup",
      clinicalNotes: "Sensitive doctor consultation notes",
    });

    // Directly tamper with the ciphertext in the database
    const tamperedPayload = "enc:0102030405060708090a0b0c:deadbeefcafebabe0102030405060708:aabbccddeeff";
    await db.clinicEncounter.update({
      where: { id: encounter.id },
      data: { clinicalNotesEncrypted: tamperedPayload }
    });

    // Fetching the encounter should not throw an uncaught exception; decryption catches authentication tag failure and yields null
    const result = await ClinicDAO.getEncounterById(ctxA, encounter.id);
    expect(result.clinicalNotes).toBeNull();
  });

  it("ADV-WEL-06: Disciplinary self-approval bypass attack strictly rejected by Maker-Checker", async () => {
    const incident = await DisciplineDAO.reportIncident(ctxA, {
      title: "Cheating on mock examination",
      category: DisciplineCategory.ACADEMIC_DISHONESTY,
      severity: IncidentSeverity.MAJOR,
      description: "Found with contraband notes in examination hall",
      involvedStudents: [
        { studentId: studentA1Id, role: "PRIMARY_OFFENDER" }
      ]
    });

    const hearing = await DisciplineDAO.recordHearing(ctxA, {
      incidentId: incident.id,
      panelChairId: ctxA.userId,
      studentPlea: HearingPlea.GUILTY,
      hearingMinutes: "Contraband material verified",
      findings: "Exam cheating confirmed",
    });

    // ctxA reported the incident; ctxA now tries to prescribe EXPULSION
    await expect(
      DisciplineDAO.prescribeSanction(ctxA, {
        hearingId: hearing.id,
        studentId: studentA1Id,
        sanctionType: SanctionType.EXPULSION,
        terms: "Immediate expulsion from the institution",
      })
    ).rejects.toThrow(/Maker-Checker Violation: Sanction approver cannot be the staff member who reported the incident/);
  });

  it("ADV-WEL-07: Unauthorized role without permissions is rejected from welfare mutations", async () => {
    const noPermsCtx: TenantContext = {
      userId: ctxA.userId,
      organizationId: ctxA.organizationId,
      schoolId: ctxA.schoolId,
      branchId: branchAId,
      role: "VIEWER",
      permissions: [], // empty permissions
    };

    await expect(
      HostelDAO.createHostel(noPermsCtx, {
        code: "H-FAIL",
        name: "Fail Hall",
        gender: HostelGender.MIXED,
      })
    ).rejects.toThrow(/Missing required permission/);

    await expect(
      ClinicDAO.createEncounter(noPermsCtx, {
        studentId: studentA1Id,
        academicYearId: academicYearAId,
        chiefComplaint: "Test",
      })
    ).rejects.toThrow(/Missing required permission/);

    await expect(
      ExeatDAO.approveExeat(noPermsCtx, "fake-id")
    ).rejects.toThrow(/Missing required permission/);
  });
});
