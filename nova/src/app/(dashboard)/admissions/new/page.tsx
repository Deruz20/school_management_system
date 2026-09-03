import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import { ApplicantIntakeForm } from "./intake-form";

export default async function NewApplicantPage() {
  const ctx = await requireAuth();

  const [academicYears, classes, transportRoutes] = await Promise.all([
    db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      orderBy: { startDate: 'desc' }
    }),
    db.class.findMany({
      where: { branchId: ctx.branchId },
      include: { streams: true },
      orderBy: { name: 'asc' }
    }),
    db.transportRoute.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      orderBy: { name: 'asc' }
    })
  ]);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">New Applicant Intake</h1>
        <p className="text-slate-500 mt-1">
          Register a prospective student, capture demographic & KYC data, and attach primary guardian contacts.
        </p>
      </div>

      <ApplicantIntakeForm
        academicYears={academicYears}
        classes={classes}
        transportRoutes={transportRoutes}
      />
    </div>
  );
}
