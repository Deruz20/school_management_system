import { validateSession } from "./session";
import { UnauthorizedError, TenantContext } from "../dao/tenant-context";

/**
 * Strictly validates the session against the database and returns the authenticated user's TenantContext.
 * This is the true security boundary.
 */
export async function requireAuth(): Promise<TenantContext> {
  const { session, user } = await validateSession();

  if (!session || !user) {
    throw new UnauthorizedError("Not authenticated");
  }

  if (user.status !== "ACTIVE") {
    throw new UnauthorizedError("Account suspended");
  }

  // Extract the tenant context. 
  // For the pilot, we assume the user is operating in their first assigned branch.
  // In a full multi-branch setup, this would be derived from a selected branch ID in the URL/cookies.
  const branchAccess = user.branchAccess?.[0];

  if (!branchAccess) {
    throw new UnauthorizedError("User has no branch access");
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    schoolId: branchAccess.branch.schoolId,
    branchId: branchAccess.branchId,
    role: branchAccess.role.name,
    permissions: branchAccess.role.permissions,
  };
}

export function checkPermission(ctx: TenantContext, requiredPermission: string) {
  const perms = ctx.permissions || [];
  if (perms.includes('all')) return true;
  if (perms.includes(requiredPermission)) return true;
  throw new UnauthorizedError(`Missing permission: ${requiredPermission}`);
}
