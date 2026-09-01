import { requireAuth } from "@/lib/auth/require-auth";
import { AuditService } from "@/lib/services/audit.service";
import AuditClient from "@/components/settings/AuditClient";
import { redirect } from "next/navigation";

export default async function AuditPage() {
  const tenantCtx = await requireAuth();

  // Protect route
  if (!tenantCtx.permissions.includes('all')) {
    redirect('/');
  }

  const logs = await AuditService.getLogs(tenantCtx, { limit: 100 });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit Logs</h1>
          <p className="text-slate-500 mt-1">Review security and configuration changes in this branch.</p>
        </div>
      </div>
      
      <AuditClient initialLogs={logs} />
    </div>
  );
}
