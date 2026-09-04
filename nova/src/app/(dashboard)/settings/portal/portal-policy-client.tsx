"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  Users,
  Save,
  CheckCircle2,
  XCircle
} from "lucide-react";

interface PolicyState {
  id: string;
  branchId: string;
  allowStudentAccess: boolean;
  allowParentAccess: boolean;
  enforceFeeBlockOnReports: boolean;
  outstandingFeeThreshold: number | string;
  blockMessage: string;
}

export function PortalPolicyClient() {
  const [policy, setPolicy] = useState<PolicyState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [allowStudent, setAllowStudent] = useState<boolean>(true);
  const [allowParent, setAllowParent] = useState<boolean>(true);
  const [enforceFeeBlock, setEnforceFeeBlock] = useState<boolean>(true);
  const [threshold, setThreshold] = useState<string>("0");
  const [blockMessage, setBlockMessage] = useState<string>("");

  useEffect(() => {
    async function loadPolicy() {
      try {
        setLoading(true);
        const res = await fetch("/api/portal/policy");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setPolicy(data);
        setAllowStudent(data.allowStudentAccess);
        setAllowParent(data.allowParentAccess);
        setEnforceFeeBlock(data.enforceFeeBlockOnReports);
        setThreshold(data.outstandingFeeThreshold?.toString() || "0");
        setBlockMessage(data.blockMessage || "");
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadPolicy();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccess(null);
      setError(null);

      const res = await fetch("/api/portal/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowStudentAccess: allowStudent,
          allowParentAccess: allowParent,
          enforceFeeBlockOnReports: enforceFeeBlock,
          outstandingFeeThreshold: parseFloat(threshold) || 0,
          blockMessage
        })
      });

      if (!res.ok) throw new Error(await res.text());

      const updated = await res.json();
      setPolicy(updated);
      setSuccess("Portal access and debtor report hold policies updated successfully!");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !policy) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-medium">Loading Portal Policy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <ShieldCheck className="text-blue-500" />
          Portal Access &amp; Debtor Control Policy
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Define global portal availability, automated Debtor Report Card holds, and outstanding fee tolerances.
        </p>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-sm flex items-center gap-2">
          <XCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Availability Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Users size={18} className="text-blue-400" />
            Portal Availability
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 p-4 bg-slate-800/40 border border-slate-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={allowParent}
                onChange={(e) => setAllowParent(e.target.checked)}
                className="mt-1 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-bold text-white block">Parent &amp; Guardian Portal</span>
                <span className="text-xs text-slate-400">
                  Allow guardians to log in, view student reports, review fees, and sign digital consents.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 bg-slate-800/40 border border-slate-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={allowStudent}
                onChange={(e) => setAllowStudent(e.target.checked)}
                className="mt-1 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-bold text-white block">Student Portal</span>
                <span className="text-xs text-slate-400">
                  Allow enrolled students to view timetable, academic grades, and generate exeat passes.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Debtor Block Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock size={18} className="text-amber-400" />
              Automated Debtor Report Card Withholding
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              GL #1200 Enforced
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            When enabled, the portal automatically calculates net student balances from authoritative ledger entries (Debits - Credits).
            Students whose outstanding balance exceeds the clearance threshold are blocked from viewing finalized report card marks.
          </p>

          <div className="space-y-4 pt-2">
            <label className="flex items-center gap-3 p-4 bg-slate-800/40 border border-slate-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={enforceFeeBlock}
                onChange={(e) => setEnforceFeeBlock(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-bold text-white block">Enforce Fee Clearance on Report Cards</span>
                <span className="text-xs text-slate-400">
                  Automatically hide report card grades if net debtor balance exceeds threshold.
                </span>
              </div>
            </label>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Outstanding Balance Threshold (UGX)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">UGX</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Set to 0 to require 100% zero-debt clearance before report cards are visible.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Custom Debtor Alert Message
              </label>
              <textarea
                rows={3}
                value={blockMessage}
                onChange={(e) => setBlockMessage(e.target.value)}
                placeholder="Message shown to parents and students when report card is locked..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-lg"
          >
            <Save size={16} />
            {saving ? "Saving Policy..." : "Save Policy Configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}
