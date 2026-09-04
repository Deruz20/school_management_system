import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { NotificationPreferenceDAO } from "@/lib/dao/notification-preference.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const branchId = url.searchParams.get("branchId") || ctx.branchId;
    const guardianId = url.searchParams.get("guardianId");
    const studentId = url.searchParams.get("studentId");

    if (guardianId) {
      const prefs = await NotificationPreferenceDAO.getGuardianPreferences(branchId, guardianId);
      return NextResponse.json(prefs);
    }

    if (studentId) {
      const prefs = await NotificationPreferenceDAO.getStudentPreferences(branchId, studentId);
      return NextResponse.json(prefs);
    }

    return new NextResponse("Either guardianId or studentId must be provided.", { status: 400 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const branchId = body.branchId || ctx.branchId;

    if (body.guardianId) {
      const prefs = await NotificationPreferenceDAO.upsertGuardianPreferences(
        branchId,
        body.guardianId,
        body
      );
      return NextResponse.json(prefs);
    }

    if (body.studentId) {
      const prefs = await NotificationPreferenceDAO.upsertStudentPreferences(
        branchId,
        body.studentId,
        body
      );
      return NextResponse.json(prefs);
    }

    return new NextResponse("Either guardianId or studentId must be provided.", { status: 400 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
