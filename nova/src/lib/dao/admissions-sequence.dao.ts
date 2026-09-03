import { Prisma } from "@prisma/client";
import { db } from "../db";
import crypto from "crypto";

export type AdmissionSequenceType = 'APP' | 'ADM' | 'GRD' | 'FAM';

export class AdmissionSequenceDAO {
  /**
   * Generates the next sequential number atomically using PostgreSQL ON CONFLICT DO UPDATE.
   * Guarantees collision-free sequences across branches and global constraints.
   */
  static async getNextSequence(
    branchId: string,
    type: AdmissionSequenceType,
    year: number = new Date().getFullYear(),
    txClient?: Prisma.TransactionClient
  ): Promise<string> {
    const client = txClient || db;
    const id = crypto.randomUUID();

    const result = await client.$queryRaw<Array<{ lastValue: number }>>`
      INSERT INTO "AdmissionSequence" ("id", "branchId", "type", "year", "lastValue", "updatedAt")
      VALUES (${id}, ${branchId}, ${type}, ${year}, 1, NOW())
      ON CONFLICT ("branchId", "type", "year")
      DO UPDATE SET "lastValue" = "AdmissionSequence"."lastValue" + 1, "updatedAt" = NOW()
      RETURNING "lastValue";
    `;

    let seq = result[0]?.lastValue ?? 1;
    let padded = seq.toString().padStart(5, '0');

    switch (type) {
      case 'APP':
        return `APP-${year}-${padded}`;
      case 'ADM': {
        // Enforce global collision-free uniqueness against legacy Student.admissionNo
        let candidate = `ADM-${year}-${padded}`;
        let exists = await client.student.findUnique({ where: { admissionNo: candidate } });
        while (exists) {
          seq++;
          padded = seq.toString().padStart(5, '0');
          candidate = `ADM-${year}-${padded}`;
          await client.$executeRaw`
            UPDATE "AdmissionSequence"
            SET "lastValue" = ${seq}, "updatedAt" = NOW()
            WHERE "branchId" = ${branchId} AND "type" = ${type} AND "year" = ${year};
          `;
          exists = await client.student.findUnique({ where: { admissionNo: candidate } });
        }
        return candidate;
      }
      case 'GRD':
        return `GRD-${padded}`;
      case 'FAM':
        return `FAM-${padded}`;
      default:
        return `${type}-${year}-${padded}`;
    }
  }
}
