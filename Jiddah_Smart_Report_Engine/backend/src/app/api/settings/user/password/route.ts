import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser, recordActivity } from '@/lib/api-server'
import { mapAuthError } from '@/lib/auth-errors'

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function PATCH(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const body = await request.json()
    const currentPassword = String(body?.currentPassword || '')
    const newPassword = String(body?.newPassword || '')

    if (!currentPassword || !newPassword) {
      return withCors(
        request,
        NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 })
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const user = await getAuthenticatedUser(supabase)

    if (!user) {
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    if (!user.email) {
      return withCors(request, NextResponse.json({ error: 'User email is unavailable' }, { status: 400 }))
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: String(user.email),
      password: currentPassword,
    })

    if (verifyError) {
      const mapped = mapAuthError(verifyError)
      return withCors(request, NextResponse.json({ error: mapped.message }, { status: mapped.status }))
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      const mapped = mapAuthError(updateError)
      return withCors(request, NextResponse.json({ error: mapped.message }, { status: mapped.status }))
    }

    await recordActivity(supabase, user.id, 'change_password')
    return withCors(request, NextResponse.json({ success: true }))
  } catch (err: unknown) {
    const mapped = mapAuthError(err)
    return withCors(request, NextResponse.json({ error: mapped.message }, { status: mapped.status }))
  }
}
