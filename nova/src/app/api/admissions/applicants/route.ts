import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";
import { ApplicantStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status") as ApplicantStatus | null;
    const targetClassId = url.searchParams.get("targetClassId") || undefined;
    const academicYearId = url.searchParams.get("academicYearId") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const skip = url.searchParams.get("skip") ? parseInt(url.searchParams.get("skip")!) : undefined;
    const take = url.searchParams.get("take") ? parseInt(url.searchParams.get("take")!) : undefined;

    const result = await AdmissionsDAO.listApplicants(ctx, {
      status: statusParam || undefined,
      targetClassId,
      academicYearId,
      search,
      skip,
      take
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const applicant = await AdmissionsDAO.createInquiry(ctx, {
      academicYearId: data.academicYearId,
      targetClassId: data.targetClassId,
      targetStreamId: data.targetStreamId,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      nationality: data.nationality,
      dayOrBoarding: data.dayOrBoarding,
      guardianId: data.guardianId,
      guardianPhone: data.guardianPhone,
      guardianName: data.guardianName
    });

    return NextResponse.json(applicant, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
