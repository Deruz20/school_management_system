import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { withCors, corsPreflight } from '@/lib/api-cors'
import type { NextRequest } from 'next/server'

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request) ?? new NextResponse(null, { status: 204 })
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  const expiresIn = 3600
  const token = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')

  const response = NextResponse.json({ token, expiresIn })
  response.cookies.set('csrf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: expiresIn,
  })

  return withCors(request, response)
}
