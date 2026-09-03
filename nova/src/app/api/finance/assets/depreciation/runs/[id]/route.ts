import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AssetDepreciationEngine } from "@/lib/dao/asset-depreciation.engine";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const run = await AssetDepreciationEngine.getRunById(ctx, id);
    if (!run) {
      return new NextResponse("Depreciation run not found", { status: 404 });
    }
    return NextResponse.json({ run });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const body = await req.json();

    if (body.action === "APPROVE") {
      const approved = await AssetDepreciationEngine.approveDepreciationRun(ctx, id);
      return NextResponse.json({ run: approved });
    }

    if (body.action === "REJECT") {
      const rejected = await AssetDepreciationEngine.rejectDepreciationRun(ctx, id, body.reason);
      return NextResponse.json({ run: rejected });
    }

    if (body.action === "POST_GL") {
      const posted = await AssetDepreciationEngine.postDepreciationRun(ctx, id);
      return NextResponse.json({ run: posted });
    }

    return new NextResponse("Invalid action specified", { status: 400 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
