import { Prisma } from "@prisma/client";
import { db } from "../db";
import crypto from "crypto";

export type WelfareSequenceType = 'CLN' | 'DISC' | 'EXT' | 'BED';

export class WelfareSequenceDAO {
  /**
   * Generates the next sequential number atomically using PostgreSQL ON CONFLICT DO UPDATE.
   * Guarantees collision-free sequences across branches.
   */
  static async getNextSequence(
    branchId: string,
    type: WelfareSequenceType,
    year: number = new Date().getFullYear(),
    txClient?: Prisma.TransactionClient
  ): Promise<string> {
    const client = txClient || db;
    const id = crypto.randomUUID();

    const result = await client.$queryRaw<Array<{ nextVal: number }>>`
      INSERT INTO "WelfareSequence" ("id", "branchId", "type", "year", "nextVal", "updatedAt")
      VALUES (${id}, ${branchId}, ${type}, ${year}, 1, NOW())
      ON CONFLICT ("branchId", "type", "year")
      DO UPDATE SET "nextVal" = "WelfareSequence"."nextVal" + 1, "updatedAt" = NOW()
      RETURNING "nextVal";
    `;

    const seq = result[0]?.nextVal ?? 1;
    const padded = seq.toString().padStart(5, '0');

    switch (type) {
      case 'CLN':
        return `CLN-${year}-${padded}`;
      case 'DISC':
        return `DISC-${year}-${padded}`;
      case 'EXT':
        return `EXT-${year}-${padded}`;
      case 'BED':
        return `BED-${padded}`;
      default:
        return `${type}-${year}-${padded}`;
    }
  }
}
