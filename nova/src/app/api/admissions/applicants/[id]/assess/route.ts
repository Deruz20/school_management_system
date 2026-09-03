import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json();

    const updated = await AdmissionsDAO.recordAssessment(ctx, id, {
      score: data.score,
      notes: data.notes,
      assessedById: data.assessedById
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
