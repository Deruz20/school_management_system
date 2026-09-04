import { requireAuth } from "@/lib/auth/require-auth";
import { ExeatDAO } from "@/lib/dao/exeat.dao";
import { db } from "@/lib/db";
import { ExeatClient } from "./exeat-client";
import { Ticket, LogOut, AlertTriangle, CheckCircle2 } from "lucide-react";

export default async function ExeatPage() {
  const ctx = await requireAuth();

  // Scan and update overdue flags before loading
  await ExeatDAO.updateOverduePasses(ctx);

  const [passes, students, academicYears] = await Promise.all([
    ExeatDAO.listExeatPasses(ctx),
    db.student.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, admissionNo: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
      take: 200,
    }),
    db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, name: true },
      orderBy: { startDate: 'desc' },
    })
  ]);

  const totalPasses = passes.length;
  const currentlyDeparted = passes.filter((p) => p.status === "DEPARTED").length;
  const overdueCount = passes.filter((p) => p.isOverdue).length;
  const pendingApprovals = passes.filter((p) => p.status === "PENDING").length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Exeat &amp; Gate-Pass Management</h1>
          <p className="text-slate-500 mt-1">
            Guardian consent verification, cryptographic QR tokens, live gate checkouts/checkins, and overdue tracking.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Passes Issued</span>
            <Ticket className="text-blue-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{totalPasses}</div>
            <div className="text-xs text-slate-500 mt-1">Authorized exeat records</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Currently Off-Campus</span>
            <LogOut className="text-purple-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-purple-600">{currentlyDeparted}</div>
            <div className="text-xs text-slate-500 mt-1">Students passed gate</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue Passes</span>
            <AlertTriangle className="text-rose-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-rose-600">{overdueCount}</div>
            <div className="text-xs text-slate-500 mt-1">Failed to return by expected time</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Approvals</span>
            <CheckCircle2 className="text-amber-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-600">{pendingApprovals}</div>
            <div className="text-xs text-slate-500 mt-1">Awaiting staff sign-off</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Client Component */}
      <ExeatClient
        passes={passes}
        students={students}
        academicYears={academicYears}
      />
    </div>
  );
}
