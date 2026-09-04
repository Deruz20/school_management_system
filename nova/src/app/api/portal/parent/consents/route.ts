import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ParentPortalDAO } from "@/lib/dao/parent-portal.dao";
import { db } from "@/lib/db";
import { ParentConsentType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);

    let guardianId = url.searchParams.get("guardianId");
    if (!guardianId) {
      const user = await db.user.findUnique({
        where: { id: ctx.userId },
        select: { guardianId: true }
      });
      guardianId = user?.guardianId || null;
    }

    if (!guardianId) {
      return new NextResponse("Authenticated user is not linked to a guardian profile.", { status: 403 });
    }

    const pendingConsents = await ParentPortalDAO.getPendingConsents(guardianId);
    return NextResponse.json({ pendingConsents });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    let guardianId = body.guardianId;
    if (!guardianId) {
      const user = await db.user.findUnique({
        where: { id: ctx.userId },
        select: { guardianId: true }
      });
      guardianId = user?.guardianId || null;
    }

    if (!guardianId) {
      return new NextResponse("Authenticated user is not linked to a guardian profile.", { status: 403 });
    }

    const consent = await ParentPortalDAO.recordConsent({
      guardianId,
      studentId: body.studentId,
      consentType: body.consentType as ParentConsentType,
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      granted: Boolean(body.granted),
      digitalSignature: body.digitalSignature,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
      notes: body.notes
    });

    return NextResponse.json({ consent });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
