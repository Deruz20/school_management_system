import Link from 'next/link'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-emerald-900">
            Jiddah Smart Report - Mission Control
          </h1>
          <p className="text-gray-600 mt-1">School Management & Academic Reporting System</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Navigation</h2>
              <nav className="space-y-2">
                <Link
                  href="/admin"
                  className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                >
                  Dashboard
                </Link>

                <Link
                  href="/admin/students"
                  className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                >
                  Students
                </Link>

                <div className="space-y-1">
                  <div className="px-3 py-1 text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Academics
                  </div>
                  <Link
                    href="/admin/marks"
                    className="block px-6 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm font-medium"
                  >
                    Marks Entry
                  </Link>
                  <Link
                    href="/admin/terms"
                    className="block px-6 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm font-medium"
                  >
                    Terms
                  </Link>
                </div>

                <div className="space-y-1">
                  <div className="px-3 py-1 text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Reports
                  </div>
                  <Link
                    href="/admin/reports"
                    className="block px-6 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm"
                  >
                    Report Generator
                  </Link>
                </div>

                <div className="border-t border-gray-100 pt-2 mt-2">
                  <div className="px-3 py-1 text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Settings
                  </div>
                  <Link
                    href="/admin/settings"
                    className="block px-6 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm"
                  >
                    ⚙ Term Dates
                  </Link>
                </div>
              </nav>
            </div>
          </div>

          {/* Main Dashboard Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
              <p className="text-gray-600">
                Welcome to the School Report System. Use the navigation sidebar to manage students,
                enter marks for Circular and Theology subjects, and generate reports.
              </p>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900">Circular Department</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    English subjects with A-E grading system
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-900">Theology Department</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Arabic subjects with Islamic grading system
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <h3 className="font-medium text-emerald-900">Generate Reports</h3>
                  <p className="text-sm text-emerald-700 mt-1">
                    Create printable report cards for selected students and terms.</p>
                  <div className="mt-4">
                    <Link
                      href="/admin/reports"
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      Open Report Generator
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
