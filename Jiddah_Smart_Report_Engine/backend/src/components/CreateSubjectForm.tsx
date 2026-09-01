'use client'

import { useState } from 'react'

interface CreateSubjectFormProps {
  onSuccess?: () => void
}

export function CreateSubjectForm({ onSuccess }: CreateSubjectFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    subject_name: '',
    curriculum: 'secular', // Default to secular
    section: 'lower_primary', // Default
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsLoading(true)

    try {
      const response = await fetch('/api/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subject')
      }

      setSuccess(true)
      setFormData({
        subject_name: '',
        curriculum: formData.curriculum, // Persist selection for quicker data entry
        section: formData.section, // Persist selection for quicker data entry
      })

      onSuccess?.()

      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Add New Subject</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm font-medium">❌ {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-emerald-800 text-sm font-medium">✅ Subject created successfully!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          {/* Subject Name Input */}
          <div>
            <label htmlFor="subject_name" className="block text-sm font-medium text-gray-700 mb-2">
              Subject Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="subject_name"
              name="subject_name"
              value={formData.subject_name}
              onChange={handleChange}
              placeholder="e.g., Mathematics, Quran, English"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Curriculum Type Select */}
          <div>
            <label htmlFor="curriculum" className="block text-sm font-medium text-gray-700 mb-2">
              Curriculum Type <span className="text-red-500">*</span>
            </label>
            <select
              id="curriculum"
              name="curriculum"
              value={formData.curriculum}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white"
            >
              <option value="secular">Secular</option>
              <option value="theology">Theology</option>
            </select>
          </div>

          {/* Section Select */}
          <div>
            <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-2">
              Target Section <span className="text-red-500">*</span>
            </label>
            <select
              id="section"
              name="section"
              value={formData.section}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white"
            >
              <option value="nursery">Nursery</option>
              <option value="lower_primary">Lower Primary</option>
              <option value="upper_primary">Upper Primary</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition duration-200"
          >
            {isLoading ? 'Creating...' : '+ Create Subject'}
          </button>
        </div>
      </form>
    </div>
  )
}
