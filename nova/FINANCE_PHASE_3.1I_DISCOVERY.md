# NOVA — FINANCE PHASE 3.1I ARCHITECTURE SPECIFICATION
**Target Subsystem**: School Transport, Fleet Operations & Route Billing Engine  
**Document Status**: ARCHITECTURE SPECIFICATION — READY FOR IMPLEMENTATION  
**Author**: Antigravity Core Architecture Team  
**Date**: September 2026  
**Parent Checkpoint**: `72c7c8f` (Finance Phase 3.1H Approved, Tested & Closed)

---

## 1. STRATEGIC & OPERATIONAL CONTEXT

In Ugandan and East African schools (both day schools and boarding schools offering holiday/weekend shuttles), **School Transportation** is simultaneously one of the largest **recurring revenue streams** and one of the highest **operating expenditure risks**.

In urban and peri-urban centers (such as Kampala, Wakiso, Mukono, Entebbe, and Jinja), up to 70% of enrolled day students rely on school-provided transport. Transport fees are charged per route zone/stage with distinct pricing for **One-Way (Morning Only / Evening Only)** and **Two-Way (Return)** services.

Simultaneously, school fleets (vans, Super Customs, Coasters, and buses) incur continuous, high-volume operational costs:
1. **Daily Fuel & Lubricants** (frequent pump refills, fluctuating fuel prices).
2. **Vehicle Maintenance, Servicing & Repairs** (garage bills, tire replacement, engine overhauls, statutory inspections).
3. **Driver & Crew Assignments** (staff linkage, licensing, route accountability).

Currently, in legacy systems (`legacy-reference/Transport Management — Smart Schools Hub.html` and `Transport Operations — Smart Schools Hub.html`), transport operations and student billing exist as disconnected silos. Transport coordinators maintain manual lists, while bursars manually key in arbitrary transport charges, leading to:
- Students riding buses without active transport subscriptions or without paying transport fees.
- Overcrowded vehicles exceeding certified seating capacities.
- Unmonitored fuel leakages and uncontrolled vehicle maintenance costs that exceed allocated departmental budgets.
- Zero visibility into **Route Profitability** (which routes generate surplus revenue vs which routes lose money).

**Finance Phase 3.1I** establishes a unified **School Transport, Fleet Operations & Route Billing Engine** in NOVA, seamlessly connecting student transport subscriptions and automated invoicing with fleet asset management, fuel receipts, garage maintenance, and route profitability analytics.

---

## 2. GATES RESOLUTION & ARCHITECTURAL DECISIONS

### Gate 1: Historical Transport Snapshots & Immutability
- **Problem**: Changing a route name, stop landmark, or fee structure later in the academic year must never corrupt historical billing records, receipts, or passenger rosters.
- **Resolution**:
  - When a `StudentTransportSubscription` is created, it freezes immutable historical snapshot fields:
    - `routeNameSnapshot`: string (e.g., "Route 4: Ntinda – Kisaasi – Kyanja")
    - `stopNameSnapshot`: string (e.g., "Kisaasi Total Fuel Station")
    - `subscriptionType`: `TWO_WAY` | `ONE_WAY_MORNING` | `ONE_WAY_EVENING`
    - `baseFeeSnapshot`: `Decimal(12, 2)` (frozen base route fee)
    - `stopSurchargeSnapshot`: `Decimal(12, 2)` (frozen stage surcharge)
    - `finalFeeAmount`: `Decimal(12, 2)` (`baseFeeSnapshot + stopSurchargeSnapshot`)
  - Any subsequent edit to `TransportRoute` or `TransportRouteStop` pricing applies strictly to future subscriptions. Historical subscriptions remain completely frozen.

### Gate 2: Billing Authority & Subledger Integrity
- **Problem**: Transport fee billing must not create a parallel balance or cash collection authority.
- **Resolution**:
  - Transport billing strictly flows through existing **Phase 3.1B `InvoiceDAO`** and creates standard `InvoiceItem` line items under an authoritative `FeeType` (`TRANSPORT_FEE` or configured fee head).
  - Debit entries are posted to `StudentLedgerEntry` using Phase 3.1C subledger rules (`charges - payments +/- adjustments = balance`).
  - All fee collections MUST be processed through **Phase 3.1C `PaymentDAO.recordPayment`** (or Phase 3.1E SchoolPay auto-posting).
  - Standard FIFO invoice allocation settles the transport invoice line item upon payment.
  - `StudentTransportSubscription` maintains a direct foreign key `invoiceItemId` to `InvoiceItem.id`.

### Gate 3: Billing Idempotency & Collision Safeguards
- **Problem**: Repeated billing runs, network retries, or bulk class invoicing must never double-charge a student for transport.
- **Resolution**:
  - Deterministic billing idempotency key:
    $$\text{idempotencyKey} = \text{"trans-bill-" + branchId + "-" + studentId + "-" + academicYearId + "-" + termId + "-" + subscriptionId}$$
  - Unique database constraint:
    `StudentTransportSubscription` has `@@unique([branchId, studentId, academicYearId, termId, routeId])`.
  - When automated transport billing executes:
    - If `subscription.invoiceItemId` is already populated $\rightarrow$ skip (already billed).
    - If an invoice item already exists with matching student, academic year, term, and fee type with matching idempotency metadata $\rightarrow$ link `invoiceItemId` without creating a duplicate debit.

### Gate 4: Route Pricing Precedence & Temporal Scoping
- **Problem**: Clear precedence for route, stop, and trip-type pricing; prevent overlapping or ambiguous active prices.
- **Resolution**:
  - Pricing Calculation:
    $$\text{Final Transport Fee} = \text{BaseFee}(\text{Route}, \text{TripType}) + \text{StopSurcharge}(\text{Stop})$$
    Where:
    - `BaseFee` is determined by `subscriptionType`:
      - If `TWO_WAY`: `TransportRoute.twoWayFee`
      - If `ONE_WAY_MORNING` or `ONE_WAY_EVENING`: `TransportRoute.oneWayFee`
    - `StopSurcharge` is `TransportRouteStop.surchargeAmount` (default 0).
  - Scope: `TransportRoute` is bounded by `branchId + academicYearId + (termId | null)`.
  - Database constraint `@@unique([branchId, academicYearId, termId, code])` strictly prevents duplicate or competing route definitions for the same code and period.

### Gate 5: Vehicle Capacity Safety Invariant
- **Problem**: Overcrowded school vehicles violate transport safety regulations.
- **Resolution**:
  - **The Capacity Invariant**:
    $$\text{Active Passengers on Route for Trip Type} \le \text{Assigned Vehicle Certified Capacity}$$
  - Enforced at three distinct checkpoints:
    1. **Subscription Time**: When enrolling a student, the system computes active subscribers for that trip type (`TWO_WAY` + `ONE_WAY_MORNING` for AM, `TWO_WAY` + `ONE_WAY_EVENING` for PM). If $\ge \text{Vehicle Capacity}$, the system blocks enrollment unless an authorized supervisor override with written justification is supplied.
    2. **Vehicle Assignment Time**: When assigning a vehicle to a route for a term, the system validates that the selected vehicle's `capacity` is $\ge$ already enrolled subscribers.
    3. **Daily Manifest Time**: System calculates load factor $\% = \frac{\text{Roster Count}}{\text{Vehicle Capacity}} \times 100\%$. If $> 100\%$, marks manifest with visual alert `OVERLOAD_WARNING`.

### Gate 6: Driver & Vehicle Validity & Asset Auditability
- **Problem**: Drivers with expired licenses or vehicles with lapsed roadworthiness/insurance must not be assigned to school routes.
- **Resolution**:
  - **Driver Validation**:
    - `TransportDriver.isActive = true`
    - `licenseExpiry >= NOW()` (warns if expiring within 30 days; blocks assignment if expired).
    - Optional link to `Employee` model checks active employment status.
  - **Vehicle Validation**:
    - `TransportVehicle.status = ACTIVE` (cannot be `MAINTENANCE` or `OUT_OF_SERVICE`).
    - `insuranceExpiry >= NOW()` (blocks assignment if expired).
    - `inspectionDueDate >= NOW()` (blocks assignment if expired).
  - **Historical Snapshot on Assignment**:
    - `VehicleRouteAssignment` freezes `vehiclePlateSnapshot`, `vehicleCapacitySnapshot`, `driverNameSnapshot`, and `driverPhoneSnapshot` so that historical manifests remain 100% reproducible even if vehicles or drivers are later reassigned.

### Gate 7: Daily Passenger Manifests & Roster Semantics
- **Problem**: Drivers and conductors need daily morning and evening passenger manifests with accurate student details and emergency contacts.
- **Resolution**:
  - **Single Source of Truth**: Active `StudentTransportSubscription` records for the branch, academic year, term, and route.
  - **Morning Manifest (`TRIP_MORNING`)**: Includes students with `subscriptionType IN [TWO_WAY, ONE_WAY_MORNING]`, sorted by `TransportRouteStop.sequenceOrder ASC`.
  - **Evening Manifest (`TRIP_EVENING`)**: Includes students with `subscriptionType IN [TWO_WAY, ONE_WAY_EVENING]`, sorted by `TransportRouteStop.sequenceOrder ASC`.
  - **Anti-Duplicate Rule**: A student can appear at most ONCE per trip manifest.
  - **Details on Manifest**: Student name, admission number, class/stream, photo URL, stop landmark, pickup/dropoff time, parent/guardian full name, and emergency phone numbers.
  - **Manifest Audit**: Daily printing or export logs an audit event with timestamp and requesting user.

### Gate 8: Immutable Fuel Logs & ExpenseDAO Integration
- **Problem**: Fuel is a major source of financial leakage; fuel purchases must be verified and tracked without creating a duplicate expense ledger.
- **Resolution**:
  - **Lifecycle**: `RECORDED` $\rightarrow$ `VERIFIED` (or `REVERSED`).
  - **Required Fields**: `vehicleId`, `driverId`, `logDate`, `odometerKm`, `litersFilled`, `unitPrice`, `totalCost`, `fuelStation`, `receiptNumber`, `paymentMethod`.
  - **Validation Rules**:
    - **Monetary Match**: `totalCost` must strictly equal `litersFilled * unitPrice` (within rounding tolerance of $\pm 0.01$).
    - **Odometer Sequence**: `odometerKm` must be $> \text{previous logged odometer for vehicle}$ (rejects impossible backwards odometer readings).
    - **Anti-Duplicate Receipt**: Database unique constraint `@@unique([branchId, fuelStation, receiptNumber])` (where receiptNumber is provided) prevents double-logging the same pump receipt.
  - **Expense Integration**:
    - When logging fuel, invoking `ExpenseDAO.recordExpense` creates an official `Expense` voucher under category `TRANSPORT_FUEL`, referencing the fuel log ID in notes and setting `fuelLog.expenseId = expense.id`.
    - Physical fuel entry and accounting voucher are atomically linked in a single database transaction.

### Gate 9: Vehicle Maintenance & Garage Logs
- **Problem**: Vehicle maintenance costs (repairs, routine services, tires, batteries) must be tracked per vehicle and posted to accounts without parallel ledgers.
- **Resolution**:
  - **Required Fields**: `vehicleId`, `maintenanceDate`, `maintenanceType` (`ROUTINE_SERVICE`, `REPAIR`, `TYRES`, `INSPECTION`, `BATTERY`, `OTHER`), `garageName`, `description`, `partsCost`, `laborCost`, `totalCost`, `odometerAtService`, `nextServiceDate`, `nextServiceKm`.
  - **Validation Rules**:
    - `totalCost = partsCost + laborCost`.
    - `partsCost >= 0` and `laborCost >= 0`.
  - **Reversal Semantics**:
    - Maintenance records cannot be hard deleted. If logged in error, they are voided with a mandatory reason, which simultaneously voids the linked `Expense` via `ExpenseDAO.voidExpense`.
  - **Service Milestones**:
    - System computes remaining mileage to next service ($\text{nextServiceKm} - \text{currentOdometerKm}$) and triggers maintenance alerts on the dashboard.

### Gate 10: Budget Integration & Vote Head Controls
- **Problem**: Fuel and garage expenses must enforce budgetary discipline.
- **Resolution**:
  - Fuel expenses link to Expense Category `TRANSPORT_FUEL` (mapped to Vote Head `Operations / Transport - Fuel & Oils`).
  - Maintenance expenses link to Expense Category `VEHICLE_MAINTENANCE` (mapped to Vote Head `Operations / Transport - Maintenance & Repairs`).
  - `ExpenseDAO` automatically validates Phase 3.1G `BudgetDAO.validateExpenseAgainstBudget`. If budget enforcement is `HARD_STOP` and the budget ceiling is exceeded, the fuel or maintenance expense is blocked unless an authorized budget revision or override is provided.

### Gate 11: Transport Profitability & Fleet Analytics Formulas
- **Exact Financial & Operational Formulas**:
  1. **Route Transport Revenue**:
     $$\text{Revenue}(\text{Route}, \text{Period}) = \sum_{\text{Active Subscriptions}} \text{subscription.finalFeeAmount}$$
  2. **Route Direct Operating Cost**:
     $$\text{DirectCost}(\text{Route}, \text{Period}) = \sum \text{FuelCost}(\text{Assigned Vehicles}) + \sum \text{MaintenanceCost}(\text{Assigned Vehicles})$$
  3. **Route Net Contribution / Profitability**:
     $$\text{Net Contribution} = \text{Revenue}(\text{Route}) - \text{DirectCost}(\text{Route})$$
     $$\text{Contribution Margin \%} = \frac{\text{Net Contribution}}{\text{Revenue}(\text{Route})} \times 100\%$$
  4. **Fuel Consumption Efficiency**:
     $$\text{Fuel Economy (Km/L)} = \frac{\Delta \text{Odometer (Km)}}{\sum \text{Liters Filled}}$$
     $$\text{Fuel Cost per Km (UGX/Km)} = \frac{\sum \text{Fuel Cost}}{\Delta \text{Odometer (Km)}}$$
  5. **Seat Utilization**:
     $$\text{Seat Utilization \%} = \frac{\text{Active Route Subscribers}}{\text{Vehicle Seating Capacity}} \times 100\%$$
  - Voided or reversed expenses and cancelled subscription credits are excluded from net period figures.

### Gate 12: Revenue Attribution & Payment Realization
- **Problem**: When parents pay a lump-sum school fee payment, how is transport revenue attributed?
- **Resolution**:
  - Subscriptions link directly to an `InvoiceItem` under `FeeType = TRANSPORT_FEE`.
  - When `PaymentDAO.recordPayment` runs, `PaymentAllocation` records allocate payments against the student's invoices via FIFO.
  - **Billed Revenue** is attributed directly to the route based on the subscription's `finalFeeAmount`.
  - **Realized Cash Revenue** is attributed by aggregating `PaymentAllocation` amounts applied to `InvoiceItem`s belonging to transport subscriptions.

### Gate 13: Concurrency & Idempotency Controls
- **Duplicate Subscriptions**: DB unique constraint `@@unique([branchId, studentId, academicYearId, termId, routeId])`.
- **Concurrent Capacity Assignment**: Handled with PostgreSQL row-level locks (`SELECT FOR UPDATE` on `TransportVehicle` / `TransportRoute`) during subscription creation inside `db.$transaction`.
- **Duplicate Billing**: Idempotency key on invoice generation (`trans-bill-{studentId}-{termId}-{subscriptionId}`).
- **Duplicate Fuel Slips**: DB unique constraint on `@@unique([branchId, fuelStation, receiptNumber])`.
- **Concurrent Manifest Edits**: Derived query from subscriptions; subscription updates use transaction locks.

### Gate 14: RBAC & Permissions Matrix
| Permission Key | Description | Default Roles |
|---|---|---|
| `transport:routes:read` | View routes, stops, and pricing | `Admin`, `Bursar`, `Transport Coordinator`, `Teacher` |
| `transport:routes:write` | Create, update, deactivate routes and stops | `Admin`, `Bursar`, `Transport Coordinator` |
| `transport:fleet:read` | View vehicles, drivers, and assignments | `Admin`, `Bursar`, `Transport Coordinator` |
| `transport:fleet:write` | Register/edit vehicles, drivers, and assignments | `Admin`, `Bursar`, `Transport Coordinator` |
| `transport:subscriptions:read` | View student subscriptions and rosters | `Admin`, `Bursar`, `Transport Coordinator`, `Teacher` |
| `transport:subscriptions:write` | Enroll/cancel student transport subscriptions | `Admin`, `Bursar`, `Transport Coordinator` |
| `transport:billing:execute` | Trigger automated transport fee invoicing | `Admin`, `Bursar` |
| `transport:manifests:view` | View and print daily driver manifests | `Admin`, `Bursar`, `Transport Coordinator`, `Teacher`, `Driver` |
| `transport:expenses:fuel` | Record vehicle fuel logs and expense vouchers | `Admin`, `Bursar`, `Transport Coordinator` |
| `transport:expenses:maintenance`| Record garage maintenance and service logs | `Admin`, `Bursar`, `Transport Coordinator` |
| `transport:reports:view` | View route profitability and fleet efficiency | `Admin`, `Bursar`, `Principal` |
| `transport:override:capacity` | Authorize capacity overload override | `Admin`, `Principal`, `Bursar` |

### Gate 15: Mandatory AuditService Events
Every state modification emits structured events via `AuditService.log`:
- `TRANSPORT_ROUTE_CREATED`, `TRANSPORT_ROUTE_UPDATED`, `TRANSPORT_ROUTE_DEACTIVATED`
- `TRANSPORT_STOP_CREATED`, `TRANSPORT_STOP_UPDATED`, `TRANSPORT_STOP_DELETED`
- `TRANSPORT_VEHICLE_REGISTERED`, `TRANSPORT_VEHICLE_UPDATED`, `TRANSPORT_VEHICLE_STATUS_CHANGED`
- `TRANSPORT_DRIVER_REGISTERED`, `TRANSPORT_DRIVER_UPDATED`
- `TRANSPORT_ASSIGNMENT_CREATED`, `TRANSPORT_ASSIGNMENT_UPDATED`
- `STUDENT_TRANSPORT_SUBSCRIBED`, `STUDENT_TRANSPORT_UPDATED`, `STUDENT_TRANSPORT_CANCELLED`
- `TRANSPORT_FEES_BULK_BILLED`
- `TRANSPORT_FUEL_LOGGED`, `TRANSPORT_FUEL_REVERSED`
- `TRANSPORT_MAINTENANCE_LOGGED`, `TRANSPORT_MAINTENANCE_VOIDED`
- `TRANSPORT_CAPACITY_OVERRIDE_GRANTED`
- `TRANSPORT_MANIFEST_PRINTED`

### Gate 16: Multi-Tenant Branch Isolation
- Non-nullable `branchId` on all models (`TransportRoute`, `TransportRouteStop`, `TransportVehicle`, `TransportDriver`, `VehicleRouteAssignment`, `StudentTransportSubscription`, `VehicleFuelLog`, `VehicleMaintenanceLog`).
- All queries and mutations in `TransportDAO` enforce `ctx.branchId`.
- Cross-branch route assignment, subscription, vehicle sharing, or expense logging is strictly prevented.

---

## 3. COMPLETE PRISMA SCHEMA SPECIFICATION

```prisma
// ==========================================
// PHASE 3.1I: TRANSPORT & FLEET ENGINE ENUMS
// ==========================================

enum TransportSubscriptionType {
  TWO_WAY
  ONE_WAY_MORNING
  ONE_WAY_EVENING
}

enum TransportSubscriptionStatus {
  REQUESTED
  ACTIVE
  SUSPENDED
  CANCELLED
}

enum VehicleStatus {
  ACTIVE
  MAINTENANCE
  OUT_OF_SERVICE
}

enum MaintenanceType {
  ROUTINE_SERVICE
  REPAIR
  TYRES
  INSPECTION
  BATTERY
  OTHER
}

// ==========================================
// PHASE 3.1I: TRANSPORT & FLEET MODELS
// ==========================================

model TransportRoute {
  id              String   @id @default(cuid())
  branchId        String
  academicYearId  String
  termId          String?
  code            String   // e.g. "RT-01", "KAMPALA-NORTH"
  name            String   // e.g. "Ntinda - Kisaasi - Kyanja Route"
  description     String?
  destinationZone String?  // e.g. "Zone 2: 5-10km"
  twoWayFee       Decimal  @db.Decimal(12, 2)
  oneWayFee       Decimal  @db.Decimal(12, 2)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  branch       Branch         @relation(fields: [branchId], references: [id], onDelete: Cascade)
  academicYear AcademicYear   @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  term         Term?          @relation(fields: [termId], references: [id], onDelete: Cascade)

  stops        TransportRouteStop[]
  assignments  VehicleRouteAssignment[]
  subscriptions StudentTransportSubscription[]

  @@unique([branchId, academicYearId, code])
  @@index([branchId, academicYearId, isActive])
}

model TransportRouteStop {
  id                String   @id @default(cuid())
  routeId           String
  stopName          String   // e.g. "Kisaasi Total Fuel Station"
  landmark          String?  // e.g. "Opposite Kensington Heights"
  sequenceOrder     Int      @default(1)
  morningPickupTime String?  // e.g. "06:30 AM"
  eveningDropTime   String?  // e.g. "05:15 PM"
  surchargeAmount   Decimal  @default(0) @db.Decimal(12, 2)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  route         TransportRoute                 @relation(fields: [routeId], references: [id], onDelete: Cascade)
  subscriptions StudentTransportSubscription[]

  @@index([routeId, sequenceOrder])
}

model TransportVehicle {
  id                 String        @id @default(cuid())
  branchId           String
  registrationNumber String        // e.g. "UBJ 412X"
  makeModel          String        // e.g. "Toyota Coaster 30-Seater"
  capacity           Int           // e.g. 30 seats
  fuelType           String        @default("DIESEL") // DIESEL, PETROL
  status             VehicleStatus @default(ACTIVE)
  insuranceExpiry    DateTime?
  inspectionDueDate  DateTime?
  currentOdometerKm  Int           @default(0)
  notes              String?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  branch          Branch                   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  assignments     VehicleRouteAssignment[]
  fuelLogs        VehicleFuelLog[]
  maintenanceLogs VehicleMaintenanceLog[]

  @@unique([branchId, registrationNumber])
  @@index([branchId, status])
}

model TransportDriver {
  id            String   @id @default(cuid())
  branchId      String
  employeeId    String?  // Optional link to HR Employee model
  fullName      String   // e.g. "John Mukasa"
  phone         String   // e.g. "+256772123456"
  licenseNumber String   // e.g. "DL-UG-882319"
  licenseClass  String   // e.g. "CM, CH"
  licenseExpiry DateTime?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  branch      Branch                   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  employee    Employee?                @relation(fields: [employeeId], references: [id], onDelete: SetNull)
  assignments VehicleRouteAssignment[]
  fuelLogs    VehicleFuelLog[]

  @@index([branchId, isActive])
}

model VehicleRouteAssignment {
  id                     String   @id @default(cuid())
  branchId               String
  routeId                String
  vehicleId              String
  driverId               String?
  academicYearId         String
  termId                 String?
  isPrimary              Boolean  @default(true)
  vehiclePlateSnapshot   String   // e.g. "UBJ 412X"
  vehicleCapacitySnapshot Int     // e.g. 30
  driverNameSnapshot     String?  // e.g. "John Mukasa"
  driverPhoneSnapshot    String?  // e.g. "+256772123456"
  notes                  String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  branch       Branch           @relation(fields: [branchId], references: [id], onDelete: Cascade)
  route        TransportRoute   @relation(fields: [routeId], references: [id], onDelete: Cascade)
  vehicle      TransportVehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  driver       TransportDriver? @relation(fields: [driverId], references: [id], onDelete: SetNull)
  academicYear AcademicYear     @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  term         Term?            @relation(fields: [termId], references: [id], onDelete: Cascade)

  @@unique([branchId, routeId, vehicleId, academicYearId, termId])
  @@index([branchId, academicYearId])
}

model StudentTransportSubscription {
  id                     String                      @id @default(cuid())
  branchId               String
  studentId              String
  routeId                String
  stopId                 String?
  academicYearId         String
  termId                 String?
  subscriptionType       TransportSubscriptionType   @default(TWO_WAY)
  status                 TransportSubscriptionStatus @default(ACTIVE)
  routeNameSnapshot      String                      // Frozen historical route name
  stopNameSnapshot       String?                     // Frozen historical stop name
  baseFeeSnapshot        Decimal                     @db.Decimal(12, 2)
  stopSurchargeSnapshot  Decimal                     @default(0) @db.Decimal(12, 2)
  finalFeeAmount         Decimal                     @db.Decimal(12, 2)
  invoiceItemId          String?                     // Direct foreign key to InvoiceItem
  startDate              DateTime                    @default(now())
  endDate                DateTime?
  cancellationReason     String?
  overrideJustification  String?                     // Stored if capacity override granted
  notes                  String?
  createdAt              DateTime                    @default(now())
  updatedAt              DateTime                    @updatedAt

  branch       Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  student      Student             @relation(fields: [studentId], references: [id], onDelete: Cascade)
  route        TransportRoute      @relation(fields: [routeId], references: [id], onDelete: Cascade)
  stop         TransportRouteStop? @relation(fields: [stopId], references: [id], onDelete: SetNull)
  academicYear AcademicYear        @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  term         Term?               @relation(fields: [termId], references: [id], onDelete: Cascade)
  invoiceItem  InvoiceItem?        @relation(fields: [invoiceItemId], references: [id], onDelete: SetNull)

  @@unique([branchId, studentId, academicYearId, termId, routeId])
  @@index([branchId, routeId, status])
  @@index([branchId, studentId])
}

model VehicleFuelLog {
  id            String   @id @default(cuid())
  branchId      String
  vehicleId     String
  driverId      String?
  expenseId     String?  // Direct link to Phase 3.1D Expense record
  logDate       DateTime @default(now())
  odometerKm    Int
  litersFilled  Decimal  @db.Decimal(8, 2)
  unitPrice     Decimal  @db.Decimal(10, 2)
  totalCost     Decimal  @db.Decimal(12, 2)
  fuelStation   String   // e.g. "TotalEnergies Ntinda"
  receiptNumber String?  // Vendor pump receipt reference
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  branch  Branch           @relation(fields: [branchId], references: [id], onDelete: Cascade)
  vehicle TransportVehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  driver  TransportDriver? @relation(fields: [driverId], references: [id], onDelete: SetNull)
  expense Expense?         @relation(fields: [expenseId], references: [id], onDelete: SetNull)

  @@unique([branchId, fuelStation, receiptNumber])
  @@index([branchId, vehicleId, logDate])
}

model VehicleMaintenanceLog {
  id                String          @id @default(cuid())
  branchId          String
  vehicleId         String
  expenseId         String?         // Direct link to Phase 3.1D Expense record
  maintenanceDate   DateTime        @default(now())
  maintenanceType   MaintenanceType @default(ROUTINE_SERVICE)
  garageName        String          // e.g. "Spear Motors Workshop"
  description       String          // Work done, parts replaced
  partsCost         Decimal         @default(0) @db.Decimal(12, 2)
  laborCost         Decimal         @default(0) @db.Decimal(12, 2)
  totalCost         Decimal         @db.Decimal(12, 2)
  odometerAtService Int?
  nextServiceDate   DateTime?
  nextServiceKm     Int?
  isVoided          Boolean         @default(false)
  voidReason        String?
  notes             String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  branch  Branch           @relation(fields: [branchId], references: [id], onDelete: Cascade)
  vehicle TransportVehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  expense Expense?         @relation(fields: [expenseId], references: [id], onDelete: SetNull)

  @@index([branchId, vehicleId, maintenanceDate])
}
```

---

## 4. PROPOSED API ROUTE ARCHITECTURE

```
src/app/api/transport/
├── routes/
│   ├── route.ts                     // GET (list routes with stats), POST (create route with stops)
│   └── [id]/
│       ├── route.ts                 // GET (details), PUT (update), DELETE (deactivate)
│       └── stops/
│           └── route.ts             // POST (add stop), PUT (reorder stops)
├── fleet/
│   ├── vehicles/
│   │   ├── route.ts                 // GET (list fleet), POST (register vehicle)
│   │   └── [id]/
│   │       └── route.ts             // GET (vehicle detail & stats), PUT (update status/odometer)
│   ├── drivers/
│   │   ├── route.ts                 // GET (list drivers), POST (register driver)
│   │   └── [id]/
│   │       └── route.ts             // PUT (update driver details/license)
│   └── assignments/
│       ├── route.ts                 // GET (list assignments), POST (create assignment)
│       └── [id]/
│           └── route.ts             // DELETE (remove assignment)
├── subscriptions/
│   ├── route.ts                     // GET (filter subscriptions), POST (enroll student)
│   ├── bulk-bill/
│   │   └── route.ts                 // POST (generate invoice line items for active subscriptions)
│   └── [id]/
│       └── cancel/
│           └── route.ts             // POST (cancel subscription, credit adjustment)
├── manifests/
│   └── route.ts                     // GET (generate daily morning/evening passenger manifests)
├── expenses/
│   ├── fuel/
│   │   └── route.ts                 // GET (list fuel logs), POST (record fuel log + auto-expense)
│   └── maintenance/
│       ├── route.ts                 // GET (list maintenance logs), POST (record maintenance + auto-expense)
│       └── [id]/
│           └── void/
│               └── route.ts         // POST (void maintenance record + void linked expense)
└── reports/
    ├── profitability/
    │   └── route.ts                 // GET (route-by-route revenue vs fuel & maintenance P&L)
    └── fleet-efficiency/
        └── route.ts                 // GET (fuel economy km/L, cost/km, seat utilization)
```

---

## 5. UI COMPONENTS & USER INTERFACES

**Main Hub**: `/finance/transport`
- **Header**: Active Academic Year & Term selector, Quick Action (+ Add Route, + Register Vehicle, + Log Fuel, + Enroll Student).
- **Tab 1: Subscriptions & Rosters**:
  - Filter by Route, Class, Trip Type (`TWO_WAY`, `MORNING_ONLY`, `EVENING_ONLY`), and Status.
  - Active subscriber table with fee status, invoice link badge, and pickup stop.
  - Capacity usage indicator per route (e.g. `24 / 30 seats filled - 80%`).
  - Action buttons: "Print Daily Manifest", "Enroll Student", "Batch Bill to Invoices".
- **Tab 2: Routes & Stages Builder**:
  - Visual route cards displaying code, name, stops count, base fees, and assigned bus/driver.
  - Interactive stage builder: reorder stops, set pickup/dropoff times, configure stage surcharges.
- **Tab 3: Fleet & Drivers Directory**:
  - Grid of vehicle cards showing plate number, seating capacity, current odometer, roadworthiness status, and insurance badge.
  - Driver directory with license class, expiry alerts, and assigned vehicle.
  - Vehicle-Route assignment modal.
- **Tab 4: Fuel & Maintenance Operations**:
  - Quick-entry slide-over drawer for fuel pump slips with automatic calculation of total and expense voucher toggle.
  - Maintenance log viewer with service type filters and next service due mileage countdown.
- **Tab 5: Route Profitability & Analytics**:
  - Route P&L summary cards (Total Transport Billed, Fuel Costs, Maintenance Costs, Net Margin %).
  - Bar chart comparing route revenue vs expenses.
  - Vehicle efficiency table (Km/L, UGX/Km, Fleet Utilization).

---

## 6. TEST SPECIFICATION MATRIX

### 6.1 Unit Test Specifications (`src/lib/dao/transport.dao.test.ts`)
- **TRANS-01**: Create `TransportRoute` with stops and verify database persistence and unique code constraint.
- **TRANS-02**: Calculate effective transport fee correctly for `TWO_WAY` vs `ONE_WAY_MORNING` vs `ONE_WAY_EVENING` with stage surcharges.
- **TRANS-03**: Register `TransportVehicle` with capacity, status, and insurance details.
- **TRANS-04**: Register `TransportDriver` and verify license format and phone validation.
- **TRANS-05**: Create `VehicleRouteAssignment` and verify frozen snapshot fields (`vehiclePlateSnapshot`, `driverNameSnapshot`).
- **TRANS-06**: Enroll student in `StudentTransportSubscription` and verify frozen historical snapshots (`routeNameSnapshot`, `baseFeeSnapshot`, `finalFeeAmount`).
- **TRANS-07**: Verify capacity safeguard blocks enrollment when vehicle certified capacity is reached.
- **TRANS-08**: Authorize capacity override with valid administrative justification and audit logging.
- **TRANS-09**: Generate daily morning passenger manifest sorted by stop sequence order without duplicates.
- **TRANS-10**: Generate daily evening passenger manifest sorted by stop sequence order without duplicates.
- **TRANS-11**: Batch bill active transport subscriptions and verify generated `InvoiceItem` under `TRANSPORT_FEE`.
- **TRANS-12**: Verify billing idempotency prevents duplicate invoice items for already-billed subscriptions.
- **TRANS-13**: Cancel subscription mid-term and verify status transition and non-destructive credit adjustment.
- **TRANS-14**: Log vehicle fuel purchase, verify monetary match (`liters * unitPrice = totalCost`), and verify linked `ExpenseDAO` voucher.
- **TRANS-15**: Verify fuel log updates vehicle `currentOdometerKm`.
- **TRANS-16**: Log vehicle garage maintenance, verify `partsCost + laborCost = totalCost`, and verify linked `ExpenseDAO` voucher.
- **TRANS-17**: Void maintenance record and verify linked `Expense` is voided via `ExpenseDAO.voidExpense`.
- **TRANS-18**: Calculate route profitability accurately (Billed Revenue - Fuel Cost - Maintenance Cost).
- **TRANS-19**: Calculate vehicle fuel efficiency metrics accurately (Km per Liter, UGX per Km).
- **TRANS-20**: Verify strict multi-tenant branch isolation across routes, vehicles, subscriptions, and logs.

### 6.2 Adversarial Test Specifications (`src/lib/dao/transport.adversarial.test.ts`)
- **ADV-TRANS-01**: Changing route base fee mid-term does NOT mutate previously created student subscriptions or invoices.
- **ADV-TRANS-02**: Attempting duplicate subscription for same student, term, and route in same branch is rejected by unique constraint.
- **ADV-TRANS-03**: Concurrent subscription enrollment under heavy parallel load honors vehicle capacity limit without race condition overselling.
- **ADV-TRANS-04**: Fuel log with impossible backwards odometer reading (e.g. 100,000 km after 120,000 km) is rejected.
- **ADV-TRANS-05**: Duplicate fuel pump slip with identical station and receipt number in same branch is rejected.
- **ADV-TRANS-06**: Maintenance log with negative parts or labor costs is rejected.
- **ADV-TRANS-07**: Assigning vehicle with status `OUT_OF_SERVICE` or expired insurance is rejected.
- **ADV-TRANS-08**: Fuel/maintenance expense exceeding hard-stop budget ceiling in Phase 3.1G is blocked.
- **ADV-TRANS-09**: Attempting cross-branch vehicle-route assignment or student subscription throws multi-tenant authorization error.
- **ADV-TRANS-10**: Voiding an expense record does not alter immutable historical subscription fees or passenger manifests.

---

## 7. EXPLICIT OUT OF SCOPE

1. **Real-Time GPS Hardware / IoT Telematics**:
   - No OBD-II live satellite streaming hardware integrations. Odometer-based operational logging is standard across Ugandan schools.
2. **Driver Turn-by-Turn Mobile GPS Routing**:
   - Manifest generation provides structured passenger rosters; live traffic navigation is handled by external native navigation tools.
3. **Driver Payroll**:
   - Driver salary and allowance processing is managed authoritatively by Phase 3.1F `PayrollDAO`.
4. **Spare Parts Inventory & Warehousing**:
   - Garage parts costs are captured on maintenance logs; physical warehouse inventory management is out of scope.
5. **Third-Party Ride-Hailing Integrations**:
   - No commercial ride-hailing APIs (Uber/Bolt).
6. **Direct Oil Firm Corporate Fuel Cards**:
   - Fuel records capture verified pump station receipts and expense vouchers.

---

STATUS: READY FOR IMPLEMENTATION
