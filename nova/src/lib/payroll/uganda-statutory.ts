import { Decimal } from '@prisma/client/runtime/library';

/**
 * Uganda Statutory Rule Configuration for NSSF & PAYE tax bands.
 */
export interface StatutoryRuleConfig {
  version: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  nssfEmployeeRate: Decimal; // 0.05 (5%)
  nssfEmployerRate: Decimal; // 0.10 (10%)
  payeBands: Array<{
    min: Decimal;
    max: Decimal | null;
    rate: Decimal;
    baseTax: Decimal;
    excessOver: Decimal;
  }>;
}

/**
 * Versioned Statutory Rules Catalog.
 * Baseline rules valid for Uganda FY 2026/2027 and ongoing under the Uganda Income Tax Act & NSSF Act.
 */
export const UGANDA_STATUTORY_VERSIONS: StatutoryRuleConfig[] = [
  {
    version: 'UG_2026_V1',
    effectiveFrom: new Date('2020-07-01T00:00:00Z'),
    effectiveTo: null, // Current active baseline
    nssfEmployeeRate: new Decimal('0.05'),
    nssfEmployerRate: new Decimal('0.10'),
    payeBands: [
      {
        min: new Decimal('0'),
        max: new Decimal('235000'),
        rate: new Decimal('0.00'),
        baseTax: new Decimal('0'),
        excessOver: new Decimal('0'),
      },
      {
        min: new Decimal('235000'),
        max: new Decimal('335000'),
        rate: new Decimal('0.10'),
        baseTax: new Decimal('0'),
        excessOver: new Decimal('235000'),
      },
      {
        min: new Decimal('335000'),
        max: new Decimal('410000'),
        rate: new Decimal('0.20'),
        baseTax: new Decimal('10000'),
        excessOver: new Decimal('335000'),
      },
      {
        min: new Decimal('410000'),
        max: new Decimal('10000000'),
        rate: new Decimal('0.30'),
        baseTax: new Decimal('25000'),
        excessOver: new Decimal('410000'),
      },
      {
        min: new Decimal('10000000'),
        max: null,
        rate: new Decimal('0.40'),
        baseTax: new Decimal('2902000'),
        excessOver: new Decimal('10000000'),
      },
    ],
  },
];

export class UgandaStatutoryEngine {
  /**
   * Resolves the authoritative statutory configuration for a given date.
   */
  public static getRuleConfig(effectiveDate: Date = new Date()): StatutoryRuleConfig {
    const matched = UGANDA_STATUTORY_VERSIONS.find((v) => {
      const fromMatch = v.effectiveFrom <= effectiveDate;
      const toMatch = v.effectiveTo === null || v.effectiveTo >= effectiveDate;
      return fromMatch && toMatch;
    });

    return matched || UGANDA_STATUTORY_VERSIONS[0];
  }

  /**
   * Calculates Uganda NSSF contributions (Employee 5%, Employer 10%, Total 15%).
   */
  public static calculateNSSF(
    grossCashPay: Decimal,
    effectiveDate: Date = new Date()
  ): {
    employeeNSSF: Decimal;
    employerNSSF: Decimal;
    totalNSSF: Decimal;
  } {
    if (grossCashPay.lessThanOrEqualTo(0)) {
      return {
        employeeNSSF: new Decimal(0),
        employerNSSF: new Decimal(0),
        totalNSSF: new Decimal(0),
      };
    }

    const config = this.getRuleConfig(effectiveDate);
    const employeeNSSF = grossCashPay.times(config.nssfEmployeeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const employerNSSF = grossCashPay.times(config.nssfEmployerRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalNSSF = employeeNSSF.plus(employerNSSF);

    return {
      employeeNSSF,
      employerNSSF,
      totalNSSF,
    };
  }

  /**
   * Calculates Uganda Revenue Authority (URA) Monthly PAYE Tax (Resident Individual).
   */
  public static calculatePAYE(
    taxableMonthlyPay: Decimal,
    effectiveDate: Date = new Date()
  ): Decimal {
    const rule = this.getRuleConfig(effectiveDate);
    if (taxableMonthlyPay.lessThanOrEqualTo(0)) {
      return new Decimal(0);
    }

    for (const band of rule.payeBands) {
      if (band.max === null || taxableMonthlyPay.lessThanOrEqualTo(band.max)) {
        if (band.rate.isZero()) return new Decimal(0);
        const excess = taxableMonthlyPay.minus(band.excessOver);
        const tax = band.baseTax.plus(excess.times(band.rate));
        return tax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
    }

    return new Decimal(0);
  }

  /**
   * Calculates comprehensive itemized payslip breakdown.
   * Enforces zero silent clamping: throws if total deductions exceed gross earnings.
   */
  public static calculatePayslipBreakdown(params: {
    baseSalary: Decimal;
    allowances: Array<{
      componentId?: string;
      code: string;
      name: string;
      amount: Decimal;
      rateApplied?: Decimal | null;
      isTaxable?: boolean;
    }>;
    customDeductions: Array<{
      componentId?: string;
      code: string;
      name: string;
      amount: Decimal;
      rateApplied?: Decimal | null;
    }>;
    effectiveDate?: Date;
  }): {
    baseSalary: Decimal;
    grossSalary: Decimal;
    totalAllowances: Decimal;
    taxablePay: Decimal;
    employeeNSSF: Decimal;
    employerNSSF: Decimal;
    payeTax: Decimal;
    totalDeductions: Decimal;
    netSalary: Decimal;
    employerTotalCost: Decimal;
    calculatedItems: Array<{
      componentId?: string;
      code: string;
      name: string;
      type: 'ALLOWANCE' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
      amount: Decimal;
      rateApplied?: Decimal | null;
      isStatutory: boolean;
      isTaxable: boolean;
    }>;
  } {
    const { baseSalary, allowances, customDeductions, effectiveDate = new Date() } = params;

    let totalAllowances = new Decimal(0);
    let totalNonTaxable = new Decimal(0);

    const calculatedItems: Array<{
      componentId?: string;
      code: string;
      name: string;
      type: 'ALLOWANCE' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
      amount: Decimal;
      rateApplied?: Decimal | null;
      isStatutory: boolean;
      isTaxable: boolean;
    }> = [];

    // 1. Process Allowances
    for (const allow of allowances) {
      const amt = allow.amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalAllowances = totalAllowances.plus(amt);
      if (allow.isTaxable === false) {
        totalNonTaxable = totalNonTaxable.plus(amt);
      }

      calculatedItems.push({
        componentId: allow.componentId,
        code: allow.code,
        name: allow.name,
        type: 'ALLOWANCE',
        amount: amt,
        rateApplied: allow.rateApplied,
        isStatutory: false,
        isTaxable: allow.isTaxable !== false,
      });
    }

    const grossSalary = baseSalary.plus(totalAllowances).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const taxablePay = Decimal.max(0, grossSalary.minus(totalNonTaxable)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // 2. Statutory NSSF
    const { employeeNSSF, employerNSSF } = this.calculateNSSF(grossSalary, effectiveDate);

    if (employeeNSSF.greaterThan(0)) {
      calculatedItems.push({
        code: 'NSSF_EMP',
        name: 'NSSF Employee Contribution (5%)',
        type: 'DEDUCTION',
        amount: employeeNSSF,
        rateApplied: new Decimal(5.0),
        isStatutory: true,
        isTaxable: false,
      });
    }

    if (employerNSSF.greaterThan(0)) {
      calculatedItems.push({
        code: 'NSSF_EMPR',
        name: 'NSSF Employer Contribution (10%)',
        type: 'EMPLOYER_CONTRIBUTION',
        amount: employerNSSF,
        rateApplied: new Decimal(10.0),
        isStatutory: true,
        isTaxable: false,
      });
    }

    // 3. Statutory PAYE Tax
    const payeTax = this.calculatePAYE(taxablePay, effectiveDate);
    if (payeTax.greaterThan(0)) {
      calculatedItems.push({
        code: 'PAYE',
        name: 'URA PAYE Income Tax',
        type: 'DEDUCTION',
        amount: payeTax,
        rateApplied: null,
        isStatutory: true,
        isTaxable: false,
      });
    }

    // 4. Custom Deductions
    let totalCustomDeductions = new Decimal(0);
    for (const ded of customDeductions) {
      const amt = ded.amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalCustomDeductions = totalCustomDeductions.plus(amt);
      calculatedItems.push({
        componentId: ded.componentId,
        code: ded.code,
        name: ded.name,
        type: 'DEDUCTION',
        amount: amt,
        rateApplied: ded.rateApplied,
        isStatutory: false,
        isTaxable: false,
      });
    }

    const totalDeductions = employeeNSSF.plus(payeTax).plus(totalCustomDeductions).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // 5. Validation: Deductions cannot exceed Gross Earnings
    if (totalDeductions.greaterThan(grossSalary)) {
      throw new Error(
        `PAYROLL_CALCULATION_ERROR: Total deductions (UGX ${totalDeductions.toFixed(2)}) exceed gross salary (UGX ${grossSalary.toFixed(2)}). Deductions must be adjusted.`
      );
    }

    const netSalary = grossSalary.minus(totalDeductions).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const employerTotalCost = grossSalary.plus(employerNSSF).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      baseSalary,
      grossSalary,
      totalAllowances,
      taxablePay,
      employeeNSSF,
      employerNSSF,
      payeTax,
      totalDeductions,
      netSalary,
      employerTotalCost,
      calculatedItems,
    };
  }
}
