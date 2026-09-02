# NOVA — FINANCE PHASE 3.1J FINAL ARCHITECTURE SPECIFICATION
## School Stores, Procurement, Inventory & Student Store Billing Engine

**Status**: READY FOR IMPLEMENTATION  
**Baseline Checkpoint**: `7a83983` (Phase 3.1I Approved & Closed)  
**Author**: Antigravity / DeepMind Advanced Agentic Coding Pair  

---

## 1. Executive Summary & Core Architectural Charter

Following the successful implementation of Finance Phases 3.1A through 3.1I, **Finance Phase 3.1J: School Stores, Procurement, Inventory & Student Store Billing Engine** delivers a comprehensive stores management, procurement, stock movement ledger, departmental requisition, and student store point-of-sale billing engine for NOVA.

### Phase 3.1J Scope Boundaries:
1. **Multi-Store / Location Hierarchy**: Segregation of stock across physical storehouses (*Central Store*, *Bursar Uniform Store*, *Kitchen & Food Provisions*, *Science Lab Store*, *Library Store*, *Dormitory Store*).
2. **Item & Product Master**: SKU cataloging with unit measurements, reorder levels, selling prices, and Weighted Average Cost (WAC) tracking.
3. **Supplier / Vendor Registry**: Certified vendor directories with URA TIN numbers, payment terms, and vendor performance logs.
4. **Purchase Orders (PO) & Multi-Step Lifecycle**: Complete procurement pipeline (`DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `ORDERED` $\to$ `PARTIALLY_RECEIVED` $\to$ `RECEIVED` / `REJECTED` / `CANCELLED`) with strict anti-self-approval safeguards.
5. **Goods Received Notes (GRN)**: Delivery capture against POs or spot purchases, updating WAC unit costs, with **automated creation of linked `Expense` vouchers in `ExpenseDAO` validated against active budget vote heads in `BudgetDAO`**.
6. **Requirements Ingestion (Phase 3.1H Integration)**: Direct ingestion of physical in-kind student handovers into Central Store stock without duplicate financial credits.
7. **Internal Departmental Requisitions**: Controlled supply issuance to academic departments, labs, and kitchen with approval workflows.
8. **Student Direct Store Sales & On-Account Billing**:
   - Uniform, textbook, and scholastic sales billed to student term invoices via `InvoiceDAO` under dedicated fee heads with subledger debit postings via `LedgerDAO`.
   - Direct cash/mobile money counter sales processed strictly through `PaymentDAO` with instant receipt issuance.
   - Zero parallel store ledgers or rogue cashier drawers.
9. **Immutable Stock Movement Ledger**: 13 distinct non-destructive movement types recording every balance delta with historical valuation snapshots.
10. **Physical Stocktake & Reconciliation**: Live discrepancy auditing, surplus adjustments, and damaged/expired write-offs.
11. **Valuation & Consumption Analytics**: Real-time stock valuation (WAC), inventory turnover, kitchen rations consumption rates, departmental expense breakdowns, and store profit margins.

---

## 2. Detailed Resolution of Mandatory Architecture Gates

---

### Gate 1: INVENTORY AUTHORITY (Single Source of Truth)

- `InventoryStoreStock` (`storeId`, `itemId`) is the **sole authoritative table** for physical on-hand quantity (`quantityOnHand`) and reserved quantity (`quantityReserved`).
- The item master (`InventoryItem`) **does not maintain an independent total quantity field**. Total branch stock is always calculated dynamically as $\sum_{\text{stores}} \text{InventoryStoreStock.quantityOnHand}$.
- Every mutation to `InventoryStoreStock.quantityOnHand` MUST be accompanied by an immutable `StockMovement` row within the exact same database transaction.
- **Transactional Atomic Mutation Flow**:
  1. Acquire lock on `InventoryStoreStock` row for `(storeId, itemId)`.
  2. Compute `newOnHand = currentOnHand.add(quantityDelta)`.
  3. Validate `newOnHand >= 0` (unless authorized stocktake adjustment override).
  4. Update `InventoryStoreStock.quantityOnHand = newOnHand`.
  5. Insert `StockMovement` row with exact `balanceAfter: newOnHand`, `unitCostAtMovement: currentWAC`, and `totalValuation: newOnHand.mul(currentWAC)`.
- **Mathematical Invariant**:
  $$\text{InventoryStoreStock.quantityOnHand} = \sum_{\text{movements}} \text{StockMovement.quantityDelta}$$

---

### Gate 2: WAC AUTHORITY & VALUATION FORMULA

- **Location of WAC**: Current WAC lives on `InventoryItem.unitCostPrice` as `Decimal(12, 2)`.
- **Trigger for WAC Mutation**: WAC recalculation occurs **strictly on inbound procurement receipts (`PROCUREMENT_RECEIPT` via GRN)**.
- **Exact Formula**:
  $$\text{New WAC} = \frac{(\text{Current Qty} \times \text{Current WAC}) + (\text{GRN Qty} \times \text{GRN Unit Purchase Price})}{\text{Current Qty} + \text{GRN Qty}}$$
- **Zero / Negative Stock Behavior**:
  - If $\text{Current Qty} \le 0$, $\text{New WAC} = \text{GRN Unit Purchase Price}$.
- **Rounding & Precision**:
  - All arithmetic executed using `Prisma.Decimal` with banker's rounding (`ROUND_HALF_UP`) to 2 decimal places. Floating-point arithmetic (`number`) is strictly forbidden.
- **Non-WAC Inbound / Outbound Events**:
  - Department returns, student sales returns, requirement handovers, transfers, and physical stocktake surplus do NOT change the unit WAC cost; they ingest/restore stock at the item's prevailing WAC.
  - Departmental issues, student sales, transfers, and write-offs consume stock at current WAC without altering the unit cost.
- **Historical Snapshot Preservation**: `GoodsReceivedItem.unitCostPrice`, `PurchaseOrderItem.unitCostPrice`, `RequisitionItem.unitCostSnapshot`, and `StockMovement.unitCostAtMovement` preserve the exact cost snapshot at the moment of the event.

---

### Gate 3: PROCUREMENT LIFECYCLE & PURCHASE ORDERS

- **Lifecycle Progression**:
  $$\text{DRAFT} \longrightarrow \text{SUBMITTED} \longrightarrow \text{APPROVED} \longrightarrow \text{ORDERED} \longrightarrow \text{PARTIALLY\_RECEIVED} \longrightarrow \text{RECEIVED}$$
  $$\text{Terminal / Exception States: } \text{REJECTED}, \text{CANCELLED}$$
- **Lifecycle Rules**:
  - `DRAFT`: Line items, quantities, and supplier are freely editable by creator.
  - `SUBMITTED`: Awaiting supervisor approval; PO is locked for edits.
  - `APPROVED`: Authorized for vendor placement. Line items, quantities, and financial totals are frozen.
  - `ORDERED`: Purchase order officially transmitted to supplier.
  - `PARTIALLY_RECEIVED`: Triggered when first GRN is received and $\sum \text{received} < \sum \text{ordered}$.
  - `RECEIVED`: Triggered automatically when all lines have $\text{quantityReceived} \ge \text{quantityOrdered}$.
  - `REJECTED`: Declined by approver with mandatory `rejectionReason`.
  - `CANCELLED`: Cancelled prior to full receipt with mandatory `cancellationReason`.
- **Anti-Self-Approval**: In production mode, `po.createdById !== approverUserId`.
- **Over-Receipt & Tolerances**: Receiving beyond ordered quantity is blocked unless an explicit `allowOverReceipt: true` flag and supervisor override justification are provided (capped at $+10\%$ maximum variance).

---

### Gate 4: GRN FINANCIAL INTEGRATION & EXPENSES

- **Exact Moment of Expense Creation**: When a `GoodsReceivedNote` is created with `createExpenseVoucher: true` (or default procurement flow), `ExpenseDAO.createExpense` is executed within the transaction:
  - `categoryId`: mapped `ExpenseCategory` (e.g., "Food & Boarding Supplies", "Scholastic Materials", "Stationery").
  - `title`: `GRN: {grnNumber} - {supplierName}`.
  - `amount`: `totalAmount`.
  - `receiptRef`: `supplierInvoiceRef`.
  - `idempotencyKey`: `grn-exp-{branchId}-{grnNumber}`.
- **Duplicate Prevention**: Idempotency key prevents duplicate vouchers on network retries.
- **BudgetDAO Enforcement**: Validates expense against active term budget vote head ceiling via `BudgetDAO.validateExpenseAgainstBudget`.
- **GRN Voiding & Reversal**:
  - `InventoryDAO.voidGoodsReceivedNote(ctx, grnId, { voidReason })`:
    - Decrements stock in `InventoryStoreStock`.
    - Creates `VENDOR_RETURN` stock movement.
    - Calls `ExpenseDAO.voidExpense(expenseId, voidReason)`.
    - Marks GRN `isVoided = true`.

---

### Gate 5: SUPPLIER INVOICE VS CASH SETTLEMENT (Accrual vs Cash)

- In school operations, receiving goods via GRN establishes the inventory delivery and incurs the operational expenditure (`Expense` voucher under accrual accounting).
- Actual cash settlement may occur immediately (Cash on Delivery) or on credit terms (Net 30 via bank transfer / cheque).
- **Scope Decision for Phase 3.1J**:
  - Phase 3.1J records the GRN and generates the formal `Expense` record in `ExpenseDAO` representing the incurred operational liability.
  - The payment method is recorded on the GRN/Expense (`BANK_TRANSFER`, `CHEQUE`, `CASH`, `INVOICE_CREDIT`).
  - Full accounts payable multi-stage voucher aging/settlement schedules remain deferred to General Ledger.

---

### Gate 6: STUDENT STORE SALES & UNIFIED BILLING

- **Option 1: Direct Counter Sale (Cash / Mobile Money / Card)**:
  - Processed strictly via `PaymentDAO.recordPayment` under payment category `OTHER` with reference `STR-SALE-{saleReceiptNo}`.
  - Generates official `Receipt` and records ledger credit/debit pairing.
  - Links `StudentStoreSale.paymentId = payment.id`.
- **Option 2: On-Account Term Billing (Invoiced to Student Term Bill)**:
  - Adds an `InvoiceItem` to student's active term `Invoice` via `InvoiceDAO.addInvoiceItem`.
  - Posts `LedgerDAO.postEntry` with `entryType: LedgerEntryType.INVOICE_GROSS_CHARGE` and `direction: LedgerDirection.DEBIT`.
  - Links `StudentStoreSale.invoiceItemId = invoiceItem.id`.
- **Stock Decrementation**: Immediately decrements `StoreStock` and creates `STUDENT_SALE_OUTFLOW` movement.
- **Idempotency**: Unique constraint on `[branchId, saleReceiptNo]` and deterministic idempotency key `sale-{branchId}-{studentId}-{saleReceiptNo}`.

---

### Gate 7: SALES RETURNS & REVERSALS

- **Return Semantics**:
  - Storekeeper executes `InventoryDAO.processStudentSaleReturn(ctx, saleId, { items: [{ itemId, quantity, returnReason }] })`.
  - Increments `InventoryStoreStock.quantityOnHand`.
  - Posts `STUDENT_SALE_RETURN` movement at current WAC.
  - Financial adjustment:
    - If on-account: calls `LedgerDAO.postEntry` with `entryType: CREDIT_ADJUSTMENT`, `direction: CREDIT` to credit the student subledger.
    - If cash counter sale: marks return, and if cash refunded, records offsetting adjustment or links refund receipt.
  - Zero raw `DELETE` operations.

---

### Gate 8: REQUIREMENTS INTEGRATION (Phase 3.1H Ingestion)

- Phase 3.1H tracks student physical handovers in `InKindHandoverLog` (e.g. 2 reams of paper, 1 broom).
- `InventoryDAO.ingestRequirementHandover(ctx, { storeId, itemId, handoverLogId, quantity })`:
  - Validates verified handover in `InKindHandoverLog`.
  - Prevents duplicate ingestion via `InKindHandoverLog.isIngestedIntoInventory` flag.
  - Increments `InventoryStoreStock.quantityOnHand`.
  - Posts `StockMovement` with type `REQUIREMENT_HANDOVER_INFLOW` at cost `0` (or standard catalog rate for asset valuation).
  - **Zero Student Ledger Impact**: Does not generate false cash expenses or duplicate student credits.

---

### Gate 9: DEPARTMENTAL REQUISITIONS & ISSUES

- Lifecycle: `DRAFT` $\to$ `PENDING_APPROVAL` $\to$ `APPROVED` $\to$ `ISSUED` (or `PARTIALLY_ISSUED`) $\to$ `REJECTED` / `CANCELLED`.
- Teacher / Cook submits requisition detailing items, quantities, and academic purpose.
- Approver authorizes requisition (`APPROVED`).
- Storekeeper issues goods (`ISSUED`):
  - Validates `quantityOnHand >= approvedQuantity`.
  - Decrements stock and posts `DEPARTMENT_ISSUE` movement with cost snapshot.
- Departmental returns (unused supplies) are returned via `DEPARTMENT_RETURN`.

---

### Gate 10: PHYSICAL STOCKTAKES & AUDIT DISCREPANCIES

- Stocktake count per store and item.
- Discrepancy: $\Delta Q = \text{Physical Count} - \text{System Stock}$.
- Surplus: Posts `STOCKTAKE_SURPLUS` (+).
- Deficit: Posts `STOCKTAKE_DEFICIT` (-).
- Mandates supervisor justification, updates `lastStocktakeAt`, and logs a high-priority audit event to `AuditService`.

---

### Gate 11: INTERNAL STORE TRANSFERS

- Handled via `InventoryDAO.transferStock(ctx, { sourceStoreId, destStoreId, itemId, quantity, reason })`.
- Single atomic transaction:
  1. Lock source and destination stock rows.
  2. Verify `sourceStore.quantityOnHand >= quantity`.
  3. Decrement source store: create `TRANSFER_OUT` movement ($-\Delta Q$).
  4. Increment destination store: create `TRANSFER_IN` movement ($+\Delta Q$) at prevailing WAC.
  5. If either leg fails, the entire transaction rolls back.

---

### Gate 12: CONCURRENCY, IDEMPOTENCY & LOCKING

- Row-level database locking: `SELECT ... FOR UPDATE` on `InventoryStoreStock` rows within Prisma `$transaction`.
- Sequential identifiers (`PO-YYYY-XXXXX`, `GRN-YYYY-XXXXX`, `REQ-YYYY-XXXXX`, `SALE-YYYY-XXXXX`) allocated atomically via `InventorySequence`.
- Deterministic idempotency keys on billing and expense routines.

---

### Gate 13: FINANCIAL INTEGRATION (Unified Authority)

- Strictly utilizes existing DAOs:
  - `InvoiceDAO`: On-account store item billing.
  - `PaymentDAO`: Counter cash/MoMo payment processing.
  - `LedgerDAO`: Student subledger debits and credit adjustments.
  - `ExpenseDAO`: Vendor procurement expense vouchers.
  - `BudgetDAO`: Vote head ceiling validations.
- **Zero parallel ledger or cash authorities**.

---

### Gate 14: FIXED ASSETS (Explicit Decision)

- **Decision**: **Explicitly DEFER Fixed Asset Depreciation & Capitalization Accounting to a dedicated Asset Management Phase.**
- Scope for 3.1J: Focus exclusively on **Physical Inventory, Consumable & Resale Stock, Store Warehouses, Procurement GRNs, Departmental Requisitions, and Student Store/Uniform Billing**.
- This keeps Phase 3.1J clean, cohesive, and eliminates redundant accounting complexity.

---

### Gate 15: REPORTING & ANALYTICS SPECIFICATION

1. **Stock on Hand & Valuation**:
   $$\text{Total Store Valuation} = \sum (\text{StoreStock.quantityOnHand} \times \text{Item.unitCostPrice})$$
2. **Reorder & Low Stock Alerts**:
   $$\text{Trigger when: } \text{StoreStock.quantityOnHand} \le \text{Item.reorderLevel}$$
3. **Departmental Consumption Report**:
   $$\text{Dept Expense} = \sum (\text{RequisitionItem.quantityIssued} \times \text{RequisitionItem.unitCostSnapshot})$$
4. **Student Store Sales & Profit Margins**:
   $$\text{Gross Profit} = \sum (\text{SaleItem.totalPrice} - (\text{SaleItem.quantity} \times \text{Item.unitCostPrice}))$$
   $$\text{Margin \%} = \frac{\text{Gross Profit}}{\text{Total Sales Revenue}} \times 100$$
5. **Inventory Turnover Ratio**:
   $$\text{Turnover} = \frac{\text{Cost of Goods Issued / Sold in Term}}{\text{Average Stock Valuation}}$$
6. **Shrinkage & Discrepancy Summary**:
   $$\text{Total Loss} = \sum (\text{Deficit / Damage / Expired Qty} \times \text{WAC Unit Cost})$$

---

### Gate 16: RBAC & AUDIT SERVICE INTEGRATION

- **Permissions**:
  - `inventory:view`
  - `inventory:manage_catalog`
  - `inventory:manage_stores`
  - `inventory:suppliers`
  - `inventory:po_create`
  - `inventory:po_approve`
  - `inventory:grn_receive`
  - `inventory:requisition_create`
  - `inventory:requisition_approve`
  - `inventory:requisition_issue`
  - `inventory:sales`
  - `inventory:stocktake`
  - `inventory:reports`
- Every mutation logs structured audit events to `AuditService`.

---

### Gate 17: BRANCH / STORE ISOLATION

- All models contain foreign key `branchId: String` indexed and filtered in all DAO methods. Cross-branch inventory access is blocked.

---

### Gate 18: HISTORICAL IMMUTABILITY

- Snapshot fields on all historical purchase, receipt, requisition, and sale records (`itemNameSnapshot`, `supplierNameSnapshot`, `unitCostSnapshot`, `unitPriceSnapshot`) ensure that subsequent catalog or vendor updates never rewrite historical ledger transactions.

---

### Gate 19: COMPLETE DATA MODELS & ENUMS

```prisma
// ==========================================
// FINANCE: INVENTORY, PROCUREMENT & STORES (PHASE 3.1J)
// ==========================================

enum StoreLocationType {
  CENTRAL_STORE
  BURSAR_UNIFORM_STORE
  KITCHEN_STORE
  SCIENCE_LAB_STORE
  LIBRARY_STORE
  MAINTENANCE_WORKSHOP
  OTHER
}

enum InventoryItemCategory {
  UNIFORM
  SCHOLASTIC_TEXTBOOK
  STATIONERY_OFFICE
  FOOD_RATIONS
  LAB_CHEMICAL_APPARATUS
  BOARDING_SUPPLIES
  CLEANING_HYGIENE
  SPORTS_EQUIPMENT
  MAINTENANCE_TOOLS
  GENERAL
}

enum PurchaseOrderStatus {
  DRAFT
  SUBMITTED
  APPROVED
  ORDERED
  PARTIALLY_RECEIVED
  RECEIVED
  REJECTED
  CANCELLED
}

enum StockMovementType {
  PROCUREMENT_RECEIPT
  REQUIREMENT_HANDOVER_INFLOW
  TRANSFER_IN
  TRANSFER_OUT
  DEPARTMENT_ISSUE
  DEPARTMENT_RETURN
  STUDENT_SALE_OUTFLOW
  STUDENT_SALE_RETURN
  STOCKTAKE_SURPLUS
  STOCKTAKE_DEFICIT
  DAMAGE_WRITEOFF
  EXPIRATION_WRITEOFF
  VENDOR_RETURN
}

enum RequisitionStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  ISSUED
  PARTIALLY_ISSUED
  REJECTED
  CANCELLED
}

model InventoryStore {
  id          String            @id @default(cuid())
  branchId    String
  code        String            // e.g. "STR-CENTRAL"
  name        String            // e.g. "Main Central Store"
  storeType   StoreLocationType @default(CENTRAL_STORE)
  location    String?           // Room/Block
  managerId   String?           // Staff custodian
  isActive    Boolean           @default(true)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  branch       Branch                @relation(fields: [branchId], references: [id], onDelete: Cascade)
  manager      Employee?             @relation(fields: [managerId], references: [id], onDelete: SetNull)
  stocks       InventoryStoreStock[]
  movements    StockMovement[]
  grns         GoodsReceivedNote[]
  requisitions StoreRequisition[]
  sales        StudentStoreSale[]

  @@unique([branchId, code])
  @@index([branchId, storeType, isActive])
}

model InventoryItem {
  id            String                @id @default(cuid())
  branchId      String
  code          String                // SKU e.g. "UNIF-P3-BOY"
  name          String                // e.g. "Primary 3 Boys Uniform Set"
  category      InventoryItemCategory @default(GENERAL)
  unitOfMeasure String                // pcs, pairs, kg, bags, reams
  unitCostPrice Decimal               @default(0) @db.Decimal(12, 2) // Weighted Average Cost
  sellingPrice  Decimal?              @db.Decimal(12, 2) // Retail price for student sales
  reorderLevel  Decimal               @default(10) @db.Decimal(10, 2)
  description   String?
  isActive      Boolean               @default(true)
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt

  branch           Branch                 @relation(fields: [branchId], references: [id], onDelete: Cascade)
  stocks           InventoryStoreStock[]
  movements        StockMovement[]
  poItems          PurchaseOrderItem[]
  grnItems         GoodsReceivedItem[]
  requisitionItems RequisitionItem[]
  saleItems        StudentStoreSaleItem[]

  @@unique([branchId, code])
  @@index([branchId, category, isActive])
}

model InventoryStoreStock {
  id               String    @id @default(cuid())
  branchId         String
  storeId          String
  itemId           String
  quantityOnHand   Decimal   @default(0) @db.Decimal(12, 2)
  quantityReserved Decimal   @default(0) @db.Decimal(12, 2)
  lastStocktakeAt  DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  branch Branch         @relation(fields: [branchId], references: [id], onDelete: Cascade)
  store  InventoryStore @relation(fields: [storeId], references: [id], onDelete: Cascade)
  item   InventoryItem  @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([storeId, itemId])
  @@index([branchId, storeId])
}

model InventorySupplier {
  id           String   @id @default(cuid())
  branchId     String
  supplierCode String   // e.g. "SUP-001"
  name         String   // e.g. "Mukwano Industries"
  contactName  String?
  phone        String
  email        String?
  address      String?
  taxIdNumber  String?  // URA TIN
  paymentTerms String?  // e.g. "Net 30"
  isActive     Boolean  @default(true)
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  branch Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  pos    PurchaseOrder[]
  grns   GoodsReceivedNote[]

  @@unique([branchId, supplierCode])
  @@index([branchId, isActive])
}

model PurchaseOrder {
  id             String              @id @default(cuid())
  branchId       String
  poNumber       String              // PO-2026-00001
  supplierId     String
  academicYearId String
  termId         String?
  orderDate      DateTime            @default(now())
  expectedDate   DateTime?
  status         PurchaseOrderStatus @default(DRAFT)
  totalAmount    Decimal             @default(0) @db.Decimal(12, 2)
  notes          String?
  createdById    String
  approvedById   String?
  approvedAt     DateTime?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  branch       Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  supplier     InventorySupplier   @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  academicYear AcademicYear        @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  term         Term?               @relation(fields: [termId], references: [id], onDelete: Cascade)
  createdBy    User                @relation("POCreator", fields: [createdById], references: [id])
  approvedBy   User?               @relation("POApprover", fields: [approvedById], references: [id])
  items        PurchaseOrderItem[]
  grns         GoodsReceivedNote[]

  @@unique([branchId, poNumber])
  @@index([branchId, status])
}

model PurchaseOrderItem {
  id               String  @id @default(cuid())
  poId             String
  itemId           String
  itemNameSnapshot String
  quantityOrdered  Decimal @db.Decimal(12, 2)
  quantityReceived Decimal @default(0) @db.Decimal(12, 2)
  unitCostPrice    Decimal @db.Decimal(12, 2)
  lineTotalCost    Decimal @db.Decimal(12, 2)

  po   PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  item InventoryItem @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@index([poId])
}

model GoodsReceivedNote {
  id                   String    @id @default(cuid())
  branchId             String
  grnNumber            String    // GRN-2026-00001
  poId                 String?
  supplierId           String
  storeId              String
  expenseId            String?   // Linked Expense voucher in ExpenseDAO
  academicYearId       String
  termId               String?
  deliveryDate         DateTime  @default(now())
  supplierInvoiceRef   String?
  supplierNameSnapshot String
  totalAmount          Decimal   @db.Decimal(12, 2)
  notes                String?
  receivedById         String
  isVoided             Boolean   @default(false)
  voidReason           String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  branch       Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  po           PurchaseOrder?      @relation(fields: [poId], references: [id], onDelete: SetNull)
  supplier     InventorySupplier   @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  store        InventoryStore      @relation(fields: [storeId], references: [id], onDelete: Restrict)
  expense      Expense?            @relation(fields: [expenseId], references: [id], onDelete: SetNull)
  academicYear AcademicYear        @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  term         Term?               @relation(fields: [termId], references: [id], onDelete: Cascade)
  receivedBy   User                @relation(fields: [receivedById], references: [id])
  items        GoodsReceivedItem[]

  @@unique([branchId, grnNumber])
  @@index([branchId, supplierId, deliveryDate])
}

model GoodsReceivedItem {
  id               String    @id @default(cuid())
  grnId            String
  itemId           String
  itemNameSnapshot String
  quantityReceived Decimal   @db.Decimal(12, 2)
  unitCostPrice    Decimal   @db.Decimal(12, 2)
  lineTotalCost    Decimal   @db.Decimal(12, 2)
  batchNumber      String?
  expiryDate       DateTime?
  notes            String?

  grn  GoodsReceivedNote @relation(fields: [grnId], references: [id], onDelete: Cascade)
  item InventoryItem     @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@index([grnId])
}

model StoreRequisition {
  id            String            @id @default(cuid())
  branchId      String
  requisitionNo String            // REQ-2026-00001
  storeId       String
  departmentId  String?
  requestedById String
  approvedById  String?
  status        RequisitionStatus @default(PENDING_APPROVAL)
  purpose       String
  requestDate   DateTime          @default(now())
  issuedDate    DateTime?
  notes         String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  branch      Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  store       InventoryStore    @relation(fields: [storeId], references: [id], onDelete: Restrict)
  department  Department?       @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  requestedBy Employee          @relation("RequisitionRequester", fields: [requestedById], references: [id])
  approvedBy  User?             @relation("RequisitionApprover", fields: [approvedById], references: [id])
  items       RequisitionItem[]

  @@unique([branchId, requisitionNo])
  @@index([branchId, status])
}

model RequisitionItem {
  id                String  @id @default(cuid())
  requisitionId     String
  itemId            String
  quantityRequested Decimal @db.Decimal(12, 2)
  quantityIssued    Decimal @default(0) @db.Decimal(12, 2)
  unitCostSnapshot  Decimal @db.Decimal(12, 2)

  requisition StoreRequisition @relation(fields: [requisitionId], references: [id], onDelete: Cascade)
  item        InventoryItem    @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@index([requisitionId])
}

model StudentStoreSale {
  id             String   @id @default(cuid())
  branchId       String
  saleReceiptNo  String   // STR-SALE-2026-00001
  studentId      String
  storeId        String
  academicYearId String
  termId         String?
  saleDate       DateTime @default(now())
  totalAmount    Decimal  @db.Decimal(12, 2)
  invoiceItemId  String?  // If billed on account (InvoiceItem link)
  paymentId      String?  // If paid cash/MoMo (Payment link)
  recordedById   String
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  branch       Branch                 @relation(fields: [branchId], references: [id], onDelete: Cascade)
  student      Student                @relation(fields: [studentId], references: [id], onDelete: Cascade)
  store        InventoryStore         @relation(fields: [storeId], references: [id], onDelete: Restrict)
  academicYear AcademicYear           @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  term         Term?                  @relation(fields: [termId], references: [id], onDelete: Cascade)
  invoiceItem  InvoiceItem?           @relation(fields: [invoiceItemId], references: [id], onDelete: SetNull)
  payment      Payment?               @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  recordedBy   User                   @relation(fields: [recordedById], references: [id])
  items        StudentStoreSaleItem[]

  @@unique([branchId, saleReceiptNo])
  @@index([branchId, studentId, saleDate])
}

model StudentStoreSaleItem {
  id               String  @id @default(cuid())
  saleId           String
  itemId           String
  itemNameSnapshot String
  quantity         Decimal @db.Decimal(10, 2)
  unitPrice        Decimal @db.Decimal(12, 2)
  totalPrice       Decimal @db.Decimal(12, 2)

  sale StudentStoreSale @relation(fields: [saleId], references: [id], onDelete: Cascade)
  item InventoryItem    @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@index([saleId])
}

model StockMovement {
  id                 String            @id @default(cuid())
  branchId           String
  storeId            String
  itemId             String
  movementType       StockMovementType
  quantityDelta      Decimal           @db.Decimal(12, 2)
  balanceAfter       Decimal           @db.Decimal(12, 2)
  unitCostAtMovement Decimal           @db.Decimal(12, 2)
  totalValuation     Decimal           @db.Decimal(14, 2)
  referenceType      String            // "GRN", "PO", "REQUISITION", "SALE", "TRANSFER", "STOCKTAKE", "REQUIREMENT"
  referenceId        String?
  reason             String?
  performedById      String
  createdAt          DateTime          @default(now())

  branch      Branch         @relation(fields: [branchId], references: [id], onDelete: Cascade)
  store       InventoryStore @relation(fields: [storeId], references: [id], onDelete: Cascade)
  item        InventoryItem  @relation(fields: [itemId], references: [id], onDelete: Cascade)
  performedBy User           @relation(fields: [performedById], references: [id])

  @@index([branchId, storeId, itemId, createdAt])
  @@index([branchId, movementType])
}

model InventorySequence {
  id        String   @id @default(cuid())
  branchId  String
  type      String   // "PO", "GRN", "REQ", "SALE"
  year      Int
  lastValue Int      @default(0)
  updatedAt DateTime @updatedAt

  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([branchId, type, year])
}
```

---

## 3. Comprehensive Test Matrix

### DAO Unit Tests (INV-01 .. INV-20)
1. **INV-01**: Create inventory store locations and verify code uniqueness per branch.
2. **INV-02**: Create inventory item master with SKU, unit of measure, and selling price.
3. **INV-03**: Create supplier profile with contact details, payment terms, and URA TIN.
4. **INV-04**: Draft, submit, and approve Purchase Order with line items.
5. **INV-05**: Prevent creator from self-approving Purchase Order.
6. **INV-06**: Receive goods via GRN against PO and increment `StoreStock.quantityOnHand`.
7. **INV-07**: Recalculate Weighted Average Cost (WAC) upon GRN reception.
8. **INV-08**: Partial GRN receiving: updates PO status to `PARTIALLY_RECEIVED`.
9. **INV-09**: Full GRN receiving: updates PO status to `RECEIVED`.
10. **INV-10**: Automatically generate linked `Expense` voucher in `ExpenseDAO` on GRN creation.
11. **INV-11**: Validate GRN expense against active term budget vote head in `BudgetDAO`.
12. **INV-12**: Transfer stock between two stores in the same branch and record dual `StockMovement` entries.
13. **INV-13**: Departmental requisition creation, approval, and stock issuance.
14. **INV-14**: Return unused department goods to store (`DEPARTMENT_RETURN`).
15. **INV-15**: Student store sale via cash counter payment with `PaymentDAO` integration.
16. **INV-16**: Student store sale on-account with `InvoiceDAO` `InvoiceItem` and `LedgerDAO` debit posting.
17. **INV-17**: Ingest Phase 3.1H physical requirement handover deliveries into store stock.
18. **INV-18**: Physical stocktake audit: record surplus and deficit discrepancy adjustments.
19. **INV-19**: Write off damaged and expired goods with non-destructive `StockMovement` entries.
20. **INV-20**: Void GRN and synchronously void linked `Expense` voucher.

### Adversarial & Boundary Tests (ADV-INV-01 .. ADV-INV-10)
1. **ADV-INV-01**: Block stock issue or sale if requested quantity exceeds available `quantityOnHand`.
2. **ADV-INV-02**: Reject duplicate PO or GRN reference numbers within the same branch and year.
3. **ADV-INV-03**: Reject duplicate supplier invoice reference for the same vendor.
4. **ADV-INV-04**: Prevent receiving goods on an unapproved or cancelled PO.
5. **ADV-INV-05**: Block over-receipt on PO unless supervisor override authorization is provided.
6. **ADV-INV-06**: Verify exact Decimal precision on WAC recalculation over successive micro-deliveries without floating-point distortion.
7. **ADV-INV-07**: Prevent cross-branch stock transfer or unauthorized inter-branch inventory access.
8. **ADV-INV-08**: Concurrent stock deduction race test: serializes simultaneous checkouts without negative inventory.
9. **ADV-INV-09**: Block GRN creation if budget vote head ceiling is exceeded and hard budget enforcement is active.
10. **ADV-INV-10**: Verify historical immutability: changing item selling price or supplier profile does not alter past GRN or sale records.

---

## 4. Implementation Sequence

1. **Step 1: Prisma Schema & Migration**:
   - Update `nova/prisma/schema.prisma` with 5 Enums and 9 Models.
   - Generate migration `20260904000000_school_stores_procurement_and_inventory_engine`.
2. **Step 2: Core DAO Layer**:
   - Implement `src/lib/dao/inventory.dao.ts` with complete transactional authority.
3. **Step 3: Verification Suites**:
   - Write and pass `src/lib/dao/inventory.dao.test.ts` (INV-01 .. INV-20).
   - Write and pass `src/lib/dao/inventory.adversarial.test.ts` (ADV-INV-01 .. ADV-INV-10).
4. **Step 4: API Layer**:
   - Create 18 REST endpoints under `src/app/api/inventory/...`.
5. **Step 5: Workstation UI & Dashboard Card**:
   - Build `src/app/(dashboard)/finance/inventory/page.tsx` (5 tabs).
   - Add Inventory card to `src/app/(dashboard)/finance/page.tsx`.
6. **Step 6: End-to-End Verification**:
   - Vitest suite, TypeScript, ESLint, double seeding, production build, Playwright `tests/inventory.spec.ts`.

---

## 5. Explicitly Out of Scope

- **Fixed asset depreciation schedules and capitalization accounting** (deferred to a dedicated Asset Management phase).
- **General ledger double-entry Chart of Accounts mapping** (deferred to General Ledger phase).
- **Barcode thermal printer native USB communication** (standard browser printing and keyboard wedge scanner input supported).
- **IoT refrigeration / warehouse smart sensor telemetry**.
- **Multi-currency international supplier procurement** (primary currency is Uganda Shillings `UGX`).

---

**STATUS: READY FOR IMPLEMENTATION**
