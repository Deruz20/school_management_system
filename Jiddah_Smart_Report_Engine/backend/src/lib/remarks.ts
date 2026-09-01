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
