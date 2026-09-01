export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome to NOVA. Here&apos;s what&apos;s happening today.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Students" value="1,248" trend="+12% from last term" />
        <MetricCard title="Attendance Today" value="96.4%" trend="-0.2% from yesterday" />
        <MetricCard title="Fees Collected" value="$42,500" trend="+8% vs target" />
        <MetricCard title="Active Staff" value="84" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            Activity feed will appear here.
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Events</h2>
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            No events scheduled.
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend }: { title: string; value: string; trend?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <div className="mt-2 flex flex-col gap-1">
        <span className="text-3xl font-bold tracking-tight text-slate-900">{value}</span>
        {trend && <span className="text-xs font-medium text-emerald-600">{trend}</span>}
      </div>
    </div>
  );
}
