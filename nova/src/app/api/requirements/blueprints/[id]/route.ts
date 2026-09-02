import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { RequirementsDAO } from "@/lib/dao/requirements.dao";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const ctx = await requireAuth();
    const blueprint = await RequirementsDAO.getClassRequirement(ctx, params.id);

    if (!blueprint) {
      return new NextResponse("Class Requirement Blueprint not found", { status: 404 });
    }

    return NextResponse.json({ blueprint });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const ctx = await requireAuth();
    const data = await req.json();

    const blueprint = await RequirementsDAO.updateClassRequirement(ctx, params.id, {
      title: data.title,
      description: data.description,
      isActive: data.isActive,
      items: data.items
    });

    return NextResponse.json({ blueprint });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
