import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DocumentDAO } from "@/lib/dao/document.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    if (data.studentId) {
      const doc = await DocumentDAO.uploadStudentDocument(ctx, data.studentId, {
        documentType: data.documentType,
        documentTitle: data.documentTitle,
        storageKey: data.storageKey,
        fileSizeBytes: data.fileSizeBytes,
        mimeType: data.mimeType,
        sha256Checksum: data.sha256Checksum
      });
      return NextResponse.json(doc, { status: 201 });
    } else if (data.applicantId) {
      const doc = await DocumentDAO.uploadApplicantDocument(ctx, data.applicantId, {
        documentType: data.documentType,
        documentTitle: data.documentTitle,
        storageKey: data.storageKey,
        fileSizeBytes: data.fileSizeBytes,
        mimeType: data.mimeType,
        sha256Checksum: data.sha256Checksum
      });
      return NextResponse.json(doc, { status: 201 });
    } else {
      return new NextResponse("studentId or applicantId required.", { status: 400 });
    }
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
