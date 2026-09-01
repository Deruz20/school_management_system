import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isCoreSubject } from '@/lib/grading'
import { resolveSectionType } from '@/lib/section-type'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight
  const searchParams = request.nextUrl.searchParams
  const enrollment_id = searchParams.get('enrollment_id')
  const term_id = searchParams.get('term_id')
  const score_type = searchParams.get('score_type') || 'both'

  if (!enrollment_id || !term_id) {
    return withCors(
      request,
      NextResponse.json(
        { error: 'enrollment_id and term_id are required' },
        { status: 400 }
      )
    )
  }

  if (!['mot', 'eot', 'both', 'bot', 'all'].includes(score_type)) {
    return withCors(request, NextResponse.json({ error: 'score_type must be bot, mot, eot, both, or all' }, { status: 400 }))
  }

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, circular_class_id, theology_class_id, circular_classes(section, class_name), theology_classes(level)')
      .eq('id', enrollment_id)
      .single()

    if (enrollmentError || !enrollment) {
      return withCors(request, NextResponse.json({ error: 'Enrollment not found' }, { status: 404 }))
    }

    // Fetch circular subjects
    const circularClassMeta = Array.isArray(enrollment.circular_classes)
      ? enrollment.circular_classes[0]
      : (enrollment.circular_classes as { section?: string; class_name?: string } | null)
    const sectionType = resolveSectionType(circularClassMeta?.section, circularClassMeta?.class_name)
    const { data: subjects, error: subjectsError } = await supabase
      .from('circular_subjects')
      .select('id, subject_name')
      .eq('section', sectionType)
      .order('subject_name', { ascending: true })

    if (subjectsError) {
      console.error('circular_subjects DB error:', subjectsError.message)
      return withCors(request, NextResponse.json({ error: subjectsError.message }, { status: 500 }))
    }

    // Fetch existing circular marks
    const { data: existingCircularMarks, error: circularMarksError } = await supabase
      .from('circular_marks')
      .select('subject_id, bot_score, mot_score, eot_score')
      .eq('enrollment_id', enrollment_id)
      .eq('term_id', term_id)

    if (circularMarksError) {
      console.error('circular_marks DB error:', circularMarksError.message)
      return withCors(request, NextResponse.json({ error: circularMarksError.message }, { status: 500 }))
    }

    const circularMarkMap = new Map(
      (existingCircularMarks || []).map((mark: any) => [mark.subject_id, mark])
    )

    const circular_marks = (subjects || []).map((subject: any) => {
      const existingMark = circularMarkMap.get(subject.id)
      return {
        subject_id: subject.id,
        subject_name: subject.subject_name,
        is_core: isCoreSubject(subject.subject_name, sectionType),
        bot_score: existingMark?.bot_score ?? null,
        mot_score: existingMark?.mot_score ?? null,
        eot_score: existingMark?.eot_score ?? null,
      }
    })

    // Fetch theology subjects if theology_class_id exists
    let theology_marks: any[] = []
    if (enrollment.theology_class_id && enrollment.theology_classes) {
      const theologyClassLevel = Array.isArray(enrollment.theology_classes)
        ? enrollment.theology_classes[0]?.level
        : (enrollment.theology_classes as any)?.level
      const { data: theologySubjects, error: theologySubjectsError } = await supabase
        .from('theology_subjects')
        .select('id, subject_name_arabic')
        .eq('level', theologyClassLevel)
        .order('sort_order', { ascending: true })

      if (theologySubjectsError) {
        console.error('theology_subjects DB error:', theologySubjectsError.message)
        return withCors(request, NextResponse.json({ error: theologySubjectsError.message }, { status: 500 }))
      }

      // Fetch existing theology marks
      const { data: existingTheologyMarks, error: theologyMarksError } = await supabase
        .from('theology_marks')
        .select('subject_id, mot_score, eot_score')
        .eq('enrollment_id', enrollment_id)
        .eq('term_id', term_id)

      if (theologyMarksError) {
        console.error('theology_marks DB error:', theologyMarksError.message)
        return withCors(request, NextResponse.json({ error: theologyMarksError.message }, { status: 500 }))
      }

      const theologyMarkMap = new Map(
        (existingTheologyMarks || []).map((mark: any) => [mark.subject_id, mark])
      )

      theology_marks = (theologySubjects || []).map((subject: any) => {
        const existingMark = theologyMarkMap.get(subject.id)
        return {
          subject_id: subject.id,
          subject_name_arabic: subject.subject_name_arabic,
          mot_score: existingMark?.mot_score ?? null,
          eot_score: existingMark?.eot_score ?? null,
        }
      })
    }

    return withCors(request, NextResponse.json({
      circular_marks,
      theology_marks,
    }))
  } catch (err) {
    console.error('Marks API GET error:', err)
    return withCors(request, NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight
  try {
    const body = await request.json()
    const { enrollment_id, term_id, score_type, circular_marks, theology_marks } = body

    if (!enrollment_id || !term_id || !score_type || !['bot', 'mot', 'eot', 'all'].includes(score_type)) {
      return withCors(request, NextResponse.json({ error: 'enrollment_id, term_id, and valid score_type (bot|mot|eot|all) are required' }, { status: 400 }))
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // 1. Fetch enrollment's sections
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('circular_classes(section, class_name), theology_classes(level)')
      .eq('id', enrollment_id)
      .single()
      
    if (enrollmentError || !enrollment) {
      return withCors(request, NextResponse.json({ error: 'Enrollment not found' }, { status: 404 }))
    }

    const circularClassMeta = Array.isArray(enrollment.circular_classes)
      ? enrollment.circular_classes[0]
      : (enrollment.circular_classes as { section?: string; class_name?: string } | null)
    
    const theologyClassMeta = Array.isArray(enrollment.theology_classes)
      ? enrollment.theology_classes[0]
      : (enrollment.theology_classes as { level?: string } | null)
      
    const expectedCircularSection = resolveSectionType(circularClassMeta?.section, circularClassMeta?.class_name)
    const expectedTheologyLevel = theologyClassMeta?.level

    // Upsert circular marks
    if (Array.isArray(circular_marks) && circular_marks.length > 0) {
      const circularUpsert = circular_marks
        .filter((mark: any) => {
          return mark.bot_score !== undefined || mark.mot_score !== undefined || mark.eot_score !== undefined
        })
        .map((mark: any) => {
          const payload: any = {
            enrollment_id,
            term_id,
            subject_id: mark.subject_id,
          }
          if (mark.bot_score !== undefined) payload.bot_score = mark.bot_score === '' || mark.bot_score === null ? null : Number(mark.bot_score)
          if (mark.mot_score !== undefined) payload.mot_score = mark.mot_score === '' || mark.mot_score === null ? null : Number(mark.mot_score)
          if (mark.eot_score !== undefined) payload.eot_score = mark.eot_score === '' || mark.eot_score === null ? null : Number(mark.eot_score)
          return payload
        })

      if (circularUpsert.length > 0) {
        // Validation: Ensure all subject_ids match the enrollment's section
        const subjectIds = circularUpsert.map((u: any) => u.subject_id)
        const { data: subjects, error: subjErr } = await supabase
          .from('circular_subjects')
          .select('id, section')
          .in('id', subjectIds)
          
        if (subjErr) return withCors(request, NextResponse.json({ error: subjErr.message }, { status: 500 }))
        
        const invalidSubjects = subjects?.filter((s: any) => s.section !== expectedCircularSection) || []
        if (invalidSubjects.length > 0) {
          return withCors(request, NextResponse.json({ 
            error: `Section mismatch for subjects: ${invalidSubjects.map((s: any) => s.id).join(', ')}` 
          }, { status: 400 }))
        }

        const { error: circularError } = await supabase
          .from('circular_marks')
          .upsert(circularUpsert, { onConflict: 'enrollment_id,subject_id,term_id' })

        if (circularError) {
          console.error('circular_marks upsert error:', circularError.message)
          return withCors(request, NextResponse.json({ error: circularError.message }, { status: 500 }))
        }
      }
    }

    // Upsert theology marks (per-subject)
    if (Array.isArray(theology_marks) && theology_marks.length > 0) {
      const theologyUpsert = theology_marks
        .filter((mark: any) => {
          return mark.mot_score !== undefined || mark.eot_score !== undefined
        })
        .map((mark: any) => {
          const payload: any = {
            enrollment_id,
            term_id,
            subject_id: mark.subject_id,
          }
          if (mark.mot_score !== undefined) payload.mot_score = mark.mot_score === '' || mark.mot_score === null ? null : Number(mark.mot_score)
          if (mark.eot_score !== undefined) payload.eot_score = mark.eot_score === '' || mark.eot_score === null ? null : Number(mark.eot_score)
          return payload
        })

      if (theologyUpsert.length > 0) {
        // Validation: Ensure all subject_ids match the enrollment's theology level
        const subjectIds = theologyUpsert.map((u: any) => u.subject_id)
        const { data: subjects, error: subjErr } = await supabase
          .from('theology_subjects')
          .select('id, level')
          .in('id', subjectIds)
          
        if (subjErr) return withCors(request, NextResponse.json({ error: subjErr.message }, { status: 500 }))
        
        const invalidSubjects = subjects?.filter((s: any) => s.level !== expectedTheologyLevel) || []
        if (invalidSubjects.length > 0) {
          return withCors(request, NextResponse.json({ 
            error: `Level mismatch for theology subjects: ${invalidSubjects.map((s: any) => s.id).join(', ')}` 
          }, { status: 400 }))
        }

        const { error: theologyError } = await supabase
          .from('theology_marks')
          .upsert(theologyUpsert, { onConflict: 'enrollment_id,subject_id,term_id' })

        if (theologyError) {
          console.error('theology_marks upsert error:', theologyError.message)
          return withCors(request, NextResponse.json({ error: theologyError.message }, { status: 500 }))
        }
      }
    }

    return withCors(request, NextResponse.json({ success: true }))
  } catch (err) {
    console.error('Marks API POST error:', err)
    return withCors(request, NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
