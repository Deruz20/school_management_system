# NOVA School Management ERP — Phase 3.2C Architectural Design
## Parent & Student Self-Service Portal + Multichannel Communications Engine

**Document Version:** 2.0.0  
**Date:** September 2026  
**Status:** DESIGN CHECKPOINT — SEALED & APPROVED  
**Baseline Git HEAD:** `0d48e4ffe2cc5dcfe850e8de6ea247fa1b7f61c6`  
**Prerequisites:** Phase 3.1A–3.1N (Double-Entry Finance & SchoolPay Core), Phase 3.2A (Admissions & Lifecycle), Phase 3.2B (Welfare, Hostels & Safety)  

---

## 1. Executive Summary & Core Architectural Principles

Phase 3.2C establishes the external stakeholder engagement tier for the NOVA School Management ERP:
1. **Parent & Guardian Self-Service Portal:** An authenticated, responsive web projection providing verified family members with live visibility into fee ledgers, official receipts, SchoolPay student codes, finalized academic report cards, attendance records, hostel allocations, sanitized health summaries, and digital exeat requests.
2. **Student Self-Service Portal:** A strictly scoped, age-gated dashboard allowing eligible students to inspect class timetables, attendance history, academic marks, and personal requirements.
3. **Provider-Agnostic Communications Engine & Transactional Outbox:** An asynchronous, reliable messaging pipeline (SMS, Email, In-App) utilizing PostgreSQL row-level locking (`FOR UPDATE SKIP LOCKED`) and the Transactional Outbox pattern to decouple notification delivery from ACID financial and academic transactions.

### Non-Negotiable Invariant: Pure Projection Layer
The portal is strictly an **authenticated, authorization-gated projection layer** over existing authoritative NOVA DAOs. It **never** creates duplicate or competing authorities for:
- Student (`Student`) & Academic Placement (`Enrollment`)
- Guardian Master Records (`Guardian`) & Links (`StudentGuardian`)
- Double-Entry General Ledger (`GLAccount`, `JournalEntry`, `FiscalPeriod`)
- Student Fee Subledger (`StudentLedgerEntry`, `LedgerDAO`), Invoices (`Invoice`, `InvoiceDAO`), & Payments (`Payment`, `PaymentDAO`)
- SchoolPay Gateway (`SchoolPayTransaction`, `SchoolPayDAO`)
- Daily Attendance (`DailyAttendanceRecord`, `AttendanceDAO`)
- Academic Grading (`TermResult`, `ReportDTOBuilder`) — strictly preserving the Jiddah Smart Report boundary
- Boarding & Bed Allocations (`HostelBed`, `BedAllocation`, `HostelDAO`)
- Clinical Encounters & Dispensary (`ClinicEncounter`, `InventoryDAO`, `ClinicDAO`)
- Behavioral Discipline (`DisciplinaryIncident`, `DisciplinarySanction`, `DisciplineDAO`)
- Exeat Gate Passes (`ExeatPass`, `ExeatDAO`)
- Class Requirements & Clearance (`StudentRequirementRecord`, `StudentClearanceDAO`)
- Transport Subscriptions (`StudentTransportSubscription`, `TransportDAO`)

---

## 2. Authentication & Session Architecture

### A. Unified Identity Model (No Parallel User Database)
NOVA's existing `User` model already supports `userType: UserType` (`STAFF`, `PARENT`, `STUDENT`). Phase 3.2C leverages the existing `User` table without introducing a second user repository:

```
+-------------------------------------------------------------------------+
|                               model User                                |
|-------------------------------------------------------------------------|
| id: String (cuid)                                                       |
| email: String? (@unique)                                                |
| phone: String? (@unique - E.164 normalized: +256...)                    |
| passwordHash: String                                                    |
| userType: UserType (STAFF | PARENT | STUDENT)                           |
| status: UserStatus (ACTIVE | SUSPENDED | PENDING_VERIFICATION)          |
| forcePasswordChange: Boolean                                            |
| guardianId: String? (FK -> Guardian.id, @unique)                        |
| studentId: String? (FK -> Student.id, @unique)                          |
+-------------------------------------------------------------------------+
                                 |
              +------------------+------------------+
              | 1:1                                 | 1:1
              v                                     v
     +-------------------+                 +-------------------+
     |  model Guardian   |                 |   model Student   |
     +-------------------+                 +-------------------+
```

#### Lifecycle, Uniqueness & Revocation Constraints:
- `User.guardianId` and `User.studentId` are **strict 1:1 unique foreign keys** (`@unique`). A Guardian or Student can map to at most one login account.
- **Account Provisioning:** Initiated when a Guardian is verified (`Guardian.isVerified === true`) with a validated primary phone, or when a Student is enrolled in an eligible class.
- **Account Revocation:**
  - If a Guardian is marked inactive or unlinked from all students, the associated `User.status` transitions immediately to `SUSPENDED`.
  - If a Student graduates, transfers out, or is expelled via `StudentLifecycleDAO.transitionStatus`, the student's `User.status` is automatically set to `SUSPENDED`.
  - Account suspension invalidates all active sessions in the database immediately upon the next request.

### B. OTP Security Implementation
To serve East African parents without reliance on email, the portal supports Phone OTP login alongside standard password login:

```
[ Guardian enters Phone (+256...) ]
                 │
                 ▼
[ Normalize Phone (E.164 via kyc-crypto) ]
                 │
                 ▼
[ Rate Limit Check: Max 3 requests / 15 mins ]
                 │
                 ▼
[ Generate 6-digit cryptographically secure OTP: crypto.randomInt(100000, 999999) ]
                 │
                 ▼
[ Hash OTP: HMAC-SHA256(otp, process.env.OTP_SECRET) ]
                 │
                 ▼
[ Store in PortalAuthOtp table: phone, otpHash, expiresAt (5m), attempts: 0, isConsumed: false ]
                 │
                 ▼
[ Dispatch Outbox SMS: "Your NOVA portal verification code is: 482910. Valid for 5 minutes." ]
                 │
                 ▼
[ Guardian Enters Code ] ──> Verify:
                             1. Not expired (now < expiresAt)
                             2. Not already consumed (isConsumed === false)
                             3. Timing-safe comparison of HMAC-SHA256(input, secret) == otpHash
                             4. Increment attempts (Max 5 attempts allowed)
                             5. On match: mark isConsumed = true, delete other active OTPs for phone
                             6. Issue session cookie via session.ts
```

- **No Plaintext OTP Storage:** Only HMAC-SHA256 hashes are persisted.
- **Replay Protection:** Setting `isConsumed: true` in an atomic database transaction prevents token replay attacks.
- **Attempt Lockout:** 5 incorrect guesses immediately burns the OTP challenge. 10 consecutive failed logins from an IP or phone triggers a 30-minute lockout.

### C. Session Management
- Reuses `src/lib/auth/session.ts` and `db.session`.
- Cookie parameters: `nova_session`, `httpOnly: true`, `secure: true` (in production), `sameSite: "lax"`, path `/`.
- Rolling 30-day expiration, invalidated instantly on logout or administrative revocation.

---

## 3. Guardian & Student Authorization Architecture

### A. Multi-Child Context Resolution & Child Switching
A guardian may have one child, several children, or children in different classes and streams:

```
[ Authenticated Guardian Session ]
                 │
                 ▼
[ Resolve Active Guardian: User.guardianId ]
                 │
                 ▼
[ Query Active Links: db.studentGuardian.findMany({ where: { guardianId, branchId } }) ]
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ Target Child Selection:                                │
│ 1. If only 1 student linked -> default to that student │
│ 2. If multiple students -> query parameter ?studentId= │
│ 3. Every API checks: StudentGuardian link EXISTS       │
└────────────────────────────────────────────────────────┘
```

**Cardinal Rule:** The active child selection **never** broadens or leaks permissions to another child. Every API call validates the target `studentId` against `StudentGuardian` for that specific child.

### B. Dynamic Relationship Invariants & Immediate Revocation
Portal features are strictly conditional on the flags in `StudentGuardian`:

| Feature Surface | Required Invariant on `StudentGuardian` | Behavior if Condition Fails |
|---|---|---|
| **Fee Ledger & Balance** | `isFinancialSponsor: true` OR `isPrimaryContact: true` | Returns `403 Forbidden`; UI financial widgets masked |
| **SchoolPay Code & Receipts** | `isFinancialSponsor: true` OR `isPrimaryContact: true` | Receipts hidden; SchoolPay code omitted |
| **Academic Report Cards** | `receivesAcademicReports: true` OR `isPrimaryContact: true` | Academic tab hidden; report downloads rejected |
| **Sanitized Health Log** | `isEmergencyContact: true` OR `isPrimaryContact: true` | Health tab hidden |
| **Exeat Requests** | `hasPickupAuthorization: true` OR `isPrimaryContact: true` | Exeat request form disabled; view-only mode |
| **SMS Broadcasts** | `receivesSmsAlerts: true` | Outbox worker skips phone for routine alerts |

**Relationship Change Propagation:**
- If school staff revokes a guardian's `isFinancialSponsor` flag in the administration module, the parent's next API request to `/api/portal/finance/balance` immediately returns `403 Forbidden`.
- If a guardian is deleted or unlinked from a student, all subsequent access to that student's records fails immediately (zero caching of relational authority).

### C. Student Portal Eligibility & Restricted Fields
- **Eligibility Engine:** Student portal access is governed by configuration, **not hard-coded string comparisons**.
  - A student is eligible if and only if:
    1. `Student.status === ACTIVE` and `Student.lifecycleStatus === ACTIVE`.
    2. Student has an active enrollment (`Enrollment.status === ACTIVE`).
    3. The student's assigned `Class` has `portalAccessEnabled: true` in `Class` or `BranchSettings` (configured by the school, e.g. for Secondary levels).
- **Explicit Restricted Fields for Students:**
  - **Financial Data:** Complete block. Students cannot view fee balances, ledgers, invoices, or arrears notices.
  - **Medical Data:** Complete block. Students cannot read clinical diagnoses, vital signs, or nurse emergency notes.
  - **Discipline Data:** Students can only view formal, closed sanctions issued to them. Internal investigation notes, committee minutes, and names of other students are blocked.
  - **Exeat Initiation:** Students cannot create, approve, or alter exeat passes.

---

## 4. SchoolPay Integration & Financial Capability Boundary

### A. Strict Examination of Existing Phase 3.1E Capability
Inspection of [`src/lib/dao/schoolpay.dao.ts`](file:///c:/Users/USER/Desktop/school_management_system/nova/src/lib/dao/schoolpay.dao.ts) and [`src/app/api/schoolpay/webhook/`](file:///c:/Users/USER/Desktop/school_management_system/nova/src/app/api/schoolpay/webhook/) confirms:
- Phase 3.1E provides an **inbound transaction staging, HMAC validation, and webhook reconciliation engine**.
- It provides:
  1. Automated SchoolPay Student Payment Code assignment (`student.schoolPayCode`).
  2. Webhook ingestion (`stageInboundTransaction`, `matchAndProcessTransaction`, `postTransaction`).
  3. FIFO invoice settlement and receipt creation via `PaymentDAO`.
- **CRITICAL ARCHITECTURAL FINDING:** The existing SchoolPay contract **DOES NOT support outbound STK Push or programmatic payment initiation**. SchoolPay Uganda operates via push-payments initiated by the subscriber via USSD (`*165#` / `*185#`) or bank counters, which then post webhooks back to NOVA.

### B. Exact Portal Financial Contract
In strict compliance with the architectural directive:
1. **Self-Service Online Payment Initiation is OUT OF SCOPE.** The portal does not invent an STK push API or payment gateway.
2. **Display of Authoritative SchoolPay Instructions:** The portal displays:
   - Student's unique 10-digit SchoolPay Registration Code.
   - Step-by-step payment instructions for MTN Mobile Money, Airtel Money, and Partner Banks (Stanbic, Centenary, PostBank).
3. **Inbound Payment Confirmation:** Payments made by parents via mobile money or bank counters continue to flow through the sealed Phase 3.1E webhook pipeline. Once processed, the portal reflects the updated balance and newly issued receipt automatically.
4. **Authoritative Balance Projection:** Fee balances are read strictly via [`LedgerDAO.getBalance(ctx, studentId)`](file:///c:/Users/USER/Desktop/school_management_system/nova/src/lib/dao/ledger.dao.ts#L120-L157). Matches GL Control Account #1200 (`Accounts Receivable - Student Fees`) exactly.
5. **No Internal Ledger Leakage:** The portal projection filters out internal GL account numbers, journal entry IDs, voucher numbers, and staff creator IDs.

---

## 5. Welfare, Health & Disciplinary Privacy Model

### A. Boarding Visibility
- **Visible to Guardian:** Hostel Name, Dormitory Room Number, Bed Code (e.g. `LUM-102-B1`), Matron/Warden name and contact, Nightly Roll-Call attendance status (`PRESENT`, `ABSENT`, `SICKBAY`, `AUTHORIZED_ABSENCE`).
- **Hidden:** Other students sharing the dormitory; room maintenance scores.

### B. Clinic & Health Privacy (Uganda DPPA 2019 Compliance)
Health records require rigorous data minimization:
- **Visible to Authorized Guardian (`isEmergencyContact` or `isPrimaryContact`):**
  - Visit timestamp and check-in time.
  - Triage priority badge (`ROUTINE`, `URGENT`, `EMERGENCY`).
  - Attending nurse name.
  - Sickbay admission status (bed number, admission timestamp, discharge status).
  - External hospital referral destination and ambulance dispatch confirmation.
  - Recorded allergy list (for verification by the parent).
- **Strictly Redacted:**
  - AES-256-GCM encrypted symptoms, clinical consultation notes, and diagnoses are **never returned to the portal**.
  - Internal medication inventory stock IDs and drug costings are masked.

### C. Disciplinary Governance Privacy
- **Visible to Guardian:** Concluded sanctions (`DETENTION`, `COMMUNITY_SERVICE`, `SUSPENSION`, `EXPULSION`), prescribed start and end dates, formal sanction terms, and total active demerit points.
- **Strictly Redacted:** Investigative witness statements, hearing minutes, staff panel discussion notes, and identities/roles of any other students involved.

---

## 6. Exeat Self-Service Architecture

Inspection of [`ExeatDAO`](file:///c:/Users/USER/Desktop/school_management_system/nova/src/lib/dao/exeat.dao.ts) dictates the exact portal contract without bypassing school governance:

```
[ 1. Guardian Portal Form ]
       │
       ▼ Calls ExeatDAO.requestExeat(ctx, input)
       │ - Sets guardianConsent = true
       │ - Sets guardianConsentMethod = "PORTAL_DIGITAL_AUTH"
       │ - Generates 48-char qrVerificationToken
       │ - Status is ALWAYS: PENDING
       │
[ 2. School Staff Administration ]
       │
       ▼ Authorized Staff calls ExeatDAO.approveExeat(staffCtx, exeatId)
       │ - Status transitions to: APPROVED
       │ - Generates outbox notification to Guardian
       │
[ 3. Guardian / Student Mobile Screen ]
       │
       ▼ Renders High-Contrast QR Pass (from qrVerificationToken)
       │
[ 4. School Gate Verification Terminal ]
       │
       ▼ Gate Officer calls ExeatDAO.gateCheckout(gateCtx, { qrVerificationToken })
       │ - Status transitions to: DEPARTED
       │
       ▼ Gate Officer calls ExeatDAO.gateCheckin(gateCtx, { qrVerificationToken })
         - Status transitions to: COMPLETED (flags isOverdue if late)
```

- **Guarantees:** The portal **cannot approve** an exeat pass. Approval is exclusively an administrative staff action (`exeat:approve`). Gate departure and arrival are exclusively gate officer actions (`exeat:gate`).

---

## 7. Provider-Agnostic Communications Engine & Transactional Outbox

### A. Architecture & Eliminating Vendor Lock-in
The messaging subsystem is completely **vendor-neutral**. Vendor selection (Africa's Talking, Twilio, AWS SNS, etc.) is handled via environment configuration, **not architectural hard-coding**.

```
                           +------------------------+
                           |  NotificationOrchestrator  |
                           +------------------------+
                                       |
                                       v
                           +------------------------+
                           |   NotificationOutbox   |
                           +------------------------+
                                       |
                                       v
                          (Worker: NotificationRunner)
                                       |
               +-----------------------+-----------------------+
               |                       |                       |
               v                       v                       v
      +-----------------+     +-----------------+     +-----------------+
      |  SmsProvider    |     |  EmailProvider  |     |  MockProvider   |
      |  (e.g. AT/Twilio)|    |  (e.g. Resend)  |     |  (Test & CI)    |
      +-----------------+     +-----------------+     +-----------------+
```

### B. Core Provider Interfaces
```typescript
export interface SmsDeliveryResult {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  costUgx?: number;
}

export interface SmsProvider {
  readonly providerName: string;
  sendSms(to: string, messageText: string, idempotencyKey: string): Promise<SmsDeliveryResult>;
}

export interface EmailDeliveryResult {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}

export interface EmailProvider {
  readonly providerName: string;
  sendEmail(to: string, subject: string, htmlBody: string, idempotencyKey: string): Promise<EmailDeliveryResult>;
}
```

### C. Queue Implementation (Database Outbox with Row Locking)
Inspection of the repository confirms **no external queue (Redis/BullMQ/RabbitMQ) is present**. 
NOVA implements a durable, dependency-free queue via PostgreSQL:

```prisma
enum NotificationChannel {
  SMS
  EMAIL
  IN_APP
}

enum NotificationStatus {
  PENDING
  PROCESSING
  DELIVERED
  FAILED
  CANCELLED
}

model NotificationOutbox {
  id               String               @id @default(cuid())
  branchId         String
  recipientType    String               // GUARDIAN | STUDENT | STAFF
  recipientId      String
  destination      String               // Phone number or Email
  channel          NotificationChannel  @default(SMS)
  templateCode     String
  templateVersion  Int                  @default(1)
  payloadJson      String               // Variable interpolation JSON
  status           NotificationStatus   @default(PENDING)
  retryCount       Int                  @default(0)
  maxRetries       Int                  @default(3)
  nextRetryAt      DateTime             @default(now())
  deliveredAt      DateTime?
  providerName     String?
  providerRef      String?
  errorMessage     String?
  idempotencyKey   String               @unique
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  branch           Branch               @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@index([branchId, status, nextRetryAt])
  @@index([recipientId, createdAt])
}
```

#### Outbox Worker Polling Semantics:
```sql
-- Safe multi-worker concurrency without collisions:
SELECT * FROM "NotificationOutbox"
WHERE status = 'PENDING' AND "nextRetryAt" <= NOW()
ORDER BY "createdAt" ASC
LIMIT 50
FOR UPDATE SKIP LOCKED;
```
- **Idempotency & Deduplication:** The `idempotencyKey` field enforces unique message generation per event (e.g., `INVOICE_BILLING:INV-2026-0001:GUARDIAN-123`).
- **Retry Schedule:** 1st failure: retry in 1 minute; 2nd failure: retry in 5 minutes; 3rd failure: retry in 15 minutes. Beyond 3 failures, status transitions to `FAILED`.

### D. Notification Consent & Emergency Overrides
Guardians configure communication preferences in `NotificationPreference`:
- `smsAlertsEnabled: Boolean`
- `emailAlertsEnabled: Boolean`
- **Emergency Invariant:** Life-safety notifications (`CLINIC_EMERGENCY_ADMISSION`, hospital referrals, school-wide security alerts) **strictly bypass** opt-out flags and are always queued.

---

## 8. Document Access & Time-Limited Retrieval

Guardians and eligible students can retrieve official scholastic documents:
1. **Academic Report Cards:** Rendered using the existing `ReportDTOBuilder.buildForTermResult` without touching Jiddah. Only accessible if `termResult.isFinalized === true`.
2. **Official Payment Receipts:** Rendered from `PaymentDAO` receipts.
3. **Student Clearance Certificates:** Rendered from `StudentClearanceDAO` only when status is `CLEARED`.

#### Security Invariant for Documents:
- **No permanent public storage URLs or exposed S3/GCS keys.**
- Documents are streamed via authorized API endpoints (e.g. `/api/portal/documents/report-card/[termResultId]`) that authenticate the caller's session, verify the `StudentGuardian` link, verify that the document belongs to the active branch, and log the download in `AuditLog`.

---

## 9. Security Threat Model & Protections

| Threat Vector | Attack Scenario | Implemented Defense |
|---|---|---|
| **IDOR** | Guardian modifies query param `?studentId=...` to inspect another child's records | `requirePortalGuardian` validates that the caller has an active `StudentGuardian` link for that exact student in `ctx.branchId`. Rejects with `403 Forbidden` and logs security audit. |
| **Cross-Branch Leakage** | Guardian in Branch A attempts to access student enrolled in Branch B | Query filters enforce `branchId: ctx.branchId` on every join and lookup. |
| **Credential Stuffing** | Automated script guessing guardian passwords | IP rate limiting (20 req/min) + Account lockout after 10 consecutive failures. |
| **OTP Brute Force** | Guessing 6-digit numeric OTP | Max 5 attempts per OTP; OTP challenge invalidated after 5th failure. |
| **OTP Replay** | Re-submitting an already used OTP | `isConsumed: true` flag updated atomically inside transaction. |
| **Document Scraping** | Guessing sequential IDs for report cards or receipts | Endpoints check relationship authority on every single request. |
| **Ledger Tampering** | Submitting POST/PATCH payloads to alter fee amounts | Financial portal endpoints are strictly read-only; no write routes exist. |
| **XSS & CSRF** | Cross-site request forgery against portal session | SameSite `lax` HTTP-only cookies; JSON-only mutation endpoints; React auto-escaping. |

---

## 10. AuditService Event Catalog

Every portal operation generates an immutable `AuditLog` entry:

| Event Action | Resource Type | Trigger Condition |
|---|---|---|
| `portal.guardian_login` | `User` | Successful password or OTP login |
| `portal.login_failed` | `User` | Failed password or OTP challenge |
| `portal.otp_requested` | `PortalAuthOtp` | Generation and dispatch of phone OTP |
| `portal.child_switched` | `Student` | Guardian toggles active child |
| `portal.ledger_viewed` | `StudentLedgerEntry` | Inspection of fee balance and statement |
| `portal.receipt_downloaded` | `Payment` | Download of payment receipt PDF |
| `portal.report_downloaded` | `TermResult` | Download of finalized report card |
| `portal.clinic_summary_viewed` | `ClinicEncounter` | Viewing student infirmary visit log |
| `portal.discipline_viewed` | `DisciplinarySanction` | Viewing formal disciplinary sanction |
| `portal.exeat_requested` | `ExeatPass` | Guardian submits new exeat request |
| `portal.preferences_updated` | `NotificationPreference`| Changes to SMS/email alert settings |
| `portal.security_violation` | `Security` | IDOR or unauthorized access attempt blocked |

---

## 11. Source-of-Truth Matrix

| Portal Feature | Authoritative Entity / DAO | Mode | Authorization Check | Sensitive Data? | Audit Event | Integration |
|---|---|:---:|---|:---:|---|---|
| **Child Overview** | `Student`, `Enrollment` | Read | `StudentGuardian` active link | Yes | `portal.student_viewed` | None |
| **Fee Balance** | `LedgerDAO.getBalance` | Read | `isFinancialSponsor` / Primary | Yes | `portal.ledger_viewed` | None |
| **SchoolPay Code** | `Student.schoolPayCode` | Read | `isFinancialSponsor` / Primary | No | `portal.schoolpay_viewed` | Phase 3.1E |
| **Payment Receipts** | `PaymentDAO`, `InvoiceDAO` | Read | `isFinancialSponsor` / Primary | Yes | `portal.receipt_downloaded`| None |
| **Attendance** | `AttendanceDAO` | Read | Linked Guardian | No | `portal.attendance_viewed` | None |
| **Report Cards** | `ReportDTOBuilder` | Read | `receivesAcademicReports` | Yes | `portal.report_downloaded`| Jiddah DTO |
| **Hostel & Bed** | `HostelDAO` | Read | Linked Guardian | No | `portal.hostel_viewed` | None |
| **Sanitized Health** | `ClinicDAO` | Read | `isEmergencyContact` / Primary | **High** | `portal.clinic_viewed` | None |
| **Discipline Notices**| `DisciplineDAO` | Read | Primary Guardian | **High** | `portal.discipline_viewed`| None |
| **Exeat Requests** | `ExeatDAO.requestExeat` | Write | `hasPickupAuthorization` | Yes | `portal.exeat_requested` | SMS Outbox |
| **Active Exeat QR** | `ExeatDAO` | Read | Linked Guardian | Yes | `portal.exeat_qr_viewed` | Gate QR |
| **Requirements** | `RequirementsDAO` | Read | Linked Guardian | No | `portal.requirements_viewed`| None |
| **Transport** | `TransportDAO` | Read | Linked Guardian | No | `portal.transport_viewed`| None |
| **Outbox Message** | `NotificationOutbox` | Write | Transaction Trigger | Yes | `comms.message_queued` | Outbox Worker |

---

## 12. Migration & Safe Onboarding Strategy

### A. Zero-Disruption Schema Migration
- Add `guardianId` and `studentId` onto `model User` as unique nullable foreign keys.
- Add `model PortalAuthOtp` and `model NotificationOutbox`.
- Add `model NotificationPreference`.
- No modifications to existing financial, academic, or welfare tables.

### B. Safe User Onboarding Pipeline
1. **Verified Guardians (`Guardian.isVerified === true`):** An onboarding job creates a linked `User` record (`userType: PARENT`, `status: ACTIVE`) for guardians with a valid primary phone number. Initial password is unconfigured; parent logs in via Phone OTP.
2. **Provisional / Unverified Guardians:** Excluded from portal access until staff completes KYC verification via `GuardianDAO.verifyGuardian`.
3. **Legacy PARENT / STUDENT Users:** Existing user records from early pilots are mapped to their corresponding `Guardian` or `Student` IDs without privilege escalation.

---

## 13. Test Strategy & Verification Matrix

### A. Unit & Functional Test Suite (`src/lib/dao/portal.dao.test.ts`)
- `PORTAL-01`: Guardian authentication via phone + OTP with E.164 normalization.
- `PORTAL-02`: Multi-child family profile switching with isolated context resolution.
- `PORTAL-03`: Role-flag filtering (`isFinancialSponsor`, `receivesAcademicReports`, `hasPickupAuthorization`).
- `PORTAL-04`: Financial ledger projection reconciles exactly with GL #1200 subledger.
- `PORTAL-05`: Jiddah report card download loads finalized `ReportDTO` with zero grade recalculation.
- `PORTAL-06`: Exeat request initiation creates `PENDING` pass with valid `qrVerificationToken`.
- `PORTAL-07`: Notification outbox queue insertion, template parameter interpolation, and worker dispatch.

### B. Adversarial & Security Test Suite (`src/lib/dao/portal.adversarial.test.ts`)
- `ADV-PORTAL-01`: Cross-family IDOR — Guardian A querying Student B returns `403 Forbidden` and audits security event.
- `ADV-PORTAL-02`: Cross-branch tenant isolation — Guardian in Branch 1 cannot access Branch 2 records.
- `ADV-PORTAL-03`: OTP brute-force rejection — Token burns after 5 failed attempts; account lockout after 10.
- `ADV-PORTAL-04`: OTP replay prevention — Consumed OTP cannot be re-used to issue session.
- `ADV-PORTAL-05`: Revoked relationship cutoff — Removing guardian from `StudentGuardian` cuts off access immediately.
- `ADV-PORTAL-06`: Clinical note redaction — Portal queries strictly redact encrypted symptoms and clinical notes.
- `ADV-PORTAL-07`: Direct ledger mutation prevention — Portal APIs reject any write attempt to `StudentLedgerEntry` or `Invoice`.
- `ADV-PORTAL-08`: Outbox worker idempotency & duplicate prevention — Identical `idempotencyKey` skips duplicate dispatch.
- `ADV-PORTAL-09`: Provider failure & exponential backoff — Outbox worker handles network errors and retries successfully.
- `ADV-PORTAL-10`: Emergency notification override — Emergency alerts bypass SMS opt-out preferences.

### C. Playwright End-to-End Suite (`tests/portal.spec.ts`)
- `E2E-PORTAL-01`: Mobile-viewport guardian login, child switching, and fee statement view.
- `E2E-PORTAL-02`: Exeat pass submission, staff dashboard approval, and QR pass rendering.
- `E2E-PORTAL-03`: Report card view and download workflow.

---

## 14. Resolution of All Open Architectural Decisions

1. **SchoolPay Payment Initiation:** **RESOLVED: DEFERRED & EXCLUDED FROM PORTAL WRITES.** The existing SchoolPay integration operates via inbound webhooks and USSD push-payments. The portal will display the student's unique SchoolPay code and instructions, relying entirely on existing Phase 3.1E webhook infrastructure.
2. **Communications Vendor Choice:** **RESOLVED: VENDOR-NEUTRAL DEPLOYMENT CONFIGURATION.** Implemented via `SmsProvider` and `EmailProvider` interfaces. System supports any provider (Africa's Talking, Twilio, Resend, Mock) via runtime config without code changes.
3. **Queue Architecture:** **RESOLVED: POSTGRESQL OUTBOX WITH `SKIP LOCKED`.** No Redis or BullMQ required; durable, transactional, and concurrency-safe.
4. **Student Eligibility:** **RESOLVED: CONFIGURATION-DRIVEN.** Governed by `Class.portalAccessEnabled` and `Student.lifecycleStatus === ACTIVE`, avoiding brittle hard-coded class names.

---

## 15. Implementation Readiness Declaration

- **Closed Financial Phases 3.1A–3.1N:** **100% PRESERVED**. All financial queries are read-only projections matching GL Account #1200.
- **Admissions & Lifecycle 3.2A:** **100% PRESERVED**. Utilizes existing `Guardian`, `StudentGuardian`, and `StudentLifecycleLog` records.
- **Welfare & Hostels 3.2B:** **100% PRESERVED**. Interacts seamlessly with `HostelDAO`, `ClinicDAO`, `DisciplineDAO`, and `ExeatDAO`.
- **Jiddah Smart Report Engine:** **100% PRESERVED**. Strictly consumes read-only `ReportDTOBuilder`.

**READY FOR IMPLEMENTATION: YES**
