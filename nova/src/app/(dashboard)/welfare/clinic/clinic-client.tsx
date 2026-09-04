"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  HeartPulse,
  Plus,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Bed,
  Ambulance,
  Pill,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface EncounterItem {
  id: string;
  encounterNumber: string;
  checkInAt: string | Date;
  triagePriority: string;
  chiefComplaint: string;
  diagnosticCategory: string;
  outcome: string | null;
  symptoms: string | null;
  clinicalNotes: string | null;
  diagnosis: string | null;
  isRedacted: boolean;
  student: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
  };
  attendingStaff: {
    id: string;
    firstName: string;
    lastName: string;
  };
  sickbayAdmission: {
    id: string;
    bedNumber: string;
    dischargedAt: string | Date | null;
  } | null;
  referral: {
    id: string;
    externalFacilityName: string;
  } | null;
}

export function ClinicClient({
  encounters,
  students,
  academicYears,
  inventoryItems,
  stores,
}: {
  encounters: EncounterItem[];
  students: Array<{ id: string; admissionNo: string; firstName: string; lastName: string; allergies: string | null }>;
  academicYears: Array<{ id: string; name: string }>;
  inventoryItems: Array<{ id: string; code: string; name: string; unitOfMeasure: string }>;
  stores: Array<{ id: string; name: string; code: string }>;
}) {
  const router = useRouter();
  const [isIntaking, setIsIntaking] = useState(false);
  const [isDispensing, setIsDispensing] = useState(false);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [isDischarging, setIsDischarging] = useState(false);
  const [isReferring, setIsReferring] = useState(false);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>("");
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Intake Form
  const [studentId, setStudentId] = useState("");
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id || "");
  const [triagePriority, setTriagePriority] = useState<"ROUTINE" | "URGENT" | "EMERGENCY">("ROUTINE");
  const [temperature, setTemperature] = useState("");
  const [pulseRate, setPulseRate] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [diagnosticCategory, setDiagnosticCategory] = useState("MALARIA");
  const [symptoms, setSymptoms] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  // Dispensing Form
  const [dispenseItemId, setDispenseItemId] = useState("");
  const [dispenseStoreId, setDispenseStoreId] = useState(stores[0]?.id || "");
  const [dispenseQty, setDispenseQty] = useState(1);
  const [dosageInstructions, setDosageInstructions] = useState("");

  // Sickbay Form
  const [sickbayBed, setSickbayBed] = useState("");
  const [sickbayNotes, setSickbayNotes] = useState("");
  const [dischargeCondition, setDischargeCondition] = useState("Recovered - Fit to resume classes");

  // Referral Form
  const [referralFacility, setReferralFacility] = useState("Mulago National Referral Hospital");
  const [referralReason, setReferralReason] = useState("");
  const [ambulanceDispatched, setAmbulanceDispatched] = useState(false);

  // Check selected student allergy
  const selectedStudent = students.find((s) => s.id === studentId);

  const handleCreateEncounter = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/clinic/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          academicYearId,
          triagePriority,
          temperature: temperature ? parseFloat(temperature) : undefined,
          pulseRate: pulseRate ? parseInt(pulseRate) : undefined,
          bloodPressure: bloodPressure || undefined,
          respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
          weightKg: weightKg ? parseFloat(weightKg) : undefined,
          chiefComplaint,
          diagnosticCategory,
          symptoms,
          clinicalNotes,
          diagnosis,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Clinical encounter logged with AES-256-GCM encryption.");
      setIsIntaking(false);
      setStudentId("");
      setChiefComplaint("");
      setSymptoms("");
      setClinicalNotes("");
      setDiagnosis("");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/clinic/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId: selectedEncounterId,
          itemId: dispenseItemId,
          storeId: dispenseStoreId,
          quantity: dispenseQty,
          dosageInstructions,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Medication dispensed and dispensary stock updated with WAC tracking.");
      setIsDispensing(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdmitSickbay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/clinic/sickbay/admit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId: selectedEncounterId,
          bedNumber: sickbayBed,
          notes: sickbayNotes,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Student admitted to sickbay ward.");
      setIsAdmitting(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDischargeSickbay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/clinic/sickbay/discharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionId: selectedAdmissionId,
          dischargeCondition,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Student successfully discharged from sickbay.");
      setIsDischarging(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/clinic/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId: selectedEncounterId,
          externalFacilityName: referralFacility,
          referralReason,
          ambulanceDispatched,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("External medical referral recorded.");
      setIsReferring(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Alert Banners */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="shrink-0" size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="shrink-0" size={20} />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <ShieldCheck className="text-emerald-600" size={16} />
          <span>HIPAA/GDPR Grade AES-256-GCM Encryption on Symptoms, Notes &amp; Diagnoses</span>
        </div>
        <Button
          onClick={() => setIsIntaking(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2"
        >
          <Plus size={16} />
          <span>New Clinic Triage Encounter</span>
        </Button>
      </div>

      {/* Encounters Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Clinic Encounters &amp; Consultations</h3>
          <span className="text-xs text-slate-500">{encounters.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">Encounter No</th>
                <th className="p-4">Student</th>
                <th className="p-4">Triage Priority</th>
                <th className="p-4">Chief Complaint</th>
                <th className="p-4">Clinical Diagnosis</th>
                <th className="p-4">Outcome</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {encounters.map((enc) => (
                <tr key={enc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-mono font-medium text-slate-900">{enc.encounterNumber}</td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-800">
                      {enc.student.firstName} {enc.student.lastName}
                    </div>
                    <div className="text-xs text-slate-500">{enc.student.admissionNo}</div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        enc.triagePriority === "EMERGENCY"
                          ? "bg-rose-100 text-rose-700 border border-rose-200"
                          : enc.triagePriority === "URGENT"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {enc.triagePriority}
                    </span>
                  </td>
                  <td className="p-4 max-w-xs truncate text-slate-700">{enc.chiefComplaint}</td>
                  <td className="p-4 max-w-xs truncate">
                    {enc.isRedacted ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 italic">
                        <Lock size={12} /> Confidential
                      </span>
                    ) : (
                      <span className="text-slate-800 font-medium">{enc.diagnosis || enc.diagnosticCategory}</span>
                    )}
                  </td>
                  <td className="p-4 text-xs font-medium text-slate-600">{enc.outcome || "PENDING"}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedEncounterId(enc.id);
                          setIsDispensing(true);
                        }}
                        className="text-xs h-8 border-slate-200"
                      >
                        <Pill size={13} className="mr-1 text-blue-600" /> Dispense
                      </Button>

                      {!enc.sickbayAdmission ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEncounterId(enc.id);
                            setIsAdmitting(true);
                          }}
                          className="text-xs h-8 border-slate-200"
                        >
                          <Bed size={13} className="mr-1 text-amber-600" /> Admit
                        </Button>
                      ) : !enc.sickbayAdmission.dischargedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAdmissionId(enc.sickbayAdmission!.id);
                            setIsDischarging(true);
                          }}
                          className="text-xs h-8 border-amber-300 text-amber-800 bg-amber-50"
                        >
                          Discharge
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedEncounterId(enc.id);
                          setIsReferring(true);
                        }}
                        className="text-xs h-8 border-slate-200 text-rose-700"
                      >
                        <Ambulance size={13} className="mr-1 text-rose-600" /> Refer
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {encounters.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No clinical encounters recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intake Encounter Modal */}
      {isIntaking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <HeartPulse className="text-rose-600" size={20} />
              <span>Clinic Encounter Intake &amp; Triage</span>
            </h3>
            <form onSubmit={handleCreateEncounter} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Academic Year</label>
                  <select
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                    required
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                  >
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Student</label>
                  <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    required
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                  >
                    <option value="">Select Student...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.admissionNo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Triage Priority</label>
                  <select
                    value={triagePriority}
                    onChange={(e) => setTriagePriority(e.target.value as "ROUTINE" | "URGENT" | "EMERGENCY")}
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 font-semibold"
                  >
                    <option value="ROUTINE">ROUTINE - Minor ailment</option>
                    <option value="URGENT">URGENT - High fever / distress</option>
                    <option value="EMERGENCY">EMERGENCY - Acute life-safety</option>
                  </select>
                </div>
              </div>

              {/* Allergy Warning if Student has one recorded */}
              {selectedStudent?.allergies && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl flex items-center gap-2 text-xs font-semibold">
                  <AlertTriangle className="text-amber-600 shrink-0" size={16} />
                  <span>KNOWN ALLERGY ALERT: {selectedStudent.allergies}</span>
                </div>
              )}

              {/* Vital Signs Grid */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-3">
                  Triage Vitals
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="37.0"
                      className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={pulseRate}
                      onChange={(e) => setPulseRate(e.target.value)}
                      placeholder="72"
                      className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">BP (mmHg)</label>
                    <input
                      type="text"
                      value={bloodPressure}
                      onChange={(e) => setBloodPressure(e.target.value)}
                      placeholder="120/80"
                      className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Resp (bpm)</label>
                    <input
                      type="number"
                      value={respiratoryRate}
                      onChange={(e) => setRespiratoryRate(e.target.value)}
                      placeholder="18"
                      className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="50.5"
                      className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Chief Complaint & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Diagnostic Category</label>
                  <select
                    value={diagnosticCategory}
                    onChange={(e) => setDiagnosticCategory(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                  >
                    <option value="MALARIA">Malaria / Febrile Illness</option>
                    <option value="RESPIRATORY">Respiratory / Cough / Cold</option>
                    <option value="GASTROINTESTINAL">Gastrointestinal / Stomach</option>
                    <option value="DENTAL">Dental</option>
                    <option value="TRAUMA">Trauma / Physical Injury</option>
                    <option value="DERMATOLOGY">Dermatology / Skin</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Chief Complaint</label>
                  <input
                    type="text"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    required
                    placeholder="Severe headache, fever for 2 days..."
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-900"
                  />
                </div>
              </div>

              {/* Encrypted Clinical Fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                    <Lock size={12} className="text-slate-400" />
                    <span>Symptoms Description (Encrypted)</span>
                  </label>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={2}
                    placeholder="Observed chills, rigor, nausea..."
                    className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                    <Lock size={12} className="text-slate-400" />
                    <span>Clinical Notes &amp; Physical Exam (Encrypted)</span>
                  </label>
                  <textarea
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    rows={2}
                    placeholder="Abdomen soft, throat clear..."
                    className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                    <Lock size={12} className="text-slate-400" />
                    <span>Clinical Diagnosis (Encrypted)</span>
                  </label>
                  <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Clinical diagnosis or confirmed test result..."
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsIntaking(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-rose-600 text-white">
                  {loading ? "Recording..." : "Save Encounter"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispense Medicine Modal */}
      {isDispensing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Pill className="text-blue-600" size={20} />
              <span>Dispense Medication</span>
            </h3>
            <form onSubmit={handleDispense} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Medication Item</label>
                <select
                  value={dispenseItemId}
                  onChange={(e) => setDispenseItemId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                >
                  <option value="">Select Pharmaceutical Item...</option>
                  {inventoryItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.code}) - {i.unitOfMeasure}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Dispensary Store</label>
                <select
                  value={dispenseStoreId}
                  onChange={(e) => setDispenseStoreId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={dispenseQty}
                  onChange={(e) => setDispenseQty(parseInt(e.target.value) || 1)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Dosage Instructions</label>
                <input
                  type="text"
                  value={dosageInstructions}
                  onChange={(e) => setDosageInstructions(e.target.value)}
                  required
                  placeholder="2 tablets TDS for 3 days after meals"
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDispensing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 text-white">
                  {loading ? "Dispensing..." : "Confirm Dispensing"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sickbay Admission Modal */}
      {isAdmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Bed className="text-amber-600" size={20} />
              <span>Admit Student to Sickbay</span>
            </h3>
            <form onSubmit={handleAdmitSickbay} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Bed Number / Bay</label>
                <input
                  type="text"
                  value={sickbayBed}
                  onChange={(e) => setSickbayBed(e.target.value)}
                  required
                  placeholder="Bay 1 - Bed A"
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Nursing Observation Notes</label>
                <textarea
                  value={sickbayNotes}
                  onChange={(e) => setSickbayNotes(e.target.value)}
                  rows={3}
                  placeholder="Continuous hydration, monitor temperature every 2 hours..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsAdmitting(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-amber-600 text-white">
                  {loading ? "Admitting..." : "Admit to Sickbay"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sickbay Discharge Modal */}
      {isDischarging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-emerald-600" size={20} />
              <span>Discharge from Sickbay</span>
            </h3>
            <form onSubmit={handleDischargeSickbay} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Discharge Condition</label>
                <input
                  type="text"
                  value={dischargeCondition}
                  onChange={(e) => setDischargeCondition(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDischarging(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-emerald-600 text-white">
                  {loading ? "Discharging..." : "Confirm Discharge"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Medical Referral Modal */}
      {isReferring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Ambulance className="text-rose-600" size={20} />
              <span>External Medical Referral</span>
            </h3>
            <form onSubmit={handleReferral} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Hospital / Referral Facility</label>
                <input
                  type="text"
                  value={referralFacility}
                  onChange={(e) => setReferralFacility(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Reason for Referral</label>
                <textarea
                  value={referralReason}
                  onChange={(e) => setReferralReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Suspected acute appendicitis requiring emergency surgical consultation..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={ambulanceDispatched}
                  onChange={(e) => setAmbulanceDispatched(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600"
                />
                <span className="font-semibold text-rose-700">Ambulance dispatched for emergency transport</span>
              </label>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsReferring(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-rose-600 text-white">
                  {loading ? "Dispatching..." : "Record Referral"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
