import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClinicDAO } from "@/lib/dao/clinic.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const encounter = await ClinicDAO.getEncounterById(ctx, id);
    return NextResponse.json(encounter);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
