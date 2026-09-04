"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  BookOpen,
  Calendar,
  Ticket,
  Lock,
  Bed,
  CheckCircle2,
  XCircle,
  QrCode,
  Plus,
  Send,
  User
} from "lucide-react";

interface StudentDashboardState {
  profile: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
    fullName: string;
    gender: string | null;
    branch: { id: string; name: string };
    className: string | null;
    streamName: string | null;
    lifecycleStatus: string;
  };
  hostel: {
    hostelName: string;
    roomNumber: string;
    bedNumber: string;
    bedType: string;
  } | null;
  enrollment: {
    academicYear: string;
    className: string;
    streamName: string | null;
    subjects: Array<{
      id: string;
      code: string;
      name: string;
    }>;
  } | null;
  attendance: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    attendancePercentage: number;
  };
  reportAccess: {
    isBlocked: boolean;
    status: string;
    message: string | null;
  };
  activeExeats: Array<{
    id: string;
    exeatNumber: string;
    exeatType: string;
    reason: string;
    intendedDeparture: string;
    expectedReturn: string;
    guardianConsent: boolean;
    status: string;
    isOverdue: boolean;
    qrVerificationToken: string;
  }>;
  activeSanctions: Array<{
    id: string;
    sanctionType: string;
    startDate: string;
    endDate: string | null;
    incidentTitle: string;
  }>;
}

interface AcademicReportsState {
  accessStatus: string;
  isBlocked: boolean;
  message: string | null;
  results: Array<{
    termResultId: string;
    termName: string;
    academicYear: string;
    className: string;
    totalScore: number | null;
    aggregatePoints: number | null;
    division: string | null;
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

export function StudentPortalClient() {
  const [dashboard, setDashboard] = useState<StudentDashboardState | null>(null);
  const [academics, setAcademics] = useState<AcademicReportsState | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "academics" | "subjects" | "exeats">("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [showExeatModal, setShowExeatModal] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states for new Exeat
  const [exeatType, setExeatType] = useState<string>("WEEKEND");
  const [exeatReason, setExeatReason] = useState<string>("");
  const [departureDate, setDepartureDate] = useState<string>("");
  const [returnDate, setReturnDate] = useState<string>("");
  const [accompanyingAdult, setAccompanyingAdult] = useState<string>("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const res = await fetch("/api/portal/student/dashboard");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setDashboard(data);
      } catch (err: unknown) {
        setActionError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === "academics") {
      async function loadAcademics() {
        try {
          const res = await fetch("/api/portal/student/academics");
          if (res.ok) {
            const data = await res.json();
            setAcademics(data);
          }
        } catch {
          // silent error handling
        }
      }
      loadAcademics();
    }
  }, [activeTab]);

  const handleSubmitExeat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionSuccess(null);
      setActionError(null);

      const res = await fetch("/api/portal/student/exeats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: dashboard?.profile.id,
          exeatType,
          reason: exeatReason,
          intendedDeparture: departureDate,
          expectedReturn: returnDate,
          accompanyingAdult: accompanyingAdult || undefined
        })
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setActionSuccess(`Exeat pass #${data.exeat.exeatNumber} requested successfully! Forwarded for guardian consent.`);
      setShowExeatModal(false);
      setExeatReason("");
      setDepartureDate("");
      setReturnDate("");
      setAccompanyingAdult("");

      // Refresh dashboard
      const refreshed = await fetch("/api/portal/student/dashboard");
      if (refreshed.ok) setDashboard(await refreshed.json());
    } catch (err: unknown) {
      setActionError((err as Error).message);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-medium">Loading Student Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Profile Card */}
      {dashboard && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-3xl text-white shadow-lg">
              {dashboard.profile.firstName[0]}
              {dashboard.profile.lastName[0]}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {dashboard.profile.fullName}
                </h1>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {dashboard.profile.admissionNo}
                </span>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {dashboard.profile.lifecycleStatus}
                </span>
              </div>
              <p className="text-sm text-slate-400">
                {dashboard.profile.className || "Class"}{" "}
                {dashboard.profile.streamName ? `• ${dashboard.profile.streamName}` : ""} |{" "}
                <span className="text-slate-300">{dashboard.profile.branch.name}</span>
              </p>
              {dashboard.hostel ? (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                  <Bed size={14} /> Boarder: {dashboard.hostel.hostelName} (Room {dashboard.hostel.roomNumber}, Bed {dashboard.hostel.bedNumber})
                </p>
              ) : (
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <User size={14} /> Day Scholar
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 text-center min-w-[120px]">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block">Attendance</span>
              <span className="text-2xl font-black text-emerald-400">
                {dashboard.attendance.attendancePercentage}%
              </span>
              <span className="text-[10px] text-slate-500 block">
                {dashboard.attendance.presentDays} of {dashboard.attendance.totalDays} days
              </span>
            </div>

            <button
              onClick={() => setShowExeatModal(true)}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-lg transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> Request Exeat
            </button>
          </div>
        </div>
      )}

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-sm flex items-center gap-2">
          <XCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "overview"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Calendar size={16} /> Overview
        </button>
        <button
          onClick={() => setActiveTab("academics")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "academics"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <GraduationCap size={16} /> Academic Reports
          {dashboard?.reportAccess.isBlocked && <Lock size={12} className="text-amber-400" />}
        </button>
        <button
          onClick={() => setActiveTab("subjects")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "subjects"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen size={16} /> My Subjects
        </button>
        <button
          onClick={() => setActiveTab("exeats")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "exeats"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Ticket size={16} /> Exeat Gate Passes
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Active Gate Pass status */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Ticket size={18} className="text-blue-400" />
              Latest Exeat Status
            </h3>
            {dashboard.activeExeats.length > 0 ? (
              <div className="space-y-3">
                {dashboard.activeExeats.slice(0, 1).map((e) => (
                  <div key={e.id} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{e.exeatNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          e.status === "APPROVED" || e.status === "DEPARTED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {e.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{e.reason}</p>
                    <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Guardian Consent: {e.guardianConsent ? "Granted" : "Pending"}</span>
                      {e.qrVerificationToken && (
                        <span className="font-mono text-blue-400 flex items-center gap-1">
                          <QrCode size={12} /> QR Ready
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No active exeat pass.</p>
            )}
          </div>

          {/* Academic Report Quick Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <GraduationCap size={18} className="text-purple-400" />
              Report Card Access
            </h3>
            {dashboard.reportAccess.isBlocked ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Lock size={14} /> Debtor Clearance Required
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Terminal report card is currently withheld due to outstanding school balance.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 size={14} /> Full Access Unlocked
                </div>
                <p className="text-xs text-slate-300">
                  Your academic records and terminal grades are accessible.
                </p>
                <button
                  onClick={() => setActiveTab("academics")}
                  className="text-xs font-bold text-blue-400 hover:underline pt-1 block"
                >
                  View Academic Reports &rarr;
                </button>
              </div>
            )}
          </div>

          {/* Enrolled Curriculum Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <BookOpen size={18} className="text-emerald-400" />
              Enrolled Subjects
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Subjects</span>
              <span className="text-xl font-bold text-white">
                {dashboard.enrollment?.subjects.length || 0}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {dashboard.enrollment?.subjects.slice(0, 6).map((s) => (
                <span
                  key={s.id}
                  className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700/60"
                >
                  {s.name}
                </span>
              ))}
              {(dashboard.enrollment?.subjects.length || 0) > 6 && (
                <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400">
                  +{(dashboard.enrollment?.subjects.length || 0) - 6} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACADEMICS TAB */}
      {activeTab === "academics" && (
        <div className="space-y-6">
          {academics?.isBlocked ? (
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-4 shadow-lg">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-bold text-white">Report Card Held</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {academics.message ||
                  "Access to your official report card is restricted due to an outstanding fee balance. Please notify your parent or sponsor to settle the account with the bursar."}
              </p>
            </div>
          ) : academics?.results && academics.results.length > 0 ? (
            <div className="space-y-6">
              {academics.results.map((r) => (
                <div key={r.termResultId} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-white">{r.termName} - {r.academicYear}</h3>
                      <p className="text-xs text-slate-400">Class: {r.className}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-xs text-slate-400 block">Division</span>
                        <span className="text-base font-bold text-emerald-400">{r.division || "-"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block">Aggregate</span>
                        <span className="text-base font-bold text-blue-400">{r.aggregatePoints || "-"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3 text-center">Score</th>
                          <th className="py-2.5 px-3 text-center">Grade</th>
                          <th className="py-2.5 px-3 text-center">Points</th>
                          <th className="py-2.5 px-3">Teacher Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {r.subjects.map((s) => (
                          <tr key={s.subjectCode} className="hover:bg-slate-800/40">
                            <td className="py-3 px-3 font-medium text-white">{s.subjectName}</td>
                            <td className="py-3 px-3 text-center font-bold text-slate-200">
                              {s.score !== null ? `${s.score}%` : "-"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-400">
                                {s.grade || "-"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-300 font-semibold">
                              {s.points !== null ? s.points : "-"}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-400 italic">
                              {s.remarks || "-"}
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
            <div className="text-center py-12 text-slate-400 text-sm">
              <GraduationCap size={40} className="mx-auto text-slate-600 mb-2" />
              No finalized academic reports available yet.
            </div>
          )}
        </div>
      )}

      {/* SUBJECTS TAB */}
      {activeTab === "subjects" && dashboard?.enrollment && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <BookOpen size={18} className="text-blue-400" />
            Curriculum Subjects ({dashboard.enrollment.academicYear} - {dashboard.enrollment.className})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard.enrollment.subjects.map((sub) => (
              <div key={sub.id} className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-1">
                <span className="text-xs font-mono font-bold text-blue-400">{sub.code}</span>
                <h4 className="text-sm font-bold text-white">{sub.name}</h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXEATS TAB */}
      {activeTab === "exeats" && dashboard && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">Exeat Passes &amp; Gate Verification</h3>
            <button
              onClick={() => setShowExeatModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow"
            >
              <Plus size={14} /> New Exeat Request
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboard.activeExeats.map((e) => (
              <div
                key={e.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 relative overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-mono text-slate-400 block">{e.exeatNumber}</span>
                    <h4 className="text-base font-bold text-white capitalize">{e.exeatType} Exeat</h4>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      e.status === "COMPLETED"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : e.status === "DEPARTED"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  <strong className="text-slate-400">Reason:</strong> {e.reason}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-800/40 p-3 rounded-xl">
                  <div>
                    <span className="block text-[10px] uppercase font-semibold">Departure</span>
                    <span className="text-slate-200">{new Date(e.intendedDeparture).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-semibold">Return</span>
                    <span className="text-slate-200">{new Date(e.expectedReturn).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Digital Verification QR Badge */}
                <div className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-blue-400 block">
                      Gate Security QR Token
                    </span>
                    <span className="text-xs font-mono text-slate-300">
                      {e.qrVerificationToken.substring(0, 16)}...
                    </span>
                  </div>
                  <QrCode size={24} className="text-blue-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REQUEST EXEAT MODAL */}
      {showExeatModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Ticket className="text-blue-500" /> Request Exeat Gate Pass
              </h3>
              <button
                onClick={() => setShowExeatModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitExeat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Exeat Type
                </label>
                <select
                  value={exeatType}
                  onChange={(e) => setExeatType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="WEEKEND">Weekend Exeat</option>
                  <option value="MEDICAL">Medical Exeat</option>
                  <option value="EMERGENCY">Emergency Family Exeat</option>
                  <option value="DAY_PASS">Day Pass</option>
                  <option value="SPECIAL_EVENT">Special Event</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Reason for Exeat
                </label>
                <textarea
                  required
                  rows={3}
                  value={exeatReason}
                  onChange={(e) => setExeatReason(e.target.value)}
                  placeholder="State specific reason for leaving school premises..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Departure Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Expected Return
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Accompanying Adult / Pick-up Person
                </label>
                <input
                  type="text"
                  value={accompanyingAdult}
                  onChange={(e) => setAccompanyingAdult(e.target.value)}
                  placeholder="Full name of person picking you up (if any)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
                />
              </div>

              <p className="text-[11px] text-amber-400/90 leading-relaxed bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                Notice: All exeat requests require digital authorization by your registered parent/guardian before final clearance by the boarding master.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExeatModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow"
                >
                  <Send size={14} /> Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
