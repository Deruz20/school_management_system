import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const academicYearId = searchParams.get("academicYearId") || undefined;
    const termId = searchParams.get("termId") || undefined;
    const isActive = searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined;

    const routes = await TransportDAO.listRoutes(ctx, {
      academicYearId,
      termId,
      isActive,
    });

    return NextResponse.json({ routes });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const route = await TransportDAO.createRoute(ctx, {
      code: data.code,
      name: data.name,
      description: data.description,
      destinationZone: data.destinationZone,
      twoWayFee: data.twoWayFee,
      oneWayFee: data.oneWayFee,
      academicYearId: data.academicYearId,
      termId: data.termId,
      stops: data.stops,
    });

    return NextResponse.json({ route }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
