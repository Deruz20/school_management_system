# NOVA Finance Phase 3.1N — Authoritative Architectural & Accounting Specification
## Accounts Payable (AP), Supplier Credit Management & 3-Way Matching Engine

**Phase:** 3.1N — Accounts Payable / Supplier Credit Management  
**Status:** ARCHITECTURE DESIGN COMPLETE (Definitive Specification with Tax & Discount Patch)  
**Author:** NOVA Architecture & Engineering Team  
**Date:** September 3, 2026  
**Compliance Standards:** Ugandan IFRS / IAS 37 (Provisions & Contingent Liabilities) / IAS 2 (Inventories) / IAS 16 (PPE) / URA Tax Procedures Act (WHT & VAT Regulations)  

---

## 1. Authoritative AP Subledger & Domain Architecture

### 1.1 Separation of Subledger Authority and GL Control
In NOVA, the **Supplier Subledger** is the operational master authority for all vendor debts, credit memos, and payment settlements. The General Ledger account **#2110 (Accounts Payable - Suppliers)** is strictly a summary control account updated via automated, balanced double-entry postings emitted by subledger events.

$$\sum_{s \in \text{Suppliers}} \text{Supplier Subledger Balance}_s \equiv \text{GL Control Account \#2110 Net Balance}$$

$$\sum_{g \in \text{Uninvoiced GRNs}} \text{GRNI Line Uninvoiced Cost}_g \equiv \text{GL Control Account \#2120 Net Balance}$$

```
+---------------------------------------------------------------------------------------------------+
|                            AUTHORITATIVE AP SUBLEDGER ARCHITECTURE                                |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|   +-------------------------------------------------------------------------------------------+   |
|   |                      SUPPLIER MASTER (InventorySupplier / SupplierAccount)                |   |
|   |   - branchId (Strict Multi-Tenant Isolation)                                              |   |
|   |   - supplierCode (Unique per branch: SUP-0001)                                            |   |
|   |   - Tax & Compliance Profile (TIN, VAT Registered, WHT Exemption Status)                  |   |
|   |   - Credit Profile (creditLimitUGX, paymentTermsDays, isCreditBlocked)                    |   |
|   |   - currentBalanceUGX (Denormalized Cache Maintained by Subledger Mutations)              |   |
|   +---------------------------------------------+---------------------------------------------+   |
|                                                 |                                                 |
|             +-----------------------------------+-----------------------------------+             |
|             |                                                                       |             |
|             v                                                                       v             |
|   +---------------------------+                                   +---------------------------+   |
|   |   SUPPLIER INVOICE (Bill) |                                   |   SUPPLIER CREDIT NOTE    |   |
|   |   - Sequence: PINV-YYYY-NN|                                   |   - Sequence: SCRN-YYYY-NN|   |
|   |   - vendorInvoiceNumber   |                                   |   - vendorCreditNoteRef   |   |
|   |   - Status: DRAFT, MATCHED|                                   |   - Price / Defect Return |   |
|   |     APPROVED, PARTIAL,    |                                   |   - Status: DRAFT,        |   |
|   |     PAID, DISPUTED        |                                   |     APPROVED, POSTED      |   |
|   |   - Lines & Allocations   |                                   |   - Line Adjustments      |   |
|   +-------------+-------------+                                   +-------------+-------------+   |
|                 |                                                               |                 |
|                 +-------------------------------+-------------------------------+                 |
|                                                 |                                                 |
|                                                 v                                                 |
|                               +-----------------------------------+                               |
|                               |    SUPPLIER PAYMENT ALLOCATION    |                               |
|                               |   - FIFO or Explicit Line Match   |                               |
|                               |   - Relieves Invoice Outstanding  |                               |
|                               +-----------------+-----------------+                               |
|                                                 |                                                 |
|                                                 v                                                 |
|   +-------------------------------------------------------------------------------------------+   |
|   |                                 ATOMIC SETTLEMENT & TELEMETRY                             |   |
|   |   - TreasuryAccount Mutation (TreasuryDAO.currentBalance Decrement)                       |   |
|   |   - CashbookMovement Creation (Immutable CBM OUTFLOW)                                     |   |
|   |   - GL Journal Posting (GLEngineDAO.postJournalEntry: Dr. #2110 / Cr. #1120, #2140)       |   |
|   |   - AP & GRNI Zero-Drift Telemetry Engines (Mathematical Invariant Verification)          |   |
|   +-------------------------------------------------------------------------------------------+   |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

### 1.2 Subledger Balance Equation
For any vendor $S$ in branch $B$:
$$\text{Supplier Balance}_S = \sum \text{Posted Invoices}_S - \sum \text{Posted Credit Notes}_S - \sum \text{Settled Payments}_S + \sum \text{Debit Adjustments}_S$$

- **Normal Credit Balance ($> 0$):** Liability owed by the school to the vendor.
- **Zero Balance ($= 0$):** All obligations fully settled.
- **Debit Balance ($< 0$):** Net advance prepayment or unapplied credit note held with the vendor.

---

## 2. Supplier Master & Branch Isolation

### 2.1 Unification with Existing `InventorySupplier`
To avoid entity duplication, NOVA unifies the supplier master on the existing `InventorySupplier` table in `prisma/schema.prisma`, extending it with full financial and tax capabilities:

```prisma
model InventorySupplier {
  id                     String    @id @default(cuid())
  branchId               String
  supplierCode           String    // Unique per branch: SUP-KLA-0001
  name                   String
  tradeName              String?
  contactName            String?
  phone                  String
  email                  String?
  address                String?
  
  // Financial & Credit Profile
  currency               String    @default("UGX")
  creditLimitUGX         Decimal   @default(0) @db.Decimal(14, 2)
  paymentTermsDays       Int       @default(30) // Net 0 (COD), Net 15, Net 30, Net 60
  isCreditBlocked        Boolean   @default(false)
  currentBalanceUGX      Decimal   @default(0) @db.Decimal(14, 2)
  
  // Tax & URA Statutory Profile
  taxIdNumber            String?   // URA TIN Number
  vatRegistered          Boolean   @default(false)
  whtExempt              Boolean   @default(false)
  whtExemptionCertRef    String?
  whtExemptionExpiry     DateTime?
  
  // Banking & Settlement Info
  bankName               String?
  bankAccountNumber      String?
  bankBranch             String?
  mobileMoneyNumber      String?
  preferredPaymentMethod PaymentMethod @default(BANK_TRANSFER)
  
  notes                  String?
  isActive               Boolean   @default(true)
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  branch                 Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  
  // Subledger Relations
  pos                    PurchaseOrder[]
  grns                   GoodsReceivedNote[]
  invoices               SupplierInvoice[]
  creditNotes            SupplierCreditNote[]
  payments               SupplierPayment[]
  allocations            SupplierPaymentAllocation[]
  assetItems             AssetItem[]

  @@unique([branchId, supplierCode])
  @@index([branchId, isActive])
  @@index([branchId, name])
}
```

---

## 3. GRN $\rightarrow$ GRNI $\rightarrow$ AP $\rightarrow$ Fixed Asset Lifecycle & Timing

### 3.1 Resolving Prior Asset Capitalization (Phase 3.1M Harmony)
In Phase 3.1M, capital assets may be capitalized from a physical Goods Received Note (`GoodsReceivedItem`) **before** the supplier's formal invoice is received. 

The complete lifecycle across all stages is defined below, proving that the later supplier invoice does **not** duplicate the asset, duplicate asset cost, create duplicate GRNI, or duplicate liabilities:

```
Stage 1: Purchase Order (PO) Issued
  - Operational Authority: Procurement / PurchaseOrderDAO.
  - Subledger Authority: PurchaseOrderItem (Ordered Qty & Unit Price).
  - GL Journal: None (Operational commitment only; budget commitment logged).
  - Treasury / P&L: Zero change.

Stage 2: Goods Received Note (GRN) - Physical Delivery
  - Operational Authority: Storekeeper / InventoryDAO.receiveGoods.
  - Subledger Authority: GoodsReceivedItem (Qty Received, Unit Cost, uninvoicedQty = qtyReceived).
  - GL Journal (GLEngineDAO.postJournalEntry):
      Case A (Stores): Dr. Stores Inventory Asset (#1310) / Cr. Accrued Goods Received (#2120)
      Case B (Capital WIP): Dr. Capital Work in Progress (#1580) / Cr. Accrued Goods Received (#2120)
  - Treasury: Zero change.
  - P&L: Zero change.
  - Idempotency Key: ${branchId}:GRN:${grn.id}:RECEIPT

Stage 3: Capital Asset Capitalization (Phase 3.1M)
  - Operational Authority: Fixed Asset Accountant / AssetDAO.capitalizeFromGRN.
  - Subledger Authority: AssetItem (Status: ACTIVE, acquisitionCost: cost).
  - GL Journal:
      Dr. Fixed Asset Property, Plant & Equipment (#15xx)
        Cr. Capital Work in Progress (#1580)  [or Cr. Accrued Goods Received #2120 if capitalized directly]
  - AssetItem Link: AssetItem.grnId and AssetItem.grnItemId recorded.
  - Treasury: Zero change.
  - P&L: Zero change.
  - Idempotency Key: ${branchId}:ASSET:${asset.id}:GRN_CAPITALIZE

Stage 4: Supplier Invoice Verification & 3-Way Match (Phase 3.1N)
  - Operational Authority: Accounts Payable / SupplierInvoiceDAO.matchAndApprove.
  - Subledger Authority: SupplierInvoiceLine matched against GoodsReceivedItem.
  - Subledger Update: GoodsReceivedItem.invoicedQuantity += Qty, GoodsReceivedItem.uninvoicedQuantity -= Qty.
  - Critical Anti-Duplication Rule: The invoice does NOT touch AssetItem or #15xx!
  - GL Journal:
      Dr. Accrued Goods Received / GRNI (#2120)       [Clears physical receiving liability]
      Dr. Purchase Price Variance (#5900)             [If Invoiced Price > PO/GRN Price]
      Dr. VAT Input Recoverable (#2150)              [If Recoverable VAT applies]
        Cr. Accounts Payable - Suppliers (#2110)      [Establishes formal vendor liability]
        Cr. Purchase Price Variance (#5900)           [If Invoiced Price < PO/GRN Price]
  - Treasury: Zero change.
  - P&L: Only PPV variance is recognized in P&L.
  - Idempotency Key: ${branchId}:AP_INV:${invoice.id}:POST

Stage 5: Supplier Payment Settlement
  - Operational Authority: Finance Director / SupplierPaymentDAO.disbursePayment.
  - Subledger Authority: SupplierPayment & SupplierPaymentAllocation.
  - Treasury Authority: TreasuryAccount.currentBalance (Decremented) & CashbookMovement (CBM OUTFLOW).
  - GL Journal:
      Dr. Accounts Payable - Suppliers (#2110)        [Relieves supplier liability]
        Cr. Withholding Tax Payable (#2140)           [If URA WHT applies]
        Cr. Commercial Bank Account (#1120)           [Net cash disbursed]
        Cr. Early Settlement Discount Income / Asset / Expense [Category-specific discount rule]
  - P&L / Asset: Dependent on underlying purchase category (Section 7).
  - Idempotency Key: ${branchId}:AP_PAY:${payment.id}:DISBURSE
```

---

## 4. GRNI Accounting: Operational Authority & Subledger Record

### 4.1 Operational Authority for Account #2120
GL Account `#2120` is **not** its own authority. The operational authority supporting `#2120` is the collection of **`GoodsReceivedItem` lines** where `uninvoicedQuantity > 0` and `isVoided == false`:

$$\text{GRNI Subledger Total} = \sum_{item \in \text{GRN Items}} (\text{item.uninvoicedQuantity} \times \text{item.unitCostPrice}) \equiv \text{GL Control Account \#2120 Net Balance}$$

### 4.2 GRNI Line Lifecycle
1. **Creation:** On GRN receipt, `uninvoicedQuantity = quantityReceived`, `invoicedQuantity = 0`.
2. **Matching:** On invoice match, `invoicedQuantity += Q_inv`, `uninvoicedQuantity -= Q_inv`.
3. **Price Variance:** Clears `#2120` at original receiving WAC cost; variance is diverted to `#5900 PPV`.
4. **Pre-Invoice Return:** `quantityReceived -= Q_ret`, `uninvoicedQuantity -= Q_ret`.
5. **Closure:** When `uninvoicedQuantity == 0`, line item is fully closed out of the GRNI schedule.

---

## 5. Purchase Price Variance (PPV) Mathematical Model

### 5.1 Dissection of Variances
- **Quantity Variance:** Prevented by 3-way matching ($Q_{\text{inv}} \le Q_{\text{grn}}$). Any excess billed quantity is put on dispute hold.
- **Price Variance (PPV):** Difference between the PO/GRN estimated unit price and the vendor's invoiced unit price.
- **Tax Variance:** Handled separately via tax lines (`#2150 VAT Input` or non-recoverable expense).

### 5.2 Exact Formulas
For line item $k$:
$$\text{GRNI Cleared}_k = Q_{\text{inv}, k} \times P_{\text{grn}, k}$$
$$\text{Gross Invoiced}_k = Q_{\text{inv}, k} \times P_{\text{inv}, k}$$
$$\text{PPV Amount}_k = \text{Gross Invoiced}_k - \text{GRNI Cleared}_k = Q_{\text{inv}, k} \times (P_{\text{inv}, k} - P_{\text{grn}, k})$$

- **Case 1: Unfavorable PPV ($P_{\text{inv}} > P_{\text{grn}}$, $\text{PPV} > 0$):**
  - Debit: `#2120 GRNI Accrual` for $\text{GRNI Cleared}$
  - Debit: `#5900 Purchase Price Variance (Expense)` for $\text{PPV Amount}$
  - Credit: `#2110 Accounts Payable - Suppliers` for $\text{Gross Invoiced}$
- **Case 2: Favorable PPV ($P_{\text{inv}} < P_{\text{grn}}$, $\text{PPV} < 0$):**
  - Debit: `#2120 GRNI Accrual` for $\text{GRNI Cleared}$
  - Credit: `#5900 Purchase Price Variance (Income)` for $|\text{PPV Amount}|$
  - Credit: `#2110 Accounts Payable - Suppliers` for $\text{Gross Invoiced}$

---

## 6. Purchase Returns & Credit Notes Across All Lifecycle States

### 6.1 Matrix of Return Scenarios
```
+-------------------------------------------------------------------------------------------------------+
| Case                              | Operational Action         | GL Accounting Entry                  |
+-----------------------------------+----------------------------+--------------------------------------+
| A. Return BEFORE Supplier Invoice | Storekeeper returns goods  | Dr. Accrued Goods Received (#2120)   |
|    (Pre-Invoice Dock Return)      | GRN uninvoicedQty deducted |   Cr. Stores Inventory Asset (#1310) |
+-----------------------------------+----------------------------+--------------------------------------+
| B. Return AFTER Supplier Invoice  | Supplier issues Credit Note| Dr. Accounts Payable Suppliers (#2110|
|    (Post-Invoice Return)          | SCRN-YYYY-NN created       |   Cr. Stores Inventory Asset (#1310) |
+-----------------------------------+----------------------------+--------------------------------------+
| C. Return with Recoverable VAT    | Credit Note includes tax   | Dr. Accounts Payable Suppliers (#2110|
|                                   | Tax credit calculated      |   Cr. Stores Inventory Asset (#1310) |
|                                   |                            |   Cr. VAT Input Recoverable (#2150)  |
+-----------------------------------+----------------------------+--------------------------------------+
| D. Return with WHT Already Paid   | Credit Note allocated to   | Dr. Accounts Payable Suppliers (#2110|
|                                   | future supplier invoices   |   Cr. Stores Inventory Asset (#1310) |
|                                   | (Net base adjusted on next)|   (WHT adjusted on next tax schedule)|
+-----------------------------------+----------------------------+--------------------------------------+
| E. Return from Fixed Asset Source | Asset decommissioned /     | Dr. Accounts Payable Suppliers (#2110|
|    (Defective Asset Return)       | AssetItem marked RETURNED  |   Cr. Fixed Asset PPE (#15xx)        |
+-----------------------------------+----------------------------+--------------------------------------+
| F. Partial Return / Partial Match | Uninvoiced quantity partial| Proportionate deduction of #2120     |
|                                   | return                     | and #1310 based on exact return units|
+-----------------------------------+----------------------------+--------------------------------------+
```

---

## 7. Category-Specific Early Settlement Discounts

### 7.1 Multi-Category Settlement Discount Accounting Policy
Early settlement discounts (e.g. 2/10 Net 30) must be accounted for according to the economic nature of the underlying purchase rather than applying a single blanket credit.

#### A. Consumable Inventory Purchases (Stores)
- **Standard IAS 2 Treatment:** Early settlement discounts earned on raw stock/inventory reduce the purchase cost of inventory.
- **Journal Entry:**
  - **Debit:** `#2110 Accounts Payable - Suppliers` (Gross Invoice Amount Settled)
  - **Credit:** `#1120 Commercial Bank Account` (Net Cash Paid)
  - **Credit:** `#1310 Stores Inventory Asset` (Discount Amount, if stock is still on hand)  
    *Note:* If inventory has already been completely issued to departments, credit `#5300 Cost of Goods Sold` or `#4920 Finance Discount Income`.

#### B. Department Operating Expenses
- **Treatment:** Directly reduces the corresponding operational expense line.
- **Journal Entry:**
  - **Debit:** `#2110 Accounts Payable - Suppliers` (Gross Invoice Amount Settled)
  - **Credit:** `#1120 Commercial Bank Account` (Net Cash Paid)
  - **Credit:** `#6xxx Department Operating Expense` (Discount Amount, reducing department budget expenditure)

#### C. Fixed Asset Capital Purchases (PPE / IAS 16)
- **Treatment:** Trade and prompt settlement discounts obtained on capital equipment reduce the historical capitalized acquisition cost of the asset.
- **Journal Entry:**
  - **Debit:** `#2110 Accounts Payable - Suppliers` (Gross Invoice Amount Settled)
  - **Credit:** `#1120 Commercial Bank Account` (Net Cash Paid)
  - **Credit:** `#15xx Fixed Asset Account` (Discount Amount, adjusting Asset acquisition cost & depreciable basis)  
    *Note:* If the asset was capitalized in a prior closed financial year, credit `#4920 Other Income` to preserve closed prior-year historical depreciation schedules.

#### D. Direct Service Purchases
- **Treatment:** Directly offsets the service expenditure.
- **Journal Entry:**
  - **Debit:** `#2110 Accounts Payable - Suppliers` (Gross Invoice Amount Settled)
  - **Credit:** `#1120 Commercial Bank Account` (Net Cash Paid)
  - **Credit:** `#6xxx Service Expense Account` (Discount Amount)

### 7.2 Partial-Payment Settlement Discounts
When a partial payment qualifies for a prompt payment discount:
$$\text{Qualifying Base} = \text{Allocated Partial Amount}$$
$$\text{Pro-Rata Discount} = \text{Qualifying Base} \times \text{Discount Rate}$$
$$\text{Net Cash Outflow} = \text{Qualifying Base} - \text{Pro-Rata Discount} - \text{WHT Amount}$$

### 7.3 Payment & Discount Reversal Behavior
If a supplier payment taking an early discount is dishonored or reversed:
- The full gross liability is reinstated to `#2110 Accounts Payable`.
- The bank outflow is debited back to `#1120 Commercial Bank`.
- The discount credit is debited back to the original source account (`#1310`, `#6xxx`, `#15xx`, or `#4920`).

---

## 8. Payment Allocation & Settlement Models

### 8.1 Schema Architecture
```prisma
model SupplierPayment {
  id                   String    @id @default(cuid())
  branchId             String
  paymentNumber        String    // Sequence: SPAY-YYYY-NNNNN
  supplierId           String
  treasuryAccountId    String
  paymentDate          DateTime
  totalAmountPaid      Decimal   @db.Decimal(14, 2)
  whtDeductedAmount    Decimal   @default(0) @db.Decimal(14, 2)
  discountTakenAmount  Decimal   @default(0) @db.Decimal(14, 2)
  unallocatedAmount    Decimal   @default(0) @db.Decimal(14, 2)
  paymentMethod        PaymentMethod
  referenceNumber      String?   // Bank Cheque / EFT Ref
  notes                String?
  status               PaymentStatus @default(COMPLETED)
  journalEntryId       String?
  cashbookMovementId   String?
  createdById          String
  createdAt            DateTime  @default(now())

  supplier             InventorySupplier @relation(fields: [supplierId], references: [id])
  allocations          SupplierPaymentAllocation[]

  @@unique([branchId, paymentNumber])
}

model SupplierPaymentAllocation {
  id                   String    @id @default(cuid())
  branchId             String
  paymentId            String
  invoiceId            String
  allocatedAmount      Decimal   @db.Decimal(14, 2)
  discountAmount       Decimal   @default(0) @db.Decimal(14, 2)
  createdAt            DateTime  @default(now())

  payment              SupplierPayment  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  invoice              SupplierInvoice  @relation(fields: [invoiceId], references: [id])
}
```

---

## 9. Opening AP Balances Migration Architecture

### 9.1 Prevention of Double-Counting
Opening Accounts Payable must establish individual vendor liabilities for aging while balancing against opening equity **without** duplicating aggregate figures:

1. **Option A (Granular Open Invoices):** Each historical open bill is entered into `SupplierInvoice` with `isOpeningBalance: true`. The sum of all opening bills generates **one** compound opening journal:
   $$\text{Dr. Opening Balance Equity (\#3500)} \quad / \quad \text{Cr. Accounts Payable - Suppliers (\#2110)}$$
2. **Option B (Historical GRNI):** Unbilled historical GRNs are recorded in the GRNI schedule with:
   $$\text{Dr. Opening Balance Equity (\#3500)} \quad / \quad \text{Cr. Accrued Goods Received (\#2120)}$$

---

## 10. Dynamic Tax Policy Architecture & Versioning (URA WHT & VAT)

### 10.1 Schema-Driven Tax Policy Engine
Statutory tax rates, withholding thresholds, and supply classifications must **never** be hardcoded into business logic. NOVA implements a temporal, versioned `TaxPolicy` entity supporting effective date windows:

```prisma
enum SupplyCategory {
  GOODS
  STANDARD_SERVICES
  MANAGEMENT_PROFESSIONAL_SERVICES
  CONSTRUCTION_WORKS
  RENT_PREMISES
}

enum InputVatTreatment {
  RECOVERABLE_INPUT_TAX       // Dr. #2150 VAT Input
  NON_RECOVERABLE_EXPENSED    // Dr. #6xxx Operating Expense
  NON_RECOVERABLE_CAPITALIZED // Dr. #1310 Inventory / #15xx Fixed Asset
  EXEMPT                      // No VAT Applicable
}

model TaxPolicy {
  id                          String         @id @default(cuid())
  branchId                    String
  name                        String         // e.g. "URA Statutory Tax Rules 2026/2027"
  supplyCategory              SupplyCategory
  
  // Withholding Tax (WHT) Configuration
  isWhtApplicable             Boolean        @default(true)
  whtRatePercent              Decimal        @default(6.00) @db.Decimal(5, 2)
  whtThresholdAmount          Decimal        @default(1000000.00) @db.Decimal(14, 2) // UGX 1,000,000
  whtTaxableBaseRule          String         @default("GROSS_EXCLUDING_VAT") // GROSS_EXCL_VAT | GROSS_INCL_VAT
  
  // Value Added Tax (VAT) Configuration
  isVatApplicable             Boolean        @default(true)
  vatRatePercent              Decimal        @default(18.00) @db.Decimal(5, 2)
  inputVatTreatment           InputVatTreatment @default(NON_RECOVERABLE_EXPENSED)
  efrisEvidenceRequired       Boolean        @default(true) // Requires EFRIS Fiscal Invoice #
  
  // Temporal Versioning Controls
  effectiveFrom               DateTime
  effectiveTo                 DateTime?      // Null indicates active indefinitely
  isActive                    Boolean        @default(true)
  createdAt                   DateTime       @default(now())
  updatedAt                   DateTime       @updatedAt

  branch                      Branch         @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@index([branchId, supplyCategory, effectiveFrom, effectiveTo])
}
```

### 10.2 Tax Evaluation Engine (`TaxPolicyEngine`)
```typescript
export interface TaxEvaluationInput {
  branchId: string;
  supplyCategory: SupplyCategory;
  transactionDate: Date;
  grossAmount: Prisma.Decimal;
  isSupplierWhtExempt: boolean;
  whtExemptionExpiry?: Date | null;
  isSupplierVatRegistered: boolean;
  hasEfrisInvoice: boolean;
  isDesignatedWithholdingAgent: boolean; // Institutional status
}

export class TaxPolicyEngine {
  static async evaluate(tx: Prisma.TransactionClient, input: TaxEvaluationInput) {
    // 1. Resolve Active Tax Policy by Version & Date Window
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
      // Default Fallback Policy
      return {
        whtRate: new Prisma.Decimal(0),
        whtAmount: new Prisma.Decimal(0),
        vatRate: new Prisma.Decimal(0),
        vatAmount: new Prisma.Decimal(0),
        inputVatTreatment: InputVatTreatment.EXEMPT
      };
    }

    // 2. Evaluate Withholding Tax (WHT)
    let whtRate = new Prisma.Decimal(0);
    let whtAmount = new Prisma.Decimal(0);

    const isExempt = input.isSupplierWhtExempt && input.whtExemptionExpiry && new Date(input.whtExemptionExpiry) >= input.transactionDate;
    
    if (input.isDesignatedWithholdingAgent && policy.isWhtApplicable && !isExempt) {
      if (input.grossAmount.gte(policy.whtThresholdAmount)) {
        whtRate = policy.whtRatePercent;
        whtAmount = new Prisma.Decimal(input.grossAmount.mul(whtRate).div(100).toFixed(2));
      }
    }

    // 3. Evaluate Value Added Tax (VAT)
    let vatRate = new Prisma.Decimal(0);
    let vatAmount = new Prisma.Decimal(0);

    if (policy.isVatApplicable && input.isSupplierVatRegistered) {
      vatRate = policy.vatRatePercent;
      vatAmount = new Prisma.Decimal(input.grossAmount.mul(vatRate).div(100).toFixed(2));
    }

    return {
      whtRate,
      whtAmount,
      vatRate,
      vatAmount,
      inputVatTreatment: policy.inputVatTreatment,
      policyId: policy.id
    };
  }
}
```

---

## 11. School-Specific VAT Boundary

### 11.1 Input VAT Recoverability Rules
Because educational institutions in Uganda operate under mixed VAT rules:
- **Exempt Educational Operations:** School fee tuition, boarding, and curricular books are VAT-exempt. Input VAT on general school supplies is **non-recoverable** and capitalized into the operating expense or inventory cost.
- **Taxable Trading Arms:** Bookstore commercial sales or canteen trading registered for VAT treat input VAT as **recoverable** ($\text{Dr. \#2150 VAT Input Recoverable}$).

---

## 12. Budget Reservation Lifecycle (Phase 3.1G Harmony)

1. **PO Issuance:** Creates `BudgetCommitment` reserving vote head funds (Operational budget lock; no GL P&L effect).
2. **GRN Receipt:** Stores inventory stock created; PO commitment adjusted for partial delivery.
3. **Invoice Verification:** Formal `BudgetConsumption` replaces PO commitment.
4. **Cancellation / Reversal:** PO cancellation or invoice rejection immediately releases reserved vote head budget.

---

## 13. Concurrency & Idempotency Controls

- **GRN Over-Claiming:** Row-level locks (`tx.$queryRaw` or optimistic concurrency on `GoodsReceivedItem.uninvoicedQuantity`) prevent two concurrent invoices from matching the same GRN line.
- **Duplicate Vendor Bills:** Unique composite constraint `@@unique([branchId, supplierId, vendorInvoiceNumber])` blocks duplicate invoice numbers from the same vendor.
- **Concurrent Disbursements:** Mutex lock on `SupplierInvoice.amountOutstanding` ensures two simultaneous payments serialize without overpayment.

---

## 14. Single Source-of-Truth Domain Authority Table

| Domain Entity | Operational Authority | GL Control Account | Treasury Authority | Immutable Record | Reversal Method |
|---|---|---|---|---|---|
| **Supplier Master** | `InventorySupplier` | N/A | N/A | `AuditService` | Deactivate (`isActive: false`) |
| **Goods Received (GRN)**| `GoodsReceivedNote` | `#1310` / `#1580` | None | `GoodsReceivedNote` | Pre-Invoice Return |
| **GRNI Accrual** | `GoodsReceivedItem.uninvoicedQty` | `#2120` GRNI Accrual | None | `GoodsReceivedItem` | Invoice Match / Return |
| **Supplier Invoice** | `SupplierInvoice` | `#2110` AP Suppliers | None | `SupplierInvoice` | `SupplierCreditNote` / Cancel |
| **Supplier Credit Note**| `SupplierCreditNote` | `#2110` AP Suppliers | None | `SupplierCreditNote` | Debit Memo |
| **Supplier Payment** | `SupplierPayment` | `#2110` AP / `#1120` Bank | `TreasuryAccount` | `CashbookMovement` | `PaymentReversal` |
| **WHT Tax Liability** | `SupplierPayment.whtAmount` | `#2140` WHT Payable | None | `SupplierPayment` | Reversal Journal |
| **VAT Input** | `SupplierInvoice.taxAmount` | `#2150` VAT Input | None | `SupplierInvoiceLine` | Credit Note |
| **PPV Variance** | `SupplierInvoice.ppvAmount` | `#5900` PPV Account | None | `SupplierInvoiceLine` | Corrective Journal |
| **Opening AP Balance** | `SupplierInvoice (isOpening)` | `#2110` AP / `#3500` Equity | None | `SupplierInvoice` | Adjusting Journal |

---

## 15. Acceptance Test Matrix

### 15.1 Unit & Integration Tests (`AP-01` .. `AP-28`)
- **AP-01:** Supplier master CRUD with credit limits, payment terms, and TIN.
- **AP-02:** Unique supplier code and duplicate name prevention per branch.
- **AP-03:** Standard 3-Way Match (PO ↔ GRN ↔ Invoice) with exact zero variance.
- **AP-04:** 3-Way Match with Price Variance within tolerance (PPV Dr. `#5900` posting).
- **AP-05:** 3-Way Match with Favorable Price Variance (PPV Cr. `#5900` posting).
- **AP-06:** 3-Way Match with Price Variance exceeding tolerance (Hold/Dispute).
- **AP-07:** Multi-GRN consolidation into a single Supplier Invoice.
- **AP-08:** Partial GRN invoicing and remaining GRNI schedule tracking.
- **AP-09:** Direct Operating Expense bill posting without GRN.
- **AP-10:** Input VAT calculation and recoverable posting to `#2150`.
- **AP-11:** Non-recoverable VAT capitalization into inventory cost.
- **AP-12:** Supplier Payment full settlement with bank cashbook outflow.
- **AP-13:** Supplier Payment partial settlement and outstanding balance tracking.
- **AP-14:** FIFO automated payment allocation across multiple invoices.
- **AP-15:** Explicit invoice line payment allocation.
- **AP-16:** Advance payment with unallocated supplier credit tracking.
- **AP-17:** Dynamic TaxPolicy evaluation (WHT rate & threshold by version/date).
- **AP-18:** WHT exemption certificate validation and automatic bypass.
- **AP-19:** Category-specific early settlement discount (Inventory `#1310`, Expense `#6xxx`, Fixed Asset `#15xx`).
- **AP-20:** Supplier Credit Note issuance and liability relief.
- **AP-21:** Pre-invoice dock return (GRN & `#2120` reversal).
- **AP-22:** Post-invoice purchase return with inventory relief.
- **AP-23:** Opening AP balance bootstrap with balanced `#3500` equity entry.
- **AP-24:** Supplier account statement generation across date range.
- **AP-25:** External vendor statement matching and variance detection.
- **AP-26:** Fixed-Asset GRN invoice match and `#2120` clearing (Phase 3.1M harmony).
- **AP-27:** Live Subledger AP vs GL `#2110` Zero-Drift reconciliation.
- **AP-28:** Live Subledger GRNI vs GL `#2120` Zero-Drift reconciliation.

### 15.2 Adversarial & Concurrency Tests (`ADV-AP-01` .. `ADV-AP-18`)
- **ADV-AP-01:** Concurrent invoice creation on same GRN line rejected.
- **ADV-AP-02:** Duplicate vendor invoice number for same supplier rejected.
- **ADV-AP-03:** Concurrent payment disbursements on same invoice serialized without overpayment.
- **ADV-AP-04:** Payment disbursement on `ON_HOLD` or `DISPUTED` invoice rejected.
- **ADV-AP-05:** Maker self-approval on supplier invoice rejected.
- **ADV-AP-06:** Payment with insufficient treasury balance rejected.
- **ADV-AP-07:** Invoice posting in `CLOSED` or `LOCKED` fiscal period rejected.
- **ADV-AP-08:** Cross-branch supplier invoice access or mutation rejected.
- **ADV-AP-09:** Overbilling beyond available GRN quantity blocked.
- **ADV-AP-10:** Credit note exceeding invoice total rejected.
- **ADV-AP-11:** Unmatched draft invoice GL posting blocked.
- **ADV-AP-12:** Intentional supplier balance tampering detected via telemetry engine.
- **ADV-AP-13:** Decimal(14,2) sub-cent rounding precision under 1,000 invoices.
- **ADV-AP-14:** Replay attack on payment idempotency key rejected.
- **ADV-AP-15:** Vendor credit limit breach warning and enforcement.
- **ADV-AP-16:** Prior capitalized asset unaffected by subsequent invoice match.
- **ADV-AP-17:** Concurrent credit note and payment allocation serialized.
- **ADV-AP-18:** Post-payment return handled without corrupting historical cashbook.

---

## 16. Architecture Sign-Off & Status

```
================================================================================
PHASE 3.1N ARCHITECTURE DESIGN COMPLETE — FINAL PATCH APPLIED
Category-Specific Discounts Mapped | Dynamic Versioned Tax Engine Established
Ready for Implementation Authorization
================================================================================
```
