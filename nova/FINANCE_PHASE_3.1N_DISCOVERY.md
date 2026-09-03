# NOVA Finance Phase 3.1N — Architecture Discovery Document
## Accounts Payable (AP) & Supplier Credit Management Subsystem

**Phase:** 3.1N — Accounts Payable / Supplier Credit Management  
**Status:** READ-ONLY DISCOVERY COMPLETE  
**Author:** NOVA Architecture & Engineering Team  
**Date:** September 3, 2026  
**Compliance Target:** Ugandan IFRS / IAS 37 / IAS 2 / URA Tax Standards & Multi-Campus School Governance  

---

## 1. AP Architecture and Authoritative Supplier Subledger

### 1.1 Core Architectural Principles
The Accounts Payable (AP) subsystem represents the definitive financial subledger for all trade liabilities, vendor credit lines, and procurement obligations in NOVA. The system adheres to strict double-entry accounting where the **Supplier Subledger** is the single source of truth for vendor balances, and the General Ledger **#2110 (Accounts Payable - Suppliers)** serves as the control account.

$$\sum_{i=1}^{n} \text{Supplier Subledger Balance}_i \equiv \text{GL Control Account \#2110 Net Balance}$$

### 1.2 Balance Equation & Subledger Mechanics
For any given vendor $V$ in branch $B$:
$$\text{Supplier Balance}_V = \sum \text{Posted Invoices}_V - \sum \text{Credit Notes}_V - \sum \text{Settled Payments}_V + \sum \text{Debit Adjustments}_V$$

- **Positive Balance:** School owes money to the supplier (Credit liability).
- **Zero Balance:** All obligations fully settled.
- **Negative Balance:** Net debit prepayment or credit note surplus held with vendor.

---

## 2. Supplier/Vendor Master & Branch Isolation

### 2.1 Entity Extension: `SupplierAccount` / `Supplier`
Building on Phase 3.1J's `InventorySupplier`, Phase 3.1N elevates the vendor model into a full financial entity with credit terms, banking details, and tax profiles:

- **Identifiers:** `id`, `branchId` (strict multi-tenant isolation), `supplierCode` (e.g. `SUP-KLA-001`), `legalName`, `tradeName`.
- **Financial Profile:** `currency` (UGX default), `creditLimitUGX`, `paymentTermsDays` (e.g. Net 15, Net 30, Net 60, COD), `defaultExpenseAccountId`, `taxIdentificationNumber` (TIN), `vatRegistered` (Boolean), `whtExempt` (Boolean, with URA Exemption Certificate Ref).
- **Banking / Settlement Profile:** `bankName`, `bankAccountNumber`, `bankBranch`, `mobileMoneyMerchantCode`, `preferredPaymentMethod`.
- **Status & Controls:** `isActive`, `isCreditBlocked` (prevents new POs if overdue), `currentBalanceUGX` (denormalized subledger cache updated atomically).

---

## 3. Supplier Invoices & Credit Notes

### 3.1 `SupplierInvoice` (Vendor Bill)
Represents a formal legal claim for payment from a vendor for goods delivered or services rendered:
- **Header:** `invoiceNumber` (Internal sequence: `PINV-YYYY-NNNNN`), `vendorInvoiceNumber` (Supplier's external tax invoice #), `supplierId`, `branchId`, `invoiceDate`, `dueDate`, `status` (`DRAFT`, `MATCHED`, `APPROVED`, `PARTIALLY_PAID`, `PAID`, `DISPUTED`, `VOIDED`).
- **Amounts:** `grossAmount`, `taxAmount` (VAT), `discountAmount`, `netPayableAmount`, `amountPaid`, `amountOutstanding`.
- **Lines (`SupplierInvoiceLine`):** `poItemId`, `grnItemId`, `expenseCategoryId`, `itemId`, `description`, `quantityInvoiced`, `unitPriceInvoiced`, `lineTotal`, `taxRate`, `glAccountId`.

### 3.2 `SupplierCreditNote` (Vendor Credit Voucher)
Issued when a vendor grants a reduction against an existing invoice due to pricing errors, volume discounts, or returned defective goods:
- **Fields:** `creditNoteNumber` (`SCRN-YYYY-NNN`), `vendorCreditNoteRef`, `originalInvoiceId`, `amount`, `unallocatedAmount`, `reason`, `status` (`DRAFT`, `APPROVED`, `POSTED`, `ALLOCATED`).

---

## 4. Three-Way Matching: PO ↔ GRN ↔ Supplier Invoice

The cornerstone of AP fraud prevention and fiscal governance:

```
+-------------------------------------------------------------+
|                      PURCHASE ORDER                         |
|   (Quantity Authorized: Q_po, Unit Price Negotiated: P_po)  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                   GOODS RECEIVED NOTE (GRN)                 |
|       (Quantity Delivered & Inspected: Q_grn)               |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      SUPPLIER INVOICE                       |
|       (Quantity Billed: Q_inv, Unit Price Billed: P_inv)    |
+-------------------------------------------------------------+
```

### 4.1 Matching Rules & Tolerance Thresholds
1. **Quantity Verification:** $Q_{\text{inv}} \le Q_{\text{grn}} \le Q_{\text{po}} \times (1 + \text{Over-receipt Tolerance})$.
2. **Price Verification:** $P_{\text{inv}} \le P_{\text{po}} \times (1 + \text{Price Variance Tolerance})$.
3. **Tolerance Levels:**
   - $\le 0.5\%$ variance: Automatically matches with minor variance posting.
   - $> 0.5\%$ to $\le 5\%$: Requires Procurement Officer & Accountant verification.
   - $> 5\%$: Invoice automatically enters `ON_HOLD` / `DISPUTED` requiring Bursar approval.

---

## 5. Partial Deliveries and Partial Invoicing

### 5.1 Scenario Handling
- **Multi-GRN Single Invoice:** Vendor bills once for multiple delivery batches under the same PO.
- **Single GRN Multi-Invoice:** Vendor issues progressive milestone bills for a large consignment.
- **Partial GRN Invoicing:** Only the physically received quantity is matched and cleared from `#2120`; remaining PO quantities remain open for subsequent deliveries.

---

## 6. GRN Accrual / AP Clearing Lifecycle

```
1. Physical Receipt (GRN Created):
   Dr. Stores Inventory Asset (#1310) / CIP (#1580)
      Cr. Accrued Goods Received / GRN Clearing (#2120)

2. Supplier Invoice Matched & Posted:
   Dr. Accrued Goods Received / GRN Clearing (#2120)     [Matched GRN Cost]
   Dr. Purchase Price Variance (#5900)                  [If P_inv > P_po]
   Dr. VAT Input Recoverable (#2150)                   [If Tax Applicable]
      Cr. Accounts Payable - Suppliers (#2110)          [Total Net Payable]
      Cr. Purchase Price Variance (#5900)               [If P_inv < P_po]

3. Payment Disbursed:
   Dr. Accounts Payable - Suppliers (#2110)             [Settled Liability]
      Cr. Withholding Tax Payable (#2140)               [If WHT Applicable]
      Cr. Commercial Bank Account (#1120)               [Net Cash Outflow]
```

---

## 7. Supplier Balances and Aging

### 7.1 Real-Time Aging Buckets
Every outstanding supplier invoice is tracked by age based on `dueDate` or `invoiceDate`:
1. **Current (0 – 30 Days):** Due within standard credit terms.
2. **31 – 60 Days Overdue:** Approaching grace period cutoff.
3. **61 – 90 Days Overdue:** Requires Bursar payment scheduling.
4. **90+ Days Overdue:** Critical arrears (risk of vendor supply freeze).

$$\text{Total Vendor Debt} = \text{Current} + \text{Bucket}_{31-60} + \text{Bucket}_{61-90} + \text{Bucket}_{90+}$$

---

## 8. Payment Allocation Against Supplier Liabilities

### 8.1 Allocation Engine
- **FIFO Auto-Allocation:** Unallocated payments automatically extinguish oldest overdue invoices first.
- **Specific Invoice Matching:** Bursar designates specific invoice IDs and partial allocation amounts.
- **Early Settlement Discounts:** Records $\text{Cr. Early Settlement Discount Income (\#4920)}$ if paid within prompt-payment discount window.

---

## 9. Treasury Integration (Phase 3.1K Bridge)

### 9.1 Atomic 3-Way Treasury Mutation
When an AP payment batch or single voucher is executed:
1. Validates liquidity on target `TreasuryAccount` (`CASH_OFFICE_SAFE`, `COMMERCIAL_BANK`, `MOMO_MERCHANT`).
2. Atomically decrements `TreasuryAccount.currentBalance`.
3. Records immutable `CashbookMovement` (`movementType: SUPPLIER_SETTLEMENT`, `direction: OUTFLOW`).
4. Updates `SupplierInvoice.amountPaid` and `SupplierInvoice.amountOutstanding`.
5. Updates `Supplier.currentBalanceUGX`.

---

## 10. GL Posting Matrix

| Transaction Event | Debit Account | Credit Account | Idempotency Format |
|---|---|---|---|
| **Direct Expense Bill** | `#6xxx` Operating Expense | `#2110` Accounts Payable | `${branchId}:AP_INV:${id}:POST` |
| **Inventory GRN Bill** | `#2120` GRN Clearing | `#2110` Accounts Payable | `${branchId}:AP_INV:${id}:POST` |
| **Fixed Asset GRN Bill** | `#2120` GRN Clearing | `#2110` Accounts Payable | `${branchId}:AP_INV:${id}:POST` |
| **PPV (Price Increase)** | `#5900` Purchase Price Var | `#2110` Accounts Payable | Included in invoice journal |
| **PPV (Price Discount)** | `#2120` GRN Clearing | `#5900` Purchase Price Var | Included in invoice journal |
| **Supplier Payment** | `#2110` Accounts Payable | `#10xx` Treasury Bank/Cash | `${branchId}:AP_PAY:${id}:DISBURSE` |
| **WHT Deduction (6%)** | `#2110` Accounts Payable | `#2140` WHT Payable | Included in payment journal |
| **Credit Note / Return** | `#2110` Accounts Payable | `#1310` Stores / `#6xxx` Exp | `${branchId}:AP_CRN:${id}:POST` |

---

## 11. VAT / Tax Treatment (Uganda Compliance)

- **Standard VAT (18%):** If the school is registered for VAT and purchases from a VAT-registered vendor with an EFRIS Tax Invoice, input VAT is debited to `#2150 VAT Input Recoverable`.
- **Non-Recoverable VAT:** For exempt educational purchases, VAT is capitalized directly into item inventory cost or expense account.

---

## 12. Withholding Tax (WHT) Boundary

- **Uganda Income Tax Act Section 119:**
  - 6% Withholding Tax on standard supply of goods and services exceeding UGX 1,000,000.
  - Automatically skipped if `Supplier.whtExempt == true` (with verified URA Withholding Tax Exemption Certificate on file).
- **Remittance Tracking:** Tracked under `#2220` or `#2140 (Withholding Tax Payable)` until monthly URA PRN return remittance.

---

## 13. Purchase Returns / Debit Notes

- **Pre-Invoice Return:** Deducts `quantityReceived` on GRN; inventory stock adjusted with zero AP impact.
- **Post-Invoice Return:** Creates `SupplierCreditNote` / Debit Memo; reduces supplier liability and updates stock via `StockMovementType.SUPPLIER_RETURN`.

---

## 14. Invoice Disputes & Holds

- **Hold Reasons:** `PRICE_MISMATCH`, `QUANTITY_DEFICIT`, `DAMAGED_GOODS`, `MISSING_EFRIS_INVOICE`, `PENDING_QUALITY_APPROVAL`.
- **Control Invariant:** Any invoice with `status: ON_HOLD` or `DISPUTED` cannot be selected for treasury payment disimbursement.

---

## 15. Supplier Statements and Reconciliation

### 15.1 Statement Generation
Produces chronologically ordered statement showing Opening Balance, Invoices, Debit Notes, Payments, Credit Notes, and Closing Balance for any date range $[T_1, T_2]$.

### 15.2 External Vendor Statement Matcher
Upload external vendor PDF/CSV statement $\rightarrow$ Automated match against NOVA AP subledger $\rightarrow$ Highlights unrecorded invoices, missing payments, or disputed amounts.

---

## 16. AP Period Controls

- **FiscalPeriod Rule:** Supplier Invoices, Credit Notes, and Payments can only be posted into an active `FiscalPeriod` where `status === PeriodStatus.OPEN`.
- **Year-End Accruals:** Uninvoiced GRNs at year-end remain in `#2120` as Accrued Goods Received on the Balance Sheet.

---

## 17. Maker-Checker / Approval Workflow

1. **Maker (Accounts Assistant / Storekeeper):** Enters supplier invoice and matches against PO & GRN. Status = `MATCHED`.
2. **Checker (Bursar / Internal Auditor):** Reviews 3-way match, price variance, and tax calculation. Approves invoice $\rightarrow$ `APPROVED`.
3. **Payer (Head Teacher / Finance Director):** Authorizes treasury disbursement $\rightarrow$ `PAID`.
4. **Self-Approval Prohibition:** Maker cannot approve their own supplier invoice.

---

## 18. Idempotency and Concurrency

- **Deterministic Keys:** Every invoice posting and payment disbursement uses immutable idempotency keys (`branchId:AP_INV:${id}:POST`).
- **Concurrent Payment Protection:** Row-level locks (`SELECT ... FOR UPDATE` / transaction client) prevent double-disbursement against the same invoice.

---

## 19. Historical Immutability and Corrections

- **No Destructive Deletions:** Posted supplier invoices and disbursements cannot be deleted or updated in place.
- **Corrections:** Handled via formal `SupplierCreditNote` or `SupplierInvoiceCancellation` with mirrored compensating GL journals.

---

## 20. Budget Integration (Phase 3.1G Bridge)

- Operating supplier invoices against expense categories check available Vote Head allocations in `BudgetDAO`.
- Prevents posting non-procurement direct service bills that exceed approved department budget ceilings without manager override.

---

## 21. Inventory and Fixed-Asset Interactions

- **Inventory Stores (Phase 3.1J):** Stock unit cost price (WAC) adjusted upon invoice price variance clearance if configured.
- **Fixed Assets (Phase 3.1M):** Capital asset items generated from GRNs have their capitalized cost reconciled against the final supplier invoice.

---

## 22. AP-to-GL Reconciliation Telemetry

The AP Telemetry Engine (`APReportsDAO.reconcileAPSubledger`) computes:

$$\text{Subledger Total AP} = \sum_{s \in \text{Suppliers}} \text{s.currentBalanceUGX}$$
$$\text{GL Control Total AP (\#2110)} = \sum \text{Credit Lines}_{\#2110} - \sum \text{Debit Lines}_{\#2110}$$
$$\text{AP Variance} = \text{Subledger Total AP} - \text{GL Control Total AP} \equiv \mathbf{UGX\ 0.00}$$

$$\text{Subledger Total GRN Accrual} = \sum_{\text{Uninvoiced GRNs}} \text{grn.uninvoicedCost}$$
$$\text{GL Control Total GRN Accrual (\#2120)} = \sum \text{Credit Lines}_{\#2120} - \sum \text{Debit Lines}_{\#2120}$$
$$\text{GRN Variance} = \text{Subledger Total GRN Accrual} - \text{GL Control Total GRN Accrual} \equiv \mathbf{UGX\ 0.00}$$

---

## 23. Reporting Requirements

1. **Authoritative Supplier Aged Payables Report** (Summary & Detailed by vendor).
2. **AP vs GL Reconciliation & Drift Telemetry**.
3. **Goods Received Not Invoiced (GRNI) Accrual Schedule**.
4. **Supplier Account Statement (Vendor Ledger)**.
5. **Withholding Tax (WHT) Monthly Deductions Schedule**.
6. **Payment Forecast & Cash Requirements Report** (by upcoming due dates).

---

## 24. RBAC & AuditService

- **Permissions:**
  - `ap:read` (View vendors, invoices, aging)
  - `ap:write` (Create suppliers, draft invoices, match GRNs)
  - `ap:approve` (Four-Eye approval of supplier invoices and credit notes)
  - `ap:disburse` (Authorize and disburse treasury payments to vendors)
  - `ap:reconcile` (Execute AP-to-GL reconciliation and statement matching)
- **Audit Logging:** Every transition logged in `AuditService` (`CREATE_SUPPLIER_INVOICE`, `MATCH_3WAY_INVOICE`, `APPROVE_SUPPLIER_INVOICE`, `DISBURSE_SUPPLIER_PAYMENT`).

---

## 25. Migration Strategy for Existing #2110 / #2120 Balances

1. **Existing GRN Records:**
   - Scan all historical `GoodsReceivedNote` records where `isVoided: false`.
   - Identify GRNs with auto-generated `Expense` records vs unbilled GRNs.
   - For historical GRNs already paired with expense vouchers, mark matching status as `LEGACY_SETTLED` to prevent double-clearing.
2. **Opening Supplier Balances:**
   - Provide an Opening Balance Supplier Import tool:
     $\text{Dr. Opening Balance Equity (\#3500)} / \text{Cr. Accounts Payable - Suppliers (\#2110)}$.

---

## 26. Adversarial and E2E Test Strategy

### 26.1 Unit & Integration Test Matrix (`AP-01` .. `AP-25`)
- Supplier CRUD & credit term configuration.
- 3-Way matching with perfect match.
- 3-Way matching with price variance and PPV posting.
- Partial delivery multi-GRN matching.
- Partial invoicing against single GRN.
- GRN clearing `#2120` to AP `#2110` transition.
- Supplier payment with single/multi-invoice allocation.
- WHT 6% deduction and exemption certificate bypass.
- Credit note creation and liability reduction.
- Supplier statement generation.

### 26.2 Adversarial & Concurrency Test Matrix (`ADV-AP-01` .. `ADV-AP-15`)
- Concurrent invoice posting against the same GRN line (duplicate prevention).
- Concurrent payment disbursements against the same supplier invoice (overpayment prevention).
- 3-Way match price variance above tolerance blocked.
- Payment attempt on `DISPUTED` or `ON_HOLD` invoice rejected.
- Maker self-approval on invoice rejected.
- Payment with insufficient treasury liquidity rejected.
- Cross-branch supplier invoice mutation rejected.
- Closed fiscal period invoice posting rejected.
- Supplier balance drift detection via telemetry engine.

### 26.3 Playwright E2E Suite
- Supplier Directory Hub & Profile Management.
- Invoice Creation & 3-Way Match Modal.
- Bursar Invoice Approval Flow.
- Payment Run & Treasury Disbursement Flow.
- Aged Payables Dashboard & Telemetry Drilldown.

---

## 27. Explicit Out-of-Scope Items for Phase 3.1N

1. **Automated Optical Character Recognition (OCR) / AI Invoice Scraping:** (Deferred to future enhancements; manual/CSV entry supported).
2. **Direct Bank Host-to-Host Electronic Funds Transfer (EFT) API Integration:** (Treasury payments record cashbook movements and generate standard EFT export files).
3. **Multi-Currency Hedging & Foreign Exchange (FX) Gain/Loss:** (All standard school payables are in UGX).
4. **Modifications to Jiddah Smart Report Engine:** Strictly prohibited.

---

## 28. Next Steps & Implementation Readiness

Discovery for Phase 3.1N is fully articulated and ready for formal architecture review and implementation planning.

```
+-------------------------------------------------------------------------+
|                  PHASE 3.1N DISCOVERY GATE PASSED                       |
|   Architectural Scope Mapped | GL & Subledgers Aligned | Zero Drift     |
+-------------------------------------------------------------------------+
```
