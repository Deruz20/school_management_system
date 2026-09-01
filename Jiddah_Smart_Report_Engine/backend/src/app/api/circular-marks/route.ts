import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const term_id = searchParams.get('term_id')

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Auth Enforcement Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('circular_marks')
      .select(`
        id,
        enrollment_id,
        subject_id,
        term_id,
        bot_score,
        mot_score,
        eot_score,
        enrollments (
          student_id,
          circular_class_id,
          students ( name ),
          circular_classes ( class_name, section )
        ),
        circular_subjects ( subject_name, section )
      `)

    if (term_id) {
      query = query.eq('term_id', term_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] }, { status: 200 })
  } catch (err) {
    console.error('GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { enrollment_id, subject_id, term_id, bot_score, mot_score, eot_score } = body

    if (!enrollment_id || !subject_id || !term_id) {
      return NextResponse.json(
        { error: 'enrollment_id, subject_id, and term_id are required' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Auth Enforcement Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updateData: any = {}
    if (bot_score !== undefined) updateData.bot_score = bot_score === '' ? null : parseFloat(bot_score)
    if (mot_score !== undefined) updateData.mot_score = mot_score === '' ? null : parseFloat(mot_score)
    if (eot_score !== undefined) updateData.eot_score = eot_score === '' ? null : parseFloat(eot_score)

    // Check if record already exists to handle re-entry update gracefully
    const { data: existing, error: existErr } = await supabase
      .from('circular_marks')
      .select('id')
      .eq('enrollment_id', enrollment_id)
      .eq('subject_id', subject_id)
      .eq('term_id', term_id)
      .maybeSingle()

    if (existErr) {
      console.error('Check existing error:', existErr)
    }

    let result
    if (existing) {
      result = await supabase
        .from('circular_marks')
        .update(updateData)
        .eq('id', existing.id)
        .select()
    } else {
      const insertData = {
        enrollment_id,
        subject_id,
        term_id,
        ...updateData
      }
      result = await supabase
        .from('circular_marks')
        .insert([insertData])
        .select()
    }

    if (result.error) {
      console.error('Supabase error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 400 })
    }

    return NextResponse.json({ data: result.data }, { status: existing ? 200 : 201 })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, bot_score, mot_score, eot_score } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Auth Enforcement Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updateData: any = {}
    if (bot_score !== undefined) updateData.bot_score = bot_score === '' ? null : parseFloat(bot_score)
    if (mot_score !== undefined) updateData.mot_score = mot_score === '' ? null : parseFloat(mot_score)
    if (eot_score !== undefined) updateData.eot_score = eot_score === '' ? null : parseFloat(eot_score)

    const { data, error } = await supabase.from('circular_marks').update(updateData).eq('id', id).select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Auth Enforcement Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase.from('circular_marks').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
