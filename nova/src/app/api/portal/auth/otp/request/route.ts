import { NextResponse } from "next/server";
import { PortalAuthDAO } from "@/lib/dao/portal-auth.dao";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { branchId, phone } = body;

    if (!branchId || !phone) {
      return NextResponse.json({ error: "branchId and phone are required." }, { status: 400 });
    }

    const result = await PortalAuthDAO.requestOtp(branchId, phone);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : undefined) || "Failed to request OTP";
    if (msg.includes("Rate limit")) {
      return NextResponse.json({ error: msg }, { status: 429 });
    }
    if (msg.includes("temporarily locked")) {
      return NextResponse.json({ error: msg }, { status: 423 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
