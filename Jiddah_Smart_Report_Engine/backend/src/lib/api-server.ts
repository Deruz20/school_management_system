import type { SupabaseClient } from '@supabase/supabase-js'

export const normalizeString = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\u0000/g, '').replace(/\s+/g, ' ')
}

export const normalizePhone = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const sanitized = value.trim().replace(/[^\d+]/g, '')
  return sanitized.replace(/^00/, '+')
}

export const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export const isNumericId = (value: string): boolean => {
  return /^[0-9]+$/.test(value)
}

export const isValidUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return null
  }
  return data.user
}

export async function recordActivity(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  metadata: unknown = null
) {
  try {
    const payload = {
      user_id: userId,
      action,
      metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
      created_at: new Date().toISOString(),
    }

    await supabase.from('activity_logs').insert([payload])
  } catch {
    // Ignore activity log failures so primary API operations still succeed.
  }
}
