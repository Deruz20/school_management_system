import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClinicDAO } from "@/lib/dao/clinic.dao";
import { TriagePriority } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId") || undefined;
    const triagePriority = url.searchParams.get("triagePriority") as TriagePriority | null;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;

    const encounters = await ClinicDAO.listEncounters(ctx, {
      studentId,
      triagePriority: triagePriority || undefined,
      startDate,
      endDate,
    });

    return NextResponse.json(encounters);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const encounter = await ClinicDAO.createEncounter(ctx, {
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      triagePriority: data.triagePriority,
      temperature: data.temperature,
      pulseRate: data.pulseRate,
      bloodPressure: data.bloodPressure,
      respiratoryRate: data.respiratoryRate,
      weightKg: data.weightKg,
      chiefComplaint: data.chiefComplaint,
      diagnosticCategory: data.diagnosticCategory,
      symptoms: data.symptoms,
      clinicalNotes: data.clinicalNotes,
      diagnosis: data.diagnosis,
      outcome: data.outcome,
    });

    return NextResponse.json(encounter, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
