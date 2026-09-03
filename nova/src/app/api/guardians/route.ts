import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { GuardianDAO } from "@/lib/dao/guardian.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || undefined;
    const isVerifiedParam = url.searchParams.get("isVerified");
    const isVerified = isVerifiedParam !== null ? isVerifiedParam === "true" : undefined;
    const skip = url.searchParams.get("skip") ? parseInt(url.searchParams.get("skip")!) : undefined;
    const take = url.searchParams.get("take") ? parseInt(url.searchParams.get("take")!) : undefined;

    const result = await GuardianDAO.listGuardians(ctx, {
      search,
      isVerified,
      skip,
      take
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const guardian = await GuardianDAO.createGuardian(ctx, data);
    return NextResponse.json(guardian, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
