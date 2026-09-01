
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { MarksEntryClient } from '@/components/MarksEntryClient'

export const dynamic = 'force-dynamic'

type TermData = {
  id: string
  academic_year: number
  term_number: number
  label: string
  is_current: boolean
}

export default async function MarksEntryPage() {
  let terms: TermData[] = []
  let error: string | null = null

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: termData, error: termError } = await supabase
      .from('terms')
      .select('id, academic_year, term_number, label, is_current')
      .order('academic_year', { ascending: false })
      .order('term_number', { ascending: true })

    if (termError) {
      console.error('termError:', JSON.stringify(termError, null, 2))
      throw termError
    }
    terms = termData || []
  } catch (err: any) {
    console.error('Terms error full detail:', JSON.stringify(err, null, 2))
    error = err?.message || err?.details || err?.hint || JSON.stringify(err) || 'Failed to load terms data'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
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
          <h1 className="text-3xl font-bold text-gray-900">Enter Marks</h1>
          <p className="text-gray-600 mt-1">Choose term and student, then enter circular and theology scores.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">❌ System Error: {error}</p>
            <p className="text-red-600 text-sm mt-1">Please ensure the database connection is active and the terms table exists.</p>
          </div>
        ) : (
          <MarksEntryClient terms={terms} />
        )}
      </div>
    </div>
  )
}
