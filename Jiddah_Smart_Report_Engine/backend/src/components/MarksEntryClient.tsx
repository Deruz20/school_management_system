'use client'

import React, { useState, useEffect } from 'react'

type TermData = {
  id: string
  academic_year: number
  term_number: number
  label: string
  is_current: boolean
}

type EnrollmentData = {
  enrollment_id: string
  name: string
  admission_number: string
  circular_class: string
  section: string | null
  theology_class_arabic: string | null
  theology_class_level: string | null
}

type CircularMarkRow = {
  subject_id: string
  subject_name: string
  is_core: boolean
  bot_score: number | null
  mot_score: number | null
  eot_score: number | null
}

type TheologyMarkRow = {
  subject_id: string
  subject_name_arabic: string
  mot_score: number | null
  eot_score: number | null
}

type TheologySubject = {
  id: string
  subject_name_arabic: string
}

interface MarksEntryClientProps {
  terms: TermData[]
}

type ExamType = 'bot' | 'mot' | 'eot' | 'all'
type ReportType = 'circular' | 'theology'

export function MarksEntryClient({ terms }: MarksEntryClientProps) {
  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('')
  const [examType, setExamType] = useState<ExamType>('mot')
  const [circularMarks, setCircularMarks] = useState<CircularMarkRow[]>([])
  const [theologyMarks, setTheologyMarks] = useState<TheologyMarkRow[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedEnrollment = enrollments.find((e) => e.enrollment_id === selectedEnrollmentId) || null

  // Load enrollments on mount
  useEffect(() => {
    const loadEnrollments = async () => {
      setIsFetching(true)
      setError(null)

      try {
        const res = await fetch('/api/enrollments')
        if (!res.ok) {
          const payload = await res.json()
          throw new Error(payload.error || 'Failed to load enrollments')
        }

        const data = await res.json()
        setEnrollments(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load enrollments')
      } finally {
        setIsFetching(false)
      }
    }

    loadEnrollments()
  }, [])

  // Load marks when enrollment or term changes
  useEffect(() => {
    if (!selectedEnrollmentId || !selectedTermId) {
      setCircularMarks([])
      setTheologyMarks([])
      return
    }

    const loadMarks = async () => {
      setIsLoading(true)
      setError(null)
      setSuccess(false)

      try {
        const res = await fetch(
          `/api/marks?enrollment_id=${encodeURIComponent(selectedEnrollmentId)}&term_id=${encodeURIComponent(selectedTermId)}`
        )
        const payload = await res.json()

        if (!res.ok) {
          throw new Error(payload.error || 'Failed to load marks')
        }

        setCircularMarks(payload.circular_marks || [])
        setTheologyMarks(payload.theology_marks || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load marks')
      } finally {
        setIsLoading(false)
      }
    }

    loadMarks()
  }, [selectedEnrollmentId, selectedTermId])

  const handleCircularScoreChange = (subject_id: string, field: 'bot' | 'mot' | 'eot', value: string) => {
    if (value !== '' && isNaN(Number(value))) return
    if (value !== '') {
      const num = Number(value)
      if (num < 0 || num > 100) return
    }

    setCircularMarks((prev) =>
      prev.map((mark) => {
        if (mark.subject_id === subject_id) {
          const score = value === '' ? null : Number(value)
          return { 
            ...mark, 
            ...(field === 'bot' ? { bot_score: score } : field === 'mot' ? { mot_score: score } : { eot_score: score })
          }
        }
        return mark
      })
    )
  }

  const handleTheologyScoreChange = (subject_id: string, field: 'mot' | 'eot', value: string) => {
    if (value !== '' && isNaN(Number(value))) return
    if (value !== '') {
      const num = Number(value)
      if (num < 0 || num > 100) return
    }

    setTheologyMarks((prev) =>
      prev.map((mark) => {
        if (mark.subject_id === subject_id) {
          const score = value === '' ? null : Number(value)
          return { ...mark, [field === 'mot' ? 'mot_score' : 'eot_score']: score }
        }
        return mark
      })
    )
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (!selectedTermId || !selectedEnrollmentId) {
      setError('Please select a term and a student before saving marks.')
      return
    }

    // Validate circular marks
    for (const mark of circularMarks) {
      if (['bot', 'all'].includes(examType) && mark.bot_score !== null && (mark.bot_score < 0 || mark.bot_score > 100)) {
        setError('All circular scores must be between 0 and 100.')
        return
      }
      if (['mot', 'all'].includes(examType) && mark.mot_score !== null && (mark.mot_score < 0 || mark.mot_score > 100)) {
        setError('All circular scores must be between 0 and 100.')
        return
      }
      if (['eot', 'all'].includes(examType) && mark.eot_score !== null && (mark.eot_score < 0 || mark.eot_score > 100)) {
        setError('All circular scores must be between 0 and 100.')
        return
      }
    }

    // Validate theology marks
    for (const mark of theologyMarks) {
      if (['mot', 'all'].includes(examType) && mark.mot_score !== null && (mark.mot_score < 0 || mark.mot_score > 100)) {
        setError('All theology scores must be between 0 and 100.')
        return
      }
      if (['eot', 'all'].includes(examType) && mark.eot_score !== null && (mark.eot_score < 0 || mark.eot_score > 100)) {
        setError('All theology scores must be between 0 and 100.')
        return
      }
    }

    setIsSaving(true)

    try {
      const circularPayload = circularMarks.map((mark) => ({
        subject_id: mark.subject_id,
        bot_score: mark.bot_score,
        mot_score: mark.mot_score,
        eot_score: mark.eot_score,
      }))

      const theologyPayload = theologyMarks.map((mark) => ({
        subject_id: mark.subject_id,
        mot_score: mark.mot_score,
        eot_score: mark.eot_score,
      }))

      const response = await fetch('/api/marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollment_id: selectedEnrollmentId,
          term_id: selectedTermId,
          score_type: examType,
          circular_marks: circularPayload,
          theology_marks: theologyPayload.length > 0 ? theologyPayload : null,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save marks')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="max-w-3xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Marks Entry</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="term" className="block text-sm font-semibold text-gray-900 mb-3">
                Step 1: Select Term
              </label>
              <select
                id="term"
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
              >
                <option value="">Choose a term...</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {`${term.label} ${term.academic_year}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="student" className="block text-sm font-semibold text-gray-900 mb-3">
                Step 2: Select Student
              </label>
              <select
                id="student"
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
              >
                <option value="">Choose a student...</option>
                {enrollments.map((enrollment) => (
                  <option key={enrollment.enrollment_id} value={enrollment.enrollment_id}>
                    {`${enrollment.name} • ${enrollment.admission_number} • ${enrollment.circular_class}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedEnrollment && (
            <div className="rounded-lg border border-gray-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900 font-semibold">Student Details</p>
              <p className="text-sm text-emerald-900">{selectedEnrollment.name}</p>
              <p className="text-sm text-emerald-900">Class: {selectedEnrollment.circular_class}</p>
              <p className="text-sm text-emerald-900">Section: {selectedEnrollment.section || '—'}</p>
              {selectedEnrollment.theology_class_arabic && (
                <p className="text-sm text-emerald-900" dir="rtl">
                  الدرجة اللاهوتية: {selectedEnrollment.theology_class_arabic}
                </p>
              )}
            </div>
          )}

          {isFetching ? (
            <div className="p-6 bg-gray-100 rounded-lg border border-gray-200 text-center">
              Loading students...
            </div>
          ) : selectedEnrollment && selectedTermId ? (
            <div className="space-y-6">
              {/* Exam Type Selector */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-900">Step 3: Select Exam Type</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as ExamType)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
                >
                  <option value="bot">BOT (Beginning of Term)</option>
                  <option value="mot">MOT (Mid Term)</option>
                  <option value="eot">EOT (End of Term)</option>
                  <option value="all">ALL (Combined Entry)</option>
                </select>
              </div>

              {/* Circular Marks Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Circular Marks</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Subject</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Core</th>
                        {['bot', 'all'].includes(examType) && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">BOT Score</th>}
                        {['mot', 'all'].includes(examType) && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">MOT Score</th>}
                        {['eot', 'all'].includes(examType) && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">EOT Score</th>}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {circularMarks.map((mark) => (
                        <tr key={mark.subject_id}>
                          <td className="px-4 py-3 text-sm text-gray-700">{mark.subject_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{mark.is_core ? '✓' : '—'}</td>
                          {['bot', 'all'].includes(examType) && (
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={mark.bot_score ?? ''}
                                onChange={(e) => handleCircularScoreChange(mark.subject_id, 'bot', e.target.value)}
                                placeholder="BOT"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                              />
                            </td>
                          )}
                          {['mot', 'all'].includes(examType) && (
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={mark.mot_score ?? ''}
                                onChange={(e) => handleCircularScoreChange(mark.subject_id, 'mot', e.target.value)}
                                placeholder="MOT"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                              />
                            </td>
                          )}
                          {['eot', 'all'].includes(examType) && (
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={mark.eot_score ?? ''}
                                onChange={(e) => handleCircularScoreChange(mark.subject_id, 'eot', e.target.value)}
                                placeholder="EOT"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Theology Marks Table */}
              {theologyMarks.length > 0 && examType !== 'bot' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900" dir="rtl">
                    درجات اللاهوت
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900" dir="rtl">
                            المادة
                          </th>
                          {['mot', 'all'].includes(examType) && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">MOT Score</th>}
                          {['eot', 'all'].includes(examType) && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">EOT Score</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {theologyMarks.map((mark) => (
                          <tr key={mark.subject_id}>
                            <td className="px-4 py-3 text-sm text-gray-700" dir="rtl">
                              {mark.subject_name_arabic}
                            </td>
                            {['mot', 'all'].includes(examType) && (
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={mark.mot_score ?? ''}
                                  onChange={(e) => handleTheologyScoreChange(mark.subject_id, 'mot', e.target.value)}
                                  placeholder="MOT"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                                />
                              </td>
                            )}
                            {['eot', 'all'].includes(examType) && (
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={mark.eot_score ?? ''}
                                  onChange={(e) => handleTheologyScoreChange(mark.subject_id, 'eot', e.target.value)}
                                  placeholder="EOT"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  Marks saved successfully
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition"
              >
                {isSaving ? 'Saving...' : `Save ${examType.toUpperCase()} Marks`}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              Select a term and student to view the marks entry form.
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

