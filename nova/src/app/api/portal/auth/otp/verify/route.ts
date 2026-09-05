import { NextResponse } from "next/server";
import { PortalAuthDAO } from "@/lib/dao/portal-auth.dao";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { branchId, phone, otp } = body;

    if (!branchId || !phone || !otp) {
      return NextResponse.json({ error: "branchId, phone, and otp are required." }, { status: 400 });
    }

    const result = await PortalAuthDAO.verifyOtp(branchId, phone, otp);
    await setSessionCookie(result.session.id, result.session.expiresAt);

    return NextResponse.json({
      success: true,
      message: result.message,
      user: result.user
    });
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : undefined) || "Failed to verify OTP";
    if (msg.includes("temporarily locked")) {
      return NextResponse.json({ error: msg }, { status: 423 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
