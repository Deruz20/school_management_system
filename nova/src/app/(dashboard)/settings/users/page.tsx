import { requireAuth } from "@/lib/auth/require-auth";
import { UserDAO } from "@/lib/dao/user.dao";
import { RbacDAO } from "@/lib/dao/rbac.dao";
import UsersClient from "@/components/settings/UsersClient";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const tenantCtx = await requireAuth();

  // Protect route
  if (!tenantCtx.permissions.includes('all')) {
    redirect('/');
  }

  const [branchUsers, orgUsers, roles] = await Promise.all([
    UserDAO.listBranchUsers(tenantCtx),
    UserDAO.listOrganizationUsers(tenantCtx),
    RbacDAO.listRoles(tenantCtx)
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Branch Users</h1>
          <p className="text-slate-500 mt-1">Manage staff access and roles for this branch.</p>
        </div>
      </div>
      
      <UsersClient 
        branchUsers={branchUsers} 
        orgUsers={orgUsers} 
        roles={roles} 
      />
    </div>
  );
}
