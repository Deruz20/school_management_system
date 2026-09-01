import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { corsPreflight, withCors } from '@/lib/api-cors'

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request) ?? new NextResponse(null, { status: 204 })
}

export async function POST(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      return withCors(request, NextResponse.json({ error: 'Session expired' }, { status: 401 }))
    }

    const user = data.user
    return withCors(
      request,
      NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Admin',
          role: user.user_metadata?.role ?? 'admin',
        },
      })
    )
  } catch {
    return withCors(request, NextResponse.json({ error: 'Unable to refresh session' }, { status: 500 }))
  }
}
