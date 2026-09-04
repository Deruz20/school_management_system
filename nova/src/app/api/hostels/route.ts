import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { HostelDAO } from "@/lib/dao/hostel.dao";
import { HostelGender } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const gender = url.searchParams.get("gender") as HostelGender | null;
    const isActive = url.searchParams.has("isActive") ? url.searchParams.get("isActive") === "true" : undefined;

    const hostels = await HostelDAO.getHostels(ctx, {
      gender: gender || undefined,
      isActive,
    });

    return NextResponse.json(hostels);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const hostel = await HostelDAO.createHostel(ctx, {
      code: data.code,
      name: data.name,
      gender: data.gender,
      capacity: data.capacity,
      wardenId: data.wardenId,
      matronId: data.matronId,
      description: data.description,
    });

    return NextResponse.json(hostel, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
