import { requireAuth } from "@/lib/auth/require-auth";
import { RbacDAO } from "@/lib/dao/rbac.dao";
import RolesClient from "@/components/settings/RolesClient";
import { redirect } from "next/navigation";

export default async function RolesPage() {
  const tenantCtx = await requireAuth();

  // Protect route
  if (!tenantCtx.permissions.includes('all')) {
    redirect('/');
  }

  const roles = await RbacDAO.listRoles(tenantCtx);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Roles & Permissions</h1>
          <p className="text-slate-500 mt-1">Manage organizational roles and access controls.</p>
        </div>
      </div>
      
      <RolesClient initialRoles={roles} />
    </div>
  );
}
