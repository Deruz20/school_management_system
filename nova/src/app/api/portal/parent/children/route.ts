import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ParentPortalDAO } from "@/lib/dao/parent-portal.dao";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const branchId = url.searchParams.get("branchId") || ctx.branchId;

    // Identify guardian linked to the authenticated user
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

    const children = await ParentPortalDAO.getGuardianChildren(guardianId, branchId);
    return NextResponse.json({ children });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
