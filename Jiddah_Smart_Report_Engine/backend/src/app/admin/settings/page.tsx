import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import TermSettingsClient from '@/components/TermSettingsClient'

export const dynamic = 'force-dynamic'

export default async function TermSettingsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: terms, error } = await supabase
    .from('terms')
    .select('id, label, academic_year, term_number, is_current, start_date, end_date, next_term_start')
    .order('academic_year', { ascending: false })
    .order('term_number', { ascending: true })

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700 text-sm">
          Failed to load terms: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/admin"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              ← Dashboard
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">Term Settings</span>
          </div>
          <h1 className="text-3xl font-bold text-emerald-900">Term Date Settings</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Configure start, end, and next-term dates for each academic term.
            These dates appear on printed report cards.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Navigation</h2>
              <nav className="space-y-2">
                <Link href="/admin" className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 text-sm">
                  Dashboard
                </Link>
                <Link href="/admin/students" className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 text-sm">
                  Students
                </Link>
                <Link href="/admin/terms" className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 text-sm">
                  Terms
                </Link>
                <Link
                  href="/admin/settings"
                  className="block px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-sm"
                >
                  ⚙ Term Settings
                </Link>
                <div className="space-y-1 pt-2">
                  <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Reports
                  </div>
                  <Link href="/admin/reports" className="block px-6 py-2 rounded-md text-gray-700 hover:bg-gray-100 text-sm">
                    Report Generator
                  </Link>
                </div>
              </nav>
            </div>

            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-700 leading-relaxed">
              <strong className="block mb-1">📋 How this works</strong>
              The <strong>End Date</strong> and <strong>Next Term Starts</strong> dates are printed
              at the bottom of every EOT report card automatically once saved.
            </div>
          </div>

          {/* Main */}
          <div className="lg:col-span-3">
            <TermSettingsClient terms={terms ?? []} />
          </div>
        </div>
      </div>
    </div>
  )
}
