"use client";

import { format } from "date-fns";

export default function AuditClient({ initialLogs }: { initialLogs: (import('@prisma/client').AuditLog & { user: { firstName: string; lastName: string; email: string | null; } | null })[] }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-300">
          <thead className="bg-slate-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Timestamp</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">User</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Action</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Resource</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {initialLogs.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-slate-500 sm:pl-6">
                  {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                </td>
                <td className="whitespace-nowrap py-4 px-3 text-sm text-slate-900 font-medium">
                  {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                </td>
                <td className="whitespace-nowrap py-4 px-3 text-sm text-slate-500">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                    {log.action}
                  </span>
                </td>
                <td className="whitespace-nowrap py-4 px-3 text-sm text-slate-500">
                  {log.resourceType} {log.resourceId ? `(${log.resourceId.slice(0, 8)}...)` : ''}
                </td>
                <td className="py-4 px-3 text-sm text-slate-500 max-w-xs truncate" title={log.details || ''}>
                  {log.details || '-'}
                </td>
              </tr>
            ))}
            {initialLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-sm text-slate-500">No audit logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
