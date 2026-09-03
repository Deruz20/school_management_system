import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const applicant = await AdmissionsDAO.getApplicant(ctx, id);
    return NextResponse.json(applicant);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json();

    const updated = await AdmissionsDAO.submitApplication(ctx, id, data);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
