import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const term = searchParams.get('term')
    const year = searchParams.get('year')

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    let query = supabase.from('theology_results').select('*')
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
    if (!body.student_id || !body.subject || !body.term || !body.year || (!body.mot_score && !body.eot_score)) {
      return NextResponse.json(
        { error: 'Student ID, subject, term, year, and at least one score are required' },
        { status: 400 }
      )
    }

    // Validate subject
    const validSubjects = ['Quran', 'Fiqh', 'Tarbiya', 'Arabic']
    if (!validSubjects.includes(body.subject)) {
      return NextResponse.json(
        { error: 'Invalid subject. Must be one of: Quran, Fiqh, Tarbiya, Arabic' },
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

    if (body.mot_score !== undefined) {
      insertData.mot_score = parseFloat(body.mot_score)
    }

    if (body.eot_score !== undefined) {
      insertData.eot_score = parseFloat(body.eot_score)
    }

    const { data, error } = await supabase.from('theology_results').insert([insertData]).select()

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