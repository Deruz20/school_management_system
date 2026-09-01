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

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function POST(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const body = await request.json()
    const { enrollment_ids, term_id, score_type = 'mot' } = body

    if (!Array.isArray(enrollment_ids) || enrollment_ids.length === 0 || !term_id) {
      return withCors(request, NextResponse.json({ error: 'enrollment_ids (array) and term_id are required' }, { status: 400 }))
    }
    if (!['bot', 'mot', 'eot'].includes(score_type)) {
      return withCors(request, NextResponse.json({ error: 'score_type must be bot, mot, or eot' }, { status: 400 }))
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Helper to fetch in chunks to avoid URL length limits and timeouts
    const fetchInChunks = async (table: string, select: string, column: string, ids: string[], extraBuilder?: (query: any) => any) => {
      const CHUNK_SIZE = 100
      let results: any[] = []
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE)
        let query = supabase.from(table).select(select).in(column, chunk)
        if (extraBuilder) query = extraBuilder(query)
        const { data, error } = await query
        if (error) throw error
        if (data) results = results.concat(data)
      }
      return results
    }

    // 1. Fetch requested enrollments in chunks
    const requestedEnrollments = await fetchInChunks(
      'enrollments',
      `
        id,
        academic_year,
        circular_class_id,
        circular_classes ( id, class_name, section ),
        theology_class_id,
        theology_classes ( id, class_name_arabic, class_name_english, level ),
        students ( id, name, admission_number, arabic_name )
      `,
      'id',
      enrollment_ids
    )

    if (!requestedEnrollments || requestedEnrollments.length === 0) {
      return withCors(request, NextResponse.json({ error: 'No enrollments found or error fetching enrollments' }, { status: 404 }))
    }

    // 2. Fetch term info
    const { data: term, error: termError } = await supabase
      .from('terms')
      .select('id, academic_year, term_number, label, is_current, start_date, end_date, next_term_start')
      .eq('id', term_id)
      .single()

    if (termError || !term) {
      return withCors(request, NextResponse.json({ error: 'Term not found' }, { status: 404 }))
    }

    const isTerm3 = term.term_number === 3

    // 3. Identify all circular classes involved to fetch ALL their students for accurate ranking
    const circularClassIds = [...new Set(requestedEnrollments.map(e => e.circular_class_id).filter(Boolean))]
    
    // Determine section types involved
    const sectionTypes = new Set<string>()
    requestedEnrollments.forEach(e => {
      const section = Array.isArray(e.circular_classes) ? e.circular_classes[0]?.section : (e.circular_classes as any)?.section
      const className = Array.isArray(e.circular_classes) ? e.circular_classes[0]?.class_name : (e.circular_classes as any)?.class_name
      if (section || className) {
        sectionTypes.add(resolveSectionType(section, className))
      }
    })

    // Fetch circular subjects for these sections
    const circularSubjectsCache: Record<string, any[]> = {}
    for (const st of Array.from(sectionTypes)) {
      const { data: subs } = await supabase.from('circular_subjects').select('id, subject_name').eq('section', st)
      circularSubjectsCache[st] = subs || []
    }

    // Fetch ALL enrollments in these circular classes (to compute global rank)
    let allClassmates: any[] = []
    if (circularClassIds.length > 0) {
      const { data: classmates } = await supabase
        .from('enrollments')
        .select('id, circular_class_id')
        .in('circular_class_id', circularClassIds)
        .eq('is_active', true)
      if (classmates) allClassmates = classmates
    }

    const allClassmateIds = allClassmates.map(c => c.id)

    // Fetch circular marks for EVERYONE in the class in chunks
    let allCircularMarks: any[] = []
    if (allClassmateIds.length > 0) {
      allCircularMarks = await fetchInChunks('circular_marks', '*', 'enrollment_id', allClassmateIds, (q) => q.eq('term_id', term_id))
    }

    // Compute rankings per class
    // classRankings[circular_class_id] = [ { enrollment_id, total } ] sorted by total DESC
    const classRankings: Record<string, { id: string, total: number }[]> = {}
    for (const cId of circularClassIds) {
      const classMembers = allClassmates.filter(c => c.circular_class_id === cId)
      const memberTotals: { id: string, total: number }[] = []
      
      for (const member of classMembers) {
        const memberMarks = allCircularMarks.filter(m => m.enrollment_id === member.id)
        const hasMarks = memberMarks.some(m => typeof m[score_type + '_score'] === 'number')
        if (hasMarks) {
          const eTotal = memberMarks.reduce((sum, m) => sum + (typeof m[score_type + '_score'] === 'number' ? m[score_type + '_score'] : 0), 0)
          memberTotals.push({ id: member.id, total: eTotal })
        }
      }
      
      classRankings[cId] = memberTotals.sort((a, b) => b.total - a.total)
    }

    // 4. Handle Theology
    const theologyLevels = [...new Set(requestedEnrollments.map(e => {
      return Array.isArray(e.theology_classes) ? e.theology_classes[0]?.level : (e.theology_classes as any)?.level
    }).filter(Boolean))]

    const theologySubjectsCache: Record<string, any[]> = {}
    for (const lvl of theologyLevels) {
      const { data: subs } = await supabase.from('theology_subjects').select('id, subject_name_arabic').eq('level', lvl).order('sort_order', { ascending: true })
      theologySubjectsCache[lvl] = subs || []
    }

    // Fetch theology marks ONLY for requested enrollments in chunks
    let requestedTheologyMarks: any[] = []
    if (requestedEnrollments.length > 0) {
      requestedTheologyMarks = await fetchInChunks('theology_marks', '*', 'enrollment_id', enrollment_ids, (q) => q.eq('term_id', term_id))
    }

    // 5. Generate Reports Data array
    const subjectOrder = {
      'lower_primary': ['ENG', 'MATH', 'LIT I', 'LIT II', 'I.R.E'],
      'upper_primary': ['ENG', 'MATH', 'SCI', 'SST', 'COMP']
    }
    const theologyOrder = ['القرآن الكريم', 'اللغة العربية', 'الفقه', 'التربية الإسلامية']

    const reports = requestedEnrollments.map(enrollment => {
      const section = Array.isArray(enrollment.circular_classes) ? enrollment.circular_classes[0]?.section : (enrollment.circular_classes as any)?.section
      const className = Array.isArray(enrollment.circular_classes) ? enrollment.circular_classes[0]?.class_name : (enrollment.circular_classes as any)?.class_name
      const sectionType = (section || className) ? resolveSectionType(section, className) : 'unknown'
      
      const circularSubjects = circularSubjectsCache[sectionType] || []
      const eCircularMarks = allCircularMarks.filter(m => m.enrollment_id === enrollment.id)

      const circularRows = circularSubjects.map((subject: any) => {
        const existing = eCircularMarks.find(m => m.subject_id === subject.id)
        const score = score_type === 'mot' ? existing?.mot_score ?? null : existing?.eot_score ?? null
        const numericScore = typeof score === 'number' ? score : null

        const gradeInfo = numericScore !== null
          ? sectionType === 'nursery' ? getNurseryGrade(numericScore) : { grade: getGradeDisplay(getSubjectGradeNumber(numericScore)), remark: getSubjectRemark(getSubjectGradeNumber(numericScore)) }
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

      const correctOrder = subjectOrder[sectionType as keyof typeof subjectOrder] || []
      const sortedCircularSubjects = circularRows.sort((a, b) => {
        const aIndex = correctOrder.indexOf(a.subject_name)
        const bIndex = correctOrder.indexOf(b.subject_name)
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        return 0
      })

      const aggregateMarks = sortedCircularSubjects.filter(r => typeof r.eot_score === 'number').map(r => ({ subject_name: r.subject_name, score: r.eot_score as number }))
      const motAggregateMarks = sortedCircularSubjects.filter(r => typeof r.mot_score === 'number').map(r => ({ subject_name: r.subject_name, score: r.mot_score as number }))
      const botAggregateMarks = sortedCircularSubjects.filter(r => typeof r.bot_score === 'number').map(r => ({ subject_name: r.subject_name, score: r.bot_score as number }))

      const aggregate = sectionType === 'nursery' ? null : calculateAggregate(aggregateMarks, sectionType)
      const mot_aggregate = sectionType === 'nursery' ? null : calculateAggregate(motAggregateMarks, sectionType)
      const bot_aggregate = sectionType === 'nursery' ? null : calculateAggregate(botAggregateMarks, sectionType)
      const reportAggregate = score_type === 'mot' ? mot_aggregate : (score_type === 'bot' ? bot_aggregate : aggregate)
      
      const division = reportAggregate !== null ? getDivision(reportAggregate) : null
      const promotion_status = isTerm3 && division ? getPromotionStatus(division) : null

      const bot_total = sortedCircularSubjects.reduce((sum, r) => sum + (typeof r.bot_score === 'number' ? r.bot_score : 0), 0)
      const mot_total = sortedCircularSubjects.reduce((sum, r) => sum + (typeof r.mot_score === 'number' ? r.mot_score : 0), 0)
      const eot_total = sortedCircularSubjects.reduce((sum, r) => sum + (typeof r.eot_score === 'number' ? r.eot_score : 0), 0)
      const targetTotal = score_type === 'mot' ? mot_total : (score_type === 'bot' ? bot_total : eot_total)

      let position: number | null = null
      let total_students: number | null = null
      
      if (enrollment.circular_class_id && classRankings[enrollment.circular_class_id]) {
        const rankings = classRankings[enrollment.circular_class_id]
        total_students = rankings.length
        if (total_students > 0) {
           const myRank = rankings.findIndex(r => r.total === targetTotal)
           if (myRank !== -1) position = myRank + 1
        }
      }

      // Theology
      let theologySectionData = null
      const theologyLevel = Array.isArray(enrollment.theology_classes) ? enrollment.theology_classes[0]?.level : (enrollment.theology_classes as any)?.level
      if (enrollment.theology_class_id && theologyLevel) {
        const tSubjects = theologySubjectsCache[theologyLevel] || []
        const eTheoMarks = requestedTheologyMarks.filter(m => m.enrollment_id === enrollment.id)
        
        const theoRows = tSubjects.map(sub => {
          const existing = eTheoMarks.find(m => m.subject_id === sub.id)
          const score = score_type === 'mot' ? existing?.mot_score ?? null : existing?.eot_score ?? null
          const numericScore = typeof score === 'number' ? score : null
          const grade_display = numericScore !== null ? getGradeDisplay(getSubjectGradeNumber(numericScore)) : '—'
          const mot_grade_display = typeof existing?.mot_score === 'number' ? getGradeDisplay(getSubjectGradeNumber(existing.mot_score)) : null
          const eot_grade_display = typeof existing?.eot_score === 'number' ? getGradeDisplay(getSubjectGradeNumber(existing.eot_score)) : null

          return {
            subject_name_arabic: sub.subject_name_arabic,
            mot_score: existing?.mot_score ?? null,
            eot_score: existing?.eot_score ?? null,
            mot_grade_display,
            eot_grade_display,
            score: numericScore,
            grade_display,
            theology_remark: existing?.eot_score != null ? (existing.eot_score >= 90 ? 'ممتاز' : existing.eot_score >= 80 ? 'جيد جداً' : existing.eot_score >= 70 ? 'جيد' : existing.eot_score >= 60 ? 'مقبول' : 'ضعيف') : existing?.mot_score != null ? (existing.mot_score >= 90 ? 'ممتاز' : existing.mot_score >= 80 ? 'جيد جداً' : existing.mot_score >= 70 ? 'جيد' : existing.mot_score >= 60 ? 'مقبول' : 'ضعيف') : null
          }
        })
        
        const sortedTheoSubjects = theoRows.sort((a, b) => {
          const aIndex = theologyOrder.indexOf(a.subject_name_arabic)
          const bIndex = theologyOrder.indexOf(b.subject_name_arabic)
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
          if (aIndex !== -1) return -1
          if (bIndex !== -1) return 1
          return 0
        })

        const theoScores = sortedTheoSubjects.map(r => r.score)
        const theologyAggregate = theoScores.some(s => s == null) ? null : calculateTheologyAggregate(theoScores as number[])

        theologySectionData = {
          subjects: sortedTheoSubjects,
          total: sortedTheoSubjects.reduce((sum, r) => sum + (typeof r.score === 'number' ? r.score : 0), 0),
          mot_total: sortedTheoSubjects.reduce((sum, r) => sum + (typeof r.mot_score === 'number' ? r.mot_score : 0), 0),
          eot_total: sortedTheoSubjects.reduce((sum, r) => sum + (typeof r.eot_score === 'number' ? r.eot_score : 0), 0),
          aggregate: theologyAggregate,
          division: theologyAggregate !== null ? getDivision(theologyAggregate) : null,
        }
      }

      const theologyClassArabic = Array.isArray(enrollment.theology_classes) ? enrollment.theology_classes[0]?.class_name_arabic : (enrollment.theology_classes as any)?.class_name_arabic
      const theologyClassEnglish = Array.isArray(enrollment.theology_classes) ? enrollment.theology_classes[0]?.class_name_english : (enrollment.theology_classes as any)?.class_name_english

      return {
        id: enrollment.id,
        student: {
          name: (Array.isArray(enrollment.students) ? enrollment.students[0] : enrollment.students)?.name ?? '—',
          admission_number: (Array.isArray(enrollment.students) ? enrollment.students[0] : enrollment.students)?.admission_number ?? '—',
          arabic_name: (Array.isArray(enrollment.students) ? enrollment.students[0] : enrollment.students)?.arabic_name ?? null,
          class_name: className ?? '—',
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
        debug: {
          enrollmentId: enrollment.id,
          circularMarksCount: eCircularMarks.length,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        }
      }
    })

    return withCors(request, NextResponse.json({ reports }))
  } catch (err: any) {
    console.error('Batch Report API POST error:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
