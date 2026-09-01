# Staff/HR Core Recovery Status

## 1. Exact Current Phase 2 Status

Based on an inspection of the filesystem, Phase 2 Staff/HR Core is **almost entirely complete**. The database schema, data access objects (DAOs), backend API routes, role-based access control (RBAC), audit logging, and core Employee UI are fully implemented and tested.

However, there is minor **partial work** regarding the UI for managing Departments and Employee Types (creation/editing), which currently only display read-only lists.

## 2. Completed Items (✅ COMPLETE AND VERIFIED)

### Schema
* ✅ **EmployeeStatus**: Enum is present.
* ✅ **Department**: Model is present.
* ✅ **EmployeeType**: Model is present with `isTeachingStaff` flag.
* ✅ **Employee**: Model is present.
* ✅ **TeacherProfile removal**: Replaced globally by `Employee`.
* ✅ **ClassSubject → Employee**: Relation updated to point to `Employee(teacherId)`.
* ✅ **Employee ↔ User**: 1:1 relation established (`userId` on `Employee`).

### DAOs
* ✅ **StaffDAO**: Implemented with tenant checks and audit logging.
* ✅ **DepartmentDAO**: Implemented with tenant checks and audit logging.
* ✅ **EmployeeTypeDAO**: Implemented with tenant checks and audit logging.
* ✅ **ClassSubjectDAO**: Updated to verify `employeeType.isTeachingStaff`.

### Security & Audit
* ✅ **RBAC**: `checkPermission(ctx, 'staff:read')` and `'staff:write'` are strictly enforced in all DAOs.
* ✅ **Authorization checks**: Tenant context `branchId` boundaries are enforced across all operations.
* ✅ **Audit**: `AuditService.log` tracks mutations like `CREATE_EMPLOYEE`, `UPDATE_EMPLOYEE`, `CREATE_DEPARTMENT`, etc.

### UI & Navigation
* ✅ **Sidebar**: Updated to include a link to `/staff`.
* ✅ **`/staff`**: Fully functional employee listing with search/filter UI structure.
* ✅ **`/staff/new`**: Functional form (`StaffForm`) submitting to `/api/staff`.
* ✅ **`/staff/[id]`**: Functional edit form (`StaffForm`) submitting to `/api/staff/[id]`.

### Testing & Seeding
* ✅ **Staff DAO tests**: Passed (`staff.dao.test.ts`).
* ✅ **Department tests**: Passed (`department.dao.test.ts`).
* ✅ **EmployeeType tests**: Passed (`employee-type.dao.test.ts`).
* ✅ **Seed files**: `prisma/seed.ts` has been updated to seed `Employee` and `EmployeeType` and link them to `User` records.

## 3. Partial Items (🟡 IMPLEMENTED BUT NOT VERIFIED / INCOMPLETE)

* 🟡 **UI: `/staff/departments`**: The page exists and lists departments using `DepartmentDAO.list()`, but the "New Department" and "Edit" buttons are placeholders (`<Button>New Department</Button>`). No forms or API routes for department mutations exist yet.
* 🟡 **UI: `/staff/types`**: The page exists and lists types using `EmployeeTypeDAO.list()`, but the "New Type" and "Edit" buttons are placeholders. No forms or API routes for employee type mutations exist yet.
* 🟡 **Academics/teacher assignment regression tests**: The business logic is successfully updated in `class-subject.dao.ts`, but `curriculum.dao.test.ts` still contains a leftover Prisma mock for `teacherProfile: { findUnique: vi.fn() }`.

## 4. Missing Items (🔴 NOT IMPLEMENTED)
* 🔴 Forms/Modals/Pages for creating and updating Departments.
* 🔴 API routes for Departments (`/api/departments`).
* 🔴 Forms/Modals/Pages for creating and updating Employee Types.
* 🔴 API routes for Employee Types (`/api/employee-types`).

## 5. Broken Items (⚠️ IMPLEMENTED BUT BROKEN/INCOMPLETE)
* None detected. Code compiles and DAOs have passing unit tests.

## 6. Files Involved
* `prisma/schema.prisma`
* `prisma/seed.ts`
* `src/lib/dao/staff.dao.ts`, `department.dao.ts`, `employee-type.dao.ts`, `class-subject.dao.ts`
* `src/app/api/staff/route.ts`, `[id]/route.ts`
* `src/app/(dashboard)/staff/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `departments/page.tsx`, `types/page.tsx`
* `src/components/staff/StaffForm.tsx`
* `src/lib/dao/staff.dao.test.ts`, `department.dao.test.ts`, `employee-type.dao.test.ts`, `curriculum.dao.test.ts`
* `src/components/ui/sidebar.tsx`

## 7. Migrations Currently Present
The `prisma/migrations/` directory contains:
* `20260831123444_init`
* `20260831152243_init_academics`
* `20260831225540_integration_schema`
* `20260901_phase1_foundations`
* `20260901_drop_academicyear_isactive`
* **`20260901000000_staff_hr_core`** (Phase 2 migration is successfully applied).

## 8. Recommended Next Action
**Fix partial work:**
Do not restart Phase 2 from scratch. Resume by completing the missing UI forms and API endpoints for managing `Departments` and `EmployeeTypes`, and clean up the deprecated `teacherProfile` mock in `curriculum.dao.test.ts`.
