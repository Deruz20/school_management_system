"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  User,
  ShieldCheck,
  CreditCard,
  CheckSquare,
  Activity,
  AlertTriangle,
  History,
  Phone,
  MapPin
} from "lucide-react";
import { StudentLifecycleStatus, Prisma } from "@prisma/client";

interface GuardianLink {
  id: string;
  relationship: string;
  isPrimaryContact: boolean;
  isFinancialSponsor: boolean;
  isEmergencyContact: boolean;
  hasPickupAuthorization: boolean;
  guardian: {
    guardianCode: string;
    firstName: string;
    lastName: string;
    phonePrimary: string;
    isVerified: boolean;
  };
}

interface EnrollmentRecord {
  id: string;
  status: string;
  createdAt: string | Date;
  endedAt?: string | Date | null;
  academicYear: { name: string };
  classRef: { name: string };
  streamRef?: { name: string } | null;
}

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  issueDate: string | Date;
  dueDate: string | Date;
  totalAmount?: Prisma.Decimal | number | string;
  netAmount?: Prisma.Decimal | number | string;
  paidAmount?: Prisma.Decimal | number | string | null;
  status: string;
}

interface ClearanceRecord {
  id: string;
  clearanceNumber: string;
  clearanceType: string;
  status: string;
  ledgerBalance?: Prisma.Decimal | number | string;
  feesPaidPercent?: Prisma.Decimal | number | string;
  issuedAt: string | Date;
}

interface LifecycleLogRecord {
  id: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  effectiveDate: string | Date;
  authorizedBy?: {
    firstName: string;
    lastName: string;
  } | null;
}

interface StudentDetail {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | Date | null;
  nationality: string;
  nin?: string | null;
  linEmisNo?: string | null;
  passportNo?: string | null;
  dayOrBoarding: string;
  residentialAddress?: string | null;
  villageLCI?: string | null;
  parish?: string | null;
  subCounty?: string | null;
  district?: string | null;
  medicalEmergencyNotes?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  specialNeeds?: string | null;
  previousSchoolName?: string | null;
  pleAggregate?: number | null;
  lifecycleStatus: StudentLifecycleStatus;
  status: string;
  admissionDate?: string | Date | null;
  schoolPayCode?: string | null;
  classRef?: { id: string; name: string } | null;
  streamRef?: { id: string; name: string } | null;
  familyGroup?: { id?: string; familyName: string } | null;
  isKycUnmasked?: boolean;
  isMedicalUnmasked?: boolean;
  guardians: GuardianLink[];
  enrollments: EnrollmentRecord[];
  invoices: InvoiceRecord[];
  clearances: ClearanceRecord[];
  lifecycleLogs: LifecycleLogRecord[];
}

interface StudentProfileViewProps {
  student: StudentDetail;
}

export function StudentProfileView({ student }: StudentProfileViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "guardians" | "academics" | "finance" | "clearance" | "lifecycle"
  >("overview");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lifecycle transition state
  const [targetStatus, setTargetStatus] = useState<StudentLifecycleStatus>(StudentLifecycleStatus.SUSPENDED);
  const [transitionReason, setTransitionReason] = useState("");
  const [transitionNotes, setTransitionNotes] = useState("");

  const lifecycleColors: Record<StudentLifecycleStatus, string> = {
    PROSPECTIVE: "bg-slate-100 text-slate-700 border-slate-200",
    ENROLLED: "bg-blue-100 text-blue-800 border-blue-300 font-semibold",
    ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold",
    SUSPENDED: "bg-amber-100 text-amber-800 border-amber-300",
    DEFERRED: "bg-purple-100 text-purple-800 border-purple-300",
    TRANSFERRED_OUT: "bg-indigo-100 text-indigo-800 border-indigo-300",
    EXPELLED: "bg-rose-100 text-rose-800 border-rose-300",
    GRADUATED: "bg-teal-100 text-teal-800 border-teal-300 font-semibold",
    DECEASED: "bg-zinc-100 text-zinc-700 border-zinc-300"
  };

  const handleLifecycleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitionReason.trim()) {
      setError("A formal justification reason is required for lifecycle transitions.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${student.id}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus,
          reason: transitionReason,
          notes: transitionNotes || undefined
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setTransitionReason("");
      setTransitionNotes("");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to update student lifecycle status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Profile Header Dossier */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-sm">
            {student.firstName[0]}{student.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                {student.firstName} {student.middleName ? `${student.middleName} ` : ""}{student.lastName}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs border ${lifecycleColors[student.lifecycleStatus as StudentLifecycleStatus]}`}>
                {student.lifecycleStatus}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-medium">
                {student.dayOrBoarding}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
              <span>Admission No: <strong className="font-mono text-slate-800">{student.admissionNo}</strong></span>
              <span>•</span>
              <span>Class: <strong className="text-slate-800">{student.classRef?.name || 'Unassigned'}</strong></span>
              {student.streamRef && (
                <>
                  <span>•</span>
                  <span>Stream: <strong className="text-slate-800">{student.streamRef.name}</strong></span>
                </>
              )}
              <span>•</span>
              <span>SchoolPay Code: <strong className="font-mono text-blue-600">{student.schoolPayCode || student.admissionNo}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {student.familyGroup && (
            <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <span className="text-slate-400 block text-[10px]">Household</span>
              <strong className="text-slate-700">{student.familyGroup.familyName}</strong>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "overview"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <User size={14} />
          <span>Identity & Demographics</span>
        </button>
        <button
          onClick={() => setActiveTab("guardians")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "guardians"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Phone size={14} />
          <span>Guardians ({student.guardians.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("academics")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "academics"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Activity size={14} />
          <span>Enrollments ({student.enrollments.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("finance")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "finance"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CreditCard size={14} />
          <span>Invoices & Ledger</span>
        </button>
        <button
          onClick={() => setActiveTab("clearance")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "clearance"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckSquare size={14} />
          <span>Requirements & Clearances</span>
        </button>
        <button
          onClick={() => setActiveTab("lifecycle")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "lifecycle"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History size={14} />
          <span>Lifecycle Governance</span>
        </button>
      </div>

      {/* Tab 1: Overview & Identity */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
            <h3 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-600" />
              <span>National KYC & Identifiers</span>
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">National ID (NIN)</span>
                <span className="font-mono font-semibold text-slate-800 text-sm">{student.nin || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Learner ID (LIN / EMIS)</span>
                <span className="font-mono font-semibold text-slate-800 text-sm">{student.linEmisNo || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Date of Birth</span>
                <span className="font-medium text-slate-700">
                  {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Nationality</span>
                <span className="font-medium text-slate-700">{student.nationality}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Gender</span>
                <span className="font-medium text-slate-700">{student.gender || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Admission Date</span>
                <span className="font-medium text-slate-700">
                  {student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-400 block mb-1">Residential Address</span>
              <div className="flex items-start gap-1.5 text-slate-700">
                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <span>
                  {student.residentialAddress || student.villageLCI ? (
                    `${student.residentialAddress || ''} ${student.villageLCI ? `(LC1: ${student.villageLCI})` : ''} ${student.district ? `, District: ${student.district}` : ''}`
                  ) : 'No address recorded.'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
            <h3 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Medical & Emergency Profile
            </h3>
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Blood Group</span>
                <span className="font-semibold text-slate-800">{student.bloodGroup || 'Not tested'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Known Allergies</span>
                <span className="font-medium text-slate-700">{student.allergies || 'None recorded'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Special Educational Needs</span>
                <span className="font-medium text-slate-700">{student.specialNeeds || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Emergency Medical Directives</span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono text-[11px] mt-1">
                  {student.medicalEmergencyNotes || 'No special directives provided.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Guardians */}
      {activeTab === "guardians" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Code</TableHead>
                <TableHead>Guardian Name</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Primary Phone</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>KYC Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {student.guardians.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono text-xs font-semibold">{g.guardian.guardianCode}</TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {g.guardian.firstName} {g.guardian.lastName}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{g.relationship}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-800">{g.guardian.phonePrimary}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {g.isPrimaryContact && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-semibold rounded">
                          Primary
                        </span>
                      )}
                      {g.isFinancialSponsor && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded">
                          Sponsor
                        </span>
                      )}
                      {g.isEmergencyContact && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-semibold rounded">
                          Emergency
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      g.guardian.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {g.guardian.isVerified ? 'Verified' : 'Provisional'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab 3: Authoritative Academics & Enrollments */}
      {activeTab === "academics" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 text-sm">Authoritative Academic Enrollments</h3>
            <p className="text-xs text-slate-500 mt-0.5">Sole placement authority governed by EnrollmentDAO.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Academic Year</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Stream</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enrolled At</TableHead>
                <TableHead>Ended At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {student.enrollments.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium text-slate-900">{e.academicYear.name}</TableCell>
                  <TableCell className="text-slate-800">{e.classRef.name}</TableCell>
                  <TableCell className="text-slate-600">{e.streamRef?.name || '—'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      e.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {e.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(e.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {e.endedAt ? new Date(e.endedAt).toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab 4: Finance & Invoices */}
      {activeTab === "finance" && (
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Invoices (Student AR Control #1200)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Authoritative invoice obligations posted to General Ledger.</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total Amount (UGX)</TableHead>
                  <TableHead className="text-right">Paid (UGX)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                      No invoices recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  student.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-800">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {new Date(inv.issueDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">
                        {Number(inv.totalAmount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-700 font-medium">
                        {Number(inv.paidAmount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inv.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tab 5: Clearances & Requirements */}
      {activeTab === "clearance" && (
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 text-sm">Clearance Permits (Exam & Gate Passes)</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Permit #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ledger Balance</TableHead>
                  <TableHead>Fees Paid %</TableHead>
                  <TableHead>Issued At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.clearances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                      No clearances issued yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  student.clearances.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-semibold">{c.clearanceNumber}</TableCell>
                      <TableCell className="text-xs">{c.clearanceType}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                          {c.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{Number(c.ledgerBalance).toLocaleString()} UGX</TableCell>
                      <TableCell className="text-xs">{Number(c.feesPaidPercent ?? 0)}%</TableCell>
                      <TableCell className="text-xs text-slate-500">{new Date(c.issuedAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tab 6: Lifecycle State Machine Transitions */}
      {activeTab === "lifecycle" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transition Form */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
            <h3 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Transition Lifecycle State
            </h3>
            <form onSubmit={handleLifecycleTransition} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-600 mb-1">Target Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as StudentLifecycleStatus)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="ACTIVE">ACTIVE (Reinstatement / Resumption)</option>
                  <option value="SUSPENDED">SUSPENDED (Disciplinary)</option>
                  <option value="DEFERRED">DEFERRED (Academic leave)</option>
                  <option value="TRANSFERRED_OUT">TRANSFERRED_OUT (Requires Zero Debt Clearance)</option>
                  <option value="EXPELLED">EXPELLED (Permanent)</option>
                  <option value="GRADUATED">GRADUATED (Completed Studies)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-600 mb-1">Justification Reason *</label>
                <input
                  type="text"
                  required
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Official reason for record..."
                />
              </div>

              <div>
                <label className="block font-medium text-slate-600 mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Additional context or committee minute reference..."
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white mt-1"
              >
                {loading ? "Processing..." : "Authorize State Transition"}
              </Button>
            </form>
          </div>

          {/* Immutable Transition History */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 text-sm">Immutable Transition Audit Trail</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Transition</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Authorized By</TableHead>
                  <TableHead>Effective Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.lifecycleLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-slate-500">{log.fromStatus}</span>
                        <span>→</span>
                        <strong className="text-slate-900">{log.toStatus}</strong>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 font-medium">{log.reason}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {log.authorizedBy?.firstName} {log.authorizedBy?.lastName}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(log.effectiveDate).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
