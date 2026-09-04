"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Ticket,
  Plus,
  QrCode,
  CheckCircle2,
  AlertCircle,
  LogOut,
  LogIn,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ExeatItem {
  id: string;
  exeatNumber: string;
  exeatType: string;
  reason: string;
  intendedDeparture: string | Date;
  expectedReturn: string | Date;
  actualDeparture: string | Date | null;
  actualReturn: string | Date | null;
  status: string;
  isOverdue: boolean;
  qrVerificationToken: string;
  student: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
  };
  guardian: {
    id: string;
    firstName: string;
    lastName: string;
    phonePrimary: string;
  } | null;
  approvedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export function ExeatClient({
  passes,
  students,
  academicYears,
}: {
  passes: ExeatItem[];
  students: Array<{ id: string; admissionNo: string; firstName: string; lastName: string }>;
  academicYears: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [isRequesting, setIsRequesting] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [verifiedPass, setVerifiedPass] = useState<ExeatItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Request Form State
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id || "");
  const [exeatType, setExeatType] = useState("MEDICAL");
  const [reason, setReason] = useState("");
  const [intendedDeparture, setIntendedDeparture] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [accompanyingAdult, setAccompanyingAdult] = useState("");
  const [guardianConsent, setGuardianConsent] = useState(true);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/exeat/passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          academicYearId,
          exeatType,
          reason,
          intendedDeparture,
          expectedReturn,
          accompanyingAdult,
          guardianConsent,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Exeat pass requested with cryptographic QR verification token.");
      setIsRequesting(false);
      setReason("");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/exeat/passes/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Exeat pass approved.");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (exeatId?: string, qrVerificationToken?: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/exeat/passes/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exeatId, qrVerificationToken }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Gate departure logged. Student marked as DEPARTED.");
      if (verifiedPass) setVerifiedPass(null);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async (exeatId?: string, qrVerificationToken?: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/exeat/passes/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exeatId, qrVerificationToken }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Gate return logged. Student marked as COMPLETED.");
      if (verifiedPass) setVerifiedPass(null);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/exeat/verify/${tokenInput.trim()}`);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }
      const data = await res.json();
      setVerifiedPass(data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    APPROVED: "bg-blue-100 text-blue-800 border-blue-200",
    DEPARTED: "bg-purple-100 text-purple-800 border-purple-200 font-semibold",
    COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    OVERDUE: "bg-rose-100 text-rose-800 border-rose-300 font-bold",
    CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  };

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

      {/* Gate Security Fast Scanner Box */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <QrCode size={16} />
            <span>Campus Gate Security Scanner</span>
          </div>
          <h3 className="text-xl font-bold">Gate Officer Verification Terminal</h3>
          <p className="text-xs text-slate-400 mt-1">
            Scan physical or mobile QR verification token to authorize departure or record return.
          </p>

          <form onSubmit={handleVerifyToken} className="mt-4 flex gap-2 max-w-lg">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste 48-char QR Token or Pass Number..."
              className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Search size={16} className="mr-1" /> Verify
            </Button>
          </form>
        </div>

        {/* Action Button */}
        <div className="shrink-0">
          <Button
            onClick={() => setIsRequesting(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 h-11 px-5"
          >
            <Plus size={18} />
            <span>Issue New Exeat</span>
          </Button>
        </div>
      </div>

      {/* Verified Pass Drawer if token was scanned */}
      {verifiedPass && (
        <div className="bg-blue-50 border-2 border-blue-400 rounded-2xl p-6 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-blue-950">{verifiedPass.exeatNumber}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[verifiedPass.status] || 'bg-slate-100'}`}>
                  {verifiedPass.status}
                </span>
                {verifiedPass.isOverdue && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                    OVERDUE
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold text-slate-900 mt-2">
                {verifiedPass.student.firstName} {verifiedPass.student.lastName} ({verifiedPass.student.admissionNo})
              </h4>
              <p className="text-sm text-slate-600 mt-1">
                Type: <strong>{verifiedPass.exeatType}</strong> | Reason: {verifiedPass.reason}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Expected Departure: {new Date(verifiedPass.intendedDeparture).toLocaleString()} | Expected Return: {new Date(verifiedPass.expectedReturn).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {verifiedPass.status === "APPROVED" && (
                <Button
                  onClick={() => handleCheckout(verifiedPass.id)}
                  className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                >
                  <LogOut size={16} /> Record Departure
                </Button>
              )}
              {verifiedPass.status === "DEPARTED" && (
                <Button
                  onClick={() => handleCheckin(verifiedPass.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                >
                  <LogIn size={16} /> Record Return
                </Button>
              )}
              <Button variant="outline" onClick={() => setVerifiedPass(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exeat Passes Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Active &amp; Historical Exeat Passes</h3>
          <span className="text-xs text-slate-500">{passes.length} passes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">Pass No</th>
                <th className="p-4">Student</th>
                <th className="p-4">Type &amp; Reason</th>
                <th className="p-4">Departure Window</th>
                <th className="p-4">Expected Return</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Gate Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {passes.map((pass) => (
                <tr key={pass.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-mono font-medium text-slate-900">{pass.exeatNumber}</td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-800">
                      {pass.student.firstName} {pass.student.lastName}
                    </div>
                    <div className="text-xs text-slate-500">{pass.student.admissionNo}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{pass.exeatType}</div>
                    <div className="text-xs text-slate-500 max-w-xs truncate">{pass.reason}</div>
                  </td>
                  <td className="p-4 text-xs">
                    {new Date(pass.intendedDeparture).toLocaleDateString()}{" "}
                    {new Date(pass.intendedDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-4 text-xs">
                    {new Date(pass.expectedReturn).toLocaleDateString()}{" "}
                    {new Date(pass.expectedReturn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors[pass.status] || 'bg-slate-100'}`}>
                      {pass.status}
                    </span>
                    {pass.isOverdue && (
                      <span className="ml-1 text-[10px] font-bold text-rose-600">OVERDUE</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {pass.status === "PENDING" && (
                        <Button
                          size="sm"
                          onClick={() => handleApprove(pass.id)}
                          className="text-xs h-8 bg-blue-600 text-white"
                        >
                          Approve
                        </Button>
                      )}

                      {pass.status === "APPROVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckout(pass.id)}
                          className="text-xs h-8 border-purple-300 text-purple-800 bg-purple-50"
                        >
                          <LogOut size={13} className="mr-1" /> Depart
                        </Button>
                      )}

                      {pass.status === "DEPARTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckin(pass.id)}
                          className="text-xs h-8 border-emerald-300 text-emerald-800 bg-emerald-50"
                        >
                          <LogIn size={13} className="mr-1" /> Return
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {passes.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No exeat passes requested.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Exeat Modal */}
      {isRequesting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Ticket className="text-emerald-600" size={20} />
              <span>Issue Student Exeat Pass</span>
            </h3>
            <form onSubmit={handleRequest} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Student</label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Exeat Type</label>
                  <select
                    value={exeatType}
                    onChange={(e) => setExeatType(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 font-semibold"
                  >
                    <option value="MEDICAL">Medical Treatment / Clinic Referral</option>
                    <option value="FAMILY_EMERGENCY">Family Emergency</option>
                    <option value="ACADEMIC_COMPETITION">Academic / Sports Competition</option>
                    <option value="OFFICIAL_HOLIDAY">Official Term Holiday</option>
                    <option value="SPECIAL_LEAVE">Special Compassionate Leave</option>
                    <option value="DISCIPLINARY_SENDOFF">Disciplinary Suspension Send-off</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Academic Year</label>
                  <select
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Intended Departure</label>
                  <input
                    type="datetime-local"
                    value={intendedDeparture}
                    onChange={(e) => setIntendedDeparture(e.target.value)}
                    required
                    className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Expected Return</label>
                  <input
                    type="datetime-local"
                    value={expectedReturn}
                    onChange={(e) => setExpectedReturn(e.target.value)}
                    required
                    className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Accompanying Adult / Escort</label>
                <input
                  type="text"
                  value={accompanyingAdult}
                  onChange={(e) => setAccompanyingAdult(e.target.value)}
                  placeholder="Parent name or designated guardian..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Detailed Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={2}
                  placeholder="Medical checkup at external clinic, family ceremony..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={guardianConsent}
                  onChange={(e) => setGuardianConsent(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span className="font-semibold text-slate-700">Guardian verbal / written consent verified</span>
              </label>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsRequesting(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-emerald-600 text-white">
                  {loading ? "Generating..." : "Issue Exeat Pass"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
