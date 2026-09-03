import { requireAuth } from "@/lib/auth/require-auth";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, UserCheck, CheckCircle2, Clock, AlertCircle, ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { ApplicantStatus } from "@prisma/client";

export default async function AdmissionsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  const ctx = await requireAuth();
  const params = await searchParams;
  const statusFilter = params.status as ApplicantStatus | undefined;

  const [metrics, { items: applicants, total }] = await Promise.all([
    AdmissionsDAO.getFunnelMetrics(ctx),
    AdmissionsDAO.listApplicants(ctx, {
      status: statusFilter,
      search: params.search,
      take: 50
    })
  ]);

  const statusColors: Record<ApplicantStatus, string> = {
    INQUIRY: "bg-slate-100 text-slate-800 border-slate-200",
    SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
    UNDER_REVIEW: "bg-indigo-50 text-indigo-700 border-indigo-200",
    ASSESSMENT_SCHEDULED: "bg-purple-50 text-purple-700 border-purple-200",
    ADMISSION_OFFERED: "bg-amber-50 text-amber-700 border-amber-200",
    OFFER_ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    OFFER_REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    ENROLLED: "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold",
    WAITLISTED: "bg-orange-50 text-orange-700 border-orange-200",
    WITHDRAWN: "bg-zinc-100 text-zinc-600 border-zinc-200"
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admissions Pipeline</h1>
          <p className="text-slate-500 mt-1">
            End-to-end applicant tracking, assessment rubrics, 4-eye offer issuance, and single-click student onboarding.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/guardians">
            <Button variant="outline">Guardians Directory</Button>
          </Link>
          <Link href="/admissions/new">
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus size={16} />
              <span>New Applicant</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Conversion Funnel Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Inquiries</span>
            <Users size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.inquiries}</div>
          <div className="text-xs text-slate-400 mt-1">Pipeline Top</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Submitted</span>
            <Clock size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.submitted}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">
            {metrics.inquiryToSubmittedPct.toFixed(0)}% conversion
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Assessed</span>
            <UserCheck size={16} className="text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.assessed}</div>
          <div className="text-xs text-slate-400 mt-1">Exam & interview</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Offers Issued</span>
            <AlertCircle size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.offered}</div>
          <div className="text-xs text-slate-400 mt-1">4-Eye approved</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Accepted</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.accepted}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">
            {metrics.offerToAcceptedPct.toFixed(0)}% yield
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
            <span>Enrolled</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 mt-2">{metrics.enrolled}</div>
          <div className="text-xs text-emerald-700 mt-1 font-semibold">
            {metrics.acceptedToEnrolledPct.toFixed(0)}% onboarded
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Link href="/admissions">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                !statusFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
                All ({total})
              </span>
            </Link>
            <Link href="/admissions?status=INQUIRY">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                statusFilter === 'INQUIRY' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
                Inquiries
              </span>
            </Link>
            <Link href="/admissions?status=SUBMITTED">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                statusFilter === 'SUBMITTED' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}>
                Submitted
              </span>
            </Link>
            <Link href="/admissions?status=ADMISSION_OFFERED">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                statusFilter === 'ADMISSION_OFFERED' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}>
                Offered
              </span>
            </Link>
            <Link href="/admissions?status=OFFER_ACCEPTED">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                statusFilter === 'OFFER_ACCEPTED' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}>
                Ready to Enroll
              </span>
            </Link>
            <Link href="/admissions?status=ENROLLED">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                statusFilter === 'ENROLLED' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              }`}>
                Enrolled
              </span>
            </Link>
          </div>

          <form method="GET" action="/admissions" className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              name="search"
              defaultValue={params.search || ""}
              placeholder="Search applicants by name, number..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </form>
        </div>

        {/* Applicants Table */}
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60">
              <TableHead>Application #</TableHead>
              <TableHead>Applicant Name</TableHead>
              <TableHead>Target Class</TableHead>
              <TableHead>Academic Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applicants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  No applicants found for this status.
                </TableCell>
              </TableRow>
            ) : (
              applicants.map((a) => (
                <TableRow key={a.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-mono text-sm font-semibold text-slate-800">
                    {a.applicationNumber}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{a.firstName} {a.lastName}</div>
                    <div className="text-xs text-slate-400">{a.nationality || 'Ugandan'} • {a.dayOrBoarding}</div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-700">{a.targetClass.name}</span>
                    {a.targetStream && (
                      <span className="text-xs text-slate-400 ml-1">({a.targetStream.name})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {a.academicYear.name}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[a.status]}`}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    {a.enrolledStudent ? (
                      <Link href={`/students/${a.enrolledStudent.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                        {a.enrolledStudent.admissionNo}
                      </Link>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admissions/${a.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1 text-blue-600 hover:text-blue-700">
                        <span>Review</span>
                        <ArrowRight size={14} />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
