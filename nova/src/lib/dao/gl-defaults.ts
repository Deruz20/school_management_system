import { GLAccountType, NormalBalance, SystemControlRole } from "@prisma/client";

export interface StandardAccountDef {
  code: string;
  name: string;
  accountType: GLAccountType;
  normalBalance: NormalBalance;
  controlRole?: SystemControlRole;
  isHeader?: boolean;
  parentCode?: string;
  description?: string;
}

export const STANDARD_COA_TEMPLATE: StandardAccountDef[] = [
  // 1000 ASSETS (Header)
  { code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isHeader: true, description: 'All institutional economic resources and property' },
  
  // 1100 Liquid Cash & Bank Equivalents
  { code: '1100', name: 'Cash & Cash Equivalents', accountType: 'ASSET', normalBalance: 'DEBIT', isHeader: true, parentCode: '1000', description: 'Liquid drawer cash, bank accounts and mobile money floats' },
  { code: '1105', name: 'Cash Office Vault Safe', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100', description: 'Central Bursary vault safe balance' },
  { code: '1110', name: 'Cashier Till Drawers', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100', description: 'Front-desk cashier counter till drawers' },
  { code: '1112', name: 'Petty Cash Imprest Floats', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100', description: 'Departmental petty cash imprest floats' },
  { code: '1115', name: 'Cash in Transit', accountType: 'ASSET', normalBalance: 'DEBIT', controlRole: 'CASH_IN_TRANSIT', parentCode: '1100', description: 'Cash banking deposits dispatched but awaiting bank clearance' },
  { code: '1120', name: 'Commercial Bank Accounts', accountType: 'ASSET', normalBalance: 'DEBIT', controlRole: 'CASH_BANK_CONTROL', parentCode: '1100', description: 'Institutional current and collection bank accounts' },
  { code: '1130', name: 'Mobile Money Merchant Float', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100', description: 'School MTN MoMo / Airtel Money merchant floats' },

  // 1200 Receivables
  { code: '1200', name: 'Accounts Receivable - Student Fees', accountType: 'ASSET', normalBalance: 'DEBIT', controlRole: 'AR_STUDENT_CONTROL', parentCode: '1000', description: 'Student fee debtor control account matching active student ledger arrears' },
  { code: '1210', name: 'Staff Salary Advances Receivable', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Short-term advances disbursed to staff' },
  { code: '1220', name: 'Prepaid Expenses & Advances', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Prepayments to vendors and suppliers' },

  // 1300 Inventories
  { code: '1300', name: 'Inventories & Stores', accountType: 'ASSET', normalBalance: 'DEBIT', isHeader: true, parentCode: '1000', description: 'Summary of school store stock and inventory items' },
  { code: '1310', name: 'Stores Inventory Asset (WAC)', accountType: 'ASSET', normalBalance: 'DEBIT', controlRole: 'INVENTORY_STORES_ASSET', parentCode: '1300', description: 'Perpetual store stock valuation at historical Weighted Average Cost' },

  // 1500 Non-Current Assets
  { code: '1500', name: 'Property, Plant & Equipment', accountType: 'ASSET', normalBalance: 'DEBIT', isHeader: true, parentCode: '1000', description: 'Long-term physical campus property and capital assets' },
  { code: '1510', name: 'School Land & Grounds', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1520', name: 'School Buildings & Improvements', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1530', name: 'School Fleet & Transport Buses', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1540', name: 'Furniture, Desks & Fixtures', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1550', name: 'Computers & ICT Equipment', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1560', name: 'Heavy Machinery & Generators', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1580', name: 'Capital Work in Progress (CIP)', accountType: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1600', name: 'Accumulated Depreciation', accountType: 'ASSET', normalBalance: 'CREDIT', controlRole: 'ACCUMULATED_DEPRECIATION_CONTROL', parentCode: '1500', description: 'Contra-asset account tracking cumulative fixed asset depreciation' },

  // 2000 LIABILITIES (Header)
  { code: '2000', name: 'Liabilities', accountType: 'LIABILITY', normalBalance: 'CREDIT', isHeader: true, description: 'All institutional debts and obligations owed to external parties' },
  
  // 2100 Payables
  { code: '2100', name: 'Accounts Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', isHeader: true, parentCode: '2000', description: 'Vendor and supplier liabilities' },
  { code: '2110', name: 'Accounts Payable - Suppliers', accountType: 'LIABILITY', normalBalance: 'CREDIT', controlRole: 'AP_SUPPLIER_CONTROL', parentCode: '2100', description: 'Supplier bill liabilities' },
  { code: '2120', name: 'Accrued Goods Received (GRN Accrual)', accountType: 'LIABILITY', normalBalance: 'CREDIT', controlRole: 'AP_GRN_ACCRUAL', parentCode: '2100', description: 'Physical store goods received via GRN pending voucher payment settlement' },
  { code: '2140', name: 'URA Withholding Tax (WHT) Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', controlRole: 'AP_WHT_PAYABLE', parentCode: '2100', description: 'Withholding tax deducted on supplier payments awaiting URA remittance' },
  { code: '2150', name: 'VAT Input Recoverable Control', accountType: 'LIABILITY', normalBalance: 'DEBIT', controlRole: 'AP_VAT_INPUT_CONTROL', parentCode: '2100', description: 'Input VAT claims on qualifying commercial purchases' },

  // 2200 Payroll Liabilities
  { code: '2200', name: 'Payroll & Statutory Liabilities', accountType: 'LIABILITY', normalBalance: 'CREDIT', isHeader: true, parentCode: '2000', description: 'Staff payroll liabilities and government tax withholdings' },
  { code: '2210', name: 'Net Salaries Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', controlRole: 'PAYROLL_NET_PAY_PAYABLE', parentCode: '2200', description: 'Net take-home remuneration owed to employees' },
  { code: '2220', name: 'URA PAYE Tax Withholding Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', controlRole: 'PAYROLL_PAYE_PAYABLE', parentCode: '2200', description: 'Uganda Revenue Authority PAYE tax withheld awaiting monthly return remittance' },
  { code: '2230', name: 'NSSF Contributions Payable (15%)', accountType: 'LIABILITY', normalBalance: 'CREDIT', controlRole: 'PAYROLL_NSSF_PAYABLE', parentCode: '2200', description: 'Combined 15% NSSF (5% employee + 10% employer) awaiting monthly schedule remittance' },
  { code: '2240', name: 'Staff Welfare & Other Deductions Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2200' },

  // 2300 Deferred & Student Advance Liabilities
  { code: '2300', name: 'Deferred Income & Student Advances', accountType: 'LIABILITY', normalBalance: 'CREDIT', isHeader: true, parentCode: '2000', description: 'Unearned fee revenues and unallocated student prepaid overpayments' },
  { code: '2310', name: 'Student Prepaid Fees & Advances', accountType: 'LIABILITY', normalBalance: 'CREDIT', controlRole: 'AR_PREPAID_ADVANCES', parentCode: '2300', description: 'Unallocated student credit balances and advance fee payments' },

  // 3000 EQUITY & RESERVES (Header)
  { code: '3000', name: 'Equity & Reserves', accountType: 'EQUITY', normalBalance: 'CREDIT', isHeader: true, description: 'Institutional net worth and capital reserves' },
  { code: '3100', name: 'Capital Fund / Initial Endowment', accountType: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000' },
  { code: '3200', name: 'Accumulated Surplus / Retained Earnings', accountType: 'EQUITY', normalBalance: 'CREDIT', controlRole: 'RETAINED_EARNINGS', parentCode: '3000', description: 'Cumulative historical operating surpluses retained in the school' },
  { code: '3300', name: 'Development & Infrastructure Reserve', accountType: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000' },
  { code: '3500', name: 'Opening Balance Equity', accountType: 'EQUITY', normalBalance: 'CREDIT', controlRole: 'OPENING_BALANCE_EQUITY', parentCode: '3000', description: 'Balancing equity account for migrated subledger opening balances' },
  { code: '3600', name: 'Donated Capital & Grants Reserve', accountType: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000', description: 'Capital grants and donated fixed assets equity reserve' },

  // 4000 REVENUE (Header)
  { code: '4000', name: 'Operating Revenues', accountType: 'REVENUE', normalBalance: 'CREDIT', isHeader: true, description: 'Educational fee billings and ancillary institutional income' },
  { code: '4100', name: 'Tuition Fee Revenues', accountType: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000' },
  { code: '4200', name: 'Boarding & Accommodation Fees', accountType: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000' },
  { code: '4300', name: 'Transport & Route Service Fees', accountType: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000' },
  { code: '4400', name: 'Development & Infrastructure Levies', accountType: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000' },
  { code: '4500', name: 'School Bookstore & Uniform Sales', accountType: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000' },
  { code: '4600', name: 'In-Kind Requirements Monetization Fees', accountType: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000' },
  { code: '4700', name: 'Examination, Registration & Medical Fees', accountType: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000' },
  { code: '4800', name: 'Bursary & Scholarship Fee Reductions', accountType: 'REVENUE', normalBalance: 'DEBIT', parentCode: '4000', description: 'Contra-revenue account tracking student discounts and bursary awards' },
  { code: '4910', name: 'Bank Interest Income', accountType: 'REVENUE', normalBalance: 'CREDIT', controlRole: 'BANK_INTEREST_INCOME', parentCode: '4000' },
  { code: '4920', name: 'Prompt Settlement Discounts Earned', accountType: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000', description: 'Discounts realized from early supplier settlements' },
  { code: '4950', name: 'Inventory Stocktake Surplus Income', accountType: 'REVENUE', normalBalance: 'CREDIT', controlRole: 'INVENTORY_SURPLUS_INCOME', parentCode: '4000' },
  { code: '4960', name: 'Gain on Asset Disposal', accountType: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000', description: 'Net gain realized on fixed asset sales above net book value' },

  // 5000 DIRECT COSTS OF EDUCATION (Header)
  { code: '5000', name: 'Direct Costs of Educational Services', accountType: 'DIRECT_COST', normalBalance: 'DEBIT', isHeader: true, description: 'Direct academic, boarding and transport operational costs' },
  { code: '5100', name: 'Curriculum Materials & Examination Costs', accountType: 'DIRECT_COST', normalBalance: 'DEBIT', parentCode: '5000' },
  { code: '5200', name: 'Boarding Food & Kitchen Supplies', accountType: 'DIRECT_COST', normalBalance: 'DEBIT', parentCode: '5000' },
  { code: '5300', name: 'Cost of Goods Sold - Uniforms & Books', accountType: 'DIRECT_COST', normalBalance: 'DEBIT', controlRole: 'INVENTORY_COGS_DEFAULT', parentCode: '5000' },
  { code: '5400', name: 'Fleet Transport Fuel & Lubricants', accountType: 'DIRECT_COST', normalBalance: 'DEBIT', parentCode: '5000' },
  { code: '5900', name: 'Purchase Price Variance (PPV)', accountType: 'DIRECT_COST', normalBalance: 'DEBIT', controlRole: 'AP_PURCHASE_PRICE_VARIANCE', parentCode: '5000', description: 'Price variance between purchase orders/GRNs and approved supplier invoices' },

  // 6000 OPERATIONAL & ADMINISTRATIVE EXPENSES (Header)
  { code: '6000', name: 'Operational & Administrative Expenses', accountType: 'EXPENSE', normalBalance: 'DEBIT', isHeader: true, description: 'Administrative staff salaries, overheads and campus running expenses' },
  { code: '6100', name: 'Teaching Staff Salaries & Allowances', accountType: 'EXPENSE', normalBalance: 'DEBIT', controlRole: 'PAYROLL_WAGES_EXPENSE', parentCode: '6000' },
  { code: '6200', name: 'Non-Teaching & Admin Salaries', accountType: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000' },
  { code: '6300', name: 'Employer Statutory NSSF Contribution (10%)', accountType: 'EXPENSE', normalBalance: 'DEBIT', controlRole: 'PAYROLL_EMPLOYER_NSSF_EXPENSE', parentCode: '6000' },
  { code: '6400', name: 'Fleet Repairs & Vehicle Maintenance', accountType: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000' },
  { code: '6500', name: 'Campus Utilities (Power, Water, Internet)', accountType: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000' },
  { code: '6600', name: 'Building & Facilities Maintenance', accountType: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000' },
  { code: '6710', name: 'Bank Charges & Merchant Processing Fees', accountType: 'EXPENSE', normalBalance: 'DEBIT', controlRole: 'BANK_CHARGES_EXPENSE', parentCode: '6000' },
  { code: '6800', name: 'Inventory Shrinkage & Write-Off Losses', accountType: 'EXPENSE', normalBalance: 'DEBIT', controlRole: 'INVENTORY_SHRINKAGE_EXPENSE', parentCode: '6000' },
  { code: '6900', name: 'Depreciation & Amortization Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT', controlRole: 'DEPRECIATION_EXPENSE_CONTROL', parentCode: '6000', description: 'Periodic depreciation charge on property, plant and equipment' },
  { code: '6950', name: 'Loss on Asset Disposal & Write-Off', accountType: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000', description: 'Net loss recognized on capital asset scrap, damage or under-recovery disposal' }
];
