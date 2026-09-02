# NOVA — FINANCE PHASE 3.1G ARCHITECTURE & DESIGN SPECIFICATION
**Subsystem**: NOVA Finance — School Budgeting, Vote Heads & Expenditure Control Engine  
**Document Status**: Implementation-Ready Architecture Specification  
**Author**: Antigravity Core Architecture Team  
**Date**: September 2026  
**GitHub Checkpoint**: `ddf08e6`  

---

## EXECUTIVE SUMMARY

With the successful completion and mathematical verification of **Finance Phases 3.1A through 3.1F**, NOVA possesses an authoritative student accounting, billing, payments, operational expenses, SchoolPay reconciliation, and staff payroll engine.

**Finance Phase 3.1G** establishes the enterprise financial management and fiscal discipline layer: **School Budgeting, Vote Heads & Expenditure Control Engine**. This subsystem enables school boards, headteachers, and bursars to define annual and termly budgets, establish vote head spending caps linked to expense categories, set fee revenue realization targets, enforce four-eye approval governance, track live real-time variance against completed expenses and payroll disbursements with zero double-counting, and monitor over-budget consumption warnings.

---

## 1. GATE RESOLUTIONS & ARCHITECTURAL FOUNDATIONS

### Gate 1: Budget Period & Hierarchy
- **Identity & Boundaries**:
  - An **Annual Budget** is anchored to `academicYearId` with `termId = null`. Its period spans `academicYear.startDate` to `academicYear.endDate`.
  - A **Term Budget** is anchored to `academicYearId` and a specific `termId` (Term 1, Term 2, or Term 3). Its period spans `term.startDate` to `term.endDate`.
- **Uniqueness & Coexistence**:
  - A school branch can define one master Annual Budget and/or distinct Term Budgets.
  - Uniqueness is enforced via database constraint `@@unique([branchId, academicYearId, termId])`.
  - When computing variance, the query period strictly matches the budget's boundary dates (`startDate` to `endDate`). Reports provide an explicit scope selector (`Annual` vs `Term 1 / Term 2 / Term 3`), preventing double-counting between annual and termly rollups.

### Gate 2: Vote Heads & Relationship to ExpenseCategory
- In East African school accounting, a **Vote Head** represents an approved budgetary allocation for an expenditure line.
- To prevent parallel or conflicting expense classifications:
  - Every `EXPENSE_VOTE_HEAD` budget line item **strictly maps 1-to-1 to an existing `ExpenseCategory`** in Phase 3.1D (`categoryId`).
  - `BudgetItem.name` and `BudgetItem.code` default to the category's name and code (e.g. *Salaries & Wages*, *Boarding Provisions*, *Scholastic Materials*, *Utilities & Energy*, *Transport Fleet*, *Maintenance*).
  - Uncategorized expenditures cannot be budgeted; administrators must create an `ExpenseCategory` first.

### Gate 3: Budget vs Actual Mathematical Formulas & Authoritative Sources
All financial metrics use `Decimal(12,2)` in UGX.

1. **Authorized Budget Amount**:
   $$\text{AuthorizedBudget}(C) = \text{BudgetItem}(C).\text{allocatedAmount} + \sum_{\substack{r \in \text{ApprovedRevisions}}} \text{RevisionItem}(C, r).\text{deltaAmount}$$

2. **Actual Expenditure**:
   $$\text{ActualSpent}(C) = \sum_{\substack{e \in \text{Expense} \\ e.\text{branchId} = \text{branchId} \\ e.\text{categoryId} = C \\ e.\text{status} = \text{COMPLETED} \\ e.\text{expenseDate} \ge \text{startDate} \\ e.\text{expenseDate} \le \text{endDate}}} e.\text{amount}$$
   - **VOID Expenses**: Excluded completely (`status = COMPLETED` strictly filters out `VOID` and `PENDING`).
   - **Expense Voids / Reversals**: Voiding an expense immediately reduces `ActualSpent` back down.

3. **Expenditure Variance**:
   $$\text{Variance UGX}(C) = \text{AuthorizedBudget}(C) - \text{ActualSpent}(C)$$
   - Positive variance: Under budget (favorable savings).
   - Negative variance: Over budget (unfavorable deficit / over-expenditure).

4. **Budget Utilization Rate**:
   $$\text{Utilization \%}(C) = \begin{cases} 0.00\% & \text{if } \text{AuthorizedBudget}(C) = 0 \text{ and } \text{ActualSpent}(C) = 0 \\ 100.00\% & \text{if } \text{AuthorizedBudget}(C) = 0 \text{ and } \text{ActualSpent}(C) > 0 \\ \left(\frac{\text{ActualSpent}(C)}{\text{AuthorizedBudget}(C)}\right) \times 100 & \text{otherwise} \end{cases}$$

5. **Revenue Targets & Realization**:
   - `BudgetedRevenueTarget`: Set per `FeeType.id` (or total school billing target).
   - `ActualInvoicedRevenue`: Sum of `InvoiceItem.amount` (net of discounts) on non-void invoices for that fee type within the period.
   - `ActualCollectedRevenue`: Sum of `PaymentAllocation.amount` received for invoices within the period.
   - `Revenue Variance`:
     $$\text{Revenue Variance} = \text{ActualCollectedRevenue} - \text{BudgetedRevenueTarget}$$

### Gate 4: Payroll Integration & Zero Double-Counting Guarantee
- In Phase 3.1F:
  - Disbursing a `PayrollRun` automatically creates an `Expense` voucher in category `SALARIES_AND_WAGES` for `totalNet`.
  - Statutory remittances (NSSF 15% and PAYE) are recorded as separate operational `Expense` vouchers in Phase 3.1D when paid.
- **Authoritative Rule for Budget Actuals**:
  - The Budgeting Engine aggregates actual expenditures **strictly and exclusively from `Expense` records (`status = COMPLETED`)**.
  - The Budgeting Engine **NEVER queries `PayrollRun` directly** for budget actuals.
  - This mathematically guarantees $0.00$ duplicate counting of staff costs.

### Gate 5: Immutability & Revisions Semantics
- Once a `Budget` is marked `APPROVED`, its `allocatedAmount` values and totals are **permanently immutable**.
- If mid-period operational adjustments are required (e.g. emergency generator repair or fuel price inflation):
  1. An accountant creates a `BudgetRevision` in status `DRAFT`.
  2. The revision specifies itemized `deltaAmount` (positive for supplementary allocation, negative for reduction) and a mandatory `reason`.
  3. Revisions require separate Four-Eye approval (`authorizedById !== preparedById`).
  4. Upon approval:
     - The revision status becomes `APPROVED` with `authorizedAt = new Date()`.
     - `BudgetItem.revisedAmount = allocatedAmount + sum(approvedDeltas)`.
     - `Budget.totalExpense` and `Budget.netSurplus` update to the new authorized revised baseline.
     - A frozen JSON snapshot of the state before and after revision is preserved in `BudgetRevision.snapshotJson`.
  5. Revision numbers are sequential per budget: `1, 2, 3...`.

### Gate 6: Four-Eye Approval & State Machine
- **States**: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CLOSED`.
- **Transitions**:
  - `DRAFT` $\xrightarrow{\text{submitBudget}}$ `SUBMITTED` (sets `submittedById = ctx.userId`, `submittedAt = new Date()`)
  - `SUBMITTED` $\xrightarrow{\text{approveBudget}}$ `APPROVED` (enforces `approvedById !== submittedById`, sets `approvedById = ctx.userId`, `approvedAt = new Date()`)
  - `SUBMITTED` $\xrightarrow{\text{rejectBudget}}$ `DRAFT` (clears `submittedById`, `submittedAt`, sets `rejectionReason = reason`)
  - `DRAFT` $\xrightarrow{\text{deleteBudget}}$ deleted (only permitted on `DRAFT` budgets with 0 revisions)
  - `APPROVED` $\xrightarrow{\text{closeBudget}}$ `CLOSED` (archived at the end of the fiscal period)
- **Single-Admin Bypass**: `allowSingleAdminMode = true` is permitted only when explicitly configured for single-user testing/demonstrations, accompanied by a mandatory audit log flag.

### Gate 7: Over-Budget Control & Warning Policy
- **Authoritative Policy**:
  1. **Operational Soft Warning (Default)**:
     - On the `Expense` creation modal in Phase 3.1D: If adding an expense causes category spending to exceed the authorized vote head budget, the UI displays a prominent amber/red **Budget Warning Banner** detailing the allocated ceiling, current expenditure, voucher amount, and excess overage.
     - Cashier/Bursar acknowledges the warning.
     - `ExpenseDAO.createExpense` records `isOverBudget: true` in the audit payload and emits a `BUDGET_OVER_EXPENDITURE_WARNING` audit event.
     - The transaction is not blocked, preserving administrative agility during critical school operations.
  2. **Configurable Hard Ceiling Mode**:
     - When `BranchSettings.enforceHardBudgetCeiling = true`, `ExpenseDAO` rejects vouchers exceeding the budget unless overridden by an administrator with permission `finance:budget:override`.

### Gate 8: Revenue Targets & Subledger Authority
- Revenue targets allow schools to set planned collection milestones per `FeeType` (Tuition, Development Levy, Boarding, Uniforms).
- `BudgetItem` with `type = REVENUE_TARGET` links to `feeTypeId`.
- Realized revenues derive exclusively from existing Phase 3.1B `InvoiceItem` and Phase 3.1C `PaymentAllocation` data.
- Revenue targets do not act as a second revenue authority or create parallel balances.

### Gate 9: Concurrency, Idempotency & Sequence Integrity
- **Atomic Numbering**: `BudgetSequence` transactionally generates unique, gapless numbers per branch/year: `BUD-2026-0001`.
- **Idempotent Periods**: Database unique constraint on `[branchId, academicYearId, termId]` prevents concurrent duplicate budget creation.
- **Revision Concurrency**: Revisions use atomic sequence increments (`SELECT COALESCE(MAX(revisionNumber), 0) + 1 FROM BudgetRevision WHERE budgetId = ... FOR UPDATE`).
- **Approval Concurrency**: State validation inside `db.$transaction` ensures only `SUBMITTED` budgets can be approved; simultaneous duplicate calls resolve idempotently.

### Gate 10: Executive Reporting & Variance Analysis
- Reports supported by branch, academic year, term, vote head category, and month:
  1. **Budget vs. Actuals Variance Schedule** (Allocated, Revised, Actual Spent, Variance UGX, Utilization %, Status Badge).
  2. **Revenue Realization Statement** (Target Revenue, Invoiced Accrual, Cash Collected, Shortfall/Surplus).
  3. **Departmental Vote Head Distribution** (Spending breakdown by academic/administrative departments).
  4. **Monthly Spending Burn Rate** (Monthly actual expenditure against 1/12th annual allocation).
- All reports offer deterministic CSV and print-ready formats.

### Gate 11: RBAC & Permissions Matrix

| Permission | Description | Bursar / Acct | Headteacher / Director | Auditor |
| :--- | :--- | :---: | :---: | :---: |
| `finance:budget:read` | View budgets, vote heads, and variance reports | ✅ | ✅ | ✅ |
| `finance:budget:create` | Create new draft budgets and vote head lines | ✅ | ✅ | ❌ |
| `finance:budget:edit` | Update draft budget amounts and targets | ✅ | ✅ | ❌ |
| `finance:budget:submit` | Submit draft budget for board approval | ✅ | ✅ | ❌ |
| `finance:budget:approve`| Approve or reject submitted budgets (Four-Eye) | ❌ | ✅ | ❌ |
| `finance:budget:revise` | Create and authorize supplementary revisions | ✅ (Draft) | ✅ (Authorize) | ❌ |
| `finance:budget:override`| Override hard budget ceilings (if enabled) | ❌ | ✅ | ❌ |
| `finance:budget:export` | Export variance reports and CSV schedules | ✅ | ✅ | ✅ |

### Gate 12: Multi-Tenant Branch Isolation
- All models (`Budget`, `BudgetItem`, `BudgetRevision`, `BudgetRevisionItem`, `BudgetSequence`) contain a mandatory, non-nullable `branchId`.
- All DAO operations, API routes, variance calculations, and exports enforce strict `branchId = ctx.branchId`. Cross-branch operations return null or throw `UnauthorizedError`.

---

## 2. DATA MODEL SPECIFICATION

```prisma
// =========================================================================
// NOVA FINANCE PHASE 3.1G: SCHOOL BUDGETING & EXPENDITURE CONTROL
// =========================================================================

enum BudgetStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
  CLOSED
}

enum BudgetItemType {
  EXPENSE_VOTE_HEAD
  REVENUE_TARGET
}

enum BudgetRevisionStatus {
  DRAFT
  APPROVED
  REJECTED
}

model Budget {
  id              String         @id @default(uuid())
  branchId        String
  academicYearId  String
  termId          String?        // Null = Full Academic Year Budget
  budgetNumber    String         // e.g. BUD-2026-0001
  title           String         // e.g. "2026 Annual School Operating Budget"
  description     String?
  status          BudgetStatus   @default(DRAFT)

  // Computed Totals (Decimal 12,2 UGX)
  totalIncome     Decimal        @default(0) @db.Decimal(12, 2)
  totalExpense    Decimal        @default(0) @db.Decimal(12, 2)
  netSurplus      Decimal        @default(0) @db.Decimal(12, 2)

  // Four-Eye Governance
  submittedById   String?
  submittedAt     DateTime?
  approvedById    String?
  approvedAt      DateTime?
  rejectionReason String?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  // Relationships
  branch          Branch         @relation(fields: [branchId], references: [id], onDelete: Cascade)
  academicYear    AcademicYear   @relation(fields: [academicYearId], references: [id], onDelete: Restrict)
  term            Term?          @relation(fields: [termId], references: [id], onDelete: SetNull)
  submittedBy     User?          @relation("BudgetSubmitter", fields: [submittedById], references: [id], onDelete: SetNull)
  approvedBy      User?          @relation("BudgetApprover", fields: [approvedById], references: [id], onDelete: SetNull)

  items           BudgetItem[]
  revisions       BudgetRevision[]

  @@unique([branchId, budgetNumber])
  @@unique([branchId, academicYearId, termId])
  @@index([branchId, academicYearId, status])
}

model BudgetItem {
  id              String         @id @default(uuid())
  budgetId        String
  type            BudgetItemType @default(EXPENSE_VOTE_HEAD)
  
  // Linkages to existing catalogs
  categoryId      String?        // For Expense Vote Heads (linked to ExpenseCategory)
  feeTypeId       String?        // For Revenue Targets (linked to FeeType)
  
  code            String         // e.g. "SALARIES_AND_WAGES", "REV_TUITION"
  name            String         // e.g. "Staff Salaries & Wages", "Tuition Revenue"
  allocatedAmount Decimal        @db.Decimal(12, 2)
  notes           String?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  // Relationships
  budget          Budget         @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  category        ExpenseCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  feeType         FeeType?       @relation(fields: [feeTypeId], references: [id], onDelete: SetNull)
  revisionItems   BudgetRevisionItem[]

  @@index([budgetId, type])
  @@index([budgetId, categoryId])
}

model BudgetRevision {
  id              String               @id @default(uuid())
  budgetId        String
  revisionNumber  Int                  // 1, 2, 3...
  title           String               // e.g. "Supplementary Allocation - Term 2 Food Provisions"
  reason          String               // Mandatory explanation for audit
  status          BudgetRevisionStatus @default(DRAFT)
  
  // Total adjustments in this revision
  totalDelta      Decimal              @default(0) @db.Decimal(12, 2)
  
  // Frozen JSON snapshot of budget state prior to revision
  snapshotJson    String               @db.Text
  
  preparedById    String
  preparedAt      DateTime             @default(now())
  authorizedById  String?
  authorizedAt    DateTime?
  rejectionReason String?

  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  // Relationships
  budget          Budget               @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  preparedBy      User                 @relation("RevisionPreparer", fields: [preparedById], references: [id], onDelete: Restrict)
  authorizedBy    User?                @relation("RevisionAuthorizer", fields: [authorizedById], references: [id], onDelete: SetNull)
  items           BudgetRevisionItem[]

  @@unique([budgetId, revisionNumber])
  @@index([budgetId, status])
}

model BudgetRevisionItem {
  id              String         @id @default(uuid())
  revisionId      String
  budgetItemId    String
  
  previousAmount  Decimal        @db.Decimal(12, 2)
  deltaAmount     Decimal        @db.Decimal(12, 2) // Can be positive (increase) or negative (reduction)
  newAmount       Decimal        @db.Decimal(12, 2)
  notes           String?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  // Relationships
  revision        BudgetRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  budgetItem      BudgetItem     @relation(fields: [budgetItemId], references: [id], onDelete: Cascade)

  @@index([revisionId, budgetItemId])
}

model BudgetSequence {
  id        String   @id @default(uuid())
  branchId  String
  year      Int
  lastValue Int      @default(0)
  updatedAt DateTime @updatedAt

  @@unique([branchId, year])
}
```

---

## 3. AUDIT SERVICE EVENTS

All budget operations emit structured, searchable audit events:
- `BUDGET_CREATED`: `budgetId`, `academicYearId`, `totalExpense`, `totalIncome`.
- `BUDGET_SUBMITTED`: `budgetId`, `submittedById`.
- `BUDGET_APPROVED`: `budgetId`, `approvedById`, `totalExpense`.
- `BUDGET_REJECTED`: `budgetId`, `rejectedById`, `rejectionReason`.
- `BUDGET_REVISION_CREATED`: `budgetId`, `revisionId`, `revisionNumber`, `totalDelta`.
- `BUDGET_REVISION_APPROVED`: `budgetId`, `revisionId`, `authorizedById`.
- `BUDGET_OVER_EXPENDITURE_WARNING`: `budgetId`, `categoryId`, `voucherAmount`, `excessAmount`.

---

## 4. API & UI DESIGN SPECIFICATION

### 4.1 REST API Routes
- `GET /api/budgets` — List budgets with filters (`academicYearId`, `termId`, `status`).
- `POST /api/budgets` — Create new draft budget with line items.
- `GET /api/budgets/[id]` — Detailed budget with vote head breakdown and live actuals.
- `PUT /api/budgets/[id]` — Update draft budget line items.
- `DELETE /api/budgets/[id]` — Delete draft budget (draft only).
- `POST /api/budgets/[id]/submit` — Submit draft budget for approval.
- `POST /api/budgets/[id]/approve` — Four-eye approval.
- `POST /api/budgets/[id]/reject` — Reject with feedback notes.
- `POST /api/budgets/[id]/revisions` — Create supplementary revision.
- `POST /api/budgets/[id]/revisions/[revisionId]/approve` — Authorize revision.
- `GET /api/budgets/[id]/variance` — Compute live variance metrics.
- `GET /api/budgets/[id]/export` — Export variance schedule to CSV.

### 4.2 Frontend Pages & Components
- `/finance/budgets`: Budget Management Hub (Active budget KPI cards, status badges, filter bar, New Budget modal).
- `/finance/budgets/new`: Interactive Budget Builder (Category vote head table, revenue target table, live total surplus calculator).
- `/finance/budgets/[id]`: Workstation & Real-Time Variance Monitor (Live progress bars, category drilldown, over-budget badges, approval action bar, revisions drawer).
- `BudgetCeilingAlertModal`: Visual warning modal when creating an expense near or over category budget.

---

## 5. TEST MATRIX (BUD-01 TO BUD-15 & ADVERSARIAL AUDIT)

| Test ID | Test Scenario & Assertion |
| :--- | :--- |
| **BUD-01** | Create draft budget with expense vote heads and revenue targets; verifies exact `totalExpense`, `totalIncome`, and `netSurplus` calculations with `Decimal(12,2)`. |
| **BUD-02** | Atomic sequential budget numbering (`BUD-YYYY-NNNN`) via `BudgetSequence`. |
| **BUD-03** | Rejects duplicate budget creation for the same Branch and Academic Year / Term period (`@@unique`). |
| **BUD-04** | Four-Eye Segregation: Submitter cannot self-approve (`approvedById !== submittedById`). |
| **BUD-05** | Board approval transition: Moves to `APPROVED`, sets timestamps, and locks baseline figures. |
| **BUD-06** | Rejection workflow: Clears approval metadata, records rejection notes, and returns to `DRAFT`. |
| **BUD-07** | Immutability: Rejects direct modification of line items on an `APPROVED` budget. |
| **BUD-08** | Supplementary Revision: Prepares revision with delta amounts and frozen snapshot JSON. |
| **BUD-09** | Revision Approval: Authorizes revision, updates authorized budget baselines and totals. |
| **BUD-10** | Live Variance Calculation: Accurately computes `ActualSpent`, `Variance UGX`, and `Utilization %` against completed `Expense` vouchers. |
| **BUD-11** | Voided Expense Exclusion: Proves `VOID` expenses are excluded from budget actuals. |
| **BUD-12** | Payroll Integration: Proves disbursed payroll expense vouchers correctly feed `SALARIES_AND_WAGES` vote head with zero double-counting. |
| **BUD-13** | Revenue Realization: Compares revenue targets against actual invoice billing and payment collections. |
| **BUD-14** | Over-Budget Control: Accurately detects when expenses exceed vote head budget and logs warning. |
| **BUD-15** | Strict Multi-Tenant Branch Isolation across all budget queries, approvals, revisions, and exports. |

---

## 6. OUT-OF-SCOPE BOUNDARIES

- General Ledger (GL) Chart of Accounts (Assets, Liabilities, Equity journals).
- Procurement, Purchase Orders, and Vendor RFQs.
- Inventory stock management.
- Bank statement reconciliation.
- Loan and debt financing management.

---

STATUS: READY FOR IMPLEMENTATION
