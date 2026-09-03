import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const academicYearId = url.searchParams.get("academicYearId") || undefined;

    const metrics = await AdmissionsDAO.getFunnelMetrics(ctx, academicYearId);
    return NextResponse.json(metrics);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
