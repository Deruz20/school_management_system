// This represents the context of the currently authenticated user in a specific tenant scope.
// This context must be passed to any Data Access Object (DAO) to ensure tenant isolation.

export interface TenantContext {
  userId: string;
  organizationId: string;
  schoolId: string;
  branchId: string;
  role: string;
  permissions: string[];
}

export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized access to tenant resources.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
