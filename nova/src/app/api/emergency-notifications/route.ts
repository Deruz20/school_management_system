import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { EmergencyNotificationDAO } from "@/lib/dao/emergency-notification.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("studentId query parameter is required.", { status: 400 });
    }

    const notifications = await EmergencyNotificationDAO.listStudentNotifications(ctx, studentId);
    return NextResponse.json(notifications);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const notification = await EmergencyNotificationDAO.logNotification(ctx, {
      studentId: data.studentId,
      guardianId: data.guardianId,
      notificationReason: data.notificationReason,
      phoneDialed: data.phoneDialed,
      guardianResponseNotes: data.guardianResponseNotes,
      status: data.status,
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
