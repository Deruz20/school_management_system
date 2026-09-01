'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TermData = {
  id: string
  academic_year: number
  term_number: number
  label: string
  is_current: boolean
  created_at?: string
}

export function TermsListClient({ initialTerms }: { initialTerms: TermData[] }) {
  const [terms, setTerms] = useState(initialTerms)
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  const handleSetActive = async (termId: string) => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/settings/terms/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to set active term')
      }
      
      // Update local state
      setTerms(terms.map(t => ({
        ...t,
        is_current: t.id === termId
      })))
      
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error setting active term')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900">Academic Terms (Terms Table)</h2>
        <p className="text-sm text-gray-600 mt-1">
          {terms.length} term{terms.length === 1 ? '' : 's'} configured
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                <th className="px-6 py-3">Academic Year</th>
                <th className="px-6 py-3">Term Label</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr key={term.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-semibold text-gray-900">{term.academic_year}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{term.label}</td>
                  <td className="px-6 py-4">
                    {term.is_current ? (
                      <span className="inline-block bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-medium">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {!term.is_current && (
                      <button
                        onClick={() => handleSetActive(term.id)}
                        disabled={isUpdating}
                        className="text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50"
                      >
                        Set as Active
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {terms.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No terms found in the terms table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
