import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser, normalizePhone, normalizeString, recordActivity } from '@/lib/api-server'

const allowedProfileKeys = ['first_name', 'last_name', 'phone']

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

    if (!user) {
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone, role, avatar_url')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('settings/user GET error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    const payload = {
      id: user.id,
      email: user.email || '',
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || '',
      role: profile?.role || user.role || 'staff',
      avatar_url: user.user_metadata?.avatar_url || profile?.avatar_url || null,
    }

    return withCors(request, NextResponse.json({ data: payload }))
  } catch (err: any) {
    console.error('settings/user GET exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}

export async function PATCH(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const user = await getAuthenticatedUser(supabase)

    if (!user) {
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await request.json()
    if (!body || typeof body !== 'object') {
      return withCors(request, NextResponse.json({ error: 'Invalid payload' }, { status: 400 }))
    }

    const updates: Record<string, unknown> = {}
    Object.entries(body).forEach(([key, value]) => {
      if (!allowedProfileKeys.includes(key)) return
      if (typeof value === 'string') {
        updates[key] = key === 'phone' ? normalizePhone(value) : normalizeString(value)
      }
    })

    if (Object.keys(updates).length === 0) {
      return withCors(request, NextResponse.json({ error: 'No valid profile fields provided' }, { status: 400 }))
    }

    const { error } = await supabase.from('profiles').upsert([{ id: user.id, ...updates }], { onConflict: 'id' })
    if (error) {
      console.error('settings/user PATCH error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    await recordActivity(supabase, user.id, 'update_user_profile', updates)

    return withCors(request, NextResponse.json({ success: true }))
  } catch (err: any) {
    console.error('settings/user PATCH exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
