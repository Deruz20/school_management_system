import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || undefined;
    const isActive = searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined;

    const suppliers = await InventoryDAO.listSuppliers(ctx, {
      search,
      isActive,
    });

    return NextResponse.json({ suppliers });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const supplier = await InventoryDAO.createSupplier(ctx, {
      supplierCode: data.supplierCode,
      name: data.name,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      taxIdNumber: data.taxIdNumber,
      paymentTerms: data.paymentTerms,
      notes: data.notes,
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
