import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json();

    const subscription = await TransportDAO.cancelSubscription(ctx, id, {
      cancellationReason: data.cancellationReason,
      notes: data.notes,
    });

    return NextResponse.json({ subscription });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
