# NOVA School Management ERP — Next Phase Roadmap Discovery
## Architectural & Product Discovery: Post-Phase 3.2B Evaluation

**Document Version:** 2.0.0  
**Date:** September 2026  
**Status:** COMPLETED & SEALED  
**Baseline Git HEAD:** `0d48e4ffe2cc5dcfe850e8de6ea247fa1b7f61c6`  
**Current Closed Modules:** Finance 3.1A–3.1N, Admissions & Lifecycle 3.2A, Welfare & Boarding 3.2B, Portals & Access 3.2C  

---

## A. Current System Maturity

NOVA has reached an enterprise-grade level of operational and financial maturity across three foundational pillars:

### 1. Complete Double-Entry Financial Engine (Phases 3.1A–3.1N)
- **Billing & Subledgers (3.1A–3.1D):** Multi-component fee structures, bulk invoicing, student discounts, FIFO payment allocation, subledger auditing, and receipt generation.
- **Automated Payment Gateways (3.1E):** SchoolPay Uganda real-time webhook ingestion, HMAC validation, and automated student code reconciliation.
- **Institutional Compensation & Controls (3.1F, 3.1G):** Maker-checker staff payroll, statutory deductions (NSSF/PAYE/LST), and vote-head budget variance control.
- **Operations & Logistics (3.1H, 3.1I, 3.1J):** Requirements blueprints and monetize-to-AR engine; fleet routes, stops, and term transport subscriptions; multi-store inventory with WAC stock movements.
- **Treasury, AP & General Ledger (3.1K–3.1N):** Multi-account treasury cashbook, bank statement reconciliation, supplier 3-way matching (PO/GRN/Invoice), fixed asset depreciation, and double-entry General Ledger anchored strictly by **GL #1200 (`Accounts Receivable - Student Fees`)**.

### 2. Admissions, Student Lifecycle & Guardian KYC (Phase 3.2A)
- **Applicant Intake Pipeline:** Inquiries, applications, assessment rubrics, 4-eye offer issuance, and single-click student onboarding with retryable asynchronous provisioning.
- **Guardian Registry & KYC Security:** Family grouping, multi-role links (Primary, Financial, Emergency, Pickup), AES-256-GCM encryption for national IDs, and HMAC-SHA256 blind indexing.
- **Finite-State Machine Lifecycle:** Authoritative transitions (`PROSPECTIVE` → `ENROLLED` → `ACTIVE` → `SUSPENDED` / `EXPELLED` / `TRANSFERRED_OUT` / `GRADUATED`), immutable transition logs, and fee debt clearance enforcement.
- **Student 360 Profile Dossier:** Unified demographic, guardian, academic enrollment, billing, clearance, and lifecycle view.

### 3. Student Welfare, Boarding, Clinic & Discipline Engine (Phase 3.2B)
- **Hostels & Dormitory Management:** Concurrency-safe bed allocations (`SELECT ... FOR UPDATE`), deadlock-free room transfers, nightly roll calls, and physical clearance damage surcharges debited to Student AR #1200.
- **Infirmary & Clinical Encounters:** Triage vitals tracking, AES-256-GCM encrypted notes and diagnoses with role-based redaction (`clinic:medical_records`), dispensary inventory issues (`DEPARTMENT_ISSUE`, WAC) with student allergy rejection guards, sickbay admissions, and hospital referrals.
- **Disciplinary Governance:** Incident logging, formal hearings, demerits, server-side maker-checker approvals, and authoritative lifecycle status transitions (`SUSPENDED`, `EXPELLED`, and reinstatement to `ACTIVE`).
- **Exeat Passes & Gate Controls:** Guardian consent verification, 48-character cryptographic QR verification tokens, gate checkout (`DEPARTED`) and checkin (`COMPLETED`), and automated overdue tracking.
- **Emergency Call Logs:** Audit trails of emergency guardian phone communications.

---

## B. Remaining Product Gaps

Despite the deep back-office and administration capabilities now live in NOVA, significant gaps remain in external stakeholder engagement, scheduling, and academic specialization:

1. **Parent & Student Self-Service Portals (High Impact Gap):**
   - Guardians are registered with phone numbers and KYC data, but have no web access to check live fee balances, view SchoolPay payment codes, track receipts, view report cards, or submit digital exeat authorizations.
   - Parents must physically travel to the bursar or make phone calls for basic administrative queries.
2. **Multichannel Communication & Automated Notifications:**
   - No SMS gateway integration (e.g., Africa's Talking / Twilio) or automated notification queue to send emergency alerts, exeat approval notifications, fee reminder SMS blasts, or attendance alerts.
3. **Academic Timetabling & Teacher Conflict Resolution:**
   - Classes, streams, subjects, and teachers exist, but there is no automated period scheduler, master room allocation, or clash detection engine.
4. **National Examination & CBC Continuous Assessment Governance:**
   - No dedicated UNEB candidate registration (PLE / UCE / UACE), index numbering, continuous assessment project score submission, or center examination analytics.
5. **Library & Scholastic Textbook Asset Circulation:**
   - Textbooks are managed as bulk inventory in stores, but there is no individual ISBN barcode circulation, patron borrowing, or overdue book fine tracking.

---

## C. Evaluation of Candidate Next Phases

We evaluate four major candidate phases against business value, user impact, architectural importance, cross-module synergy, complexity, and risk:

### Candidate 1: Phase 3.2C — Parent & Student Self-Service Portal + Multichannel Communications
- **Domain:** Guardian portal, student portal, live fee balances, SchoolPay code display, report card downloads (via Jiddah DTO), attendance/hostel summaries, exeat consent submission, SMS/Email notification queue, and communication audit logs.
- **Business Value:** **CRITICAL** (Directly impacts 100% of paying parents and guardians; eliminates bursar counter congestion).
- **User Impact:** **MAXIMUM** (Transforms NOVA from a staff-only back-office tool into a connected community platform).
- **Architectural Importance:** **HIGH** (Consumes and exposes 3.1A–3.1N, 3.2A, and 3.2B data surfaces without modifying closed core logic).
- **Complexity:** Medium-High.
- **Risk:** Low-Medium (Read-heavy, isolated portal authentication scope).

### Candidate 2: Phase 3.2D — Academic Timetable, Room Allocation & Teacher Collision Engine
- **Domain:** Timetable grids, periods, double periods, room/lab bookings, teacher clash detection, teacher workload distribution, substitute assignment.
- **Business Value:** Medium-High (Internal school scheduling efficiency).
- **User Impact:** Medium (Teachers and Director of Studies).
- **Architectural Importance:** Medium (Relies on existing Curriculum and Staff models).
- **Complexity:** Very High (Combinatorial optimization, constraint-satisfaction graph solver).
- **Risk:** High (Algorithmic complexity, performance hazards during schedule compilation).

### Candidate 3: Phase 3.2E — National Examination Governance / UNEB / CBC Analytics
- **Domain:** Candidate registration (PLE, UCE, UACE), candidate index numbers, center number allocation, continuous assessment (CBC) project portfolios, UNEB e-registration XML/CSV export, mock examination comparative analytics.
- **Business Value:** Medium-High (Critical for candidate classes P7, S4, S6; seasonal).
- **User Impact:** Medium (Examination officer, candidate students).
- **Architectural Importance:** Medium (Extends existing grading and assessment subsystems).
- **Complexity:** Medium.
- **Risk:** Low.

### Candidate 4: Phase 3.2F — Library & Textbook Asset Management
- **Domain:** Book cataloging (ISBN, Dewey Decimal), individual barcode tracking, patron checkout/checkin, reservation queues, overdue fine invoicing (via Student AR #1200), and annual book audit.
- **Business Value:** Medium.
- **User Impact:** Medium-Low (Librarian, borrowing students).
- **Architectural Importance:** Low-Medium (Extends inventory concepts to individual serialized assets).
- **Complexity:** Low-Medium.
- **Risk:** Low.

---

## D. Ranking of Candidates

| Rank | Candidate Phase | Business Value | User Impact | Architectural Fit | Cross-Module Synergy | Complexity | Risk | Overall Score |
|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1** | **Phase 3.2C — Parent & Student Portal + Communications** | **CRITICAL** | **MAXIMUM** | **EXCELLENT** | **MAXIMUM** (Finance, Academics, Welfare) | Medium-High | Low-Medium | **9.8 / 10** |
| **2** | **Phase 3.2D — Timetable & Conflict Engine** | HIGH | MEDIUM | GOOD | LOW-MEDIUM (Curriculum only) | VERY HIGH | HIGH | **7.5 / 10** |
| **3** | **Phase 3.2E — National Examination & CBC Analytics** | MEDIUM-HIGH | MEDIUM | GOOD | MEDIUM (Academics, Clearance) | MEDIUM | LOW | **7.4 / 10** |
| **4** | **Phase 3.2F — Library & Textbook Asset Management** | MEDIUM | LOW-MEDIUM | FAIR | MEDIUM (Stores, Inventory, Invoicing) | LOW-MEDIUM | LOW | **6.5 / 10** |

---

## E. Recommended Next Phase

### **RECOMMENDED: Phase 3.2C — Parent & Student Self-Service Portal + Multichannel Communications Engine**

Select **Phase 3.2C** as the immediate next phase.

---

## F. Why Phase 3.2C Wins

1. **Unlocks Value from All Prior Phases:**
   - Over 25 closed phases (3.1A–3.1N, 3.2A, 3.2B) have accumulated rich operational data: ledger balances, SchoolPay payment codes, invoices, receipts, report cards, class attendance, hostel allocations, clinic triage visits, and exeat passes.
   - Without Phase 3.2C, none of this information reaches parents electronically. Phase 3.2C is the customer-facing interface that exposes these capabilities directly to guardians.
2. **Drastically Reduces Administrative Overhead & Fee Collection Friction:**
   - By giving parents real-time visibility into their SchoolPay registration code, outstanding fee balances, and payment receipts, schools experience significantly higher and faster fee collection rates.
   - Eliminates repetitive inquiries to the bursary and admissions office.
3. **Safe, Read-Heavy Architectural Footprint:**
   - The Portal is fundamentally an authenticated, read-heavy projection layer over existing authoritative DAOs (`InvoiceDAO`, `StudentLedgerDAO`, `ReportDTOBuilder`, `AttendanceDAO`, `HostelDAO`, `ClinicDAO`, `ExeatDAO`).
   - It requires zero mutation of closed financial rules, preserving GL #1200, WAC costing, and Jiddah Smart Report boundaries.
4. **Digitizes the Exeat & Gate-Pass Loop:**
   - In Phase 3.2B, exeat requests require guardian consent. Phase 3.2C provides the exact mechanism for guardians to view, approve, or request exeat passes directly from their mobile phone or portal session.

---

## G. Proposed Scope (Phase 3.2C)

1. **Portal Identity & Authentication:**
   - Phone number and OTP/Password authentication for guardians linked via `StudentGuardian`.
   - Role-based portal session isolation (Guardians can only access students explicitly linked to them in `StudentGuardian`; students can only view their own records).
   - Rate-limited login and session management.
2. **Guardian Dashboard & Student 360 View:**
   - Child switcher for parents with multiple children enrolled in the school.
   - Real-time fee balance widget with SchoolPay student code, payment instructions, and downloadable PDF receipts/statements.
   - Requirements checklist view (items brought vs pending vs monetized).
   - Academic report card viewer (integrating directly with existing `ReportDTOBuilder` without touching Jiddah).
   - Daily attendance history and hostel roll-call attendance calendar.
   - Welfare summary: exeat request history, active exeat pass QR code, sickbay visit notifications, and disciplinary demerit log.
3. **Interactive Guardian Requests:**
   - Digital Exeat Request initiation by guardian with pickup person designation.
   - Medical notes and allergy update requests (subject to nurse review).
4. **Multichannel Communication & SMS Gateway Integration:**
   - Provider-agnostic SMS gateway abstraction (`SmsProvider` interface) supporting Africa's Talking, Twilio, and a local mock provider for testing.
   - Message templates (Fee Reminder, Emergency Alert, Exeat Authorized, Report Card Released, General Announcement).
   - Asynchronous message dispatch queue with retry policies, failure handling, and delivery receipt tracking.
   - Strict guardian communication audit log with tenant isolation (`branchId`).

---

## H. Out of Scope

- Self-service payment processing via credit card or Stripe (SchoolPay Uganda remains the authoritative payment channel; portal provides SchoolPay codes and instructions).
- Teacher-parent direct real-time instant messaging/chat (formal broadcast notifications and school announcements only).
- Direct mutation of academic results, marks, or financial ledger balances from the portal.
- Timetabling or exam indexing (reserved for subsequent phases).

---

## I. Dependencies

- `StudentGuardian` model and KYC records from Phase 3.2A.
- Financial subledgers, invoices, receipts, and SchoolPay mapping from Phases 3.1B, 3.1C, and 3.1E.
- Jiddah Smart Report DTO builder (`src/lib/dto/report.dto.ts`).
- Welfare exeat, hostel, and clinic DAOs from Phase 3.2B.
- `AuditService` from core architecture.

---

## J. Migration & Data Risks

- **Risk:** Existing guardians might have duplicate or non-standard phone numbers.
  - *Mitigation:* E.164 phone number normalization and verification check during portal onboarding; fallback to OTP email verification.
- **Risk:** Leaking student data between separated parents or unauthorized guardians.
  - *Mitigation:* Strict server-side verification that `StudentGuardian.relationshipType` has `isPrimaryContact: true` or explicit portal access permission enabled.

---

## K. RBAC, Security & Audit

- Dedicated portal role `PORTAL_GUARDIAN` and `PORTAL_STUDENT` with restrictive permissions completely segregated from internal school staff roles.
- Strict tenant context enforcement: every portal API call binds to `branchId` and filters `studentId` against authenticated guardian relationships.
- All outbound SMS and portal logins logged in `AuditLog`.

---

## L. Reporting Requirements

- Guardian Portal Adoption & Active Session Metrics (by class and stream).
- SMS Delivery & Cost Consumption Report (messages sent, delivered, failed, credits consumed).
- Fee Collection Impact Telemetry (comparison of collection velocity for portal-active vs inactive families).

---

## M. Test Strategy

1. **Unit Tests (`src/lib/dao/portal.dao.test.ts`):**
   - Guardian phone authentication and OTP generation/verification.
   - Multi-child switching and student data boundary isolation.
   - SMS queue processing and template variable interpolation.
2. **Adversarial Tests (`src/lib/dao/portal.adversarial.test.ts`):**
   - IDOR prevention: guardian attempting to access a student not linked in `StudentGuardian`.
   - Brute-force OTP rejection and rate-limiting.
   - Cross-branch portal isolation.
3. **Playwright E2E Tests (`tests/portal.spec.ts`):**
   - Guardian login flow, student switcher, fee statement download, exeat request, and report card view.

---

## N. Likely Roadmap After Phase 3.2C

1. **Phase 3.2D:** Academic Timetable, Room Allocation & Teacher Collision Engine
2. **Phase 3.2E:** National Examination Governance, UNEB Registration & CBC Analytics
3. **Phase 3.2F:** Library & Serialized Textbook Asset Management
