import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { HostelDAO } from "@/lib/dao/hostel.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const hostel = await HostelDAO.getHostelById(ctx, id);
    return NextResponse.json(hostel);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
