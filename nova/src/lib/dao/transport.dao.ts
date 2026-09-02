import { db } from "../db";
import { Prisma, TransportSubscriptionType, TransportSubscriptionStatus, VehicleStatus, MaintenanceType, PaymentMethod, LedgerEntryType, LedgerDirection } from "@prisma/client";
import { AuditService } from "../services/audit.service";
import { ExpenseDAO } from "./expense.dao";
import { LedgerDAO } from "./ledger.dao";
import { TenantContext } from "./tenant-context";

export interface Context {
  branchId: string;
  userId: string;
  organizationId?: string;
  schoolId?: string;
  role?: string;
  permissions?: string[];
}

function toTenantContext(ctx: Context): TenantContext {
  return {
    branchId: ctx.branchId,
    userId: ctx.userId,
    organizationId: ctx.organizationId || "org-system",
    schoolId: ctx.schoolId || "school-system",
    role: ctx.role || "ADMIN",
    permissions: ctx.permissions && ctx.permissions.length > 0 ? ctx.permissions : ["all"],
  };
}

export class TransportDAO {
  // ==========================================
  // 1. ROUTE MANAGEMENT & PRICING
  // ==========================================

  static async createRoute(
    ctx: Context,
    input: {
      code: string;
      name: string;
      description?: string;
      destinationZone?: string;
      twoWayFee: number | Prisma.Decimal;
      oneWayFee: number | Prisma.Decimal;
      academicYearId: string;
      termId?: string | null;
      stops?: {
        stopName: string;
        landmark?: string;
        sequenceOrder?: number;
        morningPickupTime?: string;
        eveningDropTime?: string;
        surchargeAmount?: number | Prisma.Decimal;
      }[];
    }
  ) {
    const twoWayDecimal = new Prisma.Decimal(input.twoWayFee);
    const oneWayDecimal = new Prisma.Decimal(input.oneWayFee);

    if (twoWayDecimal.isNegative() || oneWayDecimal.isNegative()) {
      throw new Error("Transport fees cannot be negative.");
    }

    const route = await db.transportRoute.create({
      data: {
        branchId: ctx.branchId,
        academicYearId: input.academicYearId,
        termId: input.termId || null,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description,
        destinationZone: input.destinationZone,
        twoWayFee: twoWayDecimal,
        oneWayFee: oneWayDecimal,
        stops: input.stops && input.stops.length > 0
          ? {
              create: input.stops.map((s, idx) => ({
                stopName: s.stopName.trim(),
                landmark: s.landmark,
                sequenceOrder: s.sequenceOrder ?? idx + 1,
                morningPickupTime: s.morningPickupTime,
                eveningDropTime: s.eveningDropTime,
                surchargeAmount: s.surchargeAmount ? new Prisma.Decimal(s.surchargeAmount) : new Prisma.Decimal(0),
              })),
            }
          : undefined,
      },
      include: {
        stops: { orderBy: { sequenceOrder: "asc" } },
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "CREATE_ROUTE",
      "TransportRoute",
      route.id,
      JSON.stringify({
        code: route.code,
        name: route.name,
        twoWayFee: route.twoWayFee.toString(),
        oneWayFee: route.oneWayFee.toString(),
        stopsCount: route.stops.length,
      })
    );

    return route;
  }

  static async updateRoute(
    ctx: Context,
    id: string,
    input: {
      name?: string;
      description?: string;
      destinationZone?: string;
      twoWayFee?: number | Prisma.Decimal;
      oneWayFee?: number | Prisma.Decimal;
      isActive?: boolean;
    }
  ) {
    const route = await db.transportRoute.findUnique({
      where: { id },
    });

    if (!route || route.branchId !== ctx.branchId) {
      throw new Error("Transport route not found or access denied.");
    }

    const data: Prisma.TransportRouteUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.destinationZone !== undefined) data.destinationZone = input.destinationZone;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.twoWayFee !== undefined) {
      const dec = new Prisma.Decimal(input.twoWayFee);
      if (dec.isNegative()) throw new Error("Transport fee cannot be negative.");
      data.twoWayFee = dec;
    }
    if (input.oneWayFee !== undefined) {
      const dec = new Prisma.Decimal(input.oneWayFee);
      if (dec.isNegative()) throw new Error("Transport fee cannot be negative.");
      data.oneWayFee = dec;
    }

    const updated = await db.transportRoute.update({
      where: { id },
      data,
      include: {
        stops: { orderBy: { sequenceOrder: "asc" } },
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "UPDATE_ROUTE",
      "TransportRoute",
      updated.id,
      JSON.stringify(input)
    );

    return updated;
  }

  static async addRouteStop(
    ctx: Context,
    routeId: string,
    input: {
      stopName: string;
      landmark?: string;
      sequenceOrder?: number;
      morningPickupTime?: string;
      eveningDropTime?: string;
      surchargeAmount?: number | Prisma.Decimal;
    }
  ) {
    const route = await db.transportRoute.findUnique({ where: { id: routeId } });
    if (!route || route.branchId !== ctx.branchId) {
      throw new Error("Transport route not found.");
    }

    const surcharge = input.surchargeAmount ? new Prisma.Decimal(input.surchargeAmount) : new Prisma.Decimal(0);
    if (surcharge.isNegative()) throw new Error("Surcharge amount cannot be negative.");

    const stop = await db.transportRouteStop.create({
      data: {
        routeId,
        stopName: input.stopName.trim(),
        landmark: input.landmark,
        sequenceOrder: input.sequenceOrder ?? 1,
        morningPickupTime: input.morningPickupTime,
        eveningDropTime: input.eveningDropTime,
        surchargeAmount: surcharge,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "CREATE_STOP",
      "TransportRouteStop",
      stop.id,
      JSON.stringify({ routeId, stopName: stop.stopName, surcharge: stop.surchargeAmount.toString() })
    );

    return stop;
  }

  static async updateRouteStop(
    ctx: Context,
    stopId: string,
    input: {
      stopName?: string;
      landmark?: string;
      sequenceOrder?: number;
      morningPickupTime?: string;
      eveningDropTime?: string;
      surchargeAmount?: number | Prisma.Decimal;
    }
  ) {
    const stop = await db.transportRouteStop.findUnique({
      where: { id: stopId },
      include: { route: true },
    });

    if (!stop || stop.route.branchId !== ctx.branchId) {
      throw new Error("Route stop not found.");
    }

    const data: Prisma.TransportRouteStopUpdateInput = {};
    if (input.stopName !== undefined) data.stopName = input.stopName.trim();
    if (input.landmark !== undefined) data.landmark = input.landmark;
    if (input.sequenceOrder !== undefined) data.sequenceOrder = input.sequenceOrder;
    if (input.morningPickupTime !== undefined) data.morningPickupTime = input.morningPickupTime;
    if (input.eveningDropTime !== undefined) data.eveningDropTime = input.eveningDropTime;
    if (input.surchargeAmount !== undefined) {
      const dec = new Prisma.Decimal(input.surchargeAmount);
      if (dec.isNegative()) throw new Error("Surcharge cannot be negative.");
      data.surchargeAmount = dec;
    }

    const updated = await db.transportRouteStop.update({
      where: { id: stopId },
      data,
    });

    await AuditService.log(
      toTenantContext(ctx),
      "UPDATE_STOP",
      "TransportRouteStop",
      updated.id,
      JSON.stringify(input)
    );

    return updated;
  }

  static async deleteRouteStop(ctx: Context, stopId: string) {
    const stop = await db.transportRouteStop.findUnique({
      where: { id: stopId },
      include: { route: true },
    });

    if (!stop || stop.route.branchId !== ctx.branchId) {
      throw new Error("Route stop not found.");
    }

    await db.transportRouteStop.delete({ where: { id: stopId } });

    await AuditService.log(
      toTenantContext(ctx),
      "DELETE_STOP",
      "TransportRouteStop",
      stopId,
      JSON.stringify({ routeId: stop.routeId, stopName: stop.stopName })
    );

    return { success: true };
  }

  static async getRouteById(ctx: Context, id: string) {
    const route = await db.transportRoute.findUnique({
      where: { id },
      include: {
        stops: { orderBy: { sequenceOrder: "asc" } },
        assignments: {
          include: {
            vehicle: true,
            driver: true,
          },
        },
        _count: {
          select: {
            subscriptions: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });

    if (!route || route.branchId !== ctx.branchId) {
      throw new Error("Transport route not found.");
    }

    return route;
  }

  static async listRoutes(
    ctx: Context,
    filters?: {
      academicYearId?: string;
      termId?: string;
      isActive?: boolean;
    }
  ) {
    const where: Prisma.TransportRouteWhereInput = {
      branchId: ctx.branchId,
    };

    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.termId) where.termId = filters.termId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return db.transportRoute.findMany({
      where,
      include: {
        stops: { orderBy: { sequenceOrder: "asc" } },
        assignments: {
          where: { isPrimary: true },
          include: {
            vehicle: true,
            driver: true,
          },
        },
        _count: {
          select: {
            subscriptions: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    });
  }

  static async calculateRouteFee(
    ctx: Context,
    routeId: string,
    stopId?: string | null,
    subscriptionType: TransportSubscriptionType = "TWO_WAY"
  ) {
    const route = await db.transportRoute.findUnique({
      where: { id: routeId },
      include: { stops: true },
    });

    if (!route || route.branchId !== ctx.branchId) {
      throw new Error("Transport route not found.");
    }

    const baseFee = subscriptionType === "TWO_WAY" ? route.twoWayFee : route.oneWayFee;
    let surcharge = new Prisma.Decimal(0);

    if (stopId) {
      const stop = route.stops.find((s) => s.id === stopId);
      if (stop) {
        surcharge = stop.surchargeAmount;
      }
    }

    const finalFee = baseFee.add(surcharge);

    return {
      baseFee,
      surcharge,
      finalFee,
      routeName: route.name,
      subscriptionType,
    };
  }

  // ==========================================
  // 2. FLEET & DRIVER DIRECTORY
  // ==========================================

  static async registerVehicle(
    ctx: Context,
    input: {
      registrationNumber: string;
      makeModel: string;
      capacity: number;
      fuelType?: string;
      status?: VehicleStatus;
      insuranceExpiry?: Date | string | null;
      inspectionDueDate?: Date | string | null;
      notes?: string;
    }
  ) {
    if (input.capacity <= 0) {
      throw new Error("Vehicle capacity must be greater than zero.");
    }

    const vehicle = await db.transportVehicle.create({
      data: {
        branchId: ctx.branchId,
        registrationNumber: input.registrationNumber.trim().toUpperCase(),
        makeModel: input.makeModel.trim(),
        capacity: input.capacity,
        fuelType: input.fuelType?.toUpperCase() || "DIESEL",
        status: input.status || "ACTIVE",
        insuranceExpiry: input.insuranceExpiry ? new Date(input.insuranceExpiry) : null,
        inspectionDueDate: input.inspectionDueDate ? new Date(input.inspectionDueDate) : null,
        notes: input.notes,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "REGISTER_VEHICLE",
      "TransportVehicle",
      vehicle.id,
      JSON.stringify({
        plate: vehicle.registrationNumber,
        capacity: vehicle.capacity,
        status: vehicle.status,
      })
    );

    return vehicle;
  }

  static async updateVehicle(
    ctx: Context,
    id: string,
    input: {
      makeModel?: string;
      capacity?: number;
      fuelType?: string;
      status?: VehicleStatus;
      insuranceExpiry?: Date | string | null;
      inspectionDueDate?: Date | string | null;
      currentOdometerKm?: number;
      notes?: string;
    }
  ) {
    const vehicle = await db.transportVehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.branchId !== ctx.branchId) {
      throw new Error("Vehicle not found.");
    }

    const data: Prisma.TransportVehicleUpdateInput = {};
    if (input.makeModel !== undefined) data.makeModel = input.makeModel.trim();
    if (input.capacity !== undefined) {
      if (input.capacity <= 0) throw new Error("Vehicle capacity must be greater than zero.");
      data.capacity = input.capacity;
    }
    if (input.fuelType !== undefined) data.fuelType = input.fuelType.toUpperCase();
    if (input.status !== undefined) data.status = input.status;
    if (input.insuranceExpiry !== undefined) {
      data.insuranceExpiry = input.insuranceExpiry ? new Date(input.insuranceExpiry) : null;
    }
    if (input.inspectionDueDate !== undefined) {
      data.inspectionDueDate = input.inspectionDueDate ? new Date(input.inspectionDueDate) : null;
    }
    if (input.currentOdometerKm !== undefined) {
      if (input.currentOdometerKm < vehicle.currentOdometerKm) {
        throw new Error(`New odometer reading (${input.currentOdometerKm}) cannot be less than current reading (${vehicle.currentOdometerKm}).`);
      }
      data.currentOdometerKm = input.currentOdometerKm;
    }
    if (input.notes !== undefined) data.notes = input.notes;

    const updated = await db.transportVehicle.update({
      where: { id },
      data,
    });

    await AuditService.log(
      toTenantContext(ctx),
      "UPDATE_VEHICLE",
      "TransportVehicle",
      updated.id,
      JSON.stringify(input)
    );

    return updated;
  }

  static async getVehicleById(ctx: Context, id: string) {
    const vehicle = await db.transportVehicle.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            route: true,
            driver: true,
          },
        },
        fuelLogs: {
          orderBy: { logDate: "desc" },
          take: 10,
        },
        maintenanceLogs: {
          orderBy: { maintenanceDate: "desc" },
          take: 10,
        },
      },
    });

    if (!vehicle || vehicle.branchId !== ctx.branchId) {
      throw new Error("Vehicle not found.");
    }

    return vehicle;
  }

  static async listVehicles(ctx: Context, filters?: { status?: VehicleStatus }) {
    const where: Prisma.TransportVehicleWhereInput = { branchId: ctx.branchId };
    if (filters?.status) where.status = filters.status;

    return db.transportVehicle.findMany({
      where,
      include: {
        assignments: {
          where: { isPrimary: true },
          include: { route: true, driver: true },
        },
      },
      orderBy: { registrationNumber: "asc" },
    });
  }

  static async registerDriver(
    ctx: Context,
    input: {
      employeeId?: string | null;
      fullName: string;
      phone: string;
      licenseNumber: string;
      licenseClass: string;
      licenseExpiry?: Date | string | null;
      notes?: string;
    }
  ) {
    if (!input.fullName.trim()) throw new Error("Driver full name is required.");
    if (!input.phone.trim()) throw new Error("Driver phone number is required.");
    if (!input.licenseNumber.trim()) throw new Error("License number is required.");

    if (input.employeeId) {
      const emp = await db.employee.findUnique({ where: { id: input.employeeId } });
      if (!emp || emp.branchId !== ctx.branchId) {
        throw new Error("Linked employee not found or branch mismatch.");
      }
    }

    const driver = await db.transportDriver.create({
      data: {
        branchId: ctx.branchId,
        employeeId: input.employeeId || null,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        licenseNumber: input.licenseNumber.trim().toUpperCase(),
        licenseClass: input.licenseClass.trim().toUpperCase(),
        licenseExpiry: input.licenseExpiry ? new Date(input.licenseExpiry) : null,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "REGISTER_DRIVER",
      "TransportDriver",
      driver.id,
      JSON.stringify({
        name: driver.fullName,
        license: driver.licenseNumber,
        phone: driver.phone,
      })
    );

    return driver;
  }

  static async updateDriver(
    ctx: Context,
    id: string,
    input: {
      employeeId?: string | null;
      fullName?: string;
      phone?: string;
      licenseNumber?: string;
      licenseClass?: string;
      licenseExpiry?: Date | string | null;
      isActive?: boolean;
    }
  ) {
    const driver = await db.transportDriver.findUnique({ where: { id } });
    if (!driver || driver.branchId !== ctx.branchId) {
      throw new Error("Driver not found.");
    }

    const data: Prisma.TransportDriverUpdateInput = {};
    if (input.fullName !== undefined) data.fullName = input.fullName.trim();
    if (input.phone !== undefined) data.phone = input.phone.trim();
    if (input.licenseNumber !== undefined) data.licenseNumber = input.licenseNumber.trim().toUpperCase();
    if (input.licenseClass !== undefined) data.licenseClass = input.licenseClass.trim().toUpperCase();
    if (input.licenseExpiry !== undefined) {
      data.licenseExpiry = input.licenseExpiry ? new Date(input.licenseExpiry) : null;
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.employeeId !== undefined) {
      data.employee = input.employeeId ? { connect: { id: input.employeeId } } : { disconnect: true };
    }

    const updated = await db.transportDriver.update({
      where: { id },
      data,
    });

    await AuditService.log(
      toTenantContext(ctx),
      "UPDATE_DRIVER",
      "TransportDriver",
      updated.id,
      JSON.stringify(input)
    );

    return updated;
  }

  static async listDrivers(ctx: Context, filters?: { isActive?: boolean }) {
    const where: Prisma.TransportDriverWhereInput = { branchId: ctx.branchId };
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return db.transportDriver.findMany({
      where,
      include: { employee: true },
      orderBy: { fullName: "asc" },
    });
  }

  static async createVehicleRouteAssignment(
    ctx: Context,
    input: {
      routeId: string;
      vehicleId: string;
      driverId?: string | null;
      academicYearId: string;
      termId?: string | null;
      isPrimary?: boolean;
      notes?: string;
    }
  ) {
    const route = await db.transportRoute.findUnique({ where: { id: input.routeId } });
    if (!route || route.branchId !== ctx.branchId) {
      throw new Error("Route not found.");
    }

    const vehicle = await db.transportVehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle || vehicle.branchId !== ctx.branchId) {
      throw new Error("Vehicle not found.");
    }

    if (vehicle.status !== "ACTIVE") {
      throw new Error(`Vehicle ${vehicle.registrationNumber} is in status '${vehicle.status}' and cannot be assigned to an active route.`);
    }

    if (vehicle.insuranceExpiry && vehicle.insuranceExpiry < new Date()) {
      throw new Error(`Vehicle ${vehicle.registrationNumber} insurance expired on ${vehicle.insuranceExpiry.toISOString().slice(0, 10)}.`);
    }

    let driverName: string | null = null;
    let driverPhone: string | null = null;

    if (input.driverId) {
      const driver = await db.transportDriver.findUnique({ where: { id: input.driverId } });
      if (!driver || driver.branchId !== ctx.branchId) {
        throw new Error("Driver not found.");
      }
      if (!driver.isActive) {
        throw new Error(`Driver ${driver.fullName} is inactive.`);
      }
      if (driver.licenseExpiry && driver.licenseExpiry < new Date()) {
        throw new Error(`Driver ${driver.fullName} license expired on ${driver.licenseExpiry.toISOString().slice(0, 10)}.`);
      }
      driverName = driver.fullName;
      driverPhone = driver.phone;
    }

    const assignment = await db.vehicleRouteAssignment.create({
      data: {
        branchId: ctx.branchId,
        routeId: input.routeId,
        vehicleId: input.vehicleId,
        driverId: input.driverId || null,
        academicYearId: input.academicYearId,
        termId: input.termId || null,
        isPrimary: input.isPrimary ?? true,
        vehiclePlateSnapshot: vehicle.registrationNumber,
        vehicleCapacitySnapshot: vehicle.capacity,
        driverNameSnapshot: driverName,
        driverPhoneSnapshot: driverPhone,
        notes: input.notes,
      },
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "ASSIGN_VEHICLE_ROUTE",
      "VehicleRouteAssignment",
      assignment.id,
      JSON.stringify({
        routeId: input.routeId,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
      })
    );

    return assignment;
  }

  static async listVehicleRouteAssignments(
    ctx: Context,
    filters?: {
      routeId?: string;
      academicYearId?: string;
      termId?: string;
    }
  ) {
    const where: Prisma.VehicleRouteAssignmentWhereInput = { branchId: ctx.branchId };
    if (filters?.routeId) where.routeId = filters.routeId;
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.termId) where.termId = filters.termId;

    return db.vehicleRouteAssignment.findMany({
      where,
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async deleteVehicleRouteAssignment(ctx: Context, id: string) {
    const assignment = await db.vehicleRouteAssignment.findUnique({ where: { id } });
    if (!assignment || assignment.branchId !== ctx.branchId) {
      throw new Error("Assignment not found.");
    }

    await db.vehicleRouteAssignment.delete({ where: { id } });

    await AuditService.log(
      toTenantContext(ctx),
      "DELETE_ASSIGNMENT",
      "VehicleRouteAssignment",
      id,
      JSON.stringify({ routeId: assignment.routeId, vehicleId: assignment.vehicleId })
    );

    return { success: true };
  }

  // ==========================================
  // 3. STUDENT TRANSPORT SUBSCRIPTIONS
  // ==========================================

  static async subscribeStudent(
    ctx: Context,
    input: {
      studentId: string;
      routeId: string;
      stopId?: string | null;
      academicYearId: string;
      termId?: string | null;
      subscriptionType?: TransportSubscriptionType;
      overrideJustification?: string;
      notes?: string;
    }
  ) {
    const subType = input.subscriptionType || "TWO_WAY";

    return db.$transaction(async (tx) => {
      // 1. Verify student exists in branch
      const student = await tx.student.findUnique({
        where: { id: input.studentId },
      });
      if (!student || student.branchId !== ctx.branchId) {
        throw new Error("Student not found or branch mismatch.");
      }

      // 2. Lock & Verify Route
      const route = await tx.transportRoute.findUnique({
        where: { id: input.routeId },
        include: {
          stops: true,
          assignments: {
            where: { isPrimary: true },
            include: { vehicle: true },
          },
        },
      });

      if (!route || route.branchId !== ctx.branchId) {
        throw new Error("Transport route not found.");
      }

      if (!route.isActive) {
        throw new Error(`Transport route '${route.name}' is currently inactive.`);
      }

      // 3. Stop verification & snapshot
      let stopNameSnapshot: string | null = null;
      let stopSurcharge = new Prisma.Decimal(0);

      if (input.stopId) {
        const stop = route.stops.find((s) => s.id === input.stopId);
        if (!stop) throw new Error("Selected stop does not belong to this route.");
        stopNameSnapshot = stop.stopName;
        stopSurcharge = stop.surchargeAmount;
      }

      const baseFee = subType === "TWO_WAY" ? route.twoWayFee : route.oneWayFee;
      const finalFee = baseFee.add(stopSurcharge);

      // 4. Capacity Verification Invariant
      const primaryAssignment = route.assignments[0];
      if (primaryAssignment && primaryAssignment.vehicle) {
        const certifiedCapacity = primaryAssignment.vehicle.capacity;

        // Count active passengers for trip direction
        const relevantTypes: TransportSubscriptionType[] =
          subType === "TWO_WAY"
            ? ["TWO_WAY", "ONE_WAY_MORNING", "ONE_WAY_EVENING"]
            : subType === "ONE_WAY_MORNING"
            ? ["TWO_WAY", "ONE_WAY_MORNING"]
            : ["TWO_WAY", "ONE_WAY_EVENING"];

        const activeSubscribersCount = await tx.studentTransportSubscription.count({
          where: {
            branchId: ctx.branchId,
            routeId: input.routeId,
            academicYearId: input.academicYearId,
            termId: input.termId || null,
            status: "ACTIVE",
            subscriptionType: { in: relevantTypes },
          },
        });

        if (activeSubscribersCount >= certifiedCapacity && !input.overrideJustification) {
          throw new Error(
            `Cannot enroll student: Route '${route.name}' has reached vehicle capacity (${activeSubscribersCount}/${certifiedCapacity} seats filled). A supervisor override justification is required.`
          );
        }
      }

      // 5. Create Subscription with Frozen Historical Snapshots
      const subscription = await tx.studentTransportSubscription.create({
        data: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          routeId: input.routeId,
          stopId: input.stopId || null,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          subscriptionType: subType,
          status: "ACTIVE",
          routeNameSnapshot: route.name,
          stopNameSnapshot,
          baseFeeSnapshot: baseFee,
          stopSurchargeSnapshot: stopSurcharge,
          finalFeeAmount: finalFee,
          overrideJustification: input.overrideJustification,
          notes: input.notes,
        },
        include: {
          student: true,
          route: true,
          stop: true,
        },
      });

      await AuditService.log(
        toTenantContext(ctx),
        "SUBSCRIBE_STUDENT",
        "StudentTransportSubscription",
        subscription.id,
        JSON.stringify({
          studentId: input.studentId,
          routeId: input.routeId,
          subType,
          fee: finalFee.toString(),
          override: !!input.overrideJustification,
        })
      );

      return subscription;
    });
  }

  static async cancelSubscription(
    ctx: Context,
    id: string,
    input: { cancellationReason: string; notes?: string }
  ) {
    if (!input.cancellationReason.trim()) {
      throw new Error("Cancellation reason is mandatory.");
    }

    const sub = await db.studentTransportSubscription.findUnique({
      where: { id },
      include: { student: true, route: true },
    });

    if (!sub || sub.branchId !== ctx.branchId) {
      throw new Error("Subscription not found.");
    }

    if (sub.status === "CANCELLED") {
      throw new Error("Subscription is already cancelled.");
    }

    const updated = await db.studentTransportSubscription.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancellationReason: input.cancellationReason.trim(),
        endDate: new Date(),
        notes: input.notes ? `${sub.notes || ""}\n${input.notes}`.trim() : sub.notes,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "CANCEL_SUBSCRIPTION",
      "StudentTransportSubscription",
      updated.id,
      JSON.stringify({
        status: "CANCELLED",
        reason: input.cancellationReason,
      })
    );

    return updated;
  }

  static async listSubscriptions(
    ctx: Context,
    filters?: {
      routeId?: string;
      studentId?: string;
      academicYearId?: string;
      termId?: string;
      status?: TransportSubscriptionStatus;
      classId?: string;
    }
  ) {
    const where: Prisma.StudentTransportSubscriptionWhereInput = {
      branchId: ctx.branchId,
    };

    if (filters?.routeId) where.routeId = filters.routeId;
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.termId) where.termId = filters.termId;
    if (filters?.status) where.status = filters.status;
    if (filters?.classId) {
      where.student = { classId: filters.classId };
    }

    return db.studentTransportSubscription.findMany({
      where,
      include: {
        student: {
          include: {
            classRef: true,
            streamRef: true,
          },
        },
        route: true,
        stop: true,
        invoiceItem: {
          include: {
            invoice: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ==========================================
  // 4. PASSENGER MANIFEST GENERATION
  // ==========================================

  static async generatePassengerManifest(
    ctx: Context,
    input: {
      routeId: string;
      academicYearId: string;
      termId?: string | null;
      tripType: "MORNING" | "EVENING";
    }
  ) {
    const route = await db.transportRoute.findUnique({
      where: { id: input.routeId },
      include: {
        stops: { orderBy: { sequenceOrder: "asc" } },
        assignments: {
          where: { isPrimary: true },
          include: { vehicle: true, driver: true },
        },
      },
    });

    if (!route || route.branchId !== ctx.branchId) {
      throw new Error("Transport route not found.");
    }

    const relevantTypes: TransportSubscriptionType[] =
      input.tripType === "MORNING"
        ? ["TWO_WAY", "ONE_WAY_MORNING"]
        : ["TWO_WAY", "ONE_WAY_EVENING"];

    const subscriptions = await db.studentTransportSubscription.findMany({
      where: {
        branchId: ctx.branchId,
        routeId: input.routeId,
        academicYearId: input.academicYearId,
        termId: input.termId || null,
        status: "ACTIVE",
        subscriptionType: { in: relevantTypes },
      },
      include: {
        student: {
          include: {
            classRef: true,
            streamRef: true,
          },
        },
        stop: true,
      },
      orderBy: [
        { stop: { sequenceOrder: "asc" } },
        { student: { lastName: "asc" } },
      ],
    });

    const primaryAssignment = route.assignments[0];
    const vehicleCapacity = primaryAssignment?.vehicle?.capacity || 0;
    const totalPassengers = subscriptions.length;
    const isOverloaded = vehicleCapacity > 0 && totalPassengers > vehicleCapacity;
    const loadFactorPercent = vehicleCapacity > 0 ? (totalPassengers / vehicleCapacity) * 100 : 0;

    // Group students by stop
    const stopsWithStudents = route.stops.map((stop) => {
      const stopStudents = subscriptions.filter((s) => s.stopId === stop.id);
      return {
        stopId: stop.id,
        stopName: stop.stopName,
        landmark: stop.landmark,
        sequenceOrder: stop.sequenceOrder,
        time: input.tripType === "MORNING" ? stop.morningPickupTime : stop.eveningDropTime,
        studentsCount: stopStudents.length,
        students: stopStudents.map((s) => ({
          subscriptionId: s.id,
          studentId: s.student.id,
          admissionNo: s.student.admissionNo,
          studentName: `${s.student.firstName} ${s.student.lastName}`,
          className: s.student.classRef?.name || "N/A",
          streamName: s.student.streamRef?.name || "N/A",
          subscriptionType: s.subscriptionType,
          finalFeeAmount: s.finalFeeAmount.toNumber(),
          isBilled: !!s.invoiceItemId,
        })),
      };
    });

    // Also include students assigned to route with no specific stop
    const unassignedStopStudents = subscriptions.filter((s) => !s.stopId);

    await AuditService.log(
      toTenantContext(ctx),
      "GENERATE_MANIFEST",
      "TransportManifest",
      route.id,
      JSON.stringify({
        routeId: route.id,
        tripType: input.tripType,
        passengersCount: totalPassengers,
        capacity: vehicleCapacity,
        isOverloaded,
      })
    );

    return {
      route: {
        id: route.id,
        code: route.code,
        name: route.name,
        destinationZone: route.destinationZone,
      },
      vehicle: primaryAssignment?.vehicle
        ? {
            id: primaryAssignment.vehicle.id,
            plate: primaryAssignment.vehicle.registrationNumber,
            makeModel: primaryAssignment.vehicle.makeModel,
            capacity: primaryAssignment.vehicle.capacity,
          }
        : null,
      driver: primaryAssignment?.driver
        ? {
            id: primaryAssignment.driver.id,
            name: primaryAssignment.driver.fullName,
            phone: primaryAssignment.driver.phone,
          }
        : null,
      tripType: input.tripType,
      generatedAt: new Date().toISOString(),
      totalPassengers,
      vehicleCapacity,
      loadFactorPercent: Math.round(loadFactorPercent * 10) / 10,
      isOverloaded,
      stops: stopsWithStudents,
      unassignedStopStudents: unassignedStopStudents.map((s) => ({
        subscriptionId: s.id,
        studentId: s.student.id,
        admissionNo: s.student.admissionNo,
        studentName: `${s.student.firstName} ${s.student.lastName}`,
        className: s.student.classRef?.name || "N/A",
      })),
    };
  }

  // ==========================================
  // 5. AUTOMATED TRANSPORT INVOICE BILLING
  // ==========================================

  static async bulkBillTransportFees(
    ctx: Context,
    input: {
      academicYearId: string;
      termId: string;
      routeId?: string;
      dueDate?: Date | string;
    }
  ) {
    return db.$transaction(async (tx) => {
      // 1. Ensure FeeType for TRANSPORT_FEE exists
      let transportFeeType = await tx.feeType.findFirst({
        where: {
          branchId: ctx.branchId,
          code: "TRANSPORT_FEE",
        },
      });

      if (!transportFeeType) {
        transportFeeType = await tx.feeType.create({
          data: {
            branchId: ctx.branchId,
            name: "Transport Fee",
            code: "TRANSPORT_FEE",
            description: "School bus & transport route term charges",
            isActive: true,
          },
        });
      }

      // 2. Find active, unbilled subscriptions
      const where: Prisma.StudentTransportSubscriptionWhereInput = {
        branchId: ctx.branchId,
        academicYearId: input.academicYearId,
        termId: input.termId,
        status: "ACTIVE",
        invoiceItemId: null,
      };

      if (input.routeId) where.routeId = input.routeId;

      const unbilledSubscriptions = await tx.studentTransportSubscription.findMany({
        where,
        include: {
          student: {
            include: {
              enrollments: {
                where: {
                  academicYearId: input.academicYearId,
                  status: "ACTIVE",
                },
                take: 1,
              },
            },
          },
          route: true,
        },
      });

      let billedCount = 0;
      let totalBilledAmount = new Prisma.Decimal(0);
      const invoiceItemIds: string[] = [];

      for (const sub of unbilledSubscriptions) {
        const studentEnrollment = sub.student.enrollments[0];
        if (!studentEnrollment) continue;

        // Deterministic billing key
        const billingKey = `trans-bill-${ctx.branchId}-${sub.studentId}-${input.academicYearId}-${input.termId}-${sub.id}`;

        // Check if active term invoice exists for student
        const invoice = await tx.invoice.findFirst({
          where: {
            branchId: ctx.branchId,
            studentId: sub.studentId,
            academicYearId: input.academicYearId,
            termId: input.termId,
            status: { in: ["PENDING", "PARTIAL", "PAID", "OVERDUE"] },
          },
        });

        const itemTotal = sub.finalFeeAmount;
        const lineDescription = `Transport Fee: ${sub.routeNameSnapshot}${sub.stopNameSnapshot ? ` (${sub.stopNameSnapshot})` : ""} [${sub.subscriptionType}]`;

        if (invoice) {
          // Add line item to existing invoice
          const item = await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              feeTypeId: transportFeeType.id,
              feeTypeName: transportFeeType.name,
              description: lineDescription,
              unitAmount: itemTotal,
              quantity: 1,
              discount: new Prisma.Decimal(0),
              lineTotal: itemTotal,
            },
          });

          // Update invoice gross and net
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              grossAmount: { increment: itemTotal },
              netAmount: { increment: itemTotal },
            },
          });

          // Post debit to subledger via LedgerDAO
          await LedgerDAO.postEntry(tx, {
            branchId: ctx.branchId,
            studentId: sub.studentId,
            academicYearId: input.academicYearId,
            termId: input.termId,
            invoiceId: invoice.id,
            entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
            direction: LedgerDirection.DEBIT,
            amount: itemTotal,
            referenceType: "INVOICE",
            referenceId: item.id,
            description: lineDescription,
            createdById: ctx.userId,
          });

          await tx.studentTransportSubscription.update({
            where: { id: sub.id },
            data: { invoiceItemId: item.id },
          });

          invoiceItemIds.push(item.id);
          billedCount++;
          totalBilledAmount = totalBilledAmount.add(itemTotal);
        } else {
          // Create standalone transport invoice
          const year = new Date().getFullYear();
          const seq = await tx.invoiceSequence.upsert({
            where: { branchId_year: { branchId: ctx.branchId, year } },
            create: { branchId: ctx.branchId, year, lastValue: 1 },
            update: { lastValue: { increment: 1 } },
          });

          const invoiceNumber = `INV-${year}-${String(seq.lastValue).padStart(5, "0")}`;
          const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          const newInvoice = await tx.invoice.create({
            data: {
              branchId: ctx.branchId,
              studentId: sub.studentId,
              enrollmentId: studentEnrollment.id,
              academicYearId: input.academicYearId,
              termId: input.termId,
              invoiceNumber,
              billingKey,
              issueDate: new Date(),
              dueDate,
              grossAmount: itemTotal,
              discountAmount: new Prisma.Decimal(0),
              netAmount: itemTotal,
              status: "PENDING",
              notes: `Auto-generated transport invoice for ${sub.routeNameSnapshot}`,
              items: {
                create: {
                  feeTypeId: transportFeeType.id,
                  feeTypeName: transportFeeType.name,
                  description: lineDescription,
                  unitAmount: itemTotal,
                  quantity: 1,
                  discount: new Prisma.Decimal(0),
                  lineTotal: itemTotal,
                },
              },
            },
            include: { items: true },
          });

          const createdItem = newInvoice.items[0];

          await LedgerDAO.postEntry(tx, {
            branchId: ctx.branchId,
            studentId: sub.studentId,
            academicYearId: input.academicYearId,
            termId: input.termId,
            invoiceId: newInvoice.id,
            entryType: LedgerEntryType.INVOICE_GROSS_CHARGE,
            direction: LedgerDirection.DEBIT,
            amount: itemTotal,
            referenceType: "INVOICE",
            referenceId: createdItem.id,
            description: lineDescription,
            createdById: ctx.userId,
          });

          await tx.studentTransportSubscription.update({
            where: { id: sub.id },
            data: { invoiceItemId: createdItem.id },
          });

          invoiceItemIds.push(createdItem.id);
          billedCount++;
          totalBilledAmount = totalBilledAmount.add(itemTotal);
        }
      }

      await AuditService.log(
        toTenantContext(ctx),
        "BULK_BILL_TRANSPORT",
        "StudentTransportSubscription",
        `${input.academicYearId}-${input.termId}`,
        JSON.stringify({
          academicYearId: input.academicYearId,
          termId: input.termId,
          billedCount,
          totalAmount: totalBilledAmount.toString(),
        })
      );

      return {
        billedCount,
        totalBilledAmount,
        invoiceItemIds,
      };
    });
  }

  // ==========================================
  // 6. FUEL LOGS & EXPENSEDAO INTEGRATION
  // ==========================================

  static async recordFuelLog(
    ctx: Context,
    input: {
      vehicleId: string;
      driverId?: string | null;
      logDate?: Date | string;
      odometerKm: number;
      litersFilled: number | Prisma.Decimal;
      unitPrice: number | Prisma.Decimal;
      totalCost: number | Prisma.Decimal;
      fuelStation: string;
      receiptNumber?: string;
      paymentMethod?: PaymentMethod;
      notes?: string;
      createExpenseVoucher?: boolean;
    }
  ) {
    const vehicle = await db.transportVehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle || vehicle.branchId !== ctx.branchId) {
      throw new Error("Vehicle not found.");
    }

    if (input.odometerKm < vehicle.currentOdometerKm) {
      throw new Error(
        `Odometer reading (${input.odometerKm} km) cannot be less than vehicle current odometer (${vehicle.currentOdometerKm} km).`
      );
    }

    const liters = new Prisma.Decimal(input.litersFilled);
    const price = new Prisma.Decimal(input.unitPrice);
    const total = new Prisma.Decimal(input.totalCost);

    if (liters.lessThanOrEqualTo(0) || price.lessThanOrEqualTo(0) || total.lessThanOrEqualTo(0)) {
      throw new Error("Liters, unit price, and total cost must be positive numbers.");
    }

    const expectedTotal = liters.mul(price);
    const diff = total.sub(expectedTotal).abs();
    if (diff.greaterThan(0.1)) {
      throw new Error(`Total cost (${total}) does not match liters * unitPrice (${expectedTotal}).`);
    }

    let expenseId: string | null = null;

    if (input.createExpenseVoucher !== false) {
      // Find or create Category
      let category = await db.expenseCategory.findFirst({
        where: { branchId: ctx.branchId, code: "TRANSPORT_FUEL" },
      });

      if (!category) {
        category = await db.expenseCategory.create({
          data: {
            branchId: ctx.branchId,
            name: "Transport - Fuel & Lubricants",
            code: "TRANSPORT_FUEL",
            description: "Vehicle fuel, diesel, petrol, and lubricants expenditure",
            isActive: true,
          },
        });
      }

      const expenseResult = await ExpenseDAO.createExpense(toTenantContext(ctx), {
        categoryId: category.id,
        title: `Fuel for ${vehicle.registrationNumber} (${liters}L @ ${price}/L)`,
        amount: total,
        paymentMethod: input.paymentMethod || "CASH",
        vendorName: input.fuelStation.trim(),
        receiptRef: input.receiptNumber,
        notes: `Odometer: ${input.odometerKm} km${input.notes ? ` - ${input.notes}` : ""}`,
      });

      expenseId = expenseResult.expense.id;
    }

    const fuelLog = await db.$transaction(async (tx) => {
      // Update vehicle odometer
      await tx.transportVehicle.update({
        where: { id: input.vehicleId },
        data: { currentOdometerKm: input.odometerKm },
      });

      return tx.vehicleFuelLog.create({
        data: {
          branchId: ctx.branchId,
          vehicleId: input.vehicleId,
          driverId: input.driverId || null,
          expenseId,
          logDate: input.logDate ? new Date(input.logDate) : new Date(),
          odometerKm: input.odometerKm,
          litersFilled: liters,
          unitPrice: price,
          totalCost: total,
          fuelStation: input.fuelStation.trim(),
          receiptNumber: input.receiptNumber?.trim(),
          notes: input.notes,
        },
        include: {
          vehicle: true,
          driver: true,
          expense: true,
        },
      });
    });

    await AuditService.log(
      toTenantContext(ctx),
      "LOG_FUEL",
      "VehicleFuelLog",
      fuelLog.id,
      JSON.stringify({
        vehicleId: input.vehicleId,
        liters: liters.toString(),
        totalCost: total.toString(),
        odometer: input.odometerKm,
        expenseId,
      })
    );

    return fuelLog;
  }

  static async listFuelLogs(
    ctx: Context,
    filters?: {
      vehicleId?: string;
      driverId?: string;
      startDate?: Date | string;
      endDate?: Date | string;
    }
  ) {
    const where: Prisma.VehicleFuelLogWhereInput = { branchId: ctx.branchId };
    if (filters?.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters?.driverId) where.driverId = filters.driverId;
    if (filters?.startDate || filters?.endDate) {
      where.logDate = {};
      if (filters?.startDate) where.logDate.gte = new Date(filters.startDate);
      if (filters?.endDate) where.logDate.lte = new Date(filters.endDate);
    }

    return db.vehicleFuelLog.findMany({
      where,
      include: {
        vehicle: true,
        driver: true,
        expense: true,
      },
      orderBy: { logDate: "desc" },
    });
  }

  // ==========================================
  // 7. MAINTENANCE LOGS & EXPENSEDAO INTEGRATION
  // ==========================================

  static async recordMaintenanceLog(
    ctx: Context,
    input: {
      vehicleId: string;
      maintenanceDate?: Date | string;
      maintenanceType?: MaintenanceType;
      garageName: string;
      description: string;
      partsCost?: number | Prisma.Decimal;
      laborCost?: number | Prisma.Decimal;
      totalCost: number | Prisma.Decimal;
      odometerAtService?: number;
      nextServiceDate?: Date | string | null;
      nextServiceKm?: number | null;
      paymentMethod?: PaymentMethod;
      notes?: string;
      createExpenseVoucher?: boolean;
    }
  ) {
    const vehicle = await db.transportVehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle || vehicle.branchId !== ctx.branchId) {
      throw new Error("Vehicle not found.");
    }

    const parts = input.partsCost ? new Prisma.Decimal(input.partsCost) : new Prisma.Decimal(0);
    const labor = input.laborCost ? new Prisma.Decimal(input.laborCost) : new Prisma.Decimal(0);
    const total = new Prisma.Decimal(input.totalCost);

    if (parts.isNegative() || labor.isNegative() || total.lessThanOrEqualTo(0)) {
      throw new Error("Parts, labor, and total costs cannot be negative.");
    }

    const expectedTotal = parts.add(labor);
    if (!expectedTotal.isZero() && !total.equals(expectedTotal)) {
      throw new Error(`Total cost (${total}) does not match partsCost + laborCost (${expectedTotal}).`);
    }

    let expenseId: string | null = null;

    if (input.createExpenseVoucher !== false) {
      let category = await db.expenseCategory.findFirst({
        where: { branchId: ctx.branchId, code: "VEHICLE_MAINTENANCE" },
      });

      if (!category) {
        category = await db.expenseCategory.create({
          data: {
            branchId: ctx.branchId,
            name: "Vehicle Maintenance & Repairs",
            code: "VEHICLE_MAINTENANCE",
            description: "Fleet servicing, garage repairs, tires, and spares",
            isActive: true,
          },
        });
      }

      const expenseResult = await ExpenseDAO.createExpense(toTenantContext(ctx), {
        categoryId: category.id,
        title: `Maintenance on ${vehicle.registrationNumber}: ${input.description.slice(0, 60)}`,
        amount: total,
        paymentMethod: input.paymentMethod || "BANK_TRANSFER",
        vendorName: input.garageName.trim(),
        notes: `Type: ${input.maintenanceType || "ROUTINE_SERVICE"}${input.notes ? ` - ${input.notes}` : ""}`,
      });

      expenseId = expenseResult.expense.id;
    }

    const log = await db.vehicleMaintenanceLog.create({
      data: {
        branchId: ctx.branchId,
        vehicleId: input.vehicleId,
        expenseId,
        maintenanceDate: input.maintenanceDate ? new Date(input.maintenanceDate) : new Date(),
        maintenanceType: input.maintenanceType || "ROUTINE_SERVICE",
        garageName: input.garageName.trim(),
        description: input.description.trim(),
        partsCost: parts,
        laborCost: labor,
        totalCost: total,
        odometerAtService: input.odometerAtService,
        nextServiceDate: input.nextServiceDate ? new Date(input.nextServiceDate) : null,
        nextServiceKm: input.nextServiceKm,
        notes: input.notes,
      },
      include: {
        vehicle: true,
        expense: true,
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "LOG_MAINTENANCE",
      "VehicleMaintenanceLog",
      log.id,
      JSON.stringify({
        vehicleId: input.vehicleId,
        type: log.maintenanceType,
        totalCost: total.toString(),
        garage: log.garageName,
        expenseId,
      })
    );

    return log;
  }

  static async voidMaintenanceLog(
    ctx: Context,
    id: string,
    input: { voidReason: string }
  ) {
    if (!input.voidReason.trim()) {
      throw new Error("Void reason is mandatory.");
    }

    const log = await db.vehicleMaintenanceLog.findUnique({
      where: { id },
      include: { expense: true },
    });

    if (!log || log.branchId !== ctx.branchId) {
      throw new Error("Maintenance record not found.");
    }

    if (log.isVoided) {
      throw new Error("Maintenance record is already voided.");
    }

    if (log.expenseId) {
      await ExpenseDAO.voidExpense(toTenantContext(ctx), log.expenseId, input.voidReason);
    }

    const updated = await db.vehicleMaintenanceLog.update({
      where: { id },
      data: {
        isVoided: true,
        voidReason: input.voidReason.trim(),
      },
    });

    await AuditService.log(
      toTenantContext(ctx),
      "VOID_MAINTENANCE",
      "VehicleMaintenanceLog",
      updated.id,
      JSON.stringify({ isVoided: true, voidReason: input.voidReason })
    );

    return updated;
  }

  static async listMaintenanceLogs(
    ctx: Context,
    filters?: {
      vehicleId?: string;
      maintenanceType?: MaintenanceType;
      isVoided?: boolean;
    }
  ) {
    const where: Prisma.VehicleMaintenanceLogWhereInput = { branchId: ctx.branchId };
    if (filters?.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters?.maintenanceType) where.maintenanceType = filters.maintenanceType;
    if (filters?.isVoided !== undefined) where.isVoided = filters.isVoided;

    return db.vehicleMaintenanceLog.findMany({
      where,
      include: {
        vehicle: true,
        expense: true,
      },
      orderBy: { maintenanceDate: "desc" },
    });
  }

  // ==========================================
  // 8. ROUTE PROFITABILITY & FLEET ANALYTICS
  // ==========================================

  static async getRouteProfitabilityReport(
    ctx: Context,
    input: {
      academicYearId: string;
      termId?: string;
      routeId?: string;
    }
  ) {
    const whereRoute: Prisma.TransportRouteWhereInput = {
      branchId: ctx.branchId,
      academicYearId: input.academicYearId,
    };
    if (input.termId) whereRoute.termId = input.termId;
    if (input.routeId) whereRoute.id = input.routeId;

    const routes = await db.transportRoute.findMany({
      where: whereRoute,
      include: {
        subscriptions: {
          where: {
            academicYearId: input.academicYearId,
            ...(input.termId ? { termId: input.termId } : {}),
            status: "ACTIVE",
          },
        },
        assignments: {
          where: {
            academicYearId: input.academicYearId,
            ...(input.termId ? { termId: input.termId } : {}),
          },
          include: {
            vehicle: {
              include: {
                fuelLogs: {
                  where: { branchId: ctx.branchId },
                },
                maintenanceLogs: {
                  where: { branchId: ctx.branchId, isVoided: false },
                },
              },
            },
          },
        },
      },
    });

    let branchTotalRevenue = new Prisma.Decimal(0);
    let branchTotalFuelCost = new Prisma.Decimal(0);
    let branchTotalMaintenanceCost = new Prisma.Decimal(0);

    const routeStats = routes.map((r) => {
      // 1. Subscription Billed Revenue
      const routeRevenue = r.subscriptions.reduce(
        (sum, sub) => sum.add(sub.finalFeeAmount),
        new Prisma.Decimal(0)
      );

      // 2. Direct Fuel Costs of assigned vehicles
      let routeFuelCost = new Prisma.Decimal(0);
      let routeMaintenanceCost = new Prisma.Decimal(0);

      for (const assignment of r.assignments) {
        if (assignment.vehicle) {
          for (const fuel of assignment.vehicle.fuelLogs) {
            routeFuelCost = routeFuelCost.add(fuel.totalCost);
          }
          for (const maint of assignment.vehicle.maintenanceLogs) {
            routeMaintenanceCost = routeMaintenanceCost.add(maint.totalCost);
          }
        }
      }

      const directCosts = routeFuelCost.add(routeMaintenanceCost);
      const netContribution = routeRevenue.sub(directCosts);
      const marginPercent = routeRevenue.isZero()
        ? 0
        : netContribution.div(routeRevenue).mul(100).toNumber();

      branchTotalRevenue = branchTotalRevenue.add(routeRevenue);
      branchTotalFuelCost = branchTotalFuelCost.add(routeFuelCost);
      branchTotalMaintenanceCost = branchTotalMaintenanceCost.add(routeMaintenanceCost);

      return {
        routeId: r.id,
        code: r.code,
        name: r.name,
        activeSubscribersCount: r.subscriptions.length,
        revenue: routeRevenue.toNumber(),
        fuelCost: routeFuelCost.toNumber(),
        maintenanceCost: routeMaintenanceCost.toNumber(),
        directCosts: directCosts.toNumber(),
        netContribution: netContribution.toNumber(),
        marginPercent: Math.round(marginPercent * 10) / 10,
      };
    });

    const branchDirectCosts = branchTotalFuelCost.add(branchTotalMaintenanceCost);
    const branchNetContribution = branchTotalRevenue.sub(branchDirectCosts);
    const branchMarginPercent = branchTotalRevenue.isZero()
      ? 0
      : branchNetContribution.div(branchTotalRevenue).mul(100).toNumber();

    return {
      academicYearId: input.academicYearId,
      termId: input.termId || null,
      summary: {
        totalRoutes: routes.length,
        totalRevenue: branchTotalRevenue.toNumber(),
        totalFuelCost: branchTotalFuelCost.toNumber(),
        totalMaintenanceCost: branchTotalMaintenanceCost.toNumber(),
        totalDirectCosts: branchDirectCosts.toNumber(),
        netContribution: branchNetContribution.toNumber(),
        marginPercent: Math.round(branchMarginPercent * 10) / 10,
      },
      routes: routeStats,
    };
  }

  static async getFleetEfficiencyReport(
    ctx: Context,
    filters?: { startDate?: Date | string; endDate?: Date | string }
  ) {
    const vehicles = await db.transportVehicle.findMany({
      where: { branchId: ctx.branchId },
      include: {
        fuelLogs: {
          where: {
            branchId: ctx.branchId,
            ...(filters?.startDate || filters?.endDate
              ? {
                  logDate: {
                    ...(filters?.startDate ? { gte: new Date(filters.startDate) } : {}),
                    ...(filters?.endDate ? { lte: new Date(filters.endDate) } : {}),
                  },
                }
              : {}),
          },
          orderBy: { logDate: "asc" },
        },
        maintenanceLogs: {
          where: {
            branchId: ctx.branchId,
            isVoided: false,
            ...(filters?.startDate || filters?.endDate
              ? {
                  maintenanceDate: {
                    ...(filters?.startDate ? { gte: new Date(filters.startDate) } : {}),
                    ...(filters?.endDate ? { lte: new Date(filters.endDate) } : {}),
                  },
                }
              : {}),
          },
        },
        assignments: {
          where: { isPrimary: true },
          include: {
            route: {
              include: {
                _count: {
                  select: { subscriptions: { where: { status: "ACTIVE" } } },
                },
              },
            },
          },
        },
      },
    });

    return vehicles.map((v) => {
      let totalLiters = new Prisma.Decimal(0);
      let totalFuelCost = new Prisma.Decimal(0);

      for (const f of v.fuelLogs) {
        totalLiters = totalLiters.add(f.litersFilled);
        totalFuelCost = totalFuelCost.add(f.totalCost);
      }

      const totalMaintenanceCost = v.maintenanceLogs.reduce(
        (sum, m) => sum.add(m.totalCost),
        new Prisma.Decimal(0)
      );

      // Km driven calculation from fuel log progression
      let kmDriven = 0;
      if (v.fuelLogs.length >= 2) {
        const firstOdo = v.fuelLogs[0].odometerKm;
        const lastOdo = v.fuelLogs[v.fuelLogs.length - 1].odometerKm;
        kmDriven = Math.max(0, lastOdo - firstOdo);
      }

      const kmPerLiter = !totalLiters.isZero() && kmDriven > 0
        ? kmDriven / totalLiters.toNumber()
        : 0;

      const fuelCostPerKm = kmDriven > 0
        ? totalFuelCost.toNumber() / kmDriven
        : 0;

      const activeSubscribers = v.assignments[0]?.route?._count?.subscriptions || 0;
      const capacityUtilizationPercent = v.capacity > 0
        ? (activeSubscribers / v.capacity) * 100
        : 0;

      return {
        vehicleId: v.id,
        registrationNumber: v.registrationNumber,
        makeModel: v.makeModel,
        capacity: v.capacity,
        status: v.status,
        currentOdometerKm: v.currentOdometerKm,
        kmDriven,
        totalLiters: totalLiters.toNumber(),
        totalFuelCost: totalFuelCost.toNumber(),
        totalMaintenanceCost: totalMaintenanceCost.toNumber(),
        totalOperatingCost: totalFuelCost.add(totalMaintenanceCost).toNumber(),
        kmPerLiter: Math.round(kmPerLiter * 100) / 100,
        fuelCostPerKm: Math.round(fuelCostPerKm),
        activeSubscribers,
        capacityUtilizationPercent: Math.round(capacityUtilizationPercent * 10) / 10,
      };
    });
  }
}
