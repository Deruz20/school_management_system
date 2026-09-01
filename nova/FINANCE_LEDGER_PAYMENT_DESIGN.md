# NOVA — FINANCE PHASE 3.1C ARCHITECTURE: STUDENT SUBLEDGER, PAYMENTS, FIFO ALLOCATION & RECEIPTS

**Document Status**: Authoritative Architecture Specification (Revised)  
**Target Subsystem**: NOVA Student Accounts Receivable (AR) Subsidiary Ledger, Payment Capture, FIFO Allocation, Receipts & Reversals  
**Author**: Antigravity Core Architecture Team  
**Date**: September 2026  
**Verified GitHub Checkpoint Baseline**: `50cc194` (`feat: add finance invoicing and billing`)

---

## 1. SCOPE & SUBLEDGER ARCHITECTURAL CLARIFICATION

### 1.1 Student Subsidiary Ledger (AR Subledger) vs. General Ledger
Phase 3.1C explicitly implements a **Student Subsidiary Ledger (Accounts Receivable Subledger)**.
- **What Phase 3.1C IS**: An authoritative, transaction-level subsidiary journal that tracks individual student receivables, charges, bursary credits, payments, refunds, and running balances for every student enrolled in a branch.
- **What Phase 3.1C IS NOT**: It is **not** a general-ledger double-entry system with a complete Chart of Accounts (COA) spanning Assets, Liabilities, Equity, Revenue, and Expense balance sheets. 
- **Accounting Terminology**: The journal entries in this subsystem are **Student Subsidiary Ledger Entries** (`StudentLedgerEntry`). Every entry is single-anchor (anchored to `studentId` and `branchId`) with explicit `DEBIT` (student owes more) or `CREDIT` (student owes less) directionality.

---

## 2. INVOICE & BURSARY POSTING SEMANTICS

To maintain GAAP-compliant accounts receivable integrity, an issued invoice posts gross billing charges and bursary credits separately to the student subledger.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     INVOICE ISSUED (e.g. S.1 Term 1)                    │
│  Gross Amount: UGX 1,000,000  |  Discount: UGX 400,000  |  Net: 600,000 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│ POST: INVOICE_GROSS_CHARGE       │   │ POST: BURSARY_CREDIT             │
│ direction: DEBIT                 │   │ direction: CREDIT                │
│ amount: invoice.grossAmount      │   │ amount: invoice.discountAmount   │
│ (UGX 1,000,000)                  │   │ (UGX 400,000)                    │
│ ref: ("INVOICE", invoice.id)     │   │ ref: ("BURSARY", invoice.id)     │
└──────────────────────────────────┘   └──────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│           NET RECEIVABLE EFFECT ON STUDENT SUBLEDGER                    │
│       Debits (1,000,000) - Credits (400,000) = Net Debt (UGX 600,000)   │
│              Student Receivable exactly equals Invoice.netAmount         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Ledger Posting Rules for Invoices
1. **Gross Debit**: When an invoice is issued, an `INVOICE_GROSS_CHARGE` entry is posted (`direction: DEBIT`, `amount = invoice.grossAmount`).
2. **Bursary Credit**: If `invoice.discountAmount > 0`, a corresponding `BURSARY_CREDIT` entry is posted in the same transaction (`direction: CREDIT`, `amount = invoice.discountAmount`).
3. **Net Agreement**: $\text{Net Receivable Increase} = \text{grossAmount} - \text{discountAmount} \equiv \text{invoice.netAmount}$.
4. **Zero-Discount Invoices**: When an invoice has zero discount, only the `INVOICE_GROSS_CHARGE` debit is posted.

---

## 3. AUTHORITATIVE RELATIONSHIP & COHERENCE MODEL

To ensure that no second hidden balance system ever emerges, the authoritative relationships between all financial entities are defined mathematically below:

```
┌──────────────────────────────┐          ┌──────────────────────────────┐
│       StudentLedgerEntry     │          │           Invoice            │
│   (Authoritative Journal)    │          │     (Billing Obligation)     │
│                              │          │                              │
│ ∑ Debits - ∑ Credits         │          │ netAmount = gross - discount │
│        ║                     │          │ paidAmount = ∑ Allocations   │
│        ║                     │          │ outstanding = net - paid     │
│        ▼                     │          │ status = PENDING/PARTIAL/PAID│
│   STUDENT BALANCE            │          └──────────────┬───────────────┘
│   (Receivable/Credit)        │                         │
└──────────────▲───────────────┘                         │
               ║                                         │
               ║ (Mathematical Equivalence)              │
               ║                                         │
┌──────────────┴───────────────┐          ┌──────────────▼───────────────┐
│           Payment            │          │      PaymentAllocation       │
│     (Liquidity Inflow)       │◄─────────┤     (Settlement Bridge)      │
│                              │  links   │                              │
│ amount = total cash received │          │ paymentId -> invoiceId       │
│ allocated = ∑ Allocations    │          │ amount: Decimal(12,2)        │
│ unallocated = amount - alloc │          │ status: ACTIVE / REVERSED    │
└──────────────────────────────┘          └──────────────────────────────┘
```

### 3.1 Mathematical Invariants & Equivalence Proofs

1. **Invoice Level**:
   $$\text{Invoice.paidAmount} \equiv \sum_{\substack{a \in \text{PaymentAllocation} \\ a.\text{invoiceId} = \text{Invoice.id} \\ a.\text{status} = \text{ACTIVE}}} a.\text{amount}$$
   $$\text{Invoice.outstandingAmount} \equiv \text{Invoice.netAmount} - \text{Invoice.paidAmount}$$

2. **Payment Level**:
   $$\text{Payment.allocatedAmount} \equiv \sum_{\substack{a \in \text{PaymentAllocation} \\ a.\text{paymentId} = \text{Payment.id} \\ a.\text{status} = \text{ACTIVE}}} a.\text{amount}$$
   $$\text{Payment.unallocatedAmount} \equiv \text{Payment.amount} - \text{Payment.allocatedAmount}$$

3. **Student Subledger Level**:
   $$\text{Student Balance} \equiv \sum_{\substack{e \in \text{StudentLedgerEntry} \\ e.\text{studentId} = \text{student.id}}} \begin{cases} +e.\text{amount} & \text{if } e.\text{direction} = \text{DEBIT} \\ -e.\text{amount} & \text{if } e.\text{direction} = \text{CREDIT} \end{cases}$$

4. **Global System Coherence Invariant**:
   $$\text{Student Balance} \equiv \sum_{\substack{i \in \text{Invoices} \\ i.\text{status} \ne \text{VOID}}} i.\text{outstandingAmount} \;-\; \sum_{\substack{p \in \text{Payments} \\ p.\text{status} = \text{COMPLETED}}} p.\text{unallocatedAmount} \;+\; \text{Uninvoiced Opening Arrears}$$

---

## 4. PAYMENT IDEMPOTENCY & DUPLICATE PREVENTION

To guarantee that network retries, double clicks by cashiers, and duplicate webhook deliveries never create double payments, double ledger credits, or duplicate receipts, NOVA enforces strict **Idempotency Keys**.

### 4.1 Idempotency Key Specification

```prisma
model Payment {
  id                String              @id @default(cuid())
  branchId          String
  studentId         String
  idempotencyKey    String              // Unique per branch
  paymentNumber     String              // "PAY-2026-00001"
  ...
  @@unique([branchId, idempotencyKey])
}
```

### 4.2 Idempotency Key Generation Rules

| Inflow Channel | Key Generation Format | Example |
| :--- | :--- | :--- |
| **SchoolPay Gateway Webhook** | `GATEWAY:SCHOOLPAY:${schoolCode}:${spPaymentId}` | `GATEWAY:SCHOOLPAY:SCH001:SP-UG-9840219` |
| **MTN MoMo API Webhook** | `GATEWAY:MTN_MOMO:${financialTransactionId}` | `GATEWAY:MTN_MOMO:984128491` |
| **Airtel Money API Webhook**| `GATEWAY:AIRTEL:${airtelMoneyId}` | `GATEWAY:AIRTEL:AIR-98401` |
| **Direct Bank Slip Entry** | `BANK_SLIP:${bankCode}:${bankSlipNumber}` | `BANK_SLIP:STANCHART:SLIP-89401` |
| **Cashier UI Manual Entry** | `MANUAL:${clientGeneratedUUID}` | `MANUAL:a8f09b12-5813-4321-9988-1a2b3c4d5e6f` |

### 4.3 Exact Duplicate Event Handling
When a payment request arrives at the API or webhook receiver:
1. The transaction attempts to query `db.payment.findUnique({ where: { branchId_idempotencyKey: { branchId, idempotencyKey } } })`.
2. **If Found (Duplicate Replay)**:
   - The database transaction **aborts any duplicate write**.
   - No new `Payment`, `PaymentAllocation`, `StudentLedgerEntry`, or `Receipt` is generated.
   - The API immediately returns `HTTP 200 OK` with the existing payment & receipt payload and response header `Idempotent-Replay: true`.
3. **If Not Found (New Payment)**:
   - Proceeds with standard atomic creation.

---

## 5. NON-DESTRUCTIVE PAYMENT REVERSAL ARCHITECTURE

If a cheque is dishonored, an electronic payment is charged back, or a cashier records an error, the payment is reversed through an explicit, non-destructive workflow.

### 5.1 Reversal Rules
1. **Original Payment Record is Immutable**: The original `Payment` record is never deleted. Its fields remain intact, and only lifecycle metadata is updated:
   `status = REVERSED`, `reversalReason = reason`, `reversedAt = NOW()`, `reversedById = ctx.userId`.
2. **Allocations are Never Deleted**: Every `PaymentAllocation` linked to the reversed payment is updated to `status = REVERSED`. The historical link between the payment and the invoice is preserved for auditing.
3. **Compensating Subledger Entry Posted**:
   - `entryType = PAYMENT_REVERSAL`
   - `direction = DEBIT`
   - `amount = payment.amount`
   - `referenceType = "PAYMENT_REVERSAL"`
   - `referenceId = payment.id`
   - `description = "Reversal of Receipt #" + receiptNumber + ": " + reason`
4. **Surviving Allocation Recalculation (Protection Against Interleaving Payments)**:
   For every invoice previously settled by this payment:
   $$\text{survivingPaidAmount} = \sum_{\substack{a \in \text{PaymentAllocation} \\ a.\text{invoiceId} = \text{invoice.id} \\ a.\text{status} = \text{ACTIVE}}} a.\text{amount}$$
   $$\text{invoice.status} = \begin{cases} 
   \text{PAID} & \text{if } \text{survivingPaidAmount} \ge \text{invoice.netAmount} \\
   \text{PARTIAL} & \text{if } 0 < \text{survivingPaidAmount} < \text{invoice.netAmount} \\
   \text{OVERDUE} & \text{if } \text{survivingPaidAmount} = 0 \text{ and } \text{invoice.dueDate} < \text{NOW}() \\
   \text{PENDING} & \text{if } \text{survivingPaidAmount} = 0 \text{ and } \text{invoice.dueDate} \ge \text{NOW}()
   \end{cases}$$

> [!IMPORTANT]
> **Protection Against Later Payment Overwrites**: If a student had Payment 1 (allocated 500k) and later Payment 2 (allocated 300k) on an 800k invoice, reversing Payment 1 strictly transitions Payment 1 allocations to `REVERSED`. Payment 2 allocations remain `ACTIVE`. The invoice paid amount correctly resets from 800k to 300k (`status = PARTIAL`). Payment 2 is completely unaffected.

---

## 6. CONCURRENCY & ROW-LEVEL LOCKING STRATEGY

Financial transactions involving FIFO allocations, running balance computations, and invoice status transitions must be safe under high concurrent load.

```
                  CONCURRENT PAYMENT REQUESTS FOR SAME STUDENT
               ┌───────────────────────┐   ┌───────────────────────┐
               │ Cashier A (500k cash) │   │ SchoolPay (1M webhook)│
               └───────────┬───────────┘   └───────────┬───────────┘
                           │                           │
                           ▼                           ▼
               ┌───────────────────────────────────────────────────┐
               │    ACQUIRE PESSIMISTIC LOCK ON STUDENT RECORD     │
               │   SELECT * FROM "Student" WHERE id = $id FOR UPDATE│
               └───────────────────────────┬───────────────────────┘
                                           │
                           ┌───────────────┴───────────────┐
                           ▼                               ▼
                   [TX A EXECUTES FIRST]           [TX B WAITS]
                   • Reads open invoices           • Blocked until TX A commits
                   • Allocates 500k via FIFO       • Reads updated open invoices
                   • Updates invoice status        • Allocates remaining balances
                   • Computes balanceAfter         • Computes new balanceAfter
                   • Commits & releases lock       • Commits cleanly
```

### 6.1 Transaction Locking Rules
1. **Student Row Lock**: Inside the write transaction, execute `SELECT id FROM "Student" WHERE id = $studentId FOR UPDATE;` before reading unpaid invoices or ledger balance.
2. **Serializing FIFO**: This pessimistic lock serializes all payment capture, allocations, and manual adjustments for that specific student. Double-allocations on the same invoice become physically impossible.
3. **Atomic Sequence Numbering**: Sequence numbers (`ReceiptSequence` and `PaymentSequence`) use PostgreSQL native upsert (`INSERT ... ON CONFLICT ("branchId", "year") DO UPDATE SET "lastValue" = "ReceiptSequence"."lastValue" + 1 RETURNING "lastValue"`). This executes lock-free and race-free across branches and threads.
4. **Atomic Subledger Running Balance**: Because student transactions are serialized by the student row lock, `balanceAfter` is calculated as $\text{latestBalanceAfter} \pm \text{currentEntryAmount}$, guaranteeing strictly monotonic, non-interleaved running balance snapshots.

---

## 7. RECEIPT ARCHITECTURE & IMMUTABLE SNAPSHOTS

### 7.1 Separate Entity: `Receipt`
A `Receipt` is modeled as a dedicated entity linked 1:1 to `Payment`. This separates financial settlement (`Payment`) from presentation and legal tax documentation (`Receipt`).

```prisma
model Receipt {
  id             String        @id @default(cuid())
  branchId       String
  paymentId      String        @unique
  receiptNumber  String        // "REC-2026-00001"
  issuedAt       DateTime      @default(now())
  cashierName    String        // Snapshot of user full name
  studentName    String        // Snapshot of student name at time of payment
  admissionNo    String        // Snapshot of admission number
  className      String        // Snapshot of class name
  amountFigures  Decimal       @db.Decimal(12, 2)
  amountWords    String        // "Eight Hundred Thousand Uganda Shillings Only"
  paymentMethod  PaymentMethod
  externalRef    String?
  status         ReceiptStatus @default(ISSUED) // ISSUED, VOID
  voidedAt       DateTime?
  voidReason     String?

  branch         Branch        @relation(fields: [branchId], references: [id], onDelete: Cascade)
  payment        Payment       @relation(fields: [paymentId], references: [id], onDelete: Restrict)

  @@unique([branchId, receiptNumber])
  @@index([branchId, issuedAt])
}
```

### 7.2 Receipt Invariants
- **Immutable Snapshot**: Even if a student's name is later corrected or class changed, the receipt permanently retains the historical facts at the exact moment money was received.
- **Void on Payment Reversal**: When a payment is reversed, the receipt's `status` transitions to `VOID` (`voidReason = "Payment reversed: " + reason`).
- **No Number Recycling**: The `receiptNumber` is never deleted or reused. Gapless sequential auditing is maintained.

---

## 8. INVOICE VOID SEMANTICS (LEDGER MIRROR REVERSAL)

Voiding an invoice must reverse the **actual original subledger postings**, rather than re-evaluating dynamic or mutable application variables.

### 8.1 Void Mechanics
1. Retrieve all `StudentLedgerEntry` records matching `referenceType = "INVOICE"` and `referenceId = invoice.id`.
2. For each original entry:
   - Original `INVOICE_GROSS_CHARGE` (`DEBIT`, amount $G$) $\rightarrow$ Post `INVOICE_VOID_REVERSAL` (`CREDIT`, amount $G$).
   - Original `BURSARY_CREDIT` (`CREDIT`, amount $D$) $\rightarrow$ Post `BURSARY_VOID_REVERSAL` (`DEBIT`, amount $D$).
3. **Handling Invoices with Existing Active Payments**:
   - **Rule**: An invoice that has `ACTIVE` payment allocations **cannot** be voided directly.
   - The user must either:
     a) Reverse the associated payments first (if the payment itself was invalid), OR
     b) Re-allocate the payment to another invoice / unallocated student credit before voiding the erroneous invoice.
   - This prevents collected real money from being silently unlinked or corrupted.

---

## 9. OPENING-BALANCE & HISTORICAL ARREARS DEDUPLICATION

To prevent accidental double-counting of arrears (e.g. entering both a legacy Term 3 invoice AND an opening balance arrears debit for the same debt):

1. **Explicit Source Tagging**: Every `OPENING_BALANCE` entry specifies a non-null `academicYearId` and an optional `cutoffDate`.
2. **Deduplication Validation**:
   When posting an `OPENING_BALANCE` entry for a student:
   - The DAO checks if any active `Invoice` records exist for that student with `issueDate <= cutoffDate`.
   - If historical invoices already exist for that timeframe, the creation is rejected with:
     `"Conflict: Historical invoices already exist for this academic period. Post an adjustment or create invoices, but do not double-post opening arrears."`
3. **Immutability**: Once posted, opening balance entries can only be adjusted via explicit, audited `DEBIT_ADJUSTMENT` or `CREDIT_ADJUSTMENT` entries requiring `fees:ledger:adjust` permission.

---

## 10. STRICT ADDITIVE COMPATIBILITY WITH PHASE 3.1A & 3.1B

Phase 3.1C builds directly upon the completed and verified Phase 3.1A/3.1B codebase without rewriting or altering existing foundations:

1. **Preserved Models**: `FeeType`, `FeeStructure`, `FeeStructureItem`, `StudentFeeDiscount`, `Invoice`, `InvoiceItem`, `InvoiceSequence` remain 100% structurally intact.
2. **Additive Relations**:
   - `Invoice` receives: `allocations PaymentAllocation[]` and `ledgerEntries StudentLedgerEntry[]`.
   - `Student` receives: `payments Payment[]`, `ledgerEntries StudentLedgerEntry[]`, `receipts Receipt[]`.
   - `Branch` receives: `payments Payment[]`, `ledgerEntries StudentLedgerEntry[]`, `paymentAllocations PaymentAllocation[]`, `receipts Receipt[]`, `receiptSequences ReceiptSequence[]`, `paymentSequences PaymentSequence[]`.
3. **Retroactive Sync**: A deterministic migration utility posts `INVOICE_GROSS_CHARGE` and `BURSARY_CREDIT` entries for all existing Phase 3.1B seed/test invoices so all student balances reconcile from day one.

---

## 11. DETERMINISTIC INVARIANT & TEST MATRIX

Phase 3.1C implementation and test suites must explicitly prove the following 16 scenarios:

| Test ID | Scenario | Expected System Behavior & Invariant Verification |
| :--- | :--- | :--- |
| **T-01** | **Full Invoice Payment** | Single payment exactly matching invoice net amount. `PaymentAllocation` created for 100% of net amount. `Invoice.status` transitions from `PENDING` to `PAID`. Student balance becomes `0.00`. |
| **T-02** | **Partial Payment** | Payment for 40% of net amount. `PaymentAllocation` created for 40%. `Invoice.status` transitions to `PARTIAL`. Invoice outstanding is 60%. Student balance decreases by 40%. |
| **T-03** | **Multi-Invoice Payment (FIFO)**| Payment for 1.2M against Invoice 1 (800k) and Invoice 2 (600k). FIFO allocates 800k to Inv 1 (`PAID`) and 400k to Inv 2 (`PARTIAL`). Total allocated = 1.2M. Unallocated = 0. |
| **T-04** | **Overpayment (Advance Credit)** | Payment of 1.5M against open invoice of 1.0M. 1.0M allocated (`PAID`). 500k remains `Payment.unallocatedAmount`. Subledger credits full 1.5M. Student balance becomes `-500,000` (Credit). |
| **T-05** | **Advance Payment Before Billing**| Payment of 500k received when student has 0 invoices. 0 allocations created. Full 500k is unallocated. Subledger credits 500k. Student balance is `-500,000`. |
| **T-06** | **Later Application of Credit** | Student with 500k advance credit receives new invoice of 600k. Auto-settlement utility allocates 500k credit to invoice. Invoice becomes `PARTIAL` (100k due). Student balance becomes `+100,000`. |
| **T-07** | **Simple Payment Reversal** | Reversing a payment marks payment `REVERSED`, marks its allocations `REVERSED`, posts `PAYMENT_REVERSAL` debit, and reverts invoice status from `PAID` back to `PENDING` (or `OVERDUE`). |
| **T-08** | **Reversal After Later Payments** | Inv (1M) paid by Pay 1 (600k) and Pay 2 (400k). Inv is `PAID`. Pay 1 is reversed. Pay 1 alloc is `REVERSED`. Pay 2 alloc remains `ACTIVE` (400k). Inv paid amount resets to 400k (`PARTIAL`). |
| **T-09** | **Duplicate Webhook / Replay** | Same SchoolPay transaction ID received twice. First call creates payment; second call detects `idempotencyKey`, skips mutation, and returns `HTTP 200 (Idempotent-Replay)`. Exactly 1 payment exists. |
| **T-10** | **Concurrent Payments on Student**| 2 cashiers submit payments for same student simultaneously. Pessimistic student row lock serializes execution. Both payments record unique numbers, allocate FIFO without race, and subledger is exact. |
| **T-11** | **Concurrent Payments on Invoice**| 2 payments attempt to pay the last 200k on an invoice. Serialization ensures Pay A allocates 200k (inv `PAID`) and Pay B allocates 0k (unallocated credit). Total allocated never exceeds net amount. |
| **T-12** | **Invoice Void After Full Payment**| Attempting to void a `PAID` invoice is rejected with error requiring payment reversal or re-allocation first. |
| **T-13** | **Invoice Void After Partial Pay** | Attempting to void a `PARTIAL` invoice is rejected with error requiring unlinking/re-allocating the partial payment first. |
| **T-14** | **Discount Plus Invoice Posting** | Invoice with 1M gross and 300k bursary posts Gross Debit (1M) and Bursary Credit (300k). Net receivable increase is exactly 700k. |
| **T-15** | **Multi-Tenant Branch Isolation** | Cashier in Branch 1 cannot view, allocate, reverse, or query payments/ledger entries belonging to Branch 2. Cross-branch operations throw `UnauthorizedError`. |
| **T-16** | **Receipt Sequence Uniqueness** | 10 concurrent payments generated across multiple workers generate strictly unique, sequential receipt numbers (`REC-2026-00001` to `REC-2026-00010`) with zero collisions. |

---

## 12. PROPOSED SCHEMA SPECIFICATION (PHASE 3.1C)

```prisma
// ==========================================
// FINANCE: SUBLEDGER & PAYMENTS (PHASE 3.1C)
// ==========================================

enum LedgerEntryType {
  INVOICE_GROSS_CHARGE
  BURSARY_CREDIT
  PAYMENT
  PAYMENT_REVERSAL
  OPENING_BALANCE
  INVOICE_VOID_REVERSAL
  BURSARY_VOID_REVERSAL
  CREDIT_ADJUSTMENT
  DEBIT_ADJUSTMENT
}

enum LedgerDirection {
  DEBIT
  CREDIT
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  MTN_MOMO
  AIRTEL_MONEY
  CHEQUE
  CARD
  SCHOOLPAY
}

enum PaymentStatus {
  COMPLETED
  REVERSED
}

enum AllocationStatus {
  ACTIVE
  REVERSED
}

enum ReceiptStatus {
  ISSUED
  VOID
}

model StudentLedgerEntry {
  id             String            @id @default(cuid())
  branchId       String
  studentId      String
  academicYearId String?
  termId         String?
  invoiceId      String?
  entryType      LedgerEntryType
  direction      LedgerDirection
  amount         Decimal           @db.Decimal(12, 2)
  referenceType  String            // "INVOICE", "BURSARY", "PAYMENT", "SYSTEM_OPENING", "ADJUSTMENT"
  referenceId    String?
  description    String
  balanceAfter   Decimal           @db.Decimal(12, 2)
  postedAt       DateTime          @default(now())
  createdById    String?

  branch         Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  student        Student           @relation(fields: [studentId], references: [id], onDelete: Cascade)
  academicYear   AcademicYear?     @relation(fields: [academicYearId], references: [id], onDelete: SetNull)
  term           Term?             @relation(fields: [termId], references: [id], onDelete: SetNull)
  invoice        Invoice?          @relation(fields: [invoiceId], references: [id], onDelete: SetNull)

  @@index([branchId, studentId])
  @@index([branchId, postedAt])
  @@unique([branchId, referenceType, referenceId, direction])
}

model Payment {
  id                String              @id @default(cuid())
  branchId          String
  studentId         String
  idempotencyKey    String
  paymentNumber     String
  amount            Decimal             @db.Decimal(12, 2)
  paymentDate       DateTime            @default(now())
  paymentMethod     PaymentMethod
  externalReference String?
  payerName         String?
  payerPhone        String?
  status            PaymentStatus       @default(COMPLETED)
  notes             String?
  collectedById     String
  reversalReason    String?
  reversedAt        DateTime?
  reversedById      String?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  branch            Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  student           Student             @relation(fields: [studentId], references: [id], onDelete: Cascade)
  allocations       PaymentAllocation[]
  receipt           Receipt?

  @@unique([branchId, idempotencyKey])
  @@unique([branchId, paymentNumber])
  @@index([branchId, studentId])
  @@index([branchId, paymentDate])
  @@index([branchId, status])
}

model PaymentAllocation {
  id         String           @id @default(cuid())
  branchId   String
  paymentId  String
  invoiceId  String
  amount     Decimal          @db.Decimal(12, 2)
  status     AllocationStatus @default(ACTIVE)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  branch     Branch           @relation(fields: [branchId], references: [id], onDelete: Cascade)
  payment    Payment          @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  invoice    Invoice          @relation(fields: [invoiceId], references: [id], onDelete: Restrict)

  @@index([paymentId])
  @@index([invoiceId])
  @@unique([paymentId, invoiceId])
}

model Receipt {
  id            String        @id @default(cuid())
  branchId      String
  paymentId     String        @unique
  receiptNumber String
  issuedAt      DateTime      @default(now())
  cashierName   String
  studentName   String
  admissionNo   String
  className     String
  amountFigures Decimal       @db.Decimal(12, 2)
  amountWords   String
  paymentMethod PaymentMethod
  externalRef   String?
  status        ReceiptStatus @default(ISSUED)
  voidedAt      DateTime?
  voidReason    String?

  branch        Branch        @relation(fields: [branchId], references: [id], onDelete: Cascade)
  payment       Payment       @relation(fields: [paymentId], references: [id], onDelete: Restrict)

  @@unique([branchId, receiptNumber])
  @@index([branchId, issuedAt])
}

model PaymentSequence {
  id        String   @id @default(cuid())
  branchId  String
  year      Int
  lastValue Int      @default(0)
  updatedAt DateTime @updatedAt

  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([branchId, year])
}

model ReceiptSequence {
  id        String   @id @default(cuid())
  branchId  String
  year      Int
  lastValue Int      @default(0)
  updatedAt DateTime @updatedAt

  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([branchId, year])
}
```

---

## 13. ARCHITECTURAL STATUS

**STATUS: READY FOR IMPLEMENTATION**

All 12 accounting, concurrency, idempotency, mathematical coherence, and reversal requirements have been rigorously and unambiguously specified. No application or database modifications have been executed in this read-only checkpoint.
