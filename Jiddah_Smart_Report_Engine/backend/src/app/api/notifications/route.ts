import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser, recordActivity } from '@/lib/api-server'

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

    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)

    if (user?.id) {
      query = query.or(`recipient_id.is.null,recipient_id.eq.${user.id}`)
    }

    const { data, error } = await query
    if (error) {
      console.error('notifications GET error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    const notifications = (data ?? []).map((notification: any) => ({
      id: notification.id,
      title: notification.title || '',
      message: notification.message || '',
      time: notification.time || notification.created_at || '',
      read: Boolean(notification.read),
      priority: notification.priority || 'normal',
      type: notification.type || 'info',
    }))

    if (user?.id) {
      await recordActivity(supabase, user.id, 'view_notifications', {
        count: notifications.length,
      })
    }

    return withCors(request, NextResponse.json({ data: notifications }))
  } catch (err: any) {
    console.error('notifications GET exception:', err)
    return withCors(
      request,
      NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
    )
  }
}
