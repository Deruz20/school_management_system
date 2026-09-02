import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import { TransportDAO, Context } from "./transport.dao";

describe("NOVA Finance Phase 3.1I — Transport & Fleet DAO Unit Test Suite", () => {
  let ctx: Context;
  let otherBranchCtx: Context;
  let academicYear: { id: string };
  let term: { id: string };
  let student1: { id: string };
  let student2: { id: string };
  let student3: { id: string };
  let testClass: { id: string };

  beforeAll(async () => {
    // 1. Create Organization & Branch
    const org = await db.organization.create({
      data: { name: `Transport Test Org ${Date.now()}` },
    });

    const branch = await db.branch.create({
      data: {
        schoolId: (
          await db.school.create({
            data: { name: "Transport Test School", organizationId: org.id },
          })
        ).id,
        name: "Transport Primary Campus",
      },
    });

    const otherBranch = await db.branch.create({
      data: {
        schoolId: (
          await db.school.create({
            data: { name: "Transport Secondary School", organizationId: org.id },
          })
        ).id,
        name: "Transport Isolated Branch",
      },
    });

    const user1 = await db.user.create({
      data: {
        email: `trans-admin-${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Transport",
        lastName: "Admin",
        userType: "STAFF",
        organizationId: org.id,
      },
    });

    const user2 = await db.user.create({
      data: {
        email: `other-admin-${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Other",
        lastName: "Admin",
        userType: "STAFF",
        organizationId: org.id,
      },
    });

    ctx = { branchId: branch.id, userId: user1.id, organizationId: org.id, role: "ADMIN", permissions: ["all"] };
    otherBranchCtx = { branchId: otherBranch.id, userId: user2.id, organizationId: org.id, role: "ADMIN", permissions: ["all"] };

    // 2. Academic Year & Term
    academicYear = await db.academicYear.create({
      data: {
        branchId: branch.id,
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

    // 3. Class & Students
    testClass = await db.class.create({
      data: {
        branchId: branch.id,
        name: "Primary 3",
        capacity: 40,
      },
    });

    student1 = await db.student.create({
      data: {
        branchId: branch.id,
        admissionNo: `TRANS-STU-1-${Date.now()}`,
        firstName: "Alice",
        lastName: "Namubiru",
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
        branchId: branch.id,
        admissionNo: `TRANS-STU-2-${Date.now()}`,
        firstName: "Brian",
        lastName: "Kato",
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

    student3 = await db.student.create({
      data: {
        branchId: branch.id,
        admissionNo: `TRANS-STU-3-${Date.now()}`,
        firstName: "Chloe",
        lastName: "Babirye",
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
  // TRANS-01: Create Route with Stops & Unique Code Constraint
  // -------------------------------------------------------------
  it("TRANS-01: should create a transport route with stops and enforce code uniqueness", async () => {
    const route = await TransportDAO.createRoute(ctx, {
      code: "RT-NTINDA",
      name: "Ntinda - Kisaasi Route",
      description: "Serves Ntinda, Bukoto, and Kisaasi areas",
      destinationZone: "Zone 1 (0-5km)",
      twoWayFee: 450000,
      oneWayFee: 280000,
      academicYearId: academicYear.id,
      termId: term.id,
      stops: [
        { stopName: "Ntinda Complex", sequenceOrder: 1, morningPickupTime: "06:15 AM", eveningDropTime: "05:30 PM", surchargeAmount: 0 },
        { stopName: "Kisaasi Total", sequenceOrder: 2, morningPickupTime: "06:30 AM", eveningDropTime: "05:15 PM", surchargeAmount: 20000 },
      ],
    });

    expect(route.id).toBeDefined();
    expect(route.code).toBe("RT-NTINDA");
    expect(route.stops.length).toBe(2);
    expect(route.stops[1].surchargeAmount.toNumber()).toBe(20000);

    // Duplicate code in same branch and year should throw
    await expect(
      TransportDAO.createRoute(ctx, {
        code: "RT-NTINDA",
        name: "Competing Ntinda Route",
        twoWayFee: 500000,
        oneWayFee: 300000,
        academicYearId: academicYear.id,
      })
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------
  // TRANS-02: Calculate Effective Route Fee with Trip Types & Stops
  // -------------------------------------------------------------
  it("TRANS-02: should calculate effective fees accurately for 2-way and 1-way with surcharges", async () => {
    const routes = await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id });
    const route = routes[0];
    const stopWithSurcharge = route.stops.find((s) => s.surchargeAmount.toNumber() > 0);

    const twoWayStandard = await TransportDAO.calculateRouteFee(ctx, route.id, null, "TWO_WAY");
    expect(twoWayStandard.finalFee.toNumber()).toBe(450000);

    const oneWayStandard = await TransportDAO.calculateRouteFee(ctx, route.id, null, "ONE_WAY_MORNING");
    expect(oneWayStandard.finalFee.toNumber()).toBe(280000);

    const twoWayWithSurcharge = await TransportDAO.calculateRouteFee(ctx, route.id, stopWithSurcharge?.id, "TWO_WAY");
    expect(twoWayWithSurcharge.finalFee.toNumber()).toBe(470000); // 450,000 + 20,000
  });

  // -------------------------------------------------------------
  // TRANS-03: Register Transport Vehicle
  // -------------------------------------------------------------
  it("TRANS-03: should register a transport vehicle with certified capacity and inspection details", async () => {
    const vehicle = await TransportDAO.registerVehicle(ctx, {
      registrationNumber: "UBJ 412X",
      makeModel: "Toyota Coaster 30-Seater",
      capacity: 2, // set low to 2 for capacity test in TRANS-07
      fuelType: "DIESEL",
      status: "ACTIVE",
      insuranceExpiry: new Date("2028-12-31"),
      inspectionDueDate: new Date("2028-12-31"),
      notes: "Main school bus for Ntinda route",
    });

    expect(vehicle.id).toBeDefined();
    expect(vehicle.registrationNumber).toBe("UBJ 412X");
    expect(vehicle.capacity).toBe(2);
  });

  // -------------------------------------------------------------
  // TRANS-04: Register Transport Driver
  // -------------------------------------------------------------
  it("TRANS-04: should register a transport driver and validate license details", async () => {
    const driver = await TransportDAO.registerDriver(ctx, {
      fullName: "John Mukasa",
      phone: "+256772123456",
      licenseNumber: "DL-UG-998822",
      licenseClass: "CM, CH",
      licenseExpiry: new Date("2029-01-01"),
    });

    expect(driver.id).toBeDefined();
    expect(driver.fullName).toBe("John Mukasa");
    expect(driver.isActive).toBe(true);
  });

  // -------------------------------------------------------------
  // TRANS-05: Create Vehicle-Route Assignment with Snapshots
  // -------------------------------------------------------------
  it("TRANS-05: should create vehicle-route assignment freezing vehicle and driver snapshots", async () => {
    const routes = await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id });
    const vehicles = await TransportDAO.listVehicles(ctx);
    const drivers = await TransportDAO.listDrivers(ctx);

    const assignment = await TransportDAO.createVehicleRouteAssignment(ctx, {
      routeId: routes[0].id,
      vehicleId: vehicles[0].id,
      driverId: drivers[0].id,
      academicYearId: academicYear.id,
      termId: term.id,
      isPrimary: true,
    });

    expect(assignment.id).toBeDefined();
    expect(assignment.vehiclePlateSnapshot).toBe("UBJ 412X");
    expect(assignment.vehicleCapacitySnapshot).toBe(2);
    expect(assignment.driverNameSnapshot).toBe("John Mukasa");
  });

  // -------------------------------------------------------------
  // TRANS-06: Enroll Student with Frozen Historical Snapshots
  // -------------------------------------------------------------
  it("TRANS-06: should enroll student in subscription and freeze historical fee snapshots", async () => {
    const routes = await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id });
    const route = routes[0];
    const stop = route.stops[1]; // Kisaasi Total (20,000 surcharge)

    const sub = await TransportDAO.subscribeStudent(ctx, {
      studentId: student1.id,
      routeId: route.id,
      stopId: stop.id,
      academicYearId: academicYear.id,
      termId: term.id,
      subscriptionType: "TWO_WAY",
    });

    expect(sub.id).toBeDefined();
    expect(sub.routeNameSnapshot).toBe("Ntinda - Kisaasi Route");
    expect(sub.stopNameSnapshot).toBe("Kisaasi Total");
    expect(sub.baseFeeSnapshot.toNumber()).toBe(450000);
    expect(sub.stopSurchargeSnapshot.toNumber()).toBe(20000);
    expect(sub.finalFeeAmount.toNumber()).toBe(470000);
  });

  // -------------------------------------------------------------
  // TRANS-07: Capacity Safeguard Blocks Over-Capacity Enrollment
  // -------------------------------------------------------------
  it("TRANS-07: should enforce capacity limit (capacity = 2) and block 3rd subscriber without override", async () => {
    const routes = await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id });
    const route = routes[0];

    // Enroll 2nd student (capacity reaches 2/2)
    const sub2 = await TransportDAO.subscribeStudent(ctx, {
      studentId: student2.id,
      routeId: route.id,
      academicYearId: academicYear.id,
      termId: term.id,
      subscriptionType: "TWO_WAY",
    });
    expect(sub2.id).toBeDefined();

    // 3rd student without override should throw capacity error
    await expect(
      TransportDAO.subscribeStudent(ctx, {
        studentId: student3.id,
        routeId: route.id,
        academicYearId: academicYear.id,
        termId: term.id,
        subscriptionType: "TWO_WAY",
      })
    ).rejects.toThrow(/vehicle capacity/i);
  });

  // -------------------------------------------------------------
  // TRANS-08: Authorize Capacity Override with Justification
  // -------------------------------------------------------------
  it("TRANS-08: should permit capacity override when written justification is provided", async () => {
    const routes = await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id });
    const route = routes[0];

    const sub3 = await TransportDAO.subscribeStudent(ctx, {
      studentId: student3.id,
      routeId: route.id,
      academicYearId: academicYear.id,
      termId: term.id,
      subscriptionType: "TWO_WAY",
      overrideJustification: "Approved by Headteacher for sibling emergency accommodation",
    });

    expect(sub3.id).toBeDefined();
    expect(sub3.overrideJustification).toBe("Approved by Headteacher for sibling emergency accommodation");
  });

  // -------------------------------------------------------------
  // TRANS-09: Generate Morning Passenger Manifest
  // -------------------------------------------------------------
  it("TRANS-09: should generate morning passenger manifest with stops and overload warning", async () => {
    const routes = await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id });
    const route = routes[0];

    const manifest = await TransportDAO.generatePassengerManifest(ctx, {
      routeId: route.id,
      academicYearId: academicYear.id,
      termId: term.id,
      tripType: "MORNING",
    });

    expect(manifest.route.code).toBe("RT-NTINDA");
    expect(manifest.vehicle?.plate).toBe("UBJ 412X");
    expect(manifest.totalPassengers).toBe(3);
    expect(manifest.vehicleCapacity).toBe(2);
    expect(manifest.isOverloaded).toBe(true); // 3 > 2
    expect(manifest.stops.length).toBe(2);
  });

  // -------------------------------------------------------------
  // TRANS-10: Generate Evening Passenger Manifest
  // -------------------------------------------------------------
  it("TRANS-10: should generate evening passenger manifest sorted by stop order", async () => {
    const routes = await TransportDAO.listRoutes(ctx, { academicYearId: academicYear.id });
    const route = routes[0];

    const manifest = await TransportDAO.generatePassengerManifest(ctx, {
      routeId: route.id,
      academicYearId: academicYear.id,
      termId: term.id,
      tripType: "EVENING",
    });

    expect(manifest.tripType).toBe("EVENING");
    expect(manifest.totalPassengers).toBe(3);
  });

  // -------------------------------------------------------------
  // TRANS-11: Batch Bill Transport Fees to Invoices
  // -------------------------------------------------------------
  it("TRANS-11: should batch bill transport subscriptions into invoice items and subledger", async () => {
    const billingResult = await TransportDAO.bulkBillTransportFees(ctx, {
      academicYearId: academicYear.id,
      termId: term.id,
    });

    expect(billingResult.billedCount).toBe(3);
    expect(billingResult.totalBilledAmount.toNumber()).toBeGreaterThan(0);

    // Verify subledger debits exist
    const ledgerEntries = await db.studentLedgerEntry.findMany({
      where: {
        branchId: ctx.branchId,
        studentId: student1.id,
        entryType: "INVOICE_GROSS_CHARGE",
      },
    });
    expect(ledgerEntries.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------
  // TRANS-12: Verify Billing Idempotency
  // -------------------------------------------------------------
  it("TRANS-12: should be idempotent and bill 0 subscriptions on immediate retry", async () => {
    const retryResult = await TransportDAO.bulkBillTransportFees(ctx, {
      academicYearId: academicYear.id,
      termId: term.id,
    });

    expect(retryResult.billedCount).toBe(0);
    expect(retryResult.totalBilledAmount.toNumber()).toBe(0);
  });

  // -------------------------------------------------------------
  // TRANS-13: Cancel Subscription Mid-Term
  // -------------------------------------------------------------
  it("TRANS-13: should cancel subscription non-destructively with mandatory reason", async () => {
    const subs = await TransportDAO.listSubscriptions(ctx, { studentId: student3.id });
    const sub = subs[0];

    const cancelled = await TransportDAO.cancelSubscription(ctx, sub.id, {
      cancellationReason: "Parent relocated to Entebbe",
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancellationReason).toBe("Parent relocated to Entebbe");
  });

  // -------------------------------------------------------------
  // TRANS-14: Log Vehicle Fuel Purchase & Auto-Create Expense
  // -------------------------------------------------------------
  it("TRANS-14: should log vehicle fuel purchase, validate math, and link Expense voucher", async () => {
    const vehicles = await TransportDAO.listVehicles(ctx);
    const vehicle = vehicles[0];

    const fuelLog = await TransportDAO.recordFuelLog(ctx, {
      vehicleId: vehicle.id,
      odometerKm: 45000,
      litersFilled: 50,
      unitPrice: 5200,
      totalCost: 260000, // 50 * 5,200
      fuelStation: "TotalEnergies Ntinda",
      receiptNumber: `PUMP-${Date.now()}`,
      paymentMethod: "CASH",
    });

    expect(fuelLog.id).toBeDefined();
    expect(fuelLog.expenseId).toBeDefined();
    expect(fuelLog.totalCost.toNumber()).toBe(260000);

    // Verify Expense record exists
    const expense = await db.expense.findUnique({ where: { id: fuelLog.expenseId! } });
    expect(expense).toBeDefined();
    expect(expense?.amount.toNumber()).toBe(260000);
  });

  // -------------------------------------------------------------
  // TRANS-15: Fuel Log Updates Vehicle Odometer
  // -------------------------------------------------------------
  it("TRANS-15: should update vehicle current odometer upon fuel logging", async () => {
    const vehicles = await TransportDAO.listVehicles(ctx);
    const vehicle = vehicles[0];

    expect(vehicle.currentOdometerKm).toBe(45000);
  });

  // -------------------------------------------------------------
  // TRANS-16: Log Garage Maintenance & Auto-Create Expense
  // -------------------------------------------------------------
  it("TRANS-16: should log vehicle maintenance, validate parts/labor sum, and link Expense", async () => {
    const vehicles = await TransportDAO.listVehicles(ctx);
    const vehicle = vehicles[0];

    const maintLog = await TransportDAO.recordMaintenanceLog(ctx, {
      vehicleId: vehicle.id,
      maintenanceType: "REPAIR",
      garageName: "Spear Motors Workshop",
      description: "Replaced front brake pads and transmission oil",
      partsCost: 350000,
      laborCost: 100000,
      totalCost: 450000,
      odometerAtService: 45000,
      nextServiceKm: 50000,
      paymentMethod: "BANK_TRANSFER",
    });

    expect(maintLog.id).toBeDefined();
    expect(maintLog.expenseId).toBeDefined();
    expect(maintLog.totalCost.toNumber()).toBe(450000);

    const expense = await db.expense.findUnique({ where: { id: maintLog.expenseId! } });
    expect(expense?.amount.toNumber()).toBe(450000);
  });

  // -------------------------------------------------------------
  // TRANS-17: Void Maintenance Record Synchronously Voids Expense
  // -------------------------------------------------------------
  it("TRANS-17: should void maintenance record and synchronously void linked Expense", async () => {
    const vehicles = await TransportDAO.listVehicles(ctx);
    const vehicle = vehicles[0];

    const tempLog = await TransportDAO.recordMaintenanceLog(ctx, {
      vehicleId: vehicle.id,
      maintenanceType: "TYRES",
      garageName: "City Tyres",
      description: "Accidental duplicate entry for tyres",
      partsCost: 200000,
      laborCost: 0,
      totalCost: 200000,
      paymentMethod: "CASH",
    });

    const voided = await TransportDAO.voidMaintenanceLog(ctx, tempLog.id, {
      voidReason: "Duplicate invoice submitted by driver",
    });

    expect(voided.isVoided).toBe(true);

    const linkedExpense = await db.expense.findUnique({ where: { id: tempLog.expenseId! } });
    expect(linkedExpense?.status).toBe("VOID");
  });

  // -------------------------------------------------------------
  // TRANS-18: Calculate Route Profitability Accurately
  // -------------------------------------------------------------
  it("TRANS-18: should calculate route revenue, direct fuel & maintenance costs, and net margin", async () => {
    const report = await TransportDAO.getRouteProfitabilityReport(ctx, {
      academicYearId: academicYear.id,
      termId: term.id,
    });

    expect(report.summary.totalRoutes).toBe(1);
    expect(report.summary.totalRevenue).toBeGreaterThan(0);
    expect(report.summary.totalFuelCost).toBe(260000);
    expect(report.summary.totalMaintenanceCost).toBe(450000); // 450,000 active (200,000 voided excluded)
    expect(report.routes[0].directCosts).toBe(710000); // 260,000 + 450,000
  });

  // -------------------------------------------------------------
  // TRANS-19: Calculate Fleet Efficiency Metrics (Km/L, Cost/Km)
  // -------------------------------------------------------------
  it("TRANS-19: should calculate fleet metrics and vehicle fuel efficiency", async () => {
    const vehicles = await TransportDAO.listVehicles(ctx);
    const vehicle = vehicles[0];

    // Log 2nd fuel purchase to establish km driven interval
    await TransportDAO.recordFuelLog(ctx, {
      vehicleId: vehicle.id,
      odometerKm: 45500, // 500 km driven
      litersFilled: 50,
      unitPrice: 5200,
      totalCost: 260000,
      fuelStation: "TotalEnergies Kisaasi",
      receiptNumber: `PUMP2-${Date.now()}`,
    });

    const efficiency = await TransportDAO.getFleetEfficiencyReport(ctx);
    const vStat = efficiency.find((v) => v.vehicleId === vehicle.id);

    expect(vStat).toBeDefined();
    expect(vStat?.kmDriven).toBe(500); // 45,500 - 45,000
    expect(vStat?.totalLiters).toBe(100); // 50 + 50
    expect(vStat?.kmPerLiter).toBe(5); // 500 km / 100 L = 5 km/L
  });

  // -------------------------------------------------------------
  // TRANS-20: Strict Multi-Tenant Branch Isolation
  // -------------------------------------------------------------
  it("TRANS-20: should enforce strict multi-tenant branch isolation", async () => {
    const routes = await TransportDAO.listRoutes(ctx);
    const route = routes[0];

    // Querying with other branch context should return empty or error
    const otherRoutes = await TransportDAO.listRoutes(otherBranchCtx);
    expect(otherRoutes.length).toBe(0);

    await expect(TransportDAO.getRouteById(otherBranchCtx, route.id)).rejects.toThrow();
  });
});
