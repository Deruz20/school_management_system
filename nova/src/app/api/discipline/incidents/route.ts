import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DisciplineDAO } from "@/lib/dao/discipline.dao";
import { IncidentStatus, IncidentSeverity, DisciplineCategory } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as IncidentStatus | null;
    const severity = url.searchParams.get("severity") as IncidentSeverity | null;
    const category = url.searchParams.get("category") as DisciplineCategory | null;
    const studentId = url.searchParams.get("studentId") || undefined;

    const incidents = await DisciplineDAO.listIncidents(ctx, {
      status: status || undefined,
      severity: severity || undefined,
      category: category || undefined,
      studentId,
    });

    return NextResponse.json(incidents);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const incident = await DisciplineDAO.reportIncident(ctx, {
      title: data.title,
      incidentDate: data.incidentDate,
      location: data.location,
      category: data.category,
      severity: data.severity,
      description: data.description,
      witnessNotes: data.witnessNotes,
      involvedStudents: data.involvedStudents,
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
