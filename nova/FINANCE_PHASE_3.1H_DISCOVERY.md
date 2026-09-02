# NOVA — FINANCE PHASE 3.1H ARCHITECTURE SPECIFICATION
**Target Subsystem**: School Requirements Tracker, In-Kind Collections & Student Financial Clearance Engine  
**Document Status**: ARCHITECTURE SPECIFICATION — READY FOR IMPLEMENTATION  
**Author**: Antigravity Core Architecture Team  
**Date**: September 2026  
**Parent Checkpoint**: `5b16b4b` (Finance Phase 3.1G Approved & Closed)

---

## 1. STRATEGIC & OPERATIONAL CONTEXT

In Ugandan and East African schools (both day and boarding institutions), student obligations at the start of each academic term consist of two parallel streams:
1. **Monetary School Fees**: Tuition, development levies, boarding fees, examination fees, and PTA contributions (authoritatively billed and collected via Phases 3.1A–3.1E).
2. **In-Kind Physical Requirements**: Non-monetary materials mandated per student (e.g., A4 reams of paper, scrubbing brushes, toilet rolls, bar soap, laboratory reagents, mathematical sets, or boarding personal bedding).

School administration provides parents with two legal fulfillment mechanisms:
- **Physical Delivery**: Handing over the required goods to the school bursar or storekeeper upon reporting.
- **Cash-in-Lieu Monetization**: Paying an established monetary equivalent per item directly to the school cashier. This revenue enters the school accounting pipeline through standard receipting.

Furthermore, **Student Financial Clearance** is the critical operational gatekeeper for:
- Issuance of **Examination Permits / Cards**.
- Admission through school gates on reporting day (**Gate Passes**).
- Release of end-of-term **Report Cards** and academic transcripts.

Clearance requires an automated, tamper-evident evaluation of **BOTH** financial ledger balances (no overdue debt) and mandatory requirements fulfillment (all mandatory items delivered or monetized).

Phase 3.1H implements this unified subsystem with strict multi-tenant branch isolation, immutable historical snapshots, zero double-counting against the Phase 3.1C ledger, cryptographic QR verification, and complete audit logging.

---

## 2. GATES RESOLUTION & ARCHITECTURAL DECISIONS

### Gate 1: Requirement Authority & Period Identity
- **Authority Rule**: A single authoritative `ClassRequirement` blueprint exists per `branchId + classId + academicYearId + (termId | null)`.
- If `termId` is `null`, the blueprint represents an **Annual Requirement** applicable across the entire academic year.
- If `termId` is populated, the blueprint represents a **Termly Requirement** specific to that academic term.
- Database uniqueness constraint `@@unique([branchId, classId, academicYearId, termId])` strictly prevents conflicting or competing requirement blueprints for the same class and period.
- At the student level, a student receives exactly one `StudentRequirementRecord` per `branchId + studentId + academicYearId + termId`.

### Gate 2: Historical Snapshots & Immutability
- Requirements assigned to students must remain historically reproducible even if administrators alter catalog items or class blueprints later in the term.
- When a class blueprint is assigned to enrolled students:
  - Each `ClassRequirementItem` instantiates a `StudentRequirementItem` containing frozen snapshot fields:
    - `name`: string (e.g. "Rotatrim A4 Copier Paper 500 Sheets")
    - `category`: `RequirementCategory`
    - `unit`: `RequirementUnit`
    - `quantityRequired`: `Decimal(8,2)`
    - `cashInLieuAmount`: `Decimal(12,2)`
    - `isMandatory`: boolean
  - If the blueprint or catalog item is later modified or deleted, all historical student checklist items remain frozen and immutable.

### Gate 3: In-Kind Receipts & Physical Lifecycle
- **Item State Machine**:
  $$\text{PENDING} \longrightarrow \text{PARTIAL} \longrightarrow \text{FULFILLED} \text{ (or } \text{MONETIZED} \text{ / } \text{EXEMPTED)}$$
- **Fulfillment Formulas**:
  $$\text{Effective Delivered} = \text{quantityDelivered} + \text{quantityMonetized}$$
  $$\text{Status} = \begin{cases}
  \text{EXEMPTED} & \text{if explicitly exempted by authorized bursar} \\
  \text{MONETIZED} & \text{if } \text{quantityMonetized} \ge \text{quantityRequired} \\
  \text{FULFILLED} & \text{if } \text{Effective Delivered} \ge \text{quantityRequired} \text{ and } \text{quantityDelivered} > 0 \\
  \text{PARTIAL} & \text{if } 0 < \text{Effective Delivered} < \text{quantityRequired} \\
  \text{PENDING} & \text{if } \text{Effective Delivered} = 0
  \end{cases}$$
- **Handover Logging**:
  - Every physical delivery creates an append-only `InKindHandoverLog` record storing `deltaDelivered`, `previousDelivered`, `newDelivered`, `receivedById`, `receivedAt`, `notes`, and atomic receipt reference `INK-YYYY-NNNNN`.
- **Non-Destructive Corrections & Reversals**:
  - If an item quantity was entered erroneously (e.g. 10 reams instead of 1), corrections are performed by logging a corrective handover with a negative `deltaDelivered`, recording the justification and authorized staff ID. Hard deletes of handover history are prohibited.

### Gate 4: Cash-in-Lieu Monetization Pipeline
- **Strict Integration with Phase 3.1C**: Cash-in-lieu payments MUST utilize the authoritative `PaymentDAO` pipeline. NOVA never creates a competing financial cash authority.
- **Workflow Mechanics**:
  1. Each `ClassRequirementItem` optionally links to an existing `FeeType` (e.g., `REQUIREMENTS_FEE`).
  2. When a parent pays cash in lieu of physical items:
     - Cashier specifies the unfulfilled quantity to monetize (e.g., `1 ream @ UGX 35,000`).
     - System invokes `PaymentDAO.createPayment` with `paymentMethod`, total amount, cashier ID, and receipt sequence number (`REC-YYYY-NNNNN`).
     - Payment atomically credits the `StudentLedgerEntry` and creates an official receipt.
     - The `StudentRequirementItem` is updated:
       - `quantityMonetized += monetizedQty`
       - `paymentId = payment.id`
       - Status recalculated to `MONETIZED` or `FULFILLED`.
- **Reconciliation**:
  - `StudentRequirementItem.paymentId` maintains a direct foreign key to `Payment.id`.
  - Cash-in-lieu collections reconcile 100% against fee payment receipts on the subledger.

### Gate 5: Requirement vs Fee Accounting (Zero Double-Counting)
- **Physical Deliveries**: Produce **ZERO ledger impact**. Physical items are material inventory, not monetary credits.
- **Cash-in-Lieu Payments**: Produce **EXACTLY ONE ledger credit** via the standard `Payment` pipeline.
- **Over-Fulfillment Protection**: The system rejects physical handover or monetization where $\text{quantityDelivered} + \text{quantityMonetized} > \text{quantityRequired}$ unless explicit over-delivery is acknowledged.
- **Invoice Item Synchronization**: If a school includes requirements as an itemized fee head on the term `Invoice`, payment allocation settles the invoice line item and simultaneously marks the requirement item as `MONETIZED`.

### Gate 6: Authoritative Student Clearance Engine
- The Clearance Engine evaluates student eligibility in real-time based on two authoritative criteria:
  1. **Financial Rule**:
     - `Ledger Balance <= MaxAllowedBalance` (default: UGX 0; configurable branch ceiling, e.g. UGX 50,000).
     - **Credit Balances (Negative Balance)**: A student with an advance credit (e.g. -UGX 200,000) **HAS FULL FINANCIAL CLEARANCE**.
     - **Debit Balances (Positive Balance)**: A student with debt exceeding `MaxAllowedBalance` is **BLOCKED**.
     - Term Invoiced Ratio: $\frac{\text{Total Paid for Term}}{\text{Total Net Invoiced for Term}} \ge \text{RequiredTermPaidPercent}$ (default: 100%).
  2. **Requirements Rule**:
     - Every requirement item where `isMandatory = true` must be in status `FULFILLED`, `MONETIZED`, or `EXEMPTED`.
     - Any mandatory item in `PENDING` or `PARTIAL` fails clearance.
  3. **Clearance Decision**:
     - `CLEARED`: Student satisfies both Financial and Requirements rules.
     - `BLOCKED`: Student fails one or both rules.
     - `PROVISIONAL`: Explicit administrative override granted by `Principal` or `Bursar` for indebted students, requiring a mandatory written justification, valid date range (`validUntil`), and audit log.

### Gate 7: Exam Permits & Gate Passes
- **Document Types**:
  - `EXAM_PERMIT`: Admission card for mid-term / end-of-term national and internal examinations.
  - `GATE_PASS`: School gate admission on reporting day for boarding/day students.
  - `REPORT_CARD`: Clearance token required prior to academic report card release.
- **Lifecycle**: `ACTIVE` $\longrightarrow$ `REVOKED` / `EXPIRED`.
- **Atomic Sequential Numbering**: `CLR-YYYY-NNNNN` generated via `ClearanceSequence`.
- **Immutable Snapshot Fields on Permit**:
  - `clearanceNumber`, `studentId`, `studentName`, `studentCode`, `classId`, `className`
  - `academicYearId`, `termId`
  - `ledgerBalanceAtIssue`: exact Decimal(12,2)
  - `feesPaidPercentAtIssue`: exact Decimal(5,2)
  - `requirementsFulfilledAtIssue`: boolean
  - `clearanceType`: `EXAM_PERMIT` | `GATE_PASS` | `REPORT_CARD`
  - `status`: `CLEARED` | `PROVISIONAL`
  - `provisionalReason`: string?
  - `authorizedById`, `issuedAt`, `validUntil`
  - `verificationToken`: 256-bit cryptographically secure token.
- **Revocation**:
  - Bursar/Admin can revoke an active permit if a dishonored payment occurs or misconduct is reported. Revocation requires a mandatory reason and immediately invalidates QR validation.

### Gate 8: Cryptographic QR Verification Security
- **Token Entropy**: Generated using Node.js `crypto.randomBytes(32).toString('hex')` (64 hex characters, 256-bit entropy).
- **Zero Sensitive Data in QR**: The QR code embeds ONLY the secure HTTPS verification URL:
  `https://[app-url]/verify/clearance/[verificationToken]`
  The QR payload **NEVER** contains student national ID, financial figures, phone numbers, or private student data.
- **Server-Side Verification Logic (`/api/clearance/verify/[token]`)**:
  - Finds clearance record by `verificationToken`.
  - If not found $\rightarrow$ `INVALID`.
  - If `status == REVOKED` $\rightarrow$ `REVOKED` (shows revocation timestamp and reason).
  - If `validUntil && validUntil < NOW()` $\rightarrow$ `EXPIRED`.
  - If valid $\rightarrow$ `VALID` (renders sanitized verification card with student photo, name, class, clearance type, issuing date, and authorized status).

### Gate 9: Storekeeper Reconciliation & Inventory Handover
- Aggregates physical materials collected across all classes and streams for an academic year and term.
- Summarizes total physical quantities received per requirement item (e.g. "Senior 1 & 2 collected 420 Reams of A4 Paper, 1,280 Toilet Rolls, 85 Scrubbing Brushes").
- Subtracts corrective negative adjustments cleanly.
- Strict multi-tenant isolation ensures no cross-branch material aggregation.

### Gate 10: RBAC & Granular Permissions
| Permission String | Description | Default Roles |
| :--- | :--- | :--- |
| `requirements:catalog:manage` | Create, edit, and categorize standard catalog items | `Admin`, `Bursar` |
| `requirements:blueprint:manage` | Create, edit class requirement blueprints and cash-in-lieu fees | `Admin`, `Bursar` |
| `requirements:assign` | Bulk assign blueprints to enrolled class cohorts | `Admin`, `Bursar` |
| `requirements:receive` | Record physical in-kind deliveries and corrective adjustments | `Admin`, `Bursar`, `Storekeeper`, `Receptionist` |
| `requirements:monetize` | Process cash-in-lieu payments via cashier pipeline | `Admin`, `Bursar`, `Cashier` |
| `clearance:evaluate` | Query student clearance status and ledger checks | `Admin`, `Bursar`, `Teacher`, `Cashier` |
| `clearance:issue` | Issue official Exam Permits and Gate Passes | `Admin`, `Bursar` |
| `clearance:provisional` | Authorize provisional clearance for indebted students | `Admin`, `Principal`, `Bursar` |
| `clearance:revoke` | Revoke active permits | `Admin`, `Principal`, `Bursar` |
| `clearance:verify` | Perform public/internal QR token verification | Public / Authenticated Staff |
| `requirements:reports` | View storekeeper tally and compliance reports | `Admin`, `Bursar`, `Storekeeper`, `Auditor` |

### Gate 11: Audit Trail Events
Every state transition emits structured audit logs via `AuditService.log`:
- `REQUIREMENT_CATALOG_CREATED`, `REQUIREMENT_CATALOG_UPDATED`
- `CLASS_REQUIREMENT_CREATED`, `CLASS_REQUIREMENT_UPDATED`, `CLASS_REQUIREMENT_DELETED`
- `REQUIREMENTS_BULK_ASSIGNED`
- `IN_KIND_HANDOVER_RECORDED` (records `studentId`, `blueprintItemId`, `deltaDelivered`, `receivedById`)
- `IN_KIND_HANDOVER_REVERSED` (records `studentId`, `blueprintItemId`, `deltaDelivered`, `reason`)
- `REQUIREMENT_CASH_IN_LIEU_PAID` (records `studentId`, `paymentId`, `amount`, `monetizedQty`)
- `REQUIREMENT_ITEM_EXEMPTED` (records `studentId`, `blueprintItemId`, `reason`)
- `CLEARANCE_PERMIT_ISSUED` (records `studentId`, `clearanceNumber`, `type`, `status`)
- `PROVISIONAL_CLEARANCE_GRANTED` (records `studentId`, `authorizedById`, `reason`, `validUntil`)
- `CLEARANCE_PERMIT_REVOKED` (records `studentId`, `clearanceNumber`, `revokedById`, `reason`)

### Gate 12: Concurrency & Idempotency
- **Atomic Sequence Generation**: Dedicated `ClearanceSequence` and `InKindReceiptSequence` models with PostgreSQL row-level locks prevent permit or receipt number collisions under concurrent requests.
- **Row-Level Transaction Locking**: All updates to `StudentRequirementRecord` and `StudentRequirementItem` execute inside `db.$transaction` to guarantee consistency during concurrent physical deliveries or cash-in-lieu payments.
- **Idempotent Class Assignment**: Bulk blueprint assignment queries existing student records and skips students already initialized for that academic year and term.

### Gate 13: Multi-Tenant Branch Isolation
- Non-nullable `branchId` on all models (`RequirementCatalog`, `ClassRequirement`, `ClassRequirementItem`, `StudentRequirementRecord`, `StudentRequirementItem`, `InKindHandoverLog`, `StudentClearance`, `ClearanceSequence`, `InKindReceiptSequence`).
- All queries and mutations in `RequirementsDAO` and `ClearanceDAO` validate `ctx.branchId`.

### Gate 14: Reporting & Analytics
1. **Class Compliance Summary Report**: Total students assigned, % compliant, % partial, % pending, total physical items collected vs required.
2. **Storekeeper Physical Handover Tally**: Item-by-item summary of all goods received in store for administrative custody transfer.
3. **Cash-in-Lieu Revenue Realization**: Monetary collections from monetized requirements compared to total in-kind valuation.
4. **Student Debtors & Clearance Roster**: Master list of students showing balance, requirements fulfillment, permit number, and clearance state.

---

## 3. COMPLETE PRISMA SCHEMA EXTENSION

```prisma
// ==========================================
// PHASE 3.1H: SCHOOL REQUIREMENTS & CLEARANCE ENUMS
// ==========================================

enum RequirementCategory {
  CLEANING_HYGIENE
  ACADEMIC_STATIONERY
  BOARDING_PERSONAL
  GENERAL
}

enum RequirementUnit {
  PIECE
  ROLL
  REAM
  BAR
  BOTTLE
  BOOK
  PACKET
  PAIR
  SET
  LITRE
  KG
}

enum RequirementItemStatus {
  PENDING
  PARTIAL
  FULFILLED
  MONETIZED
  EXEMPTED
}

enum ClearanceStatus {
  CLEARED
  PROVISIONAL
  BLOCKED
}

enum ClearanceType {
  EXAM_PERMIT
  GATE_PASS
  TERM_REGISTRATION
  REPORT_CARD
}

enum ClearanceDocStatus {
  ACTIVE
  REVOKED
  EXPIRED
}

// ==========================================
// PHASE 3.1H: DATA MODELS
// ==========================================

// Master catalog of standard physical requirement items
model RequirementCatalog {
  id                String               @id @default(cuid())
  branchId          String
  code              String
  name              String
  category          RequirementCategory  @default(GENERAL)
  unit              RequirementUnit      @default(PIECE)
  defaultCashInLieu Decimal?             @db.Decimal(12, 2)
  description       String?
  isActive          Boolean              @default(true)
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  branch            Branch               @relation(fields: [branchId], references: [id], onDelete: Cascade)
  blueprintItems    ClassRequirementItem[]

  @@unique([branchId, code])
  @@index([branchId, category])
}

// Class-level Requirement Blueprint per Term/Year
model ClassRequirement {
  id              String               @id @default(cuid())
  branchId        String
  classId         String
  academicYearId  String
  termId          String?
  title           String
  description     String?
  isActive        Boolean              @default(true)
  createdById     String
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  branch          Branch               @relation(fields: [branchId], references: [id], onDelete: Cascade)
  class           Class                @relation(fields: [classId], references: [id], onDelete: Restrict)
  academicYear    AcademicYear         @relation(fields: [academicYearId], references: [id], onDelete: Restrict)
  term            Term?                @relation(fields: [termId], references: [id], onDelete: SetNull)
  createdBy       User                 @relation("ClassRequirementCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  items           ClassRequirementItem[]
  studentRecords  StudentRequirementRecord[]

  @@unique([branchId, classId, academicYearId, termId])
  @@index([branchId, academicYearId, termId])
}

// Line items in a Class Requirement Blueprint
model ClassRequirementItem {
  id                  String              @id @default(cuid())
  classRequirementId  String
  catalogItemId       String?
  feeTypeId           String?             // Linked fee type for cash-in-lieu payments
  name                String
  category            RequirementCategory @default(GENERAL)
  unit                RequirementUnit     @default(PIECE)
  quantity            Decimal             @default(1) @db.Decimal(8, 2)
  cashInLieuAmount    Decimal?            @db.Decimal(12, 2)
  isMandatory         Boolean             @default(true)
  notes               String?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  classRequirement    ClassRequirement    @relation(fields: [classRequirementId], references: [id], onDelete: Cascade)
  catalogItem         RequirementCatalog? @relation(fields: [catalogItemId], references: [id], onDelete: SetNull)
  feeType             FeeType?            @relation(fields: [feeTypeId], references: [id], onDelete: SetNull)
  studentItems        StudentRequirementItem[]

  @@index([classRequirementId])
}

// Student Term Requirement Checklist Header
model StudentRequirementRecord {
  id                  String              @id @default(cuid())
  branchId            String
  studentId           String
  enrollmentId        String?
  classRequirementId  String
  academicYearId      String
  termId              String?
  totalItemsCount     Int                 @default(0)
  fulfilledCount      Int                 @default(0)
  pendingCount        Int                 @default(0)
  isFullyCompliant    Boolean             @default(false)
  notes               String?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  branch              Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  student             Student             @relation(fields: [studentId], references: [id], onDelete: Cascade)
  enrollment          Enrollment?         @relation(fields: [enrollmentId], references: [id], onDelete: SetNull)
  classRequirement    ClassRequirement    @relation(fields: [classRequirementId], references: [id], onDelete: Restrict)
  academicYear        AcademicYear        @relation(fields: [academicYearId], references: [id], onDelete: Restrict)
  term                Term?               @relation(fields: [termId], references: [id], onDelete: SetNull)
  items               StudentRequirementItem[]
  clearances          StudentClearance[]

  @@unique([branchId, studentId, academicYearId, termId])
  @@index([branchId, studentId])
  @@index([branchId, academicYearId, termId])
}

// Individual requirement item verification state for a student
model StudentRequirementItem {
  id                  String                  @id @default(cuid())
  recordId            String
  blueprintItemId     String
  name                String                  // Frozen snapshot of item name
  category            RequirementCategory     @default(GENERAL)
  unit                RequirementUnit         @default(PIECE)
  quantityRequired    Decimal                 @db.Decimal(8, 2)
  quantityDelivered   Decimal                 @default(0) @db.Decimal(8, 2)
  quantityMonetized   Decimal                 @default(0) @db.Decimal(8, 2)
  cashInLieuAmount    Decimal?                @db.Decimal(12, 2)
  paymentId           String?                 // Linked Payment if monetized
  status              RequirementItemStatus   @default(PENDING)
  isMandatory         Boolean                 @default(true)
  lastReceivedById    String?
  lastReceivedAt      DateTime?
  exemptionReason     String?
  notes               String?
  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt

  record              StudentRequirementRecord @relation(fields: [recordId], references: [id], onDelete: Cascade)
  blueprintItem       ClassRequirementItem    @relation(fields: [blueprintItemId], references: [id], onDelete: Restrict)
  payment             Payment?                @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  lastReceivedBy      User?                   @relation("RequirementReceivedBy", fields: [lastReceivedById], references: [id], onDelete: SetNull)
  handoverLogs        InKindHandoverLog[]

  @@index([recordId])
  @@index([blueprintItemId])
}

// Append-only Handover Log for Physical Goods Delivery & Corrections
model InKindHandoverLog {
  id                  String                  @id @default(cuid())
  branchId            String
  studentRequirementItemId String
  receiptNumber       String                  // INK-2026-00001
  deltaDelivered      Decimal                 @db.Decimal(8, 2)
  previousQuantity    Decimal                 @db.Decimal(8, 2)
  newQuantity         Decimal                 @db.Decimal(8, 2)
  receivedById        String
  receivedAt          DateTime                @default(now())
  isCorrection        Boolean                 @default(false)
  correctionReason    String?
  notes               String?

  branch              Branch                  @relation(fields: [branchId], references: [id], onDelete: Cascade)
  studentItem         StudentRequirementItem  @relation(fields: [studentRequirementItemId], references: [id], onDelete: Cascade)
  receivedBy          User                    @relation("HandoverReceivedBy", fields: [receivedById], references: [id], onDelete: Restrict)

  @@unique([branchId, receiptNumber])
  @@index([studentRequirementItemId])
  @@index([branchId, receivedAt])
}

// Issued Student Financial & Requirements Clearance (Exam Permits & Gate Passes)
model StudentClearance {
  id                  String                  @id @default(cuid())
  branchId            String
  studentId           String
  academicYearId      String
  termId              String?
  requirementRecordId String?
  clearanceType       ClearanceType           @default(EXAM_PERMIT)
  clearanceNumber     String                  // CLR-2026-00001
  status              ClearanceStatus         @default(CLEARED)
  docStatus           ClearanceDocStatus      @default(ACTIVE)
  ledgerBalance       Decimal                 @db.Decimal(12, 2)
  feesPaidPercent     Decimal                 @db.Decimal(5, 2)
  requirementsFulfilled Boolean               @default(true)
  provisionalReason   String?
  revocationReason    String?
  authorizedById      String
  revokedById         String?
  issuedAt            DateTime                @default(now())
  revokedAt           DateTime?
  validUntil          DateTime?
  verificationToken   String                  @unique // 256-bit cryptographically secure token

  branch              Branch                  @relation(fields: [branchId], references: [id], onDelete: Cascade)
  student             Student                 @relation(fields: [studentId], references: [id], onDelete: Cascade)
  academicYear        AcademicYear            @relation(fields: [academicYearId], references: [id], onDelete: Restrict)
  term                Term?                   @relation(fields: [termId], references: [id], onDelete: SetNull)
  requirementRecord   StudentRequirementRecord? @relation(fields: [requirementRecordId], references: [id], onDelete: SetNull)
  authorizedBy        User                    @relation("ClearanceAuthorizedBy", fields: [authorizedById], references: [id], onDelete: Restrict)
  revokedBy           User?                   @relation("ClearanceRevokedBy", fields: [revokedById], references: [id], onDelete: SetNull)

  @@unique([branchId, clearanceNumber])
  @@index([branchId, studentId, academicYearId, termId])
  @@index([verificationToken])
}

// Atomic Sequence Counters for Permits and In-Kind Receipts
model ClearanceSequence {
  id        String   @id @default(cuid())
  branchId  String
  year      Int
  nextValue Int      @default(1)
  updatedAt DateTime @updatedAt

  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([branchId, year])
}

model InKindReceiptSequence {
  id        String   @id @default(cuid())
  branchId  String
  year      Int
  nextValue Int      @default(1)
  updatedAt DateTime @updatedAt

  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([branchId, year])
}
```

---

## 4. TEST VERIFICATION MATRIX (REQ-01 to REQ-20 & ADV-REQ-01 to ADV-REQ-10)

| Test ID | Category | Scenario / Assertion |
| :--- | :--- | :--- |
| **REQ-01** | Catalog CRUD | Creates requirement catalog item with code, name, category, unit, and default cash-in-lieu price. |
| **REQ-02** | Blueprint Setup | Configures Class Requirement Blueprint with itemized mandatory/optional flags and quantities. |
| **REQ-03** | Idempotent Assignment | Bulk assigns blueprint to enrolled class students without duplicate record collisions. |
| **REQ-04** | Historical Snapshot | Proves modifying class blueprint does not mutate existing student requirement checklist items. |
| **REQ-05** | Physical Delivery | Records physical delivery and calculates `PARTIAL` and `FULFILLED` statuses accurately. |
| **REQ-06** | Handover Log | Emits append-only `InKindHandoverLog` with atomic receipt number (`INK-YYYY-NNNNN`). |
| **REQ-07** | Handover Reversal | Non-destructive reversal logs negative delta and updates item status cleanly without data deletion. |
| **REQ-08** | Cash-in-Lieu Pipeline | Monetizes requirement via `PaymentDAO`, creating official `Payment` and ledger credit. |
| **REQ-09** | Zero Double-Counting | Proves physical handover produces zero ledger impact while cash-in-lieu creates exact credit. |
| **REQ-10** | Exemption Workflow | Exempts mandatory item for bursary/scholarship student with authorized reason. |
| **REQ-11** | Clearance: Cleared | Evaluates student with 0 balance and 100% requirements $\rightarrow$ `status: CLEARED`. |
| **REQ-12** | Clearance: Advance Credit | Proves student with negative ledger balance (-UGX 100,000) achieves full financial clearance. |
| **REQ-13** | Clearance: Blocked Debt | Evaluates student with overdue debt (> UGX 0) $\rightarrow$ `status: BLOCKED`. |
| **REQ-14** | Clearance: Blocked Req | Evaluates student with 0 fee balance but pending mandatory requirement $\rightarrow$ `status: BLOCKED`. |
| **REQ-15** | Provisional Clearance | Grants provisional permit with authorized staff ID, mandatory reason, and expiration date. |
| **REQ-16** | Permit Numbering | Generates sequential, collision-safe clearance permit numbers (`CLR-YYYY-NNNNN`). |
| **REQ-17** | Permit Revocation | Revokes active permit, records revocation reason, and blocks subsequent entry. |
| **REQ-18** | QR Token Verification | Validates 256-bit cryptographic token and returns sanitized verification card payload. |
| **REQ-19** | QR Expiration / Revoke | Returns `EXPIRED` if past `validUntil` and `REVOKED` if permit was cancelled. |
| **REQ-20** | Storekeeper Tally | Aggregates physical goods received per item across all classes with accurate net totals. |
| **ADV-REQ-01** | Adversarial | Rejects negative delivered quantity on initial delivery. |
| **ADV-REQ-02** | Adversarial | Rejects delivery exceeding required quantity without explicit override flag. |
| **ADV-REQ-03** | Adversarial | Rejects cash-in-lieu monetization for already fulfilled requirement item. |
| **ADV-REQ-04** | Adversarial | Rejects duplicate cash-in-lieu monetization submission. |
| **ADV-REQ-05** | Adversarial | Proves QR payload contains ZERO private financial or personal student data. |
| **ADV-REQ-06** | Adversarial | Prevents cross-branch permit generation or QR token verification leakage. |
| **ADV-REQ-07** | Adversarial | Prevents duplicate active permit issuance for same student and period. |
| **ADV-REQ-08** | Adversarial | Serializes concurrent physical handover submissions safely inside transactions. |
| **ADV-REQ-09** | Adversarial | Rejects clearance issuance by unauthorized staff role missing `clearance:issue`. |
| **ADV-REQ-10** | Adversarial | Verifies complete `AuditService` event emission across all lifecycle transitions. |

---

## 5. OUT OF SCOPE

- Full warehouse inventory multi-bin barcode logistics and supplier purchase orders (managed by General Store subsystem).
- Fixed asset capitalization and depreciation schedules.
- Electronic turnstile hardware protocols (standard optical QR scanners and mobile browser cameras supported).
- Transport fleet maintenance and vehicle tracking.

---

## STATUS

STATUS: READY FOR IMPLEMENTATION
