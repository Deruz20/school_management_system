# Project Snapshot

## 1. Project Structure

```text
.gitignore
AGENTS.md
CLAUDE.md
database_schema.sql
eslint.config.mjs
next-env.d.ts
next.config.ts
package-lock.json
package.json
postcss.config.mjs
public/
  file.svg
  globe.svg
  next.svg
  vercel.svg
  window.svg
README.md
snapshot.js
src/
  app/
    admin/
      circular/
        eot-entry/
          page.tsx
        mot-entry/
          page.tsx
      classes/
        page.tsx
      dev-tools/
        page.tsx
      marks/
        page.tsx
      page.tsx
      reports/
        eot/
          page.tsx
        mot/
          page.tsx
        page.tsx
      students/
        page.tsx
      subjects/
        page.tsx
      terms/
        page.tsx
      theology/
        eot-entry/
          page.tsx
        mot-entry/
          page.tsx
    api/
      academic-terms/
        route.ts
      circular-results/
        route.ts
      classes/
        route.ts
      dev/
        seed/
          route.ts
      marks/
        route.ts
      reports/
        route.ts
      students/
        route.ts
      subjects/
        route.ts
      theology-results/
        route.ts
    favicon.ico
    globals.css
    layout.tsx
    page.tsx
  components/
    CreateClassForm.tsx
    CreateStudentForm.tsx
    CreateSubjectForm.tsx
    CreateTermForm.tsx
    MarksEntryClient.tsx
    ReportClientWrapper.tsx
    ReportRenderer.tsx
    reports/
      CircularReportCard.tsx
      EOTReportCard.tsx
      LowerPrimaryReport.tsx
      NurseryReport.tsx
      ReportsClient.tsx
      TheologyReportCard.tsx
      UpperPrimaryReport.tsx
    StudentsListClient.tsx
  lib/
    grading.ts
    remarks.ts
    supabase.ts
  utils/
    supabase/
      client.ts
      middleware.ts
      server.ts
tsconfig.json
tsconfig.tsbuildinfo
tsc_output.txt
```

## 2. File Contents

### src/lib/grading.ts

```ts
import { supabase } from './supabase'

export function getGrade(score: number): string {
  if (score >= 85) return 'D1'
  if (score >= 75) return 'D2'
  if (score >= 70) return 'C3'
  if (score >= 60) return 'C4'
  if (score >= 55) return 'C5'
  if (score >= 50) return 'C6'
  if (score >= 45) return 'P7'
  if (score >= 40) return 'P8'
  return 'F9'
}

export function getAggregate(grade: string): number {
  switch (grade) {
    case 'D1': return 1
    case 'D2': return 2
    case 'C3': return 3
    case 'C4': return 4
    case 'C5': return 5
    case 'C6': return 6
    case 'P7': return 7
    case 'P8': return 8
    case 'F9': return 9
    default: return 9
  }
}

export function getGradeAndAggregate(score: number): { grade: string; agg: number } {
  const grade = getGrade(score)
  const agg = getAggregate(grade)
  return { grade, agg }
}

export function getDivision(totalAggregates: number, subjectCount: number): string {
  if (subjectCount < 4) return 'N/A'
  
  if (totalAggregates <= 12) return 'Division 1'
  if (totalAggregates <= 23) return 'Division 2'
  if (totalAggregates <= 30) return 'Division 3'
  if (totalAggregates <= 36) return 'Division 4'
  return 'Ungraded (U)'
}

// Circular grading (simple system)
export function getCircularGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 50) return 'D'
  return 'E'
}

export function getCircularRemark(grade: string): string {
  switch (grade) {
    case 'A': return 'EXCELLENT'
    case 'B': return 'SUPERB'
    case 'C': return 'V. GOOD'
    case 'D': return 'GOOD'
    default: return 'NEEDS IMPROVEMENT'
  }
}

// Circular aggregate grade (D1-F9 system)
export function getCircularAgg(mark: number | null): string {
  if (mark === null || mark === undefined) return '—'
  if (mark >= 85) return 'D1'
  if (mark >= 75) return 'D2'
  if (mark >= 70) return 'C3'
  if (mark >= 60) return 'C4'
  if (mark >= 55) return 'C5'
  if (mark >= 50) return 'C6'
  if (mark >= 40) return 'P7'
  if (mark >= 35) return 'P8'
  return 'F9'
}

// Theology category based on total
function getTheologyCategory(total: number): string {
  if (total >= 301) return '1st Grade'
  if (total >= 201) return '2nd Grade'
  return '3rd Grade'
}

export function getTheologyGrade(score: number): string {
  if (score >= 90) return 'ممتاز';
  if (score >= 75) return 'جيد جداً';
  if (score >= 65) return 'جيد';
  if (score >= 50) return 'مقبول';
  return 'راسب';
}

export async function computeTheologySummary(studentId: number) {
  // Fetch all theology EOT scores for the student
  const { data: results, error } = await supabase
    .from('theology_results')
    .select('subject, eot_score')
    .eq('student_id', studentId)

  if (error) {
    throw new Error(`Failed to fetch theology results: ${error.message}`)
  }

  if (!results || results.length === 0) {
    return {
      total: 0,
      category: 'No Data',
      subjectGrades: {}
    }
  }

  // Calculate total
  const total = results.reduce((sum, result) => sum + (result.eot_score || 0), 0)

  // Get category
  const category = getTheologyCategory(total)

  // Get subject grades
  const subjectGrades: { [key: string]: string } = {}
  results.forEach(result => {
    subjectGrades[result.subject] = getTheologyGrade(result.eot_score || 0)
  })

  return {
    total,
    category,
    subjectGrades
  }
}

```

### src/lib/remarks.ts

```ts
export function getSubjectRemark(grade: string): string {
  switch (grade) {
    case 'D1': return 'Excellent'
    case 'D2': return 'Very Good'
    case 'C3': return 'Good'
    case 'C4': return 'Fair'
    case 'C5': return 'Satisfactory'
    case 'C6': return 'Improving'
    case 'P7': return 'Needs effort'
    case 'P8': return 'Weak'
    case 'F9': return 'Poor'
    default: return '-'
  }
}

export function getTeacherComment(averageScore: number, division?: string): string {
  let comment = ''

  if (averageScore >= 85) {
    comment = 'Outstanding performance. Keep it up.'
  } else if (averageScore >= 75) {
    comment = 'Very good performance.'
  } else if (averageScore >= 65) {
    comment = 'Good effort. Can improve further.'
  } else if (averageScore >= 50) {
    comment = 'Fair performance. Needs more consistency.'
  } else {
    comment = 'Needs serious improvement.'
  }

  if (division === 'Division 1') {
    comment += ' Top-tier performance.'
  } else if (division === 'Division 4' || division === 'Division U' || division === 'Ungraded (U)') {
    comment += ' Requires extra support.'
  }

  return comment
}

export function getNurseryRemark(grade: string): string {
  switch (grade) {
    case 'A': return 'Excellent progress'
    case 'B': return 'Very good progress'
    case 'C': return 'Good progress'
    case 'D': return 'Fair progress'
    case 'E': return 'Needs attention'
    default: return '-'
  }
}

```

### src/app/api/reports/route.ts

```ts
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getGradeAndAggregate } from '@/lib/grading'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const student_id = searchParams.get('student_id')
  const term_id = searchParams.get('term_id')
  const examMode = searchParams.get('examMode') || 'EOT'

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

      return NextResponse.json({
        student,
        term,
        assessments
      }, { status: 200 })
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
        const { agg } = getGradeAndAggregate(m.score)
        studentAggregates[m.student_id].totalAgg += agg
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

    return NextResponse.json({
      student,
      term,
      marks,
      position,
      totalStudents,
      examMode
    }, { status: 200 })

  } catch (error: any) {
    console.error('Reports API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

```

### src/components/reports/CircularReportCard.tsx

```tsx
'use client'

import { getCircularAgg, getCircularRemark } from '@/lib/grading'

interface CircularResult {
  subject: string
  mot_mark: number | null
  eot_mark: number | null
  teacher_initials: string
}

interface CircularReportCardProps {
  student: {
    id: string
    name: string
    class_name: string
  }
  term: string
  year: number
  results: CircularResult[]
  conductComment?: string
  classTeacherComment?: string
  headTeacherComment?: string
  nextTermDate?: string
}

export function CircularReportCard({
  student,
  term,
  year,
  results,
  conductComment = '',
  classTeacherComment = '',
  headTeacherComment = '',
  nextTermDate = ''
}: CircularReportCardProps) {
  const getRemarkForAgg = (agg: string): string => {
    const remarks: { [key: string]: string } = {
      D1: 'EXCELLENT',
      D2: 'EXCELLENT',
      C3: 'SUPERB',
      C4: 'V.GOOD',
      C5: 'GOOD',
      C6: 'GOOD',
      P7: '',
      P8: '',
      F9: ''
    }
    return remarks[agg] || ''
  }

  return (
    <div className="w-full bg-white p-8" style={{ pageBreakAfter: 'always' }}>
      {/* Header */}
      <div className="mb-6 border-b-4 border-gray-300 pb-4">
        <div className="flex items-center justify-center gap-8 mb-3">
          <img src="/logo.png" alt="School Logo" className="h-16 w-16" />
          <div className="text-center flex-1">
            <h1 className="text-lg font-bold">JIDDAH ISLAMIC NURSERY AND PRIMARY SCHOOL</h1>
            <p className="text-xs text-gray-700">
              P.O.BOX 34008 | Email: jiddahislamicnurseryandpri@gmail.com
            </p>
            <p className="text-xs text-gray-700">
              Tel: 256 (0) 744950042 / 256 (0) 787 779 909
            </p>
          </div>
          <img src="/logo.png" alt="School Logo" className="h-16 w-16" />
        </div>
        <div className="w-full bg-green-600 text-white text-center py-2 font-bold text-sm">
          END OF TERM REPORT FORM
        </div>
      </div>

      {/* Student Info */}
      <div className="mb-6 text-sm">
        <table className="w-full border border-gray-400">
          <tbody>
            <tr className="border-b border-gray-400">
              <td className="border-r border-gray-400 p-2 font-semibold w-1/2">PUPIL'S NAME:</td>
              <td className="p-2">{student.name}</td>
              <td className="border-l border-gray-400 p-2 font-semibold w-1/4">CLASS:</td>
              <td className="p-2">{student.class_name}</td>
            </tr>
            <tr className="border-b border-gray-400">
              <td className="border-r border-gray-400 p-2 font-semibold">STUDENT ID:</td>
              <td className="p-2">JINPS-{year}-{student.id.slice(0, 6).toUpperCase()}</td>
              <td className="border-l border-gray-400 p-2 font-semibold">DATE:</td>
              <td className="p-2">_______________</td>
            </tr>
            <tr>
              <td className="border-r border-gray-400 p-2 font-semibold">SCH. PAY CODE:</td>
              <td className="p-2">1435200434</td>
              <td colSpan={2} className="border-l border-gray-400 p-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-center font-bold mb-6 text-sm">
        TERM: {term} | YEAR: {year}
      </div>

      {/* Results Table */}
      <div className="mb-6 text-xs">
        <table className="w-full border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 p-2 font-semibold">LEARNING AREA</th>
              <th className="border border-gray-400 p-2 font-semibold">MOT MARK</th>
              <th className="border border-gray-400 p-2 font-semibold">MOT AGG</th>
              <th className="border border-gray-400 p-2 font-semibold">EOT MARK</th>
              <th className="border border-gray-400 p-2 font-semibold">EOT AGG</th>
              <th className="border border-gray-400 p-2 font-semibold">REMARK</th>
              <th className="border border-gray-400 p-2 font-semibold">INITIALS</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, idx) => {
              const motAgg = result.mot_mark ? getCircularAgg(result.mot_mark) : '—'
              const eotAgg = result.eot_mark ? getCircularAgg(result.eot_mark) : '—'
              const remark = eotAgg !== '—' ? getRemarkForAgg(eotAgg) : '—'

              return (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border border-gray-400 p-2">{result.subject}</td>
                  <td className="border border-gray-400 p-2 text-center">
                    {result.mot_mark ?? '—'}
                  </td>
                  <td className="border border-gray-400 p-2 text-center">{motAgg}</td>
                  <td className="border border-gray-400 p-2 text-center">
                    {result.eot_mark ?? '—'}
                  </td>
                  <td className="border border-gray-400 p-2 text-center font-semibold">{eotAgg}</td>
                  <td className="border border-gray-400 p-2 text-center">{remark}</td>
                  <td className="border border-gray-400 p-2 text-center">
                    {result.teacher_initials || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-2 gap-6 text-xs">
        {/* Left Column */}
        <div>
          <div className="mb-4">
            <h3 className="font-semibold mb-2 text-xs">LEARNER'S COMPETENCE / PROGRESSIVE RECORDS</h3>
            <table className="w-full border-collapse border border-gray-400 text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 p-1">MID-TERM</th>
                  {results.map((r, i) => (
                    <th key={i} className="border border-gray-400 p-1 w-8">{r.subject.slice(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-400 p-1 font-semibold">Grade</td>
                  {results.map((r, i) => (
                    <td key={i} className="border border-gray-400 p-1 text-center">
                      {r.mot_mark ? getCircularAgg(r.mot_mark) : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-semibold mb-2 text-xs">GRADING SCALE</h4>
            <table className="w-full border-collapse border border-gray-400 text-xs">
              <tbody>
                <tr className="bg-gray-50">
                  <td className="border border-gray-400 p-1">85-100</td>
                  <td className="border border-gray-400 p-1">D1</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 p-1">75-84</td>
                  <td className="border border-gray-400 p-1">D2</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-400 p-1">70-74</td>
                  <td className="border border-gray-400 p-1">C3</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 p-1">60-69</td>
                  <td className="border border-gray-400 p-1">C4</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-400 p-1">55-59</td>
                  <td className="border border-gray-400 p-1">C5</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 p-1">50-54</td>
                  <td className="border border-gray-400 p-1">C6</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-400 p-1">40-49</td>
                  <td className="border border-gray-400 p-1">P7</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 p-1">35-39</td>
                  <td className="border border-gray-400 p-1">P8</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-400 p-1">0-34</td>
                  <td className="border border-gray-400 p-1">F9</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div>
          <div className="mb-4">
            <p className="mb-2">
              <span className="font-semibold">Conduct:</span> <span className="border-b border-gray-400 inline-block w-48">_______________</span>
            </p>
          </div>

          <div className="mb-4">
            <p className="font-semibold text-xs mb-1">Class Teacher's Comment:</p>
            <div className="border border-gray-400 p-2 h-12 mb-2 text-xs">
              {classTeacherComment}
            </div>
            <p className="text-xs">Signature: ___________________</p>
          </div>

          <div className="mb-4">
            <p className="font-semibold text-xs mb-1">Head Teacher's Comment:</p>
            <div className="border border-gray-400 p-2 h-12 mb-2 text-xs">
              {headTeacherComment}
            </div>
            <p className="text-xs">Signature: ___________________</p>
          </div>

          <div className="mb-4">
            <p className="mb-2">
              <span className="font-semibold">Next Term Begins On:</span> <span className="border-b border-gray-400 inline-block w-40">_______________</span>
            </p>
          </div>

          <div className="mt-6 border-2 border-dotted border-gray-400 p-4 w-24 h-24 flex items-center justify-center text-center text-xs font-semibold">
            HEADTEACHER
            <br />
            STAMP
          </div>

          <p className="text-xs italic mt-4 text-gray-600">
            This Report Form Is Not Valid Without The Official Stamp.
          </p>
        </div>
      </div>
    </div>
  )
}

```

### src/components/reports/TheologyReportCard.tsx

```tsx
'use client'

import { getTheologyGrade } from '@/lib/grading'

interface TheologyResult {
  subject: string
  mot_score: number | null
  eot_score: number | null
}

interface TheologyReportCardProps {
  student: {
    id: string
    name: string
    class_name: string
  }
  term: string
  year: number
  results: TheologyResult[]
  classTeacherComment?: string
  studentCount?: number
  rank?: number
}

export function TheologyReportCard({
  student,
  term,
  year,
  results,
  classTeacherComment = '',
  studentCount = 0,
  rank = 0
}: TheologyReportCardProps) {
  const subjects = [
    { key: 'quran', ar: 'القرآن' },
    { key: 'arabic', ar: 'اللغة العربية' },
    { key: 'fiqh', ar: 'الفقه' },
    { key: 'tarbiyah', ar: 'التربية' }
  ]

  // Calculate totals and categories
  const motTotal = results.reduce((sum, r) => sum + (r.mot_score || 0), 0)
  const eotTotal = results.reduce((sum, r) => sum + (r.eot_score || 0), 0)

  const getCategory = (total: number): string => {
    if (total >= 301) return 'الأول'
    if (total >= 201) return 'الثاني'
    return 'الثالث'
  }

  const getOverallGrade = (total: number): string => {
    const average = total / 4
    if (average >= 90) return 'ممتاز'
    if (average >= 75) return 'جيد جداً'
    if (average >= 65) return 'جيد'
    if (average >= 50) return 'مقبول'
    return 'راسب'
  }

  return (
    <div
      className="w-full bg-white p-8"
      style={{ pageBreakAfter: 'always', direction: 'rtl', fontFamily: "'Amiri', serif" }}
      dir="rtl"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
      `}</style>

      {/* Header */}
      <div className="text-center mb-6 pb-4 border-b-4 border-gray-300">
        <p className="text-xs mb-2">بسم الله الرحمن الرحيم</p>
        <h1 className="text-lg font-bold text-red-600 mb-1">مدرسة جدة الإسلامية للروضة والابتدائية</h1>
        <p className="text-sm mb-3">انساغو واكيسو</p>
        <div className="w-full bg-green-600 text-white text-center py-2 font-bold text-sm">
          كشف الدرجات لنهاية الفترة
        </div>
      </div>

      {/* Student Info */}
      <div className="mb-6 text-sm">
        <table className="w-full border border-gray-400" dir="rtl">
          <tbody>
            <tr className="border-b border-gray-400">
              <td className="border-l border-gray-400 p-2 font-semibold w-1/4">اسم الطالب/ة:</td>
              <td className="p-2">{student.name}</td>
            </tr>
            <tr>
              <td className="border-l border-gray-400 p-2 font-semibold">الفترة:</td>
              <td className="p-2 text-center w-24">{term}</td>
              <td className="border-l border-gray-400 p-2 font-semibold">الفصل:</td>
              <td className="p-2 text-center w-24">{student.class_name}</td>
              <td className="border-l border-gray-400 p-2 font-semibold">السنة:</td>
              <td className="p-2 text-center w-24">{year}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Results Table */}
      <div className="mb-6 text-xs" dir="rtl">
        <table className="w-full border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 p-2 font-semibold">الدرجة</th>
              <th className="border border-gray-400 p-2 font-semibold">مجموع</th>
              <th className="border border-gray-400 p-2 font-semibold">التربية</th>
              <th className="border border-gray-400 p-2 font-semibold">الفقه</th>
              <th className="border border-gray-400 p-2 font-semibold">اللغة العربية</th>
              <th className="border border-gray-400 p-2 font-semibold">القرآن</th>
            </tr>
            <tr className="bg-gray-50 border-b border-gray-400">
              <td colSpan={6} className="border border-gray-400 p-2 font-semibold text-center">
                درجة منتصف الفترة (MOT)
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 p-2 text-center font-semibold">
                {getOverallGrade(motTotal)}
              </td>
              <td className="border border-gray-400 p-2 text-center font-semibold">{motTotal}</td>
              {results.map((r, i) => (
                <td key={i} className="border border-gray-400 p-2 text-center">
                  {r.mot_score ?? '—'}
                </td>
              ))}
            </tr>
          </tbody>
          <thead>
            <tr className="bg-gray-50 border-t-2 border-gray-400">
              <td colSpan={6} className="border border-gray-400 p-2 font-semibold text-center">
                درجة نهاية الفترة (EOT)
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 p-2 text-center font-semibold">
                {getOverallGrade(eotTotal)}
              </td>
              <td className="border border-gray-400 p-2 text-center font-semibold">{eotTotal}</td>
              {results.map((r, i) => (
                <td key={i} className="border border-gray-400 p-2 text-center">
                  {r.eot_score ?? '—'}
                </td>
              ))}
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-400 p-2 font-semibold">التصنيف</td>
              <td colSpan={5} className="border border-gray-400 p-2 text-center">
                {getCategory(eotTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bottom Section */}
      <div className="text-xs" dir="rtl">
        <div className="mb-4 flex gap-4">
          <div className="flex-1">
            <p>
              <span className="font-semibold">عدد الطلبة:</span> <span className="border-b border-gray-400 inline-block w-20">{studentCount}</span>
            </p>
          </div>
          <div className="flex-1">
            <p>
              <span className="font-semibold">الترتيب:</span> <span className="border-b border-gray-400 inline-block w-20">{rank}</span>
            </p>
          </div>
        </div>

        <div className="mb-6">
          <p className="font-semibold mb-2">تقرير مربّ الفصل:</p>
          <div className="border border-gray-400 p-3 h-16 text-xs">
            {classTeacherComment}
          </div>
        </div>

        <div className="relative h-24">
          <div className="absolute left-0 bottom-0 border-2 border-dotted border-gray-400 p-4 w-24 h-24 flex items-center justify-center text-center text-xs font-semibold">
            مدير المدرسة
            <br />
            الختم
          </div>
        </div>
      </div>
    </div>
  )
}

```

### src/components/reports/EOTReportCard.tsx

```tsx
'use client'

import { getCircularGrade, getCircularRemark, getTheologyGrade } from '@/lib/grading'

interface EOTReportCardProps {
  student: { id: string; name: string; class_name: string }
  term: string
  year: number
  circular: {
    subject: string
    mot_mark: number | null
    eot_mark: number | null
    grade: string | null
    remark: string | null
    teacher_initials: string | null
  }[]
  theology: {
    subject: string
    mot_score: number | null
    eot_score: number | null
  }[]
}

const theologySubjectMap: Record<string, string> = {
  'Quran': 'القرآن',
  'Fiqh': 'الفقه',
  'Tarbiya': 'التربية',
  'Arabic': 'اللغة العربية'
}

export function EOTReportCard({ student, term, year, circular, theology }: EOTReportCardProps) {
  const circularTotal = circular.reduce((sum, c) => sum + (c.eot_mark || 0), 0)
  const circularAvg = circular.length > 0 ? (circularTotal / circular.length).toFixed(1) : 0
  
  const theologyTotal = theology.reduce((sum, t) => sum + (t.eot_score || 0), 0)
  const theologyGrade = theologyTotal >= 301 ? 'الأول' : theologyTotal >= 201 ? 'الثاني' : 'الثالث'

  // Map theology subjects to Arabic names
  const theologyWithArabic = theology.map(t => ({
    ...t,
    arabicName: theologySubjectMap[t.subject] || t.subject
  }))

  return (
    <div className="bg-white border-2 border-gray-800 max-w-4xl mx-auto print:w-[210mm] print:max-w-none print:mx-auto print:shadow-none print:border-2 print:border-gray-800 print:page-break-after-always p-8">
      {/* SECTION 1 — HEADER */}
      <div className="text-center mb-6 pb-6 border-b-4 border-gray-800">
        <h1 className="text-3xl font-bold text-gray-900 tracking-wide uppercase mb-1">
          جذاه اسلامي نرسري اند پرائمری سکول
        </h1>
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase mb-2">
          Jiddah Islamic Nursery & Primary School
        </h1>
        <p className="text-lg italic text-gray-700 mb-3">"Striving for Excellence and Discipline"</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">END OF TERM REPORT CARD</h2>
        <p className="text-sm text-gray-700 font-medium">
          Term: {term} | Year: {year}
        </p>
      </div>

      {/* SECTION 2 — STUDENT INFO BAR */}
      <div className="border-b-2 border-gray-800 pb-3 mb-6 flex justify-between">
        <div className="text-sm font-semibold">
          <span className="font-bold">Name:</span> <span className="uppercase">{student.name}</span>
        </div>
        <div className="text-sm font-semibold">
          <span className="font-bold">Class:</span> <span className="uppercase">{student.class_name}</span>
        </div>
      </div>

      {/* SECTION 3 — SIDE BY SIDE TABLES */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* LEFT COLUMN — CIRCULAR SUBJECTS */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-gray-800 pb-2">
            CIRCULAR SUBJECTS
          </h3>
          <table className="w-full border-collapse border border-gray-800 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 p-2 text-left font-bold">SUBJECT</th>
                <th className="border border-gray-800 p-2 text-center font-bold">MOT</th>
                <th className="border border-gray-800 p-2 text-center font-bold">EOT</th>
                <th className="border border-gray-800 p-2 text-center font-bold">GRADE</th>
                <th className="border border-gray-800 p-2 text-left font-bold">REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {circular.map((c, idx) => (
                <tr key={idx} className="page-break-avoid">
                  <td className="border border-gray-800 p-2 font-semibold uppercase">{c.subject}</td>
                  <td className="border border-gray-800 p-2 text-center">{c.mot_mark || '-'}</td>
                  <td className="border border-gray-800 p-2 text-center font-bold">{c.eot_mark || '-'}</td>
                  <td className="border border-gray-800 p-2 text-center font-bold">
                    {c.eot_mark ? getCircularGrade(c.eot_mark) : '-'}
                  </td>
                  <td className="border border-gray-800 p-2 text-xs">
                    {c.eot_mark ? getCircularRemark(getCircularGrade(c.eot_mark)) : '-'}
                  </td>
                </tr>
              ))}
              {circular.length > 0 && (
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={2} className="border border-gray-800 p-2 text-right">TOTAL:</td>
                  <td className="border border-gray-800 p-2 text-center">{circularTotal}</td>
                  <td colSpan={2} className="border border-gray-800 p-2 text-center">AVG: {circularAvg}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* RIGHT COLUMN — THEOLOGY SUBJECTS */}
        <div dir="rtl" className="text-right">
          <h3 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-gray-800 pb-2">
            المواد الدينية
          </h3>
          <table className="w-full border-collapse border border-gray-800 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 p-2 text-right font-bold">الدرجة</th>
                <th className="border border-gray-800 p-2 text-center font-bold">EOT</th>
                <th className="border border-gray-800 p-2 text-center font-bold">MOT</th>
                <th className="border border-gray-800 p-2 text-right font-bold">المادة</th>
              </tr>
            </thead>
            <tbody>
              {theologyWithArabic.map((t, idx) => (
                <tr key={idx} className="page-break-avoid">
                  <td className="border border-gray-800 p-2 text-center font-bold">
                    {t.eot_score ? getTheologyGrade(t.eot_score) : '-'}
                  </td>
                  <td className="border border-gray-800 p-2 text-center font-bold">{t.eot_score || '-'}</td>
                  <td className="border border-gray-800 p-2 text-center">{t.mot_score || '-'}</td>
                  <td className="border border-gray-800 p-2 font-semibold">{t.arabicName}</td>
                </tr>
              ))}
              {theologyWithArabic.length > 0 && (
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={3} className="border border-gray-800 p-2 text-center">
                    المجموع: {theologyTotal}/400
                  </td>
                  <td className="border border-gray-800 p-2 text-right"></td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Theology Summary Box */}
          {theologyWithArabic.length > 0 && (
            <div className="border-2 border-gray-800 p-3 mt-3 bg-gray-50 text-sm font-semibold">
              <div>المجموع: {theologyTotal}/400</div>
              <div>التقدير: {theologyGrade}</div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4 — FOOTER */}
      <div className="space-y-4 text-sm mt-8 pt-6 border-t-2 border-gray-800">
        <div className="flex gap-4">
          <span className="font-bold whitespace-nowrap">Class Teacher's Comment:</span>
          <div className="flex-1 border-b border-gray-600"></div>
        </div>
        <div className="flex gap-4">
          <span className="font-bold whitespace-nowrap">Conduct / Behaviour:</span>
          <div className="flex-1 border-b border-gray-600"></div>
        </div>
        <div className="flex gap-4">
          <span className="font-bold whitespace-nowrap">Head Teacher's Comment:</span>
          <div className="flex-1 border-b border-gray-600"></div>
        </div>

        {/* Signature & Date */}
        <div className="flex justify-between items-end mt-8 pt-4">
          <div className="text-center">
            <div className="w-40 border-b border-gray-800 mb-2"></div>
            <p className="text-xs font-semibold">Signature & Stamp</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-b border-gray-800 mb-2"></div>
            <p className="text-xs font-semibold">Date</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
          body * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page-break-avoid {
            page-break-inside: avoid;
          }
        }
      `}} />
    </div>
  )
}

```

### src/components/ReportsClient.tsx

*(File does not exist)*

### src/app/admin/reports/page.tsx

```tsx
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ReportsClient } from '@/components/reports/ReportsClient'

type ClassData = {
  id: string
  class_name: string
}

type TermData = {
  id: string
  term: string
  year: number
}

export default async function ReportsManagementPage() {
  let classes: ClassData[] = []
  let terms: TermData[] = []
  let error: string | null = null

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Fetch classes
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, class_name')
      .order('class_name', { ascending: true })

    if (classError) throw classError
    classes = classData || []

    // Fetch terms
    const { data: termData, error: termError } = await supabase
      .from('academic_terms')
      .select('id, term, year')
      .order('year', { ascending: false })
      .order('term', { ascending: true })

    if (termError) throw termError
    terms = termData || []

  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load report configuration data'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12 print:bg-white print:pb-0">
      {/* Header - Hidden when printing */}
      <div className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Report Card Generator</h1>
          <p className="text-gray-600 mt-1">Generate academic report cards for circular and theology subjects</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 print:p-0 print:m-0 print:max-w-none">
        {error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg print:hidden">
            <p className="text-red-800 font-medium">❌ System Error: {error}</p>
            <p className="text-red-600 text-sm mt-1">Please ensure the database connection is active and tables exist.</p>
          </div>
        ) : (
          <ReportsClient classes={classes} terms={terms} />
        )}
      </div>
    </div>
  )
}

```

### src/app/admin/reports/eot/page.tsx

```tsx
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { EOTReportCard } from '@/components/reports/EOTReportCard'

type StudentData = {
  id: string
  name: string
  class_name: string
}

type CircularResult = {
  id: string
  student_id: string
  subject: string
  mot_mark: number | null
  eot_mark: number | null
  grade: string | null
  remark: string | null
  teacher_initials: string | null
}

type TheologyResult = {
  id: string
  student_id: string
  subject: string
  mot_score: number | null
  eot_score: number | null
}

interface SearchParams {
  term?: string
  year?: string
}

export default async function EOTReportsPage(props: { searchParams?: SearchParams }) {
  const searchParams = props.searchParams || {}
  const term = searchParams.term || 'Term 1'
  const year = parseInt(searchParams.year || '2026')

  let students: StudentData[] = []
  let circularResults: CircularResult[] = []
  let theologyResults: TheologyResult[] = []
  let error: string | null = null

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Fetch students
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, name, class_name')
      .order('class_name', { ascending: true })
      .order('name', { ascending: true })

    if (studentError) {
      console.error('Error fetching students:', studentError)
      error = 'Failed to load students.'
    } else {
      students = studentData || []
    }

    // Fetch circular EOT results with term/year filters
    const { data: circularData, error: circularError } = await supabase
      .from('circular_results')
      .select('*')
      .eq('term', term)
      .eq('year', year)
      .not('eot_mark', 'is', null)

    if (circularError) {
      console.error('Error fetching circular results:', circularError)
    } else {
      circularResults = circularData || []
    }

    // Fetch theology EOT results with term/year filters
    const { data: theologyData, error: theologyError } = await supabase
      .from('theology_results')
      .select('*')
      .eq('term', term)
      .eq('year', year)
      .not('eot_score', 'is', null)

    if (theologyError) {
      console.error('Error fetching theology results:', theologyError)
    } else {
      theologyResults = theologyData || []
    }

  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load data'
  }

  // Group results by student
  const studentReports = students.map(student => {
    const circular = circularResults.filter(r => r.student_id === student.id)
    const theology = theologyResults.filter(r => r.student_id === student.id)

    return {
      student,
      circular,
      theology
    }
  })

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 print:hidden">
        <Link
          href="/admin"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">EOT Combined Report — {term}, {year}</h1>
        <p className="text-gray-600">End-Of-Term combined report for all subjects</p>
      </div>

      {/* Filter Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 print:hidden">
        <div className="flex gap-4 items-end justify-between flex-wrap mb-4">
          <form method="get" className="flex gap-4 items-end flex-wrap">
            <div>
              <label htmlFor="filter-term" className="block text-sm font-medium text-gray-700 mb-2">Term</label>
              <select 
                id="filter-term" 
                name="term" 
                defaultValue={term}
                className="border rounded px-3 py-2"
              >
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </div>
            <div>
              <label htmlFor="filter-year" className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <input
                id="filter-year"
                type="number"
                name="year"
                defaultValue={year}
                min={2000}
                max={2100}
                className="border rounded px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Filter
            </button>
          </form>
          <button
            type="button"
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print All
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 print:hidden">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {studentReports.map(({ student, circular, theology }) => (
          <EOTReportCard 
            key={student.id}
            student={student}
            term={term}
            year={year}
            circular={circular}
            theology={theology}
          />
        ))}

        {studentReports.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center print:hidden">
            <p className="text-gray-500">No student data available</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### src/app/admin/students/page.tsx

```tsx
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { CreateStudentForm } from '@/components/CreateStudentForm'
import { StudentsListClient } from '@/components/StudentsListClient'

export default async function StudentsManagementPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: classData } = await supabase
    .from('classes')
    .select('class_name, section')

  const { data: studentData } = await supabase
    .from('students')
    .select('id, name, class_name, created_at')
    .order('name', { ascending: true })

  const classMap = new Map(
    (classData || []).map(c => [c.class_name, c.section])
  )

  const students = (studentData || []).map(s => ({
    ...s,
    section: classMap.get(s.class_name) || null
  }))

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Students Management</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Add New Student</h2>
        <CreateStudentForm />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-3xl font-bold text-emerald-600 mb-2">{students.length}</div>
          <p className="text-sm text-gray-600">Total registered students</p>
        </div>

        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
          <h4 className="text-sm font-semibold text-emerald-900 mb-3">📋 Registration Tips</h4>
          <ul className="text-xs text-emerald-700 space-y-2">
            <li>• Use the auto-generator for standardized admission numbers.</li>
            <li>• Admission numbers must be completely unique.</li>
            <li>• Ensure classes are created before registering students.</li>
          </ul>
        </div>
      </div>

      <div className="mt-12">
        <StudentsListClient students={students} />
      </div>
    </div>
  )
}

```

### src/components/CreateStudentForm.tsx

```tsx
'use client'

import { useState } from 'react'

const VALID_CLASSES = ['Baby', 'Middle', 'Top', 'P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7']

export function CreateStudentForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    class_name: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsLoading(true)

    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create student')
      }

      setSuccess(true)
      setFormData({ name: '', class_name: '' })
      // Optionally refresh the page or call onSuccess
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Student Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter student name"
          />
        </div>

        <div>
          <label htmlFor="class_name" className="block text-sm font-medium text-gray-700 mb-1">
            Class
          </label>
          <select
            id="class_name"
            name="class_name"
            value={formData.class_name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a class</option>
            {VALID_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            Student registered successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Registering...' : 'Register Student'}
        </button>
      </form>
    </div>
  )
}

```

### src/app/api/students/route.ts

```ts
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const VALID_CLASSES = ['Baby', 'Middle', 'Top', 'P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7']

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase
      .from('students')
      .select('id, name, class_name')
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.class_name) {
      return NextResponse.json(
        { error: 'Name and class_name are required' },
        { status: 400 }
      )
    }

    // Validate class_name is in allowed list
    if (!VALID_CLASSES.includes(body.class_name)) {
      return NextResponse.json(
        { error: `Invalid class. Allowed values: ${VALID_CLASSES.join(', ')}` },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Insert new student
    const insertData = {
      name: body.name.trim(),
      class_name: body.class_name.trim(),
    }

    const { data, error } = await supabase.from('students').insert([insertData]).select('id, name, class_name')

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data?.[0] || {}, { status: 201 })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

```

### src/app/api/circular-results/route.ts

```ts
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getCircularGrade, getCircularRemark } from '@/lib/grading'

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
      insertData.grade = getCircularGrade(insertData.eot_mark)
      insertData.remark = getCircularRemark(insertData.grade)
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
```

### src/app/api/theology-results/route.ts

```ts
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
```

### database_schema.sql

```sql
-- Database Schema for School Report System

-- Students table
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    class VARCHAR(50) NOT NULL
);

-- Circular results table (English subjects)
CREATE TABLE circular_results (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    mot_mark DECIMAL(5,2),
    eot_mark DECIMAL(5,2),
    grade VARCHAR(10),
    remark VARCHAR(255),
    teacher_initials VARCHAR(10)
);

-- Theology results table (Arabic subjects)
CREATE TABLE theology_results (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    subject VARCHAR(50) NOT NULL CHECK (subject IN ('Quran', 'Fiqh', 'Tarbiya', 'Arabic')),
    mot_score DECIMAL(5,2),
    eot_score DECIMAL(5,2)
);
```

## 3. TypeScript Errors

No TypeScript errors found.

## 4. Build Status

**Status: PASS**

```text

> jiddah-smart-report@0.1.0 build
> next build

▲ Next.js 16.2.4 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 25.3s
  Running TypeScript ...
  Finished TypeScript in 15.6s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/27) ...
  Generating static pages using 3 workers (6/27) 
  Generating static pages using 3 workers (13/27) 
  Generating static pages using 3 workers (20/27) 
✓ Generating static pages using 3 workers (27/27) in 1055ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ƒ /admin/circular/eot-entry
├ ƒ /admin/circular/mot-entry
├ ƒ /admin/classes
├ ○ /admin/dev-tools
├ ƒ /admin/marks
├ ƒ /admin/reports
├ ƒ /admin/reports/eot
├ ƒ /admin/reports/mot
├ ƒ /admin/students
├ ƒ /admin/subjects
├ ƒ /admin/terms
├ ƒ /admin/theology/eot-entry
├ ƒ /admin/theology/mot-entry
├ ƒ /api/academic-terms
├ ƒ /api/circular-results
├ ƒ /api/classes
├ ƒ /api/dev/seed
├ ƒ /api/marks
├ ƒ /api/reports
├ ƒ /api/students
├ ƒ /api/subjects
└ ƒ /api/theology-results


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


```

