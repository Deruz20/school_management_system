import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AssetDAO } from "@/lib/dao/asset.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const asset = await AssetDAO.getAssetById(ctx, id);
    if (!asset) {
      return new NextResponse("Asset item not found", { status: 404 });
    }
    return NextResponse.json({ asset });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const body = await req.json();

    if (body.action === "TRANSFER") {
      const updated = await AssetDAO.transferAsset(ctx, id, {
        toLocationId: body.toLocationId,
        toCustodianId: body.toCustodianId,
        reason: body.reason
      });
      return NextResponse.json({ asset: updated });
    }

    if (body.action === "VERIFY") {
      const log = await AssetDAO.logPhysicalVerification(ctx, id, {
        condition: body.condition,
        locationId: body.locationId,
        custodianId: body.custodianId,
        isMissing: body.isMissing,
        notes: body.notes
      });
      return NextResponse.json({ log });
    }

    return new NextResponse("Invalid action specified", { status: 400 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
