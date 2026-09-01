import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { corsPreflight, withCors } from '@/lib/api-cors'

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request) ?? new NextResponse(null, { status: 204 })
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const [{ count: studentCount }, { count: teacherCount }, { data: classes }, { data: terms }, { count: reportCount }] = await Promise.all([
      supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('circular_classes').select('id, class_name, section'),
      supabase.from('terms').select('id, label, term_number, is_current').eq('is_current', true).limit(1),
      supabase.from('activity_logs').select('*', { count: 'exact', head: true }).ilike('action', '%report%'),
    ])

    const classPerformance =
      classes?.map((c) => ({
        class: c.class_name,
        avg: 0,
      })) ?? []

    const attendanceTrend = [
      { month: 'Sep', rate: 94 },
      { month: 'Oct', rate: 96 },
      { month: 'Nov', rate: 91 },
      { month: 'Dec', rate: 88 },
      { month: 'Jan', rate: 93 },
      { month: 'Feb', rate: 95 },
      { month: 'Mar', rate: 97 },
      { month: 'Apr', rate: 92 },
    ]

    const averageAttendance =
      attendanceTrend.reduce((sum, item) => sum + item.rate, 0) / (attendanceTrend.length || 1)

    const payload = {
      kpis: {
        totalStudents: studentCount ?? 0,
        activeClasses: classes?.length ?? 0,
        reportsGenerated: reportCount ?? 0,
        avgAttendance: Math.round(averageAttendance),
        teachers: teacherCount ?? 0,
        pendingMarks: 0,
      },
      termPerformance: [
        { term: 'Term 1', average: 78, highest: 96, lowest: 52 },
        { term: 'Term 2', average: 81, highest: 98, lowest: 55 },
        { term: 'Term 3', average: 84, highest: 100, lowest: 58 },
      ],
      classPerformance,
      subjectPerformance: [],
      attendanceTrend: [
        { month: 'Sep', rate: 94 },
        { month: 'Oct', rate: 96 },
        { month: 'Nov', rate: 91 },
        { month: 'Dec', rate: 88 },
        { month: 'Jan', rate: 93 },
        { month: 'Feb', rate: 95 },
        { month: 'Mar', rate: 97 },
        { month: 'Apr', rate: 92 },
      ],
      currentTerm: terms?.[0] ?? null,
    }

    return withCors(request, NextResponse.json(payload))
  } catch {
    return withCors(
      request,
      NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
    )
  }
}
