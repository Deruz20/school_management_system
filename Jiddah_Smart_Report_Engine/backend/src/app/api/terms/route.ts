import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase
      .from('terms')
      .select('id, academic_year, term_number, label, is_current, start_date, end_date, next_term_start')
      .order('academic_year', { ascending: false })
      .order('term_number', { ascending: true })

    if (error) {
      console.error('terms DB error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ data }))
  } catch (err) {
    console.error('terms API error:', err)
    return withCors(request, NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
