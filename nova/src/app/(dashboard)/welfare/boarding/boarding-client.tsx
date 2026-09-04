"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, CheckCircle2, Home } from "lucide-react";
import { useRouter } from "next/navigation";

interface BedAllocationItem {
  id: string;
  status: string;
  student: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
    gender: string | null;
  };
}

interface BedItem {
  id: string;
  bedNumber: string;
  bedCode: string;
  bedType: string;
  status: string;
  allocations: BedAllocationItem[];
}

interface RoomItem {
  id: string;
  roomNumber: string;
  floorNumber: number;
  wing: string | null;
  roomType: string;
  capacity: number;
  beds: BedItem[];
}

interface HostelItem {
  id: string;
  code: string;
  name: string;
  gender: string;
  capacity: number;
  warden: { id: string; firstName: string; lastName: string } | null;
  matron: { id: string; firstName: string; lastName: string } | null;
  rooms: RoomItem[];
}

export function BoardingClient({
  hostels,
  students,
  academicYears,
}: {
  hostels: HostelItem[];
  students: Array<{ id: string; admissionNo: string; firstName: string; lastName: string; gender: string | null }>;
  academicYears: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [selectedHostelId, setSelectedHostelId] = useState<string>(hostels[0]?.id || "");
  const [isAllocating, setIsAllocating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Allocation Form State
  const [allocStudentId, setAllocStudentId] = useState("");
  const [allocBedId, setAllocBedId] = useState("");
  const [allocYearId, setAllocYearId] = useState(academicYears[0]?.id || "");
  const [allocNotes, setAllocNotes] = useState("");

  // Clearance Form State
  const [clearStudentId, setClearStudentId] = useState("");
  const [mattressReturned, setMattressReturned] = useState(true);
  const [roomKeysReturned, setRoomKeysReturned] = useState(true);
  const [lockerKeysReturned, setLockerKeysReturned] = useState(true);
  const [bunkConditionIntact, setBunkConditionIntact] = useState(true);
  const [damagesNoted, setDamagesNoted] = useState(false);
  const [damageCostUGX, setDamageCostUGX] = useState<number>(0);
  const [damageDescription, setDamageDescription] = useState("");

  const currentHostel = hostels.find((h) => h.id === selectedHostelId) || hostels[0];

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/hostels/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: allocStudentId,
          bedId: allocBedId,
          academicYearId: allocYearId,
          notes: allocNotes,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Bed successfully allocated to student.");
      setIsAllocating(false);
      setAllocStudentId("");
      setAllocBedId("");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (allocationId: string) => {
    if (!confirm("Are you sure you want to release this bed allocation?")) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/hostels/allocations/${allocationId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Bed released successfully.");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/hostels/clearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: clearStudentId,
          academicYearId: allocYearId,
          mattressReturned,
          roomKeysReturned,
          lockerKeysReturned,
          bunkConditionIntact,
          damagesNoted,
          damageCostUGX: damagesNoted ? Number(damageCostUGX) : 0,
          damageDescription,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Hostel clearance recorded successfully. Damages invoiced if applicable.");
      setIsClearing(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Available beds in selected hostel
  const availableBeds = currentHostel?.rooms?.flatMap((r) =>
    r.beds.filter((b) => b.status === "AVAILABLE").map((b) => ({ ...b, roomNumber: r.roomNumber }))
  ) || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Alert Banners */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="shrink-0" size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="shrink-0" size={20} />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Hostel Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {hostels.map((h) => (
            <button
              key={h.id}
              onClick={() => setSelectedHostelId(h.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                selectedHostelId === h.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Home size={16} />
                <span>{h.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-black/10">
                  {h.gender}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Operation Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsClearing(true)}
            className="border-slate-300 text-slate-700"
          >
            Clearance Checklist
          </Button>
          <Button
            onClick={() => setIsAllocating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Allocate Bed</span>
          </Button>
        </div>
      </div>

      {/* Current Hostel Rooms & Beds Visual Grid */}
      {currentHostel ? (
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{currentHostel.name}</h3>
                <p className="text-sm text-slate-500">
                  Code: {currentHostel.code} | Gender: {currentHostel.gender} | Capacity: {currentHostel.capacity} beds
                  {currentHostel.warden && ` | Warden: ${currentHostel.warden.firstName} ${currentHostel.warden.lastName}`}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Available</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Occupied</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400"></span> Maintenance</span>
              </div>
            </div>

            {/* Rooms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentHostel.rooms.map((room) => (
                <div key={room.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-slate-800">Room {room.roomNumber}</span>
                    <span className="text-xs text-slate-500">{room.roomType.replace("_", " ")}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {room.beds.map((bed) => {
                      const activeAlloc = bed.allocations?.[0];
                      return (
                        <div
                          key={bed.id}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            bed.status === "AVAILABLE"
                              ? "bg-white border-emerald-200 text-emerald-900 hover:border-emerald-400"
                              : bed.status === "OCCUPIED"
                              ? "bg-amber-50 border-amber-200 text-amber-900"
                              : "bg-slate-100 border-slate-300 text-slate-600"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold mb-1">
                            <span>Bed {bed.bedNumber}</span>
                            <span className={`w-2 h-2 rounded-full ${
                              bed.status === "AVAILABLE" ? "bg-emerald-500" : bed.status === "OCCUPIED" ? "bg-amber-500" : "bg-slate-400"
                            }`}></span>
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {bed.bedType.replace("_", " ")}
                          </div>
                          {activeAlloc ? (
                            <div className="mt-2 pt-2 border-t border-amber-200/60">
                              <p className="text-xs font-medium truncate text-amber-950">
                                {activeAlloc.student.firstName} {activeAlloc.student.lastName}
                              </p>
                              <p className="text-[10px] text-amber-700">{activeAlloc.student.admissionNo}</p>
                              <button
                                onClick={() => handleRelease(activeAlloc.id)}
                                className="text-[10px] text-rose-600 hover:underline mt-1 font-semibold block"
                              >
                                Release
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 text-[10px] text-emerald-700 font-medium">Ready</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
          No hostels configured yet.
        </div>
      )}

      {/* Bed Allocation Modal */}
      {isAllocating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Allocate Bed</h3>
            <form onSubmit={handleAllocate} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Student</label>
                <select
                  value={allocStudentId}
                  onChange={(e) => setAllocStudentId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                >
                  <option value="">Select Enrolled Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNo}) - {s.gender || "Unspecified"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Available Bed</label>
                <select
                  value={allocBedId}
                  onChange={(e) => setAllocBedId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                >
                  <option value="">Select Available Bed...</option>
                  {availableBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      Room {b.roomNumber} - Bed {b.bedNumber} ({b.bedCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Academic Year</label>
                <select
                  value={allocYearId}
                  onChange={(e) => setAllocYearId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Allocation Notes</label>
                <input
                  type="text"
                  value={allocNotes}
                  onChange={(e) => setAllocNotes(e.target.value)}
                  placeholder="Special accommodation, medical preferences..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsAllocating(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 text-white">
                  {loading ? "Allocating..." : "Confirm Allocation"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hostel Clearance Checklist Modal */}
      {isClearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Hostel Handover Clearance</h3>
            <form onSubmit={handleClearance} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Student</label>
                <select
                  value={clearStudentId}
                  onChange={(e) => setClearStudentId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                >
                  <option value="">Select Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 text-sm text-slate-800">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={mattressReturned}
                    onChange={(e) => setMattressReturned(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>School Mattress returned in good state</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roomKeysReturned}
                    onChange={(e) => setRoomKeysReturned(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Dormitory / Room key returned</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={lockerKeysReturned}
                    onChange={(e) => setLockerKeysReturned(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Locker key returned</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bunkConditionIntact}
                    onChange={(e) => setBunkConditionIntact(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Bunk frame and ladder intact</span>
                </label>
                <label className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <input
                    type="checkbox"
                    checked={damagesNoted}
                    onChange={(e) => setDamagesNoted(e.target.checked)}
                    className="rounded border-slate-300 text-rose-600"
                  />
                  <span className="font-semibold text-rose-700">Property Damages Noted (Incur Surcharge)</span>
                </label>
              </div>

              {damagesNoted && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-rose-900 block mb-1">Damage Surcharge (UGX)</label>
                    <input
                      type="number"
                      value={damageCostUGX}
                      onChange={(e) => setDamageCostUGX(Number(e.target.value))}
                      required={damagesNoted}
                      min="1000"
                      className="w-full text-sm rounded-lg border border-rose-300 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-rose-900 block mb-1">Damage Description</label>
                    <input
                      type="text"
                      value={damageDescription}
                      onChange={(e) => setDamageDescription(e.target.value)}
                      required={damagesNoted}
                      placeholder="Broken window louvers, damaged locker lock..."
                      className="w-full text-sm rounded-lg border border-rose-300 p-2 text-slate-900"
                    />
                  </div>
                  <p className="text-[11px] text-rose-700">
                    Note: Submitting with damages automatically generates an invoice on <strong>Account #1200</strong> and marks clearance as rejected until paid.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsClearing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 text-white">
                  {loading ? "Recording..." : "Submit Clearance"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
