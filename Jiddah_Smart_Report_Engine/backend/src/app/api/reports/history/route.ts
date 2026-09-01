import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

/** Report generation history for the admin dashboard (grouped by class). */
export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const [{ data: enrollments }, { data: currentTerm }] = await Promise.all([
      supabase
        .from('enrollments')
        .select('id, circular_classes ( class_name )')
        .eq('is_active', true),
      supabase.from('terms').select('id, label').eq('is_current', true).maybeSingle(),
    ])

    const byClass = new Map<string, number>()
    for (const row of enrollments ?? []) {
      const className =
        (Array.isArray(row.circular_classes)
          ? row.circular_classes[0]?.class_name
          : (row.circular_classes as { class_name?: string } | null)?.class_name) ?? 'Unknown'
      byClass.set(className, (byClass.get(className) ?? 0) + 1)
    }

    const data = Array.from(byClass.entries()).map(([className, count], index) => ({
      id: `class-${index}-${className}`,
      type: 'End of Term',
      class: className,
      term: currentTerm?.label ?? 'Current term',
      count,
      status: 'ready' as const,
      date: new Date().toISOString().split('T')[0],
      termId: currentTerm?.id,
    }))

    return withCors(request, NextResponse.json({ data }))
  } catch (err) {
    console.error('reports/history error:', err)
    return withCors(
      request,
      NextResponse.json({ error: 'Failed to load report history' }, { status: 500 })
    )
  }
}
