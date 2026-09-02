'use client';

import React, { useState, useEffect } from 'react';

interface VerificationData {
  isValid: boolean;
  docStatus: string;
  reason?: string;
  permit?: {
    clearanceNumber: string;
    clearanceType: string;
    status: string;
    docStatus: string;
    studentName: string;
    studentAdmissionNo: string;
    className: string;
    academicYearName: string;
    termName: string | null;
    issuedAt: string;
    validUntil: string | null;
    authorizedByName: string;
    provisionalReason: string | null;
    revocationReason: string | null;
  };
}

export default function PublicQRVerificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = React.use(params);
  const [data, setData] = useState<VerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/clearance/verify/${resolvedParams.token}`);
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        setData(result);
      } catch (err: unknown) {
        setError((err as Error).message || 'Verification failed');
      } finally {
        setIsLoading(false);
      }
    }
    verify();
  }, [resolvedParams.token]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-700 space-y-6">
        {/* Verification Top Banner */}
        <div className="bg-slate-950 p-6 text-center text-white border-b border-slate-800">
          <div className="inline-block px-3 py-1 bg-emerald-900/60 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
            NOVA Cryptographic Verification
          </div>
          <h1 className="text-xl font-black tracking-tight">Official Student Clearance Seal</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">Token: {resolvedParams.token.slice(0, 16)}...</p>
        </div>

        <div className="p-6 pt-0 space-y-6">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">Verifying signature on blockchain ledger...</div>
          ) : error || !data || !data.isValid ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
                <span className="text-3xl">🚫</span>
                <h3 className="text-base font-bold text-red-700">INVALID OR REVOKED CLEARANCE</h3>
                <p className="text-xs text-red-600">
                  {data?.reason === 'REVOKED'
                    ? `This permit was explicitly revoked: "${data.permit?.revocationReason || 'Administrative revocation'}"`
                    : data?.reason === 'EXPIRED'
                    ? 'This permit has passed its validity expiration date.'
                    : 'This cryptographic QR token does not exist or has been tampered with.'}
                </p>
              </div>

              {data?.permit && (
                <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-2 text-slate-600 border border-slate-200">
                  <div className="flex justify-between">
                    <span>Student:</span>
                    <b className="text-slate-900">{data.permit.studentName}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Permit:</span>
                    <b className="font-mono">{data.permit.clearanceNumber}</b>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Status Badge */}
              <div className="p-4 bg-emerald-50 border-2 border-emerald-500/30 rounded-2xl text-center space-y-1">
                <span className="text-4xl">✅</span>
                <h3 className="text-lg font-black text-emerald-800 tracking-tight">
                  OFFICIALLY VERIFIED &amp; CLEARED
                </h3>
                <p className="text-xs text-emerald-700 font-medium">
                  Authoritatively signed by School Financial Subledger
                </p>
              </div>

              {/* Student Verified Payload */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold">Student Name:</span>
                  <span className="font-bold text-slate-900 text-sm">{data.permit?.studentName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold">Admission No:</span>
                  <span className="font-mono font-bold text-slate-900">{data.permit?.studentAdmissionNo}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold">Class / Stream:</span>
                  <span className="font-bold text-slate-800">{data.permit?.className}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold">Document Type:</span>
                  <span className="font-bold text-purple-700">{data.permit?.clearanceType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold">Permit Number:</span>
                  <span className="font-mono font-bold text-emerald-700">{data.permit?.clearanceNumber}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-semibold">Authorized By:</span>
                  <span className="font-semibold text-slate-700">{data.permit?.authorizedByName}</span>
                </div>
              </div>

              {data.permit?.provisionalReason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <b>Provisional Override:</b> {data.permit.provisionalReason}
                </div>
              )}

              <p className="text-[11px] text-center text-slate-400">
                🔒 Protected by 256-bit cryptographic verification. No financial balances are exposed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
