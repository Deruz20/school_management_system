import Link from "next/link";
import { Users, BookOpen, CreditCard, Settings, LayoutDashboard, Receipt, BarChart3, TrendingDown } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen shrink-0 sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
        <div className="font-bold text-xl text-white tracking-tight">NOVA</div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <div className="pt-4 pb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Academics
          </div>
          <Link href="/students" className="flex items-center gap-3 px-3 py-2 rounded-md bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors">
            <Users size={20} />
            <span>Students</span>
          </Link>
          <Link href="/attendance" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <BookOpen size={20} />
            <span>Attendance</span>
          </Link>
          <div className="pt-4 pb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Curriculum
          </div>
          <Link href="/curriculum/subjects" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <BookOpen size={20} />
            <span>Subjects</span>
          </Link>
          <Link href="/curriculum/combinations" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <BookOpen size={20} />
            <span>Combinations</span>
          </Link>
          <Link href="/curriculum/classes" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <BookOpen size={20} />
            <span>Class Subjects</span>
          </Link>
          <div className="pt-4 pb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Operations &amp; Finance
          </div>
          <Link href="/staff" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <Users size={20} />
            <span>Staff / HR</span>
          </Link>
          <Link href="/finance/payments" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <Receipt size={20} />
            <span>Fee Payments</span>
          </Link>
          <Link href="/finance/ledger" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <CreditCard size={20} />
            <span>Student Subledger</span>
          </Link>
          <Link href="/finance/invoices" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <CreditCard size={20} />
            <span>Invoices</span>
          </Link>
          <Link href="/finance/expenses" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <TrendingDown size={20} />
            <span>Expenses</span>
          </Link>
          <Link href="/finance/reports" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <BarChart3 size={20} />
            <span>Financial Reports</span>
          </Link>
          <Link href="/finance/discounts" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <CreditCard size={20} />
            <span>Bursaries / Discounts</span>
          </Link>
          <Link href="/finance/fee-structures" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <CreditCard size={20} />
            <span>Fee Structures</span>
          </Link>
          <Link href="/finance/fee-types" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <CreditCard size={20} />
            <span>Fee Types</span>
          </Link>
          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <Settings size={20} />
            <span>Settings</span>
          </Link>
        </nav>
      </div>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm text-white">
            JD
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">John Doe</span>
            <span className="text-xs text-slate-500">Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
