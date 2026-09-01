/** Shared Supabase env helpers — supports legacy anon (eyJ…) and publishable (sb_publishable_…) keys. */

export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export type SupabaseKeyFormat = 'publishable' | 'anon_jwt' | 'missing' | 'invalid'

export function detectSupabaseKeyFormat(key: string | undefined): SupabaseKeyFormat {
  if (!key?.trim()) return 'missing'
  if (key.startsWith('sb_publishable_')) return 'publishable'
  if (key.startsWith('eyJ')) return 'anon_jwt'
  if (key.startsWith('sb_secret_')) return 'invalid'
  return 'invalid'
}

export function validateSupabaseEnv(): {
  ok: boolean
  url?: string
  keyFormat: SupabaseKeyFormat
  error?: string
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = getSupabaseAnonKey()?.trim()
  const keyFormat = detectSupabaseKeyFormat(key)

  if (!url) {
    return { ok: false, keyFormat, error: 'Missing NEXT_PUBLIC_SUPABASE_URL in .env.local' }
  }

  if (keyFormat === 'missing') {
    return {
      ok: false,
      keyFormat,
      error:
        'Missing Supabase anon/publishable key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY (eyJ…) or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_…) in .env.local',
    }
  }

  if (keyFormat === 'invalid') {
    return {
      ok: false,
      keyFormat,
      error:
        'Invalid Supabase key format. Use the public anon key (eyJ…) or publishable key (sb_publishable_…), not a secret/service key.',
    }
  }

  return { ok: true, url, keyFormat }
}
