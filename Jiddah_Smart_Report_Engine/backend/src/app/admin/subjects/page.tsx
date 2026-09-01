import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { CreateSubjectForm } from '@/components/CreateSubjectForm'

type SubjectData = {
  id: string
  subject_name: string
  curriculum: string
  section: string
  created_at?: string
}

export default async function SubjectsManagementPage() {
  let subjects: SubjectData[] | null = null
  let error: string | null = null

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data, error: fetchError } = await supabase
      .from('subjects')
      .select('*')
      .order('section', { ascending: true })
      .order('curriculum', { ascending: true })
      .order('subject_name', { ascending: true })

    if (fetchError) {
      error = fetchError.message
    } else {
      subjects = data || []
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch subjects'
  }

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      nursery: 'Nursery',
      lower_primary: 'Lower Primary',
      upper_primary: 'Upper Primary',
    }
    return labels[section] || section
  }

  const getCurriculumLabel = (type: string) => {
    const labels: Record<string, string> = {
      secular: 'Secular',
      theology: 'Theology',
    }
    return labels[type] || type
  }

  const getSectionColor = (section: string) => {
    const colors: Record<string, string> = {
      nursery: 'bg-pink-100 text-pink-800',
      lower_primary: 'bg-emerald-100 text-emerald-800',
      upper_primary: 'bg-blue-100 text-blue-800',
    }
    return colors[section] || 'bg-gray-100 text-gray-800'
  }

  const getCurriculumColor = (type: string) => {
    const colors: Record<string, string> = {
      secular: 'bg-indigo-100 text-indigo-800',
      theology: 'bg-amber-100 text-amber-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Subjects Management</h1>
          <p className="text-gray-600 mt-1">Configure secular and theology subjects for all sections</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section - Left Side (2 columns on lg) */}
          <div className="lg:col-span-2">
            <CreateSubjectForm />
          </div>

          {/* Summary Section - Right Side (1 column on lg) */}
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-4">Overview</h3>
              <div className="text-3xl font-bold text-emerald-600 mb-2">{subjects?.length || 0}</div>
              <p className="text-sm text-gray-600">Subjects configured</p>

              {/* Sub-stats */}
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-lg font-semibold text-indigo-600">
                    {subjects?.filter((s) => s.curriculum === 'secular').length || 0}
                  </div>
                  <div className="text-xs text-gray-500">Secular</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-amber-600">
                    {subjects?.filter((s) => s.curriculum === 'theology').length || 0}
                  </div>
                  <div className="text-xs text-gray-500">Theology</div>
                </div>
              </div>
            </div>

            {/* Help Card */}
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
              <h4 className="text-sm font-semibold text-emerald-900 mb-3">📚 Dual Curriculum</h4>
              <p className="text-xs text-emerald-800 font-medium mb-2">Jiddah Islamic System:</p>
              <ul className="text-xs text-emerald-700 space-y-2">
                <li>• Distinguish between secular subjects (e.g., Math, English).</li>
                <li>• Distinguish theology subjects (e.g., Quran, Fiqh).</li>
                <li>• Subjects are mapped per section (Nursery, etc.) to ensure accurate report cards.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Subjects List Section */}
        <div className="mt-12">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900">Configured Subjects</h2>
              <p className="text-sm text-gray-600 mt-1">
                {subjects && subjects.length > 0
                  ? `${subjects.length} subject${subjects.length === 1 ? '' : 's'} available in the system`
                  : 'No subjects configured yet'}
              </p>
            </div>

            {error ? (
              <div className="p-6">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm font-medium">❌ Error: {error}</p>
                </div>
              </div>
            ) : subjects && subjects.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        <th className="px-6 py-3">Subject Name</th>
                        <th className="px-6 py-3">Curriculum</th>
                        <th className="px-6 py-3">Target Section</th>
                        <th className="px-6 py-3">Created Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 font-semibold text-gray-900">{sub.subject_name}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border border-white ${getCurriculumColor(sub.curriculum)}`}>
                              {getCurriculumLabel(sub.curriculum)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border border-white ${getSectionColor(sub.section)}`}>
                              {getSectionLabel(sub.section)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden p-6 space-y-4">
                  {subjects.map((sub) => (
                    <div key={sub.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <p className="font-bold text-lg text-gray-900">{sub.subject_name}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getCurriculumColor(sub.curriculum)}`}>
                          {getCurriculumLabel(sub.curriculum)}
                        </span>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getSectionColor(sub.section)}`}>
                          {getSectionLabel(sub.section)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="text-4xl mb-3">📝</div>
                <p className="text-gray-600 font-medium">No subjects found</p>
                <p className="text-sm text-gray-500 mt-2">Create your first subject using the form above</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
