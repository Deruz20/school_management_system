'use client'

import { useState } from 'react'

interface CreateTermFormProps {
  onSuccess?: () => void
}

export function CreateTermForm({ onSuccess }: CreateTermFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    term: 'beginning',
    start_date: '',
    end_date: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsLoading(true)

    try {
      const response = await fetch('/api/academic-terms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create academic term')
      }

      setSuccess(true)
      setFormData({
        year: new Date().getFullYear(),
        term: 'beginning',
        start_date: '',
        end_date: '',
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
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Add New Academic Term</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm font-medium">❌ {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-emerald-800 text-sm font-medium">✅ Academic term created successfully!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Year Input */}
          <div>
            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="year"
              name="year"
              value={formData.year}
              onChange={handleChange}
              min={2000}
              max={2100}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
            />
            <p className="text-xs text-gray-500 mt-1">E.g., 2024, 2025</p>
          </div>

          {/* Term Type Select */}
          <div>
            <label htmlFor="term" className="block text-sm font-medium text-gray-700 mb-2">
              Term Type <span className="text-red-500">*</span>
            </label>
            <select
              id="term"
              name="term"
              value={formData.term}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white"
            >
              <option value="beginning">Beginning (1st Term)</option>
              <option value="midterm">Midterm (2nd Term)</option>
              <option value="endterm">End Term (3rd Term)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Start Date */}
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date (Optional)
            </label>
            <input
              type="date"
              id="start_date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              id="end_date"
              name="end_date"
              value={formData.end_date}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition duration-200"
          >
            {isLoading ? 'Creating...' : '+ Create Academic Term'}
          </button>
        </div>
      </form>
    </div>
  )
}
