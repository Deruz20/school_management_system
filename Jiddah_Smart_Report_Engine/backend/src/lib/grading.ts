export type GradeCode = 'D1' | 'D2' | 'C3' | 'C4' | 'C5' | 'C6' | 'P7' | 'P8' | 'F9'
export type Division = 'I' | 'II' | 'III' | 'IV' | 'U'
export type NurseryGrade = 'A' | 'B' | 'C' | 'D' | 'E'
export type PromotionStatus = 'Promote' | 'Probation' | 'Repeat' | 'Try Next Class'

// UNEB subject grade (1-9) from mark
export function getSubjectGradeNumber(mark: number): number {
  if (mark >= 85) return 1
  if (mark >= 75) return 2
  if (mark >= 70) return 3
  if (mark >= 65) return 4
  if (mark >= 60) return 5
  if (mark >= 55) return 6
  if (mark >= 50) return 7
  if (mark >= 40) return 8
  return 9
}

// Display format D1-F9
export function getGradeDisplay(gradeNum: number): GradeCode {
  const map: Record<number, GradeCode> = {
    1: 'D1',
    2: 'D2',
    3: 'C3',
    4: 'C4',
    5: 'C5',
    6: 'C6',
    7: 'P7',
    8: 'P8',
    9: 'F9',
  }
  return map[gradeNum] ?? 'F9'
}

export const CORE_SUBJECTS_BY_SECTION: Record<string, string[][]> = {
  lower_primary: [
    ['English', 'ENG', 'Eng'],
    ['Mathematics', 'MATH', 'Math', 'Maths', 'MTC'],
    ['Literacy I', 'LIT I', 'LIT1', 'Lit I'],
    ['Literacy II', 'LIT II', 'LIT2', 'Lit II'],
  ],
  upper_primary: [
    ['English', 'ENG', 'Eng'],
    ['Mathematics', 'MATH', 'Math', 'Maths', 'MTC'],
    ['Science', 'SCI', 'Sci'],
    ['Social Studies', 'SST', 'S.ST', 'Social St'],
  ],
}

function getCoreSubjectGroups(section?: string) {
  return section && CORE_SUBJECTS_BY_SECTION[section]
    ? CORE_SUBJECTS_BY_SECTION[section]
    : [...CORE_SUBJECTS_BY_SECTION.lower_primary, ...CORE_SUBJECTS_BY_SECTION.upper_primary]
}

export function isCoreSubject(subjectName: string, section?: string): boolean {
  const name = subjectName.trim().toLowerCase()
  const variants = getCoreSubjectGroups(section)
  return variants.some(group => group.some(v => v.toLowerCase() === name))
}

export function getSubjectGradeNumberForAggregate(
  subjectName: string,
  marks: { subject_name: string; score: number }[]
): number | null {
  const name = subjectName.trim().toLowerCase()
  const found = marks.find(m => {
    if (typeof m.score !== 'number') return false
    const mName = m.subject_name.trim().toLowerCase()
    return getCoreSubjectGroups().some(group =>
      group.some(v => v.toLowerCase() === mName)
    ) && getCoreSubjectGroups().some(group =>
      group.some(v => v.toLowerCase() === name) &&
      group.some(v => v.toLowerCase() === mName)
    )
  })
  return found ? getSubjectGradeNumber(found.score) : null
}

// Aggregate from core subject marks
// Returns null if any core subject missing
export function calculateAggregate(
  marks: { subject_name: string; score: number }[],
  section: string
): number | null {
  const coreGroups = CORE_SUBJECTS_BY_SECTION[section]
  if (!coreGroups) return null
  const grades = coreGroups.map(variants => {
    const found = marks.find(m =>
      variants.some(v => v.toLowerCase() === m.subject_name.trim().toLowerCase()) &&
      typeof m.score === 'number'
    )
    return found ? getSubjectGradeNumber(found.score) : null
  })
  if (grades.some(g => g === null)) return null
  return grades.reduce((sum, g) => sum! + g!, 0) as number
}

// Theology aggregate from 4 subject scores
export function calculateTheologyAggregate(scores: number[]): number | null {
  if (scores.length !== 4 || scores.some((s) => s == null)) return null
  return scores.reduce((sum, s) => sum + getSubjectGradeNumber(s), 0)
}

// Division from aggregate (Roman numerals)
export function getDivision(aggregate: number): Division {
  if (aggregate <= 12) return 'I'
  if (aggregate <= 23) return 'II'
  if (aggregate <= 29) return 'III'
  if (aggregate <= 34) return 'IV'
  return 'U'
}

// Promotion (Term 3 only, based on division)
export function getPromotionStatus(division: Division, manualOverride?: 'Try Next Class'): PromotionStatus {
  if (manualOverride === 'Try Next Class') return 'Try Next Class'
  if (division === 'I' || division === 'II' || division === 'III') return 'Promote'
  if (division === 'IV') return 'Probation'
  return 'Repeat'
}

// Nursery grading
export function getNurseryGrade(mark: number): { grade: NurseryGrade; remark: string } {
  if (mark >= 90) return { grade: 'A', remark: 'Excellent' }
  if (mark >= 80) return { grade: 'B', remark: 'Very Good' }
  if (mark >= 70) return { grade: 'C', remark: 'Good' }
  if (mark >= 50) return { grade: 'D', remark: 'Fair' }
  return { grade: 'E', remark: 'Poor' }
}

// Subject remarks for circular (primary)
export function getSubjectRemark(gradeNum: number): string {
  if (gradeNum <= 2) return 'Excellent'
  if (gradeNum <= 4) return 'Very Good'
  if (gradeNum <= 6) return 'Good'
  if (gradeNum <= 8) return 'Pass'
  return 'Fail'
}

export function getClassTeacherComment(division: string | null): string {
  switch(division) {
    case 'I':   return 'Excellent performance. Keep it up!'
    case 'II':  return 'Very good performance. Aim higher!'
    case 'III': return 'Good performance. Work harder.'
    case 'IV':  return 'Fair performance. More effort needed.'
    case 'U':   return 'Below standard. Seek extra support.'
    default:    return 'Keep working hard.'
  }
}

export function getHeadTeacherComment(division: string | null): string {
  switch(division) {
    case 'I':   return 'Outstanding. Well done!'
    case 'II':  return 'Good work. Strive for excellence.'
    case 'III': return 'Satisfactory. Push yourself further.'
    case 'IV':  return 'Needs improvement. Stay focused.'
    case 'U':   return 'Requires significant improvement.'
    default:    return 'Continue to work diligently.'
  }
}

export function getConductRemark(division: string | null): string {
  switch(division) {
    case 'I':   return 'Excellent conduct. Very impressive!'
    case 'II':  return 'Very good conduct. Well done!'
    case 'III': return 'Good conduct. Keep it up.'
    case 'IV':  return 'Fair conduct. Be more disciplined.'
    case 'U':   return 'Poor conduct. Needs serious improvement.'
    default:    return 'Good conduct.'
  }
}

export function getNurseryTeacherComment(grades: string[]): string {
  const gradeScore = (g: string) =>
    ({A:5,B:4,C:3,D:2,E:1}[g] ?? 3)
  const avg = grades.reduce((s,g) => s + gradeScore(g), 0) / (grades.length || 1)
  if (avg >= 4.5) return 'Excellent learner. Very impressive!'
  if (avg >= 3.5) return 'Very good progress. Keep it up!'
  if (avg >= 2.5) return 'Good effort. Room for improvement.'
  if (avg >= 1.5) return 'Fair progress. Needs more practice.'
  return 'Needs significant support at home.'
}

export function getTheologyComment(total: number | null): string {
  if (total == null) return ''
  if (total >= 360) return 'ممتاز جداً. استمر في التفوق!'
  if (total >= 320) return 'جيد جداً. واصل الاجتهاد.'
  if (total >= 280) return 'جيد. يحتاج إلى مزيد من الجهد.'
  if (total >= 240) return 'مقبول. عليك الاجتهاد أكثر.'
  return 'ضعيف. يحتاج إلى دعم إضافي.'
}
