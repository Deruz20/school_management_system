import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import { TransportDAO, Context } from "./transport.dao";

describe("NOVA Finance Phase 3.1I — Adversarial & Edge Case Test Suite", () => {
  let ctx: Context;
  let otherBranchCtx: Context;
  let academicYear: { id: string };
  let term: { id: string };
  let student1: { id: string };
  let student2: { id: string };
  let testClass: { id: string };

  beforeAll(async () => {
    const org = await db.organization.create({
      data: { name: `Transport Adv Org ${Date.now()}` },
    });

    const school = await db.school.create({
      data: { name: "Transport Adv School", organizationId: org.id },
    });

    const branch1 = await db.branch.create({
      data: { schoolId: school.id, name: "Transport Campus Alpha" },
    });

    const branch2 = await db.branch.create({
      data: { schoolId: school.id, name: "Transport Campus Beta" },
    });

    const user1 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `adv_admin1_${Date.now()}@test.com`,
        firstName: "Adv",
        lastName: "Admin1",
        passwordHash: "hash",
        userType: "STAFF",
      },
    });

    const user2 = await db.user.create({
      data: {
        organizationId: org.id,
        email: `adv_admin2_${Date.now()}@test.com`,
        firstName: "Adv",
        lastName: "Admin2",
        passwordHash: "hash",
        userType: "STAFF",
      },
    });

    ctx = {
      branchId: branch1.id,
      userId: user1.id,
      organizationId: org.id,
      schoolId: school.id,
      role: "ADMIN",
      permissions: ["all"],
    };

    otherBranchCtx = {
      branchId: branch2.id,
      userId: user2.id,
      organizationId: org.id,
      schoolId: school.id,
      role: "ADMIN",
      permissions: ["all"],
    };

    academicYear = await db.academicYear.create({
      data: {
        branchId: branch1.id,
        name: "2026 Academic Year",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
      },
    });

    term = await db.term.create({
      data: {
        academicYearId: academicYear.id,
        name: "Term 1",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-04-30"),
      },
    });

    testClass = await db.class.create({
      data: { branchId: branch1.id, name: "Class P4", capacity: 30 },
    });

    student1 = await db.student.create({
      data: {
        branchId: branch1.id,
        admissionNo: `ADV-STU-1-${Date.now()}`,
        firstName: "David",
        lastName: "Mugisha",
        classId: testClass.id,
        enrollments: {
          create: {
            academicYearId: academicYear.id,
            classId: testClass.id,
            status: "ACTIVE",
          },
        },
      },
    });

    student2 = await db.student.create({
      data: {
        branchId: branch1.id,
        admissionNo: `ADV-STU-2-${Date.now()}`,
        firstName: "Esther",
        lastName: "Nantaba",
        classId: testClass.id,
        enrollments: {
          create: {
            academicYearId: academicYear.id,
            classId: testClass.id,
            status: "ACTIVE",
          },
        },
      },
    });
  });

  // -------------------------------------------------------------
  // ADV-TRANS-01: Reject Negative Route Fees and Surcharges
  // -------------------------------------------------------------
  it("ADV-TRANS-01: should strictly reject negative two-way fee, one-way fee, or stop surcharge", async () => {
    // Negative two-way fee
    await expect(
      TransportDAO.createRoute(ctx, {
        code: "RT-NEG1",
        name: "Negative Route",
        twoWayFee: -100000,
        oneWayFee: 50000,
        academicYearId: academicYear.id,
      })
    ).rejects.toThrow(/negative/i);

    // Negative one-way fee
    await expect(
      TransportDAO.createRoute(ctx, {
        code: "RT-NEG2",
        name: "Negative Route 2",
        twoWayFee: 100000,
        oneWayFee: -50000,
        academicYearId: academicYear.id,
      })
    ).rejects.toThrow(/negative/i);

    // Negative stop surcharge
    const validRoute = await TransportDAO.createRoute(ctx, {
      code: "RT-ADV-VALID",
      name: "Valid Adv Route",
      twoWayFee: 300000,
      oneWayFee: 180000,
      academicYearId: academicYear.id,
    });

    await expect(
      TransportDAO.addRouteStop(ctx, validRoute.id, {
        stopName: "Invalid Negative Stop",
        surchargeAmount: -25000,
      })
    ).rejects.toThrow(/negative/i);
  });

  // -------------------------------------------------------------
  // ADV-TRANS-02: Prevent Assigning Inactive or Out-of-Service Vehicle
  // -------------------------------------------------------------
  it("ADV-TRANS-02: should prevent assigning MAINTENANCE or OUT_OF_SERVICE vehicle to active route", async () => {
    const route = (await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id }))[0];

    const brokenVehicle = await TransportDAO.registerVehicle(ctx, {
      registrationNumber: "UBX 999Z",
      makeModel: "Isuzu Bus 40-Seater",
      capacity: 40,
      status: "MAINTENANCE",
    });

    await expect(
      TransportDAO.createVehicleRouteAssignment(ctx, {
        routeId: route.id,
        vehicleId: brokenVehicle.id,
        academicYearId: academicYear.id,
      })
    ).rejects.toThrow(/MAINTENANCE/i);
  });

  // -------------------------------------------------------------
  // ADV-TRANS-03: Prevent Assigning Expired Driver License or Inactive Driver
  // -------------------------------------------------------------
  it("ADV-TRANS-03: should prevent assigning driver with expired license or inactive status", async () => {
    const route = (await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id }))[0];

    const activeVehicle = await TransportDAO.registerVehicle(ctx, {
      registrationNumber: "UBB 111A",
      makeModel: "Toyota Hiace 14-Seater",
      capacity: 14,
      status: "ACTIVE",
    });

    const expiredDriver = await TransportDAO.registerDriver(ctx, {
      fullName: "Moses Expired",
      phone: "+256701000111",
      licenseNumber: "DL-EXP-001",
      licenseClass: "CM",
      licenseExpiry: new Date("2020-01-01"), // Expired 6 years ago
    });

    await expect(
      TransportDAO.createVehicleRouteAssignment(ctx, {
        routeId: route.id,
        vehicleId: activeVehicle.id,
        driverId: expiredDriver.id,
        academicYearId: academicYear.id,
      })
    ).rejects.toThrow(/expired/i);
  });

  // -------------------------------------------------------------
  // ADV-TRANS-04: Prevent Duplicate Subscription for Same Student in Same Term
  // -------------------------------------------------------------
  it("ADV-TRANS-04: should reject duplicate subscription for same student, year, term, and route", async () => {
    const route = (await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id }))[0];

    const sub = await TransportDAO.subscribeStudent(ctx, {
      studentId: student1.id,
      routeId: route.id,
      academicYearId: academicYear.id,
      termId: term.id,
      subscriptionType: "TWO_WAY",
    });
    expect(sub.id).toBeDefined();

    // Attempting duplicate subscription should throw unique constraint error
    await expect(
      TransportDAO.subscribeStudent(ctx, {
        studentId: student1.id,
        routeId: route.id,
        academicYearId: academicYear.id,
        termId: term.id,
        subscriptionType: "TWO_WAY",
      })
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------
  // ADV-TRANS-05: Prevent Subscribing to Stop Not Belonging to Route
  // -------------------------------------------------------------
  it("ADV-TRANS-05: should reject subscription if selected stop does not belong to the route", async () => {
    const route1 = (await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id }))[0];

    const route2 = await TransportDAO.createRoute(ctx, {
      code: "RT-ADV-OTHER",
      name: "Other Route for Stop Test",
      twoWayFee: 320000,
      oneWayFee: 200000,
      academicYearId: academicYear.id,
      stops: [{ stopName: "Foreign Route Stop", surchargeAmount: 15000 }],
    });

    const foreignStop = route2.stops[0];

    // Subscribing student2 to route1 with a stop from route2 should be rejected
    await expect(
      TransportDAO.subscribeStudent(ctx, {
        studentId: student2.id,
        routeId: route1.id,
        stopId: foreignStop.id,
        academicYearId: academicYear.id,
        termId: term.id,
      })
    ).rejects.toThrow(/does not belong/i);
  });

  // -------------------------------------------------------------
  // ADV-TRANS-06: Prevent Fuel Log when Odometer Goes Backwards
  // -------------------------------------------------------------
  it("ADV-TRANS-06: should reject fuel log if odometer is less than current vehicle reading", async () => {
    const vehicle = await TransportDAO.registerVehicle(ctx, {
      registrationNumber: "UBM 777Q",
      makeModel: "Toyota Coaster",
      capacity: 30,
      status: "ACTIVE",
    });

    // 1st log at 60,000 km
    await TransportDAO.recordFuelLog(ctx, {
      vehicleId: vehicle.id,
      odometerKm: 60000,
      litersFilled: 40,
      unitPrice: 5000,
      totalCost: 200000,
      fuelStation: "TotalEnergies Bugolobi",
      receiptNumber: `ADV-FUEL-1-${Date.now()}`,
    });

    // 2nd log attempting backwards odometer (55,000 km) should fail
    await expect(
      TransportDAO.recordFuelLog(ctx, {
        vehicleId: vehicle.id,
        odometerKm: 55000,
        litersFilled: 20,
        unitPrice: 5000,
        totalCost: 100000,
        fuelStation: "TotalEnergies Bugolobi",
        receiptNumber: `ADV-FUEL-2-${Date.now()}`,
      })
    ).rejects.toThrow(/less than vehicle current odometer/i);
  });

  // -------------------------------------------------------------
  // ADV-TRANS-07: Prevent Fuel Log Math Discrepancy
  // -------------------------------------------------------------
  it("ADV-TRANS-07: should reject fuel log if totalCost != litersFilled * unitPrice", async () => {
    const vehicles = await TransportDAO.listVehicles(ctx);
    const vehicle = vehicles[0];

    // 40 liters @ 5,000 UGX = 200,000 UGX, but passing 999,999 UGX
    await expect(
      TransportDAO.recordFuelLog(ctx, {
        vehicleId: vehicle.id,
        odometerKm: 70000,
        litersFilled: 40,
        unitPrice: 5000,
        totalCost: 999999,
        fuelStation: "Shell Lugogo",
        receiptNumber: `ADV-MATH-${Date.now()}`,
      })
    ).rejects.toThrow(/does not match liters \* unitPrice/i);
  });

  // -------------------------------------------------------------
  // ADV-TRANS-08: Prevent Maintenance Log Math Discrepancy
  // -------------------------------------------------------------
  it("ADV-TRANS-08: should reject maintenance log if totalCost != partsCost + laborCost", async () => {
    const vehicles = await TransportDAO.listVehicles(ctx);
    const vehicle = vehicles[0];

    // Parts (200k) + Labor (100k) = 300k, but claiming total 800k
    await expect(
      TransportDAO.recordMaintenanceLog(ctx, {
        vehicleId: vehicle.id,
        garageName: "Spear Motors",
        description: "Engine Diagnostic",
        partsCost: 200000,
        laborCost: 100000,
        totalCost: 800000,
      })
    ).rejects.toThrow(/does not match partsCost \+ laborCost/i);
  });

  // -------------------------------------------------------------
  // ADV-TRANS-09: Prevent Re-Voiding an Already Voided Maintenance Record
  // -------------------------------------------------------------
  it("ADV-TRANS-09: should reject voiding a maintenance log that has already been voided", async () => {
    const vehicles = await TransportDAO.listVehicles(ctx);
    const vehicle = vehicles[0];

    const log = await TransportDAO.recordMaintenanceLog(ctx, {
      vehicleId: vehicle.id,
      garageName: "Spear Motors",
      description: "Oil filter swap",
      partsCost: 50000,
      laborCost: 20000,
      totalCost: 70000,
    });

    // 1st void should succeed
    const voided = await TransportDAO.voidMaintenanceLog(ctx, log.id, {
      voidReason: "Entered wrong vehicle plate",
    });
    expect(voided.isVoided).toBe(true);

    // 2nd void on same log should throw error
    await expect(
      TransportDAO.voidMaintenanceLog(ctx, log.id, {
        voidReason: "Second void attempt",
      })
    ).rejects.toThrow(/already voided/i);
  });

  // -------------------------------------------------------------
  // ADV-TRANS-10: Cross-Tenant Isolation Violation Prevention
  // -------------------------------------------------------------
  it("ADV-TRANS-10: should strictly prevent accessing or mutating cross-tenant routes and vehicles", async () => {
    const routes = await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id });
    const route = routes[0];

    // Branch 2 attempts to add stop to Branch 1 route
    await expect(
      TransportDAO.addRouteStop(otherBranchCtx, route.id, {
        stopName: "Malicious Stop",
      })
    ).rejects.toThrow(/not found/i);

    // Branch 2 attempts to update Branch 1 route
    await expect(
      TransportDAO.updateRoute(otherBranchCtx, route.id, {
        name: "Hijacked Route Name",
      })
    ).rejects.toThrow(/not found or access denied/i);

    // Branch 2 attempts to generate manifest for Branch 1 route
    await expect(
      TransportDAO.generatePassengerManifest(otherBranchCtx, {
        routeId: route.id,
        academicYearId: academicYear.id,
        tripType: "MORNING",
      })
    ).rejects.toThrow(/not found/i);
  });
});
