import type {
  ReportData,
  EnrollmentItem,
  ClassGroup,
  CircularSubject,
  TheologySubject,
  SectionType,
  Phase,
  Term,
} from './types';

// ─── Grading helpers ────────────────────────────────────────────────────────

const GRADE_SCALE = [
  { min: 85, grade: 'D1', remark: 'Excellent' },
  { min: 75, grade: 'D2', remark: 'Very Good' },
  { min: 70, grade: 'C3', remark: 'Good' },
  { min: 60, grade: 'C4', remark: 'Good' },
  { min: 55, grade: 'C5', remark: 'Credit' },
  { min: 50, grade: 'C6', remark: 'Credit' },
  { min: 40, grade: 'P7', remark: 'Pass' },
  { min: 35, grade: 'P8', remark: 'Pass' },
  { min: 0,  grade: 'F9', remark: 'Fail' },
];

function grade(score: number | null) {
  if (score == null) return { grade: '--', remark: '' };
  return GRADE_SCALE.find(g => score >= g.min) ?? { grade: 'F9', remark: 'Fail' };
}

const TEACHER_COMMENTS = [
  'An outstanding student who consistently demonstrates academic excellence.',
  'Shows tremendous improvement and a strong commitment to learning.',
  'A diligent and focused learner. Keep up the excellent work!',
  'Good performance. With continued effort, great results are achievable.',
  'Satisfactory results. More consistent effort is encouraged next term.',
];

const HEAD_COMMENTS = [
  'Excellent performance. We are very proud of this student.',
  'Commendable effort. Continue striving for excellence.',
  'Good progress this term. Keep the momentum going.',
  'Satisfactory. We look forward to seeing improvement next term.',
];

const CONDUCT_REMARKS = ['Excellent', 'Very Good', 'Good', 'Satisfactory'];

function seeded(seed: number, min: number, max: number) {
  return min + ((seed * 1103515245 + 12345) & 0x7fffffff) % (max - min + 1);
}

// ─── Enrollment roster ───────────────────────────────────────────────────────

export const mockEnrollments: EnrollmentItem[] = [
  // Nursery — Baby Class
  { enrollment_id: 'e1', name: 'Amira Hassan', arabic_name: 'أميرة حسن', admission_number: 'NUR-001', circular_class: 'Baby Class', section_type: 'nursery', theology_class_arabic: 'روضة الأطفال', track: 'Both' },
  { enrollment_id: 'e2', name: 'Umar Ssentamu', arabic_name: 'عمر سنتامو', admission_number: 'NUR-002', circular_class: 'Baby Class', section_type: 'nursery', theology_class_arabic: null, track: 'Secular' },
  { enrollment_id: 'e3', name: 'Halima Nabukenya', arabic_name: 'حليمة نابوكينيا', admission_number: 'NUR-003', circular_class: 'Baby Class', section_type: 'nursery', theology_class_arabic: 'روضة الأطفال', track: 'Both' },
  // Lower Primary — P.2
  { enrollment_id: 'e4', name: 'Ibrahim Ssekandi', arabic_name: 'إبراهيم سيكندي', admission_number: 'LP-001', circular_class: 'P.2', section_type: 'lower_primary', theology_class_arabic: 'المستوى الأول', track: 'Both' },
  { enrollment_id: 'e5', name: 'Fatuma Nakamya', arabic_name: 'فاطمة ناكاميا', admission_number: 'LP-002', circular_class: 'P.2', section_type: 'lower_primary', theology_class_arabic: null, track: 'Secular' },
  { enrollment_id: 'e6', name: 'Abdallah Mwanje', arabic_name: 'عبدالله موانجي', admission_number: 'LP-003', circular_class: 'P.2', section_type: 'lower_primary', theology_class_arabic: 'المستوى الأول', track: 'Both' },
  // Upper Primary — P.5
  { enrollment_id: 'e7', name: 'Khadija Nantongo', arabic_name: 'خديجة نانتونغو', admission_number: 'UP-001', circular_class: 'P.5', section_type: 'upper_primary', theology_class_arabic: 'المستوى الثالث', track: 'Both' },
  { enrollment_id: 'e8', name: 'Yusuf Ssemakula', arabic_name: 'يوسف سيماكولا', admission_number: 'UP-002', circular_class: 'P.5', section_type: 'upper_primary', theology_class_arabic: null, track: 'Secular' },
  { enrollment_id: 'e9', name: 'Rukia Namusisi', arabic_name: 'رقية ناموسيسي', admission_number: 'UP-003', circular_class: 'P.5', section_type: 'upper_primary', theology_class_arabic: 'المستوى الثالث', track: 'Both' },
  // Upper Primary — P.7
  { enrollment_id: 'e10', name: 'Mohammed Matovu', arabic_name: 'محمد ماتوفو', admission_number: 'UP-010', circular_class: 'P.7', section_type: 'upper_primary', theology_class_arabic: null, track: 'Secular' },
  { enrollment_id: 'e11', name: 'Aisha Namugga', arabic_name: 'عائشة ناموغا', admission_number: 'UP-011', circular_class: 'P.7', section_type: 'upper_primary', theology_class_arabic: null, track: 'Secular' },
];

export const mockClasses: ClassGroup[] = [
  { id: 'baby', name: 'Baby Class', section_type: 'nursery', enrollmentIds: ['e1', 'e2', 'e3'] },
  { id: 'p2', name: 'P.2', section_type: 'lower_primary', enrollmentIds: ['e4', 'e5', 'e6'] },
  { id: 'p5', name: 'P.5', section_type: 'upper_primary', enrollmentIds: ['e7', 'e8', 'e9'] },
  { id: 'p7', name: 'P.7', section_type: 'upper_primary', enrollmentIds: ['e10', 'e11'] },
];

const CIRCULAR_SUBJECTS: Record<SectionType, string[]> = {
  nursery: ['Number Work', 'English Literacy', 'Writing & Drawing', 'Social Studies', 'Health & Safety', 'Islamic Studies'],
  lower_primary: ['Mathematics', 'English Language', 'Science', 'Social Studies', 'Religious Education', 'Creative Arts'],
  upper_primary: ['Mathematics', 'English Language', 'Science', 'Social Studies', 'Religious Education', 'Creative Arts', 'Physical Education'],
  unknown: ['Mathematics', 'English Language', 'Science'],
};

const THEOLOGY_SUBJECTS_AR = ['القرآن الكريم', 'اللغة العربية', 'الفقه', 'التربية الإسلامية'];

function makeCircularSubjects(sectionType: SectionType, scoreType: 'bot' | 'mot' | 'eot', seed: number): CircularSubject[] {
  return CIRCULAR_SUBJECTS[sectionType].map((name, i) => {
    const botScore = seeded(seed + i, 55, 95);
    const motScore = seeded(seed + i + 100, 52, 97);
    const eotScore = seeded(seed + i + 200, 50, 99);
    const botG = grade(botScore);
    const motG = grade(motScore);
    const eotG = grade(eotScore);
    return {
      subject_name: name,
      bot_score: botScore,
      bot_grade_display: botG.grade,
      mot_score: scoreType !== 'bot' ? motScore : null,
      mot_grade_display: scoreType !== 'bot' ? motG.grade : null,
      eot_score: scoreType === 'eot' ? eotScore : null,
      eot_grade_display: scoreType === 'eot' ? eotG.grade : null,
      remark: scoreType === 'eot' ? eotG.remark : motG.remark,
    };
  });
}

function makeTheologySubjects(seed: number, scoreType: 'bot' | 'mot' | 'eot'): TheologySubject[] {
  return THEOLOGY_SUBJECTS_AR.map((name, i) => {
    const motScore = seeded(seed + i + 300, 60, 100);
    const eotScore = seeded(seed + i + 400, 58, 100);
    return {
      subject_name_arabic: name,
      mot_score: scoreType !== 'bot' ? motScore : null,
      eot_score: scoreType === 'eot' ? eotScore : null,
      mot_grade_display: scoreType !== 'bot' ? grade(motScore).grade : null,
      theology_remark: scoreType === 'eot'
        ? (eotScore >= 80 ? 'ممتاز' : eotScore >= 70 ? 'جيد جدا' : 'جيد')
        : (motScore >= 80 ? 'ممتاز' : motScore >= 70 ? 'جيد جدا' : 'جيد'),
      score: scoreType === 'eot' ? eotScore : motScore,
    };
  });
}

export function generateReport(enrollmentId: string, term: Term, phase: Phase, year = 2025): ReportData {
  const enrollment = mockEnrollments.find(e => e.enrollment_id === enrollmentId);
  if (!enrollment) throw new Error(`Enrollment not found: ${enrollmentId}`);

  const scoreType = phase.toLowerCase() as 'bot' | 'mot' | 'eot';
  const seed = enrollmentId.charCodeAt(1) * 97 + parseInt(term) * 53 + ['bot', 'mot', 'eot'].indexOf(scoreType) * 37;

  const subjects = makeCircularSubjects(enrollment.section_type, scoreType, seed);
  const activeScores = subjects.map(s =>
    scoreType === 'eot' ? s.eot_score : scoreType === 'mot' ? s.mot_score : s.bot_score
  ).filter((s): s is number => s != null);

  const total = activeScores.reduce((a, b) => a + b, 0);
  const avg = activeScores.length ? Math.round(total / activeScores.length) : 0;
  const divisionScale = [
    { min: 85, div: 'I' },
    { min: 70, div: 'II' },
    { min: 55, div: 'III' },
    { min: 40, div: 'IV' },
    { min: 0,  div: 'U' },
  ];
  const division = (divisionScale.find(d => avg >= d.min) ?? { div: 'U' }).div;
  const position = seeded(seed + 999, 1, 18);
  const totalStudents = seeded(seed + 998, 20, 32);

  const theologySubjects = (enrollment.track === 'Both' || enrollment.track === 'Theology') && scoreType !== 'bot'
    ? makeTheologySubjects(seed, scoreType)
    : null;

  const theoScores = theologySubjects?.map(s => s.eot_score ?? s.mot_score).filter((s): s is number => s != null) ?? [];
  const theoTotal = theoScores.reduce((a, b) => a + b, 0);
  const theoAvg = theoScores.length ? Math.round(theoTotal / theoScores.length) : 0;

  const commentIdx = seed % TEACHER_COMMENTS.length;

  return {
    id: `report-${enrollmentId}-t${term}-${phase}-${year}`,
    student: {
      name: enrollment.name,
      arabic_name: enrollment.arabic_name,
      admission_number: enrollment.admission_number,
      class_name: enrollment.circular_class,
      section: enrollment.section_type,
      academic_year: year,
      theology_class_arabic: enrollment.theology_class_arabic,
    },
    term: {
      label: `Term ${term}`,
      term_number: parseInt(term),
      academic_year: year,
      end_date: `${year}-08-10`,
      next_term_start: `${year}-09-01`,
    },
    score_type: scoreType,
    section_type: enrollment.section_type,
    circular: {
      subjects,
      total,
      aggregate: avg,
      division,
      position,
      total_students: totalStudents,
      bot_total: subjects.reduce((a, s) => a + (s.bot_score ?? 0), 0),
      bot_aggregate: 'D1',
      mot_total: scoreType !== 'bot' ? subjects.reduce((a, s) => a + (s.mot_score ?? 0), 0) : null,
      mot_aggregate: scoreType !== 'bot' ? 'D1' : null,
      eot_total: scoreType === 'eot' ? subjects.reduce((a, s) => a + (s.eot_score ?? 0), 0) : null,
      eot_aggregate: scoreType === 'eot' ? division : null,
      class_teacher_comment: TEACHER_COMMENTS[commentIdx],
      head_teacher_comment: HEAD_COMMENTS[commentIdx % HEAD_COMMENTS.length],
      conduct_remark: CONDUCT_REMARKS[seed % CONDUCT_REMARKS.length],
    },
    theology: theologySubjects ? {
      subjects: theologySubjects,
      total: theoTotal,
      mot_total: scoreType === 'mot' ? theoTotal : null,
      eot_total: scoreType === 'eot' ? theoTotal : null,
      aggregate: theoAvg,
      division: (divisionScale.find(d => theoAvg >= d.min) ?? { div: 'U' }).div,
    } : null,
    meta: {
      is_term_3: term === '3',
      promotion_status: position <= 5 ? 'PROMOTED' : position <= 10 ? 'CONDITIONAL' : null,
    },
  };
}

export function getEnrollmentById(id: string) {
  return mockEnrollments.find(e => e.enrollment_id === id);
}
