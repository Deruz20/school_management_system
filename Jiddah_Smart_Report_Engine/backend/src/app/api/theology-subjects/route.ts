import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const level = searchParams.get('level')

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Auth Enforcement Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('theology_subjects')
      .select('id, subject_name_arabic, level, sort_order')
      .order('sort_order', { ascending: true })

    if (level) {
      if (!['raudha', 'ibtidaai_lower', 'ibtidaai_upper'].includes(level)) {
        return NextResponse.json({ error: 'Invalid level parameter' }, { status: 400 })
      }
      query = query.eq('level', level)
    }

    const { data: subjects, error: subjectsError } = await query

    if (subjectsError) {
      console.error('theology_subjects DB error:', subjectsError.message)
      return NextResponse.json({ error: subjectsError.message }, { status: 500 })
    }

    return NextResponse.json(subjects || [])
  } catch (err) {
    console.error('Theology subjects API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
