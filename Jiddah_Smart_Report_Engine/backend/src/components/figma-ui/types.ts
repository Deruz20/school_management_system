export type Phase = 'BOT' | 'MOT' | 'EOT';
export type Term = '1' | '2' | '3';
export type Track = 'Secular' | 'Theology' | 'Both';
export type SectionType = 'nursery' | 'lower_primary' | 'upper_primary' | 'unknown';
export type ScoreType = 'bot' | 'mot' | 'eot';

export interface CircularSubject {
  subject_name: string;
  bot_score: number | null;
  bot_grade_display: string | null;
  mot_score: number | null;
  mot_grade_display: string | null;
  eot_score: number | null;
  eot_grade_display: string | null;
  remark: string | null;
}

export interface TheologySubject {
  subject_name_arabic: string;
  mot_score: number | null;
  eot_score: number | null;
  mot_grade_display: string | null;
  theology_remark: string | null;
  score?: number | null;
}

export interface ReportData {
  id: string;
  student: {
    name: string;
    arabic_name: string;
    admission_number: string;
    class_name: string;
    section: string;
    academic_year: number;
    theology_class_arabic: string | null;
  };
  term: {
    label: string;
    term_number: number;
    academic_year: number;
    end_date: string;
    next_term_start: string;
  };
  score_type: ScoreType;
  section_type: SectionType;
  circular: {
    subjects: CircularSubject[];
    total: number;
    aggregate: number | null;
    division: string | null;
    position: number | null;
    total_students: number | null;
    bot_total: number | null;
    bot_aggregate: string | null;
    mot_total: number | null;
    mot_aggregate: string | null;
    eot_total: number | null;
    eot_aggregate: string | null;
    class_teacher_comment: string | null;
    head_teacher_comment: string | null;
    conduct_remark: string | null;
  };
  theology: {
    subjects: TheologySubject[];
    total: number;
    mot_total: number | null;
    eot_total: number | null;
    aggregate: number | null;
    division: string | null;
  } | null;
  meta: {
    is_term_3: boolean;
    promotion_status: string | null;
  };
}

export interface EnrollmentItem {
  enrollment_id: string;
  name: string;
  arabic_name: string;
  admission_number: string;
  circular_class: string;
  section_type: SectionType;
  theology_class_arabic: string | null;
  track: Track;
}

export interface ClassGroup {
  id: string;
  name: string;
  section_type: SectionType;
  enrollmentIds: string[];
}

export interface FilterState {
  mode: 'individual' | 'class';
  studentIds: string[];
  classIds: string[];
  section: 'all' | 'nursery' | 'lower_primary' | 'upper_primary';
  gender: 'All' | 'Male' | 'Female';
  term: Term | '';
  phase: Phase | '';
  curriculum: 'secular' | 'theology' | 'combined';
  layout: 'single' | 'grid';
}
