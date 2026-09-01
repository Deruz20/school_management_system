import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser, isValidEmail, normalizePhone, normalizeString, recordActivity } from '@/lib/api-server'

const allowedKeys = ['name', 'address', 'email', 'phone', 'website', 'timezone', 'logo_url']

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase.from('school_settings').select('*').limit(1).single()
    if (error) {
      console.error('settings/school GET error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ data }))
  } catch (err: any) {
    console.error('settings/school GET exception:', err)
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

    const updatePayload: Record<string, unknown> = {}
    Object.entries(body).forEach(([key, value]) => {
      if (!allowedKeys.includes(key)) return
      if (typeof value === 'string') {
        updatePayload[key] = normalizeString(value)
      }
    })

    if (updatePayload.email && typeof updatePayload.email === 'string' && !isValidEmail(updatePayload.email)) {
      return withCors(request, NextResponse.json({ error: 'Invalid school email address' }, { status: 400 }))
    }

    if (updatePayload.phone && typeof updatePayload.phone === 'string') {
      updatePayload.phone = normalizePhone(updatePayload.phone)
    }

    if (Object.keys(updatePayload).length === 0) {
      return withCors(request, NextResponse.json({ error: 'No valid settings provided' }, { status: 400 }))
    }

    const record = { id: 1, ...updatePayload }
    const { error } = await supabase.from('school_settings').upsert([record], { onConflict: 'id' })

    if (error) {
      console.error('settings/school PATCH error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    await recordActivity(supabase, user.id, 'update_school_settings', updatePayload)

    return withCors(request, NextResponse.json({ success: true }))
  } catch (err: any) {
    console.error('settings/school PATCH exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
