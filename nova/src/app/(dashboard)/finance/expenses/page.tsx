import { requireAuth } from "@/lib/auth/require-auth";
import { ExpenseDAO } from "@/lib/dao/expense.dao";
import { ExpenseCategoryDAO } from "@/lib/dao/expense-category.dao";
import ExpenseList from "@/components/finance/ExpenseList";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";

export default async function ExpensesPage() {
  const ctx = await requireAuth();

  const [expensesRes, summary, categories] = await Promise.all([
    ExpenseDAO.listExpenses(ctx, { limit: 50 }),
    ExpenseDAO.getSummary(ctx),
    ExpenseCategoryDAO.list(ctx)
  ]);

  const formattedExpenses = expensesRes.expenses.map((e) => ({
    id: e.id,
    voucherNumber: e.voucherNumber,
    title: e.title,
    amount: e.amount.toString(),
    expenseDate: e.expenseDate.toISOString(),
    paymentMethod: e.paymentMethod,
    vendorName: e.vendorName,
    receiptRef: e.receiptRef,
    status: e.status,
    voidReason: e.voidReason,
    category: {
      id: e.category.id,
      name: e.category.name
    },
    createdAt: e.createdAt.toISOString()
  }));

  const formattedSummary = {
    thisMonthTotal: summary.thisMonthTotal.toString(),
    thisYearTotal: summary.thisYearTotal.toString(),
    thisMonthCount: summary.thisMonthCount,
    thisYearCount: summary.thisYearCount
  };

  const formattedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/finance" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Finance</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Receipt size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">School Expenses & Cash Outflows</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Record and audit branch expenditures, vouchers, and operational disbursements.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ExpenseList
        initialExpenses={formattedExpenses}
        initialSummary={formattedSummary}
        categories={formattedCategories}
      />
    </div>
  );
}
