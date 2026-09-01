type StudentRow = {
  id: string
  name: string
  admission_number?: string | null
  created_at?: string
}

/** Supabase may return a joined row as an object or single-element array. */
export function pickJoinedRow<T extends Record<string, unknown>>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export function reshapeEnrollmentRow(e: {
  id?: string
  academic_year?: number
  students?: StudentRow | StudentRow[] | null
  circular_classes?: { class_name?: string; section?: string | null } | { class_name?: string; section?: string | null }[] | null
  theology_classes?: {
    class_name_arabic?: string | null
    class_name_english?: string | null
    level?: string | null
  } | {
    class_name_arabic?: string | null
    class_name_english?: string | null
    level?: string | null
  }[] | null
}) {
  const student = pickJoinedRow(e.students as StudentRow | StudentRow[] | null | undefined)
  if (!student?.id) return null

  const circular = pickJoinedRow(
    e.circular_classes as
      | { class_name?: string; section?: string | null }
      | { class_name?: string; section?: string | null }[]
      | null
      | undefined
  )
  const theology = pickJoinedRow(
    e.theology_classes as
      | { class_name_arabic?: string | null; class_name_english?: string | null; level?: string | null }
      | { class_name_arabic?: string | null; class_name_english?: string | null; level?: string | null }[]
      | null
      | undefined
  )

  return {
    id: student.id,
    enrollment_id: e.id,
    name: student.name,
    admission_number: student.admission_number ?? '—',
    created_at: student.created_at,
    circular_class: circular?.class_name ?? '—',
    section: circular?.section ?? null,
    theology_class_arabic: theology?.class_name_arabic ?? null,
    theology_class_english: theology?.class_name_english ?? null,
    theology_level: theology?.level ?? null,
    academic_year: e.academic_year,
  }
}
