import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const section = searchParams.get('section')

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    let query = supabase
      .from('circular_subjects')
      .select('id, subject_name, section')
      .order('subject_name', { ascending: true })

    if (section) {
      if (!['nursery', 'lower_primary', 'upper_primary'].includes(section)) {
        return NextResponse.json({ error: 'Invalid section parameter' }, { status: 400 })
      }
      query = query.eq('section', section)
    }

    const { data: subjects, error: subjectsError } = await query

    if (subjectsError) {
      console.error('circular_subjects DB error:', subjectsError.message)
      return NextResponse.json({ error: subjectsError.message }, { status: 500 })
    }

    return NextResponse.json(subjects || [])
  } catch (err) {
    console.error('Circular subjects API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
