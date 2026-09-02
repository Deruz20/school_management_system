import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { RequirementsDAO } from "@/lib/dao/requirements.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const item = await RequirementsDAO.exemptRequirementItem(ctx, {
      studentRequirementItemId: data.studentRequirementItemId,
      reason: data.reason,
      notes: data.notes
    });

    return NextResponse.json({ item });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
