import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ExeatDAO } from "@/lib/dao/exeat.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await ExeatDAO.gateCheckin(ctx, {
      exeatId: data.exeatId,
      qrVerificationToken: data.qrVerificationToken,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
