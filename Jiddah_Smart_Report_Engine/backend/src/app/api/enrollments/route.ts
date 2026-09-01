import { reshapeEnrollmentRow } from '@/lib/enrollment-shape'
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
      .from('enrollments')
      .select(`
        id,
        academic_year,
        is_active,
        circular_classes ( id, class_name, section ),
        theology_classes ( id, class_name_arabic, class_name_english, level ),
        students ( id, name, admission_number, created_at )
      `)
      .eq('is_active', true)
      .order('academic_year', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    const reshaped =
      data?.map((e) => reshapeEnrollmentRow(e)).filter((row): row is NonNullable<typeof row> => row != null) ?? []

    return withCors(request, NextResponse.json(reshaped))
  } catch (err) {
    console.error('API error:', err)
    return withCors(request, NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}