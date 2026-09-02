import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";
import { TreasuryAccountType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const accountType = (searchParams.get("accountType") as TreasuryAccountType) || undefined;
    const isActive = searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined;

    const accounts = await TreasuryDAO.getTreasuryAccounts(ctx, {
      accountType,
      isActive,
    });

    return NextResponse.json({ accounts });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const account = await TreasuryDAO.createTreasuryAccount(ctx, {
      code: data.code,
      name: data.name,
      accountType: data.accountType,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      currency: data.currency,
      swiftCode: data.swiftCode,
      branchSortCode: data.branchSortCode,
      openingBalance: data.openingBalance,
      openingDate: data.openingDate,
      isDefaultFeeCollection: data.isDefaultFeeCollection,
      isDefaultOperations: data.isDefaultOperations,
      isDefaultPettyCash: data.isDefaultPettyCash,
      custodianId: data.custodianId,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
