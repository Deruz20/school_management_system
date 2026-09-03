"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AcademicYear, Class, Stream, TransportRoute } from "@prisma/client";

interface IntakeFormProps {
  academicYears: AcademicYear[];
  classes: (Class & { streams: Stream[] })[];
  transportRoutes: TransportRoute[];
}

export function ApplicantIntakeForm({ academicYears, classes, transportRoutes: _transportRoutes }: IntakeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    gender: "MALE",
    dateOfBirth: "",
    nationality: "Ugandan",
    dayOrBoarding: "DAY",
    academicYearId: academicYears[0]?.id || "",
    targetClassId: classes[0]?.id || "",
    targetStreamId: "",
    guardianFirstName: "",
    guardianLastName: "",
    guardianPhone: "",
    guardianEmail: "",
    guardianRelationship: "FATHER",
    previousSchoolName: "",
    pleAggregate: "",
    medicalNotes: ""
  });

  const selectedClass = classes.find((c) => c.id === formData.targetClassId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create Guardian if provided
      let guardianId: string | undefined = undefined;
      if (formData.guardianPhone && formData.guardianFirstName) {
        const grdRes = await fetch("/api/guardians", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: formData.guardianFirstName,
            lastName: formData.guardianLastName || formData.lastName,
            phonePrimary: formData.guardianPhone,
            email: formData.guardianEmail || undefined,
            relationshipType: formData.guardianRelationship
          })
        });

        if (grdRes.ok) {
          const grd = await grdRes.json();
          guardianId = grd.id;
        }
      }

      // 2. Create Inquiry
      const res = await fetch("/api/admissions/applicants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: formData.academicYearId,
          targetClassId: formData.targetClassId,
          targetStreamId: formData.targetStreamId || null,
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName || undefined,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth || undefined,
          nationality: formData.nationality,
          dayOrBoarding: formData.dayOrBoarding,
          guardianId
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const applicant = await res.json();

      // 3. Submit full application if academic history or medical notes present
      if (formData.previousSchoolName || formData.pleAggregate || formData.medicalNotes) {
        await fetch(`/api/admissions/applicants/${applicant.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previousSchoolName: formData.previousSchoolName || undefined,
            pleAggregate: formData.pleAggregate ? parseInt(formData.pleAggregate) : undefined,
            medicalEmergencyNotes: formData.medicalNotes || undefined
          })
        });
      }

      router.push(`/admissions/${applicant.id}`);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Student Demographics Section */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
          1. Student Identification & Demographics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label>
            <input
              type="text"
              value={formData.middleName}
              onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gender *</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nationality</label>
            <input
              type="text"
              value={formData.nationality}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Day / Boarding *</label>
            <select
              value={formData.dayOrBoarding}
              onChange={(e) => setFormData({ ...formData, dayOrBoarding: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="DAY">Day Scholar</option>
              <option value="BOARDING">Boarding Student</option>
            </select>
          </div>
        </div>
      </div>

      {/* Target Academic Placement */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
          2. Academic Placement
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year *</label>
            <select
              value={formData.academicYearId}
              onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Target Class *</label>
            <select
              value={formData.targetClassId}
              onChange={(e) => setFormData({ ...formData, targetClassId: e.target.value, targetStreamId: "" })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Preferred Stream</label>
            <select
              value={formData.targetStreamId}
              onChange={(e) => setFormData({ ...formData, targetStreamId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">Auto-Assign Later</option>
              {selectedClass?.streams.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Primary Guardian Contact */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
          3. Primary Guardian KYC & Emergency Contact
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Guardian First Name</label>
            <input
              type="text"
              value={formData.guardianFirstName}
              onChange={(e) => setFormData({ ...formData, guardianFirstName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. Robert"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Guardian Last Name</label>
            <input
              type="text"
              value={formData.guardianLastName}
              onChange={(e) => setFormData({ ...formData, guardianLastName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. Kato"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number (E.164) *</label>
            <input
              type="text"
              value={formData.guardianPhone}
              onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="0700123456"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Relationship</label>
            <select
              value={formData.guardianRelationship}
              onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="LEGAL_GUARDIAN">Legal Guardian</option>
              <option value="SPONSOR">Financial Sponsor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Academic Background & Health */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
          4. Prior Academic Background & Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Previous School Name</label>
            <input
              type="text"
              value={formData.previousSchoolName}
              onChange={(e) => setFormData({ ...formData, previousSchoolName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. Kampala Parents Primary School"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">PLE Aggregate (if applicable)</label>
            <input
              type="number"
              min="4"
              max="36"
              value={formData.pleAggregate}
              onChange={(e) => setFormData({ ...formData, pleAggregate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. 8"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Emergency Medical Notes & Allergies</label>
          <textarea
            rows={2}
            value={formData.medicalNotes}
            onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            placeholder="Document severe allergies (e.g. penicillin, peanuts) or chronic medical conditions."
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
        >
          {loading ? "Processing..." : "Create Applicant"}
        </Button>
      </div>
    </form>
  );
}
