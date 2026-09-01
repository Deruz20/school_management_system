import { NextResponse } from 'next/server'
import { withCors } from '@/lib/api-cors'
import { mapAuthError } from '@/lib/auth-errors'

/** True when PostgREST reports a missing relation (e.g. teachers table not migrated yet). */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  )
}

export function mapSupabaseError(err: unknown): { message: string; status: number } {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message?: string }).message)
    const lower = message.toLowerCase()
    if (
      lower.includes('connecttimeout') ||
      lower.includes('etimedout') ||
      lower.includes('econnrefused') ||
      lower.includes('fetch failed')
    ) {
      return {
        message: 'Cannot reach the database. Check your internet connection and Supabase project URL.',
        status: 503,
      }
    }
    return { message, status: 500 }
  }
  return { message: 'Internal server error', status: 500 }
}

export function jsonError(request: Request, message: string, status: number) {
  return withCors(request, NextResponse.json({ error: message }, { status }))
}

export function jsonAuthError(request: Request, err: unknown) {
  const mapped = mapAuthError(err)
  return withCors(request, NextResponse.json({ error: mapped.message }, { status: mapped.status }))
}

export function handleApiException(request: Request, err: unknown, logLabel?: string) {
  if (logLabel) console.error(logLabel, err)
  const mapped = mapSupabaseError(err)
  return jsonError(request, mapped.message, mapped.status)
}
