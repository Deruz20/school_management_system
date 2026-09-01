# NOVA Architectural Decisions (ADR)

## 1. Authentication Layer
**Decision**: Use a custom first-party database-backed session model instead of third-party libraries (Lucia, NextAuth, Clerk).
**Rationale**: Enhances control, removes dependency bloat, and aligns with the strict security requirements of school management software. Middleware handles lightweight routing checks, while `requireAuth()` handles strict server-side validation.
**Verification Result**: [PASS] Playwright test proves successful login, logout invalidation, and strict unauthorized rejection. 

## 2. Tenant Isolation
**Decision**: Enforce tenant boundaries exclusively on the server at the DAO (Data Access Object) layer, using a strictly verified `TenantContext`.
**Rationale**: Client-provided tenant IDs (e.g., in URLs or forms) cannot be trusted. The context must be derived securely from the authenticated session before any DB query executes.
**Verification Result**: [PASS] Unit tests prove `branchId` is injected natively and missing context forcibly aborts the transaction.

## 3. Database Strategy
**Decision**: Prisma ORM with PostgreSQL.
**Rationale**: Provides excellent type safety and migration management. Legacy database connections are strictly forbidden to ensure a clean domain model and schema.
**Verification Result**: [PASS] Database validations guarantee 100% legacy separation and robust `nova_dev` connection.

## 4. Attendance Domain
**Decision**: Strict daily uniqueness `@@unique([studentId, date])` for the pilot.
**Rationale**: Avoids duplicate entries. Future expansions can add dimension (e.g., lesson-level attendance) by altering this constraint, but simplicity is prioritized for the pilot.
**Verification Result**: [PASS] Uniqueness confirmed. Re-marking attendance updates the status rather than duplicating records.

## 5. Audit Logging
**Decision**: Implement a centralized `AuditLog` table.
**Rationale**: Required for accountability in educational software. All sensitive mutations (auth, attendance changes, grade changes) must log the actor, resource, and tenant context.
**Verification Result**: [PASS] Database-level E2E assertion proves records correctly capture Login, Logout, and Save actions with accurate metadata.

## 6. Type Safety & Linting
**Decision**: Strict `no-explicit-any` ESLint rules.
**Rationale**: Ensure production-grade reliability across all React client bounds and server actions.
**Verification Result**: [PASS] The suite compiles cleanly with strict boundaries, leveraging specific Types for form bounds rather than `unknown` skips.
