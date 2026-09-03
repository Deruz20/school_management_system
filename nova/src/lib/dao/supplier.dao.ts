import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  PaymentMethod,
  SupplierInvoiceStatus,
  SupplierCreditNoteStatus,
  SupplierPaymentStatus
} from "@prisma/client";
import { AuditService } from "@/lib/services/audit.service";

export class SupplierSequenceDAO {
  /**
   * Atomic sequence generator for Supplier Documents (PINV, SCRN, SPAY, SUP)
   */
  static async nextSequence(
    ctx: TenantContext,
    type: "PINV" | "SCRN" | "SPAY" | "SUP",
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const client = tx || db;
    const year = new Date().getFullYear();

    const seq = await client.supplierSequence.upsert({
      where: {
        branchId_type_year: {
          branchId: ctx.branchId,
          type,
          year
        }
      },
      update: {
        nextVal: { increment: 1 }
      },
      create: {
        branchId: ctx.branchId,
        type,
        year,
        nextVal: 2
      }
    });

    const val = seq.nextVal - 1;
    return `${type}-${year}-${val.toString().padStart(5, "0")}`;
  }
}

export interface CreateSupplierInput {
  supplierCode?: string;
  name: string;
  tradeName?: string | null;
  contactName?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  taxIdNumber?: string | null;
  paymentTerms?: string | null;
  paymentTermsDays?: number;
  creditLimitUGX?: number | string | Prisma.Decimal;
  vatRegistered?: boolean;
  whtExempt?: boolean;
  whtExemptionCertRef?: string | null;
  whtExemptionExpiry?: Date | string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankBranch?: string | null;
  mobileMoneyNumber?: string | null;
  preferredPaymentMethod?: PaymentMethod;
  notes?: string | null;
}

export class SupplierDAO {
  /**
   * 1. Create Supplier Master
   */
  static async createSupplier(
    ctx: TenantContext,
    input: CreateSupplierInput
  ) {
    const cleanName = input.name.trim();
    if (!cleanName) throw new Error("Supplier legal name is required.");
    if (!input.phone || !input.phone.trim()) throw new Error("Supplier phone number is required.");

    return await db.$transaction(async (tx) => {
      const code = input.supplierCode?.trim() || (await SupplierSequenceDAO.nextSequence(ctx, "SUP", tx));

      // Check unique code per branch
      const existingCode = await tx.inventorySupplier.findUnique({
        where: { branchId_supplierCode: { branchId: ctx.branchId, supplierCode: code } }
      });
      if (existingCode) {
        throw new Error(`Supplier with code ${code} already exists in this branch.`);
      }

      // Check duplicate name per branch
      const existingName = await tx.inventorySupplier.findFirst({
        where: {
          branchId: ctx.branchId,
          name: { equals: cleanName, mode: "insensitive" }
        }
      });
      if (existingName) {
        throw new Error(`Supplier with name "${cleanName}" already exists in this branch.`);
      }

      const creditLimit = new Prisma.Decimal(input.creditLimitUGX || 0);

      const supplier = await tx.inventorySupplier.create({
        data: {
          branchId: ctx.branchId,
          supplierCode: code,
          name: cleanName,
          tradeName: input.tradeName?.trim() || null,
          contactName: input.contactName?.trim() || null,
          phone: input.phone.trim(),
          email: input.email?.trim() || null,
          address: input.address?.trim() || null,
          taxIdNumber: input.taxIdNumber?.trim() || null,
          paymentTerms: input.paymentTerms?.trim() || `Net ${input.paymentTermsDays || 30}`,
          paymentTermsDays: input.paymentTermsDays !== undefined ? input.paymentTermsDays : 30,
          creditLimitUGX: creditLimit,
          isCreditBlocked: false,
          currentBalanceUGX: new Prisma.Decimal(0),
          vatRegistered: input.vatRegistered || false,
          whtExempt: input.whtExempt || false,
          whtExemptionCertRef: input.whtExemptionCertRef?.trim() || null,
          whtExemptionExpiry: input.whtExemptionExpiry ? new Date(input.whtExemptionExpiry) : null,
          bankName: input.bankName?.trim() || null,
          bankAccountNumber: input.bankAccountNumber?.trim() || null,
          bankBranch: input.bankBranch?.trim() || null,
          mobileMoneyNumber: input.mobileMoneyNumber?.trim() || null,
          preferredPaymentMethod: input.preferredPaymentMethod || PaymentMethod.BANK_TRANSFER,
          notes: input.notes?.trim() || null,
          isActive: true
        }
      });

      await AuditService.log(
        ctx,
        "CREATE_SUPPLIER",
        "InventorySupplier",
        supplier.id,
        JSON.stringify({ code: supplier.supplierCode, name: supplier.name })
      );

      return supplier;
    });
  }

  /**
   * 2. Update Supplier Master
   */
  static async updateSupplier(
    ctx: TenantContext,
    id: string,
    input: Partial<CreateSupplierInput> & { isActive?: boolean; isCreditBlocked?: boolean }
  ) {
    return await db.$transaction(async (tx) => {
      const supplier = await tx.inventorySupplier.findFirst({
        where: { id, branchId: ctx.branchId }
      });
      if (!supplier) throw new Error("Supplier not found in this branch.");

      if (input.name && input.name.trim() !== supplier.name) {
        const existingName = await tx.inventorySupplier.findFirst({
          where: {
            branchId: ctx.branchId,
            id: { not: supplier.id },
            name: { equals: input.name.trim(), mode: "insensitive" }
          }
        });
        if (existingName) {
          throw new Error(`Supplier with name "${input.name.trim()}" already exists in this branch.`);
        }
      }

      const updated = await tx.inventorySupplier.update({
        where: { id: supplier.id },
        data: {
          name: input.name !== undefined ? input.name.trim() : undefined,
          tradeName: input.tradeName !== undefined ? input.tradeName?.trim() || null : undefined,
          contactName: input.contactName !== undefined ? input.contactName?.trim() || null : undefined,
          phone: input.phone !== undefined ? input.phone.trim() : undefined,
          email: input.email !== undefined ? input.email?.trim() || null : undefined,
          address: input.address !== undefined ? input.address?.trim() || null : undefined,
          taxIdNumber: input.taxIdNumber !== undefined ? input.taxIdNumber?.trim() || null : undefined,
          paymentTerms: input.paymentTerms !== undefined ? input.paymentTerms?.trim() || null : undefined,
          paymentTermsDays: input.paymentTermsDays !== undefined ? input.paymentTermsDays : undefined,
          creditLimitUGX: input.creditLimitUGX !== undefined ? new Prisma.Decimal(input.creditLimitUGX) : undefined,
          isCreditBlocked: input.isCreditBlocked !== undefined ? input.isCreditBlocked : undefined,
          vatRegistered: input.vatRegistered !== undefined ? input.vatRegistered : undefined,
          whtExempt: input.whtExempt !== undefined ? input.whtExempt : undefined,
          whtExemptionCertRef: input.whtExemptionCertRef !== undefined ? input.whtExemptionCertRef?.trim() || null : undefined,
          whtExemptionExpiry: input.whtExemptionExpiry !== undefined ? (input.whtExemptionExpiry ? new Date(input.whtExemptionExpiry) : null) : undefined,
          bankName: input.bankName !== undefined ? input.bankName?.trim() || null : undefined,
          bankAccountNumber: input.bankAccountNumber !== undefined ? input.bankAccountNumber?.trim() || null : undefined,
          bankBranch: input.bankBranch !== undefined ? input.bankBranch?.trim() || null : undefined,
          mobileMoneyNumber: input.mobileMoneyNumber !== undefined ? input.mobileMoneyNumber?.trim() || null : undefined,
          preferredPaymentMethod: input.preferredPaymentMethod !== undefined ? input.preferredPaymentMethod : undefined,
          notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
          isActive: input.isActive !== undefined ? input.isActive : undefined
        }
      });

      await AuditService.log(
        ctx,
        "UPDATE_SUPPLIER",
        "InventorySupplier",
        supplier.id,
        JSON.stringify(input)
      );

      return updated;
    });
  }

  /**
   * 3. Get Supplier with subledger statistics
   */
  static async getSupplier(ctx: TenantContext, id: string) {
    const supplier = await db.inventorySupplier.findFirst({
      where: { id, branchId: ctx.branchId },
      include: {
        _count: {
          select: {
            pos: true,
            grns: true,
            invoices: true,
            creditNotes: true,
            payments: true
          }
        }
      }
    });
    if (!supplier) throw new Error("Supplier not found.");
    return supplier;
  }

  /**
   * 4. List Suppliers
   */
  static async listSuppliers(
    ctx: TenantContext,
    filters?: {
      search?: string;
      isActive?: boolean;
      isCreditBlocked?: boolean;
    }
  ) {
    const where: Prisma.InventorySupplierWhereInput = {
      branchId: ctx.branchId,
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters?.isCreditBlocked !== undefined ? { isCreditBlocked: filters.isCreditBlocked } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { supplierCode: { contains: filters.search, mode: "insensitive" } },
              { phone: { contains: filters.search, mode: "insensitive" } },
              { taxIdNumber: { contains: filters.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    return await db.inventorySupplier.findMany({
      where,
      orderBy: { name: "asc" }
    });
  }

  /**
   * 5. Recalculate & Sync Authoritative Supplier Subledger Balance Cache
   */
  static async syncSupplierBalance(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    supplierId: string
  ): Promise<Prisma.Decimal> {
    // 1. Sum Approved/Paid Invoices Outstanding
    const activeInvoices = await tx.supplierInvoice.findMany({
      where: {
        branchId: ctx.branchId,
        supplierId,
        status: { in: [SupplierInvoiceStatus.APPROVED, SupplierInvoiceStatus.PARTIALLY_PAID, SupplierInvoiceStatus.PAID] }
      }
    });

    let totalInvoicedPayable = new Prisma.Decimal(0);
    let totalInvoicedPaid = new Prisma.Decimal(0);

    for (const inv of activeInvoices) {
      totalInvoicedPayable = totalInvoicedPayable.add(inv.netPayableAmount);
      totalInvoicedPaid = totalInvoicedPaid.add(inv.amountPaid);
    }

    // 2. Sum Unallocated Credit Notes
    const creditNotes = await tx.supplierCreditNote.findMany({
      where: {
        branchId: ctx.branchId,
        supplierId,
        status: { in: [SupplierCreditNoteStatus.APPROVED, SupplierCreditNoteStatus.POSTED, SupplierCreditNoteStatus.ALLOCATED] }
      }
    });

    let totalCreditNotes = new Prisma.Decimal(0);
    for (const crn of creditNotes) {
      totalCreditNotes = totalCreditNotes.add(crn.netCreditAmount);
    }

    // 3. Sum Unallocated Payments (Advances)
    const payments = await tx.supplierPayment.findMany({
      where: {
        branchId: ctx.branchId,
        supplierId,
        status: SupplierPaymentStatus.COMPLETED
      }
    });

    let totalUnallocatedAdvance = new Prisma.Decimal(0);
    for (const pay of payments) {
      totalUnallocatedAdvance = totalUnallocatedAdvance.add(pay.unallocatedAmount);
    }

    // Authoritative Balance: Outstanding Invoices - Unallocated Credit Notes - Unallocated Payments
    const currentOutstanding = totalInvoicedPayable.sub(totalInvoicedPaid).sub(totalUnallocatedAdvance);

    await tx.inventorySupplier.update({
      where: { id: supplierId },
      data: { currentBalanceUGX: currentOutstanding }
    });

    return currentOutstanding;
  }
}
