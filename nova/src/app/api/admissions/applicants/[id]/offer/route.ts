import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json();

    const updated = await AdmissionsDAO.issueAdmissionOffer(ctx, id, {
      decisionReason: data.decisionReason,
      validDays: data.validDays
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
