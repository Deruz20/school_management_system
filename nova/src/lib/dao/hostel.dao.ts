import { db } from "../db";
import {
  Prisma,
  HostelGender,
  RoomType,
  BedType,
  BedStatus,
  BedAllocationStatus,
  RollCallStatus,
} from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";
import { InvoiceDAO } from "./invoice.dao";

export interface CreateHostelInput {
  code: string;
  name: string;
  gender: HostelGender;
  capacity?: number;
  wardenId?: string;
  matronId?: string;
  description?: string;
}

export interface CreateRoomInput {
  hostelId: string;
  roomNumber: string;
  floorNumber?: number;
  wing?: string;
  roomType?: RoomType;
  capacity: number;
}

export interface CreateBedInput {
  roomId: string;
  bedNumber: string;
  bedType?: BedType;
}

export interface AllocateBedInput {
  studentId: string;
  bedId: string;
  academicYearId: string;
  termId?: string;
  notes?: string;
}

export interface TransferBedInput {
  allocationId: string;
  targetBedId: string;
  notes?: string;
}

export interface RecordRollCallItem {
  studentId: string;
  status: RollCallStatus;
  remarks?: string;
}

export interface RecordHostelClearanceInput {
  studentId: string;
  academicYearId: string;
  termId?: string;
  mattressReturned: boolean;
  roomKeysReturned: boolean;
  lockerKeysReturned: boolean;
  bunkConditionIntact: boolean;
  damagesNoted: boolean;
  damageCostUGX?: number | Prisma.Decimal;
  damageDescription?: string;
}

export class HostelDAO {
  private static checkPermission(ctx: TenantContext, requiredPermission: string) {
    if (!ctx.branchId || !ctx.userId) {
      throw new UnauthorizedError("Branch scope and authenticated user required.");
    }
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('boarding:admin') ||
      perms.includes(requiredPermission)
    ) {
      return true;
    }
    throw new UnauthorizedError(`Missing required permission: ${requiredPermission}`);
  }

  // ==========================================
  // HOSTELS
  // ==========================================

  static async createHostel(ctx: TenantContext, input: CreateHostelInput) {
    this.checkPermission(ctx, 'boarding:write');

    const hostel = await db.hostel.create({
      data: {
        branchId: ctx.branchId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        gender: input.gender,
        capacity: input.capacity ?? 0,
        wardenId: input.wardenId || null,
        matronId: input.matronId || null,
        description: input.description || null,
      }
    });

    await AuditService.log(
      ctx,
      'boarding.hostel_created',
      'Hostel',
      hostel.id,
      JSON.stringify({ code: hostel.code, name: hostel.name, gender: hostel.gender })
    );

    return hostel;
  }

  static async getHostels(ctx: TenantContext, filters?: { gender?: HostelGender; isActive?: boolean }) {
    this.checkPermission(ctx, 'boarding:read');

    return db.hostel.findMany({
      where: {
        branchId: ctx.branchId,
        ...(filters?.gender ? { gender: filters.gender } : {}),
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      include: {
        warden: { select: { id: true, firstName: true, lastName: true, email: true } },
        matron: { select: { id: true, firstName: true, lastName: true, email: true } },
        rooms: {
          include: {
            beds: {
              select: { id: true, status: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  static async getHostelById(ctx: TenantContext, id: string) {
    this.checkPermission(ctx, 'boarding:read');

    const hostel = await db.hostel.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        warden: { select: { id: true, firstName: true, lastName: true, email: true } },
        matron: { select: { id: true, firstName: true, lastName: true, email: true } },
        rooms: {
          include: {
            beds: {
              include: {
                allocations: {
                  where: { status: BedAllocationStatus.ACTIVE },
                  include: {
                    student: { select: { id: true, admissionNo: true, firstName: true, lastName: true, gender: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!hostel) throw new Error("Hostel not found in this branch.");
    return hostel;
  }

  // ==========================================
  // ROOMS & BEDS
  // ==========================================

  static async createRoom(ctx: TenantContext, input: CreateRoomInput) {
    this.checkPermission(ctx, 'boarding:write');

    const hostel = await db.hostel.findFirst({
      where: { id: input.hostelId, branchId: ctx.branchId }
    });
    if (!hostel) throw new Error("Hostel not found in this branch.");

    const room = await db.hostelRoom.create({
      data: {
        branchId: ctx.branchId,
        hostelId: input.hostelId,
        roomNumber: input.roomNumber.trim(),
        floorNumber: input.floorNumber ?? 0,
        wing: input.wing?.trim() || null,
        roomType: input.roomType ?? RoomType.STANDARD_DORM,
        capacity: input.capacity,
      }
    });

    await AuditService.log(
      ctx,
      'boarding.room_created',
      'HostelRoom',
      room.id,
      JSON.stringify({ hostelId: room.hostelId, roomNumber: room.roomNumber })
    );

    return room;
  }

  static async createBed(ctx: TenantContext, input: CreateBedInput) {
    this.checkPermission(ctx, 'boarding:write');

    const room = await db.hostelRoom.findFirst({
      where: { id: input.roomId, branchId: ctx.branchId },
      include: { hostel: true }
    });
    if (!room) throw new Error("Room not found in this branch.");

    const bedCode = `${room.hostel.code}-${room.roomNumber}-${input.bedNumber.trim()}`;

    const bed = await db.hostelBed.create({
      data: {
        branchId: ctx.branchId,
        roomId: input.roomId,
        bedNumber: input.bedNumber.trim(),
        bedCode,
        bedType: input.bedType ?? BedType.BUNK_LOWER,
        status: BedStatus.AVAILABLE,
      }
    });

    await AuditService.log(
      ctx,
      'boarding.bed_created',
      'HostelBed',
      bed.id,
      JSON.stringify({ roomId: bed.roomId, bedCode: bed.bedCode })
    );

    return bed;
  }

  // ==========================================
  // BED ALLOCATION & CONCURRENCY ENGINE
  // ==========================================

  /**
   * Concurrency-safe bed allocation using PostgreSQL row-level locks.
   * Guarantees:
   * 1. Exactly one student occupies a bed.
   * 2. Exactly one active bed allocation per student per term/year.
   */
  static async allocateBed(ctx: TenantContext, input: AllocateBedInput) {
    this.checkPermission(ctx, 'boarding:allocate');

    return db.$transaction(async (tx) => {
      // 1. Acquire row-level lock on the bed
      const [lockedBed] = await tx.$queryRaw<Array<{ id: string; status: BedStatus; roomId: string }>>`
        SELECT id, status, "roomId"
        FROM "HostelBed"
        WHERE id = ${input.bedId} AND "branchId" = ${ctx.branchId}
        FOR UPDATE
      `;

      if (!lockedBed) {
        throw new Error("Bed not found in this branch.");
      }

      if (lockedBed.status !== BedStatus.AVAILABLE) {
        throw new Error(`Bed is not available for allocation (current status: ${lockedBed.status}).`);
      }

      // 2. Validate Student exists in branch
      const student = await tx.student.findFirst({
        where: { id: input.studentId, branchId: ctx.branchId }
      });
      if (!student) {
        throw new Error("Student not found in this branch.");
      }

      // 3. Verify Room and Hostel gender compatibility
      const room = await tx.hostelRoom.findUniqueOrThrow({
        where: { id: lockedBed.roomId },
        include: { hostel: true }
      });

      if (room.hostel.gender !== HostelGender.MIXED) {
        const studentGender = student.gender?.toUpperCase();
        if (studentGender && (
          (room.hostel.gender === HostelGender.MALE && studentGender !== 'MALE') ||
          (room.hostel.gender === HostelGender.FEMALE && studentGender !== 'FEMALE')
        )) {
          throw new Error(`Gender mismatch: Student is ${studentGender} but hostel is designated for ${room.hostel.gender}.`);
        }
      }

      // 4. Verify Student does not already have an active allocation for this year/term
      const existingAllocation = await tx.bedAllocation.findFirst({
        where: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          ...(input.termId ? { termId: input.termId } : {}),
          status: BedAllocationStatus.ACTIVE,
        }
      });

      if (existingAllocation) {
        throw new Error("Student already has an active bed allocation for this academic period.");
      }

      // 5. Update Bed Status to OCCUPIED
      await tx.hostelBed.update({
        where: { id: input.bedId },
        data: { status: BedStatus.OCCUPIED }
      });

      // 6. Create BedAllocation record
      const allocation = await tx.bedAllocation.create({
        data: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          bedId: input.bedId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          allocatedAt: new Date(),
          status: BedAllocationStatus.ACTIVE,
          allocatedById: ctx.userId,
          notes: input.notes || null,
        },
        include: {
          bed: { include: { room: { include: { hostel: true } } } },
          student: true,
        }
      });

      // 7. Audit Log
      await AuditService.log(
        ctx,
        'boarding.bed_allocated',
        'BedAllocation',
        allocation.id,
        JSON.stringify({
          studentId: allocation.studentId,
          bedId: allocation.bedId,
          bedCode: allocation.bed.bedCode,
          academicYearId: allocation.academicYearId,
        })
      );

      return allocation;
    });
  }

  /**
   * Transfers a student from their current bed to a new bed atomically.
   */
  static async transferBed(ctx: TenantContext, input: TransferBedInput) {
    this.checkPermission(ctx, 'boarding:allocate');

    return db.$transaction(async (tx) => {
      // 1. Fetch current allocation
      const currentAllocation = await tx.bedAllocation.findFirst({
        where: { id: input.allocationId, branchId: ctx.branchId, status: BedAllocationStatus.ACTIVE }
      });
      if (!currentAllocation) {
        throw new Error("Active bed allocation not found.");
      }

      // 2. Lock both beds in deterministic order to prevent deadlocks
      const [firstBedId, secondBedId] = [currentAllocation.bedId, input.targetBedId].sort();
      await tx.$queryRaw`
        SELECT id FROM "HostelBed" WHERE id IN (${firstBedId}, ${secondBedId}) AND "branchId" = ${ctx.branchId} FOR UPDATE
      `;

      // 3. Verify target bed is AVAILABLE
      const targetBed = await tx.hostelBed.findUniqueOrThrow({
        where: { id: input.targetBedId },
        include: { room: { include: { hostel: true } } }
      });
      if (targetBed.status !== BedStatus.AVAILABLE) {
        throw new Error(`Target bed is not available (status: ${targetBed.status}).`);
      }

      // 4. Release old bed
      await tx.hostelBed.update({
        where: { id: currentAllocation.bedId },
        data: { status: BedStatus.AVAILABLE }
      });

      // 5. Mark old allocation TRANSFERRED
      await tx.bedAllocation.update({
        where: { id: currentAllocation.id },
        data: {
          status: BedAllocationStatus.TRANSFERRED,
          releasedAt: new Date(),
          releasedById: ctx.userId,
          notes: input.notes ? `${currentAllocation.notes || ''}\nTransfer Note: ${input.notes}`.trim() : currentAllocation.notes,
        }
      });

      // 6. Occupy target bed
      await tx.hostelBed.update({
        where: { id: input.targetBedId },
        data: { status: BedStatus.OCCUPIED }
      });

      // 7. Create new allocation for target bed
      const newAllocation = await tx.bedAllocation.create({
        data: {
          branchId: ctx.branchId,
          studentId: currentAllocation.studentId,
          bedId: input.targetBedId,
          academicYearId: currentAllocation.academicYearId,
          termId: currentAllocation.termId,
          allocatedAt: new Date(),
          status: BedAllocationStatus.ACTIVE,
          allocatedById: ctx.userId,
          notes: `Transferred from bed ${currentAllocation.bedId}. ${input.notes || ''}`.trim(),
        },
        include: {
          bed: { include: { room: { include: { hostel: true } } } },
          student: true,
        }
      });

      // 8. Audit Log
      await AuditService.log(
        ctx,
        'boarding.bed_transferred',
        'BedAllocation',
        newAllocation.id,
        JSON.stringify({
          studentId: currentAllocation.studentId,
          fromBedId: currentAllocation.bedId,
          toBedId: input.targetBedId,
        })
      );

      return newAllocation;
    });
  }

  /**
   * Releases an active bed allocation, freeing the bed for other students.
   */
  static async releaseBed(ctx: TenantContext, allocationId: string, notes?: string) {
    this.checkPermission(ctx, 'boarding:allocate');

    return db.$transaction(async (tx) => {
      const allocation = await tx.bedAllocation.findFirst({
        where: { id: allocationId, branchId: ctx.branchId, status: BedAllocationStatus.ACTIVE }
      });
      if (!allocation) throw new Error("Active bed allocation not found.");

      // Lock bed
      await tx.$queryRaw`
        SELECT id FROM "HostelBed" WHERE id = ${allocation.bedId} FOR UPDATE
      `;

      // Free bed
      await tx.hostelBed.update({
        where: { id: allocation.bedId },
        data: { status: BedStatus.AVAILABLE }
      });

      // Update allocation record
      const updated = await tx.bedAllocation.update({
        where: { id: allocation.id },
        data: {
          status: BedAllocationStatus.RELEASED,
          releasedAt: new Date(),
          releasedById: ctx.userId,
          notes: notes ? `${allocation.notes || ''}\nRelease Note: ${notes}`.trim() : allocation.notes,
        }
      });

      await AuditService.log(
        ctx,
        'boarding.bed_released',
        'BedAllocation',
        updated.id,
        JSON.stringify({ studentId: updated.studentId, bedId: updated.bedId })
      );

      return updated;
    });
  }

  // ==========================================
  // HOSTEL ROLL CALL
  // ==========================================

  static async recordRollCall(
    ctx: TenantContext,
    hostelId: string,
    date: Date | string,
    items: RecordRollCallItem[]
  ) {
    this.checkPermission(ctx, 'boarding:write');

    const hostel = await db.hostel.findFirst({
      where: { id: hostelId, branchId: ctx.branchId }
    });
    if (!hostel) throw new Error("Hostel not found in this branch.");

    const rollCallDate = new Date(date);
    rollCallDate.setUTCHours(0, 0, 0, 0);

    const results = await db.$transaction(async (tx) => {
      const records = [];
      for (const item of items) {
        const record = await tx.hostelRollCall.upsert({
          where: {
            hostelId_studentId_date: {
              hostelId,
              studentId: item.studentId,
              date: rollCallDate,
            }
          },
          create: {
            branchId: ctx.branchId,
            hostelId,
            studentId: item.studentId,
            date: rollCallDate,
            status: item.status,
            remarks: item.remarks || null,
            takenById: ctx.userId,
          },
          update: {
            status: item.status,
            remarks: item.remarks || null,
            takenById: ctx.userId,
          }
        });
        records.push(record);
      }
      return records;
    });

    await AuditService.log(
      ctx,
      'boarding.roll_call_recorded',
      'HostelRollCall',
      hostelId,
      JSON.stringify({ count: items.length, date: rollCallDate })
    );

    return results;
  }

  // ==========================================
  // HOSTEL CLEARANCE & DAMAGE SURCHARGE
  // ==========================================

  /**
   * End-of-term physical hostel clearance checklist.
   * If damages are noted with monetary cost:
   * 1. Creates an invoice via InvoiceDAO (Student AR Account #1200).
   * 2. Physical clearance is REJECTED until financial settlement.
   */
  static async recordHostelClearance(ctx: TenantContext, input: RecordHostelClearanceInput) {
    this.checkPermission(ctx, 'boarding:clear');

    let invoiceId: string | null = null;
    const damageCostUGX = input.damageCostUGX ? Number(input.damageCostUGX) : 0;

    if (input.damagesNoted && damageCostUGX > 0) {
      // Fetch active enrollment for the student
      const activeEnrollment = await db.enrollment.findFirst({
        where: {
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          status: 'ACTIVE'
        }
      });

      if (!activeEnrollment) {
        throw new Error("Student has no active enrollment to attach damage surcharge invoice.");
      }

      // Bill damage surcharge through InvoiceDAO
      const invoice = await InvoiceDAO.createIndividualInvoice(
        ctx,
        {
          studentId: input.studentId,
          enrollmentId: activeEnrollment.id,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          dueDate: new Date(),
          notes: `Hostel Damage Surcharge: ${input.damageDescription || 'Hostel property repairs'}`,
          items: [
            {
              feeTypeName: "Hostel Property Damage Surcharge",
              description: input.damageDescription || "Hostel property damage surcharge",
              unitAmount: new Prisma.Decimal(damageCostUGX),
              quantity: 1,
            }
          ]
        }
      );

      invoiceId = invoice.id;
    }

    return db.$transaction(async (tx) => {
      // Check all clearance criteria
      const allIntact =
        input.mattressReturned &&
        input.roomKeysReturned &&
        input.lockerKeysReturned &&
        input.bunkConditionIntact &&
        !input.damagesNoted;

      const clearanceStatus = allIntact ? "CLEARED" : "REJECTED";

      const clearanceRecord = await tx.hostelClearanceRecord.upsert({
        where: {
          studentId_academicYearId_termId: {
            studentId: input.studentId,
            academicYearId: input.academicYearId,
            termId: input.termId || "",
          }
        },
        create: {
          branchId: ctx.branchId,
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          termId: input.termId || null,
          mattressReturned: input.mattressReturned,
          roomKeysReturned: input.roomKeysReturned,
          lockerKeysReturned: input.lockerKeysReturned,
          bunkConditionIntact: input.bunkConditionIntact,
          damagesNoted: input.damagesNoted,
          damageCostUGX: damageCostUGX > 0 ? new Prisma.Decimal(damageCostUGX) : null,
          damageDescription: input.damageDescription || null,
          invoiceId,
          status: clearanceStatus,
          inspectorStaffId: ctx.userId,
          inspectedAt: new Date(),
        },
        update: {
          mattressReturned: input.mattressReturned,
          roomKeysReturned: input.roomKeysReturned,
          lockerKeysReturned: input.lockerKeysReturned,
          bunkConditionIntact: input.bunkConditionIntact,
          damagesNoted: input.damagesNoted,
          damageCostUGX: damageCostUGX > 0 ? new Prisma.Decimal(damageCostUGX) : null,
          damageDescription: input.damageDescription || null,
          invoiceId,
          status: clearanceStatus,
          inspectorStaffId: ctx.userId,
          inspectedAt: new Date(),
        }
      });

      await AuditService.log(
        ctx,
        'boarding.clearance_recorded',
        'HostelClearanceRecord',
        clearanceRecord.id,
        JSON.stringify({
          studentId: clearanceRecord.studentId,
          status: clearanceRecord.status,
          damagesNoted: clearanceRecord.damagesNoted,
          invoiceId,
        })
      );

      return clearanceRecord;
    });
  }
}
