import { NextRequest, NextResponse } from 'next/server'

function parseAllowedOrigins(originValue?: string): string[] {
  if (!originValue) return []
  return originValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://jiddah-smart-report-engine.vercel.app',
  'https://jiddah-smart-report-engine-dashboard.vercel.app',
  'https://jiddah-smart-report-engine-dashboard-deruzdevs-projects.vercel.app',
  'https://jiddah-smart-report-engine-dashboard-fz2r6ddkt.vercel.app',
  'https://jiddah-smart-report-engine-dashboar.vercel.app',
  'https://dashboard-deruzdevs-projects.vercel.app',
  'https://dashboard-deruzdev-deruzdevs-projects.vercel.app',
  'https://dashboard-zeta-neon-68.vercel.app',
]

const ALLOWED_ORIGINS = [
  ...DEFAULT_ALLOWED_ORIGINS,
  ...parseAllowedOrigins(process.env.DASHBOARD_ORIGIN),
].filter(Boolean) as string[]

function applyCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin')
  const isVercelPreview = origin && /^https:\/\/(jiddah-smart-report-engine-dashboard|dashboard-zeta-neon-68).*\.vercel\.app$/.test(origin)
  if (origin && (ALLOWED_ORIGINS.includes(origin) || isVercelPreview)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Vary', 'Origin')
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, X-CSRF-Token'
  )
  return response
}

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (request.method === 'OPTIONS') {
    return applyCors(request, new NextResponse(null, { status: 204 }))
  }

  return applyCors(request, NextResponse.next())
}

export const config = {
  matcher: '/api/:path*',
}
