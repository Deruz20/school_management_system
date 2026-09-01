import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { TermsListClient } from './TermsListClient'

type TermData = {
  id: string
  academic_year: number
  term_number: number
  label: string
  is_current: boolean
  created_at?: string
}

export default async function TermsManagementPage() {
  let terms: TermData[] | null = null
  let error: string | null = null

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data, error: fetchError } = await supabase
      .from('terms')
      .select('*')
      .order('academic_year', { ascending: false })
      .order('term_number', { ascending: true })

    if (fetchError) {
      error = fetchError.message
    } else {
      terms = data || []
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch terms'
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
          <h1 className="text-3xl font-bold text-gray-900">Academic Terms Management</h1>
          <p className="text-gray-600 mt-1">Create and manage academic terms for your institution</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Summary Section - Left Side */}
          <div className="space-y-6 lg:col-span-1">
            {/* Stats Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-4">Overview</h3>
              <div className="text-3xl font-bold text-emerald-600 mb-2">{terms?.length || 0}</div>
              <p className="text-sm text-gray-600">Terms configured</p>
            </div>

            {/* Help Card */}
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
              <h4 className="text-sm font-semibold text-emerald-900 mb-3">💡 Tips</h4>
              <ul className="text-xs text-emerald-700 space-y-2">
                <li>• Only one term can be active at a time</li>
                <li>• Setting a new active term updates it everywhere</li>
              </ul>
            </div>
          </div>

          {/* Terms List Section - Right Side */}
          <div className="lg:col-span-2">
            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm font-medium">❌ Error: {error}</p>
              </div>
            ) : (
              <TermsListClient initialTerms={terms || []} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
