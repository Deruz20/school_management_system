import { requireAuth } from "@/lib/auth/require-auth";
import { FeeStructureDAO } from "@/lib/dao/fee-structure.dao";
import { FeeTypeDAO } from "@/lib/dao/fee-type.dao";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";
import { DiscountDAO } from "@/lib/dao/discount.dao";
import { PaymentDAO } from "@/lib/dao/payment.dao";
import { ExpenseDAO } from "@/lib/dao/expense.dao";
import { SchoolPayDAO } from "@/lib/dao/schoolpay.dao";
import { PayrollDAO } from "@/lib/dao/payroll.dao";
import { BudgetDAO } from "@/lib/dao/budget.dao";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tag, Layers, ArrowRight, FileText, Award, Receipt, CreditCard, BarChart3, TrendingDown, Wifi, Banknote, Scale } from "lucide-react";

export default async function FinancePage() {
  const ctx = await requireAuth();

  const [feeTypes, feeStructures, invoices, discounts, paymentsData, expenseSummary, schoolPayStats, payrollRuns, budgets] = await Promise.all([
    FeeTypeDAO.list(ctx),
    FeeStructureDAO.list(ctx),
    InvoiceDAO.list(ctx),
    DiscountDAO.list(ctx),
    PaymentDAO.listPayments(ctx, { limit: 100 }),
    ExpenseDAO.getSummary(ctx),
    SchoolPayDAO.getStats(ctx),
    PayrollDAO.listPayrollRuns(ctx, { limit: 5 }),
    BudgetDAO.listBudgets(ctx)
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finance, Billing &amp; Subledger</h1>
        <p className="text-slate-500 mt-1">
          Collect fee payments, issue official receipts, inspect student subledgers, manage bursaries, and generate invoices.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Fee Payments Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Receipt size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Fee Payments &amp; Receipts</h2>
            <p className="text-sm text-slate-500">
              Collect fees via MoMo, Bank, SchoolPay, or Cash with automatic FIFO invoice settlement.
            </p>
            <div className="pt-2 text-2xl font-bold text-slate-900 font-mono">
              {paymentsData.pagination.total}{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">payments recorded</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/payments/new">
              <Button size="sm" variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                Record Payment
              </Button>
            </Link>
            <Link href="/finance/payments" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              <span>View All</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Student Subledger Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CreditCard size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Student Subledger</h2>
            <p className="text-sm text-slate-500">
              Authoritative accounts receivable journal, running student balances, opening arrears, and statements.
            </p>
            <div className="pt-2 text-2xl font-bold text-teal-700 font-mono">
              AR Subledger{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">single source of truth</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/ledger">
              <Button size="sm" variant="outline">
                Open Subledger
              </Button>
            </Link>
            <Link href="/finance/ledger" className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700">
              <span>View Statements</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        {/* Invoices Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Student Invoices</h2>
            <p className="text-sm text-slate-500">
              Generate bulk class invoices, issue individual student bills, and manage billing lifecycles.
            </p>
            <div className="pt-2 text-2xl font-bold text-slate-900 font-mono">
              {invoices.length}{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">invoices issued</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex gap-2">
              <Link href="/finance/invoices/bulk">
                <Button size="sm" variant="outline">
                  Bulk Billing
                </Button>
              </Link>
              <Link href="/finance/invoices/new">
                <Button size="sm" variant="outline">
                  New Invoice
                </Button>
              </Link>
            </div>
            <Link href="/finance/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              <span>View All</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Discounts & Bursaries Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Discounts &amp; Bursaries</h2>
            <p className="text-sm text-slate-500">
              Configure student bursaries, staff child concessions, and academic merit percentage or fixed discounts.
            </p>
            <div className="pt-2 text-2xl font-bold text-slate-900 font-mono">
              {discounts.length}{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">active rules</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/discounts">
              <Button size="sm" variant="outline">
                Manage Bursaries
              </Button>
            </Link>
            <Link href="/finance/discounts" className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700">
              <span>View All</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Fee Structures Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Fee Structures</h2>
            <p className="text-sm text-slate-500">
              Configure composite fee blueprints for classes, academic years, and terms with itemized fee heads.
            </p>
            <div className="pt-2 text-2xl font-bold text-slate-900 font-mono">
              {feeStructures.length}{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">configured</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/fee-structures/new">
              <Button size="sm" variant="outline">
                New Structure
              </Button>
            </Link>
            <Link href="/finance/fee-structures" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
              <span>View All</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Fee Types Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Tag size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Fee Types Catalog</h2>
            <p className="text-sm text-slate-500">
              Maintain the catalog of branch fee heads (e.g. Tuition, Development Levy, Boarding, Uniform).
            </p>
            <div className="pt-2 text-2xl font-bold text-slate-900 font-mono">
              {feeTypes.length}{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">fee heads</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/fee-types">
              <Button size="sm" variant="outline">
                Manage Types
              </Button>
            </Link>
            <Link href="/finance/fee-types" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              <span>View Catalog</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Expenses & Outflows Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">School Expenses</h2>
            <p className="text-sm text-slate-500">
              Track operational disbursements, vouchers, utilities, and branch expenditure categories.
            </p>
            <div className="pt-2 text-2xl font-bold text-rose-600 font-mono">
              {expenseSummary.thisMonthCount}{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">vouchers this month</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/expenses">
              <Button size="sm" variant="outline" className="bg-rose-50 text-rose-700 hover:bg-rose-100">
                Manage Expenses
              </Button>
            </Link>
            <Link href="/finance/expenses" className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700">
              <span>View All</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Financial Reports & Analytics Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Financial Reports &amp; Analytics</h2>
            <p className="text-sm text-slate-500">
              Executive collection rates, class summaries, 12-month net cash flow, and top debtor defaulters.
            </p>
            <div className="pt-2 text-2xl font-bold text-emerald-700 font-mono">
              Executive Analytics{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">real-time reporting</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/reports">
              <Button size="sm" variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                Open Analytics
              </Button>
            </Link>
            <Link href="/finance/reports" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              <span>View Reports</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* SchoolPay Uganda Reconciliation Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wifi size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">SchoolPay Reconciliation</h2>
            <p className="text-sm text-slate-500">
              Automated webhook ingestion, student payment code matching, and real-time FIFO ledger settlement.
            </p>
            <div className="pt-2 text-2xl font-bold text-emerald-700 font-mono">
              {schoolPayStats.needsReviewCount > 0 ? (
                <span className="text-amber-600">{schoolPayStats.needsReviewCount} in review</span>
              ) : (
                <span>{schoolPayStats.postedCount} posted</span>
              )}{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">
                ({schoolPayStats.totalLinkedStudents}/{schoolPayStats.totalActiveStudents} students linked)
              </span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/schoolpay">
              <Button size="sm" variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                Open Reconciliation
              </Button>
            </Link>
            <Link href="/finance/schoolpay" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              <span>View Gateway</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Staff Payroll & Compensation Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Banknote size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Staff Payroll &amp; Salaries</h2>
            <p className="text-sm text-slate-500">
              Monthly staff salary calculation, Uganda NSSF (5%/10%), URA PAYE tax schedules, bank exports, and payslips.
            </p>
            <div className="pt-2 text-2xl font-bold text-emerald-800 font-mono">
              {payrollRuns.length}{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">payroll runs recorded</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/payroll">
              <Button size="sm" variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                Open Payroll
              </Button>
            </Link>
            <Link href="/finance/payroll" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              <span>View Runs</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* School Budgets & Vote Heads Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Scale size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">School Budgets &amp; Vote Heads</h2>
            <p className="text-sm text-slate-500">
              Annual &amp; termly school budgets, vote head expense ceilings, revenue realization targets, and live variance.
            </p>
            <div className="pt-2 text-2xl font-bold text-emerald-800 font-mono">
              {budgets.length}{' '}
              <span className="text-xs font-normal text-slate-500 font-sans">budgets on record</span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link href="/finance/budgets">
              <Button size="sm" variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                Manage Budgets
              </Button>
            </Link>
            <Link href="/finance/budgets" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              <span>Open Hub</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
