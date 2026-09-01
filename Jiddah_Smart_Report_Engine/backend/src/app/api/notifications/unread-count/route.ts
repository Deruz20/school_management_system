import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser } from '@/lib/api-server'

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const user = await getAuthenticatedUser(supabase)

    let query = supabase.from('notifications').select('id', { head: true, count: 'exact' }).eq('read', false)

    if (user?.id) {
      query = query.or(`recipient_id.is.null,recipient_id.eq.${user.id}`)
    }

    const { count, error } = await query
    if (error) {
      console.error('notifications unread-count error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ count: count ?? 0 }))
  } catch (err: any) {
    console.error('notifications unread-count exception:', err)
    return withCors(
      request,
      NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
    )
  }
}
