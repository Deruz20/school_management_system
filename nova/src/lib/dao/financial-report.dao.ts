import { db } from "../db";
import { Prisma, PaymentStatus, ExpenseStatus, AllocationStatus, InvoiceStatus, LedgerDirection } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";

export interface ReportFilterParams {
  academicYearId?: string;
  termId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

export interface DebtorsFilterParams {
  classId?: string;
  minBalance?: number | string;
  search?: string;
  page?: number;
  limit?: number;
}

export class FinancialReportDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:read') ||
      perms.includes('fees:reports:read') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:reports:read");
  }

  private static checkExportPermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:debtors:export') ||
      perms.includes('fees:reports:read') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing permission: fees:debtors:export");
  }

  /**
   * Top-Level Executive Financial KPI Summary.
   */
  static async getExecutiveSummary(ctx: TenantContext, filters: ReportFilterParams = {}) {
    this.checkReadPermission(ctx);

    // 1. Invoices query (Accrual basis)
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      branchId: ctx.branchId,
      status: { not: InvoiceStatus.VOID },
      ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
      ...(filters.termId ? { termId: filters.termId } : {})
    };

    const invoices = await db.invoice.findMany({
      where: invoiceWhere,
      include: {
        allocations: {
          where: { status: AllocationStatus.ACTIVE }
        }
      }
    });

    let grossBilled = new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let netBilled = new Prisma.Decimal(0);
    let termCollected = new Prisma.Decimal(0);

    for (const inv of invoices) {
      grossBilled = grossBilled.add(inv.grossAmount);
      discountAmount = discountAmount.add(inv.discountAmount);
      netBilled = netBilled.add(inv.netAmount);

      const allocatedToInv = inv.allocations.reduce((acc, a) => acc.add(a.amount), new Prisma.Decimal(0));
      termCollected = termCollected.add(allocatedToInv);
    }

    const outstanding = netBilled.minus(termCollected);
    const collectionRate = netBilled.isZero()
      ? 100.0
      : Number((termCollected.toNumber() / netBilled.toNumber()) * 100);

    // 2. Pure Cash Inflows & Outflows query (Cash basis within date range)
    const paymentWhere: Prisma.PaymentWhereInput = {
      branchId: ctx.branchId,
      status: PaymentStatus.COMPLETED,
      ...(filters.startDate || filters.endDate
        ? {
            paymentDate: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {})
            }
          }
        : {})
    };

    const expenseWhere: Prisma.ExpenseWhereInput = {
      branchId: ctx.branchId,
      status: ExpenseStatus.COMPLETED,
      ...(filters.startDate || filters.endDate
        ? {
            expenseDate: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {})
            }
          }
        : {})
    };

    const [payments, expenses] = await Promise.all([
      db.payment.findMany({ where: paymentWhere, select: { amount: true } }),
      db.expense.findMany({ where: expenseWhere, select: { amount: true } })
    ]);

    const totalFeeInflows = payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
    const totalOperationalExpenses = expenses.reduce((acc, e) => acc.add(e.amount), new Prisma.Decimal(0));
    const netOperatingCashFlow = totalFeeInflows.minus(totalOperationalExpenses);

    return {
      accrual: {
        invoiceCount: invoices.length,
        grossBilled,
        discountAmount,
        netBilled,
        termCollected,
        outstanding,
        collectionRate: Number(collectionRate.toFixed(1))
      },
      cashFlow: {
        feePaymentCount: payments.length,
        totalFeeInflows,
        expenseCount: expenses.length,
        totalOperationalExpenses,
        netOperatingCashFlow
      }
    };
  }

  /**
   * Collection Breakdown by Class for Selected Term/Year.
   */
  static async getCollectionByClass(ctx: TenantContext, filters: { academicYearId?: string; termId?: string } = {}) {
    this.checkReadPermission(ctx);

    const invoices = await db.invoice.findMany({
      where: {
        branchId: ctx.branchId,
        status: { not: InvoiceStatus.VOID },
        ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
        ...(filters.termId ? { termId: filters.termId } : {})
      },
      include: {
        enrollment: {
          include: {
            classRef: { select: { id: true, name: true } }
          }
        },
        allocations: {
          where: { status: AllocationStatus.ACTIVE }
        }
      }
    });

    interface ClassMetric {
      classId: string;
      className: string;
      studentIds: Set<string>;
      invoiceCount: number;
      grossBilled: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      netBilled: Prisma.Decimal;
      collected: Prisma.Decimal;
    }

    const classMap = new Map<string, ClassMetric>();

    for (const inv of invoices) {
      const classId = inv.enrollment?.classRef?.id || 'UNASSIGNED';
      const className = inv.enrollment?.classRef?.name || 'Unassigned';

      let metric = classMap.get(classId);
      if (!metric) {
        metric = {
          classId,
          className,
          studentIds: new Set<string>(),
          invoiceCount: 0,
          grossBilled: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          netBilled: new Prisma.Decimal(0),
          collected: new Prisma.Decimal(0)
        };
        classMap.set(classId, metric);
      }

      metric.studentIds.add(inv.studentId);
      metric.invoiceCount += 1;
      metric.grossBilled = metric.grossBilled.add(inv.grossAmount);
      metric.discountAmount = metric.discountAmount.add(inv.discountAmount);
      metric.netBilled = metric.netBilled.add(inv.netAmount);

      const paid = inv.allocations.reduce((acc, a) => acc.add(a.amount), new Prisma.Decimal(0));
      metric.collected = metric.collected.add(paid);
    }

    const result = Array.from(classMap.values()).map(m => {
      const outstanding = m.netBilled.minus(m.collected);
      const collectionRate = m.netBilled.isZero()
        ? 100.0
        : Number((m.collected.toNumber() / m.netBilled.toNumber()) * 100);

      return {
        classId: m.classId,
        className: m.className,
        studentCount: m.studentIds.size,
        invoiceCount: m.invoiceCount,
        grossBilled: m.grossBilled,
        discountAmount: m.discountAmount,
        netBilled: m.netBilled,
        collected: m.collected,
        outstanding,
        collectionRate: Number(collectionRate.toFixed(1))
      };
    });

    return result.sort((a, b) => a.className.localeCompare(b.className));
  }

  /**
   * Collection Breakdown by Term for Selected Academic Year.
   */
  static async getCollectionByTerm(ctx: TenantContext, filters: { academicYearId?: string } = {}) {
    this.checkReadPermission(ctx);

    const invoices = await db.invoice.findMany({
      where: {
        branchId: ctx.branchId,
        status: { not: InvoiceStatus.VOID },
        ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {})
      },
      include: {
        term: { select: { id: true, name: true } },
        allocations: {
          where: { status: AllocationStatus.ACTIVE }
        }
      }
    });

    interface TermMetric {
      termId: string;
      termName: string;
      studentIds: Set<string>;
      invoiceCount: number;
      grossBilled: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      netBilled: Prisma.Decimal;
      collected: Prisma.Decimal;
    }

    const termMap = new Map<string, TermMetric>();

    for (const inv of invoices) {
      const termId = inv.termId || 'ANNUAL';
      const termName = inv.term?.name || 'Annual / Other';

      let metric = termMap.get(termId);
      if (!metric) {
        metric = {
          termId,
          termName,
          studentIds: new Set<string>(),
          invoiceCount: 0,
          grossBilled: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          netBilled: new Prisma.Decimal(0),
          collected: new Prisma.Decimal(0)
        };
        termMap.set(termId, metric);
      }

      metric.studentIds.add(inv.studentId);
      metric.invoiceCount += 1;
      metric.grossBilled = metric.grossBilled.add(inv.grossAmount);
      metric.discountAmount = metric.discountAmount.add(inv.discountAmount);
      metric.netBilled = metric.netBilled.add(inv.netAmount);

      const paid = inv.allocations.reduce((acc, a) => acc.add(a.amount), new Prisma.Decimal(0));
      metric.collected = metric.collected.add(paid);
    }

    const result = Array.from(termMap.values()).map(m => {
      const outstanding = m.netBilled.minus(m.collected);
      const collectionRate = m.netBilled.isZero()
        ? 100.0
        : Number((m.collected.toNumber() / m.netBilled.toNumber()) * 100);

      return {
        termId: m.termId,
        termName: m.termName,
        studentCount: m.studentIds.size,
        invoiceCount: m.invoiceCount,
        grossBilled: m.grossBilled,
        discountAmount: m.discountAmount,
        netBilled: m.netBilled,
        collected: m.collected,
        outstanding,
        collectionRate: Number(collectionRate.toFixed(1))
      };
    });

    return result.sort((a, b) => a.termName.localeCompare(b.termName));
  }

  /**
   * 12-Month Rolling Comparative Cash Flow (Fees Collected vs Expenses Paid).
   */
  static async get12MonthCashFlow(ctx: TenantContext, referenceDate: Date = new Date()) {
    this.checkReadPermission(ctx);

    // Build 12 calendar month intervals ending at referenceDate
    const monthIntervals: Array<{
      key: string;
      label: string;
      shortMonth: string;
      year: number;
      startDate: Date;
      endDate: Date;
    }> = [];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const startDate = new Date(year, month, 1, 0, 0, 0, 0);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

      monthIntervals.push({
        key: `${year}-${(month + 1).toString().padStart(2, '0')}`,
        label: `${monthNames[month]} ${year}`,
        shortMonth: monthNames[month],
        year,
        startDate,
        endDate
      });
    }

    const overallStart = monthIntervals[0].startDate;
    const overallEnd = monthIntervals[monthIntervals.length - 1].endDate;

    const [payments, expenses] = await Promise.all([
      db.payment.findMany({
        where: {
          branchId: ctx.branchId,
          status: PaymentStatus.COMPLETED,
          paymentDate: { gte: overallStart, lte: overallEnd }
        },
        select: { amount: true, paymentDate: true }
      }),
      db.expense.findMany({
        where: {
          branchId: ctx.branchId,
          status: ExpenseStatus.COMPLETED,
          expenseDate: { gte: overallStart, lte: overallEnd }
        },
        select: { amount: true, expenseDate: true }
      })
    ]);

    const result = monthIntervals.map(m => {
      let feesIn = new Prisma.Decimal(0);
      let expensesOut = new Prisma.Decimal(0);

      for (const p of payments) {
        if (p.paymentDate >= m.startDate && p.paymentDate <= m.endDate) {
          feesIn = feesIn.add(p.amount);
        }
      }

      for (const e of expenses) {
        if (e.expenseDate >= m.startDate && e.expenseDate <= m.endDate) {
          expensesOut = expensesOut.add(e.amount);
        }
      }

      return {
        key: m.key,
        label: m.label,
        shortMonth: m.shortMonth,
        year: m.year,
        feesIn,
        expensesOut,
        netCashFlow: feesIn.minus(expensesOut)
      };
    });

    return result;
  }

  /**
   * Payment Channel Distribution (Counts, Volumes, and Share %).
   */
  static async getPaymentChannels(ctx: TenantContext, filters: ReportFilterParams = {}) {
    this.checkReadPermission(ctx);

    const where: Prisma.PaymentWhereInput = {
      branchId: ctx.branchId,
      status: PaymentStatus.COMPLETED,
      ...(filters.startDate || filters.endDate
        ? {
            paymentDate: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {})
            }
          }
        : {})
    };

    const payments = await db.payment.findMany({
      where,
      select: {
        paymentMethod: true,
        amount: true
      }
    });

    let totalAllVolume = new Prisma.Decimal(0);
    const channelMap = new Map<string, { method: string; count: number; totalAmount: Prisma.Decimal }>();

    for (const p of payments) {
      totalAllVolume = totalAllVolume.add(p.amount);
      const existing = channelMap.get(p.paymentMethod) || {
        method: p.paymentMethod,
        count: 0,
        totalAmount: new Prisma.Decimal(0)
      };
      existing.count += 1;
      existing.totalAmount = existing.totalAmount.add(p.amount);
      channelMap.set(p.paymentMethod, existing);
    }

    const channels = Array.from(channelMap.values()).map(c => {
      const percentage = totalAllVolume.isZero()
        ? 0
        : Number(((c.totalAmount.toNumber() / totalAllVolume.toNumber()) * 100).toFixed(1));

      return {
        method: c.method,
        count: c.count,
        totalAmount: c.totalAmount,
        percentage
      };
    });

    return {
      totalTransactions: payments.length,
      totalVolume: totalAllVolume,
      channels: channels.sort((a, b) => b.totalAmount.toNumber() - a.totalAmount.toNumber())
    };
  }

  /**
   * Top Outstanding Debtors / Defaulters List derived strictly from AR Subledger.
   */
  static async getDebtorsReport(ctx: TenantContext, filters: DebtorsFilterParams = {}) {
    this.checkReadPermission(ctx);

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const minBalance = filters.minBalance ? new Prisma.Decimal(filters.minBalance) : new Prisma.Decimal(0.01);

    // 1. Fetch all students in branch matching search & class filter
    const students = await db.student.findMany({
      where: {
        branchId: ctx.branchId,
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.search
          ? {
              OR: [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
                { admissionNo: { contains: filters.search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      include: {
        classRef: { select: { name: true } },
        streamRef: { select: { name: true } },
        ledgerEntries: {
          select: { direction: true, amount: true, postedAt: true, entryType: true }
        }
      }
    });

    // 2. Compute authoritative balance for each student
    const debtorsList: Array<{
      studentId: string;
      admissionNo: string;
      fullName: string;
      className: string;
      streamName: string | null;
      balance: Prisma.Decimal;
      totalDebits: Prisma.Decimal;
      totalCredits: Prisma.Decimal;
      lastPaymentDate: Date | null;
    }> = [];

    for (const student of students) {
      let debits = new Prisma.Decimal(0);
      let credits = new Prisma.Decimal(0);
      let lastPaymentDate: Date | null = null;

      for (const entry of student.ledgerEntries) {
        if (entry.direction === LedgerDirection.DEBIT) {
          debits = debits.add(entry.amount);
        } else {
          credits = credits.add(entry.amount);
        }

        if (entry.entryType === 'PAYMENT') {
          if (!lastPaymentDate || entry.postedAt > lastPaymentDate) {
            lastPaymentDate = entry.postedAt;
          }
        }
      }

      const balance = debits.minus(credits);

      // Only include students with positive debt >= minBalance
      if (balance.greaterThanOrEqualTo(minBalance)) {
        debtorsList.push({
          studentId: student.id,
          admissionNo: student.admissionNo,
          fullName: `${student.firstName} ${student.lastName}`.trim(),
          className: student.classRef?.name || '-',
          streamName: student.streamRef?.name || null,
          balance,
          totalDebits: debits,
          totalCredits: credits,
          lastPaymentDate
        });
      }
    }

    // Sort by balance descending (highest debtor first)
    debtorsList.sort((a, b) => b.balance.toNumber() - a.balance.toNumber());

    const totalDebtors = debtorsList.length;
    const totalDebtAmount = debtorsList.reduce((acc, d) => acc.add(d.balance), new Prisma.Decimal(0));
    const paginated = debtorsList.slice(skip, skip + limit);

    return {
      debtors: paginated,
      summary: {
        totalDebtors,
        totalDebtAmount
      },
      pagination: {
        page,
        limit,
        total: totalDebtors,
        totalPages: Math.ceil(totalDebtors / limit)
      }
    };
  }

  /**
   * Export Debtors to CSV string with branch isolation and authorization.
   */
  static async exportDebtorsCsv(ctx: TenantContext, filters: DebtorsFilterParams = {}): Promise<string> {
    this.checkExportPermission(ctx);

    const report = await this.getDebtorsReport(ctx, {
      ...filters,
      page: 1,
      limit: 10000 // Export up to 10k records
    });

    const headers = ["Admission No", "Student Name", "Class", "Stream", "Total Billed (UGX)", "Total Paid (UGX)", "Outstanding Balance (UGX)", "Last Payment Date"];
    const rows = report.debtors.map(d => [
      `"${d.admissionNo.replace(/"/g, '""')}"`,
      `"${d.fullName.replace(/"/g, '""')}"`,
      `"${d.className.replace(/"/g, '""')}"`,
      `"${(d.streamName || '').replace(/"/g, '""')}"`,
      d.totalDebits.toFixed(2),
      d.totalCredits.toFixed(2),
      d.balance.toFixed(2),
      d.lastPaymentDate ? d.lastPaymentDate.toISOString().split('T')[0] : 'Never'
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}
