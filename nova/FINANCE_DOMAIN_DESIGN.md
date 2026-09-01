# NOVA — FINANCE DOMAIN DESIGN & ARCHITECTURE SPECIFICATION
**Document Status**: Discovery Checkpoint (Read-Only)  
**Target Subsystem**: NOVA Student Accounting, Billing, Payments & Ledger Engine  
**Author**: Antigravity Core Architecture Team  
**Date**: September 2026  

---

## EXECUTIVE SUMMARY

This document establishes the comprehensive domain model, accounting mechanics, and architecture for the **NOVA Finance Subsystem**. NOVA Finance is designed as an authoritative, multi-tenant, auditable financial engine serving schools across the East African education ecosystem (Uganda UGX primary, with multi-currency readiness).

NOVA Finance enforces strict **Ledger Integrity**: balances are reproducible, tamper-evident derivations of immutable ledger transactions (`charges - payments +/- adjustments = balance`). NOVA owns 100% of the accounting logic, balances, invoice calculations, and payment allocations, while presentation layers (such as the Jiddah Smart Report Engine) remain strictly stateless renderers.

---

## 1. LEGACY FINANCE INVENTORY & CAPABILITY CLASSIFICATION

An exhaustive audit of the legacy reference material (`legacy-reference/`) reveals distinct operational modules, explicit workflows, and notable accounting gaps. Every capability is categorized below using the standard classification:
* `[CONFIRMED FROM REFERENCE]`: Explicitly present in legacy UI, forms, tables, scripts, or endpoints.
* `[INFERRED]`: Strongly implied by legacy workflows or data dependencies, but not fully implemented in legacy reference.
* `[NEW NOVA CAPABILITY]`: Required for architectural integrity, robust multi-tenancy, and audit standards in NOVA, but absent or flawed in the legacy system.

---

### 1.1 Capability Matrix

| Module / Capability | Description & Legacy Evidence | Classification |
| :--- | :--- | :--- |
| **Fee Types** | Catalog of fee heads (e.g., Tuition, Development Levy, PTA, Uniform) with name, code/slug, description. | `[CONFIRMED FROM REFERENCE]` |
| **Fee Groups & Templates** | Grouping of multiple Fee Types with default amounts and due dates (e.g. "S.1 Term 1 Standard"). | `[CONFIRMED FROM REFERENCE]` |
| **Class Fee Structures** | Defining fee amounts per Class, Academic Session/Term, and frequency (per term, annual, monthly, one-time). | `[CONFIRMED FROM REFERENCE]` |
| **Fee Allocation to Students** | Assigning fee structures/groups to entire classes, streams/sections, or specific students. | `[CONFIRMED FROM REFERENCE]` |
| **Bulk Invoice Generation** | Batch-generating term invoices for all enrolled students in a class, applying bursary discounts automatically and skipping existing invoices. | `[CONFIRMED FROM REFERENCE]` |
| **Individual Student Invoicing** | Ad-hoc single invoice generation with fee item breakdown and custom total overrides. | `[CONFIRMED FROM REFERENCE]` |
| **Invoice Line Items** | Itemized breakdown of constituent fee heads on each invoice (Tuition, Meals, Boarding). | `[CONFIRMED FROM REFERENCE]` |
| **Invoice Status Lifecycle** | Tracking invoice state: `PENDING`, `PARTIAL`, `PAID`, `OVERDUE`. | `[CONFIRMED FROM REFERENCE]` |
| **Bursaries & Scholarships** | Student-level discounts (percentage or fixed UGX amount) configured with reasons and automatically deducted upon invoicing. | `[CONFIRMED FROM REFERENCE]` |
| **Quick Pay / Direct Payment** | Selecting a student, viewing live term fee/paid/balance summary, entering amount, selecting payment method, recording payment, and printing receipt. | `[CONFIRMED FROM REFERENCE]` |
| **Payment Methods Supported** | Cash, MTN MoMo, Airtel Money, Bank Transfer, Cheque, Credit/Debit Card, Mobile Money Other, SchoolPay. | `[CONFIRMED FROM REFERENCE]` |
| **Payment Reference & Metadata** | Storing external transaction IDs (MoMo TxID, Bank Slip Ref, Cheque #), payment date, and staff notes. | `[CONFIRMED FROM REFERENCE]` |
| **FIFO Invoice Allocation** | Automatic allocation of unallocated payment amounts to the student's oldest unpaid invoice first. | `[CONFIRMED FROM REFERENCE]` |
| **SchoolPay Gateway Sync** | Integration with Uganda SchoolPay aggregator (`support@schoolpay.co.ug`), API sync, webhook receiver (`/api/schoolpay/webhook/{schoolCode}`), payment code matching, and auto-posting. | `[CONFIRMED FROM REFERENCE]` |
| **Student Account Ledger UI** | Student search leading to account view displaying charges, payments, discounts, bursaries, and running balance. | `[CONFIRMED FROM REFERENCE]` |
| **School Expenses Recording** | Recording operational expenses: Title, Category, Amount, Date, Payment Method (Cash, Bank, MoMo), Description. | `[CONFIRMED FROM REFERENCE]` |
| **Monthly & Annual Expense Totals** | Aggregating expenses by current month and year. | `[CONFIRMED FROM REFERENCE]` |
| **Financial Summary Reports** | Billed (gross vs net of discount), Collected, Outstanding, Collection Rate %, Collection by Class, Collection by Term. | `[CONFIRMED FROM REFERENCE]` |
| **Cash Flow 12-Month Chart** | Monthly comparison of fees collected (inflow) vs expenses paid (outflow). | `[CONFIRMED FROM REFERENCE]` |
| **Top Debtors / Outstanding List** | Ranked report of students with highest overdue balances. | `[CONFIRMED FROM REFERENCE]` |
| **HR Payroll Processing** | Generating monthly payroll per staff member with Basic Salary, Allowances, Deductions, Net Salary, Status, and bulk mark-as-paid. | `[CONFIRMED FROM REFERENCE]` |
| **Historical Arrears Carry-Forward**| Unpaid balances from a previous term/year persisting into the next term's opening balance. | `[INFERRED]` |
| **Overpayment / Credit Balances** | Handling payments exceeding the immediate term invoice balance and holding them as unallocated student credit. | `[INFERRED]` |
| **Payment Reversals & Bounced Cheques** | Reversing a dishonored cheque or erroneous payment entry without deleting accounting history. | `[NEW NOVA CAPABILITY]` |
| **Immutable Double-Entry Ledger Engine** | Explicit debit/credit transaction journal guaranteeing zero silent mutations and complete audit reproducibility. | `[NEW NOVA CAPABILITY]` |
| **Formal Credit Notes & Debit Adjustments** | Explicit, authorized accounting documents for fee waivers, bad-debt write-offs, or penalty debits. | `[NEW NOVA CAPABILITY]` |
| **Multi-Tenant Branch Isolation** | Complete structural isolation preventing cross-branch invoice generation, payment allocation, or financial leaks. | `[NEW NOVA CAPABILITY]` |
| **Receipt Sequence Integrity** | Gapless, sequential, tamper-proof receipt numbering per branch (`REC-2026-00001`). | `[NEW NOVA CAPABILITY]` |

---

## 2. CURRENT NOVA DEPENDENCY ANALYSIS

The Finance subsystem does not operate in a vacuum. It sits squarely on top of the established Pilot, Curriculum, and HR Core domains.

```
┌────────────────────────────────────────────────────────┐
│                   ORGANIZATION / TENANT                │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                         BRANCH                         │
└──────┬──────────────┬─────────────┬─────────────┬──────┘
       │              │             │             │
┌──────▼─────┐ ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
│  ACADEMIC  │ │   STUDENT   │ │  STAFF   │ │    RBAC    │
│ Year & Term│ │ & Enrollment│ │  & User  │ │  & Audit   │
└──────┬─────┘ └──────┬──────┘ └────┬─────┘ └─────┬──────┘
       │              │             │             │
       └──────────────┴──────┬──────┴─────────────┘
                             │
            ┌────────────────▼────────────────┐
            │          NOVA FINANCE           │
            │  Fee Structures, Invoices,      │
            │  Payments, Allocations, Ledger  │
            └─────────────────────────────────┘
```

### 2.1 Owned vs. Referenced Entities

| Entity / Domain | Relationship | Finance Responsibility | Owner Domain |
| :--- | :--- | :--- | :--- |
| **Organization / Branch** | `Referenced` | All Finance records must contain an explicit, non-nullable `branchId` and resolve `organizationId` via Branch hierarchy. Cross-branch operations are strictly forbidden. | Multi-Tenancy Core |
| **Student** | `Referenced (Primary Anchor)` | The permanent financial identity is anchored to `Student.id`. Historical balances, payment credits, and ledger entries belong to the Student. | Student Domain |
| **Enrollment** | `Referenced (Context Anchor)` | Invoices and term charges link to an `Enrollment.id` to establish class, stream, academic year, and grade scale context at the time of billing. | Academic Domain |
| **AcademicYear / Term** | `Referenced` | Fee structures, billing cycles, and financial summary reporting are bounded by `AcademicYear.id` and `Term.id`. | Academic Domain |
| **User / Staff** | `Referenced` | `collectedById`, `createdById`, `reversedById`, and `approvedById` link to `User.id` (and optionally `Employee.id`) for cashier accountability. | Auth / HR Core |
| **BranchSettings** | `Referenced` | Reads active academic year/term and currency settings (`UGX`, formatting, receipt headers). | Settings Domain |
| **AuditService** | `Referenced` | All financial lifecycle events (invoicing, payments, adjustments, reversals) emit structured audit logs. | Core Platform |
| **FeeStructure & FeeType** | **`Owned by Finance`** | Authoritative fee definitions, amounts, mandatory/optional flags, and class-level defaults. | **Finance Domain** |
| **Invoice & InvoiceItem** | **`Owned by Finance`** | Immutable billing documents, line items, due dates, discounts, and payment status. | **Finance Domain** |
| **Payment & Allocation** | **`Owned by Finance`** | Authoritative record of money received, payment instrument, reference codes, and link to invoice(s). | **Finance Domain** |
| **StudentLedgerEntry** | **`Owned by Finance`** | The append-only, immutable transaction ledger recording every DEBIT and CREDIT. | **Finance Domain** |
| **Adjustment / Waiver** | **`Owned by Finance`** | Formal credit notes, bursary allocations, fee discounts, and write-offs. | **Finance Domain** |
| **Expense** | **`Owned by Finance`** | Operational branch expenditures and payment disbursements. | **Finance Domain** |

---

## 3. SOURCE OF TRUTH PRINCIPLES

1. **NOVA is the Single Financial Authority**:
   All balances, discounts, penalties, allocations, invoice states, and ledger entries are computed and persisted within NOVA's PostgreSQL database.
2. **Zero Business Calculations in Rendering Engines (Jiddah)**:
   The Jiddah Smart Report Engine is strictly a presentation and document synthesis layer. Jiddah receives fully calculated, immutable DTO snapshots (e.g., `InvoiceDTO`, `ReceiptDTO`, `FeeStatementDTO`). Jiddah NEVER calculates balances, NEVER computes discount rates, and NEVER derives tax or totals.
3. **No Silent Mutation**:
   Balances are NEVER directly edited in the database (`UPDATE student SET balance = ...` is forbidden). Balances change ONLY through the creation of append-only ledger entries.
4. **Idempotent Billing**:
   Bulk billing workflows must be idempotent. Re-running a bulk generation job for Class X in Term 1 must identify already-billed students, apply newly assigned fee structures without duplicating existing ones, and produce zero duplicate charges.

---

## 4. CORE FINANCE CONCEPTS & MINIMUM RECOMMENDED MODEL

Based on legacy evidence and enterprise accounting requirements, NOVA requires the following **lean, high-integrity domain model**:

```
FeeType ──< FeeStructureItem >── FeeStructure (Class/Term Template)
                                      │
                               (Generates)
                                      │
Student ──< Enrollment ──< Invoice ──< InvoiceItem
   │                          │
   │                          ├──< PaymentAllocation >── Payment (Cashier/Gateway)
   │                          │                             │
   │                          └──< Adjustment               │
   │                                                        │
   └───────────────────< StudentLedgerEntry >───────────────┘
                              (DEBIT / CREDIT)
```

### 4.1 Recommended Entity Definitions

1. **`FeeType`**:
   Catalog of fee categories (`Tuition`, `Uniform`, `Boarding`, `Development`, `Lab Fees`). Scoped to Branch.
2. **`FeeStructure` & `FeeStructureItem`**:
   The billing blueprint for a specific `Class` and `AcademicYear` / `Term`. Contains one or more `FeeStructureItem` records with amounts and optionality flags.
3. **`StudentFeeDiscount` (Bursary / Scholarship Rule)**:
   Student-level discount rule (`PERCENTAGE` or `FIXED_AMOUNT`) linked to a Student and optionally scoped to specific `FeeType` or term. Applied automatically during invoice generation.
4. **`Invoice` & `InvoiceItem`**:
   The legal demand for payment.
   * `Invoice`: Student, Enrollment, Term, Gross Amount, Total Discount, Net Amount, Paid Amount, Balance Due, Due Date, Status (`PENDING`, `PARTIAL`, `PAID`, `OVERDUE`, `VOID`).
   * `InvoiceItem`: Line item representing a specific `FeeType`, Unit Amount, Quantity, and Line Total.
5. **`Payment`**:
   A receipted inflow of funds. Contains Amount Received, Payment Date, Payment Method (`CASH`, `BANK_TRANSFER`, `MTN_MOMO`, `AIRTEL_MONEY`, `CHEQUE`, `SCHOOLPAY`), Transaction Reference, Cashier User ID, Receipt Number, and Status (`COMPLETED`, `REVERSED`).
6. **`PaymentAllocation`**:
   Maps a `Payment` to one or more `Invoice` records. If a student pays UGX 1,500,000 against an invoice of UGX 1,000,000, UGX 1,000,000 is allocated to the invoice (settling it to `PAID`), and the unallocated UGX 500,000 sits as an unallocated student credit balance on the ledger.
7. **`StudentAdjustment` (Credit Note / Debit Adjustment)**:
   An explicit, auditable document modifying a student's balance (e.g., fee waiver, administrative correction, damaged property charge).
8. **`StudentLedgerEntry`**:
   The immutable, append-only journal. Every charge (Debit), payment (Credit), discount (Credit), and adjustment (Debit/Credit) creates exactly one ledger entry with running balance verification.
9. **`Expense`**:
   Operational outflows categorized by expense heads (`Utilities`, `Repairs`, `Supplies`, `Salaries`) with payment vouchers and method tracking.

---

## 5. ENTITY RELATIONSHIP DIAGRAM (ERD)

```mermaid
erDiagram
    Branch ||--o{ FeeType : "defines"
    Branch ||--o{ FeeStructure : "configures"
    Branch ||--o{ Invoice : "issues"
    Branch ||--o{ Payment : "receives"
    Branch ||--o{ StudentLedgerEntry : "maintains"
    Branch ||--o{ Expense : "records"

    Class ||--o{ FeeStructure : "has"
    AcademicYear ||--o{ FeeStructure : "applies to"
    Term ||--o{ FeeStructure : "applies to"

    FeeStructure ||--|{ FeeStructureItem : "contains"
    FeeType ||--o{ FeeStructureItem : "categorizes"

    Student ||--o{ Enrollment : "enrolls"
    Student ||--o{ StudentFeeDiscount : "receives"
    Student ||--o{ Invoice : "billed"
    Student ||--o{ Payment : "pays"
    Student ||--o{ StudentAdjustment : "adjusted"
    Student ||--o{ StudentLedgerEntry : "owns"

    Enrollment ||--o{ Invoice : "context for"
    Term ||--o{ Invoice : "billed for"

    Invoice ||--|{ InvoiceItem : "composed of"
    FeeType ||--o{ InvoiceItem : "charges"
    Invoice ||--o{ PaymentAllocation : "settled by"
    Invoice ||--o{ StudentAdjustment : "modified by"

    Payment ||--o{ PaymentAllocation : "distributes"
    User ||--o{ Payment : "cashier"
    User ||--o{ StudentAdjustment : "authorized by"

    StudentLedgerEntry {
        string id PK
        string branchId FK
        string studentId FK
        string transactionType "INVOICE_CHARGE, PAYMENT, DISCOUNT, ADJUSTMENT, REFUND"
        string entryType "DEBIT, CREDIT"
        decimal amount
        decimal balanceAfter
        string referenceType "Invoice, Payment, Adjustment"
        string referenceId
        datetime timestamp
    }
```

---

## 6. ACADEMIC YEAR / TERM RELATIONSHIP & STUDENT MOBILITY

### 6.1 Billing Period Anchoring
* Fees in East African primary and secondary schools are predominantly structured **per Term** (Term 1, Term 2, Term 3) within an **Academic Year**, with certain annual fees billed in Term 1 (e.g. Registration, PTA, Insurance).
* Invoices must link to both `AcademicYearId` and `TermId` to enable term-wise fee tracking and statutory financial closure.

### 6.2 Student Mobility & Mid-Term Adjustments
1. **Late Joiners**:
   * Students admitted mid-term can be billed via custom individual invoices or automated pro-rated fee structures.
   * Fee structures can mark specific items as `isProrated` or `oneTime`.
2. **Student Transfers / Dropouts**:
   * If a student transfers to another branch or drops out, their invoice is not deleted.
   * A formal `StudentAdjustment` (Credit Note / Waiver) is issued with reason code `STUDENT_TRANSFERRED` or `WITHDRAWAL`, reducing the outstanding balance to zero while retaining complete historical audit records.
3. **Historical Ledger Follows Student Identity**:
   * While an invoice is linked to an `Enrollment` (which captures Class S.1 North in 2026), the **financial liability and payment history belong to the `Student`**.
   * When a student progresses from S.1 to S.2 in a new academic year, any unpaid balance from S.1 carries forward as an `OPENING_BALANCE` / Arrears entry on the student's continuous ledger.

---

## 7. LEDGER INTEGRITY & ACCOUNTING ENGINE

### 7.1 The Invariant Formula
For any student at any given point in time $T$, the balance must satisfy:

$$\text{Outstanding Balance} = \sum \text{Charges (Debits)} - \sum \text{Payments (Credits)} - \sum \text{Discounts/Waivers (Credits)} + \sum \text{Debit Adjustments (Debits)}$$

### 7.2 Append-Only Ledger Design
* Balances are **never silently overwritten**.
* Every financial transaction writes a row to `StudentLedgerEntry`:

```typescript
export enum LedgerEntryType {
  DEBIT = 'DEBIT',   // Increases student debt (Invoice charges, Returned cheques)
  CREDIT = 'CREDIT'  // Decreases student debt (Payments, Bursaries, Waivers)
}

export enum LedgerTransactionType {
  INVOICE_CHARGE = 'INVOICE_CHARGE',
  PAYMENT = 'PAYMENT',
  BURSARY_DISCOUNT = 'BURSARY_DISCOUNT',
  CREDIT_ADJUSTMENT = 'CREDIT_ADJUSTMENT',
  DEBIT_ADJUSTMENT = 'DEBIT_ADJUSTMENT',
  PAYMENT_REVERSAL = 'PAYMENT_REVERSAL',
  REFUND = 'REFUND'
}
```

### 7.3 Balance Verification Strategy (Calculated vs Cached)
1. **Primary Source of Truth**: Calculated dynamically by aggregating ledger entries (`SUM(DEBITS) - SUM(CREDITS)`).
2. **Performance Snapshotting**:
   * Each `StudentLedgerEntry` stores `balanceAfter` (the running balance at that exact moment).
   * An optional materialized balance cache on `StudentAccount` can be maintained for millisecond-latency UI listings, but it is **strictly treated as a cache**. A background integrity verification service checks `cache == SUM(ledger)` and flags discrepancies immediately.

---

## 8. BILLING & INVOICE LIFECYCLE

```
┌────────────────────────────────────────────────────────┐
│ 1. FEE STRUCTURE CONFIGURATION                         │
│ Define Class S.1 Term 1: Tuition (800k), Boarding (400k)│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. BULK / INDIVIDUAL BILLING TRIGGER                   │
│ Admin initiates billing for Class S.1, Term 1, 2026     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. INVOICE GENERATION & DISCOUNT RESOLUTION            │
│ For each active student:                               │
│ - Create Invoice (Gross: 1,200,000)                    │
│ - Check StudentFeeDiscount (e.g. 50% Bursary)          │
│ - Net Amount = 600,000; Due Date = 2026-02-15          │
│ - Post DEBIT to StudentLedgerEntry                     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. INVOICE STATUS TRACKING                             │
│ PENDING ──[Partial Pay]──► PARTIAL ──[Full Pay]──► PAID│
│    │                                                   │
│    └──[Date > DueDate & Bal > 0]──► OVERDUE            │
└────────────────────────────────────────────────────────┘
```

### 8.1 Bulk Billing Pipeline
1. Fetch all active `Enrollment` records for the target `Class` in `AcademicYear`.
2. Retrieve the active `FeeStructure` for the class/term.
3. For each student:
   * Check if an active invoice already exists for this student in this term. If yes, skip to prevent duplicates.
   * Calculate line items from `FeeStructureItem`.
   * Apply any active `StudentFeeDiscount`.
   * Save `Invoice` and `InvoiceItem` records.
   * Write `INVOICE_CHARGE` debit entry to `StudentLedgerEntry`.
   * If bursary applied, write `BURSARY_DISCOUNT` credit entry linked to the invoice.
4. Record bulk generation summary in `AuditLog`.

---

## 9. PAYMENT LIFECYCLE & ALLOCATION MECHANICS

```
┌────────────────────────────────────────────────────────┐
│ 1. PAYMENT RECEIVED                                    │
│ Parent pays UGX 1,000,000 via Cash / MoMo / Bank / Web │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. PAYMENT RECORD CREATION                             │
│ - Save Payment record with receiptNumber: REC-2026-0042│
│ - Post CREDIT of 1,000,000 to StudentLedgerEntry       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. INVOICE ALLOCATION (FIFO or Explicit)               │
│ - Fetch unpaid invoices ordered by dueDate ASC (FIFO)  │
│ - Oldest Invoice #INV-001 (Balance: 600,000):          │
│     -> Allocate 600,000 -> Status = PAID               │
│ - Current Invoice #INV-002 (Balance: 800,000):         │
│     -> Allocate 400,000 -> Status = PARTIAL            │
│ - Remaining Unallocated = 0                            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. RECEIPT GENERATION & AUDIT                          │
│ - Issue formal Receipt snapshot                        │
│ - Log PAYMENT_RECORDED in AuditLog                     │
└────────────────────────────────────────────────────────┘
```

### 9.1 Overpayment & Advance Payments
* If a payment exceeds total outstanding invoice debt (e.g. paying UGX 2,000,000 when debt is UGX 1,500,000):
  1. All unpaid invoices are fully settled to `PAID`.
  2. The remaining UGX 500,000 remains in `Payment.unallocatedAmount`.
  3. The student's overall ledger reflects a negative balance (Credit / In Advance: -500,000 UGX).
  4. When the next term's invoice is generated, the unallocated payment credit is automatically applied to settle the new invoice.

### 9.2 Payment Reversal Workflow
* If a cheque bounces or a mobile money transaction is charged back:
  1. The original `Payment` status is marked `REVERSED`.
  2. All `PaymentAllocation` records associated with that payment are invalidated, and affected invoices revert to `PARTIAL` or `PENDING` status.
  3. A compensating `PAYMENT_REVERSAL` (Debit) entry is posted to `StudentLedgerEntry`.
  4. No records are deleted; complete audit trail is preserved.

---

## 10. DISCOUNTS, WAIVERS & ADJUSTMENTS

Discounts and adjustments modify amounts legally and transparently without rewriting original transaction records.

| Type | Mechanism | Impact on Ledger | Requires Approval? |
| :--- | :--- | :--- | :--- |
| **Bursary / Scholarship** | Configured rule applied during invoice generation. Creates line item deduction on invoice. | `CREDIT` (`BURSARY_DISCOUNT`) | Yes (Setup role) |
| **Credit Note / Fee Waiver** | Issued against an existing invoice (e.g. student left early, administrative relief). | `CREDIT` (`CREDIT_ADJUSTMENT`) | Yes (`fees:adjust`) |
| **Debit Adjustment / Penalty** | Issued to charge extra fees (e.g. damaged lab equipment, library fine, late fee). | `DEBIT` (`DEBIT_ADJUSTMENT`) | Yes (`fees:adjust`) |
| **Write-Off (Bad Debt)** | Settles uncollectible historical balance when student graduates/leaves without payment. | `CREDIT` (`CREDIT_ADJUSTMENT`) | Elevated Admin Only |

---

## 11. FINANCE RBAC SPECIFICATION

NOVA Finance integrates directly into the established Phase 1 RBAC system ([src/lib/dao/rbac.dao.ts](file:///c:/Users/USER/Desktop/school_management_system/nova/src/lib/dao/rbac.dao.ts)). No secondary authorization engine is introduced.

### 11.1 Permission Strings Matrix

| Permission String | Description | Typical Roles |
| :--- | :--- | :--- |
| `fees:read` | View fee structures, invoices, payment history, and student ledgers. | Admin, Bursar, Accountant, Head Teacher, Teacher |
| `fees:collect` | Record cash/bank payments, print receipts, view live student balance. | Admin, Bursar, Cashier, Accountant |
| `fees:invoices:write` | Generate bulk invoices, create individual invoices, void uncommitted invoices. | Admin, Bursar, Head Accountant |
| `fees:structure:write` | Create, edit, or delete fee structures, fee types, and class fee templates. | Admin, Director, Finance Manager |
| `fees:discount:write` | Assign student bursaries, scholarships, and fee concessions. | Admin, Director, Head Teacher |
| `fees:adjust` | Issue formal credit notes, debit adjustments, and waive penalties. | Admin, Finance Manager *(Elevated)* |
| `fees:reverse` | Reverse recorded payments (bounced cheques, chargebacks). | Admin, Finance Director *(Elevated)* |
| `expenses:read` | View branch expenses, expense categories, and monthly outflow summaries. | Admin, Bursar, Accountant |
| `expenses:write` | Record new branch expenses, upload vouchers, manage expense heads. | Admin, Bursar, Accountant |
| `finance:reports:view` | Access financial summary reports, collection analytics, debtor aging, cash flow. | Admin, Director, Head Teacher, Bursar |
| `finance:gateway:manage` | Configure SchoolPay/payment gateway credentials, sync schedules, and webhooks. | Admin, IT Administrator *(Elevated)* |

### 11.2 Sensitive Actions Requiring Elevated Protection
The following actions cannot be performed by general staff or basic cashiers and require explicit elevated permissions or admin role:
1. **Reversing a Payment**: Reverting a settled payment (`fees:reverse`).
2. **Waiving / Writing Off Debt**: Issuing a credit note that eliminates debt without cash inflow (`fees:adjust`).
3. **Modifying Active Fee Structures**: Changing amounts on fee structures that already have issued invoices (`fees:structure:write`).
4. **Gateway Credential Updates**: Modifying SchoolPay API secrets (`finance:gateway:manage`).

---

## 12. AUDIT TRAIL REQUIREMENTS

Every mutating financial operation MUST trigger `AuditService.log(ctx, action, resourceType, resourceId, details)`.

### 12.1 Mandatory Audit Events

| Action Code | Resource Type | Details Payload (JSON) |
| :--- | :--- | :--- |
| `CREATE_FEE_STRUCTURE` | `FeeStructure` | `{ classId, termId, totalAmount, itemsCount }` |
| `UPDATE_FEE_STRUCTURE` | `FeeStructure` | `{ structureId, modifiedFields, oldTotal, newTotal }` |
| `GENERATE_BULK_INVOICES` | `InvoiceBatch` | `{ classId, termId, studentCount, totalBilled, totalDiscount }` |
| `CREATE_INVOICE` | `Invoice` | `{ studentId, invoiceNumber, netAmount, dueDate }` |
| `VOID_INVOICE` | `Invoice` | `{ invoiceId, reason, originalAmount }` |
| `RECORD_PAYMENT` | `Payment` | `{ studentId, paymentId, amount, method, receiptNumber, reference }` |
| `REVERSE_PAYMENT` | `Payment` | `{ paymentId, reason, reversedById, originalAmount }` |
| `ISSUE_ADJUSTMENT` | `StudentAdjustment`| `{ studentId, type, amount, reason, authorizedById }` |
| `ASSIGN_BURSARY` | `StudentFeeDiscount`| `{ studentId, discountType, value, reason }` |
| `RECORD_EXPENSE` | `Expense` | `{ title, category, amount, paymentMethod, expenseDate }` |
| `UPDATE_GATEWAY_CONFIG` | `BranchSettings` | `{ gateway: 'SchoolPay', enabled, schoolCode }` *(Never log passwords!)* |

> [!CAUTION]
> Under no circumstances may payment gateway passwords, API secrets, bank account PINs, or credit card numbers be included in `details` or stored in `AuditLog`.

---

## 13. MULTI-BRANCH TENANT ISOLATION

NOVA enforces hard multi-tenancy at the database and DAO layers:
1. **Tenant Filtering**: Every query in Finance DAOs must filter by `branchId: ctx.branchId`.
2. **Cross-Branch Prevention**:
   * An invoice issued in Branch A cannot be paid in Branch B.
   * A fee structure defined in Branch A is invisible and inaccessible to Branch B.
   * A student transferring from Branch A to Branch B starts a new branch account ledger in Branch B. Arrears transfer (if agreed by school management) requires an explicit inter-branch journal entry.
3. **Foreign Key Integrity**:
   Foreign key relationships from `Invoice`, `Payment`, `FeeStructure`, `StudentLedgerEntry`, and `Expense` link strictly to `Branch.id` with `onDelete: Cascade` or restricted constraints.

---

## 14. REPORTING & JIDDAH INTEGRATION BOUNDARY

The Finance domain produces authoritative data snapshots; the **Jiddah Smart Report Engine** consumes DTOs and handles formatting, typography, branding, and printing.

```
┌────────────────────────────────────────────────────────┐
│                   NOVA FINANCE ENGINE                  │
│ Calculates: totals, line items, discounts, balances,   │
│ arrears, cashier names, receipt timestamps.            │
└───────────────────────────┬────────────────────────────┘
                            │ Pure JSON / DTO
                            ▼
┌────────────────────────────────────────────────────────┐
│               JIDDAH SMART REPORT ENGINE               │
│ Renders:                                               │
│ 1. Student Fee Invoice (Official school letterhead)    │
│ 2. Payment Receipt (Thermal slip or A4 voucher)        │
│ 3. Student Account Statement / Ledger Summary          │
│ 4. Term Fee Clearance Slip / Exam Permit Card          │
│ 5. Branch Financial Summary & Debtors Aging Report     │
└────────────────────────────────────────────────────────┘
```

---

## 15. FUTURE PAYROLL BOUNDARY

While Payroll implementation is deferred, the boundary between HR Core and Finance is clearly defined:
* **HR Core Owns**: Employee identity, department, designation, salary grade/contract rate, joined/terminated dates ([prisma/schema.prisma:500-572](file:///c:/Users/USER/Desktop/school_management_system/nova/prisma/schema.prisma#L500-L572)).
* **Finance Will Own**:
  * Payroll Run execution (`PayrollPeriod`, `PayrollSlip`).
  * Disbursement records (`Expense` line items categorized as `Salaries & Wages`).
  * Employee salary advances or staff loan ledgers.
* **No Duplicate Data**: Finance will reference `Employee.id` directly and never duplicate staff demographic details.

---

## 16. MIGRATION & DATA RESILIENCE IMPLICATIONS

When migrating legacy schools (or testing initial datasets):
1. **Historical Balance Initialization**:
   * For existing students with outstanding legacy balances, an `OPENING_BALANCE` debit transaction is posted to `StudentLedgerEntry` for the start of the migration term.
2. **Legacy Receipt Continuity**:
   * Next receipt number sequence will be initialized from the highest existing legacy receipt number to avoid numbering collisions.
3. **Idempotent Seeding**:
   * Seed scripts must establish default `FeeType` records (`Tuition`, `Development`, `Boarding`, `Uniform`), sample `FeeStructure` templates, and baseline invoices without violating unique constraints on multiple runs.

---

## 17. RECOMMENDED IMPLEMENTATION SEQUENCE

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: Core Configuration & Catalogs                            │
│ Prisma Schema: FeeType, FeeStructure, FeeStructureItem           │
│ DAO + API + UI: Fee Types catalog & Class Fee Structure builder  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│ STEP 2: Invoicing & Billing Engine                               │
│ Prisma Schema: Invoice, InvoiceItem, StudentFeeDiscount          │
│ DAO + Logic: Bulk Class Invoicing, Individual Invoice builder    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│ STEP 3: Immutable Ledger Engine                                  │
│ Prisma Schema: StudentLedgerEntry                                │
│ DAO + Invariants: Append-only transaction posting & verification │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│ STEP 4: Payment Capture, Allocation & Receipts                   │
│ Prisma Schema: Payment, PaymentAllocation                        │
│ DAO + UI: Quick Pay, Cashier modal, FIFO Allocation, Receipts    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│ STEP 5: Adjustments, Bursaries & Waivers                         │
│ Prisma Schema: StudentAdjustment                                 │
│ DAO + UI: Credit Notes, Debit Adjustments, Bursary Management    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│ STEP 6: School Expenses & Cash Flow                              │
│ Prisma Schema: Expense                                           │
│ DAO + UI: Expense tracking, Category breakdowns                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│ STEP 7: Financial Reporting & Statements                         │
│ DAO + Analytics: Collection rates, Debtors list, Statements      │
│ DTO Builders for Jiddah printing (Invoices, Receipts, Statements)│
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│ STEP 8: Payment Gateway Integration (SchoolPay)                  │
│ API Webhook Receiver, Reconciliation Engine, Auto-posting        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 18. OPEN DECISIONS & ARCHITECTURAL TRADE-OFFS

1. **Trade-Off: Strict FIFO Allocation vs. Manual Item-Level Allocation**:
   * *Recommendation*: Use **Automated FIFO Allocation** (oldest invoice first) as the default for all standard cashiering and automated gateway payments, while providing an optional "Advanced Allocation" toggle for accountants needing to apply money specifically to a designated fee item (e.g. Uniform or Field Trip).
2. **Decision: Term Invoice vs. Continuous Open Account**:
   * *Recommendation*: Support **Term Invoices anchored to a Continuous Student Account**. Invoices represent legal term demands, while the Student Ledger preserves a continuous lifetime running balance across terms and academic years.
3. **Decision: Currency Precision**:
   * *Recommendation*: Use integer representation or `Decimal(12, 2)` for amounts in PostgreSQL/Prisma. In Uganda (UGX), decimals are rarely used, but `Decimal(12, 2)` guarantees international and multi-currency compatibility.

---

## 19. HIGHEST-PRIORITY FINANCE IMPLEMENTATION CHECKPOINT

When execution begins, the immediate **Phase 3.1 Finance Foundation Checkpoint** will focus strictly on:
1. Adding `FeeType`, `FeeStructure`, `FeeStructureItem`, `StudentFeeDiscount`, `Invoice`, `InvoiceItem`, `Payment`, `PaymentAllocation`, and `StudentLedgerEntry` models to `prisma/schema.prisma`.
2. Implementing `FeeStructureDAO` and `InvoiceDAO` with unit test coverage.
3. Implementing `StudentLedgerDAO` with invariant balance verification tests.
4. Implementing the Cashier Payment & Receipt flow with FIFO allocation.

---
*End of Specification — Prepared for Phase 3 Execution Review.*
