/** Map Supabase/network failures to user-facing auth messages. */
export function mapAuthError(err: unknown): { message: string; status: number } {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : ''
  const message =
    err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message)
        : 'Unknown error'

  const lower = `${code} ${message}`.toLowerCase()

  if (
    lower.includes('connecttimeout') ||
    lower.includes('etimedout') ||
    lower.includes('econnrefused') ||
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('failed to fetch')
  ) {
    return {
      message:
        'Cannot reach the authentication server. Check your internet connection and Supabase project URL, then try again.',
      status: 503,
    }
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return { message: 'Invalid email or password', status: 401 }
  }

  if (
    lower.includes('email logins are disabled') ||
    lower.includes('email signups are disabled') ||
    lower.includes('signup_disabled')
  ) {
    return {
      message:
        'Email sign-in is disabled in Supabase. Open your project → Authentication → Providers and enable the Email provider.',
      status: 503,
    }
  }

  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return { message: 'An account with this email already exists. Try signing in instead.', status: 409 }
  }

  if (lower.includes('password') && lower.includes('short')) {
    return { message: 'Password must be at least 6 characters', status: 400 }
  }

  if (lower.includes('invalid api key') || lower.includes('invalid jwt')) {
    return {
      message: 'Server authentication is misconfigured. Check Supabase keys in .env.local.',
      status: 500,
    }
  }

  return { message: message || 'Authentication failed', status: 500 }
}
