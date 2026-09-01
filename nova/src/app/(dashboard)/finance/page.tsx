import { requireAuth } from "@/lib/auth/require-auth";
import { FeeStructureDAO } from "@/lib/dao/fee-structure.dao";
import { FeeTypeDAO } from "@/lib/dao/fee-type.dao";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";
import { DiscountDAO } from "@/lib/dao/discount.dao";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tag, Layers, ArrowRight, FileText, Award } from "lucide-react";

export default async function FinancePage() {
  const ctx = await requireAuth();

  const [feeTypes, feeStructures, invoices, discounts] = await Promise.all([
    FeeTypeDAO.list(ctx),
    FeeStructureDAO.list(ctx),
    InvoiceDAO.list(ctx),
    DiscountDAO.list(ctx)
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finance & Billing</h1>
        <p className="text-slate-500 mt-1">
          Manage fee catalogs, blueprints, class structures, student bursaries, and billing invoices.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
}
