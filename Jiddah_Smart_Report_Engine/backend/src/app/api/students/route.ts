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
        theology_classes ( id, class_name_arabic, class_name_english ),
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
    const message = err instanceof Error ? err.message : 'Internal server error'
    return withCors(request, NextResponse.json({ error: message }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.circular_class_id || body.academic_year === undefined || !body.admission_number) {
      return withCors(
        request,
        NextResponse.json(
          { error: 'name, circular_class_id, academic_year, and admission_number are required' },
          { status: 400 }
        )
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Check if admission number already exists
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('admission_number', body.admission_number)

    if (existingStudent && existingStudent.length > 0) {
      return withCors(
        request,
        NextResponse.json(
          { error: 'Admission number already exists' },
          { status: 409 }
        )
      )
    }

    // Get circular class to check if it's P.7
    const { data: circularClassData, error: circularError } = await supabase
      .from('circular_classes')
      .select('class_name')
      .eq('id', body.circular_class_id)
      .single()

    if (circularError) {
      console.error('Supabase error:', circularError)
      return withCors(request, NextResponse.json({ error: 'Circular class not found' }, { status: 400 }))
    }

    // Rule: if circular class is P.7, theology_class_id must be null
    if (circularClassData.class_name === 'P.7' && body.theology_class_id) {
      return withCors(
        request,
        NextResponse.json(
          { error: 'P.7 students cannot have a theology class' },
          { status: 400 }
        )
      )
    }

    // Rule: if circular class is NOT P.7, theology_class_id is required
    if (circularClassData.class_name !== 'P.7' && !body.theology_class_id) {
      return withCors(
        request,
        NextResponse.json(
          { error: 'theology_class_id is required for non-P.7 classes' },
          { status: 400 }
        )
      )
    }

    // 1. Insert new student with admission number
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .insert([{
        name: body.name.trim(),
        gender: body.gender || null,
        admission_number: body.admission_number.trim(),
      }])
      .select('id, name, created_at')

    if (studentError) {
      console.error('Student insert error:', studentError)
      return withCors(request, NextResponse.json({ error: studentError.message }, { status: 500 }))
    }

    const studentId = studentData[0].id

    // 2. Insert enrollment
    const enrollmentInsertData = {
      student_id: studentId,
      circular_class_id: body.circular_class_id,
      theology_class_id: body.theology_class_id || null,
      academic_year: body.academic_year,
      is_active: true,
    }

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert([enrollmentInsertData])
      .select(`
        academic_year,
        is_active,
        circular_classes (
          id,
          class_name,
          section
        ),
        theology_classes (
          id,
          class_name_arabic,
          class_name_english
        )
      `)

    if (enrollmentError) {
      console.error('Enrollment insert error:', enrollmentError)
      return withCors(request, NextResponse.json({ error: enrollmentError.message }, { status: 500 }))
    }

    // 3. Return reshaped student data
    const enrollment = enrollmentData?.[0] as any
    const response = {
      id: studentId,
      name: studentData[0].name,
      admission_number: body.admission_number.trim(),
      created_at: studentData[0].created_at,
      circular_class: enrollment?.circular_classes?.class_name ?? '—',
      section: enrollment?.circular_classes?.section ?? null,
      theology_class_arabic: enrollment?.theology_classes?.class_name_arabic ?? null,
      theology_class_english: enrollment?.theology_classes?.class_name_english ?? null,
      academic_year: enrollment?.academic_year,
    }

    return withCors(request, NextResponse.json(response, { status: 201 }))
  } catch (err) {
    console.error('API error:', err)
    return withCors(request, NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
