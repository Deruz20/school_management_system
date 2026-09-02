import { NextResponse } from "next/server";
import { ClearanceDAO } from "@/lib/dao/clearance.dao";

export async function GET(
  req: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const params = await props.params;
    const result = await ClearanceDAO.verifyClearanceToken(params.token);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
