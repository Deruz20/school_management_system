import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AssetDepreciationEngine } from "@/lib/dao/asset-depreciation.engine";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const runs = await AssetDepreciationEngine.listRuns(ctx);
    return NextResponse.json({ runs });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const run = await AssetDepreciationEngine.createDepreciationRun(
      ctx,
      body.periodId,
      body.notes
    );

    return NextResponse.json({ run }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
