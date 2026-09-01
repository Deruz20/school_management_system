import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { CreateStudentForm } from '@/components/CreateStudentForm'
import { StudentsListClient } from '@/components/StudentsListClient'

export default async function StudentsManagementPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      academic_year,
      is_active,
      circular_classes ( id, class_name, section ),
      theology_classes ( id, class_name_arabic, class_name_english ),
      students ( id, name, admission_number, created_at )
    `)
    .eq('is_active', true)
    .order('academic_year', { ascending: false })

  const students = (enrollments || []).map((e: any) => ({
    id: e.students.id,
    name: e.students.name,
    admission_number: e.students.admission_number ?? '—',
    created_at: e.students.created_at,
    circular_class: e.circular_classes?.class_name ?? '—',
    section: e.circular_classes?.section ?? null,
    theology_class_arabic: e.theology_classes?.class_name_arabic ?? null,
    theology_class_english: e.theology_classes?.class_name_english ?? null,
    academic_year: e.academic_year,
  }))

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Students Management</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Add New Student</h2>
        <CreateStudentForm />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-3xl font-bold text-emerald-600 mb-2">{students.length}</div>
          <p className="text-sm text-gray-600">Total registered students</p>
        </div>

        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
          <h4 className="text-sm font-semibold text-emerald-900 mb-3">📋 Registration Tips</h4>
          <ul className="text-xs text-emerald-700 space-y-2">
            <li>• Use the auto-generator for standardized admission numbers.</li>
            <li>• Admission numbers must be completely unique.</li>
            <li>• Ensure classes are created before registering students.</li>
          </ul>
        </div>
      </div>

      <div className="mt-12">
        <StudentsListClient students={students} />
      </div>
    </div>
  )
}
