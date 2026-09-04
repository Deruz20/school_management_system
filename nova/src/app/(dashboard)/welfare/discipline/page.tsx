import { requireAuth } from "@/lib/auth/require-auth";
import { DisciplineDAO } from "@/lib/dao/discipline.dao";
import { db } from "@/lib/db";
import { DisciplineClient } from "./discipline-client";
import { ShieldAlert, Gavel, Award, AlertTriangle } from "lucide-react";

export default async function DisciplinePage() {
  const ctx = await requireAuth();

  const [incidents, students, staffList, activeSuspensions] = await Promise.all([
    DisciplineDAO.listIncidents(ctx),
    db.student.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, admissionNo: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
      take: 200,
    }),
    db.user.findMany({
      where: {
        branchAccess: {
          some: { branchId: ctx.branchId }
        }
      },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: 'asc' },
    }),
    db.disciplinarySanction.count({
      where: {
        branchId: ctx.branchId,
        sanctionType: "SUSPENSION",
        status: "ACTIVE",
      }
    })
  ]);

  const totalIncidents = incidents.length;
  const majorCases = incidents.filter((i) => i.severity === "MAJOR" || i.severity === "SEVERE").length;
  const resolvedCases = incidents.filter((i) => i.status === "RESOLVED").length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Student Discipline &amp; Behavior</h1>
          <p className="text-slate-500 mt-1">
            Incident reporting, hearings, maker-checker sanction approval, demerit points, and direct Student Lifecycle integration.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Incidents</span>
            <ShieldAlert className="text-indigo-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{totalIncidents}</div>
            <div className="text-xs text-slate-500 mt-1">Reported infractions</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Major &amp; Severe</span>
            <AlertTriangle className="text-rose-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-rose-600">{majorCases}</div>
            <div className="text-xs text-slate-500 mt-1">High-severity cases</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Hearings Resolved</span>
            <Gavel className="text-emerald-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-600">{resolvedCases}</div>
            <div className="text-xs text-slate-500 mt-1">Formally adjudicated</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Suspensions</span>
            <Award className="text-amber-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-600">{activeSuspensions}</div>
            <div className="text-xs text-slate-500 mt-1">Students on suspension</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Client Component */}
      <DisciplineClient
        incidents={incidents}
        students={students}
        staffList={staffList}
      />
    </div>
  );
}
