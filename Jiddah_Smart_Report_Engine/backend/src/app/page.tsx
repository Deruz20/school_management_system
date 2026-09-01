export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <main className="max-w-3xl w-full p-8 bg-white rounded shadow">
        <h1 className="text-2xl font-bold mb-2">Jiddah Smart Report Engine</h1>
        <p className="text-gray-700 mb-6">Welcome — pick an area to continue:</p>

        <ul className="space-y-3">
          <li>
            <a className="text-blue-600 hover:underline" href="/report_engine_dashboard">
              Reports Dashboard
            </a>
          </li>
          <li>
            <a className="text-blue-600 hover:underline" href="/jiddah-smart-report">
              Frontend App
            </a>
          </li>
          <li>
            <a className="text-blue-600 hover:underline" href="/src/lib/supabase.ts">
              Supabase helpers (src/lib/supabase.ts)
            </a>
          </li>
        </ul>

        <p className="mt-6 text-sm text-gray-500">Edit src/app/page.tsx to customize this page.</p>
      </main>
    </div>
  );
}
