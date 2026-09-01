import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import { SettingsDAO } from "@/lib/dao/settings.dao";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const tenantCtx = await requireAuth();

  const [activeContext, academicYears] = await Promise.all([
    SettingsDAO.getActiveContext(tenantCtx.branchId),
    db.academicYear.findMany({
      where: { branchId: tenantCtx.branchId },
      include: { terms: { orderBy: { startDate: 'asc' } } },
      orderBy: { startDate: 'desc' }
    })
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Branch Settings</h1>
          <p className="text-slate-500 mt-1">Configure active academic context and branding for this branch.</p>
        </div>
      </div>
      
      <SettingsClient 
        settings={activeContext.settings}
        academicYears={academicYears}
      />
    </div>
  );
}
