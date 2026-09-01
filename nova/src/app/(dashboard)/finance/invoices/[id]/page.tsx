import { requireAuth } from "@/lib/auth/require-auth";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";
import InvoiceDetailClient from "@/components/finance/InvoiceDetailClient";
import { notFound } from "next/navigation";

export default async function InvoicePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAuth();
  const { id } = await params;

  let invoice;
  try {
    invoice = await InvoiceDAO.getById(ctx, id);
  } catch {
    notFound();
  }

  return <InvoiceDetailClient invoice={invoice} />;
}
