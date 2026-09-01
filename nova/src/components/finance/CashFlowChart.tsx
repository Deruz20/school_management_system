'use client';

interface MonthCashFlow {
  key: string;
  label: string;
  shortMonth: string;
  year: number;
  feesIn: string | number;
  expensesOut: string | number;
  netCashFlow: string | number;
}

interface CashFlowChartProps {
  data: MonthCashFlow[];
}

export default function CashFlowChart({ data }: CashFlowChartProps) {
  // Find highest monthly value to scale bar heights
  let maxVal = 1;
  for (const m of data) {
    const fin = typeof m.feesIn === 'string' ? parseFloat(m.feesIn) : m.feesIn;
    const exp = typeof m.expensesOut === 'string' ? parseFloat(m.expensesOut) : m.expensesOut;
    if (fin > maxVal) maxVal = fin;
    if (exp > maxVal) maxVal = exp;
  }

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0
    }).format(num || 0);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Cash Flow — Last 12 Months</h3>
          <p className="text-xs text-slate-500">Pure cash inflows (fees collected) vs cash outflows (expenses paid)</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-emerald-500 rounded-sm"></span>
            <span>Fees Collected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-rose-500 rounded-sm"></span>
            <span>Expenses Paid</span>
          </div>
        </div>
      </div>

      {/* Chart visualization */}
      <div className="h-52 flex items-end gap-2 pt-6 px-2 overflow-x-auto">
        {data.map((m) => {
          const finNum = typeof m.feesIn === 'string' ? parseFloat(m.feesIn) : m.feesIn;
          const expNum = typeof m.expensesOut === 'string' ? parseFloat(m.expensesOut) : m.expensesOut;
          const finHeight = Math.max(2, Math.round((finNum / maxVal) * 100));
          const expHeight = Math.max(2, Math.round((expNum / maxVal) * 100));

          return (
            <div key={m.key} className="flex-1 min-w-[42px] flex flex-col items-center gap-2 h-full justify-end group">
              <div className="w-full flex items-end justify-center gap-1 h-36 relative">
                {/* Tooltip on hover */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="font-bold text-emerald-300">In: {formatCurrency(finNum)}</div>
                  <div className="font-bold text-rose-300">Out: {formatCurrency(expNum)}</div>
                </div>

                {/* Fees In Bar */}
                <div
                  style={{ height: `${finNum === 0 ? 2 : finHeight}%` }}
                  className="w-1/2 bg-emerald-500 rounded-t-sm transition-all duration-300 group-hover:bg-emerald-600"
                />

                {/* Expenses Out Bar */}
                <div
                  style={{ height: `${expNum === 0 ? 2 : expHeight}%` }}
                  className="w-1/2 bg-rose-500 rounded-t-sm transition-all duration-300 group-hover:bg-rose-600"
                />
              </div>

              <div className="text-[11px] font-bold text-slate-500 text-center">
                {m.shortMonth}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
