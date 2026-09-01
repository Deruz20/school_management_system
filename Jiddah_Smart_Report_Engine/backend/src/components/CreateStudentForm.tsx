'use client'

import { useEffect, useState } from 'react'

interface CircularClass {
  id: string
  class_name: string
  section: string
}

interface TheologyClass {
  id: string
  class_name_arabic: string
  class_name_english: string
  level?: string
}

type Section = 'nursery' | 'lower_primary' | 'upper_primary' | ''
type TheologySection = 'raudha' | 'ibtidaai_lower' | 'ibtidaai_upper' | ''

const SECTION_LABELS: Record<Section, string> = {
  nursery: 'Nursery',
  lower_primary: 'Lower Primary',
  upper_primary: 'Upper Primary',
  '': '',
}

const THEOLOGY_SECTION_LABELS: Record<TheologySection, string> = {
  raudha: 'الروضة',
  ibtidaai_lower: 'الابتدائية السفلى',
  ibtidaai_upper: 'الابتدائية العليا',
  '': '',
}

// Generate admission number
function generateAdmissionNumber(year: number = new Date().getFullYear()): string {
  const randomFourDigits = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `JINPS-${year}-${randomFourDigits}`
}

export function CreateStudentForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const [circularClasses, setCircularClasses] = useState<CircularClass[]>([])
  const [theologyClasses, setTheologyClasses] = useState<TheologyClass[]>([])

  const [formData, setFormData] = useState({
    name: '',
    gender: '' as 'male' | 'female' | '',
    arabic_name: '',
    admission_number: generateAdmissionNumber(),
    section: '' as Section,
    circular_class_id: '',
    theology_section: '' as TheologySection,
    theology_class_id: '',
    academic_year: new Date().getFullYear(),
  })

  // Fetch circular and theology classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setIsFetching(true)
        const [circularRes, theologyRes] = await Promise.all([
          fetch('/api/classes'),
          fetch('/api/theology-classes'),
        ])

        if (!circularRes.ok || !theologyRes.ok) {
          throw new Error('Failed to fetch classes')
        }

        const circularData = await circularRes.json()
        const theologyData = await theologyRes.json()

        setCircularClasses(circularData.data || [])
        setTheologyClasses(theologyData.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch classes')
      } finally {
        setIsFetching(false)
      }
    }

    fetchClasses()
  }, [])

  // Group theology classes by name (robust filtering that works regardless of DB level/section field values)
  const raudhaClasses = theologyClasses.filter((c) =>
    ['الروضة السفلى', 'الروضة الوسطى', 'الروضة العليا'].includes(c.class_name_arabic)
  )
  const lowerClasses = theologyClasses.filter((c) =>
    ['الصف الأول', 'الصف الثاني', 'الصف الثالث'].includes(c.class_name_arabic)
  )
  const upperClasses = theologyClasses.filter((c) =>
    ['الصف الرابع', 'الصف الخامس', 'الصف السادس', 'الصف السابع'].includes(c.class_name_arabic)
  )

  const theologyClassesBySection = {
    raudha: raudhaClasses,
    ibtidaai_lower: lowerClasses,
    ibtidaai_upper: upperClasses,
  }

  // Filter theology classes by selected section
  const classesForTheologySection = formData.theology_section && formData.theology_section in theologyClassesBySection
    ? theologyClassesBySection[formData.theology_section as keyof typeof theologyClassesBySection]
    : []

  // Get circular classes for selected section
  const classesForSection = circularClasses.filter((c) => c.section === formData.section)

  // Get selected circular class info
  const selectedClass = circularClasses.find((c) => c.id === formData.circular_class_id)
  const isPSevenSelected = selectedClass?.class_name === 'P.7'

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }))
    setValidationError(null)
  }

  const handleRegenerateAdmission = () => {
    setFormData((prev) => ({ ...prev, admission_number: generateAdmissionNumber(prev.academic_year) }))
  }

  const handleSectionChange = (section: Section) => {
    setFormData((prev) => ({
      ...prev,
      section,
      circular_class_id: '',
      theology_class_id: '',
    }))
    setValidationError(null)
  }

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      circular_class_id: e.target.value,
      theology_class_id: '',
      theology_section: '',
    }))
    setValidationError(null)
  }

  const handleTheologySectionChange = (section: TheologySection) => {
    setFormData((prev) => ({
      ...prev,
      theology_section: section,
      theology_class_id: '',
    }))
    setValidationError(null)
  }

  const handleTheologyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      theology_class_id: e.target.value,
    }))
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const year = parseInt(e.target.value)
    setFormData((prev) => ({
      ...prev,
      academic_year: year,
      admission_number: generateAdmissionNumber(year),
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setValidationError(null)
    setSuccess(false)

    // Validation
    if (!formData.name.trim()) {
      setValidationError('Student name is required')
      return
    }

    if (!formData.gender) {
      setValidationError('Gender is required')
      return
    }

    if (!formData.admission_number.trim()) {
      setValidationError('Admission number is required')
      return
    }

    if (!formData.circular_class_id) {
      setValidationError('Circular class is required')
      return
    }

    if (!isPSevenSelected && !formData.theology_class_id) {
      setValidationError('Theology class is required for non-P.7 students')
      return
    }

    setIsLoading(true)

    try {
      const payload = {
        name: formData.name.trim(),
        arabic_name: formData.arabic_name.trim() || null,
        gender: formData.gender || null,
        admission_number: formData.admission_number.trim(),
        circular_class_id: formData.circular_class_id,
        theology_class_id: formData.theology_class_id || null,
        academic_year: formData.academic_year,
      }

      const response = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create student')
      }

      setSuccess(true)
      setFormData({
        name: '',
        gender: '',
        arabic_name: '',
        admission_number: generateAdmissionNumber(),
        section: '',
        circular_class_id: '',
        theology_section: '',
        theology_class_id: '',
        academic_year: new Date().getFullYear(),
      })
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Determine current step
  let currentStep = 1
  if (formData.name.trim()) currentStep = 2
  if (formData.section) currentStep = 3
  if (formData.circular_class_id) currentStep = 4
  const totalSteps = 4

  if (isFetching) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <div className="space-y-4">
          <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-2xl mx-auto">
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Register New Student</h2>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 h-1 rounded-full transition-colors ${
                idx + 1 <= currentStep ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Student Name & Admission Number */}
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-3">
            Step 1: Student Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={handleNameChange}
            placeholder="Enter full name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        {/* Arabic Name */}
        {formData.name.trim() && (
          <div className="space-y-3 transition-all duration-300">
            <label htmlFor="arabic_name" className="block text-sm font-semibold text-gray-900">
              Arabic Name (اسم الطالب/ة بالعربية) <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              id="arabic_name"
              value={formData.arabic_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, arabic_name: e.target.value }))}
              placeholder="e.g. يوسف موتيبي"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              dir="rtl"
            />
          </div>
        )}

        {/* Gender Selection */}
        {formData.name.trim() && (
          <div className="space-y-3 transition-all duration-300">
            <label className="block text-sm font-semibold text-gray-900">Gender</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map((genderOption) => (
                <button
                  key={genderOption}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, gender: genderOption }))}
                  className={`p-3 rounded-lg border-2 transition font-medium ${
                    formData.gender === genderOption
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-300'
                  }`}
                >
                  {genderOption === 'male' ? 'Male' : 'Female'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Admission Number */}
        {formData.name.trim() && (
          <div className="space-y-3 transition-all duration-300">
            <label htmlFor="admission_number" className="block text-sm font-semibold text-gray-900">
              Admission Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="admission_number"
                value={formData.admission_number}
                onChange={(e) => setFormData((prev) => ({ ...prev, admission_number: e.target.value }))}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
              />
              <button
                type="button"
                onClick={handleRegenerateAdmission}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition"
              >
                Regenerate
              </button>
            </div>
            <p className="text-xs text-gray-500">Auto-generated admission number (editable)</p>
          </div>
        )}

        {/* Step 2: Section Selection */}
        {formData.name.trim() && (
          <div className="space-y-4 transition-all duration-300">
            <label className="block text-sm font-semibold text-gray-900 mb-4">
              Step 2: Select Section
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['nursery', 'lower_primary', 'upper_primary'] as Section[]).map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => handleSectionChange(section)}
                  className={`p-4 rounded-lg border-2 transition ${
                    formData.section === section
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{SECTION_LABELS[section]}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {section === 'nursery' && 'Baby, Middle, Top'}
                    {section === 'lower_primary' && 'P.1, P.2, P.3'}
                    {section === 'upper_primary' && 'P.4, P.5, P.6, P.7'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Circular Class */}
        {formData.section && (
          <div className="space-y-4 transition-all duration-300">
            <label htmlFor="circular_class_id" className="block text-sm font-semibold text-gray-900 mb-3">
              Step 3: Select Circular Class
            </label>
            <select
              id="circular_class_id"
              value={formData.circular_class_id}
              onChange={handleClassChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
            >
              <option value="">Choose a class...</option>
              {classesForSection.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Step 4: Theology Section (if not P.7) */}
        {formData.circular_class_id && !isPSevenSelected && (
          <div className="space-y-4 transition-all duration-300">
            <label className="block text-sm font-semibold text-gray-900 mb-4">
              Step 4A: Select Theology Section
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['raudha', 'ibtidaai_lower', 'ibtidaai_upper'] as TheologySection[]).map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => handleTheologySectionChange(section)}
                  className={`p-4 rounded-lg border-2 transition ${
                    formData.theology_section === section
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                  }`}
                  dir="rtl"
                >
                  <div className="font-semibold text-gray-900">{THEOLOGY_SECTION_LABELS[section]}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {section === 'raudha' && 'السفلى، الوسطى، العليا'}
                    {section === 'ibtidaai_lower' && 'الصف الأول - الثالث'}
                    {section === 'ibtidaai_upper' && 'الصف الرابع - السابع'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4B: Theology Class (after section selected) */}
        {formData.theology_section && !isPSevenSelected && (
          <div className="space-y-4 transition-all duration-300">
            <label htmlFor="theology_class_id" className="block text-sm font-semibold text-gray-900 mb-3">
              Step 4B: Select Theology Class
            </label>
            <select
              id="theology_class_id"
              value={formData.theology_class_id}
              onChange={handleTheologyChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
              dir="rtl"
            >
              <option value="">اختر فصل اللاهوت...</option>
              {classesForTheologySection.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name_arabic}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              ℹ Theology class level is independent of circular class level
            </p>
          </div>
        )}

        {/* P.7 Notice */}
        {isPSevenSelected && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              ✓ P.7 students do not have theology class enrollment.
            </p>
          </div>
        )}

        {/* Academic Year */}
        {formData.circular_class_id && (
          <div className="space-y-4 transition-all duration-300">
            <label htmlFor="academic_year" className="block text-sm font-semibold text-gray-900 mb-3">
              Academic Year
            </label>
            <input
              type="number"
              id="academic_year"
              value={formData.academic_year}
              onChange={handleYearChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              min="2020"
              max="2099"
            />
            <p className="text-xs text-gray-500">Admission number updates with year change</p>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {validationError && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-sm">
            {validationError}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            ✓ Student registered successfully!
          </div>
        )}

        {/* Submit Button */}
        {formData.circular_class_id && (
          <div className="pt-4 transition-all duration-300">
            <button
              type="submit"
              disabled={isLoading || (!isPSevenSelected && !formData.theology_class_id)}
              className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition"
            >
              {isLoading ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
