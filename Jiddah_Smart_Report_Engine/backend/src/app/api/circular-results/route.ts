import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getGradeDisplay, getSubjectGradeNumber, getSubjectRemark } from '@/lib/grading'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const term = searchParams.get('term')
    const year = searchParams.get('year')

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    let query = supabase.from('circular_results').select('*')
    if (term) {
      query = query.eq('term', term)
    }
    if (year) {
      const yearValue = parseInt(year)
      if (!Number.isNaN(yearValue)) {
        query = query.eq('year', yearValue)
      }
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

    // Validate required fields
    if (!body.student_id || !body.subject || !body.term || !body.year || (!body.mot_mark && !body.eot_mark)) {
      return NextResponse.json(
        { error: 'Student ID, subject, term, year, and at least one mark are required' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Prepare data
    const insertData: any = {
      student_id: body.student_id,
      subject: body.subject.trim(),
      term: body.term,
      year: parseInt(body.year),
    }

    if (body.mot_mark !== undefined) {
      insertData.mot_mark = parseFloat(body.mot_mark)
    }

    if (body.eot_mark !== undefined) {
      insertData.eot_mark = parseFloat(body.eot_mark)
      // Auto-generate grade and remark for EOT
      const gradeNumber = getSubjectGradeNumber(insertData.eot_mark)
      insertData.grade = getGradeDisplay(gradeNumber)
      insertData.remark = getSubjectRemark(gradeNumber)
    }

    if (body.teacher_initials) {
      insertData.teacher_initials = body.teacher_initials.trim()
    }

    const { data, error } = await supabase.from('circular_results').insert([insertData]).select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}