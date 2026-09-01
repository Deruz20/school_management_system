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
    await supabase.auth.signOut()
    return withCors(request, NextResponse.json({ success: true }))
  } catch {
    return withCors(request, NextResponse.json({ error: 'Logout failed' }, { status: 500 }))
  }
}
