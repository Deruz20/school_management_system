import { db } from "@/lib/db";
import { TenantContext } from "@/lib/dao/tenant-context";
import {
  Prisma,
  SupplyCategory,
  InputVatTreatment
} from "@prisma/client";
import { AuditService } from "@/lib/services/audit.service";

export interface TaxEvaluationInput {
  branchId: string;
  supplyCategory: SupplyCategory;
  transactionDate: Date;
  grossAmount: Prisma.Decimal;
  isSupplierWhtExempt: boolean;
  whtExemptionExpiry?: Date | null;
  isSupplierVatRegistered: boolean;
  hasEfrisInvoice: boolean;
  isDesignatedWithholdingAgent?: boolean;
}

export interface TaxEvaluationResult {
  policyId?: string;
  whtRatePercent: Prisma.Decimal;
  whtAmount: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  inputVatTreatment: InputVatTreatment;
  netPayableAmount: Prisma.Decimal;
}

export class TaxPolicyEngine {
  /**
   * Evaluates dynamic versioned TaxPolicy for a given transaction context.
   */
  static async evaluateTax(
    tx: Prisma.TransactionClient,
    input: TaxEvaluationInput
  ): Promise<TaxEvaluationResult> {
    const gross = new Prisma.Decimal(input.grossAmount);

    // 1. Fetch active versioned policy for supply category and date window
    const policy = await tx.taxPolicy.findFirst({
      where: {
        branchId: input.branchId,
        supplyCategory: input.supplyCategory,
        isActive: true,
        effectiveFrom: { lte: input.transactionDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: input.transactionDate } }
        ]
      },
      orderBy: { effectiveFrom: "desc" }
    });

    if (!policy) {
      // Safe fallback when no explicit policy is configured
      return {
        whtRatePercent: new Prisma.Decimal(0),
        whtAmount: new Prisma.Decimal(0),
        vatRatePercent: new Prisma.Decimal(0),
        vatAmount: new Prisma.Decimal(0),
        inputVatTreatment: InputVatTreatment.EXEMPT,
        netPayableAmount: gross
      };
    }

    // 2. Evaluate Withholding Tax (WHT)
    let whtRate = new Prisma.Decimal(0);
    let whtAmt = new Prisma.Decimal(0);

    const isExempt =
      input.isSupplierWhtExempt &&
      input.whtExemptionExpiry &&
      new Date(input.whtExemptionExpiry) >= input.transactionDate;

    // Check if institution is withholding agent (default true unless explicitly set false)
    const isWhtAgent = input.isDesignatedWithholdingAgent !== false;

    if (isWhtAgent && policy.isWhtApplicable && !isExempt) {
      if (gross.gte(policy.whtThresholdAmount)) {
        whtRate = new Prisma.Decimal(policy.whtRatePercent);
        const calcWht = gross.mul(whtRate).div(100);
        whtAmt = new Prisma.Decimal(calcWht.toFixed(2));
      }
    }

    // 3. Evaluate Value Added Tax (VAT)
    let vatRate = new Prisma.Decimal(0);
    let vatAmt = new Prisma.Decimal(0);

    if (policy.isVatApplicable && input.isSupplierVatRegistered) {
      vatRate = new Prisma.Decimal(policy.vatRatePercent);
      const calcVat = gross.mul(vatRate).div(100);
      vatAmt = new Prisma.Decimal(calcVat.toFixed(2));
    }

    // Net Payable = Gross + VAT (if added) - WHT (withheld at settlement)
    const netPayable = gross.add(vatAmt);

    return {
      policyId: policy.id,
      whtRatePercent: whtRate,
      whtAmount: whtAmt,
      vatRatePercent: vatRate,
      vatAmount: vatAmt,
      inputVatTreatment: policy.inputVatTreatment,
      netPayableAmount: netPayable
    };
  }

  /**
   * Helper to seed standard default tax policies for a branch
   */
  static async initBranchDefaultTaxPolicies(
    ctx: TenantContext,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || db;
    const existing = await client.taxPolicy.findFirst({
      where: { branchId: ctx.branchId }
    });
    if (existing) return;

    const policies: Array<{
      name: string;
      supplyCategory: SupplyCategory;
      isWhtApplicable: boolean;
      whtRatePercent: number;
      whtThresholdAmount: number;
      isVatApplicable: boolean;
      vatRatePercent: number;
      inputVatTreatment: InputVatTreatment;
    }> = [
      {
        name: "Standard Goods & Store Supplies",
        supplyCategory: SupplyCategory.GOODS,
        isWhtApplicable: true,
        whtRatePercent: 6,
        whtThresholdAmount: 1000000,
        isVatApplicable: true,
        vatRatePercent: 18,
        inputVatTreatment: InputVatTreatment.NON_RECOVERABLE_EXPENSED
      },
      {
        name: "Standard Services & Repairs",
        supplyCategory: SupplyCategory.STANDARD_SERVICES,
        isWhtApplicable: true,
        whtRatePercent: 6,
        whtThresholdAmount: 1000000,
        isVatApplicable: true,
        vatRatePercent: 18,
        inputVatTreatment: InputVatTreatment.NON_RECOVERABLE_EXPENSED
      },
      {
        name: "Management & Professional Services",
        supplyCategory: SupplyCategory.MANAGEMENT_PROFESSIONAL_SERVICES,
        isWhtApplicable: true,
        whtRatePercent: 6,
        whtThresholdAmount: 0, // No threshold for professional services
        isVatApplicable: true,
        vatRatePercent: 18,
        inputVatTreatment: InputVatTreatment.NON_RECOVERABLE_EXPENSED
      },
      {
        name: "Capital Construction Works",
        supplyCategory: SupplyCategory.CONSTRUCTION_WORKS,
        isWhtApplicable: true,
        whtRatePercent: 6,
        whtThresholdAmount: 1000000,
        isVatApplicable: true,
        vatRatePercent: 18,
        inputVatTreatment: InputVatTreatment.NON_RECOVERABLE_CAPITALIZED
      },
      {
        name: "Commercial Bookstore / Trading Arm",
        supplyCategory: SupplyCategory.GOODS,
        isWhtApplicable: true,
        whtRatePercent: 6,
        whtThresholdAmount: 1000000,
        isVatApplicable: true,
        vatRatePercent: 18,
        inputVatTreatment: InputVatTreatment.RECOVERABLE_INPUT_TAX
      }
    ];

    for (const p of policies) {
      await client.taxPolicy.create({
        data: {
          branchId: ctx.branchId,
          name: p.name,
          supplyCategory: p.supplyCategory,
          isWhtApplicable: p.isWhtApplicable,
          whtRatePercent: new Prisma.Decimal(p.whtRatePercent),
          whtThresholdAmount: new Prisma.Decimal(p.whtThresholdAmount),
          isVatApplicable: p.isVatApplicable,
          vatRatePercent: new Prisma.Decimal(p.vatRatePercent),
          inputVatTreatment: p.inputVatTreatment,
          efrisEvidenceRequired: true,
          effectiveFrom: new Date("2026-01-01"),
          isActive: true
        }
      });
    }

    await AuditService.log(ctx, "INIT_DEFAULT_TAX_POLICIES", "TaxPolicy", "SYSTEM", "Initialized default versioned tax policies.");
  }
}
