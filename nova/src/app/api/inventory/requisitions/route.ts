import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";
import { RequisitionStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const storeId = searchParams.get("storeId") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const status = (searchParams.get("status") as RequisitionStatus) || undefined;

    const requisitions = await InventoryDAO.listRequisitions(ctx, {
      storeId,
      departmentId,
      status,
    });

    return NextResponse.json({ requisitions });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const requisition = await InventoryDAO.createRequisition(ctx, {
      storeId: data.storeId,
      departmentId: data.departmentId,
      requestedById: data.requestedById,
      purpose: data.purpose,
      items: data.items,
    });

    return NextResponse.json({ requisition }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
