import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const report = await TransportDAO.getFleetEfficiencyReport(ctx, {
      startDate,
      endDate,
    });

    return NextResponse.json({ report });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
