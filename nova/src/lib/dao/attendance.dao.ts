import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AttendanceStatus } from "@prisma/client";
import { SettingsDAO } from "./settings.dao";

export class AttendanceDAO {
  /**
   * Retrieves active classes for the current branch.
   */
  static async getClasses(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError();
    return db.class.findMany({
      where: { branchId: ctx.branchId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Retrieves students for a given class and their attendance for a specific date.
   */
  static async getStudentsWithAttendance(ctx: TenantContext, classId: string, date: Date) {
    if (!ctx.branchId) throw new UnauthorizedError();

    // Verify class belongs to branch
    const classInfo = await db.class.findFirst({
      where: { id: classId, branchId: ctx.branchId }
    });

    if (!classInfo) {
      throw new UnauthorizedError("Class not found or access denied.");
    }

    // Find the academic year that covers the requested date
    const academicYear = await db.academicYear.findFirst({
      where: {
        branchId: ctx.branchId,
        startDate: { lte: date },
        endDate: { gte: date }
      }
    });

    // If no specific year matches the date (e.g. out of bounds), fallback to the currently active one
    let activeYear = academicYear;
    if (!activeYear) {
      const activeContext = await SettingsDAO.getActiveContext(ctx.branchId);
      activeYear = activeContext.academicYear;
    }

    if (!activeYear) {
      throw new Error("No valid academic year found for this date.");
    }

    const students = await db.student.findMany({
      where: {
        branchId: ctx.branchId,
        enrollments: {
          some: {
            classId: classId,
            academicYearId: activeYear.id,
            status: 'ACTIVE'
          }
        }
      },
      include: {
        attendance: {
          where: { date: date }
        }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    return students;
  }

  /**
   * Saves attendance records for a class on a specific date.
   * Enforces the daily uniqueness rule using upsert.
   */
  static async saveAttendance(
    ctx: TenantContext,
    classId: string,
    date: Date,
    records: { studentId: string; status: AttendanceStatus }[]
  ) {
    if (!ctx.branchId) throw new UnauthorizedError();

    // Verify class belongs to branch
    const classInfo = await db.class.findFirst({
      where: { id: classId, branchId: ctx.branchId }
    });

    if (!classInfo) {
      throw new UnauthorizedError("Class not found or access denied.");
    }

    // Verify all students belong to the branch
    const studentIds = records.map(r => r.studentId);
    const validStudents = await db.student.count({
      where: {
        id: { in: studentIds },
        branchId: ctx.branchId
      }
    });

    if (validStudents !== studentIds.length) {
      throw new UnauthorizedError("One or more students do not belong to this branch.");
    }

    // Use transaction for consistency and audit logging
    await db.$transaction(async (tx) => {
      for (const record of records) {
        await tx.dailyAttendanceRecord.upsert({
          where: {
            studentId_date: {
              studentId: record.studentId,
              date: date,
            }
          },
          update: {
            status: record.status,
          },
          create: {
            studentId: record.studentId,
            date: date,
            status: record.status,
          }
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "SAVE_ATTENDANCE",
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          schoolId: ctx.schoolId,
          branchId: ctx.branchId,
          resourceType: "DailyAttendanceRecord",
          details: `Saved attendance for class ${classId} on ${date.toISOString().split('T')[0]}. Records: ${records.length}`,
        }
      });
    });
  }
}
