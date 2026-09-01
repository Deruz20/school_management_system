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
      .eq('is_current', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('settings/terms/active GET error:', error)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ data: data || null }))
  } catch (err: any) {
    console.error('settings/terms/active GET error:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
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
    const { termId } = body

    if (!termId) {
      return withCors(request, NextResponse.json({ error: 'termId is required' }, { status: 400 }))
    }

    // Call the RPC to atomically set the active term
    const { error } = await supabase.rpc('set_active_term', { p_term_id: termId })

    if (error) {
      console.error('settings/terms/active POST error:', error.message)
      if (error.code === 'P0002') {
        return withCors(request, NextResponse.json({ error: 'term not found' }, { status: 404 }))
      }
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ success: true, message: 'Active term updated' }))
  } catch (err: any) {
    console.error('settings/terms/active POST error:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
