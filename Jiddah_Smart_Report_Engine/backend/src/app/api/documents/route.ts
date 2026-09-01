import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser } from '@/lib/api-server'

const BUCKET = 'documents'

function getFileType(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return `image/${extension === 'jpg' ? 'jpeg' : extension}`
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'doc') return 'application/msword'
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

export async function OPTIONS(request: NextRequest) {
  return apiOptions(request)
}

export async function GET(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const user = await getAuthenticatedUser(supabase)

    if (!user) {
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { data: objects, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 })
    if (error) {
      console.error('documents GET list error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    const files = (objects ?? []).map((object) => {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(object.name)
      const size = Number(object.metadata?.size ?? 0)

      return {
        id: object.name,
        name: object.name,
        size,
        type: getFileType(object.name),
        updated_at: object.updated_at ?? null,
        public_url: data?.publicUrl ?? null,
      }
    })

    return withCors(request, NextResponse.json({ data: files }))
  } catch (err: any) {
    console.error('documents GET exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}

export async function DELETE(request: NextRequest) {
  const preflight = corsPreflight(request)
  if (preflight) return preflight

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const user = await getAuthenticatedUser(supabase)

    if (!user) {
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await request.json()
    if (!body || typeof body.fileName !== 'string') {
      return withCors(request, NextResponse.json({ error: 'Invalid file name' }, { status: 400 }))
    }

    const { error } = await supabase.storage.from(BUCKET).remove([body.fileName])
    if (error) {
      console.error('documents DELETE remove error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ data: { success: true } }))
  } catch (err: any) {
    console.error('documents DELETE exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
