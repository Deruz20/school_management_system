"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Subject, SubjectCombination, EnrollmentSubject, Enrollment, AcademicYear, Class } from "@prisma/client";
import { assignIndividualSubjectsAction, assignCombinationAction, removeEnrollmentSubjectAction } from "@/app/(dashboard)/students/[id]/subjects/actions";

type ESWithSubject = EnrollmentSubject & { subject: Subject };
type EnrollmentWithDetails = Enrollment & { academicYear: AcademicYear, classRef: Class };

export default function StudentSubjectsClient({ 
  studentId, enrollments, initialEnrollmentId, initialEnrollmentSubjects, subjects, combinations 
}: { 
  studentId: string,
  enrollments: EnrollmentWithDetails[],
  initialEnrollmentId?: string,
  initialEnrollmentSubjects: ESWithSubject[],
  subjects: Subject[],
  combinations: SubjectCombination[]
}) {
  const router = useRouter();
  const [enrollmentId, setEnrollmentId] = useState(initialEnrollmentId || "");
  const [subjectId, setSubjectId] = useState("");
  const [comboId, setComboId] = useState("");
  const [isElective, setIsElective] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnrollmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setEnrollmentId(newId);
    if (newId) {
      router.push(`/students/${studentId}/subjects?enrollmentId=${newId}`);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentId || !subjectId) return;
    setError(null);
    const res = await assignIndividualSubjectsAction(studentId, enrollmentId, [subjectId], isElective);
    if (res.error) setError(res.error);
    else {
      setSubjectId("");
      router.refresh();
    }
  };

  const handleAddCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentId || !comboId) return;
    setError(null);
    const res = await assignCombinationAction(studentId, enrollmentId, comboId);
    if (res.error) setError(res.error);
    else {
      setComboId("");
      router.refresh();
    }
  };

  const handleRemove = async (subjId: string) => {
    if (confirm("Remove this subject from the student's curriculum?")) {
      const res = await removeEnrollmentSubjectAction(studentId, enrollmentId, subjId);
      if (res.error) alert(res.error);
      else router.refresh();
    }
  };

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}
      
      <div className="bg-white p-4 rounded-md shadow mb-6 flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Academic Enrollment</label>
          <select value={enrollmentId} onChange={handleEnrollmentChange} className="border rounded-md px-3 py-2 text-sm w-64 text-black">
            <option value="">-- Select --</option>
            {enrollments.map(e => <option key={e.id} value={e.id}>{e.academicYear.name} - {e.classRef.name}</option>)}
          </select>
        </div>
      </div>

      {enrollmentId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-white shadow rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Code</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Subject</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Type</th>
                    <th className="px-6 py-3 text-right font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {initialEnrollmentSubjects.map(es => (
                    <tr key={es.subjectId}>
                      <td className="px-6 py-4 font-medium text-black">{es.subject.code}</td>
                      <td className="px-6 py-4 text-black">{es.subject.name}</td>
                      <td className="px-6 py-4">
                         <span className={`text-xs px-1.5 py-0.5 rounded ${es.isElective ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                          {es.isElective ? 'Elective' : 'Core'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRemove(es.subjectId)} className="text-red-500 hover:text-red-700">Remove</button>
                      </td>
                    </tr>
                  ))}
                  {initialEnrollmentSubjects.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No subjects assigned for this enrollment yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="space-y-6">
            <form onSubmit={handleAddCombo} className="bg-slate-50 p-4 border rounded-md shadow-sm">
              <h3 className="font-medium text-slate-900 mb-3">Assign Combination</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">Subject Combination</label>
                  <select required value={comboId} onChange={e => setComboId(e.target.value)} className="border rounded-md px-3 py-2 text-sm w-full text-black">
                    <option value="">-- Select Combination --</option>
                    {combinations.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm">
                  Assign Combination
                </button>
              </div>
            </form>

            <form onSubmit={handleAddSubject} className="bg-slate-50 p-4 border rounded-md shadow-sm">
              <h3 className="font-medium text-slate-900 mb-3">Assign Individual Subject</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">Subject</label>
                  <select required value={subjectId} onChange={e => setSubjectId(e.target.value)} className="border rounded-md px-3 py-2 text-sm w-full text-black">
                    <option value="">-- Select Subject --</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" checked={isElective} onChange={e => setIsElective(e.target.checked)} id="elective" />
                  <label htmlFor="elective" className="ml-2 text-sm text-slate-700">Mark as Elective</label>
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-900 text-sm">
                  Assign Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
