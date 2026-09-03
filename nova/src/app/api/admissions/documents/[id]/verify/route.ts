import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DocumentDAO } from "@/lib/dao/document.dao";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json();

    const isStudentDoc = data.isStudentDoc !== undefined ? data.isStudentDoc : true;
    const updated = await DocumentDAO.verifyDocument(ctx, id, isStudentDoc, {
      verified: data.verified,
      notes: data.notes
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
