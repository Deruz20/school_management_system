
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { withCors } from '@/lib/api-cors'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return withCors(request, NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const results = {
      terms: 0,
      classes: 0,
      subjects: 0
    }

    // 1. SEED ACADEMIC TERMS
    const termsToSeed = [
      { year: 2026, term: 'beginning' },
      { year: 2026, term: 'midterm' },
      { year: 2026, term: 'endterm' },
    ]

    for (const term of termsToSeed) {
      const { data: existing } = await supabase
        .from('academic_terms')
        .select('id')
        .eq('year', term.year)
        .eq('term', term.term)

      if (!existing || existing.length === 0) {
        const { error } = await supabase.from('academic_terms').insert([term])
        if (error) throw error
        results.terms++
      }
    }

    // 2. SEED CLASSES
    const classesToSeed = [
      { class_name: 'Baby', section: 'nursery' },
      { class_name: 'Middle', section: 'nursery' },
      { class_name: 'Top', section: 'nursery' },
      { class_name: 'P.1', section: 'lower_primary' },
      { class_name: 'P.2', section: 'lower_primary' },
      { class_name: 'P.3', section: 'lower_primary' },
      { class_name: 'P.4', section: 'upper_primary' },
      { class_name: 'P.5', section: 'upper_primary' },
      { class_name: 'P.6', section: 'upper_primary' },
      { class_name: 'P.7', section: 'upper_primary' },
    ]

    for (const cls of classesToSeed) {
      const { data: existing } = await supabase
        .from('classes')
        .select('id')
        .eq('class_name', cls.class_name)
        .eq('section', cls.section)

      if (!existing || existing.length === 0) {
        const { error } = await supabase.from('classes').insert([cls])
        if (error) throw error
        results.classes++
      }
    }

    // 3. SEED SUBJECTS
    const subjectsToSeed: Array<{ subject_name: string, curriculum: string, section: string | null }> = []

    // Theology subjects (global, no section restriction)
    const theologySubjects = ['Qur\'an', 'Arabic', 'Tarbiyah', 'Fiqh', 'Islamic Studies', 'Hadith']
    theologySubjects.forEach(sub => {
      subjectsToSeed.push({ subject_name: sub, curriculum: 'theology', section: null })
    })

    // Secular subjects for each section
    const primarySections = ['nursery', 'lower_primary', 'upper_primary']
    const secularSubjects = ['English', 'Mathematics', 'Science', 'SST', 'Computer']

    primarySections.forEach(section => {
      secularSubjects.forEach(sub => {
        subjectsToSeed.push({ subject_name: sub, curriculum: 'secular', section })
      })
    })

    for (const sub of subjectsToSeed) {
      const { data: existing } = await supabase
        .from('subjects')
        .select('id')
        .eq('subject_name', sub.subject_name)
        .eq('section', sub.section)

      if (!existing || existing.length === 0) {
        const { error } = await supabase.from('subjects').insert([sub])
        if (error) throw error
        results.subjects++
      }
    }

    // 4. SEED CIRCULAR SUBJECTS
    const circularSubjectsToSeed = [
      // Nursery subjects
      { subject_name: 'English', section: 'nursery' },
      { subject_name: 'Mathematics', section: 'nursery' },
      
      // Lower Primary subjects
      { subject_name: 'English', section: 'lower_primary' },
      { subject_name: 'Mathematics', section: 'lower_primary' },
      { subject_name: 'Literacy I', section: 'lower_primary' },
      { subject_name: 'Literacy II', section: 'lower_primary' },
      
      // Upper Primary subjects
      { subject_name: 'English', section: 'upper_primary' },
      { subject_name: 'Mathematics', section: 'upper_primary' },
      { subject_name: 'Science', section: 'upper_primary' },
      { subject_name: 'Social Studies', section: 'upper_primary' },
    ]

    for (const sub of circularSubjectsToSeed) {
      const { data: existing } = await supabase
        .from('circular_subjects')
        .select('id')
        .eq('subject_name', sub.subject_name)
        .eq('section', sub.section)

      if (!existing || existing.length === 0) {
        const { error } = await supabase.from('circular_subjects').insert([sub])
        if (error) throw error
        results.subjects++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded database. Inserted: ${results.terms} Terms, ${results.classes} Classes, ${results.subjects} Subjects.`,
      results
    }, { status: 200 })

  } catch (err: any) {
    console.error('Seed error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'An error occurred during database seeding.'
    }, { status: 500 })
  }
}
