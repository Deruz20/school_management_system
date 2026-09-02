import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { RequirementsDAO } from "@/lib/dao/requirements.dao";
import { RequirementCategory } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const category = (searchParams.get("category") as RequirementCategory) || undefined;
    const isActive = searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined;
    const search = searchParams.get("search") || undefined;

    const items = await RequirementsDAO.listCatalogItems(ctx, {
      category,
      isActive,
      search
    });

    return NextResponse.json({ items });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const item = await RequirementsDAO.createCatalogItem(ctx, {
      code: data.code,
      name: data.name,
      category: data.category,
      unit: data.unit,
      defaultCashInLieu: data.defaultCashInLieu,
      description: data.description
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
