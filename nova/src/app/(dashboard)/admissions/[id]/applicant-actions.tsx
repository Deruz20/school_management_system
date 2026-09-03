"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApplicantStatus, Class, Stream, FeeStructure, TransportRoute, EnrollmentProvisioning } from "@prisma/client";
import { CheckCircle, AlertTriangle, RefreshCw, Sparkles, Send, CheckCircle2 } from "lucide-react";

interface ApplicantDetail {
  id: string;
  applicationNumber: string;
  status: ApplicantStatus;
  targetClassId: string;
  targetStreamId?: string | null;
  assessmentScore?: number | null;
  assessmentNotes?: string | null;
  decisionReason?: string | null;
  offerValidUntil?: Date | string | null;
  intendedTransportRouteId?: string | null;
  enrolledStudentId?: string | null;
}

interface ActionsProps {
  applicant: ApplicantDetail;
  classes: (Class & { streams: Stream[] })[];
  feeStructures: FeeStructure[];
  transportRoutes: TransportRoute[];
  provisioning: EnrollmentProvisioning | null;
}

export function ApplicantActions({
  applicant,
  classes,
  feeStructures,
  transportRoutes,
  provisioning
}: ActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assessment state
  const [score, setScore] = useState(applicant.assessmentScore?.toString() || "");
  const [assessmentNotes, setAssessmentNotes] = useState(applicant.assessmentNotes || "");

  // Offer state
  const [decisionReason, setDecisionReason] = useState(applicant.decisionReason || "Met entrance academic standards.");
  const [validDays, setValidDays] = useState(14);

  // Enrollment options state
  const [enrollClassId, setEnrollClassId] = useState(applicant.targetClassId);
  const [enrollStreamId, setEnrollStreamId] = useState(applicant.targetStreamId || "");
  const [autoBill, setAutoBill] = useState(true);
  const [feeStructureId, setFeeStructureId] = useState("");
  const [transportRouteId, setTransportRouteId] = useState(applicant.intendedTransportRouteId || "");

  const selectedClass = classes.find((c) => c.id === enrollClassId);

  // 1. Record Assessment
  const handleRecordAssessment = async () => {
    if (!score) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admissions/applicants/${applicant.id}/assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: parseFloat(score),
          notes: assessmentNotes || undefined
        })
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to record assessment.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Issue Offer (Maker-Checker)
  const handleIssueOffer = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admissions/applicants/${applicant.id}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionReason,
          validDays
        })
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to issue admission offer.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Accept Offer
  const handleAcceptOffer = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admissions/applicants/${applicant.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to accept offer.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Single-Click Onboarding Pipeline
  const handleEnrollApplicant = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admissions/applicants/${applicant.id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetClassId: enrollClassId,
          targetStreamId: enrollStreamId || null,
          autoBill,
          feeStructureId: feeStructureId || undefined,
          transportRouteId: transportRouteId || undefined
        })
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to enroll applicant.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Retry Provisioning
  const handleRetryProvisioning = async () => {
    if (!provisioning) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admissions/enrollments/${provisioning.id}/retry-provisioning`, {
        method: "POST"
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to retry provisioning.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Assessment Card */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3">
        <h3 className="font-semibold text-slate-900 text-sm flex items-center justify-between">
          <span>1. Diagnostic Assessment</span>
          {applicant.assessmentScore !== null && (
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
              Score: {applicant.assessmentScore}%
            </span>
          )}
        </h3>

        {applicant.status !== ApplicantStatus.ENROLLED && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Score (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                placeholder="e.g. 78"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Rubric Notes</label>
              <input
                type="text"
                value={assessmentNotes}
                onChange={(e) => setAssessmentNotes(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                placeholder="Interview notes..."
              />
            </div>
            <Button
              onClick={handleRecordAssessment}
              disabled={loading || !score}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Record Assessment
            </Button>
          </div>
        )}
      </div>

      {/* Step 2: 4-Eye Offer Approval */}
      {applicant.status !== ApplicantStatus.ENROLLED && (
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3">
          <h3 className="font-semibold text-slate-900 text-sm flex items-center justify-between">
            <span>2. Formal Admission Offer</span>
            <span className="text-xs text-slate-400">4-Eye Maker-Checker</span>
          </h3>

          {applicant.status === ApplicantStatus.ADMISSION_OFFERED ? (
            <div className="flex flex-col gap-2">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                Offer issued! Valid until{" "}
                <strong>
                  {applicant.offerValidUntil ? new Date(applicant.offerValidUntil).toLocaleDateString() : 'N/A'}
                </strong>.
              </div>
              <Button
                onClick={handleAcceptOffer}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                <CheckCircle size={14} className="mr-1.5" />
                Record Guardian Acceptance
              </Button>
            </div>
          ) : applicant.status === ApplicantStatus.OFFER_ACCEPTED ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Offer Accepted. Ready for Single-Click Onboarding.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Decision Justification</label>
                <input
                  type="text"
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Validity (Days)</label>
                <input
                  type="number"
                  value={validDays}
                  onChange={(e) => setValidDays(parseInt(e.target.value) || 14)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <Button
                onClick={handleIssueOffer}
                disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                <Send size={14} className="mr-1.5" />
                Issue Formal Offer
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Single-Click Onboarding Pipeline */}
      {applicant.status !== ApplicantStatus.ENROLLED && (
        <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/40 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 text-blue-900 font-semibold text-sm">
            <Sparkles size={16} className="text-blue-600" />
            <span>3. Single-Click Onboarding</span>
          </div>

          <div className="flex flex-col gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-600 mb-1">Placement Class</label>
              <select
                value={enrollClassId}
                onChange={(e) => setEnrollClassId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-600 mb-1">Placement Stream</label>
              <select
                value={enrollStreamId}
                onChange={(e) => setEnrollStreamId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
              >
                <option value="">No Stream (General)</option>
                {selectedClass?.streams.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-600 mb-1">Fee Structure (Auto-Billing)</label>
              <select
                value={feeStructureId}
                onChange={(e) => setFeeStructureId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
              >
                <option value="">Auto-Detect Active Structure</option>
                {feeStructures.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-600 mb-1">Transport Route</label>
              <select
                value={transportRouteId}
                onChange={(e) => setTransportRouteId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
              >
                <option value="">No Transport Subscription</option>
                {transportRoutes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.destinationZone || 'Zone'})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoBill"
                checked={autoBill}
                onChange={(e) => setAutoBill(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              <label htmlFor="autoBill" className="text-slate-700 cursor-pointer font-medium">
                Auto-generate initial invoice (AR Control #1200)
              </label>
            </div>

            <Button
              onClick={handleEnrollApplicant}
              disabled={loading || (applicant.status !== ApplicantStatus.OFFER_ACCEPTED && applicant.status !== ApplicantStatus.ADMISSION_OFFERED)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold mt-1"
            >
              {loading ? "Onboarding..." : "Enroll & Provision Student"}
            </Button>
          </div>
        </div>
      )}

      {/* Provisioning Tracker (Post-Commit Execution State) */}
      {provisioning && (
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">Provisioning Health Tracker</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              provisioning.overallStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {provisioning.overallStatus}
            </span>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-slate-50">
              <span className="text-slate-600 font-medium">1. Financial Billing (#1200):</span>
              <span className="font-mono font-semibold">{provisioning.billingStatus}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50">
              <span className="text-slate-600 font-medium">2. Requirements Blueprint:</span>
              <span className="font-mono font-semibold">{provisioning.requirementsStatus}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50">
              <span className="text-slate-600 font-medium">3. Transport Route:</span>
              <span className="font-mono font-semibold">{provisioning.transportStatus}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50">
              <span className="text-slate-600 font-medium">4. Store / Uniform Order:</span>
              <span className="font-mono font-semibold">{provisioning.storeOrderStatus}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50">
              <span className="text-slate-600 font-medium">5. SchoolPay Roster Sync:</span>
              <span className="font-mono font-semibold">{provisioning.schoolPayStatus}</span>
            </div>
          </div>

          {provisioning.overallStatus !== 'COMPLETED' && (
            <Button
              onClick={handleRetryProvisioning}
              disabled={loading}
              variant="outline"
              size="sm"
              className="w-full gap-1.5 mt-2"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Retry Pending Tasks</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
