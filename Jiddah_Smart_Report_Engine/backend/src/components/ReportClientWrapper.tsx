'use client'

import { useState } from 'react'
import { ReportRenderer } from '@/components/ReportRenderer'

type ClassData = {
  id: string
  class_name: string
  section: string
}

type TermData = {
  id: string
  term: string
  year: number
}

type StudentData = {
  id: string
  name: string
  class_name: string
}

interface ReportClientWrapperProps {
  classes: ClassData[]
  terms: TermData[]
  students: StudentData[]
}

export function ReportClientWrapper({ classes, terms, students }: ReportClientWrapperProps) {
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedTermId, setSelectedTermId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [examMode, setExamMode] = useState<'BOT' | 'MOT' | 'EOT'>('EOT')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<any>(null)

  const selectedClass = classes.find(c => c.id === selectedClassId)
  const filteredStudents = students.filter(s => s.class_name === selectedClass?.class_name)

  const handleGenerate = async () => {
    if (!selectedClassId) {
      setError('Please select a class.')
      return
    }
    if (!selectedTermId) {
      setError('Please select an academic term.')
      return
    }
    if (!selectedStudentId) {
      setError('Please select a student.')
      return
    }

    setLoading(true)
    setError(null)
    setReportData(null)

    try {
      const res = await fetch(`/api/reports?student_id=${selectedStudentId}&term_id=${selectedTermId}&examMode=${examMode}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate report')
      }

      if (!data.marks || data.marks.length === 0) {
        throw new Error('No marks available for this student in selected term')
      }

      setReportData(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getTermLabel = (term: string) => {
    const labels: Record<string, string> = {
      beginning: '1st Term',
      midterm: '2nd Term',
      endterm: '3rd Term',
    }
    return labels[term] || term
  }

  return (
    <div className="space-y-6">
      {/* Configuration Panel - Hidden when printing */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 print:hidden">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Report Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Academic Term</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white"
            >
              <option value="">-- Select Term --</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>
                  {term.year} - {getTermLabel(term.term)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value)
                setSelectedStudentId('') // reset student when class changes
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white"
            >
              <option value="">-- Select Class --</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name} ({cls.section.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={!selectedClassId}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">-- Select Student --</option>
              {filteredStudents.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
            {selectedClassId && filteredStudents.length === 0 && (
              <p className="text-xs text-red-500 mt-1">No students registered in this class.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exam Mode</label>
            <select
              value={examMode}
              onChange={(e) => setExamMode(e.target.value as 'BOT' | 'MOT' | 'EOT')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white"
            >
              <option value="BOT">BOT - Beginning of Term</option>
              <option value="MOT">MOT - Mid Term</option>
              <option value="EOT">EOT - End of Term</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={loading} // Only disable if actively loading, so errors show if empty
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-2 px-8 rounded-lg transition duration-200 shadow-sm"
          >
            {loading ? 'Generating report...' : '📄 Generate Report'}
          </button>
        </div>
      </div>

      {/* States - Hidden when printing */}
      <div className="print:hidden">
        {loading && (
          <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent align-[-0.125em] mb-4"></div>
            <p className="text-emerald-800 font-medium">Generating report...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">❌ {error}</p>
          </div>
        )}
      </div>

      {/* Render the specific report layout */}
      {!loading && !error && reportData && (
        <ReportRenderer data={reportData} examMode={examMode} />
      )}
    </div>
  )
}
