import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClearanceDAO } from "@/lib/dao/clearance.dao";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const ctx = await requireAuth();
    const data = await req.json();

    const clearance = await ClearanceDAO.revokeClearancePermit(ctx, {
      clearanceId: params.id,
      reason: data.reason
    });

    return NextResponse.json({ clearance });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
