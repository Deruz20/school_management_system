import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { SupplierDAO } from "@/lib/dao/supplier.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const isActive = searchParams.has("isActive") ? searchParams.get("isActive") === "true" : undefined;
    const isCreditBlocked = searchParams.has("isCreditBlocked") ? searchParams.get("isCreditBlocked") === "true" : undefined;

    const suppliers = await SupplierDAO.listSuppliers(ctx, { search, isActive, isCreditBlocked });
    return NextResponse.json({ suppliers });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const supplier = await SupplierDAO.createSupplier(ctx, {
      supplierCode: body.supplierCode,
      name: body.name,
      tradeName: body.tradeName,
      contactName: body.contactName,
      phone: body.phone,
      email: body.email,
      address: body.address,
      taxIdNumber: body.taxIdNumber,
      paymentTerms: body.paymentTerms,
      paymentTermsDays: body.paymentTermsDays,
      creditLimitUGX: body.creditLimitUGX,
      vatRegistered: body.vatRegistered,
      whtExempt: body.whtExempt,
      whtExemptionCertRef: body.whtExemptionCertRef,
      whtExemptionExpiry: body.whtExemptionExpiry,
      bankName: body.bankName,
      bankAccountNumber: body.bankAccountNumber,
      bankBranch: body.bankBranch,
      mobileMoneyNumber: body.mobileMoneyNumber,
      preferredPaymentMethod: body.preferredPaymentMethod,
      notes: body.notes
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
