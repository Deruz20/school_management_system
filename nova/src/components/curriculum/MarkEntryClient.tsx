"use client";

import { useState } from "react";
import { Student, Mark, MarkStatus } from "@prisma/client";
import { upsertMarkAction } from "@/app/(dashboard)/curriculum/assessments/[id]/actions";
import { calculateNormalizedPercentage } from "@/lib/domain/grading";

type EligibleMark = {
  student: Student;
  mark: Mark | null;
};

export default function MarkEntryClient({
  assessment,
  initialMarks
}: {
  assessment: { id: string; maxScore: number };
  initialMarks: EligibleMark[];
}) {
  const [marks, setMarks] = useState<EligibleMark[]>(initialMarks);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const handleStatusChange = async (studentId: string, status: MarkStatus) => {
    // If changing to something other than SCORED, score becomes null automatically
    const currentMark = marks.find(m => m.student.id === studentId)?.mark;
    const currentScore = currentMark?.score;

    await saveMark(studentId, status === MarkStatus.SCORED ? (currentScore ?? 0) : null, status);
  };

  const handleScoreBlur = async (studentId: string, value: string) => {
    const currentMark = marks.find(m => m.student.id === studentId)?.mark;
    if (currentMark?.status !== MarkStatus.SCORED) return;
    
    let numValue = parseFloat(value);
    if (isNaN(numValue)) numValue = 0;
    
    if (numValue < 0) numValue = 0;
    if (numValue > assessment.maxScore) numValue = assessment.maxScore;

    if (currentMark?.score !== numValue) {
      await saveMark(studentId, numValue, MarkStatus.SCORED);
    }
  };

  const saveMark = async (studentId: string, score: number | null, status: MarkStatus) => {
    setSaving(prev => ({ ...prev, [studentId]: true }));
    
    const res = await upsertMarkAction({
      studentId,
      assessmentId: assessment.id,
      score,
      status
    });

    if (res.success) {
      // Optimistic update
      setMarks(prev => prev.map(m => {
        if (m.student.id === studentId) {
          return {
            ...m,
            mark: {
              ...m.mark,
              id: m.mark?.id || 'temp',
              studentId,
              assessmentId: assessment.id,
              score,
              status,
              createdAt: m.mark?.createdAt || new Date(),
              updatedAt: new Date()
            }
          };
        }
        return m;
      }));
    } else {
      alert("Error saving mark: " + res.error);
    }
    
    setSaving(prev => ({ ...prev, [studentId]: false }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/3">Student</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/4">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/4">Score (/{assessment.maxScore})</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Percentage</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {marks.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                No eligible students found in this class taking this subject.
              </td>
            </tr>
          ) : (
            marks.map(({ student, mark }) => {
              const status = mark?.status || MarkStatus.NOT_ENTERED;
              const isScored = status === MarkStatus.SCORED;
              const isSaving = saving[student.id];
              const percentage = calculateNormalizedPercentage(assessment, mark);

              return (
                <tr key={student.id} className={isSaving ? 'opacity-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{student.lastName}, {student.firstName}</div>
                    <div className="text-xs text-slate-500">{student.admissionNo}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select 
                      value={status}
                      onChange={(e) => handleStatusChange(student.id, e.target.value as MarkStatus)}
                      disabled={isSaving}
                      className="border rounded-md px-2 py-1 text-sm text-black w-full"
                    >
                      <option value={MarkStatus.NOT_ENTERED}>Not Entered</option>
                      <option value={MarkStatus.SCORED}>Scored</option>
                      <option value={MarkStatus.ABSENT}>Absent</option>
                      <option value={MarkStatus.EXEMPT}>Exempt</option>
                      <option value={MarkStatus.MALPRACTICE}>Malpractice</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isScored ? (
                      <input 
                        type="number" 
                        min="0" 
                        max={assessment.maxScore}
                        defaultValue={mark?.score ?? ''}
                        onBlur={(e) => handleScoreBlur(student.id, e.target.value)}
                        disabled={isSaving}
                        className="border rounded-md px-3 py-1 text-sm w-24 text-black text-right"
                      />
                    ) : (
                      <span className="text-sm text-slate-400 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {percentage !== null ? (
                      <span className="text-sm font-medium text-slate-900">{percentage.toFixed(1)}%</span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
