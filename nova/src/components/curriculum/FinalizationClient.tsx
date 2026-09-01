'use client';

import { useState, useEffect } from 'react';
import { fetchClassEnrollments, previewFinalizationAction, finalizeResultAction } from '@/app/curriculum/finalization/actions';
import { Term, Class } from '@prisma/client';
import { LockClosedIcon, DocumentCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type TermWithYear = Term & { academicYear: { name: string } };

type EnrollmentData = {
  id: string;
  studentName: string;
  admissionNo: string;
  finalized: boolean;
  termResultId?: string;
};

type PreviewData = {
  enrollment: {
    id: string;
    student: { firstName: string; lastName: string };
    classRef: { name: string; aggregationStrategy: string | null };
  };
  gradeScale: { name: string };
  overall: { totalScore: number | null; aggregate: number | null; division: string | null };
  subjectResults: {
    classSubjectId: string;
    subjectName: string;
    totalScore: number | null;
    status: string;
    grade: string | null;
    points: number | null;
    remarks: string | null;
  }[];
};

export function FinalizationClient({
  terms,
  classes
}: {
  terms: TermWithYear[];
  classes: Class[];
}) {
  const [termId, setTermId] = useState<string>(terms[0]?.id || '');
  const [classId, setClassId] = useState<string>(classes[0]?.id || '');

  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);

  useEffect(() => {
    if (termId && classId) {
      const fetchAndSet = async () => {
        setLoading(true);
        const data = await fetchClassEnrollments(classId, termId);
        setEnrollments(data);
        setPreview(null);
        setSelectedEnrollment(null);
        setLoading(false);
      };
      fetchAndSet();
    }
  }, [termId, classId]);

  const handlePreview = async (enrollmentId: string) => {
    setLoading(true);
    setSelectedEnrollment(enrollmentId);
    const res = await previewFinalizationAction(enrollmentId, termId);
    if (res.success) {
      setPreview(res.data as unknown as PreviewData);
    } else {
      alert('Error: ' + res.error);
      setPreview(null);
    }
    setLoading(false);
  };

  const handleFinalize = async (enrollmentId: string, isCorrection: boolean = false) => {
    let reason;
    if (isCorrection) {
      reason = prompt('Enter a reason for this correction. This will be logged in the audit trail.');
      if (!reason) return; // User cancelled
    }

    if (!confirm('Are you sure you want to finalize this result? It will become an immutable historical snapshot.')) {
      return;
    }

    setLoading(true);
    const res = await finalizeResultAction(enrollmentId, termId, reason);
    if (res.success) {
      alert('Result finalized successfully!');
      setLoading(true);
      fetchClassEnrollments(classId, termId).then(data => {
        setEnrollments(data);
        setPreview(null);
        setLoading(false);
      });
    } else {
      alert('Error: ' + res.error);
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar: Selection & Students */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Term</label>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {terms.map(t => (
                <option key={t.id} value={t.id}>{t.academicYear.name} - {t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Students</h3>
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">
              {enrollments.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && !preview && (
              <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
            )}
            {!loading && enrollments.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">No students enrolled.</div>
            )}
            <ul className="divide-y divide-gray-100">
              {enrollments.map(enr => (
                <li key={enr.id}>
                  <button
                    onClick={() => handlePreview(enr.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex items-center justify-between ${selectedEnrollment === enr.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{enr.studentName}</p>
                      <p className="text-xs text-gray-500">{enr.admissionNo}</p>
                    </div>
                    {enr.finalized ? (
                      <LockClosedIcon className="w-5 h-5 text-green-500" title="Finalized" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Main Area: Preview */}
      <div className="lg:col-span-2">
        {preview ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Finalization Preview</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {preview.enrollment.student.firstName} {preview.enrollment.student.lastName} • {preview.enrollment.classRef.name}
                </p>
              </div>
              <div className="flex space-x-3">
                {enrollments.find(e => e.id === preview.enrollment.id)?.finalized ? (
                  <button
                    onClick={() => handleFinalize(preview.enrollment.id, true)}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium hover:bg-yellow-200 transition-colors"
                  >
                    <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                    Correct & Re-Finalize
                  </button>
                ) : (
                  <button
                    onClick={() => handleFinalize(preview.enrollment.id)}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <LockClosedIcon className="w-4 h-4 mr-2" />
                    Finalize Result
                  </button>
                )}
                
                {enrollments.find(e => e.id === preview.enrollment.id)?.finalized && enrollments.find(e => e.id === preview.enrollment.id)?.termResultId && (
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const { renderReportAction } = await import('@/lib/integrations/print-actions');
                        const termResultId = enrollments.find(e => e.id === preview.enrollment.id)?.termResultId || '';
                        const res = await renderReportAction(termResultId);
                        
                        if (res.success && res.html) {
                           const printWindow = window.open('', '_blank');
                           if (printWindow) {
                             printWindow.document.write(res.html);
                             printWindow.document.close();
                             printWindow.focus();
                             // Allow images to load before printing
                             setTimeout(() => {
                               printWindow.print();
                             }, 500);
                           }
                        } else {
                           alert('Failed to render report: ' + (res.error || 'Unknown error'));
                        }
                      } catch (err) {
                        alert('Error printing report.');
                        console.error(err);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <DocumentCheckIcon className="w-4 h-4 mr-2" />
                    Print Report
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 space-y-8 flex-1 overflow-y-auto">
              {/* Aggregation Strategy Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                <DocumentCheckIcon className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900">Grading Configuration</h4>
                  <p className="text-xs text-blue-800 mt-1">
                    Using Scale: <strong>{preview.gradeScale.name}</strong> • Strategy: <strong>{preview.enrollment.classRef.aggregationStrategy}</strong>
                  </p>
                </div>
              </div>

              {/* Overall Performance */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Performance</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Score</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{preview.overall.totalScore ?? '-'}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Aggregate</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{preview.overall.aggregate ?? '-'}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Division</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-1">{preview.overall.division ?? '-'}</p>
                  </div>
                </div>
              </div>

              {/* Subject Breakdown */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject Breakdown</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Grade</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Points</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.subjectResults.map(sub => (
                        <tr key={sub.classSubjectId}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{sub.subjectName}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-900 font-semibold">{sub.totalScore ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sub.status !== 'COMPLETED' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {sub.grade ?? '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-500">{sub.points ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{sub.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="h-full min-h-[600px] bg-white rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <DocumentCheckIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No Student Selected</h3>
            <p className="text-gray-500 mt-2 max-w-sm">
              Select a student from the list to preview their computed results and finalize them for the term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
