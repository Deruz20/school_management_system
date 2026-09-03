import { requireAuth } from "@/lib/auth/require-auth";
import { SupplierDAO } from "@/lib/dao/supplier.dao";
import { SupplierInvoiceDAO } from "@/lib/dao/supplier-invoice.dao";
import { SupplierCreditNoteDAO } from "@/lib/dao/supplier-credit-note.dao";
import { SupplierPaymentDAO } from "@/lib/dao/supplier-payment.dao";
import { APReportsDAO } from "@/lib/dao/ap-reports.dao";
import { FiscalPeriodDAO } from "@/lib/dao/gl.dao";
import { TaxPolicyEngine } from "@/lib/dao/tax-policy.engine";
import { db } from "@/lib/db";
import { AccountsPayableClient } from "@/components/finance/AccountsPayableClient";

export default async function AccountsPayablePage() {
  const ctx = await requireAuth();

  // Initialize branch tax policies if needed
  await TaxPolicyEngine.initBranchDefaultTaxPolicies(ctx);

  const [
    suppliers,
    invoices,
    creditNotes,
    payments,
    treasuryAccounts,
    periods,
    reconciliation,
    agedReport,
    grniSchedule
  ] = await Promise.all([
    SupplierDAO.listSuppliers(ctx),
    SupplierInvoiceDAO.listInvoices(ctx),
    SupplierCreditNoteDAO.listCreditNotes(ctx),
    SupplierPaymentDAO.listPayments(ctx),
    db.treasuryAccount.findMany({
      where: { branchId: ctx.branchId, isActive: true },
      orderBy: { code: "asc" }
    }),
    FiscalPeriodDAO.listPeriods(ctx),
    APReportsDAO.reconcileAPSubledger(ctx),
    APReportsDAO.getAgedPayablesReport(ctx),
    APReportsDAO.getGRNIAccrualSchedule(ctx)
  ]);

  const serializedSuppliers = suppliers.map((s) => ({
    id: s.id,
    supplierCode: s.supplierCode,
    name: s.name,
    tradeName: s.tradeName,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    taxIdNumber: s.taxIdNumber,
    paymentTermsDays: s.paymentTermsDays,
    creditLimitUGX: s.creditLimitUGX.toString(),
    isCreditBlocked: s.isCreditBlocked,
    currentBalanceUGX: s.currentBalanceUGX.toString(),
    vatRegistered: s.vatRegistered,
    whtExempt: s.whtExempt,
    isActive: s.isActive
  }));

  const serializedInvoices = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    vendorInvoiceNumber: inv.vendorInvoiceNumber,
    supplierId: inv.supplierId,
    supplierName: inv.supplier.name,
    invoiceDate: inv.invoiceDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    grossAmount: inv.grossAmount.toString(),
    taxAmount: inv.taxAmount.toString(),
    discountAmount: inv.discountAmount.toString(),
    netPayableAmount: inv.netPayableAmount.toString(),
    amountPaid: inv.amountPaid.toString(),
    amountOutstanding: inv.amountOutstanding.toString(),
    ppvAmount: inv.ppvAmount.toString(),
    status: inv.status,
    matchStatus: inv.matchStatus,
    holdReason: inv.holdReason
  }));

  const serializedCreditNotes = creditNotes.map((crn) => ({
    id: crn.id,
    creditNoteNumber: crn.creditNoteNumber,
    vendorCreditNoteRef: crn.vendorCreditNoteRef,
    supplierId: crn.supplierId,
    supplierName: crn.supplier.name,
    creditNoteDate: crn.creditNoteDate.toISOString(),
    grossAmount: crn.grossAmount.toString(),
    taxAmount: crn.taxAmount.toString(),
    netCreditAmount: crn.netCreditAmount.toString(),
    unallocatedAmount: crn.unallocatedAmount.toString(),
    reason: crn.reason,
    status: crn.status
  }));

  const serializedPayments = payments.map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    supplierId: p.supplierId,
    supplierName: p.supplier.name,
    treasuryAccountName: p.treasuryAccount.name,
    paymentDate: p.paymentDate.toISOString(),
    totalAmountPaid: p.totalAmountPaid.toString(),
    whtDeductedAmount: p.whtDeductedAmount.toString(),
    discountTakenAmount: p.discountTakenAmount.toString(),
    unallocatedAmount: p.unallocatedAmount.toString(),
    paymentMethod: p.paymentMethod,
    referenceNumber: p.referenceNumber,
    status: p.status
  }));

  const serializedTreasuryAccounts = treasuryAccounts.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    currentBalance: t.currentBalance.toString()
  }));

  const serializedPeriods = periods.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status
  }));

  const serializedReconciliation = {
    isReconciled: reconciliation.isReconciled,
    apControl: {
      subledgerTotalAP: reconciliation.apControl.subledgerTotalAP.toString(),
      glBalance2110: reconciliation.apControl.glBalance2110.toString(),
      varianceAP: reconciliation.apControl.varianceAP.toString(),
      isReconciled: reconciliation.apControl.isReconciled
    },
    grniControl: {
      subledgerTotalGRNI: reconciliation.grniControl.subledgerTotalGRNI.toString(),
      glBalance2120: reconciliation.grniControl.glBalance2120.toString(),
      varianceGRNI: reconciliation.grniControl.varianceGRNI.toString(),
      isReconciled: reconciliation.grniControl.isReconciled
    }
  };

  const serializedAgedSummary = {
    current: agedReport.summary.current.toString(),
    days31to60: agedReport.summary.days31to60.toString(),
    days61to90: agedReport.summary.days61to90.toString(),
    days90Plus: agedReport.summary.days90Plus.toString(),
    grandTotal: agedReport.summary.grandTotal.toString()
  };

  return (
    <AccountsPayableClient
      suppliers={serializedSuppliers}
      invoices={serializedInvoices}
      creditNotes={serializedCreditNotes}
      payments={serializedPayments}
      treasuryAccounts={serializedTreasuryAccounts}
      fiscalPeriods={serializedPeriods}
      reconciliation={serializedReconciliation}
      agedSummary={serializedAgedSummary}
      grniTotal={grniSchedule.totalAccrualAmount.toString()}
    />
  );
}
