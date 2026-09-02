import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const academicYearId = searchParams.get("academicYearId");
    const termId = searchParams.get("termId") || undefined;
    const routeId = searchParams.get("routeId") || undefined;

    if (!academicYearId) {
      return new NextResponse("academicYearId is required.", { status: 400 });
    }

    const report = await TransportDAO.getRouteProfitabilityReport(ctx, {
      academicYearId,
      termId,
      routeId,
    });

    return NextResponse.json({ report });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
