import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const routeId = searchParams.get("routeId");
    const academicYearId = searchParams.get("academicYearId");
    const termId = searchParams.get("termId") || undefined;
    const tripType = (searchParams.get("tripType") as "MORNING" | "EVENING") || "MORNING";

    if (!routeId || !academicYearId) {
      return new NextResponse("routeId and academicYearId are required.", { status: 400 });
    }

    const manifest = await TransportDAO.generatePassengerManifest(ctx, {
      routeId,
      academicYearId,
      termId,
      tripType,
    });

    return NextResponse.json({ manifest });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
