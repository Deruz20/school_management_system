import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AssetDAO } from "@/lib/dao/asset.dao";
import { AssetReportsDAO } from "@/lib/dao/asset-reports.dao";
import { AssetStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const categoryId = searchParams.get("categoryId") || undefined;
    const status = (searchParams.get("status") as AssetStatus) || undefined;
    const locationId = searchParams.get("locationId") || undefined;
    const custodianId = searchParams.get("custodianId") || undefined;
    const search = searchParams.get("search") || undefined;

    const [report, assets] = await Promise.all([
      AssetReportsDAO.getFixedAssetRegister(ctx, { categoryId, status, locationId, custodianId }),
      AssetDAO.listAssets(ctx, { categoryId, status, locationId, custodianId, search })
    ]);

    return NextResponse.json({ summary: report.summary, assets });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const source = body.capitalizationSource || "DIRECT_PURCHASE";

    if (source === "DIRECT_PURCHASE") {
      const asset = await AssetDAO.capitalizeDirectPurchase(ctx, {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        locationId: body.locationId,
        custodianId: body.custodianId,
        serialNumber: body.serialNumber,
        modelNumber: body.modelNumber,
        manufacturer: body.manufacturer,
        purchaseDate: new Date(body.purchaseDate),
        capitalizationDate: new Date(body.capitalizationDate),
        warrantyExpiry: body.warrantyExpiry ? new Date(body.warrantyExpiry) : undefined,
        acquisitionCost: body.acquisitionCost,
        salvageValue: body.salvageValue,
        depreciationMethod: body.depreciationMethod,
        usefulLifeMonths: body.usefulLifeMonths ? Number(body.usefulLifeMonths) : undefined,
        annualDepreciationRate: body.annualDepreciationRate,
        treasuryAccountId: body.treasuryAccountId
      });
      return NextResponse.json({ asset }, { status: 201 });
    }

    if (source === "OPENING_BALANCE") {
      const asset = await AssetDAO.bootstrapOpeningAsset(ctx, {
        assetTag: body.assetTag,
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        locationId: body.locationId,
        custodianId: body.custodianId,
        serialNumber: body.serialNumber,
        modelNumber: body.modelNumber,
        manufacturer: body.manufacturer,
        purchaseDate: new Date(body.purchaseDate),
        capitalizationDate: new Date(body.capitalizationDate),
        acquisitionCost: body.acquisitionCost,
        accumulatedDepreciation: body.accumulatedDepreciation,
        salvageValue: body.salvageValue,
        depreciationMethod: body.depreciationMethod,
        usefulLifeMonths: body.usefulLifeMonths ? Number(body.usefulLifeMonths) : undefined,
        annualDepreciationRate: body.annualDepreciationRate,
        lastDepreciationDate: body.lastDepreciationDate ? new Date(body.lastDepreciationDate) : undefined
      });
      return NextResponse.json({ asset }, { status: 201 });
    }

    if (source === "PROCUREMENT_GRN") {
      const asset = await AssetDAO.capitalizeFromGRN(ctx, {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        grnId: body.grnId,
        grnItemId: body.grnItemId,
        locationId: body.locationId,
        custodianId: body.custodianId,
        serialNumber: body.serialNumber,
        modelNumber: body.modelNumber,
        manufacturer: body.manufacturer,
        capitalizationDate: new Date(body.capitalizationDate),
        acquisitionCost: body.acquisitionCost,
        salvageValue: body.salvageValue,
        depreciationMethod: body.depreciationMethod,
        usefulLifeMonths: body.usefulLifeMonths ? Number(body.usefulLifeMonths) : undefined,
        annualDepreciationRate: body.annualDepreciationRate
      });
      return NextResponse.json({ asset }, { status: 201 });
    }

    if (source === "INVENTORY_CONVERSION") {
      const asset = await AssetDAO.capitalizeFromInventoryStore(ctx, {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        storeId: body.storeId,
        itemId: body.itemId,
        quantity: body.quantity,
        locationId: body.locationId,
        custodianId: body.custodianId,
        serialNumber: body.serialNumber,
        modelNumber: body.modelNumber,
        manufacturer: body.manufacturer,
        capitalizationDate: new Date(body.capitalizationDate),
        salvageValue: body.salvageValue,
        depreciationMethod: body.depreciationMethod,
        usefulLifeMonths: body.usefulLifeMonths ? Number(body.usefulLifeMonths) : undefined,
        annualDepreciationRate: body.annualDepreciationRate
      });
      return NextResponse.json({ asset }, { status: 201 });
    }

    if (source === "FLEET_VEHICLE") {
      const asset = await AssetDAO.linkFleetVehicle(ctx, {
        transportVehicleId: body.transportVehicleId,
        categoryId: body.categoryId,
        locationId: body.locationId,
        custodianId: body.custodianId,
        capitalizationDate: new Date(body.capitalizationDate),
        acquisitionCost: body.acquisitionCost,
        salvageValue: body.salvageValue,
        depreciationMethod: body.depreciationMethod,
        usefulLifeMonths: body.usefulLifeMonths ? Number(body.usefulLifeMonths) : undefined,
        annualDepreciationRate: body.annualDepreciationRate
      });
      return NextResponse.json({ asset }, { status: 201 });
    }

    return new NextResponse("Unsupported capitalization source.", { status: 400 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
