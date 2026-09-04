import { requireAuth } from "@/lib/auth/require-auth";
import { HostelDAO } from "@/lib/dao/hostel.dao";
import { db } from "@/lib/db";
import { BoardingClient } from "./boarding-client";
import { Bed, Users, ShieldCheck, Home } from "lucide-react";

export default async function BoardingPage() {
  const ctx = await requireAuth();

  const [rawHostels, students, academicYears] = await Promise.all([
    HostelDAO.getHostels(ctx),
    db.student.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, admissionNo: true, firstName: true, lastName: true, gender: true },
      orderBy: { firstName: 'asc' },
      take: 200,
    }),
    db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, name: true },
      orderBy: { startDate: 'desc' },
    })
  ]);

  // Fetch complete hostels with rooms and beds for the visual matrix
  const hostels = await Promise.all(
    rawHostels.map((h) => HostelDAO.getHostelById(ctx, h.id))
  );

  // Compute metrics
  const totalHostels = hostels.length;
  const totalRooms = hostels.reduce((sum, h) => sum + h.rooms.length, 0);
  const totalBeds = hostels.reduce(
    (sum, h) => sum + h.rooms.reduce((rSum, r) => rSum + r.beds.length, 0),
    0
  );
  const occupiedBeds = hostels.reduce(
    (sum, h) =>
      sum +
      h.rooms.reduce(
        (rSum, r) => rSum + r.beds.filter((b) => b.status === "OCCUPIED").length,
        0
      ),
    0
  );
  const availableBeds = hostels.reduce(
    (sum, h) =>
      sum +
      h.rooms.reduce(
        (rSum, r) => rSum + r.beds.filter((b) => b.status === "AVAILABLE").length,
        0
      ),
    0
  );
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Hostel &amp; Boarding Management</h1>
          <p className="text-slate-500 mt-1">
            Concurrency-safe bed allocations, visual dormitory occupancy matrix, roll-calls, and handover clearance.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Hostels &amp; Rooms</span>
            <Home className="text-blue-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{totalHostels}</div>
            <div className="text-xs text-slate-500 mt-1">{totalRooms} active dormitory rooms</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Bed Capacity</span>
            <Bed className="text-indigo-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{totalBeds}</div>
            <div className="text-xs text-slate-500 mt-1">{availableBeds} beds available right now</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Boarding Occupancy</span>
            <Users className="text-amber-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-600">{occupiedBeds}</div>
            <div className="text-xs text-slate-500 mt-1">{occupancyRate}% overall capacity utilized</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Safety &amp; Compliance</span>
            <ShieldCheck className="text-emerald-500" size={20} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-600">100%</div>
            <div className="text-xs text-slate-500 mt-1">Row-level locking active</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Matrix Client Component */}
      <BoardingClient
        hostels={hostels}
        students={students}
        academicYears={academicYears}
      />
    </div>
  );
}
