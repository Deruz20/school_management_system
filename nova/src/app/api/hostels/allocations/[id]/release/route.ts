import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { HostelDAO } from "@/lib/dao/hostel.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json().catch(() => ({}));

    const released = await HostelDAO.releaseBed(ctx, id, data?.notes);
    return NextResponse.json(released);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
