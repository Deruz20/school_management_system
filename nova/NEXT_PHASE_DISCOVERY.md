# NOVA — Next Phase Discovery (Post-Phase 3.1L)
## Phase 3.1M: Fixed Assets, Capital Asset Register & Automated Depreciation Engine

---

## 1. Executive Summary & Recommended Next Phase

### Recommended Phase
**Phase 3.1M: Fixed Assets, Capital Asset Register & Automated Depreciation Engine**

### Business Purpose
Every educational institution in Uganda and East Africa operates significant capital investments: campus land and buildings, school buses and commuter vans, heavy-duty backup diesel generators, solar power plants, ICT/computer laboratories, science laboratory equipment, and thousands of classroom desks and boarding dormitory beds. 

With the completion of **Phase 3.1L (General Ledger & Double-Entry Accounting Engine)**, the NOVA Balance Sheet established the Non-Current Asset hierarchy:
- **GL Account `#1500` (Property, Plant & Equipment)**: With detail accounts `#1510` (Land), `#1520` (Buildings), `#1530` (Fleet/Buses), `#1540` (Furniture/Fixtures), `#1550` (ICT Equipment).
- **GL Account `#1600` (Accumulated Depreciation)**: Contra-asset tracking cumulative wear and tear.
- **GL Account `#6900` (Depreciation & Amortization Expense)**: Operational P&L charge.

Currently, **Non-Current Assets is the ONLY asset class on the institutional Balance Sheet that lacks an authoritative operational subledger.** While Cash/Bank (`#11xx`), Student AR (`#1200`), and Stores Inventory (`#1310`) are backed by real-time operational subledgers (`TreasuryAccount`, `StudentLedgerEntry`, `InventoryStoreStock`), Fixed Assets currently rely on static manual balances.

**Phase 3.1M establishes the authoritative Fixed Asset Subledger**, providing:
1. Physical Asset Register with unique institutional asset tags, QR codes, categories, locations, and custodian tracking.
2. Capitalization workflows (Direct purchase, Capitalization from 3.1J Procurement GRN, and Linking from 3.1I Fleet Vehicles).
3. Automated multi-method depreciation calculation engine (Straight-Line & Reducing Balance, aligned with URA/GAAP accounting standards).
4. Automated, maker-checker reviewed periodic depreciation runs with atomic double-entry posting to the General Ledger.
5. Capital asset disposals, write-offs, impairments, and revaluations with automated Gain/Loss on Disposal computation.
6. Physical asset verification audits with condition assessment (Good, Fair, Poor, Broken).
7. Real-time subledger-to-GL zero-drift reconciliation.

---

## 2. Why Phase 3.1M Should Come Next

| Evaluation Criteria | Analysis & Repository Evidence |
|---|---|
| **Balance Sheet Integrity** | In Phase 3.1L, Current Assets have live subledgers. Non-Current Assets (`#1500` and `#1600`) represent up to 70% of a school's total asset base but currently have zero subledger tracking. Phase 3.1M completes the balance sheet. |
| **Direct Synergy with 3.1I (Fleet)** | Phase 3.1I established `TransportVehicle` (buses, vans) with fuel and maintenance logs. Phase 3.1M connects these vehicles as capitalized balance sheet assets with automated depreciation. |
| **Direct Synergy with 3.1J (Procurement)** | Phase 3.1J established Purchase Orders and GRNs. High-value equipment (computers, generators, furniture) can now be capitalized directly upon receipt rather than treated as consumable inventory. |
| **Statutory & Audit Compliance** | Uganda Revenue Authority (URA), Ministry of Education & Sports (MoES), and Board of Governors require an annual Fixed Asset Register, physical asset verification, and compliant wear-and-tear depreciation schedules. |
| **Protection of Capital Assets** | Prevents ghost assets, untracked asset theft/loss, and inaccurate book valuations across school branches. |

---

## 3. Architecture Scope (Phase 3.1M)

### Core Capabilities

#### 1. Fixed Asset Catalog & Categorization
- **Asset Categories**: Pre-configured categories mapped directly to GL accounts and standard depreciation rates:
  - Land & Grounds (`#1510`, 0% depreciation - non-depreciable)
  - Buildings & Improvements (`#1520`, Straight-Line 4% / 25 years)
  - Motor Vehicles & Transport Fleet (`#1530`, Reducing Balance 25% / 4 years)
  - Furniture, Desks & Fixtures (`#1540`, Straight-Line 12.5% / 8 years)
  - Computers & ICT Equipment (`#1550`, Straight-Line 33.3% / 3 years)
  - Heavy Machinery & Generators (`#1560`, Reducing Balance 20% / 5 years)
- **Asset Locations**: Physical campus tracking (Main Administration, Block A, Science Lab 1, Computer Lab, Dining Hall, Boarding Dormitories).
- **Custodians & Departmental Custody**: Assigning custody to specific employees (HODs, ICT Administrators, Fleet Managers, Lab Attendants).

#### 2. Asset Register & Individual Asset Items
- **Unique Asset Tagging**: Automated sequence generation (`AST-YYYY-XXXXX`) + barcode/QR code generation for physical labeling.
- **Asset Metadata**: Asset name, category, serial number, model, manufacturer, purchase date, capitalization date, physical location, custodian, vendor/supplier, warranty expiry, status (`ACTIVE`, `IN_REPAIR`, `DISPOSED`, `WRITTEN_OFF`, `FULLY_DEPRECIATED`).
- **Financial Profile**: Acquisition cost, salvage/residual value, depreciable basis, current Net Book Value (NBV), cumulative depreciation, revaluation reserve.

#### 3. Capitalization Engine
- **Direct Capital Asset Entry**: Initial migration and direct institutional purchases.
- **Procurement Ingestion**: Transferring high-value items from Phase 3.1J `GoodsReceivedNote` into capitalized fixed assets.
- **Fleet Asset Linking**: Bi-directionally linking Phase 3.1I `TransportVehicle` to its `AssetItem` balance sheet representation.

#### 4. Automated Multi-Method Depreciation Engine
- **Supported Methods**:
  1. **Straight-Line Method (SLM)**:
     $$\text{Periodic Depreciation} = \frac{\text{Acquisition Cost} - \text{Salvage Value}}{\text{Useful Life in Periods}}$$
  2. **Reducing Balance / Diminishing Value (RBM)**:
     $$\text{Periodic Depreciation} = \text{Opening Net Book Value} \times \text{Depreciation Rate per Period}$$
- **Depreciation Frequency**: Configurable per branch (Monthly or Termly).
- **Pro-Rata Conventions**: Mid-month / daily pro-rata depreciation for assets acquired during an active period.
- **Automated Period Depreciation Runs**:
  - Pre-computes depreciation schedule across all active depreciable assets.
  - Generates a draft `AssetDepreciationRun` showing asset-by-asset calculations and total depreciation charge.
  - Four-Eye Maker-Checker approval: Disallow creator self-approval.
  - Atomic GL posting:
    $$\text{Dr. Depreciation Expense (\#6900)} \quad / \quad \text{Cr. Accumulated Depreciation (\#1600)}$$
  - Updates each asset's `accumulatedDepreciation` and `netBookValue`.

#### 5. Asset Disposal & Retirement Engine
- **Disposal Types**: Sale to third party, Scrap/Zero-value write-off, Insurance loss/damage claim.
- **Gain/Loss Calculation**:
  $$\text{Gain / Loss} = \text{Disposal Proceeds} - \text{Net Book Value at Disposal Date}$$
- **Atomic Double-Entry GL Posting**:
  - $\text{Dr. Cash/Bank (\#11xx) or Receivable}$ (for Proceeds)
  - $\text{Dr. Accumulated Depreciation (\#1600)}$ (to relieve cumulative depreciation)
  - $\text{Dr. Loss on Asset Disposal (\#6950)}$ (if proceeds < NBV) OR $\text{Cr. Gain on Asset Disposal (\#4960)}$ (if proceeds > NBV)
  - $\text{Cr. Asset Cost (\#15xx)}$ (to relieve historical acquisition cost)
- Marks asset status as `DISPOSED` or `WRITTEN_OFF` and halts further depreciation.

#### 6. Asset Revaluation & Impairment
- **Upward Revaluation**: Increases asset gross book value and credits Revaluation Reserve (Equity).
- **Impairment**: Recognizes sudden loss in asset value (e.g. flood/fire damage), debiting Impairment Loss (P&L) and writing down NBV.

#### 7. Physical Asset Verification & Condition Audits
- Scheduled physical verification rounds.
- Barcode/QR scanning via mobile/workstation camera.
- Condition logging (`EXCELLENT`, `GOOD`, `FAIR`, `POOR`, `UNUSABLE`).
- Discrepancy flagging: Missing assets, unrecorded location transfers, damaged assets requiring maintenance or write-off.

#### 8. Real-Time Drift Telemetry & Subledger Reconciliation
- Real-time zero-drift telemetry:
  $$\text{Asset Register Total Historical Cost} \equiv \text{GL \#1500 Gross Balance}$$
  $$\text{Asset Register Cumulative Depreciation} \equiv \text{GL \#1600 Credit Balance}$$
  $$\text{Asset Register Net Book Value} \equiv \text{GL (\#1500 - \#1600) Net Balance}$$

---

## 4. Out of Scope / Explicitly Deferred

The following items are strictly OUT OF SCOPE for Phase 3.1M to preserve tight architectural boundaries:
1. **Deferred Tax Accounting (IAS 12)**: Deferred tax assets/liabilities are out of scope (school ERPs operate on cash/statutory basis).
2. **Component Depreciation (IFRS Complex Componentization)**: Breaking a single building into 10 separate sub-depreciable components (roof, plumbing, electrical). Single-asset unit depreciation is sufficient.
3. **Automated IoT Sensor Telemetry**: Automated GPS vehicle tracking / IoT hardware telemetry is deferred.
4. **Lease Accounting (IFRS 16 / Right-of-Use Assets)**: Complex finance lease accounting is deferred.
5. **External GIS Mapping**: GPS geographic mapping overlays for school land boundaries are deferred.

---

## 5. Major Proposed Models & Entities

```prisma
// Fixed Asset Category (e.g., Fleet, ICT, Furniture, Buildings)
model AssetCategory {
  id                      String           @id @default(cuid())
  branchId                String
  code                    String           // e.g., "ICT", "FLEET", "FURN", "BLDG"
  name                    String           // "Computers & ICT Equipment"
  description             String?
  depreciationMethod      DepreciationMethod @default(STRAIGHT_LINE)
  usefulLifeMonths        Int              // e.g., 36 (3 years)
  annualDepreciationRate  Decimal          @db.Decimal(5, 2) // e.g., 33.33%
  glAssetAccountId        String?          // Links to GL #15xx
  glDepreciationAccountId String?          // Links to GL #6900
  glAccumDeprecAccountId  String?          // Links to GL #1600
  isActive                Boolean          @default(true)
  createdAt               DateTime         @default(now())
  updatedAt               DateTime         @updatedAt

  branch                  Branch           @relation(fields: [branchId], references: [id], onDelete: Cascade)
  glAssetAccount          GLAccount?       @relation("CategoryAssetAccount", fields: [glAssetAccountId], references: [id])
  glDepreciationAccount   GLAccount?       @relation("CategoryDeprecAccount", fields: [glDepreciationAccountId], references: [id])
  glAccumDeprecAccount    GLAccount?       @relation("CategoryAccumDeprecAccount", fields: [glAccumDeprecAccountId], references: [id])
  assets                  AssetItem[]

  @@unique([branchId, code])
  @@index([branchId])
}

// Physical Campus Asset Location
model AssetLocation {
  id          String      @id @default(cuid())
  branchId    String
  name        String      // "ICT Lab 1 - Main Block", "Dining Hall"
  code        String      // "LOC-ICT-01"
  building    String?
  roomNumber  String?
  description String?
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  branch      Branch      @relation(fields: [branchId], references: [id], onDelete: Cascade)
  assets      AssetItem[]

  @@unique([branchId, code])
  @@index([branchId])
}

// Individual Capital Asset Item (The Authoritative Asset Subledger)
model AssetItem {
  id                     String           @id @default(cuid())
  branchId               String
  assetTag               String           // "AST-2026-00001"
  name                   String           // "Dell OptiPlex 7090 Desktop #1"
  description            String?
  categoryId             String
  locationId             String?
  custodianId            String?          // Links to Employee
  serialNumber           String?
  modelNumber            String?
  manufacturer           String?
  purchaseDate           DateTime
  capitalizationDate     DateTime
  warrantyExpiry         DateTime?
  status                 AssetStatus      @default(ACTIVE)
  condition              AssetCondition   @default(GOOD)

  // Financial Valuation (Exact Decimal 12,2)
  acquisitionCost        Decimal          @db.Decimal(12, 2)
  salvageValue           Decimal          @default(0) @db.Decimal(12, 2)
  depreciableBasis       Decimal          @db.Decimal(12, 2)
  accumulatedDepreciation Decimal         @default(0) @db.Decimal(12, 2)
  netBookValue           Decimal          @db.Decimal(12, 2)
  lastDepreciationDate   DateTime?

  // Upstream Integration Links
  supplierId             String?          // Links to InventorySupplier
  grnId                  String?          // Links to GoodsReceivedNote
  transportVehicleId     String?          // Links to TransportVehicle

  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt

  branch                 Branch           @relation(fields: [branchId], references: [id], onDelete: Cascade)
  category               AssetCategory    @relation(fields: [categoryId], references: [id])
  location               AssetLocation?   @relation(fields: [locationId], references: [id])
  custodian              Employee?        @relation(fields: [custodianId], references: [id])
  supplier               InventorySupplier? @relation(fields: [supplierId], references: [id])
  grn                    GoodsReceivedNote? @relation(fields: [grnId], references: [id])
  transportVehicle       TransportVehicle?  @relation(fields: [transportVehicleId], references: [id])
  depreciationLines      AssetDepreciationLine[]
  disposalRecord         AssetDisposal?
  verificationLogs       AssetVerificationLog[]

  @@unique([branchId, assetTag])
  @@index([branchId, status])
  @@index([branchId, categoryId])
}

// Periodic Batch Depreciation Run
model AssetDepreciationRun {
  id                  String           @id @default(cuid())
  branchId            String
  runNumber           String           // "DEP-2026-001"
  periodId            String           // Links to FiscalPeriod
  runDate             DateTime
  status              DepreciationRunStatus @default(DRAFT)
  totalAssetsCount    Int
  totalDepreciationAmount Decimal      @db.Decimal(12, 2)
  journalEntryId      String?          // Links to posted JournalEntry
  createdById         String
  approvedById        String?
  approvedAt          DateTime?
  notes               String?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  branch              Branch           @relation(fields: [branchId], references: [id], onDelete: Cascade)
  fiscalPeriod        FiscalPeriod     @relation(fields: [periodId], references: [id])
  journalEntry        JournalEntry?    @relation(fields: [journalEntryId], references: [id])
  createdBy           User             @relation("DeprecCreatedBy", fields: [createdById], references: [id])
  approvedBy          User?            @relation("DeprecApprovedBy", fields: [approvedById], references: [id])
  lines               AssetDepreciationLine[]

  @@unique([branchId, runNumber])
  @@unique([branchId, periodId]) // One depreciation run per fiscal period
  @@index([branchId])
}

// Individual Asset Line in Depreciation Run
model AssetDepreciationLine {
  id                   String           @id @default(cuid())
  depreciationRunId    String
  assetId              String
  openingBookValue     Decimal          @db.Decimal(12, 2)
  depreciationAmount   Decimal          @db.Decimal(12, 2)
  closingBookValue     Decimal          @db.Decimal(12, 2)
  depreciationMethod   DepreciationMethod
  rateApplied          Decimal          @db.Decimal(5, 2)
  createdAt            DateTime         @default(now())

  depreciationRun      AssetDepreciationRun @relation(fields: [depreciationRunId], references: [id], onDelete: Cascade)
  asset                AssetItem        @relation(fields: [assetId], references: [id])

  @@index([depreciationRunId])
  @@index([assetId])
}

// Asset Disposal / De-recognition Record
model AssetDisposal {
  id                   String           @id @default(cuid())
  branchId             String
  assetId              String           @unique
  disposalDate         DateTime
  disposalType         AssetDisposalType // SALE, SCRAP, INSURANCE_LOSS, DONATION
  disposalProceeds     Decimal          @default(0) @db.Decimal(12, 2)
  costAtDisposal       Decimal          @db.Decimal(12, 2)
  accumDeprecAtDisposal Decimal         @db.Decimal(12, 2)
  netBookValueAtDisposal Decimal        @db.Decimal(12, 2)
  gainOrLossAmount     Decimal          @db.Decimal(12, 2) // Positive = Gain, Negative = Loss
  reason               String
  buyerDetails         String?
  treasuryAccountId    String?          // Treasury account where proceeds deposited
  journalEntryId       String?          // Linked GL Journal
  approvedById         String
  createdAt            DateTime         @default(now())

  branch               Branch           @relation(fields: [branchId], references: [id], onDelete: Cascade)
  asset                AssetItem        @relation(fields: [assetId], references: [id])
  treasuryAccount      TreasuryAccount? @relation(fields: [treasuryAccountId], references: [id])
  journalEntry         JournalEntry?    @relation(fields: [journalEntryId], references: [id])
  approvedBy           User             @relation(fields: [approvedById], references: [id])

  @@index([branchId])
}

// Physical Asset Audit & Condition Verification Log
model AssetVerificationLog {
  id              String         @id @default(cuid())
  branchId        String
  assetId         String
  verifiedAt      DateTime       @default(now())
  verifiedById    String
  condition       AssetCondition
  locationId      String?
  isMissing       Boolean        @default(false)
  notes           String?
  createdAt       DateTime       @default(now())

  branch          Branch         @relation(fields: [branchId], references: [id], onDelete: Cascade)
  asset           AssetItem      @relation(fields: [assetId], references: [id])
  verifiedBy      User           @relation(fields: [verifiedById], references: [id])
  location        AssetLocation? @relation(fields: [locationId], references: [id])

  @@index([branchId, assetId])
}
```

---

## 6. Integration Points with Existing Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            UPSTREAM INTEGRATIONS                            │
├──────────────────────────────┬───────────────────────────────┬──────────────┤
│ Phase 3.1I: Fleet Operations │ Phase 3.1J: Stores Inventory  │ Procurement  │
│  TransportVehicle            │  GoodsReceivedNote (GRN)      │  Suppliers   │
│  (Buses, Vans, Fleet Items)  │  (Capital Equipment Receipts) │              │
└──────────────┬───────────────┴───────────────┬───────────────┴──────┬───────┘
               │                               │                      │
               ▼                               ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3.1M: FIXED ASSETS SUBLEDGER                       │
│  - AssetItem Registry & Unique Barcodes (AST-YYYY-XXXXX)                    │
│  - Capitalization & Asset Locations / Custodians                            │
│  - Automated Depreciation Engine (SLM / RBM)                                │
│  - Asset Disposals, Write-Offs & Gain/Loss Calculations                     │
│  - Physical Asset Verification Audits                                       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GENERAL LEDGER & TREASURY BRIDGE                       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Phase 3.1L: Double-Entry GL Engine   │ Phase 3.1K: Treasury Multi-Account   │
│  - Dr. Depreciation Exp (#6900)      │  - Disposal Proceeds Cash Receipts   │
│    Cr. Accum Depreciation (#1600)    │  - Capital Purchases Outflows        │
│  - Asset Disposals / Write-offs      │                                      │
│  - Balance Sheet PPE Presentation    │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

1. **General Ledger (Phase 3.1L)**:
   - Depreciation runs post atomically to `GLEngineDAO.postJournalEntry` with `JournalType.DEPRECIATION`.
   - Asset Disposals post debit/credit relief with Gain/Loss.
   - Real-time reconciliation telemetry monitors `AssetRegister.NBV` vs `GL #1500 - #1600`.
2. **Treasury & Cashbook (Phase 3.1K)**:
   - Asset disposal cash proceeds post to `TreasuryAccount` and `CashbookMovement`.
3. **Stores & Procurement (Phase 3.1J)**:
   - High-value capital equipment received on `GoodsReceivedNote` can be capitalized directly into `AssetItem`.
4. **Transport & Fleet (Phase 3.1I)**:
   - Vehicles in `TransportVehicle` can be linked to `AssetItem` to track historical acquisition cost and monthly depreciation.
5. **Staff & HR Core**:
   - Asset custodianship is linked directly to `Employee`.

---

## 7. Security, RBAC & Audit Requirements

### RBAC Permissions
- `finance:assets:view`: View asset register, categories, depreciation schedules, and verification reports.
- `finance:assets:create`: Register new assets, set initial cost/salvage value, and print tags.
- `finance:assets:depreciate`: Generate draft periodic depreciation runs.
- `finance:assets:approve_depreciation`: Approve depreciation runs and post to General Ledger (Four-Eye principle: Creator $\neq$ Approver).
- `finance:assets:dispose`: Record asset disposals, write-offs, and scrap with approval.
- `finance:assets:audit`: Perform physical asset scanning and condition logging.

### AuditService Integration
Every state transition must emit an audit log entry:
- `CAPITALIZE_FIXED_ASSET`
- `UPDATE_ASSET_LOCATION`
- `TRANSFER_ASSET_CUSTODY`
- `EXECUTE_DEPRECIATION_RUN`
- `APPROVE_DEPRECIATION_RUN`
- `DISPOSE_FIXED_ASSET`
- `REVALUE_FIXED_ASSET`
- `RECORD_ASSET_VERIFICATION`

---

## 8. Financial Invariants & Integrity Constraints

1. **Strict Non-Negative Values**:
   $$\text{Acquisition Cost} > 0, \quad \text{Salvage Value} \ge 0, \quad \text{Acquisition Cost} \ge \text{Salvage Value}$$
2. **Floor Constraint on Depreciation**:
   An asset's `netBookValue` can **never fall below its `salvageValue`**. When `netBookValue == salvageValue`, periodic depreciation becomes 0.00.
3. **Cumulative Accuracy Assertion**:
   $$\text{Acquisition Cost} \equiv \text{Net Book Value} + \text{Accumulated Depreciation}$$
4. **Single Run Per Fiscal Period**:
   Unique constraint `@@unique([branchId, periodId])` on `AssetDepreciationRun` ensures a branch cannot post two depreciation runs for the same monthly/termly fiscal period.
5. **Maker-Checker Separation**:
   In `AssetDepreciationRun`, `approvedById !== createdById`.
6. **Immutable Historical Runs**:
   Approved and posted depreciation runs and lines are strictly immutable. Corrections require adjustment runs or compensating reversals.

---

## 9. Comprehensive Acceptance & Verification Strategy

1. **Unit & Integration Test Matrix (`asset.dao.test.ts`)**:
   - Asset category CRUD & GL account mapping resolution.
   - Asset registration with automated tag sequence generation.
   - Straight-Line depreciation calculation with salvage value capping.
   - Reducing Balance depreciation calculation with rate application.
   - Pro-rata mid-period acquisition depreciation calculation.
   - Batch depreciation run creation, maker-checker approval, and atomic GL posting.
   - Asset disposal with Gain computation.
   - Asset disposal with Loss computation.
   - Physical asset verification and condition status updates.
   - Bi-directional linking with `TransportVehicle` and `GoodsReceivedNote`.
   - Subledger-to-GL zero-drift assertion across `#1500`, `#1600`, and `#6900`.
2. **Adversarial Test Matrix (`asset.adversarial.test.ts`)**:
   - Duplicate depreciation run attempt in the same fiscal period (rejected).
   - Depreciation run in CLOSED or LOCKED fiscal period (rejected).
   - Self-approval attempt by run creator (rejected).
   - Depreciation of already disposed or written-off asset (rejected).
   - Depreciation pushing NBV below salvage value (blocked at floor).
   - Disposal of non-existent or already disposed asset (rejected).
   - Cross-branch asset mutation or depreciation leak (rejected).
   - Sub-cent rounding imprecision under high volume (exact Decimal(12,2)).
3. **Full Regression Verification**:
   - Vitest suite (all 40+ files green).
   - `npx tsc --noEmit` clean (0 errors).
   - `npm run lint` clean (0 errors).
   - `npx prisma db seed` verified twice consecutively.
   - `npm run build` production build clean.
   - Full Playwright E2E suite across all specs.

---

## 10. Alternative Candidate Phases Evaluated

1. **Phase 3.1N: Accounts Payable (AP), Supplier Invoicing & 3-Way Matching Subledger**:
   - *Evaluation*: Highly valuable, but vendor procurement in 3.1J and cash disbursements in 3.1D/3.1K currently provide working operational coverage. Fixed Assets is the only asset class on the Balance Sheet with zero subledger support.
2. **Phase 3.2: Student Admissions, Applicant Onboarding & Registration Engine**:
   - *Evaluation*: An important academic lifecycle module. Can follow directly after Phase 3.1M to maintain financial module cohesiveness.
3. **Phase 3.3: Boarding & Hostel Accommodation Management**:
   - *Evaluation*: Dependent on student admissions and term billing; best scheduled after Admissions.

---

## 11. Conclusion & Recommendation
**Phase 3.1M (Fixed Assets, Capital Asset Register & Automated Depreciation Engine)** is the optimal, highest-value next phase. It directly bridges the gap between physical school infrastructure and double-entry accounting integrity, completing the non-current asset portion of the institutional Balance Sheet.
