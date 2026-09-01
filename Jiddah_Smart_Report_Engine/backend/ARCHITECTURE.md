═══════════════════════════════════════════════════════
JIDDAH SMART REPORT ENGINE — MASTER ARCHITECTURE v1.0
═══════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — THE TWO CURRICULA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Two completely independent curricula run in parallel.
They NEVER share grading logic, tables, or report layouts.
They share only: student identity and school header.

CIRCULAR CURRICULUM (English)
- Language: English, LTR
- Grading: D1(85-100), D2(75-84), C3(70-74), C4(60-69),
           C5(55-59), C6(50-54), P7(40-49), P8(35-39), F9(0-34)
- Exception: Nursery uses A(90-100), B(80-89), C(70-79), 
             D(50-69), E(<50)
- Exams: BOT (Beginning of Term), MOT (Midterm), EOT (End of Term)
- Report name: "Provisional Report Form" for MOT

THEOLOGY CURRICULUM (Arabic)  
- Language: Arabic, RTL, font: Amiri
- ALL text on theology cards = 100% Arabic, zero English
- Grading: ممتاز(90+), جيد جداً(75-89), جيد(65-74), 
           مقبول(50-64), راسب(<50)
- Category: الأول(301-400), الثاني(201-300), الثالث(0-200)
- Exams: MOT (منتصف الفترة), EOT (نهاية الفترة)
- Subjects (always these 4, always in this order):
  القرآن | اللغة العربية | الفقه | التربية الإسلامية
- Report name: كشف الدرجات

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — CLASS NAMING (IMMUTABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CIRCULAR CLASSES (English, stored as-is):
Baby, Middle, Top, P.1, P.2, P.3, P.4, P.5, P.6, P.7
(always dot notation — P.1 not P1)

THEOLOGY CLASSES (Arabic, stored in Arabic):
Nursery level (الروضة):
  الروضة السفلى = Baby equivalent
  الروضة الوسطى = Middle equivalent  
  الروضة العليا = Top equivalent

Lower Primary level (الابتدائية السفلى):
  الصف الأول = P.1 equivalent
  الصف الثاني = P.2 equivalent
  الصف الثالث = P.3 equivalent

Upper Primary level (الابتدائية العليا):
  الصف الرابع = P.4 equivalent
  الصف الخامس = P.5 equivalent
  الصف السادس = P.6 equivalent
  الصف السابع = P.7 equivalent — NOTE: theology P.7 exists
                  but a student IN circular P.7 has NO theology

THEOLOGY SECTIONS:
  الروضة السفلى, الروضة الوسطى, الروضة العليا → section: 'raudha'
  الصف الأول, الثاني, الثالث → section: 'ibtidaai_lower'
  الصف الرابع, الخامس, السادس, السابع → section: 'ibtidaai_upper'

CIRCULAR SECTIONS:
  Baby, Middle, Top → section: 'nursery'
  P.1, P.2, P.3    → section: 'lower_primary'
  P.4, P.5, P.6, P.7 → section: 'upper_primary'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — STUDENT DUAL ENROLLMENT RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every student has ONE identity in the students table.
They are then enrolled in classes via an enrollments table.

RULE 1: Every student has exactly ONE circular class.
RULE 2: Every Muslim student Baby→P.6 circular 
        ALSO has ONE theology class (independent level).
RULE 3: A student in P.7 circular has NO theology class.
RULE 4: Circular class and theology class levels are 
        INDEPENDENT — a student can be P.6 circular 
        but الصف الثاني theology. This is normal and expected.
RULE 5: Theology class is assigned by the theology 
        class teacher, not admin.

Examples of valid enrollment:
  Student A: P.3 circular + الصف الأول theology
  Student B: P.6 circular + الصف الثاني theology  
  Student C: P.7 circular + NO theology (closed)
  Student D: الوسطى circular + الوسطى theology

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4 — SUBJECTS BY CLASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CIRCULAR NURSERY (Baby, Middle, Top):
  LA1 Social Development, LA2 English, LA3 Health Habits,
  LA4 Numbers, LA5 Reading, Writing

CIRCULAR LOWER PRIMARY (P.1, P.2, P.3):
  ENG, MATH, LIT I, LIT II, I.R.E
  (as seen in Lower Report Form)

CIRCULAR UPPER PRIMARY (P.4, P.5, P.6, P.7):
  ENG, MATH, SST, SCI, COMP
  (may vary slightly — class teacher controls subjects)

THEOLOGY (all levels, always fixed 4):
  القرآن, اللغة العربية, الفقه, التربية الإسلامية

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5 — REPORT CARD DESIGNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5A — NURSERY CIRCULAR (MOT & EOT, same design):
  - Colorful design, portrait A4
  - Columns: LEARNING AREA | MARK SCORED | REMARK | INITIALS
  - Grading: A(90-100), B(80-89), C(70-79), D(50-69), E(<50)
  - Learner's Competence / Progressive Records section
  - Grading scale table shown on card
  - Conduct, Class Teacher's Comment, Head Teacher's Comment
  - School stamp area
  - "This Report Form Is Not Valid Without The Official Stamp"

5B — NURSERY THEOLOGY (MOT & EOT, colorful Arabic design):
  - Title: بطاقة تقرير للروضة
  - Columns: المادة | الدرجة | التعليق
  - Subjects with images: القرآن الكريم, اللغة العربية, الفقه, التربية الإسلامية
  - ملاحظات مرب الفصل
  - ملاحظات مدير المدرسة
  - School stamp
  - Printed SEPARATELY from circular (NOT combined)

5C — PRIMARY MOT (Provisional, portrait A4):
  LEFT SIDE — Circular:
    Comparative Performance table:
    SUBJECTS | BOT(Mark,AGG) | MOT(Mark,AGG) | Subject Teacher Comment
    Subjects vary by section (lower vs upper primary)
    Grading scale: D1-F9
    Class Teacher Comment, Conduct, Head Teacher Comment
    
  RIGHT SIDE — Theology (same physical paper, landscape):
    المواد | الدرجة الكبرى | الدرجة الصغرى (MOT) | 
           الدرجة الكبرى | الدرجة الصغرى (EOT) | الملاحظات
    Subjects: القرآن, اللغة, الفقه, التربية, المجموع
    Position (الترتيب), Student count (عدد الطلبة)
    ملاحظة مشرف الفصل
    — THIS IS THE LOWER REPORT FORM DESIGN (document_1_.pdf)

5D — PRIMARY EOT (landscape A4, COMBINED on ONE PAGE):
  IDENTICAL structure to MOT but:
  - EOT columns filled
  - Circular LEFT, Theology RIGHT on same landscape A4
  - Both sides printed simultaneously, one paper
  - Default view: both sides shown together
  - Can be printed/viewed separately if needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6 — DATABASE SCHEMA (REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Core identity
students: id(UUID), name(TEXT), created_at

-- Circular classes
circular_classes: 
  id(UUID), 
  class_name(TEXT), -- 'Baby','Middle','Top','P.1'...'P.7'
  section(TEXT)     -- 'nursery','lower_primary','upper_primary'

-- Theology classes  
theology_classes:
  id(UUID),
  class_name_arabic(TEXT), -- 'الطفلى','الوسطى', etc.
  class_name_english(TEXT), -- 'Baby','Middle', etc. (for mapping)
  level(TEXT)  -- 'raudha' or 'ibtidaai'

-- Dual enrollment (THE KEY TABLE)
enrollments:
  id(UUID),
  student_id(UUID) FK students,
  circular_class_id(UUID) FK circular_classes,
  theology_class_id(UUID) FK theology_classes NULLABLE,
  -- NULL theology = P.7 circular or non-Muslim
  academic_year(INTEGER), -- e.g. 2026
  is_active(BOOLEAN)

-- Circular subjects (per class)
circular_subjects:
  id(UUID),
  subject_name(TEXT),
  section(TEXT) -- which section uses this subject

-- Circular results
circular_results:
  id(UUID),
  student_id(UUID) FK students,
  circular_class_id(UUID) FK circular_classes,
  subject_id(UUID) FK circular_subjects,
  term(TEXT), -- 'Term 1','Term 2','Term 3'
  year(INTEGER),
  bot_mark(DECIMAL), bot_agg(TEXT),
  mot_mark(DECIMAL), mot_agg(TEXT),
  eot_mark(DECIMAL), eot_agg(TEXT),
  teacher_comment(TEXT),
  teacher_initials(TEXT)

-- Theology results  
theology_results:
  id(UUID),
  student_id(UUID) FK students,
  theology_class_id(UUID) FK theology_classes,
  subject(TEXT), -- 'القرآن','اللغة العربية','الفقه','التربية الإسلامية'
  term(TEXT),
  year(INTEGER),
  mot_score(DECIMAL),
  eot_score(DECIMAL)

-- Users / roles (future auth)
users:
  id(UUID),
  name(TEXT),
  role(TEXT), -- 'admin','circular_teacher','theology_teacher'
  class_id(UUID) NULLABLE, -- which class they teach
  curriculum(TEXT) NULLABLE -- 'circular' or 'theology'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7 — SYSTEM RULES (NEVER BREAK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Circular and theology results are stored separately, always.
2. A student in P.7 circular CANNOT have theology results.
3. Theology card = zero English text, ever.
4. Circular nursery card ≠ circular primary card (different design).
5. Theology nursery card = بطاقة تقرير للروضة (colorful Arabic).
6. Primary EOT = landscape A4, circular left + theology right.
7. Primary MOT = same layout, same paper (Lower Report Form).
8. Subjects for lower primary ≠ upper primary in circular.
9. class_name always uses dot notation: P.1 not P1.
10. Theology class assignment is independent of circular class.
11. When printing EOT for P.7 circular: circular only, no theology.
12. RLS must be DISABLED on all result tables for now.
13. BOT column exists in the table but is optional/blank for now.
14. Default report view: both circular + theology side by side.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 8 — IMMEDIATE NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Run this SQL in Supabase to fix RLS immediately:
  ALTER TABLE circular_results DISABLE ROW LEVEL SECURITY;
  ALTER TABLE theology_results DISABLE ROW LEVEL SECURITY;
  ALTER TABLE students DISABLE ROW LEVEL SECURITY;

STEP 2: Run the new schema SQL to create missing tables:
  circular_classes, theology_classes, enrollments, 
  circular_subjects
  (keep existing students, circular_results, theology_results
   but add missing columns if needed)

STEP 3: Seed theology_classes with the 10 Arabic class names.

STEP 4: Rebuild circular entry forms to use enrollment-based
        student lookup (find student by circular_class_id).

STEP 5: Rebuild theology entry forms same way.

STEP 6: Rebuild report cards matching exact designs:
  - NurseryCircularReport (colorful, A-E grades)
  - NurseryTheologyReport (colorful Arabic, بطاقة تقرير)
  - PrimaryReport (landscape, circular left + theology right)
    matching Lower Report Form design exactly.

DO NOT proceed past STEP 1 without confirmation.
DO NOT change grading.ts or remarks.ts.
DO NOT delete any existing component files yet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 9 — PHASE 3A: GRADING ENGINE + MOT/EOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9A — NEW GRADING ENGINE (src/lib/grading.ts)
────────────────────────────────────────────

Source of truth for ALL grading logic. Never duplicate elsewhere.

EXPORTS (types):
- GradeCode: 'D1'|'D2'|'C3'|'C4'|'C5'|'C6'|'P7'|'P8'|'F9'
- Division: 'I'|'II'|'III'|'IV'|'U'
- NurseryGrade: 'A'|'B'|'C'|'D'|'E'
- PromotionStatus: 'Promote'|'Probation'|'Repeat'|'Try Next Class'

EXPORTS (functions):
- getSubjectGradeNumber(mark: number) → 1-9
  Returns UNEB grade number from raw mark (85+ = 1, 75-84 = 2, etc.)

- getGradeDisplay(gradeNum: number) → GradeCode
  Converts 1-9 to D1-F9 display format

- isCoreSubject(subjectName: string) → boolean
  Checks if subject is in CORE_SUBJECTS array

- calculateAggregate(marks: {subject_name, score}[]) → number | null
  Sums grade numbers from 4 core subjects.
  Returns null if any core subject missing.

- calculateTheologyAggregate(scores: number[]) → number | null
  Sums grade numbers from all 4 theology subject scores.
  Returns null if length ≠ 4 or any score is null.

- getDivision(aggregate: number) → Division
  Roman numerals: I (≤12), II (≤23), III (≤29), IV (≤34), U (>34)

- getPromotionStatus(division: Division, manualOverride?: 'Try Next Class') → PromotionStatus
  Term 3 only. Divs I-III = Promote, IV = Probation, others = Repeat.
  Can override with 'Try Next Class'.

- getNurseryGrade(mark: number) → {grade: NurseryGrade, remark: string}
  90+ = A/Excellent, 80-89 = B/Very Good, 70-79 = C/Good,
  50-69 = D/Fair, <50 = E/Poor

- getSubjectRemark(gradeNum: number) → string
  1-2 = Excellent, 3-4 = Very Good, 5-6 = Good,
  7-8 = Pass, 9 = Fail

GRADING SCALES:
- UNEB D1-F9 (circular primary): 85+ = D1, 75-84 = D2, 70-74 = C3, etc.
- Nursery A-E (circular + theology): 90+ = A, 80-89 = B, 70-79 = C, 50-69 = D, <50 = E
- Core subjects: English, Mathematics, Science, Social Studies (exact match)
- Aggregates ONLY use 4 core subjects
- Theology uses all 4 theology subjects

9B — NEW MARKS SCHEMA (Database)
────────────────────────────────

CIRCULAR MARKS (replaces old schema):
  id(UUID), enrollment_id(FK), subject_id(FK),
  term_id(FK), mot_score(0-100), eot_score(0-100),
  created_at, updated_at
  UNIQUE(enrollment_id, subject_id, term_id)

THEOLOGY MARKS (replaces old schema):
  id(UUID), enrollment_id(FK), subject_id(FK),
  term_id(FK), mot_score(0-100), eot_score(0-100),
  created_at, updated_at
  UNIQUE(enrollment_id, subject_id, term_id)
  — PER-SUBJECT scores, not single grade

THEOLOGY SUBJECTS (new master table):
  id(UUID), subject_name_arabic(TEXT),
  level('raudha'|'ibtidaai_lower'|'ibtidaai_upper'),
  sort_order(INT)
  
  Seeded with:
  - Raudha: القرآن الكريم, اللغة العربية, الفقه, التربية الإسلامية
  - Ibtidaai Lower: same 4
  - Ibtidaai Upper: same 4

9C — API ENDPOINTS (Marks)
──────────────────────────

GET /api/marks?enrollment_id=X&term_id=Y&score_type=mot|eot|both

Returns:
{
  circular_marks: [{
    subject_id, subject_name, is_core,
    mot_score, eot_score
  }],
  theology_marks: [{
    subject_id, subject_name_arabic,
    mot_score, eot_score
  }]
}

POST /api/marks

Body:
{
  enrollment_id, term_id,
  score_type: 'mot' | 'eot',
  circular_marks: [{ subject_id, score }],
  theology_marks: [{ subject_id, score }]
}

Behavior:
- Upserts into correct column (mot_score or eot_score)
- NEVER overwrites the other column
- On conflict: enrollment_id,subject_id,term_id
- Returns {success: true}

GET /api/theology-subjects?level=raudha|ibtidaai_lower|ibtidaai_upper

Returns array of theology subjects ordered by sort_order:
[{id, subject_name_arabic, level, sort_order}]

9D — UI WORKFLOW (MarksEntryClient.tsx)
────────────────────────────────────────

Step 1: Select Term (dropdown)
Step 2: Select Student (dropdown, enrollment-based)
Step 3: Select Score Type (MOT|EOT pill toggle, emerald = selected)

When MOT selected:
- Show mot_score column only
- Hide eot_score column

When EOT selected:
- Show eot_score column only
- Hide mot_score column

CIRCULAR MARKS TABLE:
- Subject | Core | Score
- Per-subject input (0-100)
- Core ✓ shown for core subjects

THEOLOGY MARKS TABLE:
- المادة | Score
- Per-subject input (0-100)
- Arabic labels only
- 4 subjects fixed per level

Both tables store independently.
No cross-contamination between MOT and EOT.

9E — CRITICAL RULES (PHASE 3A)
───────────────────────────────

1. All grading logic ONLY in src/lib/grading.ts
2. Arabic names NEVER translated
3. Aggregates use ONLY 4 core subjects
4. Divisions = Roman numerals only (I, II, III, IV, U)
5. BOT not implemented (schema exists, blank for now)
6. MOT never overwrites EOT and vice versa
7. Nursery uses A-E grading, NOT D1-F9
8. Theology per-subject scores, NOT single grade
9. Theology subjects from theology_subjects table (seeded)
10. RLS DISABLED on all marks tables
11. Score type workflow = independent columns (mot_score, eot_score)
12. When switching MOT ↔ EOT: both scores preserved, only input column changes

9F — PHASE 3B: REPORT CARD GENERATION
──────────────────────────────────────

1. New endpoint: GET /api/report?enrollment_id=X&term_id=Y&score_type=mot|eot
   - Returns a complete report object with circular + theology card data
   - Uses enrollment based lookup, not direct student page fetch
   - Supports nursery, lower_primary, upper_primary sections
   - Includes circular total, aggregate, division, and promotion status
   - Theology section is null when the student has no theology enrollment

2. New grading rules for report generation:
   - Core subjects are section-aware using src/lib/grading.ts
   - lower_primary core subjects: English, Mathematics, Literacy I, Literacy II
   - upper_primary core subjects: English, Mathematics, Science, Social Studies
   - Core subject detection accepts abbreviations like ENG, MATH, SST, SCI

3. New report generation UI:
   - src/app/admin/reports/page.tsx loads academic terms from Supabase server-side
   - src/components/ReportGeneratorClient.tsx fetches /api/enrollments and builds the preview
   - Score type toggle selects MOT or EOT without overwriting the other column
   - Report preview renders styled HTML for primary or nursery cards
   - Print uses window.print() and hides UI chrome in @media print

4. Report layout rules:
   - Primary preview: circular left, theology right, Arabic theology section dir="rtl"
   - Nursery preview: portrait-style learning area table with grade + remark
   - School name is bold and centered; black borders preserve print structure
   - Grading scale is shown in colored badge boxes

5. Admin navigation update:
   - Add a Generate Reports card/link on src/app/admin/page.tsx
   - Provides direct access to the report card generator from the dashboard

