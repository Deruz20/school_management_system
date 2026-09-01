"use client";

import { useState } from "react";
import { updateBranchSettingsAction } from "@/app/(dashboard)/settings/actions";

export default function SettingsClient({ settings, academicYears }: {
  settings: Partial<import('@prisma/client').BranchSettings>;
  academicYears: (import('@prisma/client').AcademicYear & { terms: import('@prisma/client').Term[] })[];
}) {
  const [activeAcademicYearId, setActiveAcademicYearId] = useState(settings.activeAcademicYearId || "");
  const [activeTermId, setActiveTermId] = useState(settings.activeTermId || "");
  const [brandingMotto, setBrandingMotto] = useState(settings.brandingMotto || "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const activeYearData = academicYears.find((ay) => ay.id === activeAcademicYearId);
  const availableTerms = activeYearData?.terms || [];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    try {
      await updateBranchSettingsAction({
        activeAcademicYearId: activeAcademicYearId || null,
        activeTermId: activeTermId || null,
        brandingMotto: brandingMotto || null,
      });
      setMessage({ type: "success", text: "Settings saved successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred.';
      setMessage({ type: "error", text: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-2xl">
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <h2 className="text-lg font-medium text-slate-900 border-b pb-2">Academic Context</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Set the default academic year and term for this branch. This controls what data is displayed by default across the application.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Active Academic Year</label>
              <select
                value={activeAcademicYearId}
                onChange={(e) => {
                  setActiveAcademicYearId(e.target.value);
                  setActiveTermId(""); // reset term when year changes
                }}
                className="mt-1 block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select Academic Year</option>
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>{ay.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Active Term</label>
              <select
                value={activeTermId}
                onChange={(e) => setActiveTermId(e.target.value)}
                disabled={!activeAcademicYearId}
                className="mt-1 block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm disabled:opacity-50"
              >
                <option value="">Select Term</option>
                {availableTerms.map((term: import('@prisma/client').Term) => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <h2 className="text-lg font-medium text-slate-900 border-b pb-2">Branding</h2>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">School Motto</label>
            <input
              type="text"
              value={brandingMotto}
              onChange={(e) => setBrandingMotto(e.target.value)}
              placeholder="e.g. Excellence through diligence"
              className="mt-1 block w-full rounded-md border-slate-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        {message.text && (
          <div className={`p-4 rounded-md ${message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            {message.text}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
