"use client";

import { useState } from "react";
import { Class, Term, ClassSubject, Subject, Assessment } from "@prisma/client";
import { useRouter } from "next/navigation";
import { createAssessmentAction } from "@/app/(dashboard)/curriculum/assessments/actions";
import Link from "next/link";

type CSWithSubject = ClassSubject & { subject: Subject };

export default function AssessmentsClient({
  classes,
  terms,
  classSubjects,
  assessments,
  initialClassId,
  initialTermId,
  initialClassSubjectId
}: {
  classes: Class[];
  terms: Term[];
  classSubjects: CSWithSubject[];
  assessments: Assessment[];
  initialClassId?: string;
  initialTermId?: string;
  initialClassSubjectId?: string;
}) {
  const router = useRouter();
  
  const [classId, setClassId] = useState(initialClassId || "");
  const [termId, setTermId] = useState(initialTermId || "");
  const [classSubjectId, setClassSubjectId] = useState(initialClassSubjectId || "");

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMaxScore, setNewMaxScore] = useState(100);
  const [newWeight, setNewWeight] = useState(100);

  const handleFilterChange = (type: 'class' | 'term' | 'subject', value: string) => {
    const params = new URLSearchParams(window.location.search);
    
    if (type === 'class') {
      setClassId(value);
      params.set('classId', value);
      params.delete('classSubjectId'); // Reset subject when class changes
      setClassSubjectId("");
    } else if (type === 'term') {
      setTermId(value);
      params.set('termId', value);
    } else if (type === 'subject') {
      setClassSubjectId(value);
      params.set('classSubjectId', value);
    }
    
    router.push(`/curriculum/assessments?${params.toString()}`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classSubjectId || !termId || !newName) return;

    const res = await createAssessmentAction({
      classSubjectId,
      termId,
      name: newName,
      maxScore: newMaxScore,
      weight: newWeight
    });

    if (res.success) {
      setNewName("");
      setNewMaxScore(100);
      setNewWeight(100);
      setIsCreating(false);
    } else {
      alert("Error: " + res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Term</label>
          <select value={termId} onChange={e => handleFilterChange('term', e.target.value)} className="border rounded-md px-3 py-2 text-sm text-black">
            <option value="">-- Select Term --</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
          <select value={classId} onChange={e => handleFilterChange('class', e.target.value)} className="border rounded-md px-3 py-2 text-sm text-black">
            <option value="">-- Select Class --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
          <select value={classSubjectId} onChange={e => handleFilterChange('subject', e.target.value)} disabled={!classId} className="border rounded-md px-3 py-2 text-sm text-black disabled:opacity-50">
            <option value="">-- Select Subject --</option>
            {classSubjects.map(cs => <option key={cs.id} value={cs.id}>{cs.subject.name}</option>)}
          </select>
        </div>
      </div>

      {classSubjectId && termId && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Assessments for Subject</h2>
            <button onClick={() => setIsCreating(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">
              New Assessment
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreate} className="mb-6 p-4 border border-indigo-100 bg-indigo-50/30 rounded-lg flex gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name (e.g. Mid-Term)</label>
                <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="border rounded-md px-3 py-2 text-sm w-48 text-black" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Max Score</label>
                <input required type="number" min="1" value={newMaxScore} onChange={e => setNewMaxScore(Number(e.target.value))} className="border rounded-md px-3 py-2 text-sm w-24 text-black" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Weight (%)</label>
                <input required type="number" min="0" value={newWeight} onChange={e => setNewWeight(Number(e.target.value))} className="border rounded-md px-3 py-2 text-sm w-24 text-black" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">Save</button>
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          )}

          {assessments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No assessments defined for this subject and term.</div>
          ) : (
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assessment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Max Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Weight</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {assessments.map(assessment => (
                    <tr key={assessment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{assessment.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{assessment.maxScore}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{assessment.weight}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/curriculum/assessments/${assessment.id}`} className="text-indigo-600 hover:text-indigo-900">
                          Enter Marks
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
