import { mapAuthError } from '@/lib/auth-errors'
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
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password) {
      return withCors(
        request,
        NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
      )
    }

    if (String(password).length < 6) {
      return withCors(
        request,
        NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase.auth.signUp({
      email: String(email).trim(),
      password: String(password),
      options: {
        data: {
          full_name: name ? String(name).trim() : undefined,
          role: 'admin',
        },
        emailRedirectTo: undefined,
      },
    })

    if (error) {
      const mapped = mapAuthError(error)
      return withCors(request, NextResponse.json({ error: mapped.message }, { status: mapped.status }))
    }

    const user = data.user
    if (!user) {
      return withCors(
        request,
        NextResponse.json({ error: 'Sign up failed. Please try again.' }, { status: 500 })
      )
    }

    return withCors(
      request,
      NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Admin',
          role: user.user_metadata?.role ?? 'admin',
        },
        session: Boolean(data.session),
        message: data.session
          ? 'Account created successfully'
          : 'Account created. You can sign in now.',
      })
    )
  } catch (err) {
    const mapped = mapAuthError(err)
    return withCors(request, NextResponse.json({ error: mapped.message }, { status: mapped.status }))
  }
}
