import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { GLAccountDAO } from "@/lib/dao/gl.dao";
import { GLAccountType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const accountType = (searchParams.get("accountType") as GLAccountType) || undefined;
    const isActive = searchParams.has("isActive") ? searchParams.get("isActive") === "true" : undefined;
    const isHeader = searchParams.has("isHeader") ? searchParams.get("isHeader") === "true" : undefined;

    const accounts = await GLAccountDAO.listAccounts(ctx, { accountType, isActive, isHeader });
    const mappings = await GLAccountDAO.listMappings(ctx);

    return NextResponse.json({ accounts, mappings });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    if (data.action === "INIT_COA") {
      const result = await GLAccountDAO.initBranchChartOfAccounts(ctx.branchId);
      return NextResponse.json(result);
    }

    const account = await GLAccountDAO.createAccount(ctx, {
      code: data.code,
      name: data.name,
      accountType: data.accountType,
      normalBalance: data.normalBalance,
      controlRole: data.controlRole,
      isHeader: data.isHeader,
      parentId: data.parentId,
      description: data.description
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
