import { requireAuth } from "@/lib/auth/require-auth";
import { AdmissionsDAO } from "@/lib/dao/admissions.dao";
import { db } from "@/lib/db";
import { ApplicantActions } from "./applicant-actions";
import { ApplicantStatus } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft, User, Phone, MapPin, School } from "lucide-react";

export default async function ApplicantDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const ctx = await requireAuth();

  const applicant = await AdmissionsDAO.getApplicant(ctx, id);

  const [classes, feeStructures, transportRoutes, provisioning] = await Promise.all([
    db.class.findMany({
      where: { branchId: ctx.branchId },
      include: { streams: true },
      orderBy: { name: 'asc' }
    }),
    db.feeStructure.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      orderBy: { name: 'asc' }
    }),
    db.transportRoute.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      orderBy: { name: 'asc' }
    }),
    applicant.enrolledStudentId ? db.enrollmentProvisioning.findFirst({
      where: { studentId: applicant.enrolledStudentId },
      orderBy: { createdAt: 'desc' }
    }) : null
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
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Link href="/admissions" className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <ArrowLeft size={16} />
          <span>Back to Admissions Pipeline</span>
        </Link>
      </div>

      {/* Header Profile Dossier */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl">
            {applicant.firstName[0]}{applicant.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                {applicant.firstName} {applicant.middleName ? `${applicant.middleName} ` : ""}{applicant.lastName}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[applicant.status]}`}>
                {applicant.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="font-mono font-medium text-slate-700">{applicant.applicationNumber}</span>
              <span>•</span>
              <span>Target Class: <strong className="text-slate-700">{applicant.targetClass.name}</strong></span>
              <span>•</span>
              <span>Academic Year: <strong className="text-slate-700">{applicant.academicYear.name}</strong></span>
              <span>•</span>
              <span>{applicant.dayOrBoarding}</span>
            </div>
          </div>
        </div>

        {applicant.enrolledStudent && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-right">
            <div className="text-xs text-emerald-700 font-medium">Enrolled Student Master</div>
            <Link
              href={`/students/${applicant.enrolledStudent.id}`}
              className="text-lg font-mono font-bold text-emerald-900 hover:underline"
            >
              {applicant.enrolledStudent.admissionNo}
            </Link>
          </div>
        )}
      </div>

      {/* Main Grid: Details & Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Applicant Dossier */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* KYC Demographics Card */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <User size={16} className="text-blue-500" />
              <span>Demographics & National Identity</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="block text-xs text-slate-400">Gender</span>
                <span className="font-medium text-slate-700">{applicant.gender || 'Not specified'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Date of Birth</span>
                <span className="font-medium text-slate-700">
                  {applicant.dateOfBirth ? new Date(applicant.dateOfBirth).toLocaleDateString() : 'Not recorded'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Nationality</span>
                <span className="font-medium text-slate-700">{applicant.nationality || 'Ugandan'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">National ID (NIN)</span>
                <span className="font-mono text-xs font-semibold text-slate-800">
                  {applicant.nin || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Learner ID (LIN / EMIS)</span>
                <span className="font-mono text-xs text-slate-700">{applicant.linEmisNo || '—'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Birth Certificate #</span>
                <span className="text-xs text-slate-700">{applicant.birthCertNo || '—'}</span>
              </div>
            </div>

            {/* Address */}
            <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
              <MapPin size={14} className="text-slate-400 mt-0.5" />
              <span>
                {applicant.residentialAddress || applicant.villageLCI ? (
                  `${applicant.residentialAddress || ''} ${applicant.villageLCI ? `(LC1: ${applicant.villageLCI})` : ''} ${applicant.district ? `, District: ${applicant.district}` : ''}`
                ) : 'Residential address not recorded.'}
              </span>
            </div>
          </div>

          {/* Academic Background */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <School size={16} className="text-purple-500" />
              <span>Prior Academic Background</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="block text-xs text-slate-400">Previous School</span>
                <span className="font-medium text-slate-800">{applicant.previousSchoolName || 'None'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Previous Class</span>
                <span className="font-medium text-slate-800">{applicant.previousClass || 'None'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">PLE Aggregate / Division</span>
                <span className="font-medium text-slate-800">
                  {applicant.pleAggregate ? `${applicant.pleAggregate} (Div ${applicant.pleDivision || '1'})` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Guardians List */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Phone size={16} className="text-emerald-500" />
              <span>Attached Guardians & KYC</span>
            </h2>
            {applicant.guardians.length === 0 ? (
              <div className="text-xs text-slate-400 py-2">No guardians attached yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {applicant.guardians.map((ag) => (
                  <div key={ag.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-slate-900">
                        {ag.guardian.firstName} {ag.guardian.lastName}
                        <span className="ml-2 text-xs text-slate-500 font-normal">({ag.relationship})</span>
                        {ag.isPrimaryContact && (
                          <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">
                            Primary Contact
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {ag.guardian.phonePrimary} • Code: {ag.guardian.guardianCode}
                      </div>
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                        ag.guardian.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {ag.guardian.isVerified ? 'KYC Verified' : 'Unverified (Provisional)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Admissions State Machine & Provisioning Actions */}
        <div className="flex flex-col gap-6">
          <ApplicantActions
            applicant={applicant}
            classes={classes}
            feeStructures={feeStructures}
            transportRoutes={transportRoutes}
            provisioning={provisioning}
          />
        </div>
      </div>
    </div>
  );
}
