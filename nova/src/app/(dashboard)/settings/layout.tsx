import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const tenantCtx = await requireAuth();
  const isAdmin = tenantCtx.permissions.includes('all');

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <Link
            href="/settings"
            className="border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
          >
            General
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/settings/roles"
                className="border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
              >
                Roles & Permissions
              </Link>
              <Link
                href="/settings/users"
                className="border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
              >
                Branch Users
              </Link>
              <Link
                href="/settings/audit"
                className="border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
              >
                Audit Logs
              </Link>
            </>
          )}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  );
}
