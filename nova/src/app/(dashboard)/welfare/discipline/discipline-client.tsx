"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  Plus,
  CheckCircle2,
  AlertCircle,
  Gavel,
  Award,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface IncidentItem {
  id: string;
  incidentNumber: string;
  title: string;
  incidentDate: string | Date;
  location: string | null;
  category: string;
  severity: string;
  description: string;
  status: string;
  reportedBy: { id: string; firstName: string; lastName: string };
  students: Array<{
    id: string;
    role: string;
    plea: string;
    student: {
      id: string;
      admissionNo: string;
      firstName: string;
      lastName: string;
    };
  }>;
}

export function DisciplineClient({
  incidents,
  students,
  staffList,
}: {
  incidents: IncidentItem[];
  students: Array<{ id: string; admissionNo: string; firstName: string; lastName: string }>;
  staffList: Array<{ id: string; firstName: string; lastName: string; email: string | null }>;
}) {
  const router = useRouter();
  const [isReporting, setIsReporting] = useState(false);
  const [isHearing, setIsHearing] = useState(false);
  const [isSanctioning, setIsSanctioning] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("");
  const [selectedHearingId, setSelectedHearingId] = useState<string>("");
  const [targetStudentId, setTargetStudentId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Report Incident Form State
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("DISRUPTIVE_BEHAVIOR");
  const [severity, setSeverity] = useState("MODERATE");
  const [description, setDescription] = useState("");
  const [witnessNotes, setWitnessNotes] = useState("");
  const [involvedStudentId, setInvolvedStudentId] = useState(students[0]?.id || "");

  // Hearing Form State
  const [panelChairId, setPanelChairId] = useState(staffList[0]?.id || "");
  const [panelMembers, setPanelMembers] = useState("Discipline Master, Deputy Principal");
  const [studentPlea, setStudentPlea] = useState("GUILTY");
  const [hearingMinutes, setHearingMinutes] = useState("");
  const [findings, setFindings] = useState("");

  // Sanction Form State
  const [sanctionType, setSanctionType] = useState("WRITTEN_WARNING");
  const [demeritPoints, setDemeritPoints] = useState(10);
  const [terms, setTerms] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/discipline/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          location,
          category,
          severity,
          description,
          witnessNotes,
          involvedStudents: [
            {
              studentId: involvedStudentId,
              role: "PRIMARY_OFFENDER",
            },
          ],
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Disciplinary incident logged successfully.");
      setIsReporting(false);
      setTitle("");
      setDescription("");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleHearing = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/discipline/hearings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: selectedIncidentId,
          panelChairId,
          panelMembers,
          studentPlea,
          hearingMinutes,
          findings,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      const hearing = await res.json();
      setSelectedHearingId(hearing.id);
      setSuccess("Disciplinary hearing recorded. You can now prescribe sanctions.");
      setIsHearing(false);
      setIsSanctioning(true);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSanction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/discipline/sanctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hearingId: selectedHearingId,
          studentId: targetStudentId,
          sanctionType,
          demeritPoints: Number(demeritPoints),
          terms,
          startDate,
          endDate: endDate || undefined,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      setSuccess("Sanction approved. Student Lifecycle status updated if suspended or expelled.");
      setIsSanctioning(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const severityColors: Record<string, string> = {
    MINOR: "bg-blue-100 text-blue-800 border-blue-200",
    MODERATE: "bg-amber-100 text-amber-800 border-amber-200",
    MAJOR: "bg-orange-100 text-orange-800 border-orange-200",
    SEVERE: "bg-rose-100 text-rose-800 border-rose-200",
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
        <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          Enforced Maker-Checker: Sanction approvers cannot be the reporting staff member
        </div>
        <Button
          onClick={() => setIsReporting(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Log Disciplinary Incident</span>
        </Button>
      </div>

      {/* Incidents Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Recorded Disciplinary Incidents</h3>
          <span className="text-xs text-slate-500">{incidents.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">Incident No</th>
                <th className="p-4">Title &amp; Category</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Involved Students</th>
                <th className="p-4">Reported By</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-mono font-medium text-slate-900">{inc.incidentNumber}</td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-800">{inc.title}</div>
                    <div className="text-xs text-slate-500">{inc.category.replace("_", " ")}</div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${severityColors[inc.severity] || 'bg-slate-100'}`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="p-4">
                    {inc.students.map((s) => (
                      <div key={s.id} className="text-xs font-medium text-slate-800">
                        {s.student.firstName} {s.student.lastName} ({s.student.admissionNo})
                      </div>
                    ))}
                  </td>
                  <td className="p-4 text-xs text-slate-600">
                    {inc.reportedBy.firstName} {inc.reportedBy.lastName}
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {inc.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedIncidentId(inc.id);
                          setTargetStudentId(inc.students[0]?.student.id || "");
                          setIsHearing(true);
                        }}
                        className="text-xs h-8 border-slate-200"
                      >
                        <Gavel size={13} className="mr-1 text-indigo-600" /> Hold Hearing
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No disciplinary incidents reported.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Incident Modal */}
      {isReporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldAlert className="text-indigo-600" size={20} />
              <span>Report Disciplinary Incident</span>
            </h3>
            <form onSubmit={handleReport} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Incident Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Unauthorized departure / property damage..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                  >
                    <option value="UNAUTHORIZED_ABSENCE">Unauthorized Absence / Sneaking</option>
                    <option value="BULLYING_FIGHTING">Bullying / Physical Altercation</option>
                    <option value="VANDALISM_THEFT">Vandalism / Property Theft</option>
                    <option value="SUBSTANCE_ABUSE">Substance Abuse / Contraband</option>
                    <option value="INSUBORDINATION">Insubordination to Staff</option>
                    <option value="ACADEMIC_DISHONESTY">Academic Dishonesty</option>
                    <option value="DISRUPTIVE_BEHAVIOR">Disruptive Dormitory Behavior</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 font-semibold"
                  >
                    <option value="MINOR">MINOR - Class/Dorm Warning</option>
                    <option value="MODERATE">MODERATE - Formal Detentions</option>
                    <option value="MAJOR">MAJOR - Panel Review / Suspension</option>
                    <option value="SEVERE">SEVERE - Expulsion Threshold</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Primary Student Involved</label>
                <select
                  value={involvedStudentId}
                  onChange={(e) => setInvolvedStudentId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Location of Incident</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Hostel Block B / Dining Hall..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Detailed Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder="Detailed factual statement of events..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Witness Statements / Notes</label>
                <textarea
                  value={witnessNotes}
                  onChange={(e) => setWitnessNotes(e.target.value)}
                  rows={2}
                  placeholder="Names of witnesses or initial statements..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsReporting(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-indigo-600 text-white">
                  {loading ? "Recording..." : "Submit Incident"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hearing Modal */}
      {isHearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Gavel className="text-indigo-600" size={20} />
              <span>Record Disciplinary Hearing</span>
            </h3>
            <form onSubmit={handleHearing} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Panel Chair</label>
                <select
                  value={panelChairId}
                  onChange={(e) => setPanelChairId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName} {st.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Disciplinary Panel Members</label>
                <input
                  type="text"
                  value={panelMembers}
                  onChange={(e) => setPanelMembers(e.target.value)}
                  placeholder="Deputy Principal, Senior Housemaster, Class Teacher..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Student Plea</label>
                <select
                  value={studentPlea}
                  onChange={(e) => setStudentPlea(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 font-semibold"
                >
                  <option value="GUILTY">GUILTY - Admits Infraction</option>
                  <option value="NOT_GUILTY">NOT GUILTY - Contests Allegations</option>
                  <option value="NO_CONTEST">NO CONTEST</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Panel Findings &amp; Minutes</label>
                <textarea
                  value={hearingMinutes}
                  onChange={(e) => setHearingMinutes(e.target.value)}
                  required
                  rows={3}
                  placeholder="Minutes of student testimony and staff deliberations..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Disciplinary Verdict</label>
                <input
                  type="text"
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  required
                  placeholder="Guilty of breach of dormitory regulations..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsHearing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-indigo-600 text-white">
                  {loading ? "Recording..." : "Save Hearing"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prescribe Sanction Modal */}
      {isSanctioning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Award className="text-rose-600" size={20} />
              <span>Prescribe Sanction</span>
            </h3>
            <form onSubmit={handleSanction} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Sanction Type</label>
                <select
                  value={sanctionType}
                  onChange={(e) => setSanctionType(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 font-semibold"
                >
                  <option value="VERBAL_WARNING">Verbal Warning</option>
                  <option value="WRITTEN_WARNING">Written Warning Letter</option>
                  <option value="DETENTION">Supervised Detention</option>
                  <option value="COMMUNITY_SERVICE">Campus Community Service</option>
                  <option value="LOSS_OF_PRIVILEGE">Loss of Privileges / Exeats</option>
                  <option value="SUSPENSION">SUSPENSION (Mutates Student Lifecycle)</option>
                  <option value="EXPULSION">EXPULSION (Permanent Lifecycle Termination)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Demerit Points</label>
                <input
                  type="number"
                  value={demeritPoints}
                  onChange={(e) => setDemeritPoints(parseInt(e.target.value) || 0)}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Sanction Terms / Duration</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  required
                  rows={2}
                  placeholder="2 weeks off campus accompanied by formal apology..."
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-300 p-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsSanctioning(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-rose-600 text-white">
                  {loading ? "Approving..." : "Prescribe Sanction"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
