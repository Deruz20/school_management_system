"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Class, Subject, ClassSubject, Employee, User } from "@prisma/client";
import { assignClassSubjectAction, removeClassSubjectAction } from "@/app/(dashboard)/curriculum/classes/actions";

type CSWithRelations = ClassSubject & {
  subject: Subject;
  teacher?: Employee & { user: User | null } | null;
};

export default function ClassSubjectsClient({ 
  classes, subjects, initialClassSubjects, initialClassId, academicYearId, teachers
}: { 
  classes: Class[], 
  subjects: Subject[], 
  initialClassSubjects: CSWithRelations[],
  initialClassId?: string,
  academicYearId: string,
  teachers?: import('@prisma/client').Employee[]
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(initialClassId || "");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setClassId(newId);
    if (newId) {
      router.push(`/curriculum/classes?classId=${newId}&academicYearId=${academicYearId}`);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !subjectId) return;
    setError(null);
    const res = await assignClassSubjectAction({
      classId, subjectId, academicYearId, teacherId: teacherId || undefined
    });
    if (res.error) setError(res.error);
    else {
      setSubjectId("");
      setTeacherId("");
      router.refresh();
    }
  };

  const handleRemove = async (id: string) => {
    if (confirm("Remove this subject from the class?")) {
      const res = await removeClassSubjectAction(id);
      if (res.error) alert(res.error);
      else router.refresh();
    }
  };

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}
      
      <div className="bg-white p-4 rounded-md shadow mb-6 flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Class</label>
          <select value={classId} onChange={handleClassChange} className="border rounded-md px-3 py-2 text-sm w-48 text-black">
            <option value="">-- Select --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {classId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-white shadow rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Code</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Subject</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Teacher</th>
                    <th className="px-6 py-3 text-right font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {initialClassSubjects.map(cs => (
                    <tr key={cs.id}>
                      <td className="px-6 py-4 font-medium text-black">{cs.subject.code}</td>
                      <td className="px-6 py-4 text-black">{cs.subject.name}</td>
                      <td className="px-3 py-4 text-sm text-slate-500 whitespace-nowrap">
                    {cs.teacher ? (
                      cs.teacher.user ? 
                        `${cs.teacher.user.firstName} ${cs.teacher.user.lastName}` 
                        : `${cs.teacher.firstName} ${cs.teacher.lastName}`
                    ) : (
                      <span className="text-slate-400 italic">Not Assigned</span>
                    )}
                  </td>    <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRemove(cs.id)} className="text-red-500 hover:text-red-700">Remove</button>
                      </td>
                    </tr>
                  ))}
                  {initialClassSubjects.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No subjects assigned yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div>
            <form onSubmit={handleAssign} className="bg-slate-50 p-4 border rounded-md shadow-sm">
              <h3 className="font-medium text-slate-900 mb-3">Assign Subject</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">Subject</label>
                  <select required value={subjectId} onChange={e => setSubjectId(e.target.value)} className="border rounded-md px-3 py-2 text-sm w-full text-black bg-white">
                    <option value="">-- Select Subject --</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                {teachers && (
                  <div>
                    <label className="block text-sm text-slate-700 mb-1">Teacher (Optional)</label>
                    <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="border rounded-md px-3 py-2 text-sm w-full text-black bg-white">
                      <option value="">-- No Teacher --</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.employeeCode})</option>)}
                    </select>
                  </div>
                )}
                <button type="submit" className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm">
                  Add to Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
