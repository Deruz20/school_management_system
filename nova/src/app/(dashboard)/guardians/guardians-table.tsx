"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ShieldCheck, CheckCircle2 } from "lucide-react";

interface GuardianRecord {
  id: string;
  guardianCode: string;
  firstName: string;
  lastName: string;
  phonePrimary: string;
  email?: string | null;
  relationship?: string | null;
  relationshipType?: string | null;
  nationalId?: string | null;
  isVerified: boolean;
  _count?: { students: number };
  students?: Array<{
    id: string;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      admissionNo: string;
    };
  }>;
}

interface GuardiansTableProps {
  guardians: GuardianRecord[];
  total: number;
}

export function GuardiansTable({ guardians, total }: GuardiansTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleVerify = async (guardianId: string) => {
    setVerifyingId(guardianId);
    try {
      const res = await fetch(`/api/guardians/${guardianId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/guardians?search=${encodeURIComponent(search)}`);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, phone, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </form>
        <div className="text-xs text-slate-500">
          Showing <strong>{guardians.length}</strong> of <strong>{total}</strong> guardians
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>Guardian Code</TableHead>
            <TableHead>Full Name</TableHead>
            <TableHead>Relationship</TableHead>
            <TableHead>Primary Phone</TableHead>
            <TableHead>National ID (NIN)</TableHead>
            <TableHead>Linked Students</TableHead>
            <TableHead>Verification Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {guardians.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                No guardians found.
              </TableCell>
            </TableRow>
          ) : (
            guardians.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-mono text-xs font-semibold text-slate-800">
                  {g.guardianCode}
                </TableCell>
                <TableCell className="font-medium text-slate-900">
                  {g.firstName} {g.lastName}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {g.relationshipType?.replace(/_/g, " ") || 'Legal Guardian'}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-700">
                  {g.phonePrimary}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-700">
                  {g.nationalId || '—'}
                </TableCell>
                <TableCell>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                    {g._count?.students || 0} student(s)
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                    g.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {g.isVerified ? 'Verified KYC' : 'Provisional (Unverified)'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {!g.isVerified && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(g.id)}
                      disabled={verifyingId === g.id}
                      className="text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    >
                      <ShieldCheck size={14} />
                      <span>{verifyingId === g.id ? "Verifying..." : "Verify KYC"}</span>
                    </Button>
                  )}
                  {g.isVerified && (
                    <span className="text-emerald-600 text-xs flex items-center justify-end gap-1 font-medium">
                      <CheckCircle2 size={14} />
                      <span>Approved</span>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
