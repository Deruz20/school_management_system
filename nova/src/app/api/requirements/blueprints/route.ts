import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { RequirementsDAO } from "@/lib/dao/requirements.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const classId = searchParams.get("classId") || undefined;
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const termId = searchParams.get("termId") || undefined;
    const isActive = searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined;

    const blueprints = await RequirementsDAO.listClassRequirements(ctx, {
      classId,
      academicYearId,
      termId,
      isActive
    });

    return NextResponse.json({ blueprints });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const blueprint = await RequirementsDAO.createClassRequirement(ctx, {
      classId: data.classId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      title: data.title,
      description: data.description,
      items: data.items || []
    });

    return NextResponse.json({ blueprint }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
