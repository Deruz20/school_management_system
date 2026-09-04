"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  GraduationCap,
  Receipt,
  Bed,
  ShieldCheck,
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  CreditCard,
  FileText
} from "lucide-react";

interface ChildSummary {
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  admissionNo: string;
  gender: string | null;
  lifecycleStatus: string;
  branch: { id: string; name: string };
  className: string | null;
  streamName: string | null;
  relationship: string;
  isPrimaryContact: boolean;
  isFinancialSponsor: boolean;
  receivesAcademicReports: boolean;
  outstandingBalance: number;
  isDebtor: boolean;
  pendingExeatCount: number;
  activeBed: { hostelName: string; roomNumber: string; bedNumber: string } | null;
}

interface AcademicReportState {
  accessStatus: string;
  isBlocked: boolean;
  outstandingBalance: number;
  threshold: number;
  message: string | null;
  results: Array<{
    termResultId: string;
    termName: string;
    academicYear: string;
    className: string;
    totalScore: number | null;
    aggregatePoints: number | null;
    division: string | null;
    finalizedAt: string;
    subjects: Array<{
      subjectCode: string;
      subjectName: string;
      score: number | null;
      grade: string | null;
      points: number | null;
      remarks: string | null;
    }>;
  }> | null;
}

interface FeeStatementState {
  student: { id: string; fullName: string; admissionNo: string };
  summary: {
    totalDebits: number;
    totalCredits: number;
    outstandingBalance: number;
    isDebtor: boolean;
  };
  transactions: Array<{
    id: string;
    postedAt: string;
    entryType: string;
    direction: string;
    amount: number;
    description: string;
    balanceAfter: number;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    termName: string | null;
    grossAmount: number;
    discountAmount: number;
    netAmount: number;
    status: string;
    items: Array<{
      voteHead: string;
      amount: number;
      narrative: string | null;
    }>;
  }>;
}

interface WelfareState {
  hostel: {
    hostelName: string;
    roomNumber: string;
    bedNumber: string;
    bedType: string;
    allocatedAt: string;
  } | null;
  exeats: Array<{
    id: string;
    exeatNumber: string;
    exeatType: string;
    reason: string;
    intendedDeparture: string;
    expectedReturn: string;
    actualDeparture: string | null;
    actualReturn: string | null;
    guardianConsent: boolean;
    status: string;
    isOverdue: boolean;
  }>;
  clinicVisits: Array<{
    id: string;
    visitNumber: string;
    visitDate: string;
    priority: string;
    outcome: string | null;
  }>;
  discipline: Array<{
    id: string;
    sanctionType: string;
    status: string;
    startDate: string;
    endDate: string | null;
    incidentTitle: string;
  }>;
}

interface PendingConsentItem {
  consentType: string;
  referenceType: string;
  referenceId: string;
  exeatNumber: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  reason: string;
  intendedDeparture: string;
  expectedReturn: string;
  status: string;
}

export function ParentPortalClient() {
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"academics" | "fees" | "welfare" | "consents" | "preferences">("academics");
  const [loading, setLoading] = useState<boolean>(true);
  const [academicReport, setAcademicReport] = useState<AcademicReportState | null>(null);
  const [feeStatement, setFeeStatement] = useState<FeeStatementState | null>(null);
  const [welfare, setWelfare] = useState<WelfareState | null>(null);
  const [pendingConsents, setPendingConsents] = useState<PendingConsentItem[]>([]);
  const [consentSignature, setConsentSignature] = useState<string>("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Preferences
  const [smsAlerts, setSmsAlerts] = useState<boolean>(true);
  const [emailAlerts, setEmailAlerts] = useState<boolean>(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState<boolean>(false);
  const [feeAlerts, setFeeAlerts] = useState<boolean>(true);
  const [academicAlerts, setAcademicAlerts] = useState<boolean>(true);

  // Initial load: Fetch children list
  useEffect(() => {
    async function loadChildren() {
      try {
        setLoading(true);
        const res = await fetch("/api/portal/parent/children");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setChildren(data.children || []);
        if (data.children && data.children.length > 0) {
          setSelectedStudentId(data.children[0].studentId);
        }
      } catch (err: unknown) {
        setActionError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadChildren();
  }, []);

  // Fetch student-specific tab details
  useEffect(() => {
    if (!selectedStudentId) return;

    async function loadTabData() {
      try {
        if (activeTab === "academics") {
          const res = await fetch(`/api/portal/parent/academics?studentId=${selectedStudentId}`);
          if (res.ok) {
            const data = await res.json();
            setAcademicReport(data);
          }
        } else if (activeTab === "fees") {
          const res = await fetch(`/api/portal/parent/fees?studentId=${selectedStudentId}`);
          if (res.ok) {
            const data = await res.json();
            setFeeStatement(data);
          }
        } else if (activeTab === "welfare") {
          const res = await fetch(`/api/portal/parent/welfare?studentId=${selectedStudentId}`);
          if (res.ok) {
            const data = await res.json();
            setWelfare(data);
          }
        } else if (activeTab === "consents") {
          const res = await fetch("/api/portal/parent/consents");
          if (res.ok) {
            const data = await res.json();
            setPendingConsents(data.pendingConsents || []);
          }
        }
      } catch {
        // silent fetch error handling
      }
    }

    loadTabData();
  }, [selectedStudentId, activeTab]);

  const activeChild = children.find((c) => c.studentId === selectedStudentId);

  const handleConsentDecision = async (item: PendingConsentItem, granted: boolean) => {
    try {
      setActionSuccess(null);
      setActionError(null);
      const res = await fetch("/api/portal/parent/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: item.studentId,
          consentType: item.consentType,
          referenceType: item.referenceType,
          referenceId: item.referenceId,
          granted,
          digitalSignature: consentSignature || activeChild?.relationship || "Guardian Digital Consent",
          notes: granted ? "Approved via Parent Portal" : "Declined by guardian"
        })
      });

      if (!res.ok) throw new Error(await res.text());

      setActionSuccess(`Consent successfully ${granted ? "approved" : "declined"} for Exeat ${item.exeatNumber}.`);
      setPendingConsents((prev) => prev.filter((p) => p.referenceId !== item.referenceId));
      setConsentSignature("");
    } catch (err: unknown) {
      setActionError((err as Error).message);
    }
  };

  if (loading && children.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-medium">Loading Guardian Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="text-blue-500" />
            Parent &amp; Guardian Portal
          </h1>
          <p className="text-sm text-slate-400">
            Real-time academic performance, fee statements, boarding welfare, and digital approvals.
          </p>
        </div>

        {/* Child Selector */}
        {children.length > 1 && (
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-xs font-semibold uppercase text-slate-400 pl-2">Select Student:</span>
            <div className="flex gap-2">
              {children.map((c) => (
                <button
                  key={c.studentId}
                  onClick={() => setSelectedStudentId(c.studentId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedStudentId === c.studentId
                      ? "bg-blue-600 text-white shadow"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {c.fullName} ({c.className || "Class"})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
          <XCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Student Profile Card */}
      {activeChild && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-2xl text-white shadow-md">
              {activeChild.firstName[0]}
              {activeChild.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">{activeChild.fullName}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {activeChild.admissionNo}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                  {activeChild.className || "Class Not Assigned"}
                  {activeChild.streamName ? ` • ${activeChild.streamName}` : ""}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Branch: <span className="text-slate-300">{activeChild.branch.name}</span> | Relationship:{" "}
                <span className="text-slate-300">{activeChild.relationship}</span>
                {activeChild.activeBed && (
                  <>
                    {" "}
                    | Hostel:{" "}
                    <span className="text-emerald-400 font-medium">
                      {activeChild.activeBed.hostelName} (Room {activeChild.activeBed.roomNumber}, Bed {activeChild.activeBed.bedNumber})
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
              <span className="text-xs text-slate-400 block">Fee Balance:</span>
              <span
                className={`text-lg font-bold ${
                  activeChild.outstandingBalance > 0 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                UGX {activeChild.outstandingBalance.toLocaleString()}
              </span>
            </div>

            {activeChild.pendingExeatCount > 0 && (
              <div
                onClick={() => setActiveTab("consents")}
                className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl cursor-pointer hover:bg-amber-500/20 transition-colors"
              >
                <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                  <AlertTriangle size={14} /> Action Required
                </span>
                <span className="text-sm font-bold text-white">
                  {activeChild.pendingExeatCount} Pending Exeat Approval
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("academics")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "academics"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <GraduationCap size={16} />
          Academic Reports
        </button>
        <button
          onClick={() => setActiveTab("fees")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "fees"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Receipt size={16} />
          Fees &amp; Payments
        </button>
        <button
          onClick={() => setActiveTab("welfare")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "welfare"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bed size={16} />
          Welfare &amp; Boarding
        </button>
        <button
          onClick={() => setActiveTab("consents")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors relative ${
            activeTab === "consents"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldCheck size={16} />
          Approvals &amp; Consents
          {pendingConsents.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-2 right-1" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("preferences")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "preferences"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bell size={16} />
          Notifications
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. ACADEMIC REPORTS TAB */}
      {activeTab === "academics" && (
        <div className="space-y-6">
          {academicReport?.isBlocked ? (
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-8 text-center max-w-2xl mx-auto space-y-4 shadow-lg">
              <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                <Lock size={28} />
              </div>
              <h3 className="text-xl font-bold text-white">Academic Report Card Hold</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {academicReport.message ||
                  "Your account has an outstanding fee balance. Please contact the accounts office to clear payments and access your academic reports."}
              </p>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl inline-block text-left text-xs text-slate-400">
                <div>Outstanding Balance: <span className="text-amber-400 font-bold">UGX {academicReport.outstandingBalance.toLocaleString()}</span></div>
                <div>School Clearance Threshold: <span className="text-slate-300 font-bold">UGX {academicReport.threshold.toLocaleString()}</span></div>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab("fees")}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition-colors inline-flex items-center gap-2"
                >
                  <CreditCard size={16} />
                  Proceed to Clear Fees
                </button>
              </div>
            </div>
          ) : academicReport?.results && academicReport.results.length > 0 ? (
            <div className="space-y-6">
              {academicReport.results.map((report) => (
                <div key={report.termResultId} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-white">{report.termName} - {report.academicYear}</h3>
                      <p className="text-xs text-slate-400">Class: {report.className}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Division</span>
                        <span className="text-sm font-bold text-emerald-400">{report.division || "N/A"}</span>
                      </div>
                      <div className="text-right pl-3 border-l border-slate-800">
                        <span className="text-xs text-slate-400 block">Aggregate</span>
                        <span className="text-sm font-bold text-blue-400">{report.aggregatePoints || "N/A"}</span>
                      </div>
                      <div className="text-right pl-3 border-l border-slate-800">
                        <span className="text-xs text-slate-400 block">Total Score</span>
                        <span className="text-sm font-bold text-white">{report.totalScore ? `${report.totalScore}%` : "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3 text-center">Score</th>
                          <th className="py-2.5 px-3 text-center">Grade</th>
                          <th className="py-2.5 px-3 text-center">Points</th>
                          <th className="py-2.5 px-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {report.subjects.map((sub) => (
                          <tr key={sub.subjectCode} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3 font-medium text-white">
                              {sub.subjectName} <span className="text-xs text-slate-500 font-mono">({sub.subjectCode})</span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-200">
                              {sub.score !== null ? `${sub.score}%` : "-"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {sub.grade || "-"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-slate-300">
                              {sub.points !== null ? sub.points : "-"}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-400 italic">
                              {sub.remarks || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <GraduationCap size={36} className="mx-auto text-slate-600 mb-3" />
              <p className="text-base font-semibold text-slate-300">No finalized report cards found</p>
              <p className="text-xs text-slate-500 mt-1">
                Report cards will appear once term assessments are finalized and published by the academic committee.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. FEES & PAYMENTS TAB */}
      {activeTab === "fees" && (
        <div className="space-y-6">
          {/* SchoolPay Uganda Card */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-950/40 border border-blue-900/40 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  SchoolPay Uganda Integrated
                </span>
                <h3 className="text-lg font-bold text-white mt-2">Instant Fee Payment Gateway</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Pay instantly via MTN Mobile Money, Airtel Money, or Stanbic Bank using student admission code.
                </p>
              </div>

              <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-400 block uppercase font-semibold">Student Payment Code</span>
                <span className="text-xl font-mono font-bold text-blue-400 tracking-wider">
                  {activeChild?.admissionNo || "NOVA-STUDENT"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">MTN: *165*4*3# | Airtel: *185*4*3#</span>
              </div>
            </div>
          </div>

          {/* Ledger Statement Table */}
          {feeStatement && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText size={18} className="text-blue-400" />
                  Chronological Account Subledger
                </h3>
                <div className="text-xs text-slate-400">
                  Total Billed: <span className="text-slate-200 font-bold">UGX {feeStatement.summary.totalDebits.toLocaleString()}</span> |{" "}
                  Total Paid: <span className="text-emerald-400 font-bold">UGX {feeStatement.summary.totalCredits.toLocaleString()}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Debit (UGX)</th>
                      <th className="py-2 px-3 text-right">Credit (UGX)</th>
                      <th className="py-2 px-3 text-right">Balance (UGX)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {feeStatement.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(tx.postedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {tx.entryType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-200">{tx.description}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-amber-400">
                          {tx.direction === "DEBIT" ? tx.amount.toLocaleString() : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-400">
                          {tx.direction === "CREDIT" ? tx.amount.toLocaleString() : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">
                          {tx.balanceAfter.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. WELFARE & BOARDING TAB */}
      {activeTab === "welfare" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hostel Room Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Bed size={18} className="text-emerald-400" />
              Dormitory &amp; Bed Allocation
            </h3>
            {welfare?.hostel ? (
              <div className="space-y-3">
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block">Hostel Dormitory</span>
                    <span className="text-base font-bold text-white">{welfare.hostel.hostelName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Room &amp; Bed</span>
                    <span className="text-base font-bold text-emerald-400">
                      Room {welfare.hostel.roomNumber} • Bed {welfare.hostel.bedNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Bed Type</span>
                    <span className="text-slate-300">{welfare.hostel.bedType}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Allocated Since</span>
                    <span className="text-slate-300">
                      {new Date(welfare.hostel.allocatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                Student is currently registered as a Day Scholar (no active dormitory bed).
              </div>
            )}
          </div>

          {/* Exeat History Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Clock size={18} className="text-blue-400" />
              Exeat Passes &amp; Gate Movements
            </h3>
            {welfare?.exeats && welfare.exeats.length > 0 ? (
              <div className="space-y-2">
                {welfare.exeats.slice(0, 5).map((e) => (
                  <div
                    key={e.id}
                    className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{e.exeatNumber}</span>
                        <span className="text-slate-400">({e.exeatType})</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{e.reason}</p>
                      <span className="text-slate-500 text-[10px]">
                        Departure: {new Date(e.intendedDeparture).toLocaleDateString()} • Return:{" "}
                        {new Date(e.expectedReturn).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          e.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : e.status === "DEPARTED"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {e.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">No exeat pass records.</div>
            )}
          </div>

          {/* Non-confidential Clinic Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 lg:col-span-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck size={18} className="text-purple-400" />
              Infirmary &amp; Clinic Visits (Sanitized Log)
            </h3>
            {welfare?.clinicVisits && welfare.clinicVisits.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Encounter</th>
                      <th className="py-2 px-3">Triage Priority</th>
                      <th className="py-2 px-3">Status / Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {welfare.clinicVisits.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 px-3 text-slate-300">
                          {new Date(c.visitDate).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">{c.visitNumber}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.priority === "EMERGENCY"
                                ? "bg-rose-500/20 text-rose-400"
                                : c.priority === "URGENT"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-blue-500/20 text-blue-400"
                            }`}
                          >
                            {c.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{c.outcome || "Treated & Discharged"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm">
                No infirmary visits recorded this term.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. APPROVALS & CONSENTS TAB */}
      {activeTab === "consents" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck size={18} className="text-amber-400" />
              Pending Parental Approvals &amp; Consents
            </h3>

            {pendingConsents.length > 0 ? (
              <div className="space-y-4">
                {pendingConsents.map((item) => (
                  <div
                    key={item.referenceId}
                    className="p-5 bg-slate-800/50 border border-amber-500/30 rounded-xl space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {item.consentType}
                        </span>
                        <h4 className="text-base font-bold text-white mt-1">
                          {item.studentName} ({item.admissionNo}) — Exeat Pass #{item.exeatNumber}
                        </h4>
                        <p className="text-xs text-slate-300 mt-1">
                          <strong className="text-slate-400">Reason:</strong> {item.reason}
                        </p>
                      </div>
                      <div className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <div>Departure: {new Date(item.intendedDeparture).toLocaleString()}</div>
                        <div>Return: {new Date(item.expectedReturn).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 border-t border-slate-700/60">
                      <input
                        type="text"
                        placeholder="Type Full Name as Digital Signature (e.g. Sarah Mukasa)"
                        value={consentSignature}
                        onChange={(e) => setConsentSignature(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleConsentDecision(item, true)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow"
                        >
                          <CheckCircle2 size={14} /> Approve Consent
                        </button>
                        <button
                          onClick={() => handleConsentDecision(item, false)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-rose-600/80 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow"
                        >
                          <XCircle size={14} /> Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm">
                <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                <p className="font-semibold text-slate-200">No pending consents</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  All exeat gate passes and school activity permissions are up-to-date.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. NOTIFICATION PREFERENCES TAB */}
      {activeTab === "preferences" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Bell size={18} className="text-blue-400" />
            Communication &amp; Alert Channels
          </h3>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery Channels</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsAlerts}
                  onChange={(e) => setSmsAlerts(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-white block">SMS Notifications</span>
                  <span className="text-xs text-slate-400">Direct text messages to registered phone</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-white block">Email Statements</span>
                  <span className="text-xs text-slate-400">Itemized invoices &amp; PDF report cards</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappAlerts}
                  onChange={(e) => setWhatsappAlerts(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-white block">WhatsApp Alerts</span>
                  <span className="text-xs text-slate-400">Instant gate checkout notifications</span>
                </div>
              </label>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-3">Notification Topics</h4>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
                <span className="text-sm text-slate-200">Fee Invoices &amp; Payment Receipts</span>
                <input
                  type="checkbox"
                  checked={feeAlerts}
                  onChange={(e) => setFeeAlerts(e.target.checked)}
                  className="rounded text-blue-600"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
                <span className="text-sm text-slate-200">Term Academic Reports &amp; Assessment Releases</span>
                <input
                  type="checkbox"
                  checked={academicAlerts}
                  onChange={(e) => setAcademicAlerts(e.target.checked)}
                  className="rounded text-blue-600"
                />
              </label>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setActionSuccess("Notification preferences successfully saved.")}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
