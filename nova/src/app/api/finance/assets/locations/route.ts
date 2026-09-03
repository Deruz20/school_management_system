import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AssetLocationDAO } from "@/lib/dao/asset.dao";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const locations = await AssetLocationDAO.listLocations(ctx);
    return NextResponse.json({ locations });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const location = await AssetLocationDAO.createLocation(ctx, {
      code: body.code,
      name: body.name,
      building: body.building,
      roomNumber: body.roomNumber,
      description: body.description
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
