import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { GLEngineDAO } from "@/lib/dao/gl.dao";
import { db } from "@/lib/db";
import { JournalStatus, JournalType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const status = (searchParams.get("status") as JournalStatus) || undefined;
    const journalType = (searchParams.get("journalType") as JournalType) || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const [journals, total] = await Promise.all([
      db.journalEntry.findMany({
        where: {
          branchId: ctx.branchId,
          status,
          journalType
        },
        orderBy: [{ entryDate: "desc" }, { journalNumber: "desc" }],
        take: limit,
        skip: offset,
        include: {
          lines: {
            include: { account: true },
            orderBy: { lineNumber: "asc" }
          },
          fiscalPeriod: true,
          postedBy: { select: { id: true, firstName: true, lastName: true } }
        }
      }),
      db.journalEntry.count({
        where: { branchId: ctx.branchId, status, journalType }
      })
    ]);

    return NextResponse.json({ journals, total, limit, offset });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const journal = await GLEngineDAO.createManualJournal(ctx, {
      entryDate: data.entryDate,
      description: data.description,
      referenceNumber: data.referenceNumber,
      lines: data.lines,
      isDraft: data.isDraft === true
    });

    return NextResponse.json({ journal }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
