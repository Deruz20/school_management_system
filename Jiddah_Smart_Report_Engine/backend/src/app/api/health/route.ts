import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { withCors, corsPreflight } from '@/lib/api-cors'
import { validateSupabaseEnv } from '@/lib/supabase-env'
import { mapSupabaseError } from '@/lib/api-response'
import type { NextRequest } from 'next/server'

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request) ?? new NextResponse(null, { status: 204 })
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  const envCheck = validateSupabaseEnv()
  if (!envCheck.ok) {
    return withCors(
      request,
      NextResponse.json(
        {
          ok: false,
          error: envCheck.error,
          key_format: envCheck.keyFormat,
        },
        { status: 500 }
      )
    )
  }

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { error } = await supabase.from('enrollments').select('id', { head: true, count: 'exact' })

    if (error) {
      return withCors(
        request,
        NextResponse.json({ ok: false, error: error.message, key_format: envCheck.keyFormat }, { status: 500 })
      )
    }

    return withCors(
      request,
      NextResponse.json({ ok: true, key_format: envCheck.keyFormat })
    )
  } catch (err) {
    const mapped = mapSupabaseError(err)
    return withCors(
      request,
      NextResponse.json(
        { ok: false, error: mapped.message, key_format: envCheck.keyFormat },
        { status: mapped.status }
      )
    )
  }
}
