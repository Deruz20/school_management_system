'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function DevToolsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSeed = async () => {
    if (!confirm('Are you sure you want to seed the database? This will insert default Terms, Classes, and Subjects.')) {
      return
    }

    setIsLoading(true)
    setSuccessMsg(null)
    setErrorMsg(null)

    try {
      const response = await fetch('/api/dev/seed', {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed database')
      }

      setSuccessMsg(data.message || 'Database seeded successfully.')
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Developer Tools</h1>
          <p className="text-gray-600 mt-1">System infrastructure and data seeding management</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden max-w-2xl">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">Database Seeding</h2>
            <p className="text-sm text-gray-600 mt-1">
              Populates the database with essential default values (Academic Terms, Classes, and Subjects) required for the system to operate.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">❌ Error: {errorMsg}</p>
              </div>
            )}
            
            {successMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-emerald-800 font-medium">✅ {successMsg}</p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">⚠️ What this does:</h4>
              <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                <li>Creates 3 default academic terms for 2026.</li>
                <li>Creates 10 default classes across Nursery, Lower Primary, and Upper Primary.</li>
                <li>Maps default Secular and Theology subjects securely to their respective sections.</li>
                <li>Safely skips any records that already exist (no duplicates).</li>
              </ul>
            </div>

            <button
              onClick={handleSeed}
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-3 px-6 rounded-lg transition duration-200 shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                  Seeding Database...
                </>
              ) : (
                '🚀 Seed Database'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
