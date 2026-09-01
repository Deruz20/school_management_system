import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ReportGeneratorClient } from '@/components/ReportGeneratorClient'

type TermData = {
  id: string
  academic_year: number
  term_number: number
  label: string
  is_current: boolean
}

export default async function ReportsManagementPage() {
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

    if (termError) throw termError
    terms = termData || []
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load terms'
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg print:hidden max-w-[1600px] mx-auto mt-6">
        <p className="text-red-800 font-medium">❌ System Error: {error}</p>
        <p className="text-red-600 text-sm mt-1">Please ensure the database connection is active and terms exist.</p>
      </div>
    )
  }

  return <ReportGeneratorClient terms={terms} />
}
