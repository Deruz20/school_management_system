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
      .from('subjects')
      .select('*')
      .order('section', { ascending: true })
      .order('curriculum', { ascending: true })
      .order('subject_name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ data }))
  } catch (err) {
    console.error('API error:', err)
    return withCors(request, NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.subject_name || !body.curriculum) {
      return withCors(request, NextResponse.json(
        { error: 'Subject name and curriculum type are required' },
        { status: 400 }
      ))
    }

    // Section is required for secular subjects, optional for theology
    if (body.curriculum === 'secular' && !body.section) {
      return withCors(request, NextResponse.json(
        { error: 'Section is required for secular subjects' },
        { status: 400 }
      ))
    }

    // Validate curriculum type
    const validCurriculums = ['secular', 'theology']
    if (!validCurriculums.includes(body.curriculum)) {
      return withCors(request, NextResponse.json({ error: 'Invalid curriculum type' }, { status: 400 }))
    }

    // Validate section if provided
    const validSections = ['nursery', 'lower_primary', 'upper_primary']
    if (body.section && !validSections.includes(body.section)) {
      return withCors(request, NextResponse.json({ error: 'Invalid section' }, { status: 400 }))
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Check for duplicate
    let duplicateQuery = supabase
      .from('subjects')
      .select('id')
      .ilike('subject_name', body.subject_name.trim())

    if (body.curriculum === 'secular') {
      duplicateQuery = duplicateQuery.eq('section', body.section)
    } else {
      duplicateQuery = duplicateQuery.eq('curriculum', 'theology')
    }

    const { data: existingSubjects } = await duplicateQuery

    if (existingSubjects && existingSubjects.length > 0) {
      const message = body.curriculum === 'secular' 
        ? `The subject "${body.subject_name}" already exists for this section`
        : `The theology subject "${body.subject_name}" already exists`
      return withCors(request, NextResponse.json({ error: message }, { status: 409 }))
    }

    // Insert new subject
    const insertData = {
      subject_name: body.subject_name.trim(),
      curriculum: body.curriculum,
      section: body.section || null,
    }

    const { data, error } = await supabase.from('subjects').insert([insertData]).select()

    if (error) {
      console.error('Supabase error:', error)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ data }, { status: 201 }))
  } catch (err) {
    console.error('API error:', err)
    return withCors(request, NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    ))
  }
}
