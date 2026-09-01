import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser } from '@/lib/api-server'

const BUCKET = 'documents'
const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_FILE_SIZE = 10 * 1024 * 1024

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

    if (!(file instanceof File)) {
      return withCors(request, NextResponse.json({ error: 'No file provided' }, { status: 400 }))
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return withCors(request, NextResponse.json({ error: 'Unsupported file type' }, { status: 400 }))
    }

    if (file.size > MAX_FILE_SIZE) {
      return withCors(request, NextResponse.json({ error: 'File must be smaller than 10MB', status: 400 }))
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'dat'
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${Date.now()}-${sanitizedName}`

    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, {
      upsert: true,
    })

    if (error) {
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ data: { fileName: filePath } }))
  } catch (err: any) {
    console.error('documents/upload POST exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
