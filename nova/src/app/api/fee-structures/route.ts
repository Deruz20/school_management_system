import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FeeStructureDAO } from "@/lib/dao/fee-structure.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") || undefined;
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const termId = searchParams.get("termId") || undefined;

    const structures = await FeeStructureDAO.list(ctx, { classId, academicYearId, termId });
    return NextResponse.json(structures);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const structure = await FeeStructureDAO.create(ctx, {
      name: data.name,
      classId: data.classId,
      academicYearId: data.academicYearId,
      termId: data.termId || null,
      description: data.description || undefined,
      currency: data.currency || "UGX",
      isActive: data.isActive !== undefined ? data.isActive : true,
      items: data.items || []
    });

    return NextResponse.json(structure);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
