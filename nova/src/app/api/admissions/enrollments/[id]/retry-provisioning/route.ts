import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ProvisioningRunner } from "@/lib/dao/provisioning.runner";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json().catch(() => ({}));

    const result = await ProvisioningRunner.retry(ctx, id, data);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
