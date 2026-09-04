import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  HostelGender,
  BedType,
  BedStatus,
  BedAllocationStatus,
  TriagePriority,
  DiagnosticCategory,
  DisciplineCategory,
  IncidentSeverity,
  HearingPlea,
  SanctionType,
  StudentLifecycleStatus,
  ExeatType,
  ExeatStatus,
  InventoryItemCategory,
  StoreLocationType,
  UserType,
} from "@prisma/client";
import { HostelDAO } from "@/lib/dao/hostel.dao";
import { ClinicDAO } from "@/lib/dao/clinic.dao";
import { DisciplineDAO } from "@/lib/dao/discipline.dao";
import { ExeatDAO } from "@/lib/dao/exeat.dao";
import { EmergencyNotificationDAO } from "@/lib/dao/emergency-notification.dao";

describe("Phase 3.2B: Student Welfare, Boarding, Clinic & Discipline Engine (WEL-01..WEL-28)", () => {
  let ctx: TenantContext;
  let checkerCtx: TenantContext;
  let unauthorizedCtx: TenantContext;
  let branchId: string;
  let academicYearId: string;
  let termId: string;
  let classId: string;
  let studentMaleId: string;
  let studentFemaleId: string;
  let storeId: string;
  let medicineItemId: string;

  beforeEach(async () => {
    const org = await db.organization.create({
      data: { name: `Welfare_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Welfare Academy", organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: "Main Campus", schoolId: school.id }
    });
    branchId = branch.id;

    const user1 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `welf_admin_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: "hash",
        firstName: "Staff",
        lastName: "Maker",
        userType: UserType.STAFF,
      }
    });

    const user2 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `welf_checker_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: "hash",
        firstName: "Head",
        lastName: "Checker",
        userType: UserType.STAFF,
      }
    });

    const user3 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `welf_guest_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: "hash",
        firstName: "Guest",
        lastName: "User",
        userType: UserType.STAFF,
      }
    });

    ctx = {
      userId: user1.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId,
      role: "ADMIN",
      permissions: ["all"],
    };

    checkerCtx = {
      userId: user2.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId,
      role: "DEPUTY_PRINCIPAL",
      permissions: ["all", "discipline:approve"],
    };

    unauthorizedCtx = {
      userId: user3.id,
      organizationId: org.id,
      schoolId: school.id,
      branchId,
      role: "GUEST",
      permissions: ["clinic:read"],
    };

    const academicYear = await db.academicYear.create({
      data: {
        branchId,
        name: `AY-${Date.now()}`,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-12-15"),
      }
    });
    academicYearId = academicYear.id;

    const term = await db.term.create({
      data: {
        academicYearId,
        name: "Term 1",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-04-15"),
      }
    });
    termId = term.id;

    const classRef = await db.class.create({
      data: {
        branchId,
        name: "Senior 1",
      }
    });
    classId = classRef.id;

    // Create enrolled active male and female students
    const maleStudent = await db.student.create({
      data: {
        branchId,
        admissionNo: `ADM-M-${Date.now()}`,
        firstName: "Kato",
        lastName: "Paul",
        gender: "MALE",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        allergies: "Aspirin",
      }
    });
    studentMaleId = maleStudent.id;

    await db.enrollment.create({
      data: {
        studentId: maleStudent.id,
        classId,
        academicYearId,
        status: "ACTIVE",
      }
    });

    const femaleStudent = await db.student.create({
      data: {
        branchId,
        admissionNo: `ADM-F-${Date.now()}`,
        firstName: "Babirye",
        lastName: "Sarah",
        gender: "FEMALE",
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      }
    });
    studentFemaleId = femaleStudent.id;

    await db.enrollment.create({
      data: {
        studentId: femaleStudent.id,
        classId,
        academicYearId,
        status: "ACTIVE",
      }
    });

    // Pharmacy Dispensary Store and Medication Item
    const store = await db.inventoryStore.create({
      data: {
        branchId,
        code: `CLINIC-STORE-${Date.now()}`,
        name: "Campus Clinic Dispensary",
        storeType: StoreLocationType.OTHER,
      }
    });
    storeId = store.id;

    const medItem = await db.inventoryItem.create({
      data: {
        branchId,
        code: `MED-${Date.now()}`,
        name: "Paracetamol 500mg",
        category: InventoryItemCategory.GENERAL,
        unitOfMeasure: "TABLETS",
        unitCostPrice: 150,
      }
    });
    medicineItemId = medItem.id;

    // Stock store with initial 100 tablets
    await db.inventoryStoreStock.create({
      data: {
        branchId,
        storeId,
        itemId: medicineItemId,
        quantityOnHand: 100,
        quantityReserved: 0,
      }
    });
  });

  // ============================================================================
  // 1. BOARDING & HOSTEL ENGINE (WEL-01 .. WEL-07)
  // ============================================================================

  describe("Boarding & Hostel Management", () => {
    it("WEL-01: Creates hostel, rooms, beds and allocates bed to active student", async () => {
      const hostel = await HostelDAO.createHostel(ctx, {
        code: "H-MUB",
        name: "Muteesa Boys Hall",
        gender: HostelGender.MALE,
        capacity: 50,
      });
      expect(hostel.id).toBeDefined();
      expect(hostel.gender).toBe(HostelGender.MALE);

      const room = await HostelDAO.createRoom(ctx, {
        hostelId: hostel.id,
        roomNumber: "101",
        floorNumber: 1,
        capacity: 4,
      });
      expect(room.id).toBeDefined();

      const bed = await HostelDAO.createBed(ctx, {
        roomId: room.id,
        bedNumber: "A1",
        bedType: BedType.BUNK_LOWER,
      });
      expect(bed.status).toBe(BedStatus.AVAILABLE);

      // Allocate bed
      const allocation = await HostelDAO.allocateBed(ctx, {
        studentId: studentMaleId,
        bedId: bed.id,
        academicYearId,
        termId,
      });

      expect(allocation.status).toBe(BedAllocationStatus.ACTIVE);
      expect(allocation.bedId).toBe(bed.id);

      // Bed status should now be OCCUPIED
      const updatedBed = await db.hostelBed.findUniqueOrThrow({ where: { id: bed.id } });
      expect(updatedBed.status).toBe(BedStatus.OCCUPIED);
    });

    it("WEL-02: Concurrency Lock prevents allocating already OCCUPIED bed", async () => {
      const hostel = await HostelDAO.createHostel(ctx, {
        code: "H-LUM",
        name: "Lumumba Hall",
        gender: HostelGender.MALE,
      });
      const room = await HostelDAO.createRoom(ctx, { hostelId: hostel.id, roomNumber: "201", capacity: 2 });
      const bed = await HostelDAO.createBed(ctx, { roomId: room.id, bedNumber: "B1" });

      // First allocation succeeds
      await HostelDAO.allocateBed(ctx, {
        studentId: studentMaleId,
        bedId: bed.id,
        academicYearId,
      });

      // Second allocation for same bed must throw
      await expect(
        HostelDAO.allocateBed(ctx, {
          studentId: studentFemaleId,
          bedId: bed.id,
          academicYearId,
        })
      ).rejects.toThrow(/Bed is not available for allocation/);
    });

    it("WEL-03: Gender mismatch guard blocks male student in female hostel", async () => {
      const hostel = await HostelDAO.createHostel(ctx, {
        code: "H-MARY",
        name: "Mary Stuart Hall",
        gender: HostelGender.FEMALE,
      });
      const room = await HostelDAO.createRoom(ctx, { hostelId: hostel.id, roomNumber: "301", capacity: 2 });
      const bed = await HostelDAO.createBed(ctx, { roomId: room.id, bedNumber: "C1" });

      await expect(
        HostelDAO.allocateBed(ctx, {
          studentId: studentMaleId,
          bedId: bed.id,
          academicYearId,
        })
      ).rejects.toThrow(/Gender mismatch/);
    });

    it("WEL-04: Bed transfer frees old bed and occupies new bed atomically", async () => {
      const hostel = await HostelDAO.createHostel(ctx, {
        code: "H-AFR",
        name: "Africa Hall",
        gender: HostelGender.FEMALE,
      });
      const room = await HostelDAO.createRoom(ctx, { hostelId: hostel.id, roomNumber: "101", capacity: 2 });
      const bed1 = await HostelDAO.createBed(ctx, { roomId: room.id, bedNumber: "D1" });
      const bed2 = await HostelDAO.createBed(ctx, { roomId: room.id, bedNumber: "D2" });

      const alloc = await HostelDAO.allocateBed(ctx, {
        studentId: studentFemaleId,
        bedId: bed1.id,
        academicYearId,
      });

      const transferred = await HostelDAO.transferBed(ctx, {
        allocationId: alloc.id,
        targetBedId: bed2.id,
        notes: "Requested window side bed",
      });

      expect(transferred.bedId).toBe(bed2.id);
      expect(transferred.status).toBe(BedAllocationStatus.ACTIVE);

      // Verify bed states
      const refreshedBed1 = await db.hostelBed.findUniqueOrThrow({ where: { id: bed1.id } });
      const refreshedBed2 = await db.hostelBed.findUniqueOrThrow({ where: { id: bed2.id } });
      expect(refreshedBed1.status).toBe(BedStatus.AVAILABLE);
      expect(refreshedBed2.status).toBe(BedStatus.OCCUPIED);
    });

    it("WEL-05: Releasing bed frees bed and sets allocation status to RELEASED", async () => {
      const hostel = await HostelDAO.createHostel(ctx, {
        code: "H-NKU",
        name: "Nkrumah Hall",
        gender: HostelGender.MALE,
      });
      const room = await HostelDAO.createRoom(ctx, { hostelId: hostel.id, roomNumber: "102", capacity: 2 });
      const bed = await HostelDAO.createBed(ctx, { roomId: room.id, bedNumber: "E1" });

      const alloc = await HostelDAO.allocateBed(ctx, {
        studentId: studentMaleId,
        bedId: bed.id,
        academicYearId,
      });

      const released = await HostelDAO.releaseBed(ctx, alloc.id, "End of term departure");
      expect(released.status).toBe(BedAllocationStatus.RELEASED);

      const refreshedBed = await db.hostelBed.findUniqueOrThrow({ where: { id: bed.id } });
      expect(refreshedBed.status).toBe(BedStatus.AVAILABLE);
    });

    it("WEL-06: End-of-term physical clearance bills damages to Student AR GL #1200", async () => {
      const clearance = await HostelDAO.recordHostelClearance(ctx, {
        studentId: studentMaleId,
        academicYearId,
        termId,
        mattressReturned: true,
        roomKeysReturned: true,
        lockerKeysReturned: false,
        bunkConditionIntact: false,
        damagesNoted: true,
        damageCostUGX: 45000,
        damageDescription: "Broken dormitory louvers and lost locker key",
      });

      expect(clearance.status).toBe("REJECTED");
      expect(clearance.damagesNoted).toBe(true);
      expect(clearance.invoiceId).toBeDefined();

      // Verify invoice was created on database
      const invoice = await db.invoice.findUniqueOrThrow({
        where: { id: clearance.invoiceId! },
        include: { items: true }
      });
      expect(Number(invoice.netAmount)).toBe(45000);
      expect(invoice.items[0]?.feeTypeName).toBe("Hostel Property Damage Surcharge");
    });
  });

  // ============================================================================
  // 2. CLINIC & ENCRYPTED HEALTH DATA (WEL-08 .. WEL-15)
  // ============================================================================

  describe("Clinic, Encrypted Medical Records & Dispensary", () => {
    it("WEL-08: Creates encounter with triage vitals and AES-256-GCM encrypted notes", async () => {
      const encounter = await ClinicDAO.createEncounter(ctx, {
        studentId: studentMaleId,
        academicYearId,
        termId,
        triagePriority: TriagePriority.URGENT,
        temperature: 38.8,
        pulseRate: 98,
        bloodPressure: "120/80",
        chiefComplaint: "High fever and persistent chills",
        diagnosticCategory: DiagnosticCategory.MALARIA,
        symptoms: "Rigors, profuse sweating, body weakness",
        clinicalNotes: "Patient examined by Nurse Joan. Malaria RDT positive.",
        diagnosis: "Uncomplicated Plasmodium Falciparum Malaria",
      });

      expect(encounter.encounterNumber).toMatch(/^CLN-\d{4}-\d{5}$/);
      expect(encounter.studentAllergyAlert).toBe("Aspirin");

      // Verify raw database record is encrypted with enc: prefix
      const rawInDb = await db.clinicEncounter.findUniqueOrThrow({
        where: { id: encounter.id }
      });
      expect(rawInDb.symptomsEncrypted).toMatch(/^enc:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
      expect(rawInDb.clinicalNotesEncrypted).toMatch(/^enc:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
      expect(rawInDb.diagnosisEncrypted).toMatch(/^enc:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it("WEL-09: Unmasks encrypted clinical notes for authorized roles, redacts for unauthorized", async () => {
      const encounter = await ClinicDAO.createEncounter(ctx, {
        studentId: studentFemaleId,
        academicYearId,
        chiefComplaint: "Abdominal discomfort",
        diagnosticCategory: DiagnosticCategory.GASTROINTESTINAL,
        symptoms: "Acute stomach pain",
        clinicalNotes: "Confidential gynaecological evaluation details",
        diagnosis: "Gastritis",
      });

      // Authorized read (ctx has 'all')
      const authorizedRead = await ClinicDAO.getEncounterById(ctx, encounter.id);
      expect(authorizedRead.isRedacted).toBe(false);
      expect(authorizedRead.clinicalNotes).toBe("Confidential gynaecological evaluation details");

      // Unauthorized read (unauthorizedCtx lacks clinic:medical_records)
      const unauthorizedRead = await ClinicDAO.getEncounterById(unauthorizedCtx, encounter.id);
      expect(unauthorizedRead.isRedacted).toBe(true);
      expect(unauthorizedRead.clinicalNotes).toBe("[CONFIDENTIAL MEDICAL RECORD]");
    });

    it("WEL-10: Sickbay admission and discharge cycle updates encounter outcome", async () => {
      const encounter = await ClinicDAO.createEncounter(ctx, {
        studentId: studentFemaleId,
        academicYearId,
        chiefComplaint: "Severe dehydration",
      });

      const admission = await ClinicDAO.admitToSickbay(ctx, {
        encounterId: encounter.id,
        bedNumber: "Bay 2 - Bed 1",
        notes: "Oral rehydration therapy",
      });
      expect(admission.id).toBeDefined();

      const discharged = await ClinicDAO.dischargeFromSickbay(ctx, {
        admissionId: admission.id,
        dischargeCondition: "Fully recovered, alert and hydrated",
      });
      expect(discharged.dischargedAt).toBeDefined();

      const refreshedEncounter = await db.clinicEncounter.findUniqueOrThrow({
        where: { id: encounter.id }
      });
      expect(refreshedEncounter.outcome).toBe("TREATED_AND_RETURNED");
    });

    it("WEL-11: External hospital referral dispatches ambulance and logs emergency notes", async () => {
      const encounter = await ClinicDAO.createEncounter(ctx, {
        studentId: studentMaleId,
        academicYearId,
        chiefComplaint: "Compound arm fracture on sports field",
        triagePriority: TriagePriority.EMERGENCY,
      });

      const referral = await ClinicDAO.referStudent(ctx, {
        encounterId: encounter.id,
        externalFacilityName: "Nakasero Hospital Emergency Unit",
        referralReason: "Orthopaedic emergency surgical evaluation",
        ambulanceDispatched: true,
        guardianNotificationNotes: "Called father Kato Senior; agreed to meet at hospital",
      });

      expect(referral.ambulanceDispatched).toBe(true);
      expect(referral.externalFacilityName).toBe("Nakasero Hospital Emergency Unit");
    });

    it("WEL-12: Dispensing medication mutates inventory stock with DEPARTMENT_ISSUE & WAC", async () => {
      const encounter = await ClinicDAO.createEncounter(ctx, {
        studentId: studentFemaleId,
        academicYearId,
        chiefComplaint: "Tension headache",
      });

      const dispensed = await ClinicDAO.dispenseMedicine(ctx, {
        encounterId: encounter.id,
        itemId: medicineItemId,
        storeId,
        quantity: 10,
        dosageInstructions: "2 tablets TDS for 2 days",
      });

      expect(dispensed.quantity).toBe(10);

      // Verify inventory store stock was decremented from 100 to 90
      const stock = await db.inventoryStoreStock.findUniqueOrThrow({
        where: { storeId_itemId: { storeId, itemId: medicineItemId } }
      });
      expect(Number(stock.quantityOnHand)).toBe(90);
    });

    it("WEL-13: Allergy guard blocks dispensing when medication matches student allergy", async () => {
      // Create aspirin item
      const aspirin = await db.inventoryItem.create({
        data: {
          branchId,
          code: `ASP-${Date.now()}`,
          name: "Aspirin 300mg Soluble",
          category: InventoryItemCategory.GENERAL,
          unitOfMeasure: "TABLETS",
          unitCostPrice: 200,
        }
      });

      await db.inventoryStoreStock.create({
        data: {
          branchId,
          storeId,
          itemId: aspirin.id,
          quantityOnHand: 50,
          quantityReserved: 0,
        }
      });

      // Male student has recorded allergy to "Aspirin"
      const encounter = await ClinicDAO.createEncounter(ctx, {
        studentId: studentMaleId,
        academicYearId,
        chiefComplaint: "Joint pain",
      });

      await expect(
        ClinicDAO.dispenseMedicine(ctx, {
          encounterId: encounter.id,
          itemId: aspirin.id,
          storeId,
          quantity: 2,
          dosageInstructions: "Take 1 tablet",
        })
      ).rejects.toThrow(/CRITICAL MEDICAL ALERT: Student has recorded allergy/);
    });
  });

  // ============================================================================
  // 3. DISCIPLINE & STUDENT LIFECYCLE AUTHORITY (WEL-16 .. WEL-22)
  // ============================================================================

  describe("Discipline, Maker-Checker & Student Lifecycle Integration", () => {
    it("WEL-16: Incident reporting, formal hearing and demerit accumulation", async () => {
      const incident = await DisciplineDAO.reportIncident(ctx, {
        title: "Sneaking out of dormitory after lights out",
        category: DisciplineCategory.TRUANCY,
        severity: IncidentSeverity.MAJOR,
        description: "Apprehended at perimeter fence at 1:30 AM",
        involvedStudents: [
          { studentId: studentMaleId, role: "PRIMARY_OFFENDER" }
        ]
      });
      expect(incident.incidentNumber).toMatch(/^DISC-\d{4}-\d{5}$/);

      const hearing = await DisciplineDAO.recordHearing(ctx, {
        incidentId: incident.id,
        panelChairId: checkerCtx.userId,
        panelMembers: "Senior Housemaster, Disciplinary Committee",
        studentPlea: HearingPlea.GUILTY,
        hearingMinutes: "Student admitted leaving campus to visit local market",
        findings: "Guilty of gross breach of boarding regulations",
      });
      expect(hearing.id).toBeDefined();

      const sanction = await DisciplineDAO.prescribeSanction(checkerCtx, {
        hearingId: hearing.id,
        studentId: studentMaleId,
        sanctionType: SanctionType.DETENTION,
        demeritPoints: 25,
        terms: "4 hours weekend community labor",
      });
      expect(sanction.demeritPoints).toBe(25);

      const history = await DisciplineDAO.getStudentDisciplineHistory(ctx, studentMaleId);
      expect(history.totalDemerits).toBe(25);
    });

    it("WEL-17: Maker-Checker strictly rejects major sanction if approver reported the incident", async () => {
      // ctx user reports the incident
      const incident = await DisciplineDAO.reportIncident(ctx, {
        title: "Vandalism of computer laboratory equipment",
        category: DisciplineCategory.VANDALISM,
        severity: IncidentSeverity.SEVERE,
        description: "Damaged monitor and broke laboratory lock",
        involvedStudents: [
          { studentId: studentMaleId, role: "PRIMARY_OFFENDER" }
        ]
      });

      const hearing = await DisciplineDAO.recordHearing(ctx, {
        incidentId: incident.id,
        panelChairId: checkerCtx.userId,
        studentPlea: HearingPlea.GUILTY,
        hearingMinutes: "Deliberation complete",
        findings: "Willful vandalism",
      });

      // If ctx attempts to approve SUSPENSION, maker-checker must reject!
      await expect(
        DisciplineDAO.prescribeSanction(ctx, {
          hearingId: hearing.id,
          studentId: studentMaleId,
          sanctionType: SanctionType.SUSPENSION,
          terms: "Two-week suspension",
        })
      ).rejects.toThrow(/Maker-Checker Violation/);
    });

    it("WEL-18: Disciplinary Suspension authoritatively transitions StudentLifecycleStatus to SUSPENDED", async () => {
      const incident = await DisciplineDAO.reportIncident(ctx, {
        title: "Physical assault in dining hall",
        category: DisciplineCategory.FIGHTING,
        severity: IncidentSeverity.MAJOR,
        description: "Assaulted fellow student during lunch",
        involvedStudents: [
          { studentId: studentMaleId, role: "PRIMARY_OFFENDER" }
        ]
      });

      const hearing = await DisciplineDAO.recordHearing(ctx, {
        incidentId: incident.id,
        panelChairId: checkerCtx.userId,
        studentPlea: HearingPlea.GUILTY,
        hearingMinutes: "Witness testimony confirmed unprovoked assault",
        findings: "Violent misconduct",
      });

      // checkerCtx approves SUSPENSION (satisfies maker-checker)
      const sanction = await DisciplineDAO.prescribeSanction(checkerCtx, {
        hearingId: hearing.id,
        studentId: studentMaleId,
        sanctionType: SanctionType.SUSPENSION,
        startDate: new Date(),
        terms: "2 weeks formal suspension from campus",
        demeritPoints: 50,
      });
      expect(sanction.sanctionType).toBe(SanctionType.SUSPENSION);

      // Verify StudentLifecycleStatus on Student was updated to SUSPENDED
      const student = await db.student.findUniqueOrThrow({
        where: { id: studentMaleId }
      });
      expect(student.lifecycleStatus).toBe(StudentLifecycleStatus.SUSPENDED);

      // Reinstatement transitions back to ACTIVE
      await DisciplineDAO.reinstateStudent(checkerCtx, sanction.id, "Served suspension period");
      const reinstatedStudent = await db.student.findUniqueOrThrow({
        where: { id: studentMaleId }
      });
      expect(reinstatedStudent.lifecycleStatus).toBe(StudentLifecycleStatus.ACTIVE);
    });
  });

  // ============================================================================
  // 4. EXEAT & GATE PASS ENGINE (WEL-23 .. WEL-27)
  // ============================================================================

  describe("Exeat Passes & QR Gate Verification", () => {
    it("WEL-23: Exeat request generates cryptographic QR token and completes gate lifecycle", async () => {
      const exeat = await ExeatDAO.requestExeat(ctx, {
        studentId: studentMaleId,
        academicYearId,
        termId,
        exeatType: ExeatType.MEDICAL,
        reason: "Orthodontic clinic appointment",
        intendedDeparture: new Date("2026-03-10T08:00:00Z"),
        expectedReturn: new Date("2026-03-10T16:00:00Z"),
        guardianConsent: true,
      });

      expect(exeat.exeatNumber).toMatch(/^EXT-\d{4}-\d{5}$/);
      expect(exeat.status).toBe(ExeatStatus.PENDING);
      expect(exeat.qrVerificationToken).toHaveLength(48);

      // Verify token lookup
      const lookup = await ExeatDAO.verifyPassByToken(ctx, exeat.qrVerificationToken);
      expect(lookup.student.id).toBe(studentMaleId);

      // Approve pass
      const approved = await ExeatDAO.approveExeat(ctx, exeat.id);
      expect(approved.status).toBe(ExeatStatus.APPROVED);

      // Gate checkout by QR token
      const departed = await ExeatDAO.gateCheckout(ctx, {
        qrVerificationToken: exeat.qrVerificationToken,
      });
      expect(departed.status).toBe(ExeatStatus.DEPARTED);
      expect(departed.actualDeparture).toBeDefined();

      // Gate checkin
      const returned = await ExeatDAO.gateCheckin(ctx, {
        exeatId: exeat.id,
      });
      expect(returned.status).toBe(ExeatStatus.COMPLETED);
      expect(returned.actualReturn).toBeDefined();
    });

    it("WEL-24: Overdue calculation flags student returning after expected time", async () => {
      const exeat = await ExeatDAO.requestExeat(ctx, {
        studentId: studentFemaleId,
        academicYearId,
        exeatType: ExeatType.FAMILY_EMERGENCY,
        reason: "Family funeral",
        intendedDeparture: new Date(Date.now() - 3600000 * 5),
        expectedReturn: new Date(Date.now() - 3600000 * 2), // 2 hours ago
      });

      await ExeatDAO.approveExeat(ctx, exeat.id);
      await ExeatDAO.gateCheckout(ctx, { exeatId: exeat.id });

      const returned = await ExeatDAO.gateCheckin(ctx, { exeatId: exeat.id });
      expect(returned.status).toBe(ExeatStatus.COMPLETED);
      expect(returned.isOverdue).toBe(true);
    });
  });

  // ============================================================================
  // 5. EMERGENCY NOTIFICATION LOG (WEL-28)
  // ============================================================================

  describe("Emergency Notifications", () => {
    it("WEL-28: Logs guardian phone calls for medical emergency with audit trail", async () => {
      const guardian = await db.guardian.create({
        data: {
          branchId,
          guardianCode: `GRD-${Date.now()}`,
          firstName: "John",
          lastName: "Kato",
          phonePrimary: "+256700123456",
        }
      });

      const log = await EmergencyNotificationDAO.logNotification(ctx, {
        studentId: studentMaleId,
        guardianId: guardian.id,
        notificationReason: "Severe malaria triage referral to Mulago Hospital",
        phoneDialed: "+256700123456",
        guardianResponseNotes: "Spoke to father; informed him ambulance has been dispatched",
      });

      expect(log.id).toBeDefined();
      expect(log.notificationReason).toContain("malaria triage referral");

      const list = await EmergencyNotificationDAO.listStudentNotifications(ctx, studentMaleId);
      expect(list.length).toBeGreaterThanOrEqual(1);
    });
  });
});
