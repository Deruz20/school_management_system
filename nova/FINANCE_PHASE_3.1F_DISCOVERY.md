# NOVA — FINANCE PHASE 3.1F ARCHITECTURE & DESIGN SPECIFICATION
## STAFF PAYROLL, COMPENSATION MANAGEMENT & STATUTORY REMITTANCES ENGINE

**Document Status**: Implementation-Ready Architecture Specification (Approved Design)  
**Target Subsystem**: NOVA Staff Payroll, Compensation Structures, Statutory Deductions, Bank Schedules & Payslips  
**Author**: Antigravity Core Architecture Team  
**Date**: September 2026  
**Parent Architecture**: [FINANCE_DOMAIN_DESIGN.md](file:///c:/Users/USER/Desktop/school_management_system/nova/FINANCE_DOMAIN_DESIGN.md)  
**Prerequisites**: Phase 3.1A (Fee Config), Phase 3.1B (Invoicing), Phase 3.1C (Ledger & Payments), Phase 3.1D (Expenses & Analytics), Phase 3.1E (SchoolPay Gateway)  

---

## EXECUTIVE SUMMARY

With Student Accounts Receivable (3.1A–3.1C), Operational Expenses & Analytics (3.1D), and SchoolPay Gateway Integration (3.1E) fully operational, the highest-value remaining financial capability for NOVA is **Staff Payroll & Compensation Management (HR Finance)**.

In private and government-aided schools across East Africa (and Uganda specifically), staff compensation represents **60% to 75% of total recurring operational cash outflows**. Today, schools in NOVA can record ad-hoc expense vouchers (Phase 3.1D), but they lack a structured payroll engine to manage staff compensation structures, compute base salaries, calculate allowances, apply statutory deductions (Uganda PAYE tax brackets and NSSF contributions), enforce segregation-of-duties approval lifecycles, disburse bulk payouts, and issue tamper-evident payslips.

Phase 3.1F bridges the **HR Core Domain** (`Employee`, `Department`, `EmployeeType`) and the **Finance Outflow Engine** (`Expense`, `Financial Analytics`) to provide an authoritative, automated, and auditable payroll system.

---

## 1. SCOPE OF WORK

### 1.1 In-Scope Capabilities
1. **Employee Compensation Profiles**:
   - Branch-scoped salary profile per employee (`baseSalary`, payment method, bank account details, Mobile Money phone/network, TIN, NSSF number).
   - Support for multiple disbursement channels: Bank Transfer (Stanbic, Centenary, Equity, DFCU, ABSA, PostBank), MTN Mobile Money, Airtel Money, Cash, Cheque.
2. **Salary Components Catalog**:
   - Configurable recurring and one-off **Earnings/Allowances** (e.g., Housing Allowance, Transport, Responsibility Allowance, Meal Allowance, Overtime, Exam Marking Bonus).
   - Configurable recurring and one-off **Deductions** (e.g., Statutory NSSF Employee 5%, Statutory Uganda PAYE Tax, Staff SACCO, Staff Welfare Fund, Advance Salary Recovery, Loan Repayment, Absenteeism Penalty).
   - Configurable **Employer Statutory Contributions** (e.g., NSSF Employer 10%) for total institutional wage bill tracking.
3. **Uganda Statutory Compliance Engine**:
   - Built-in mathematical rules for **Uganda NSSF Act** (5% employee contribution, 10% employer contribution, 15% total).
   - Built-in mathematical rules for **Uganda Revenue Authority (URA) PAYE income tax brackets** (monthly resident individual progressive tax bands).
   - Versioned rule configuration layer with effective date boundaries (`effectiveFrom`, `effectiveTo`) allowing statutory parameter changes without altering historic payroll runs.
4. **Monthly Payroll Run Engine**:
   - Monthly batch generation per branch (e.g., August 2026 Payroll Run).
   - Automatic snapshotting of active staff compensation structures.
   - Batch payslip calculation with itemized allowances, deductions, gross pay, net pay, and employer costs.
   - Support for ad-hoc manual draft payslip adjustments (bonuses, advance recoveries) prior to submission.
5. **Payroll Approval & Governance Lifecycle**:
   - Five-stage governance state machine: `DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `PAID` (with `REJECTED` and `CANCELLED` support).
   - Strict segregation of duties: Bursar/Accountant prepares $\to$ Headteacher/Director approves $\to$ Cashier/Bursar disburses.
   - Strict prevention of self-approval.
6. **Automated Expense & Outflow Integration**:
   - Upon marking a payroll run or individual payslip as `PAID`, automated generation of a linked `Expense` record in Phase 3.1D for the net salaries disbursed (`totalNet`) under category `Salaries & Wages`.
   - Distinct, unbundled tracking for subsequent statutory remittances (NSSF 15% and URA PAYE) to ensure zero double-counting in executive financial analytics.
7. **Official Payslips & Banking Schedules**:
   - Printable & downloadable branded HTML/PDF Payslips for employees with QR/verification stamp, itemized earnings, deductions, YTD summary, and signature lines.
   - Bank Payment Schedule CSV/Excel export formatted for commercial banks (Stanbic Bank, Centenary Bank, ABSA, Equity Bank).
   - Mobile Money Bulk Payout Schedule export (MTN MoMo, Airtel Money).
   - NSSF Monthly Schedule (Form C / e-returns format with NSSF numbers).
   - URA PAYE Monthly Tax Schedule (e-tax returns format with employee TINs).

---

## 2. RESOLUTION OF FINAL DESIGN GATES

### Gate 1: Versioned Statutory Rules & Parameter Boundaries
- **No Hardcoded Fragility**: NSSF and PAYE tax rates/brackets are not hardcoded constants. They are encapsulated in a versioned statutory engine interface: `UgandaStatutoryEngine` parameterized by effective date ranges.
- **Current Uganda Baseline (Effective 2026/2027)**:
  - **NSSF Uganda (NSSF Act Cap 222 as amended)**:
    - Employee Contribution Rate: $5.00\%$ of gross cash emoluments.
    - Employer Contribution Rate: $10.00\%$ of gross cash emoluments.
    - Total Remittance: $15.00\%$.
  - **URA PAYE Tax Brackets (Monthly Resident Individual)**:
    | Monthly Taxable Pay Band (UGX) | Tax Rate Formula |
    |:---|:---|
    | **$0$ to $235,000$** | Nil ($0\%$) |
    | **$235,001$ to $335,000$** | $10\%$ of amount exceeding UGX $235,000$ |
    | **$335,001$ to $410,000$** | UGX $10,000 + 20\%$ of amount exceeding UGX $335,000$ |
    | **$410,001$ to $10,000,000$** | UGX $25,000 + 30\%$ of amount exceeding UGX $410,000$ |
    | **Exceeding $10,000,000$** | UGX $2,902,000 + 40\%$ of amount exceeding UGX $10,000,000$ |
- **Explicitly Marked Values Requiring Authoritative Confirmation / Configuration**:
  - *Local Service Tax (LST)*: Annual/monthly municipal tax schedules (configurable branch toggle).
  - *Non-Resident Individual Tax Rate*: Flat 15% / 30% depending on treaty status (configurable on employee profile).
  - *Secondary Employment Rate*: Flat 30% without statutory threshold relief (configurable on employee profile).
  - *In-Kind Benefits Valuation*: Specific non-cash benefit rules under Section 19 of the Uganda Income Tax Act.

---

### Gate 2: Net Pay Invariant & Deductions Exceeding Gross Rule
- **Strict Accounting Integrity Rule**: In standard payroll accounting, total deductions cannot exceed total gross earnings in a valid payslip.
- **Authoritative Handling for Deductions Exceeding Gross**:
  1. The system **never silently clamps** a mathematically invalid payroll.
  2. If custom/voluntary deductions (e.g. advance recoveries or loan repayments) exceed gross earnings:
     - The calculation engine throws an explicit validation error:  
       `PAYROLL_CALCULATION_ERROR: Total deductions (UGX X) exceed gross earnings (UGX Y) for employee {employeeCode}`.
     - The bursar/accountant must adjust the voluntary deduction in the draft payslip (e.g., rescheduling advance recovery across multiple months) so that $\text{TotalDeductions} \le \text{GrossEarnings}$.
  3. **Permitted Edge Case (Zero Net Pay)**:
     If $\text{TotalDeductions} == \text{GrossEarnings}$, $\text{NetSalary} = 0.00 \text{ UGX}$ is valid and mathematically sound ($0.00 + \text{Deductions} \equiv \text{Gross}$).
  4. **Universal Mathematical Equality Invariant**:
     $$\text{GrossSalary} \equiv \text{NetSalary} + \text{TotalDeductions} \quad (\forall \text{ Payslips})$$
     $$\text{totalGross} \equiv \text{totalNet} + \text{totalDeductions} \quad (\forall \text{ PayrollRuns})$$
     No silent clamping, zero hidden variance, and 100% precision.

---

### Gate 3: Payroll $\to$ Expense $\to$ Cash Outflow Architecture (Zero Double-Counting)
To ensure absolute financial truth and prevent duplicate cash-outflow counting in Phase 3.1D Executive Analytics, we explicitly distinguish the 4 financial stages:

1. **Stage A: Employment Cost Recognition (Accrual / Liability)**:
   - Occurs when the payroll run is `APPROVED`.
   - Total Institutional Cost: $\text{totalEmployerCost} = \text{totalGross} + \text{totalEmployerNSSF}$.
   - Breakdown:
     - Net Pay Liability to Staff: $\text{totalNet}$
     - PAYE Tax Liability to URA: $\text{totalPAYE}$
     - NSSF Liability to NSSF Uganda: $\text{totalEmployeeNSSF} + \text{totalEmployerNSSF}$
     - Other Deductions Liability (SACCO, Welfare): $\text{totalOtherDeductions}$

2. **Stage B: Employee Net Pay Disbursement (Cash Outflow 1)**:
   - Occurs when the payroll run transitions to `PAID`.
   - The cashier/bursar disburses actual funds to staff bank accounts / Mobile Money wallets.
   - An `Expense` record is automatically created in Phase 3.1D:
     - `categoryId`: `Salaries & Wages` (`SALARIES_AND_WAGES`)
     - `amount`: $\text{totalNet}$ (exact cash disbursed to staff)
     - `status`: `POSTED`
     - `paymentMethod`: Matches disbursement channel (`BANK_TRANSFER`, `MOBILE_MONEY`, `CASH`)
     - `expenseNumber`: Allocated via `ExpenseSequence` (`EXP-YYYY-XXXXX`)
     - `idempotencyKey`: `EXP_PR_{payrollNumber}`

3. **Stage C: Statutory & Third-Party Remittances (Separate Subsequent Cash Outflows)**:
   - Remitting PAYE to URA, NSSF to NSSF Uganda, and SACCO deductions are subsequent, distinct operational cash outflows.
   - When the bursar pays URA or NSSF, standard Phase 3.1D expense vouchers are posted under dedicated categories:
     - `Taxes & Statutory Deductions` (`TAXES_AND_STATUTORY`) for URA PAYE remittance ($=\text{totalPAYE}$).
     - `Pension & Social Security` (`PENSION_AND_NSSF`) for NSSF 15% remittance ($=\text{totalEmployeeNSSF} + \text{totalEmployerNSSF}$).
     - `Staff Welfare & SACCO` for SACCO remittances.

4. **Stage D: Expense Reporting & Zero Double-Counting Proof**:
   $$\text{Staff Salary Expense Voucher} = \text{totalNet}$$
   $$\text{NSSF Remittance Voucher (when paid)} = \text{totalEmployeeNSSF} + \text{totalEmployerNSSF}$$
   $$\text{PAYE Remittance Voucher (when paid)} = \text{totalPAYE}$$
   $$\text{Other Deductions Vouchers (when remitted)} = \text{totalOtherDeductions}$$
   $$\sum \text{All Cash Outflows} \equiv \text{totalEmployerCost}$$
   Every operational cash outflow is recorded **exactly once** on the actual disbursement date.

---

### Gate 4: Controlled Reversal Architecture
- **Pre-Disbursement Reversal (`APPROVED` State)**:
  - An `APPROVED` run that has not been disbursed can be returned to `DRAFT` via `REJECT` by an approver (with mandatory feedback) or `CANCELLED` by an authorized user.
  - No expense vouchers or financial ledger records exist yet.
- **Post-Disbursement Reversal (`PAID` State)**:
  - A `PAID` payroll run is permanently locked.
  - If an authorized administrator with `payroll:cancel` executes a formal reversal:
    1. The run status transitions to `CANCELLED`, storing `cancelledById`, `cancelledAt`, and `cancellationReason` ($\ge 10$ characters).
    2. The linked Phase 3.1D `Expense` voucher (`PayrollRun.expenseId`) is automatically voided via the authoritative `ExpenseDAO.voidExpense`, preserving immutable voucher audit history.
    3. Individual payslips transition to `CANCELLED`.
    4. Historical snapshot values on payslips and line items remain intact for audit reconstruction.
    5. An immutable `PAYROLL_RUN_REVERSED` event is written to `AuditService`.

---

### Gate 5: Payout Idempotency & Durable Payout Keys
- Each employee payout within a run has a deterministic unique identity:
  $$\text{payoutKey} = \text{PR\_}\{payrollRunId\}\text{\_EMP\_}\{employeeId\}$$
- Run-level disbursement is guarded by an atomic PostgreSQL transaction with row-level locking (`SELECT ... FOR UPDATE`):
  1. If `PayrollRun.status === PAID`, the operation is an immediate idempotent return of existing disbursement records.
  2. Transitions `Payslip.status` to `PAID` and stamps `paymentDate`, `paymentReference`.
  3. Creates the linked `Expense` voucher with unique idempotency key `EXP_PR_{payrollNumber}`.
  4. Subsequent concurrent or retry calls safely resolve without duplicate cash outflows or corrupted states.

---

### Gate 6: Deterministic Export Artifacts & Integration Boundaries
- **Export Snapshot Source**: Bank and Mobile Money transfer schedules are generated strictly from the immutable `Payslip` snapshots of an `APPROVED` or `PAID` payroll run.
- **Deterministic Formatting**:
  - Bank Schedule: CSV/Excel with columns `Bank Name`, `Branch`, `Account Number`, `Account Name`, `Amount (UGX)`, `Payment Reference` (`SAL-{YYYY}{MM:02d}-{EMP_CODE}`), `Narration`.
  - Mobile Money Schedule: CSV/Excel with columns `Phone Number` (`2567...`), `Provider` (`MTN`/`AIRTEL`), `Recipient Name`, `Amount (UGX)`, `Reference`.
- **Duplicate Protection & Audit**:
  - File downloads are deterministic (re-exporting yields identical data).
  - Every export action is logged in `AuditService` (`PAYROLL_RUN_EXPORTED`).
- **Clear Architectural Boundary**:
  - NOVA does **not** directly execute bank wire or mobile money API transfers in Phase 3.1F.
  - Standardized bank-ready batch files are generated for manual/SFTP upload by authorized school finance officers.

---

### Gate 7: Payslip Snapshot Lifecycle & Timing
- **`DRAFT` State**: Preliminary draft payslips generated during run creation; ad-hoc items can be adjusted.
- **`SUBMITTED` State**: Payslip figures are strictly locked against edits.
- **`APPROVED` State**: Payslip is officially authorized; viewable by management with `APPROVED` watermark.
- **`PAID` State**: Payslip is stamped `PAID` with payment date and disbursement reference; ready for official employee distribution, printing, and download.
- All employee identification (code, name, department, title, TIN, NSSF, bank details) and financial line items are snapshotted at calculation time and remain **permanently immutable**.

---

### Gate 8: Statutory Reporting vs Submission Boundaries
- **NOVA Scope**:
  - Calculation Engine: High-precision statutory NSSF (5%/10%) and URA PAYE bracket math.
  - Internal Compliance Schedules: Formatted NSSF Form C monthly schedule and URA Monthly PAYE return schedule.
- **External Integration Boundary**:
  - NOVA does **not** perform automated direct API submission to URA e-tax or NSSF portals in Phase 3.1F.
  - Authorized finance officers export the standardized schedules to file on the respective government portals.

---

### Gate 9: State Machine & Legal Transitions
```
                 ┌──────────────────────────────────────────────┐
                 │                   [ DRAFT ]                  │
                 └───────┬──────────────────────────────▲───────┘
                         │                              │
                Submit (payroll:submit)         Reject (payroll:approve)
                         │                              │
                         ▼                              │
                 ┌───────────────────────┐              │
                 │     [ SUBMITTED ]     ├──────────────┘
                 └───────┬───────────────┘
                         │
                Approve (payroll:approve)
                (submittedById !== approvedById)
                         │
                         ▼
                 ┌───────────────────────┐
                 │     [ APPROVED ]      │
                 └───────┬───────────────┘
                         │
                Disburse (payroll:disburse)
                (Creates Phase 3.1D Expense)
                         │
                         ▼
                 ┌───────────────────────┐
                 │       [ PAID ]        │
                 └───────────────────────┘

  * Any DRAFT, SUBMITTED, APPROVED, or PAID run can be CANCELLED by an authorized
    administrator with `payroll:cancel` (voiding linked Expense if PAID).
```

---

### Gate 10: Final Financial Reconciliation Invariants

1. **Employee Payslip Invariants**:
   $$\text{grossSalary} = \text{baseSalary} + \sum \text{allowanceItems}$$
   $$\text{totalDeductions} = \text{employeeNSSF} + \text{PAYE} + \sum \text{customDeductions}$$
   $$\text{netSalary} = \text{grossSalary} - \text{totalDeductions} \quad (\ge 0)$$
   $$\text{employerContribution} = \text{employerNSSF} = \text{round}(\text{grossSalary} \times 0.10, 2)$$
   $$\text{employerTotalCost} = \text{grossSalary} + \text{employerContribution}$$

2. **Branch Payroll Run Invariants**:
   $$\text{totalBasic} = \sum_{p \in \text{payslips}} p.\text{baseSalary}$$
   $$\text{totalAllowances} = \sum_{p \in \text{payslips}} p.\text{totalAllowances}$$
   $$\text{totalGross} = \sum_{p \in \text{payslips}} p.\text{grossSalary} \equiv \text{totalBasic} + \text{totalAllowances}$$
   $$\text{totalDeductions} = \sum_{p \in \text{payslips}} p.\text{totalDeductions}$$
   $$\text{totalNet} = \sum_{p \in \text{payslips}} p.\text{netSalary} \equiv \text{totalGross} - \text{totalDeductions}$$
   $$\text{totalEmployerCost} = \text{totalGross} + \sum_{p \in \text{payslips}} p.\text{employerContribution}$$

3. **Phase 3.1D Outflow & Cash-Flow Integration Invariants**:
   $$\text{Expense}_{\text{Salaries \& Wages}}.\text{amount} \equiv \text{totalNet}$$
   $$\text{Expense}_{\text{NSSF Remittance}}.\text{amount} \equiv \text{totalEmployeeNSSF} + \text{totalEmployerNSSF} \quad (\text{when remitted})$$
   $$\text{Expense}_{\text{PAYE Remittance}}.\text{amount} \equiv \text{totalPAYE} \quad (\text{when remitted})$$
   $$\sum \text{All Cash Outflows} \equiv \text{totalEmployerCost}$$

---

## 3. PROPOSED PRISMA SCHEMA DEFINITIONS

```prisma
// ==========================================
// ENUMS FOR PHASE 3.1F
// ==========================================

enum PayrollStatus {
  DRAFT
  SUBMITTED
  APPROVED
  PAID
  CANCELLED
}

enum PayslipStatus {
  PENDING
  PAID
  CANCELLED
}

enum SalaryComponentType {
  ALLOWANCE
  DEDUCTION
  EMPLOYER_CONTRIBUTION
}

enum CalculationType {
  FIXED_AMOUNT
  PERCENTAGE_OF_BASIC
  PERCENTAGE_OF_GROSS
  UGANDA_PAYE_TIER
  NSSF_STANDARD
}

enum SalaryPaymentMethod {
  BANK_TRANSFER
  MOBILE_MONEY
  CASH
  CHEQUE
}

// ==========================================
// 1. EMPLOYEE COMPENSATION PROFILE
// ==========================================

model EmployeeCompensation {
  id                  String              @id @default(cuid())
  branchId            String
  employeeId          String              @unique
  baseSalary          Decimal             @db.Decimal(12, 2)
  currency            String              @default("UGX")
  paymentMethod       SalaryPaymentMethod @default(BANK_TRANSFER)
  
  // Banking details
  bankName            String?
  bankBranch          String?
  accountNumber       String?
  accountName         String?
  
  // Mobile Money details
  mobileMoneyNumber   String?
  mobileMoneyProvider String?             // MTN, AIRTEL
  
  // Statutory IDs
  tinNumber           String?             // URA Tax Identification Number
  nssfNumber          String?             // NSSF 13-digit number
  
  isActive            Boolean             @default(true)
  effectiveDate       DateTime            @default(now())
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  branch              Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  employee            Employee            @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  items               EmployeeSalaryItem[]

  @@unique([branchId, employeeId])
  @@index([branchId, isActive])
}

// ==========================================
// 2. SALARY COMPONENT CATALOG
// ==========================================

model SalaryComponent {
  id              String              @id @default(cuid())
  branchId        String
  name            String              // e.g. "Housing Allowance", "NSSF Employee", "Staff SACCO"
  code            String              // e.g. "HOUSING", "NSSF_EMP", "PAYE", "SACCO"
  type            SalaryComponentType // ALLOWANCE, DEDUCTION, EMPLOYER_CONTRIBUTION
  calculationType CalculationType     // FIXED_AMOUNT, PERCENTAGE_OF_BASIC, UGANDA_PAYE_TIER, NSSF_STANDARD
  defaultAmount   Decimal?            @db.Decimal(12, 2)
  percentageRate  Decimal?            @db.Decimal(5, 2)
  isStatutory     Boolean             @default(false)
  isTaxable       Boolean             @default(true)
  description     String?
  isActive        Boolean             @default(true)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  branch          Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  employeeItems   EmployeeSalaryItem[]
  payslipItems    PayslipItem[]

  @@unique([branchId, name])
  @@unique([branchId, code])
}

// ==========================================
// 3. RECURRING EMPLOYEE SALARY ITEMS
// ==========================================

model EmployeeSalaryItem {
  id             String               @id @default(cuid())
  compensationId String
  componentId    String
  amount         Decimal?             @db.Decimal(12, 2)
  percentageRate Decimal?             @db.Decimal(5, 2)
  isActive       Boolean              @default(true)
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  compensation   EmployeeCompensation @relation(fields: [compensationId], references: [id], onDelete: Cascade)
  component      SalaryComponent      @relation(fields: [componentId], references: [id], onDelete: Cascade)

  @@unique([compensationId, componentId])
}

// ==========================================
// 4. MONTHLY PAYROLL RUN
// ==========================================

model PayrollRun {
  id                 String        @id @default(cuid())
  branchId           String
  payrollNumber      String        // PR-2026-00001 (Sequential)
  year               Int           // e.g. 2026
  month              Int           // 1 to 12
  title              String        // e.g. "August 2026 Staff Payroll"
  status             PayrollStatus @default(DRAFT)
  
  // Aggregated Totals
  totalBasic         Decimal       @default(0) @db.Decimal(12, 2)
  totalAllowances    Decimal       @default(0) @db.Decimal(12, 2)
  totalGross         Decimal       @default(0) @db.Decimal(12, 2)
  totalDeductions    Decimal       @default(0) @db.Decimal(12, 2)
  totalNet           Decimal       @default(0) @db.Decimal(12, 2)
  totalEmployerCost  Decimal       @default(0) @db.Decimal(12, 2) // Gross + Employer NSSF
  
  totalEmployees     Int           @default(0)
  paidEmployees      Int           @default(0)
  
  // Operational Outflow Link (Phase 3.1D)
  expenseId          String?       @unique

  // Lifecycle & Approvals
  createdById        String
  submittedById      String?
  submittedAt        DateTime?
  approvedById       String?
  approvedAt         DateTime?
  disbursedById      String?
  disbursedAt        DateTime?
  cancellationReason String?
  notes              String?
  
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  branch             Branch        @relation(fields: [branchId], references: [id], onDelete: Cascade)
  createdBy          User          @relation("PayrollCreator", fields: [createdById], references: [id])
  submittedBy        User?         @relation("PayrollSubmitter", fields: [submittedById], references: [id])
  approvedBy         User?         @relation("PayrollApprover", fields: [approvedById], references: [id])
  disbursedBy        User?         @relation("PayrollDisburser", fields: [disbursedById], references: [id])
  expense            Expense?      @relation(fields: [expenseId], references: [id], onDelete: SetNull)
  payslips           Payslip[]

  @@unique([branchId, year, month])
  @@unique([branchId, payrollNumber])
  @@index([branchId, year, month, status])
}

// ==========================================
// 5. INDIVIDUAL PAYSLIP
// ==========================================

model Payslip {
  id                   String              @id @default(cuid())
  branchId             String
  payrollRunId         String
  employeeId           String
  payslipNumber        String              // PS-2026-00001 (Sequential)
  status               PayslipStatus       @default(PENDING)
  
  // Historical Snapshot Fields
  employeeCode         String
  employeeName         String
  departmentName       String?
  employeeTypeName     String?
  tinNumber            String?
  nssfNumber           String?

  // Financial Snapshot
  baseSalary           Decimal             @db.Decimal(12, 2)
  totalAllowances      Decimal             @default(0) @db.Decimal(12, 2)
  grossSalary          Decimal             @db.Decimal(12, 2)
  totalDeductions      Decimal             @default(0) @db.Decimal(12, 2)
  netSalary            Decimal             @db.Decimal(12, 2)
  employerContribution Decimal             @default(0) @db.Decimal(12, 2)
  
  // Payment Details Snapshot
  paymentMethod        SalaryPaymentMethod
  bankName             String?
  accountNumber        String?
  accountName          String?
  mobileMoneyNumber    String?
  paymentDate          DateTime?
  paymentReference     String?             // Bank transfer slip / MoMo TxID
  
  notes                String?
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  branch               Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  payrollRun           PayrollRun          @relation(fields: [payrollRunId], references: [id], onDelete: Cascade)
  employee             Employee            @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  items                PayslipItem[]

  @@unique([payrollRunId, employeeId])
  @@unique([branchId, payslipNumber])
  @@index([branchId, employeeId])
}

// ==========================================
// 6. ITEMIZED PAYSLIP LINE ITEM
// ==========================================

model PayslipItem {
  id          String              @id @default(cuid())
  payslipId   String
  componentId String?
  name        String              // e.g. "Housing Allowance", "PAYE Tax", "NSSF 5%"
  code        String              // e.g. "HOUSING", "PAYE", "NSSF_EMP"
  type        SalaryComponentType // ALLOWANCE, DEDUCTION, EMPLOYER_CONTRIBUTION
  amount      Decimal             @db.Decimal(12, 2)
  rateApplied Decimal?            @db.Decimal(5, 2)
  isStatutory Boolean             @default(false)
  isTaxable   Boolean             @default(true)
  notes       String?

  payslip     Payslip             @relation(fields: [payslipId], references: [id], onDelete: Cascade)
  component   SalaryComponent?    @relation(fields: [componentId], references: [id], onDelete: SetNull)

  @@index([payslipId, type])
}

// ==========================================
// 7. PAYROLL SEQUENCE GENERATOR
// ==========================================

model PayrollSequence {
  id        String   @id @default(cuid())
  branchId  String
  type      String   // "PAYROLL_RUN" or "PAYSLIP"
  year      Int
  nextValue Int      @default(1)
  updatedAt DateTime @updatedAt

  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([branchId, type, year])
}
```

---

## 4. ADVERSARIAL TEST MATRIX (PAY-01 to PAY-20)

| Test ID | Scenario Description | Expected Invariant / Assertion |
|:---|:---|:---|
| **PAY-01** | Create Employee Compensation profile with Decimal salary | Profile saved, unique constraint on `[branchId, employeeId]` enforced, bank/TIN/NSSF stored accurately. |
| **PAY-02** | Create standard and custom Salary Components | Components created for Fixed, Percentage, and Statutory types; duplicate codes rejected per branch. |
| **PAY-03** | Uganda NSSF statutory calculations across salary bands | Exactly 5% employee deduction, 10% employer cost, 15% total remittance; Decimal rounding verified. |
| **PAY-04** | URA PAYE progressive bracket calculations across all 5 bands | Thresholds ($235k, $335k, $410k, $10m) calculated exactly with zero deviations from URA rules. |
| **PAY-05** | Batch monthly payroll generation for active branch employees | Snapshots base salary and components; aggregates totals; creates atomic sequence `PR-YYYY-XXXXX`. |
| **PAY-06** | Eligibility filtering (Terminated vs Joiners vs Inactive) | Terminated before period start excluded; mid-period joiners included; inactive staff without salary excluded. |
| **PAY-07** | Draft payslip manual adjustments (Ad-hoc bonus / Advance) | Adds ad-hoc allowance/deduction line items and re-aggregates run totals cleanly. |
| **PAY-08** | Deductions exceeding gross earnings rejection test | If total deductions > gross earnings, system rejects with explicit validation error (no silent clamping). |
| **PAY-09** | Full aggregation equality invariant check | `totalGross == totalBasic + totalAllowances`, `totalNet == totalGross - totalDeductions` holds across all runs. |
| **PAY-10** | Submission transition (`DRAFT` $\to$ `SUBMITTED`) | Status changes to `SUBMITTED`, records `submittedById`, locks payslip items from modification. |
| **PAY-11** | Self-approval prevention enforcement | Attempting to approve a run where `submittedById === currentUserId` fails with `403 Forbidden`. |
| **PAY-12** | Approval transition and Rejection return to Draft | Approver authorizes run $\to$ `APPROVED`; Rejection returns run to `DRAFT` with audited reason. |
| **PAY-13** | Disbursement transition and automated Expense posting | Marking run as `PAID` creates linked `Expense` voucher in Phase 3.1D for `totalNet` under `Salaries & Wages`. |
| **PAY-14** | Disbursement idempotency under duplicate requests | Concurrent disbursement calls execute safely without duplicate `Expense` creation or state corruption. |
| **PAY-15** | Employee profile edits after payroll run generation | Editing an employee's salary in September does NOT alter August's approved/paid payslip or run. |
| **PAY-16** | Deterministic Bank Transfer Schedule Export | Generates accurate CSV/Excel schedule with account numbers, amounts, and references. |
| **PAY-17** | Deterministic Mobile Money Payout Schedule Export | Generates formatted schedule for MTN MoMo and Airtel Money bulk disbursement. |
| **PAY-18** | NSSF Form C and URA PAYE statutory return generation | Generates compliance schedules with matching gross, NSSF, and PAYE totals. |
| **PAY-19** | Strict multi-tenant branch isolation | Branch A cannot view, generate, disburse, or export Branch B payroll runs or compensation profiles. |
| **PAY-20** | Comprehensive AuditService event logging | All lifecycle transitions (Profile, Create, Recalculate, Submit, Approve, Reject, Disburse, Export) logged. |

---

## STATUS

STATUS: READY FOR IMPLEMENTATION
