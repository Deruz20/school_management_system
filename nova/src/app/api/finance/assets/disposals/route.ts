import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AssetDisposalDAO } from "@/lib/dao/asset-disposal.dao";
import { AssetReportsDAO } from "@/lib/dao/asset-reports.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const fromDate = searchParams.has("fromDate") ? new Date(searchParams.get("fromDate")!) : undefined;
    const toDate = searchParams.has("toDate") ? new Date(searchParams.get("toDate")!) : undefined;

    const report = await AssetReportsDAO.getDisposalReport(ctx, fromDate, toDate);
    return NextResponse.json(report);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const disposal = await AssetDisposalDAO.disposeAsset(ctx, {
      assetId: body.assetId,
      disposalDate: new Date(body.disposalDate),
      disposalType: body.disposalType,
      disposalProceeds: body.disposalProceeds,
      reason: body.reason,
      buyerDetails: body.buyerDetails,
      treasuryAccountId: body.treasuryAccountId
    });

    return NextResponse.json({ disposal }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
