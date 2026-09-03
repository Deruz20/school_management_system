import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AssetCategoryDAO } from "@/lib/dao/asset.dao";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const categories = await AssetCategoryDAO.listCategories(ctx);
    return NextResponse.json({ categories });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    if (body.action === "INIT_DEFAULTS") {
      await AssetCategoryDAO.initDefaultCategories(ctx);
      const categories = await AssetCategoryDAO.listCategories(ctx);
      return NextResponse.json({ categories });
    }

    const category = await AssetCategoryDAO.createCategory(ctx, {
      code: body.code,
      name: body.name,
      categoryType: body.categoryType,
      description: body.description,
      depreciationMethod: body.depreciationMethod,
      usefulLifeMonths: body.usefulLifeMonths ? Number(body.usefulLifeMonths) : undefined,
      annualDepreciationRate: body.annualDepreciationRate,
      defaultSalvagePercent: body.defaultSalvagePercent,
      glAssetAccountId: body.glAssetAccountId,
      glDepreciationAccountId: body.glDepreciationAccountId,
      glAccumDeprecAccountId: body.glAccumDeprecAccountId
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
