import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { CreateClassForm } from '@/components/CreateClassForm'

type ClassData = {
  id: string
  class_name: string
  section: string
  created_at?: string
}

export default async function ClassesManagementPage() {
  let classes: ClassData[] | null = null
  let error: string | null = null

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data, error: fetchError } = await supabase
      .from('classes')
      .select('*')
      .order('section', { ascending: true })
      .order('class_name', { ascending: true })

    if (fetchError) {
      error = fetchError.message
    } else {
      classes = data || []
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch classes'
  }

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      nursery: 'Nursery',
      lower_primary: 'Lower Primary',
      upper_primary: 'Upper Primary',
    }
    return labels[section] || section
  }

  const getSectionColor = (section: string) => {
    const colors: Record<string, string> = {
      nursery: 'bg-pink-100 text-pink-800',
      lower_primary: 'bg-emerald-100 text-emerald-800',
      upper_primary: 'bg-blue-100 text-blue-800',
    }
    return colors[section] || 'bg-gray-100 text-gray-800'
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
          <h1 className="text-3xl font-bold text-gray-900">Classes Management</h1>
          <p className="text-gray-600 mt-1">Configure classes for Jiddah Islamic Nursery & Primary School</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section - Left Side (2 columns on lg) */}
          <div className="lg:col-span-2">
            <CreateClassForm />
          </div>

          {/* Summary Section - Right Side (1 column on lg) */}
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-4">Overview</h3>
              <div className="text-3xl font-bold text-emerald-600 mb-2">{classes?.length || 0}</div>
              <p className="text-sm text-gray-600">Classes configured</p>
            </div>

            {/* Help Card */}
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
              <h4 className="text-sm font-semibold text-emerald-900 mb-3">💡 Guidance</h4>
              <p className="text-xs text-emerald-800 font-medium mb-2">Recommended Class Formats:</p>
              <ul className="text-xs text-emerald-700 space-y-2">
                <li>• <strong>Nursery:</strong> Baby, Middle, Top</li>
                <li>• <strong>Lower Primary:</strong> P1, P2, P3</li>
                <li>• <strong>Upper Primary:</strong> P4, P5, P6, P7</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Classes List Section */}
        <div className="mt-12">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900">Configured Classes</h2>
              <p className="text-sm text-gray-600 mt-1">
                {classes && classes.length > 0
                  ? `${classes.length} class${classes.length === 1 ? '' : 'es'} available in the system`
                  : 'No classes configured yet'}
              </p>
            </div>

            {error ? (
              <div className="p-6">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm font-medium">❌ Error: {error}</p>
                </div>
              </div>
            ) : classes && classes.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        <th className="px-6 py-3">Class Name</th>
                        <th className="px-6 py-3">Section</th>
                        <th className="px-6 py-3">Created Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((cls) => (
                        <tr key={cls.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 font-semibold text-gray-900">{cls.class_name}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getSectionColor(cls.section)}`}>
                              {getSectionLabel(cls.section)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {cls.created_at ? new Date(cls.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden p-6 space-y-4">
                  {classes.map((cls) => (
                    <div key={cls.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-lg text-gray-900">{cls.class_name}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getSectionColor(cls.section)}`}>
                          {getSectionLabel(cls.section)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="text-4xl mb-3">🏫</div>
                <p className="text-gray-600 font-medium">No classes found</p>
                <p className="text-sm text-gray-500 mt-2">Create your first class using the form above</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
