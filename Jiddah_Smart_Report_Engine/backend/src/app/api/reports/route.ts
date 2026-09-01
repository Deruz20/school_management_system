import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSubjectGradeNumber } from '@/lib/grading'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  const searchParams = request.nextUrl.searchParams
  const student_id = searchParams.get('student_id')
  const term_id = searchParams.get('term_id')
  const examMode = searchParams.get('examMode') || 'EOT'

  if (!student_id) {
    return withCors(request, NextResponse.json({ data: [] }))
  }

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // 1. Fetch Student & Class info
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id, 
        name,
        class_name,
        classes (
          id,
          class_name,
          section
        )
      `)
      .eq('id', student_id)
      .single()

    if (studentError) throw new Error('Student not found')

    // 2. Fetch Term info
    const { data: term, error: termError } = await supabase
      .from('academic_terms')
      .select('*')
      .eq('id', term_id)
      .single()

    if (termError) throw new Error('Term not found')

    const section = (student.classes as any).section

    // ============================================
    // NURSERY LOGIC
    // ============================================
    if (section === 'nursery') {
      const { data: assessments, error: assessmentsError } = await supabase
        .from('nursery_assessments')
        .select(`
          id,
          subject_id,
          score,
          teacher_comment,
          conduct_score,
          subjects (
            id,
            subject_name,
            curriculum
          )
        `)
        .eq('student_id', student_id)
        .eq('term_id', term_id)

      if (assessmentsError) throw new Error(assessmentsError.message)
      
      if (!assessments || assessments.length === 0) {
        throw new Error('No assessments found')
      }

      return withCors(request, NextResponse.json({
        student,
        term,
        assessments
      }, { status: 200 }))
    }

    // ============================================
    // PRIMARY LOGIC
    // ============================================
    
    // 3. Subject Completeness Validation
    const { count: totalRequiredSubjects, error: countError } = await supabase
      .from('subjects')
      .select('*', { count: 'exact', head: true })
      .eq('section', section)
    
    if (countError) throw countError

    // 4. Fetch Marks + Subjects for the student
    const { data: marks, error: marksError } = await supabase
      .from('marks')
      .select(`
        student_id,
        subject_id,
        score,
        subjects (
          id,
          subject_name,
          curriculum,
          section
        )
      `)
      .eq('student_id', student_id)
      .eq('term_id', term_id)

    if (marksError) throw marksError

    if (!marks || marks.length === 0) {
      throw new Error('No marks found')
    }

    // Only count marks that actually have a numeric score recorded (or just count records)
    // The requirement says "student has X/Y subjects recorded"
    const recordedMarksCount = marks.filter(m => typeof m.score === 'number').length

    if (recordedMarksCount !== totalRequiredSubjects) {
      throw new Error(`Incomplete marks: student has ${recordedMarksCount}/${totalRequiredSubjects} subjects recorded`)
    }

    // 5. Ranking System (Position)
    // Fetch all students in that class
    const { data: classStudents, error: classStudentsError } = await supabase
      .from('students')
      .select('id')
      .eq('class_name', student.class_name)
    
    if (classStudentsError) throw classStudentsError
    
    const classStudentIds = (classStudents || []).map(s => s.id)
    const totalStudents = classStudentIds.length

    // Fetch all marks for these students
    const { data: classMarks, error: classMarksError } = await supabase
      .from('marks')
      .select('student_id, score')
      .eq('term_id', term_id)
      .in('student_id', classStudentIds)
    
    if (classMarksError) throw classMarksError

    // Compute aggregates per student
    const studentAggregates: Record<string, { totalAgg: number, totalScore: number }> = {}
    classStudentIds.forEach(id => {
      studentAggregates[id] = { totalAgg: 0, totalScore: 0 }
    })

    ;(classMarks || []).forEach(m => {
      if (typeof m.score === 'number') {
        const gradeNumber = getSubjectGradeNumber(m.score)
        studentAggregates[m.student_id].totalAgg += gradeNumber
        studentAggregates[m.student_id].totalScore += m.score
      }
    })

    // Sort ascending by totalAgg (lower is better), tie-breaker is totalScore (higher is better)
    const rankingList = classStudentIds.map(id => ({
      id,
      totalAgg: studentAggregates[id].totalAgg,
      totalScore: studentAggregates[id].totalScore
    }))

    rankingList.sort((a, b) => {
      if (a.totalAgg !== b.totalAgg) return a.totalAgg - b.totalAgg
      return b.totalScore - a.totalScore
    })

    // Find 1-based position
    const position = rankingList.findIndex(r => r.id === student_id) + 1

    return withCors(request, NextResponse.json({
      student,
      term,
      marks,
      position,
      totalStudents,
      examMode
    }, { status: 200 }))

  } catch (error: any) {
    console.error('Reports API error:', error)
    return withCors(request, NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 }))
  }
}
