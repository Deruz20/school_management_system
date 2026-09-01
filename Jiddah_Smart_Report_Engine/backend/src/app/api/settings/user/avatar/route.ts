import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser, recordActivity } from '@/lib/api-server'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_FILE_SIZE = 2 * 1024 * 1024
const AVATAR_BUCKET = 'user-avatars'

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
    const file = formData.get('avatar')

    if (!(file instanceof File)) {
      return withCors(request, NextResponse.json({ error: 'No avatar file provided' }, { status: 400 }))
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return withCors(request, NextResponse.json({ error: 'Unsupported image type' }, { status: 400 }))
    }

    if (file.size > MAX_FILE_SIZE) {
      return withCors(request, NextResponse.json({ error: 'Avatar must be smaller than 2MB' }, { status: 400 }))
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const filePath = `avatars/${user.id}.${extension}`

    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, file, {
      upsert: true,
    })

    if (uploadError) {
      return withCors(request, NextResponse.json({ error: uploadError.message }, { status: 500 }))
    }

    const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath)
    if (!publicData?.publicUrl) {
      return withCors(request, NextResponse.json({ error: 'Failed to generate avatar URL' }, { status: 500 }))
    }

    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: {
        avatar_url: publicData.publicUrl,
      },
    })

    if (authUpdateError) {
      return withCors(request, NextResponse.json({ error: authUpdateError.message }, { status: 500 }))
    }

    await recordActivity(supabase, user.id, 'upload_avatar', { avatar_url: publicData.publicUrl })
    return withCors(request, NextResponse.json({ data: { avatar_url: publicData.publicUrl } }))
  } catch (err: any) {
    console.error('settings/user/avatar POST exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
