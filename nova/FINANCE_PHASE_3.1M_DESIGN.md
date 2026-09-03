# NOVA — Finance Phase 3.1M Technical Architecture & Design (Final Approved Specification)
## Fixed Assets, Capital Asset Register & Automated Depreciation Engine

---

## 1. Executive Summary & Core Architectural Scope

Phase 3.1M establishes the authoritative, enterprise-grade **Fixed Assets Subledger and Automated Depreciation Engine** for NOVA.

### 1.1 Balance Sheet Completeness
Following the completion of **Phase 3.1L (General Ledger & Double-Entry Accounting Engine)**, the Balance Sheet has active operational subledgers for all Current Assets (`#11xx` Cash/Banks, `#1200` Student AR, `#1310` Stores Inventory). 

**Phase 3.1M completes the Non-Current Asset domain:**
- **GL Account `#1500` (Property, Plant & Equipment)**: Detail accounts `#1510` (Land), `#1520` (Buildings), `#1530` (Fleet/Buses), `#1540` (Furniture/Fixtures), `#1550` (Computers/ICT), `#1560` (Machinery/Generators), `#1580` (Capital Work in Progress / CIP).
- **GL Account `#1600` (Accumulated Depreciation)**: Contra-asset tracking cumulative wear and tear.
- **GL Account `#6900` (Depreciation & Amortization Expense)**: Operational P&L charge.
- **GL Account `#4960` (Gain on Asset Disposal)**: Net revenue gain on capital asset retirement.
- **GL Account `#6950` (Loss on Asset Disposal / Write-Off)**: Net operational expense loss on capital asset retirement.

---

## 2. Explicit Accounts Payable (AP) Boundary Decision

### 2.1 Architectural Decision: Option A (No Implicit AP Subsystem)
**A dedicated Accounts Payable (AP) supplier subledger (with 3-way matching, supplier invoice aging, supplier statements, and withholding tax ledgers) is strictly OUT OF SCOPE for Phase 3.1M and is reserved for Phase 3.1N.**

To ensure absolute accounting integrity and prevent the creation of unbacked or competing liability authorities:
1. **No Phantom AP Authorities**: NOVA will NOT create an ad-hoc supplier invoice ledger or claim that an AP subledger exists in 3.1M.
2. **Capital Acquisition Settlement Channels**:
   - **Direct Institutional Purchases**: Settled immediately against an authoritative `TreasuryAccount` (Bank `#1120` or Safe `#1105`) in a single atomic transaction.
   - **GRN Procurement Capitalization**: Originated from Phase 3.1J `GoodsReceivedNote`. Uses the existing GL Clearing Account `#2120 (Accrued Goods Received / GRN Clearing)` strictly as an internal double-entry clearing mechanism.
   - **Historical Opening Assets**: Initialized against `Opening Balance Equity (#3500)` with zero external liability.
3. **Future AP Handoff**: When Phase 3.1N (Accounts Payable) is implemented, it will take authoritative ownership of supplier invoice scheduling and 3-way matching against GRNs.

---

## 3. Complete Domain Model & Prisma Schema

```prisma
// ==========================================
// PHASE 3.1M: FIXED ASSETS & DEPRECIATION ENGINE
// ==========================================

enum AssetCategoryType {
  LAND_GROUNDS                // Non-depreciable
  BUILDINGS_STRUCTURES        // Depreciable (SLM)
  MOTOR_VEHICLES_FLEET        // Depreciable (RBM / SLM)
  FURNITURE_FIXTURES          // Depreciable (SLM)
  COMPUTERS_ICT_EQUIPMENT     // Depreciable (SLM)
  MACHINERY_GENERATORS        // Depreciable (RBM / SLM)
  LABORATORY_APPARATUS        // Depreciable (SLM)
  CAPITAL_WORK_IN_PROGRESS    // Non-depreciable until commissioned
  OTHER_FIXED_ASSETS          // Depreciable (SLM)
}

enum DepreciationMethod {
  STRAIGHT_LINE               // SLM: (Cost - Salvage) / Useful Life Months
  REDUCING_BALANCE            // RBM: Net Book Value * (Annual Rate / 12)
  NONE                        // Non-depreciable (Land, CIP)
}

enum DepreciationFrequency {
  MONTHLY                     // 12 runs per year
  TERMLY                      // 3 runs per year (Ugandan school terms)
  ANNUALLY                    // 1 run at fiscal year-end
}

enum AssetStatus {
  DRAFT                       // Newly created, pending capitalization review
  ACTIVE                      // Capitalized, currently in active educational use
  IN_REPAIR                   // Under maintenance/repair (depreciation continues)
  FULLY_DEPRECIATED           // NBV == Salvage Value (no further depreciation)
  DISPOSED                    // Sold, scraped, or written off (no further depreciation)
  WRITTEN_OFF                 // Impaired/damaged with zero salvage
}

enum AssetCondition {
  EXCELLENT                   // Brand new / like new
  GOOD                        // Fully operational with normal wear
  FAIR                        // Minor defects, fully operational
  POOR                        // Degraded performance, requires servicing
  UNUSABLE                    // Broken, unusable, candidate for disposal
}

enum CapitalizationSource {
  DIRECT_PURCHASE             // Direct capital acquisition with immediate treasury outflow
  PROCUREMENT_GRN             // Capitalized from Phase 3.1J Goods Received Note
  FLEET_VEHICLE               // Capitalized from Phase 3.1I Transport Vehicle
  INVENTORY_CONVERSION        // Converted from Phase 3.1J Store Stock
  OPENING_BALANCE             // Historical asset balance bootstrap
  DONATION_GRANT              // In-kind capital asset donation / grant
}

enum DepreciationRunStatus {
  DRAFT                       // Generated by Accountant, editable
  SUBMITTED                   // Submitted for Review, locked for edits
  APPROVED                    // Approved by Checker, ready for GL Posting
  POSTED                      // Posted to General Ledger (Immutable)
  REJECTED                    // Rejected by Checker, returned to Draft
  CANCELLED                   // Discarded before posting
}

enum AssetDisposalType {
  SALE                        // Sold to third party (creates cash proceeds in Treasury)
  SCRAP                       // Decommissioned and scrapped at zero or nominal proceeds
  INSURANCE_LOSS              // Stolen or destroyed, insurance claim proceeds
  DONATION_OUT                // Transferred / donated out
  WRITE_OFF                   // Fully impaired and written off at zero value
}

// --------------------------------------------------
// 1. Asset Category Blueprint
// --------------------------------------------------
model AssetCategory {
  id                      String             @id @default(cuid())
  branchId                String
  code                    String             // e.g. "ICT", "FLEET", "FURN", "BLDG", "LAND"
  name                    String             // "Computers & ICT Equipment"
  categoryType            AssetCategoryType  @default(OTHER_FIXED_ASSETS)
  description             String?
  depreciationMethod      DepreciationMethod @default(STRAIGHT_LINE)
  usefulLifeMonths        Int                @default(36) // 36 months = 3 years
  annualDepreciationRate  Decimal            @default(0) @db.Decimal(5, 2) // e.g. 33.33%
  defaultSalvagePercent   Decimal            @default(0) @db.Decimal(5, 2) // e.g. 5.00%
  
  // Explicit GL Account Mappings
  glAssetAccountId        String?            // Links to GLAccount (e.g. #1550)
  glDepreciationAccountId String?            // Links to GLAccount (e.g. #6900)
  glAccumDeprecAccountId  String?            // Links to GLAccount (e.g. #1600)
  
  isActive                Boolean            @default(true)
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  branch                  Branch             @relation(fields: [branchId], references: [id], onDelete: Cascade)
  glAssetAccount          GLAccount?         @relation("CategoryAssetAccount", fields: [glAssetAccountId], references: [id])
  glDepreciationAccount   GLAccount?         @relation("CategoryDeprecAccount", fields: [glDepreciationAccountId], references: [id])
  glAccumDeprecAccount    GLAccount?         @relation("CategoryAccumDeprecAccount", fields: [glAccumDeprecAccountId], references: [id])
  assets                  AssetItem[]

  @@unique([branchId, code])
  @@index([branchId, categoryType])
}

// --------------------------------------------------
// 2. Physical Campus Asset Location
// --------------------------------------------------
model AssetLocation {
  id          String      @id @default(cuid())
  branchId    String
  code        String      // e.g. "LOC-ADM-01", "LOC-ICT-LAB1", "LOC-DORM-A"
  name        String      // "Main Administration Block - Room 102"
  building    String?     // "Administration Complex"
  roomNumber  String?     // "Room 102"
  description String?
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  branch      Branch      @relation(fields: [branchId], references: [id], onDelete: Cascade)
  assets      AssetItem[]

  @@unique([branchId, code])
  @@index([branchId])
}

// --------------------------------------------------
// 3. Individual Capital Asset Item (Subledger Authority)
// --------------------------------------------------
model AssetItem {
  id                      String               @id @default(cuid())
  branchId                String
  assetTag                String               // Unique Institutional Tag: "AST-2026-00001"
  name                    String               // "Dell OptiPlex 7090 Desktop Computer"
  description             String?
  categoryId              String
  locationId              String?
  custodianId             String?              // Links to Employee
  serialNumber            String?              // Manufacturer Serial / Chassis No.
  modelNumber             String?
  manufacturer            String?
  barcode                 String?              // Barcode / QR Payload
  
  // Lifecycle & Capitalization Dates
  purchaseDate            DateTime             // Date of procurement / invoice
  capitalizationDate      DateTime             // Date placed into service (depreciation start)
  warrantyExpiry          DateTime?
  status                  AssetStatus          @default(ACTIVE)
  condition               AssetCondition       @default(GOOD)
  capitalizationSource    CapitalizationSource @default(DIRECT_PURCHASE)

  // Financial Precision (Exact Decimal 12,2)
  acquisitionCost         Decimal              @db.Decimal(12, 2)
  salvageValue            Decimal              @default(0) @db.Decimal(12, 2)
  depreciableBasis        Decimal              @db.Decimal(12, 2) // Cost - Salvage
  accumulatedDepreciation Decimal              @default(0) @db.Decimal(12, 2)
  netBookValue            Decimal              @db.Decimal(12, 2) // Cost - Accumulated
  lastDepreciationDate    DateTime?
  
  // Custom Overrides (null defaults to Category values)
  depreciationMethod      DepreciationMethod?
  usefulLifeMonths        Int?
  annualDepreciationRate  Decimal?             @db.Decimal(5, 2)

  // Upstream Operational Integration Links
  supplierId              String?              // Links to InventorySupplier (3.1J)
  grnId                   String?              // Links to GoodsReceivedNote (3.1J)
  grnItemId               String?              // Links to GoodsReceivedNoteItem (3.1J)
  transportVehicleId      String?              // Links to TransportVehicle (3.1I) - 1-to-1
  treasuryAccountId       String?              // Links to TreasuryAccount used for purchase (3.1K)
  capitalizationJournalId String?              // Links to JournalEntry (3.1L)

  createdAt               DateTime             @default(now())
  updatedAt               DateTime             @updatedAt

  branch                  Branch               @relation(fields: [branchId], references: [id], onDelete: Cascade)
  category                AssetCategory        @relation(fields: [categoryId], references: [id])
  location                AssetLocation?       @relation(fields: [locationId], references: [id])
  custodian               Employee?            @relation(fields: [custodianId], references: [id])
  supplier                InventorySupplier?   @relation(fields: [supplierId], references: [id])
  grn                     GoodsReceivedNote?   @relation(fields: [grnId], references: [id])
  transportVehicle        TransportVehicle?    @relation(fields: [transportVehicleId], references: [id])
  treasuryAccount         TreasuryAccount?     @relation(fields: [treasuryAccountId], references: [id])
  capitalizationJournal   JournalEntry?        @relation("AssetCapitalizationJournal", fields: [capitalizationJournalId], references: [id])
  
  depreciationLines       AssetDepreciationLine[]
  disposalRecord          AssetDisposal?
  verificationLogs        AssetVerificationLog[]
  movementLogs            AssetMovementLog[]

  @@unique([branchId, assetTag])
  @@unique([branchId, transportVehicleId]) // Strictly 1-to-1 with TransportVehicle
  @@index([branchId, status])
  @@index([branchId, categoryId])
  @@index([branchId, locationId])
  @@index([branchId, custodianId])
  @@index([branchId, grnId])
}

// --------------------------------------------------
// 4. Periodic Batch Depreciation Run (Maker-Checker)
// --------------------------------------------------
model AssetDepreciationRun {
  id                      String                @id @default(cuid())
  branchId                String
  runNumber               String                // "DEP-2026-001"
  periodId                String                // Links to FiscalPeriod (3.1L)
  runDate                 DateTime
  status                  DepreciationRunStatus @default(DRAFT)
  totalAssetsCount        Int                   @default(0)
  totalDepreciationAmount Decimal               @default(0) @db.Decimal(12, 2)
  
  journalEntryId          String?               // Links to posted JournalEntry (3.1L)
  createdById             String
  approvedById            String?
  approvedAt              DateTime?
  rejectionReason         String?
  notes                   String?
  createdAt               DateTime              @default(now())
  updatedAt               DateTime              @updatedAt

  branch                  Branch                @relation(fields: [branchId], references: [id], onDelete: Cascade)
  fiscalPeriod            FiscalPeriod          @relation(fields: [periodId], references: [id])
  journalEntry            JournalEntry?         @relation(fields: [journalEntryId], references: [id])
  createdBy               User                  @relation("DeprecCreatedBy", fields: [createdById], references: [id])
  approvedBy              User?                 @relation("DeprecApprovedBy", fields: [approvedById], references: [id])
  lines                   AssetDepreciationLine[]

  @@unique([branchId, runNumber])
  @@unique([branchId, periodId]) // Strictly ONE run per fiscal period
  @@index([branchId, status])
}

// --------------------------------------------------
// 5. Individual Asset Line in Depreciation Run
// --------------------------------------------------
model AssetDepreciationLine {
  id                 String               @id @default(cuid())
  depreciationRunId  String
  assetId            String
  openingBookValue   Decimal              @db.Decimal(12, 2)
  depreciationAmount Decimal              @db.Decimal(12, 2)
  closingBookValue   Decimal              @db.Decimal(12, 2)
  depreciationMethod DepreciationMethod
  rateApplied        Decimal              @db.Decimal(5, 2)
  activeDaysInPeriod Int                  @default(30)
  totalDaysInPeriod  Int                  @default(30)
  createdAt          DateTime             @default(now())

  depreciationRun    AssetDepreciationRun @relation(fields: [depreciationRunId], references: [id], onDelete: Cascade)
  asset              AssetItem            @relation(fields: [assetId], references: [id])

  @@unique([depreciationRunId, assetId])
  @@index([depreciationRunId])
  @@index([assetId])
}

// --------------------------------------------------
// 6. Asset Disposal & Retirement Record
// --------------------------------------------------
model AssetDisposal {
  id                     String            @id @default(cuid())
  branchId               String
  assetId                String            @unique
  disposalDate           DateTime
  disposalType           AssetDisposalType
  disposalProceeds       Decimal           @default(0) @db.Decimal(12, 2)
  
  // Historical Snapshot at Disposal Timestamp
  costAtDisposal         Decimal           @db.Decimal(12, 2)
  accumDeprecAtDisposal   Decimal           @db.Decimal(12, 2)
  netBookValueAtDisposal Decimal           @db.Decimal(12, 2)
  gainOrLossAmount       Decimal           @db.Decimal(12, 2) // Positive = Gain (#4960), Negative = Loss (#6950)
  
  reason                 String
  buyerDetails           String?           // Customer/Buyer name & contact
  treasuryAccountId      String?           // Target TreasuryAccount receiving cash proceeds
  cashbookMovementId     String?           // Linked CashbookMovement (3.1K)
  journalEntryId         String?           // Linked GL Journal (3.1L)
  approvedById           String
  createdAt              DateTime          @default(now())

  branch                 Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  asset                  AssetItem         @relation(fields: [assetId], references: [id])
  treasuryAccount        TreasuryAccount?  @relation(fields: [treasuryAccountId], references: [id])
  cashbookMovement       CashbookMovement? @relation(fields: [cashbookMovementId], references: [id])
  journalEntry           JournalEntry?     @relation(fields: [journalEntryId], references: [id])
  approvedBy             User              @relation(fields: [approvedById], references: [id])

  @@index([branchId])
}

// --------------------------------------------------
// 7. Physical Asset Verification & Condition Audit Log
// --------------------------------------------------
model AssetVerificationLog {
  id              String         @id @default(cuid())
  branchId        String
  assetId         String
  verifiedAt      DateTime       @default(now())
  verifiedById    String
  condition       AssetCondition
  locationId      String?
  custodianId     String?
  isMissing       Boolean        @default(false)
  notes           String?
  createdAt       DateTime       @default(now())

  branch          Branch         @relation(fields: [branchId], references: [id], onDelete: Cascade)
  asset           AssetItem      @relation(fields: [assetId], references: [id])
  verifiedBy      User           @relation(fields: [verifiedById], references: [id])
  location        AssetLocation? @relation(fields: [locationId], references: [id])
  custodian       Employee?      @relation(fields: [custodianId], references: [id])

  @@index([branchId, assetId])
  @@index([branchId, verifiedAt])
}

// --------------------------------------------------
// 8. Internal Asset Movement & Custody Transfer Log
// --------------------------------------------------
model AssetMovementLog {
  id              String         @id @default(cuid())
  branchId        String
  assetId         String
  fromLocationId  String?
  toLocationId    String?
  fromCustodianId String?
  toCustodianId   String?
  transferDate    DateTime       @default(now())
  reason          String?
  transferredById String
  createdAt       DateTime       @default(now())

  branch          Branch         @relation(fields: [branchId], references: [id], onDelete: Cascade)
  asset           AssetItem      @relation(fields: [assetId], references: [id])
  fromLocation    AssetLocation? @relation("MovementFromLocation", fields: [fromLocationId], references: [id])
  toLocation      AssetLocation? @relation("MovementToLocation", fields: [toLocationId], references: [id])
  fromCustodian   Employee?      @relation("MovementFromCustodian", fields: [fromCustodianId], references: [id])
  toCustodian     Employee?      @relation("MovementToCustodian", fields: [toCustodianId], references: [id])
  transferredBy   User           @relation(fields: [transferredById], references: [id])

  @@index([branchId, assetId])
}

// --------------------------------------------------
// 9. Sequence Counters for Asset Tagging & Runs
// --------------------------------------------------
model AssetSequence {
  id        String   @id @default(cuid())
  branchId  String
  type      String   // "ASSET_TAG", "DEPRECIATION_RUN"
  year      Int
  nextVal   Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([branchId, type, year])
  @@index([branchId])
}
```

---

## 4. Exact Procurement & Capitalization Lifecycle

### 4.1 Complete GRN $\rightarrow$ Capitalization $\rightarrow$ Settlement Sequence

```
                         CAPITAL PROCUREMENT SEQUENCE
                         
    Event 1: Purchase Order Approved (3.1J)
    - PO Approved for 50 Computers @ UGX 2M = UGX 100M
    - GL: None (Encumbrance) | Treasury: None | P&L: None
    - Reversible: Yes (Cancel PO)
                         │
                         ▼
    Event 2: Goods Received Note (GRN) Delivery (3.1J)
    - Physical Delivery: 50 Computers received
    - Line item marked isCapitalAsset: true (does NOT enter consumable store stock)
    - Linked Expense voucher created: PENDING_PAYMENT under Capital Vote Head
    - GL: Dr. Accrued GRN Clearing (#2120) / Cr. AP Suppliers (#2110) [UGX 100M]
    - Treasury: None | P&L: None
    - Reversible: Yes (Void GRN)
                         │
                         ▼
    Event 3: Capitalization into Fixed Asset Subledger (3.1M)
    - AssetItem records created (AST-2026-00001 to AST-2026-00050)
    - GL: Dr. Computers & ICT (#1550) / Cr. Accrued GRN Clearing (#2120) [UGX 100M]
    - Clearing Account #2120 is fully cleared to zero!
    - Treasury: None | P&L: None
    - Reversible: No (Immutable Asset; Requires Disposal / Adjustment)
                         │
                         ▼
    Event 4: Supplier Settlement (3.1K Treasury Payment)
    - Bursar pays Supplier via Bank Transfer from Commercial Bank (#1120)
    - Treasury: TreasuryAccount.currentBalance deducted by UGX 100M
    - CashbookMovement created (CAPITAL_SUPPLIER_PAYMENT)
    - GL: Dr. AP Suppliers (#2110) / Cr. Commercial Bank (#1120) [UGX 100M]
    - Net Accounting Position: Dr. Fixed Asset (#1550) / Cr. Bank (#1120)
    - Both clearing accounts (#2120 and #2110) net to 0.00!
    - P&L: Zero expense at purchase. P&L expense recognized gradually via periodic depreciation!
```

| Event | Operational Authority | GL Journal Entries | Treasury Effect | P&L Effect | Reversible? |
|---|---|---|---|---|---|
| **1. PO Approval** | `PurchaseOrder` (`APPROVED`) | None | None | None | Yes (`CANCELLED`) |
| **2. GRN Receipt** | `GoodsReceivedNote` (`COMPLETED`) | $\text{Dr. \#2120} \quad / \quad \text{Cr. \#2110}$ | None | None | Yes (Void GRN) |
| **3. Capitalization** | `AssetItem` (`ACTIVE`) | $\text{Dr. \#1550} \quad / \quad \text{Cr. \#2120}$ | None | None | Via Asset Disposal |
| **4. Supplier Payout** | `CashbookMovement` (`DISBURSED`) | $\text{Dr. \#2110} \quad / \quad \text{Cr. \#1120}$ | $\text{currentBalance} -= \text{Cost}$ | None | Compensating reversal |

---

## 5. Direct Capitalization & Treasury Atomicity

### 5.1 Real Prisma Transaction Boundary
All direct capital purchases execute inside a genuine `db.$transaction(async tx => { ... })` boundary. `GLEngineDAO.postJournalEntry` natively accepts the `tx` TransactionClient parameter:

```typescript
// src/lib/dao/asset.dao.ts
static async capitalizeDirectPurchase(
  ctx: TenantContext,
  input: DirectAssetPurchaseInput
): Promise<AssetItem> {
  return await db.$transaction(async (tx) => {
    // 1. Validate Treasury Liquidity & Mutate Account
    const treasury = await tx.treasuryAccount.findFirst({
      where: { id: input.treasuryAccountId, branchId: ctx.branchId }
    });
    if (!treasury) throw new Error("Treasury account not found");
    if (new Prisma.Decimal(treasury.currentBalance).lt(input.acquisitionCost)) {
      throw new Error("Insufficient treasury funds for capital acquisition");
    }

    // Deduct Treasury Balance
    await tx.treasuryAccount.update({
      where: { id: treasury.id },
      data: { currentBalance: { decrement: input.acquisitionCost } }
    });

    // 2. Generate Atomic Asset Tag
    const tag = await AssetSequenceDAO.nextTag(ctx, tx);

    // 3. Create Authoritative AssetItem
    const asset = await tx.assetItem.create({
      data: {
        branchId: ctx.branchId,
        assetTag: tag,
        name: input.name,
        categoryId: input.categoryId,
        locationId: input.locationId,
        custodianId: input.custodianId,
        purchaseDate: input.purchaseDate,
        capitalizationDate: input.capitalizationDate,
        acquisitionCost: input.acquisitionCost,
        salvageValue: input.salvageValue || 0,
        depreciableBasis: new Prisma.Decimal(input.acquisitionCost).sub(input.salvageValue || 0),
        netBookValue: input.acquisitionCost,
        accumulatedDepreciation: 0,
        status: AssetStatus.ACTIVE,
        treasuryAccountId: treasury.id,
        capitalizationSource: CapitalizationSource.DIRECT_PURCHASE
      }
    });

    // 4. Create Immutable CashbookMovement
    await tx.cashbookMovement.create({
      data: {
        branchId: ctx.branchId,
        treasuryAccountId: treasury.id,
        movementType: CashbookMovementType.CAPITAL_EXPENDITURE,
        direction: CashbookDirection.OUTFLOW,
        amount: input.acquisitionCost,
        referenceType: "ASSET_ITEM",
        referenceId: asset.id,
        description: `Direct Capital Acquisition: ${asset.name} (${asset.assetTag})`,
        recordedById: ctx.userId
      }
    });

    // 5. Post Double-Entry General Ledger Journal (GLEngineDAO accepts tx)
    const category = await tx.assetCategory.findUnique({ where: { id: input.categoryId } });
    const assetGlAccId = category?.glAssetAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1550", tx))!.id;
    const bankGlAccId = treasury.glAccountId || (await GLAccountDAO.getAccountByCode(ctx, "1120", tx))!.id;

    await GLEngineDAO.postJournalEntry(
      ctx,
      {
        journalType: JournalType.CAPITAL_PURCHASE,
        entryDate: input.capitalizationDate,
        description: `Direct Capital Asset Acquisition: ${asset.assetTag} - ${asset.name}`,
        referenceType: "ASSET_ITEM",
        referenceId: asset.id,
        idempotencyKey: `${ctx.branchId}:ASSET:${asset.id}:CAPITALIZE`,
        bypassControlAccountValidation: true,
        lines: [
          { accountId: assetGlAccId, debit: input.acquisitionCost, credit: 0, description: `Asset capitalization: ${asset.name}` },
          { accountId: bankGlAccId, debit: 0, credit: input.acquisitionCost, description: `Paid from ${treasury.name}` }
        ]
      },
      tx // Passes transaction client
    );

    // 6. Audit Logging
    await AuditService.log(ctx, "CAPITALIZE_DIRECT_ASSET", "AssetItem", asset.id, JSON.stringify({ tag: asset.assetTag, cost: input.acquisitionCost.toString() }));

    return asset;
  });
}
```

### 5.2 Rollback Guarantees
If any failure occurs during execution (e.g. database unique violation on tag, closed fiscal period in GLEngineDAO, or unmapped GL account), Prisma rolls back all 5 steps simultaneously. Zero partial state, zero orphan asset records, and zero lost cash balance.

---

## 6. Deterministic Depreciation Engine & Calendar Rules

### 6.1 Exact Calendar-Days Pro-Rata Formula
Let $N$ be the exact days in the target period month ($28, 29, 30, 31$), $D_{\text{cap}}$ be the capitalization day, and $D_{\text{disp}}$ be the disposal day:

$$\text{Active Days in First Period} = N - D_{\text{cap}} + 1$$
$$\text{First Period Charge} = \left(\frac{\text{Acquisition Cost} - \text{Salvage Value}}{\text{Useful Life in Months}}\right) \times \left(\frac{N - D_{\text{cap}} + 1}{N}\right)$$

$$\text{Active Days in Disposal Period} = D_{\text{disp}}$$
$$\text{Disposal Period Charge} = \text{Monthly Full Charge} \times \left(\frac{D_{\text{disp}}}{N}\right)$$

- **Leap Years**: Handled deterministically using JavaScript UTC date calculation:
  `const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();` (Yields 29 in Feb 2024/2028; 28 in Feb 2025/2026).
- **Month-End Acquisition**: If acquired on the last day of month ($D_{\text{cap}} = N$), active days = 1, charging exactly $\frac{1}{N}$ of a month's depreciation.
- **Service Commencement**: `capitalizationDate`.
- **Depreciation Cessation**: Earlier of `disposalDate` or the date `netBookValue == salvageValue` (`status = FULLY_DEPRECIATED`).

---

### 6.2 Reducing Balance Method (RBM) Exact Specification
- Configured Annual Rate: $R_{\text{ann}} \in [0.05, 0.50]$ (e.g. $25\%$ for vehicles).
- Nominal Monthly Rate: $r_{\text{monthly}} = \frac{R_{\text{ann}}}{12}$.
- Periodic Charge:
  $$\text{Depreciation Charge} = \min\left(\text{Opening NBV} \times r_{\text{monthly}}, \; \text{Opening NBV} - \text{Salvage Value}\right)$$
- When $\text{Opening NBV} - \text{Depreciation Charge} \le \text{Salvage Value}$, the final period catches up to exactly reach `salvageValue`, and status transitions to `FULLY_DEPRECIATED`.

---

## 7. Asset Disposal Accounting & Gain/Loss Equations

### 7.1 Exact Balanced Disposal Equations

Every disposal journal balances mathematically to **zero variance** across all scenarios:

$$\text{Let } C = \text{Acquisition Cost}, \quad AD = \text{Accumulated Depreciation}, \quad NBV = C - AD, \quad P = \text{Disposal Proceeds}$$

#### 1. Sale with Net Gain ($P > NBV$):
$$\text{Gain} = P - NBV = P - (C - AD) = P + AD - C$$
$$\text{Debits} = P \; (\#1120) + AD \; (\#1600)$$
$$\text{Credits} = C \; (\#15xx) + \text{Gain} \; (\#4960) = C + (P + AD - C) = P + AD \equiv \text{Debits} \quad (\text{Balanced})$$

#### 2. Sale with Net Loss ($P < NBV$):
$$\text{Loss} = NBV - P = (C - AD) - P = C - AD - P$$
$$\text{Debits} = P \; (\#1120) + AD \; (\#1600) + \text{Loss} \; (\#6950) = P + AD + (C - AD - P) = C$$
$$\text{Credits} = C \; (\#15xx) \equiv \text{Debits} \quad (\text{Balanced})$$

#### 3. Sale at Exact Net Book Value ($P == NBV$):
$$\text{Debits} = P \; (\#1120) + AD \; (\#1600) = NBV + AD = C$$
$$\text{Credits} = C \; (\#15xx) \equiv \text{Debits} \quad (\text{Balanced})$$

#### 4. Scrap / Zero-Proceeds Total Write-Off ($P = 0$):
$$\text{Debits} = AD \; (\#1600) + NBV \; (\#6950 \text{ Loss}) = AD + (C - AD) = C$$
$$\text{Credits} = C \; (\#15xx) \equiv \text{Debits} \quad (\text{Balanced})$$
*(Zero Treasury mutation occurs for zero-proceeds write-offs).*

#### 5. Insurance Loss with Claim Settlement ($P_{\text{claim}} > 0$):
$$\text{Dr. Commercial Bank (\#1120)} \quad P_{\text{claim}}$$
$$\text{Dr. Accumulated Depreciation (\#1600)} \quad AD$$
$$\text{Dr. Loss on Asset Loss (\#6950)} \quad \max(0, NBV - P_{\text{claim}})$$
$$\text{Cr. Gain on Insurance Settlement (\#4960)} \quad \max(0, P_{\text{claim}} - NBV)$$
$$\text{Cr. Asset Cost (\#15xx)} \quad C$$

---

## 8. Fleet Vehicle Integration & Decommissioning Atomicity

### 8.1 Bi-Directional Linking
- `AssetItem.transportVehicleId` is enforced unique per branch via `@@unique([branchId, transportVehicleId])`.
- Exactly one `AssetItem` corresponds to one `TransportVehicle`.

### 8.2 Decommissioning Inside the Same Transaction
When an `AssetItem` linked to a `TransportVehicle` is disposed (sold, scrapped, written off):
Inside the `db.$transaction`:
1. `AssetItem.status = AssetStatus.DISPOSED`
2. `TransportVehicle.status = TransportStatus.INACTIVE`
3. `TransportVehicle.notes = "Decommissioned via asset disposal voucher"`
4. Treasury receives proceeds (if sale).
5. GL journal posted relieving `#1530` and `#1600`.

---

## 9. Comprehensive Acceptance Test Matrix

### 9.1 Unit & Integration Tests (`asset.dao.test.ts`)
- **AST-01**: Category CRUD and explicit GL account mapping resolution (`#15xx`, `#1600`, `#6900`).
- **AST-02**: Asset location and custodian management.
- **AST-03**: Direct purchase capitalization 4-way atomic transaction (Asset + Treasury + Cashbook + GL).
- **AST-04**: Direct capitalization deterministic idempotency replay (zero duplicate cash deduction).
- **AST-05**: GRN procurement capitalization and `#2120` accrual clearing.
- **AST-06**: Stores inventory $\rightarrow$ Fixed asset conversion and `#1310` asset relief.
- **AST-07**: Transport fleet vehicle 1-to-1 linking and anti-duplicate vehicle check.
- **AST-08**: Straight-Line depreciation exact calculation with salvage value floor capping.
- **AST-09**: Exact calendar-day pro-rata first period acquisition calculation.
- **AST-10**: Leap-year February 29 pro-rata calculation verification.
- **AST-11**: Month-end acquisition single-day pro-rata calculation.
- **AST-12**: Reducing Balance Method nominal monthly rate application and salvage floor.
- **AST-13**: Batch depreciation run generation (`DRAFT` $\rightarrow$ `SUBMITTED`).
- **AST-14**: Four-Eye Maker-Checker approval and rejection workflow.
- **AST-15**: Atomic GL posting of approved depreciation run ($\text{Dr. \#6900} / \text{Cr. \#1600}$).
- **AST-16**: Asset sale with Net Gain 5-way atomic transaction (Asset + Disposal + Treasury + Cashbook + GL).
- **AST-17**: Asset sale with Net Loss 5-way atomic transaction.
- **AST-18**: Asset scrap / write-off with zero proceeds (zero Treasury mutation).
- **AST-19**: Opening historical asset bootstrap with zero-variance GL equity posting.
- **AST-20**: Physical asset verification logging and condition updates.
- **AST-21**: Internal location movement and custody transfer logging (zero GL impact).
- **AST-22**: Real-time zero-drift telemetry by category and overall balance sheet.
- **AST-23**: Compensating adjustment depreciation line for prior-period correction.
- **AST-24**: Strict multi-branch tenant isolation.

### 9.2 Adversarial & Concurrency Tests (`asset.adversarial.test.ts`)
- **ADV-AST-01**: 20 concurrent asset registrations without sequence tag collision.
- **ADV-AST-02**: Concurrent duplicate depreciation run attempt in same fiscal period (P2002 rejected).
- **ADV-AST-03**: Depreciation run creation/posting in `CLOSED` or `LOCKED` fiscal period (rejected).
- **ADV-AST-04**: Four-Eye bypass / maker self-approval attempt (rejected).
- **ADV-AST-05**: Depreciation of already disposed or written-off asset (rejected).
- **ADV-AST-06**: Depreciation charge forcing NBV below salvage value (truncated to salvage floor).
- **ADV-AST-07**: Concurrent duplicate disposal attempt on same asset (rejected).
- **ADV-AST-08**: Direct capitalization with insufficient treasury funds (rejected).
- **ADV-AST-09**: Decimal(12,2) sub-cent rounding precision under 500 assets (exact zero variance).
- **ADV-AST-10**: Cross-branch asset mutation or depreciation leak (rejected).
- **ADV-AST-11**: Intentional asset tampering drift detection via telemetry engine.
- **ADV-AST-12**: Duplicate capitalization replay on same GRN item (rejected).
- **ADV-AST-13**: Linking two active asset items to the same `TransportVehicle` (rejected).
- **ADV-AST-14**: Disposal of non-existent or uncapitalized draft asset (rejected).

---

## 10. Summary of Architectural Decisions

| # | Topic | Architectural Decision |
|---|---|---|
| 1 | **Accounts Payable Boundary** | Dedicated AP subledger is explicitly OUT OF SCOPE for 3.1M (deferred to 3.1N). GRN capitalization uses `#2120 GRN Clearing` strictly as an internal double-entry clearing account. |
| 2 | **Treasury Atomicity** | Direct purchases and asset sales execute inside genuine `db.$transaction` boundaries, passing `tx` to `GLEngineDAO`. |
| 3 | **GRN Lifecycle** | 4-step sequence (PO $\rightarrow$ GRN Receipt $\rightarrow$ Capitalization Reclassification $\rightarrow$ Supplier Cash Settlement). Zero double-counting. |
| 4 | **Pro-Rata Math** | Exact Calendar Days: $\text{Charge} = \text{Monthly} \times \frac{N - D_{\text{cap}} + 1}{N}$, handling leap years deterministically. |
| 5 | **Disposal Equations** | Mathematically guaranteed zero-variance balancing for Gain, Loss, Exact NBV, Scrap, and Insurance Loss. |
| 6 | **Fleet Sync** | 1-to-1 unique mapping; asset disposal atomistically decommissions the linked `TransportVehicle`. |
| 7 | **Historical Bootstrap** | $\text{Dr. \#15xx Cost} = \text{Cr. \#1600 Accum} + \text{Cr. \#3500 Opening Equity}$ with deterministic replay protection. |

---

# **STATUS FINAL DESIGN GATE COMPLETE**
