import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight
  
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Auth Enforcement Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { data, error } = await supabase
      .from('terms')
      .select('*')
      .order('year', { ascending: false })
      .order('term_number', { ascending: true })

    if (error) {
      console.error('settings/terms GET error:', error)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ data: data || [] }))
  } catch (err: any) {
    console.error('settings/terms GET error:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}

export async function PATCH(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Auth Enforcement Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await request.json()
    const { termId, start_date, end_date, next_term_start } = body

    if (!termId) {
      return withCors(request, NextResponse.json({ error: 'termId is required' }, { status: 400 }))
    }

    const updatePayload: Record<string, string | null> = {}
    if (start_date !== undefined) updatePayload.start_date = start_date || null
    if (end_date !== undefined) updatePayload.end_date = end_date || null
    if (next_term_start !== undefined) updatePayload.next_term_start = next_term_start || null

    const { error } = await supabase
      .from('terms')
      .update(updatePayload)
      .eq('id', termId)

    if (error) {
      console.error('settings/terms PATCH error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ success: true, message: 'Term dates updated' }))
  } catch (err: any) {
    console.error('settings/terms PATCH error:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
