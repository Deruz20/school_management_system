import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser, recordActivity } from '@/lib/api-server'

const BUCKET = 'signatures'
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const SLOT_KEYS = new Set([
  'head-teacher',
  'principal',
  'class-teacher-p3',
  'class-teacher-p5',
  'school-stamp',
])

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function POST(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const user = await getAuthenticatedUser(supabase)

    if (!user) {
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const slotKey = formData.get('slot_key')

    if (!(file instanceof File)) {
      return withCors(request, NextResponse.json({ error: 'No file provided' }, { status: 400 }))
    }

    if (typeof slotKey !== 'string' || !SLOT_KEYS.has(slotKey)) {
      return withCors(request, NextResponse.json({ error: 'Invalid signature slot' }, { status: 400 }))
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return withCors(request, NextResponse.json({ error: 'Unsupported image type' }, { status: 400 }))
    }

    if (file.size > MAX_FILE_SIZE) {
      return withCors(request, NextResponse.json({ error: 'Signature must be smaller than 5MB', status: 400 }))
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const filePath = `${slotKey}.${extension}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, {
      upsert: true,
    })

    if (uploadError) {
      return withCors(request, NextResponse.json({ error: uploadError.message }, { status: 500 }))
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
    const public_url = data?.publicUrl ?? null

    if (!public_url) {
      return withCors(request, NextResponse.json({ error: 'Failed to generate signature URL' }, { status: 500 }))
    }

    await recordActivity(supabase, user.id, 'upload_signature', { slot_key: slotKey, file_path: filePath })
    return withCors(request, NextResponse.json({ data: { slot_key: slotKey, public_url } }))
  } catch (err: any) {
    console.error('signatures/upload POST exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
