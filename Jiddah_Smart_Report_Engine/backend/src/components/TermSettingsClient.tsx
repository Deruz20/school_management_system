'use client'

import { useState } from 'react'

type Term = {
  id: string
  label: string
  academic_year: number
  term_number: number
  is_current: boolean
  start_date: string | null
  end_date: string | null
  next_term_start: string | null
}

type SaveState = 'idle' | 'saving' | 'success' | 'error'

function TermCard({ term }: { term: Term }) {
  const [startDate, setStartDate] = useState(term.start_date?.slice(0, 10) ?? '')
  const [endDate, setEndDate] = useState(term.end_date?.slice(0, 10) ?? '')
  const [nextTermStart, setNextTermStart] = useState(term.next_term_start?.slice(0, 10) ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSave = async () => {
    setSaveState('saving')
    setErrorMsg('')
    try {
      const res = await fetch('/api/settings/terms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termId: term.id,
          start_date: startDate || null,
          end_date: endDate || null,
          next_term_start: nextTermStart || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to save')
        setSaveState('error')
      } else {
        setSaveState('success')
        setTimeout(() => setSaveState('idle'), 3000)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error')
      setSaveState('error')
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-6 ${term.is_current ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{term.label}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Academic Year {term.academic_year} &bull; Term {term.term_number}
          </p>
        </div>
        {term.is_current && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            Current Term
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            Next Term Starts
          </label>
          <input
            type="date"
            value={nextTermStart}
            onChange={e => setNextTermStart(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saveState === 'saving' ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </>
          ) : 'Save Dates'}
        </button>

        {saveState === 'success' && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </span>
        )}
        {saveState === 'error' && (
          <span className="text-sm font-medium text-red-600">
            Error: {errorMsg}
          </span>
        )}
      </div>
    </div>
  )
}

export default function TermSettingsClient({ terms }: { terms: Term[] }) {
  const grouped: Record<number, Term[]> = {}
  for (const t of terms) {
    if (!grouped[t.academic_year]) grouped[t.academic_year] = []
    grouped[t.academic_year].push(t)
  }
  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a)

  return (
    <div className="space-y-10">
      {years.map(year => (
        <div key={year}>
          <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-4">
            Academic Year {year}
          </h2>
          <div className="space-y-4">
            {grouped[year]
              .sort((a, b) => a.term_number - b.term_number)
              .map(term => (
                <TermCard key={term.id} term={term} />
              ))}
          </div>
        </div>
      ))}
      {years.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No terms found. Create terms first in the Terms management page.
        </div>
      )}
    </div>
  )
}
