import { db } from "../db";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { Prisma } from "@prisma/client";

export class StudentDAO {
  /**
   * Retrieves all students for the current tenant branch.
   */
  static async getStudents(ctx: TenantContext, params?: { skip?: number; take?: number; search?: string }) {
    if (!ctx.branchId) throw new UnauthorizedError("Branch scope required to fetch students.");

    const where: Prisma.StudentWhereInput = {
      branchId: ctx.branchId, // ENFORCED TENANT ISOLATION
      ...(params?.search && {
        OR: [
          { firstName: { contains: params.search, mode: "insensitive" } },
          { lastName: { contains: params.search, mode: "insensitive" } },
          { admissionNo: { contains: params.search, mode: "insensitive" } },
        ],
      }),
    };

    const [total, students] = await Promise.all([
      db.student.count({ where }),
      db.student.findMany({
        where,
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        include: {
          classRef: true,
          streamRef: true,
        },
      }),
    ]);

    return { total, students };
  }

  /**
   * Creates a new student ensuring it belongs to the current tenant branch.
   */
  static async createStudent(ctx: TenantContext, data: {
    firstName: string;
    lastName: string;
    admissionNo: string;
    classId?: string;
    streamId?: string;
  }) {
    if (!ctx.branchId) throw new UnauthorizedError("Branch scope required to create a student.");

    return db.student.create({
      data: {
        ...data,
        branchId: ctx.branchId, // ENFORCED TENANT ISOLATION
      },
    });
  }
}
