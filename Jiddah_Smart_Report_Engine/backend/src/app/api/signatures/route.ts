import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { apiOptions, corsPreflight, withCors } from '@/lib/api-cors'
import { getAuthenticatedUser, recordActivity } from '@/lib/api-server'

const BUCKET = 'signatures'

const SIGNATURE_SLOTS = [
  {
    slot_key: 'head-teacher',
    label: 'Head Teacher Signature',
    role: 'Head Teacher',
    description: 'Used on all student report cards. Must be a clear scan or photo.',
    required: true,
  },
  {
    slot_key: 'principal',
    label: 'Principal Signature',
    role: 'Principal',
    description: 'Authority signature for official reports and certificates.',
    required: true,
  },
  {
    slot_key: 'class-teacher-p3',
    label: 'Class Teacher — Primary 3',
    role: 'Class Teacher',
    description: 'Signature for Primary 3 report cards.',
    required: true,
  },
  {
    slot_key: 'class-teacher-p5',
    label: 'Class Teacher — Primary 5',
    role: 'Class Teacher',
    description: 'Signature for Primary 5 report cards.',
    required: false,
  },
  {
    slot_key: 'school-stamp',
    label: 'Official School Stamp',
    role: 'Stamp',
    description: 'School stamp image used on reports and official documents.',
    required: true,
  },
]

function buildPublicUrl(supabase: ReturnType<typeof createClient>, filePath: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
  return data?.publicUrl ?? null
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
      console.error('signatures GET list error:', error.message)
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    const uploadedBySlot = new Map<string, string>()
    for (const object of objects ?? []) {
      const matchingSlot = SIGNATURE_SLOTS.find((slot) => object.name.startsWith(`${slot.slot_key}.`))
      if (matchingSlot && !uploadedBySlot.has(matchingSlot.slot_key)) {
        uploadedBySlot.set(matchingSlot.slot_key, object.name)
      }
    }

    const slots = SIGNATURE_SLOTS.map((slot) => {
      const fileName = uploadedBySlot.get(slot.slot_key)
      const public_url = fileName ? buildPublicUrl(supabase, fileName) : null
      return {
        ...slot,
        public_url,
        uploaded: Boolean(public_url),
      }
    })

    return withCors(request, NextResponse.json({ data: slots }))
  } catch (err: any) {
    console.error('signatures GET exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}

export async function PATCH(request: NextRequest) {
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
    if (!body || typeof body !== 'object' || typeof body.slot_key !== 'string') {
      return withCors(request, NextResponse.json({ error: 'Invalid payload' }, { status: 400 }))
    }

    const slotExists = SIGNATURE_SLOTS.some((slot) => slot.slot_key === body.slot_key)
    if (!slotExists) {
      return withCors(request, NextResponse.json({ error: 'Unknown signature slot' }, { status: 400 }))
    }

    await recordActivity(supabase, user.id, 'update_signature_slot', { slot_key: body.slot_key, payload: body })
    return withCors(request, NextResponse.json({ data: { success: true } }))
  } catch (err: any) {
    console.error('signatures PATCH exception:', err)
    return withCors(request, NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 }))
  }
}
