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
    const data = await req.json();

    const transferred = await HostelDAO.transferBed(ctx, {
      allocationId: id,
      targetBedId: data.targetBedId,
      notes: data.notes,
    });

    return NextResponse.json(transferred);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
