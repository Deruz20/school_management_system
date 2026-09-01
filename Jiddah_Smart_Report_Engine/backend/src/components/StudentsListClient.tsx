'use client'

import { useState } from 'react'

interface StudentData {
  id: string
  name: string
  admission_number: string
  created_at: string
  circular_class: string
  section: string | null
  theology_class_arabic: string | null
  theology_class_english: string | null
  academic_year: number
}

function getSectionColor(section: string | null | undefined) {
  if (!section) return 'bg-gray-100 text-gray-800'
  switch (section?.toLowerCase()) {
    case 'nursery':
      return 'bg-purple-100 text-purple-800'
    case 'lower_primary':
      return 'bg-blue-100 text-blue-800'
    case 'upper_primary':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function formatSection(section: string | null | undefined) {
  if (!section) return '—'
  return section.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export function StudentsListClient({ students }: { students: StudentData[] }) {
  const [search, setSearch] = useState('')

  const filtered = students.filter((s) => {
    return (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.circular_class.toLowerCase().includes(search.toLowerCase()) ||
      (s.theology_class_arabic?.toLowerCase().includes(search.toLowerCase()) ?? false)
    )
  })

  return (
    <div className="mt-12">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Registered Students</h2>
            <p className="text-sm text-gray-600 mt-1">
              Showing {filtered.length} of {students.length} students
            </p>
          </div>
          <div className="w-full sm:w-80">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or class"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🎓</div>
            <p className="text-gray-600 font-medium">No students found</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your search</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    <th className="px-6 py-3">Admission #</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Circular Class</th>
                    <th className="px-6 py-3">Theology Class</th>
                    <th className="px-6 py-3">Section</th>
                    <th className="px-6 py-3">Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">
                        {s.admission_number}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {s.name}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {s.circular_class}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {s.theology_class_arabic ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getSectionColor(s.section)}`}>
                          {formatSection(s.section)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                        {s.academic_year}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-6 space-y-4">
              {filtered.map((s) => (
                <div key={s.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-gray-900 text-lg">{s.name}</h3>
                    <span className="text-xs font-semibold bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {s.academic_year}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase">Admission #</span>
                      <p className="text-sm font-mono text-gray-900">
                        {s.admission_number}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase">Circular Class</span>
                      <p className="text-sm font-medium text-gray-900">
                        {s.circular_class}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase">Theology Class</span>
                      <p className="text-sm font-medium text-gray-900">
                        {s.theology_class_arabic ?? '—'}
                      </p>
                    </div>
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getSectionColor(s.section)}`}>
                        {formatSection(s.section)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
