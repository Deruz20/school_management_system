import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  getSubjectGradeNumber,
  getGradeDisplay,
  getSubjectRemark,
  getNurseryGrade,
  isCoreSubject,
  calculateAggregate,
  calculateTheologyAggregate,
  getDivision,
  getPromotionStatus,
  getConductRemark,
  getClassTeacherComment,
  getHeadTeacherComment,
} from '@/lib/grading'
import { resolveSectionType } from '@/lib/section-type'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type GradeRow = {
  subject_name: string
  score: number | null
}

const TERM_LABELS: Record<string, string> = {
  beginning: 'Beginning Term',
  midterm: 'Mid Term',
  endterm: 'End Term',
}

const TERM_NUMBERS: Record<string, number> = {
  beginning: 1,
  midterm: 2,
  endterm: 3,
}

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight
  const searchParams = request.nextUrl.searchParams
  const enrollmentId = searchParams.get('enrollment_id')
  const termId = searchParams.get('term_id')
  const score_type = searchParams.get('score_type') || 'mot'
  const scoreType = score_type

  if (!enrollmentId || !termId) {
    return withCors(request, NextResponse.json({ error: 'enrollmentId and termId are required' }, { status: 400 }))
  }

  if (!['bot', 'mot', 'eot'].includes(score_type)) {
    return withCors(request, NextResponse.json({ error: 'score_type must be bot, mot, or eot' }, { status: 400 }))
  }

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        academic_year,
        circular_class_id,
        circular_classes ( id, class_name, section ),
        theology_class_id,
        theology_classes ( id, class_name_arabic, class_name_english, level ),
        students ( id, name, admission_number, arabic_name )
      `)
      .eq('id', enrollmentId)
      .single()

    if (enrollmentError || !enrollment) {
      return withCors(request, NextResponse.json({ error: 'Enrollment not found' }, { status: 404 }))
    }

    const section = Array.isArray(enrollment.circular_classes)
      ? enrollment.circular_classes[0]?.section
      : (enrollment.circular_classes as any)?.section
    
    const className = Array.isArray(enrollment.circular_classes)
      ? enrollment.circular_classes[0]?.class_name
      : (enrollment.circular_classes as any)?.class_name
    
    if (!section && !className) {
      return withCors(request, NextResponse.json({ error: 'Circular class section and name are missing' }, { status: 400 }))
    }

    const sectionType = resolveSectionType(section, className)

    const { data: term, error: termError } = await supabase
      .from('terms')
      .select('id, academic_year, term_number, label, is_current, start_date, end_date, next_term_start')
      .eq('id', termId)
      .single()

    if (termError || !term) {
      return withCors(request, NextResponse.json({ error: 'Term not found' }, { status: 404 }))
    }

    const { data: circularSubjects, error: circularSubjectsError } = await supabase
      .from('circular_subjects')
      .select('id, subject_name')
      .eq('section', sectionType)
      .order('subject_name', { ascending: true })

    if (circularSubjectsError) {
      return withCors(request, NextResponse.json({ error: circularSubjectsError.message }, { status: 500 }))
    }

    const { data: circularMarks, error: circularError } = await supabase
      .from('circular_marks')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .eq('term_id', termId);

    const debugInfo = {
      enrollmentId,
      termId,
      circularMarksCount: circularMarks?.length || 0,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    }

    if (circularError) {
      console.error('CIRCULAR MARKS ERROR:', JSON.stringify(circularError, null, 2));
      return withCors(request, NextResponse.json({ error: circularError.message }, { status: 500 }))
    }

    const circularRows = (circularSubjects || []).map((subject: any) => {
      const existing = (circularMarks || []).find((m: any) => m.subject_id === subject.id)
      
      const score = scoreType === 'mot'
        ? existing?.mot_score ?? null
        : existing?.eot_score ?? null

      const numericScore = typeof score === 'number' ? score : null

      const gradeInfo = numericScore !== null
        ? sectionType === 'nursery'
          ? getNurseryGrade(numericScore)
          : { grade: getGradeDisplay(getSubjectGradeNumber(numericScore)), remark: getSubjectRemark(getSubjectGradeNumber(numericScore)) }
        : { grade: '—', remark: '' }

      const motGradeInfo = typeof existing?.mot_score === 'number' 
        ? sectionType === 'nursery' ? getNurseryGrade(existing.mot_score) : { grade: getGradeDisplay(getSubjectGradeNumber(existing.mot_score)), remark: getSubjectRemark(getSubjectGradeNumber(existing.mot_score)) }
        : { grade: null, remark: null }
        
      const eotGradeInfo = typeof existing?.eot_score === 'number'
        ? sectionType === 'nursery' ? getNurseryGrade(existing.eot_score) : { grade: getGradeDisplay(getSubjectGradeNumber(existing.eot_score)), remark: getSubjectRemark(getSubjectGradeNumber(existing.eot_score)) }
        : { grade: null, remark: null }

      return {
        subject_name: subject.subject_name,
        bot_score: existing?.bot_score ?? null,
        mot_score: existing?.mot_score ?? null,
        eot_score: existing?.eot_score ?? null,
        bot_grade_display: existing?.bot_score != null ? (sectionType === 'nursery' ? getNurseryGrade(existing.bot_score).grade : getGradeDisplay(getSubjectGradeNumber(existing.bot_score))) : null,
        mot_grade_display: motGradeInfo.grade,
        eot_grade_display: eotGradeInfo.grade,
        score: numericScore,
        grade_display: gradeInfo.grade,
        remark: gradeInfo.remark,
        is_core: isCoreSubject(subject.subject_name, sectionType),
      }
    })

    // Sort circular subjects by importance order
    const subjectOrder = {
      'lower_primary': ['ENG', 'MATH', 'LIT I', 'LIT II', 'I.R.E'],
      'upper_primary': ['ENG', 'MATH', 'SCI', 'SST', 'COMP']
    }

    const correctOrder = subjectOrder[sectionType as keyof typeof subjectOrder] || []
    const sortedCircularSubjects = circularRows.sort((a, b) => {
      const aIndex = correctOrder.indexOf(a.subject_name)
      const bIndex = correctOrder.indexOf(b.subject_name)
      // If both subjects are in the order array, sort by their position
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }
      // If only one is in the order array, prioritize it
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      // If neither is in the order array, maintain original order
      return 0
    })

    const aggregateMarks = sortedCircularSubjects
      .filter((row) => typeof row.eot_score === 'number')
      .map((row) => ({ subject_name: row.subject_name, score: row.eot_score as number }))

    const motAggregateMarks = sortedCircularSubjects
      .filter((row) => typeof row.mot_score === 'number')
      .map((row) => ({ subject_name: row.subject_name, score: row.mot_score as number }))

    const botAggregateMarks = sortedCircularSubjects
      .filter((row) => typeof row.bot_score === 'number')
      .map((row) => ({ subject_name: row.subject_name, score: row.bot_score as number }))

    const aggregate = sectionType === 'nursery' ? null : calculateAggregate(aggregateMarks, sectionType)
    const mot_aggregate = sectionType === 'nursery' ? null : calculateAggregate(motAggregateMarks, sectionType)
    const bot_aggregate = sectionType === 'nursery' ? null : calculateAggregate(botAggregateMarks, sectionType)
    const reportAggregate = scoreType === 'mot' ? mot_aggregate : (scoreType === 'bot' ? bot_aggregate : aggregate)
    const division = reportAggregate !== null ? getDivision(reportAggregate) : null
    const isTerm3 = term.term_number === 3
    const promotion_status = isTerm3 && division ? getPromotionStatus(division) : null

    const circularTotal = sortedCircularSubjects.reduce(
      (sum, row) => sum + (typeof row.score === 'number' ? row.score : 0),
      0
    )
    const bot_total = sortedCircularSubjects.reduce(
      (sum, row) => sum + (typeof row.bot_score === 'number' ? row.bot_score : 0),
      0
    )
    const mot_total = sortedCircularSubjects.reduce(
      (sum, row) => sum + (typeof row.mot_score === 'number' ? row.mot_score : 0),
      0
    )
    const eot_total = sortedCircularSubjects.reduce(
      (sum, row) => sum + (typeof row.eot_score === 'number' ? row.eot_score : 0),
      0
    )
    const targetTotal = scoreType === 'mot' ? mot_total : (scoreType === 'bot' ? bot_total : eot_total)
    const hasAnyRelevantMark = sortedCircularSubjects.some((row) =>
      typeof (scoreType === 'mot' ? row.mot_score : (scoreType === 'bot' ? row.bot_score : row.eot_score)) === 'number'
    )

    let position: number | null = null
    let total_students: number | null = null

    if (enrollment.circular_class_id && hasAnyRelevantMark) {
      const { data: classEnrollments } = await supabase
        .from('enrollments')
        .select('id, student_id')
        .eq('circular_class_id', enrollment.circular_class_id)
        .eq('is_active', true)

      if (classEnrollments && classEnrollments.length > 0) {
        const enrollmentIds = classEnrollments.map((e) => e.id)

        const { data: classMarks } = await supabase
          .from('circular_marks')
          .select('enrollment_id, subject_id, bot_score, mot_score, eot_score')
          .eq('term_id', termId)
          .in('enrollment_id', enrollmentIds)

        if (classMarks) {
          const totals: number[] = []

          for (const e of classEnrollments) {
            const eMarks = classMarks.filter((m) => m.enrollment_id === e.id)
            const eRows = (circularSubjects || []).map((subject: any) => {
              const existing = eMarks.find((m) => m.subject_id === subject.id)
              const score = scoreType === 'mot'
                ? existing?.mot_score ?? null
                : scoreType === 'bot' ? existing?.bot_score ?? null : existing?.eot_score ?? null
              return { subject_name: subject.subject_name, score: typeof score === 'number' ? score : null }
            })

            const eTotal = eRows.reduce((sum, row) => sum + (typeof row.score === 'number' ? row.score : 0), 0)
            const hasMarks = eRows.some((row) => typeof row.score === 'number')

            if (hasMarks) {
              totals.push(eTotal)
            }
          }

          if (totals.length > 0) {
            total_students = classEnrollments.length
            totals.sort((a, b) => b - a) // Highest total is best
            position = totals.indexOf(targetTotal) + 1
          }
        }
      }
    }

    let theologySectionData: { subjects: any[]; total: number; mot_total: number; eot_total: number; aggregate: number | null; division: string | null } | null = null
    const theologyLevel = Array.isArray(enrollment.theology_classes)
      ? enrollment.theology_classes[0]?.level
      : (enrollment.theology_classes as any)?.level
    let existingTheologyMarks: any = null;

    if (enrollment.theology_class_id && theologyLevel) {
      const { data: theologySubjects, error: theologySubjectsError } = await supabase
        .from('theology_subjects')
        .select('id, subject_name_arabic')
        .eq('level', theologyLevel)
        .order('sort_order', { ascending: true })

      if (theologySubjectsError) {
        return withCors(request, NextResponse.json({ error: theologySubjectsError.message }, { status: 500 }))
      }

      const { data: theologyMarks, error: theologyError } = await supabase
        .from('theology_marks')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .eq('term_id', termId);

      if (theologyError) {
        console.error('THEOLOGY MARKS ERROR:', JSON.stringify(theologyError, null, 2));
        return withCors(request, NextResponse.json({ error: theologyError.message }, { status: 500 }))
      }

      existingTheologyMarks = theologyMarks

      const theologyRows = (theologySubjects || []).map((subject: any) => {
        const existing = (theologyMarks || []).find((m: any) => m.subject_id === subject.id)

        const score = scoreType === 'mot'
          ? existing?.mot_score ?? null
          : existing?.eot_score ?? null

        const numericScore = typeof score === 'number' ? score : null
        const grade_display = numericScore !== null ? getGradeDisplay(getSubjectGradeNumber(numericScore)) : '—'
        const mot_grade_display = typeof existing?.mot_score === 'number' ? getGradeDisplay(getSubjectGradeNumber(existing.mot_score)) : null
        const eot_grade_display = typeof existing?.eot_score === 'number' ? getGradeDisplay(getSubjectGradeNumber(existing.eot_score)) : null

        return {
          subject_name_arabic: subject.subject_name_arabic,
          mot_score: existing?.mot_score ?? null,
          eot_score: existing?.eot_score ?? null,
          mot_grade_display,
          eot_grade_display,
          score: numericScore,
          grade_display,
          theology_remark: existing?.eot_score != null ? (
            existing.eot_score >= 90 ? 'ممتاز' :
            existing.eot_score >= 80 ? 'جيد جداً' :
            existing.eot_score >= 70 ? 'جيد' :
            existing.eot_score >= 60 ? 'مقبول' : 'ضعيف'
          ) : existing?.mot_score != null ? (
            existing.mot_score >= 90 ? 'ممتاز' :
            existing.mot_score >= 80 ? 'جيد جداً' :
            existing.mot_score >= 70 ? 'جيد' :
            existing.mot_score >= 60 ? 'مقبول' : 'ضعيف'
          ) : null
        }
      })

      // Sort theology subjects by importance order
      const theologyOrder = ['القرآن الكريم', 'اللغة العربية', 'الفقه', 'التربية الإسلامية']
      const sortedTheologySubjects = theologyRows.sort((a, b) => {
        const aIndex = theologyOrder.indexOf(a.subject_name_arabic)
        const bIndex = theologyOrder.indexOf(b.subject_name_arabic)
        // If both subjects are in the order array, sort by their position
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex
        }
        // If only one is in the order array, prioritize it
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        // If neither is in the order array, maintain original order
        return 0
      })

      const theologyScores = sortedTheologySubjects.map((row) => row.score)
      const theologyAggregate = theologyScores.some((score) => score == null)
        ? null
        : calculateTheologyAggregate(theologyScores as number[])

      theologySectionData = {
        subjects: sortedTheologySubjects,
        total: sortedTheologySubjects.reduce(
          (sum, row) => sum + (typeof row.score === 'number' ? row.score : 0),
          0
        ),
        mot_total: sortedTheologySubjects.reduce(
          (sum, row) => sum + (typeof row.mot_score === 'number' ? row.mot_score : 0),
          0
        ),
        eot_total: sortedTheologySubjects.reduce(
          (sum, row) => sum + (typeof row.eot_score === 'number' ? row.eot_score : 0),
          0
        ),
        aggregate: theologyAggregate,
        division: theologyAggregate !== null ? getDivision(theologyAggregate) : null,
      }
    }

    const theologyClassArabic = Array.isArray(enrollment.theology_classes) ? enrollment.theology_classes[0]?.class_name_arabic : (enrollment.theology_classes as any)?.class_name_arabic
    const theologyClassEnglish = Array.isArray(enrollment.theology_classes) ? enrollment.theology_classes[0]?.class_name_english : (enrollment.theology_classes as any)?.class_name_english

    const reportData = {
      student: {
        name: (Array.isArray(enrollment.students) ? enrollment.students[0] : enrollment.students)?.name ?? '—',
        admission_number: (Array.isArray(enrollment.students) ? enrollment.students[0] : enrollment.students)?.admission_number ?? '—',
        arabic_name: (Array.isArray(enrollment.students) ? enrollment.students[0] : enrollment.students)?.arabic_name ?? null,
        class_name: Array.isArray(enrollment.circular_classes)
          ? enrollment.circular_classes[0]?.class_name ?? '—'
          : (enrollment.circular_classes as any)?.class_name ?? '—',
        theology_class_arabic: theologyClassArabic ?? null,
        theology_class_english: theologyClassEnglish ?? null,
        section,
        academic_year: enrollment.academic_year,
      },
      term: {
        label: term.label,
        term_number: term.term_number,
        academic_year: term.academic_year,
        start_date: term.start_date,
        end_date: term.end_date,
        next_term_start: term.next_term_start,
      },
      score_type,
      section_type: sectionType,
      circular: {
        subjects: sortedCircularSubjects,
        total: targetTotal,
        bot_aggregate,
        mot_aggregate,
        bot_total,
        mot_total,
        eot_total,
        aggregate,
        division,
        conduct_remark: getConductRemark(division),
        class_teacher_comment: getClassTeacherComment(division),
        head_teacher_comment: getHeadTeacherComment(division),
        position,
        total_students,
      },
      theology: theologySectionData,
      meta: {
        is_term_3: isTerm3,
        promotion_status,
      },
      debug: debugInfo,
    }

    return withCors(request, NextResponse.json(reportData))
  } catch (err: any) {
    console.error('Report API GET error:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
