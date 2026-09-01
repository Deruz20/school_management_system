import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.year || !body.term) {
      return NextResponse.json({ error: 'Year and term type are required' }, { status: 400 })
    }

    // Validate year range
    if (body.year < 2000 || body.year > 2100) {
      return NextResponse.json({ error: 'Year must be between 2000 and 2100' }, { status: 400 })
    }

    // Validate term type
    const validTerms = ['beginning', 'midterm', 'endterm']
    if (!validTerms.includes(body.term)) {
      return NextResponse.json({ error: 'Invalid term type' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Check for duplicate
    const { data: existingTerms } = await supabase
      .from('academic_terms')
      .select('id')
      .eq('year', body.year)
      .eq('term', body.term)

    if (existingTerms && existingTerms.length > 0) {
      return NextResponse.json(
        { error: `This term already exists for ${body.year}` },
        { status: 409 }
      )
    }

    // Insert new term
    const insertData: any = {
      year: body.year,
      term: body.term,
    }

    // Only add date fields if they're provided
    if (body.start_date) {
      insertData.start_date = body.start_date
    }
    if (body.end_date) {
      insertData.end_date = body.end_date
    }

    const { data, error } = await supabase.from('academic_terms').insert([insertData]).select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
