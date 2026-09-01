import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser, isNumericId, recordActivity } from '@/lib/api-server'

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  const notificationId = params?.id
  if (!notificationId || !isNumericId(notificationId)) {
    return withCors(request, NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 }))
  }

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const user = await getAuthenticatedUser(supabase)

    if (!user) {
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const result = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString(), read_by: user.id })
      .eq('id', Number(notificationId))

    const data = result.data as any
    const error = result.error

    if (error) {
      console.error('notification mark-read error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return withCors(request, NextResponse.json({ error: 'Notification not found' }, { status: 404 }))
    }

    await recordActivity(supabase, user.id, 'mark_notification_read', {
      notificationId: Number(notificationId),
    })

    return withCors(request, NextResponse.json({ success: true }))
  } catch (err: any) {
    console.error('notification mark-read exception:', err)
    return withCors(
      request,
      NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context)
}
