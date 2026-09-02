'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ClearanceRecord {
  id: string;
  clearanceNumber: string;
  clearanceType: 'EXAM_PERMIT' | 'GATE_PASS' | 'TERM_REGISTRATION' | 'REPORT_CARD';
  status: 'CLEARED' | 'PROVISIONAL' | 'BLOCKED';
  docStatus: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  ledgerBalance: string;
  feesPaidPercent: string;
  requirementsFulfilled: boolean;
  provisionalReason: string | null;
  revocationReason: string | null;
  issuedAt: string;
  validUntil: string | null;
  verificationToken: string;
  student: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
    classRef?: { name: string } | null;
  };
  academicYear: { name: string };
  term: { name: string } | null;
  authorizedBy: { firstName: string; lastName: string };
}

export default function ClearanceHubPage() {
  const [clearances, setClearances] = useState<ClearanceRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Selected permit for viewing/printing
  const [activePermit, setActivePermit] = useState<ClearanceRecord | null>(null);

  // Revocation modal
  const [revokingPermitId, setRevokingPermitId] = useState<string | null>(null);
  const [revocationReason, setRevocationReason] = useState('');

  // Initial lookup
  useEffect(() => {
    async function loadYears() {
      try {
        const res = await fetch('/api/academic-years');
        if (res.ok) {
          const data = await res.json();
          setAcademicYears(data.academicYears || []);
          if (data.academicYears?.length > 0) {
            setSelectedYearId(data.academicYears[0].id);
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load academic years', err);
      }
    }
    loadYears();
  }, []);

  useEffect(() => {
    if (!selectedYearId) return;

    let ignore = false;
    async function loadClearances() {
      setIsLoading(true);
      setError(null);
      try {
        const url = `/api/clearance?academicYearId=${selectedYearId}${statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''}${searchQuery ? `&search=${searchQuery}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!ignore) setClearances(data.records || []);
      } catch (err: unknown) {
        if (!ignore) setError((err as Error).message);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadClearances();
    return () => {
      ignore = true;
    };
  }, [selectedYearId, statusFilter, searchQuery]);

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingPermitId || !revocationReason.trim()) return;

    try {
      setError(null);
      const res = await fetch(`/api/clearance/${revokingPermitId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revocationReason.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setActionSuccess('Clearance permit successfully revoked.');
      setRevokingPermitId(null);
      setRevocationReason('');

      // Refresh list
      const url = `/api/clearance?academicYearId=${selectedYearId}`;
      const refreshRes = await fetch(url);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setClearances(data.records || []);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
              Finance 3.1H
            </span>
            <span className="text-xs text-gray-500 font-mono">EXAM PERMITS &amp; GATE PASSES</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1">
            Student Financial Clearance &amp; Exam Permits
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Automated ledger &amp; requirements evaluation, official exam permits, gate passes, and QR validation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/finance/requirements"
            className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition shadow-sm"
          >
            📦 School Requirements Tracker
          </Link>
          <Link
            href="/finance"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Finance Home
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="CLEARED">✅ Cleared</option>
              <option value="PROVISIONAL">⚠️ Provisional</option>
              <option value="BLOCKED">🚫 Blocked</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Search Student / Permit</label>
            <input
              type="text"
              placeholder="Name, Admission No, Permit #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 w-64 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-900 font-bold ml-4">✕</button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center justify-between">
          <span>✅ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-950 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Clearance Roster Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Issued Clearance Documents ({clearances.length})
          </h2>
          <span className="text-xs text-gray-500 font-medium">Click on any permit number to preview or print</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading clearances...</div>
        ) : clearances.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No clearance documents issued yet for this academic year.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
                <tr>
                  <th className="p-3">Permit #</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Ledger Balance</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Doc Status</th>
                  <th className="p-3">Issued By</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clearances.map((c) => {
                  const bal = parseFloat(c.ledgerBalance);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
                      <td className="p-3 font-mono text-xs font-bold text-emerald-700">
                        <button
                          onClick={() => setActivePermit(c)}
                          className="hover:underline flex items-center gap-1"
                        >
                          📄 {c.clearanceNumber}
                        </button>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 border border-gray-200">
                          {c.clearanceType}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-gray-900">
                        {c.student.firstName} {c.student.lastName}
                        <div className="text-xs font-mono text-gray-400">{c.student.admissionNo}</div>
                      </td>
                      <td className="p-3 text-xs text-gray-700">{c.student.classRef?.name || 'Class'}</td>
                      <td className="p-3 font-mono text-xs">
                        {bal > 0 ? (
                          <span className="text-red-600 font-bold">UGX {bal.toLocaleString()} (Debt)</span>
                        ) : bal < 0 ? (
                          <span className="text-emerald-600 font-bold">UGX {Math.abs(bal).toLocaleString()} (Credit)</span>
                        ) : (
                          <span className="text-gray-600 font-semibold">UGX 0 (Settled)</span>
                        )}
                      </td>
                      <td className="p-3">
                        {c.status === 'CLEARED' ? (
                          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                            ✅ Cleared
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                            ⚠️ Provisional
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {c.docStatus === 'ACTIVE' ? (
                          <span className="text-xs font-bold text-emerald-700">✓ Active</span>
                        ) : (
                          <span className="text-xs font-bold text-red-600">✕ Revoked</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-gray-600">
                        {c.authorizedBy.firstName} {c.authorizedBy.lastName}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setActivePermit(c)}
                            className="px-2.5 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
                          >
                            🖨️ Print
                          </button>
                          {c.docStatus === 'ACTIVE' && (
                            <button
                              onClick={() => setRevokingPermitId(c.id)}
                              className="px-2.5 py-1 text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 rounded border border-red-200"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRINTABLE PERMIT MODAL */}
      {activePermit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 space-y-6">
            {/* School Header */}
            <div className="text-center border-b border-gray-200 pb-4">
              <span className="text-xs font-bold tracking-widest text-emerald-700 uppercase">NOVA SMART SCHOOLS HUB</span>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-1">
                OFFICIAL {activePermit.clearanceType.replace('_', ' ')}
              </h2>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                PERMIT NO: <b className="text-gray-900">{activePermit.clearanceNumber}</b> • {activePermit.academicYear.name}
              </p>
            </div>

            {/* Student Card Details */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm">
              <div>
                <p className="text-xs text-gray-500 font-semibold">Student Full Name</p>
                <p className="font-bold text-gray-900 text-base">
                  {activePermit.student.firstName} {activePermit.student.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold">Admission Number</p>
                <p className="font-mono font-bold text-gray-900">{activePermit.student.admissionNo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold">Class / Stream</p>
                <p className="font-semibold text-gray-800">{activePermit.student.classRef?.name || 'Assigned Class'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold">Clearance Status</p>
                <p className="font-bold text-emerald-700">{activePermit.status} {activePermit.docStatus === 'REVOKED' && '(REVOKED)'}</p>
              </div>
            </div>

            {/* Verification QR simulation */}
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase">Digital QR Verification</span>
                <p className="text-xs text-emerald-950 mt-0.5">
                  Scan to verify authenticity against school ledger records.
                </p>
                <p className="text-xs font-mono text-gray-400 mt-2">
                  Token: {activePermit.verificationToken.slice(0, 16)}...
                </p>
              </div>
              <div className="w-20 h-20 bg-white border-2 border-emerald-600 rounded-lg flex items-center justify-center font-mono text-xs text-emerald-800 font-black shadow-inner">
                [QR CODE]
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <Link
                href={`/verify/clearance/${activePermit.verificationToken}`}
                target="_blank"
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                🌐 Open Public Verification Page ↗
              </Link>
              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"
                >
                  🖨️ Print Permit
                </button>
                <button
                  onClick={() => setActivePermit(null)}
                  className="px-4 py-2 text-xs font-bold bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVOCATION MODAL */}
      {revokingPermitId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRevoke} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-600">Revoke Clearance Permit</h3>
            <p className="text-xs text-gray-600">
              Revoking this permit will instantly block the student at gate check-ins and invalidate QR scans.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Revocation Reason (Mandatory)</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Dishonored cheque or payment reversed..."
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setRevokingPermitId(null); setRevocationReason(''); }}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm"
              >
                Confirm Revocation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
