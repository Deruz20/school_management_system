import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { PortalAccessDAO } from "@/lib/dao/portal-access.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const branchId = url.searchParams.get("branchId") || ctx.branchId;

    const policy = await PortalAccessDAO.getPolicy(branchId);
    return NextResponse.json(policy);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const policy = await PortalAccessDAO.upsertPolicy(ctx, {
      allowStudentAccess: body.allowStudentAccess,
      allowParentAccess: body.allowParentAccess,
      enforceFeeBlockOnReports: body.enforceFeeBlockOnReports,
      outstandingFeeThreshold: body.outstandingFeeThreshold,
      blockMessage: body.blockMessage
    });

    return NextResponse.json(policy);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
