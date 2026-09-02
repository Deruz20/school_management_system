import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";
import { StoreLocationType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const storeType = (searchParams.get("storeType") as StoreLocationType) || undefined;
    const isActive = searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined;

    const stores = await InventoryDAO.listStores(ctx, {
      storeType,
      isActive,
    });

    return NextResponse.json({ stores });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const store = await InventoryDAO.createStore(ctx, {
      code: data.code,
      name: data.name,
      storeType: data.storeType,
      location: data.location,
      managerId: data.managerId,
    });

    return NextResponse.json({ store }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
