import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json().catch(() => ({}));

    const result = await AdmissionsDAO.enrollApplicant(ctx, id, {
      targetClassId: data.targetClassId,
      targetStreamId: data.targetStreamId,
      autoBill: data.autoBill,
      feeStructureId: data.feeStructureId,
      termId: data.termId,
      dueDate: data.dueDate,
      transportRouteId: data.transportRouteId,
      transportStopId: data.transportStopId,
      uniformStoreId: data.uniformStoreId,
      uniformItems: data.uniformItems
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
