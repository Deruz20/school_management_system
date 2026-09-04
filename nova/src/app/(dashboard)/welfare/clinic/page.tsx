import { requireAuth } from "@/lib/auth/require-auth";
import { ClinicDAO } from "@/lib/dao/clinic.dao";
import { db } from "@/lib/db";
import { ClinicClient } from "./clinic-client";
import { HeartPulse, Bed, Ambulance, AlertTriangle } from "lucide-react";

export default async function ClinicPage() {
  const ctx = await requireAuth();

  const [encounters, students, academicYears, inventoryItems, stores] = await Promise.all([
    ClinicDAO.listEncounters(ctx),
    db.student.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, admissionNo: true, firstName: true, lastName: true, allergies: true },
      orderBy: { firstName: 'asc' },
      take: 200,
    }),
    db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, name: true },
      orderBy: { startDate: 'desc' },
    }),
    db.inventoryItem.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      select: { id: true, code: true, name: true, unitOfMeasure: true },
      orderBy: { name: 'asc' },
    }),
    db.inventoryStore.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const totalEncounters = encounters.length;
  const emergencies = encounters.filter((e) => e.triagePriority === "EMERGENCY").length;
  const activeSickbay = encounters.filter(
    (e) => e.sickbayAdmission && !e.sickbayAdmission.dischargedAt
  ).length;
  const referralsCount = encounters.filter((e) => e.referral).length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Clinic &amp; Infirmary Management</h1>
          <p className="text-slate-500 mt-1">
            Clinical encounters, vital sign triage, AES-256-GCM encrypted health notes, sickbay ward, and pharmacy dispensary.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Consultations</span>
            <HeartPulse className="text-rose-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{totalEncounters}</div>
            <div className="text-xs text-slate-500 mt-1">Logged student visits</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Emergency Triage</span>
            <AlertTriangle className="text-amber-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-600">{emergencies}</div>
            <div className="text-xs text-slate-500 mt-1">Acute life-safety cases</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Sickbay Admitted</span>
            <Bed className="text-blue-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-blue-600">{activeSickbay}</div>
            <div className="text-xs text-slate-500 mt-1">Students under active bed rest</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">External Referrals</span>
            <Ambulance className="text-purple-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-purple-600">{referralsCount}</div>
            <div className="text-xs text-slate-500 mt-1">Hospital ambulance dispatches</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Client Component */}
      <ClinicClient
        encounters={encounters}
        students={students}
        academicYears={academicYears}
        inventoryItems={inventoryItems}
        stores={stores}
      />
    </div>
  );
}
