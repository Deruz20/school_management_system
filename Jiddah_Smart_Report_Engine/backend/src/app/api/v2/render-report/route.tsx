import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'

import PrimaryEOTReport from '@/components/reports/PrimaryEOTReport'
import PrimaryMOTReport from '@/components/reports/PrimaryMOTReport'
import NurseryEOTReport from '@/components/reports/NurseryEOTReport'
import NurseryMOTReport from '@/components/reports/NurseryMOTReport'
import NurseryTheologyEOTReport from '@/components/reports/NurseryTheologyEOTReport'

export const dynamic = 'force-dynamic'

const SubjectResultSchema = z.object({
  subjectName: z.string(),
  score: z.number().nullable(),
  grade: z.string().nullable(),
  points: z.number().nullable(),
  remarks: z.string().nullable(),
  isCore: z.boolean().optional(),
})

const ReportV2RequestSchema = z.object({
  version: z.literal('2.0'),
  tenant: z.object({
    id: z.string(),
    name: z.string().min(1).max(100),
    motto: z.string().max(200).optional(),
    logoUrl: z.string().url().optional(),
  }).strict(),
  context: z.object({
    reportType: z.enum(['nursery', 'lower_primary', 'upper_primary']),
    scoreType: z.enum(['mot', 'eot']),
    hasTheology: z.boolean(),
  }).strict(),
  data: z.object({
    termResultId: z.string(),
    student: z.object({
      name: z.string(),
      admissionNo: z.string(),
    }),
    academic: z.object({
      termName: z.string(),
      academicYearName: z.string(),
      className: z.string(),
    }),
    performance: z.object({
      totalScore: z.number().nullable(),
      aggregatePoints: z.number().nullable(),
      division: z.string().nullable(),
      position: z.number().nullable(),
      totalStudents: z.number().nullable(),
      classTeacherComment: z.string().nullable(),
      headTeacherComment: z.string().nullable(),
      conductRemark: z.string().nullable(),
    }),
    circularSubjects: z.array(SubjectResultSchema),
    theologySubjects: z.array(SubjectResultSchema).optional(),
  })
})

function checkAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  const token = authHeader.split(' ')[1]
  const expectedSecret = process.env.JIDDAH_API_SECRET
  if (!expectedSecret) return false // Deny access if secret is not configured in prod

  if (token.length !== expectedSecret.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedSecret))
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = ReportV2RequestSchema.safeParse(body)
    
    if (!parsed.success) {
      console.error('Zod Validation Error:', parsed.error);
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }

    const { tenant, context, data } = parsed.data

    // Jiddah Adapter: map NOVA DTO to legacy reportData shape expected by components.
    // We STRICTLY pass null for absent remarks, and bypass all business logic.
    
    const mappedCircularSubjects = data.circularSubjects.map(sub => ({
      subject_name: sub.subjectName,
      mot_score: context.scoreType === 'mot' ? sub.score : null,
      eot_score: context.scoreType === 'eot' ? sub.score : null,
      score: sub.score,
      grade_display: sub.grade,
      remark: sub.remarks,
      is_core: sub.isCore ?? false
    }))

    const mappedTheologySubjects = (data.theologySubjects || []).map(sub => ({
      subject_name_arabic: sub.subjectName,
      mot_score: context.scoreType === 'mot' ? sub.score : null,
      eot_score: context.scoreType === 'eot' ? sub.score : null,
      score: sub.score,
      grade_display: sub.grade,
      theology_remark: sub.remarks
    }))

    const reportData = {
      // Legacy templates expect a 'student' object that also mixes in class names
      student: {
        name: data.student.name,
        admission_number: data.student.admissionNo,
        class_name: data.academic.className,
        academic_year: data.academic.academicYearName,
      },
      term: {
        label: data.academic.termName,
      },
      section_type: context.reportType,
      score_type: context.scoreType,
      circular: {
        subjects: mappedCircularSubjects,
        total: data.performance.totalScore,
        aggregate: data.performance.aggregatePoints,
        division: data.performance.division,
        position: data.performance.position,
        total_students: data.performance.totalStudents,
        class_teacher_comment: data.performance.classTeacherComment,
        head_teacher_comment: data.performance.headTeacherComment,
        conduct_remark: data.performance.conductRemark,
      },
      theology: context.hasTheology ? {
        subjects: mappedTheologySubjects,
        total: mappedTheologySubjects.reduce((sum, s) => sum + (s.score || 0), 0),
      } : null,
      tenant: tenant // Passed for header branding overrides
    }

    // Render the React component based on context
    let element = null
    
    if (context.reportType === 'nursery') {
      if (context.hasTheology && context.scoreType === 'eot') {
         element = <NurseryTheologyEOTReport reportData={reportData} />
      } else if (context.scoreType === 'eot') {
         element = <NurseryEOTReport reportData={reportData} />
      } else {
         element = <NurseryMOTReport reportData={reportData} />
      }
    } else {
      // lower_primary and upper_primary
      if (context.scoreType === 'eot') {
        element = <PrimaryEOTReport reportData={reportData} />
      } else {
        element = <PrimaryMOTReport reportData={reportData} />
      }
    }

    if (!element) {
      return NextResponse.json({ error: 'Unsupported report configuration' }, { status: 400 })
    }

    const ReactDOMServer = await import('react-dom/server');
    const htmlString = ReactDOMServer.renderToStaticMarkup(element);

    // Wrap in standard HTML document shell so it prints correctly as a standalone page
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Report - ${data.student.name}</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 0; }
    @media print {
      @page { size: landscape A4; margin: 0; }
    }
  </style>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white">
  ${htmlString}
</body>
</html>`

    return NextResponse.json({
      success: true,
      html: fullHtml,
      timestamp: new Date().toISOString()
    })

  } catch (err: any) {
    console.error('Render Error:', err)
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 })
  }
}
