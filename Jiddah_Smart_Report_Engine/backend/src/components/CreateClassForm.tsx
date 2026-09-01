'use client'

import { useState } from 'react'

interface CreateClassFormProps {
  onSuccess?: () => void
}

export function CreateClassForm({ onSuccess }: CreateClassFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    class_name: '',
    section: 'nursery', // Default to nursery
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
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create class')
      }

      setSuccess(true)
      setFormData({
        class_name: '',
        section: 'nursery',
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
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Add New Class</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm font-medium">❌ {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-emerald-800 text-sm font-medium">✅ Class created successfully!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Class Name Input */}
          <div>
            <label htmlFor="class_name" className="block text-sm font-medium text-gray-700 mb-2">
              Class Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="class_name"
              name="class_name"
              value={formData.class_name}
              onChange={handleChange}
              placeholder="e.g., Baby, Middle, P1"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
            />
            <p className="text-xs text-gray-500 mt-1">
              Standard format: Baby, Middle, Top, or P1, P2...
            </p>
          </div>

          {/* Section Select */}
          <div>
            <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-2">
              Section <span className="text-red-500">*</span>
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
            {isLoading ? 'Creating...' : '+ Create Class'}
          </button>
        </div>
      </form>
    </div>
  )
}
