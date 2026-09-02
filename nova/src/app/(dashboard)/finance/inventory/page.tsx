'use client';

import React, { useState, useEffect } from 'react';

interface InventoryStore {
  id: string;
  code: string;
  name: string;
  storeType: string;
  location: string | null;
  isActive: boolean;
  manager?: { id: string; firstName: string; lastName: string } | null;
  _count?: {
    stock: number;
  };
}

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  unitCostPrice: string | number;
  sellingPrice: string | number | null;
  reorderLevel: number;
  isActive: boolean;
  storeStocks?: Array<{
    id: string;
    storeId: string;
    quantityOnHand: string | number;
    store: { id: string; name: string; code: string };
  }>;
}

interface InventorySupplier {
  id: string;
  supplierCode: string;
  name: string;
  contactName: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  taxIdNumber: string | null;
  paymentTerms: string | null;
  isActive: boolean;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  status: string;
  totalAmount: string | number;
  createdAt: string;
  supplier: { id: string; name: string; supplierCode: string };
  createdBy: { id: string; firstName: string; lastName: string };
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  items: Array<{
    id: string;
    itemId: string;
    quantityOrdered: string | number;
    quantityReceived: string | number;
    unitCostPrice: string | number;
    totalAmount: string | number;
    item: { id: string; code: string; name: string };
  }>;
}

interface GoodsReceivedNote {
  id: string;
  grnNumber: string;
  supplierNameSnapshot: string;
  deliveryDate: string;
  totalAmount: string | number;
  isVoided: boolean;
  supplierInvoiceRef: string | null;
  expenseId: string | null;
  store: { id: string; name: string; code: string };
  receivedBy: { id: string; firstName: string; lastName: string };
  items: Array<{
    id: string;
    itemNameSnapshot: string;
    quantityReceived: string | number;
    unitCostPrice: string | number;
    totalAmount: string | number;
  }>;
}

interface StoreRequisition {
  id: string;
  requisitionNumber: string;
  purpose: string | null;
  status: string;
  createdAt: string;
  department: { id: string; name: string };
  requestedBy: { id: string; firstName: string; lastName: string };
  store: { id: string; name: string };
  items: Array<{
    id: string;
    itemId: string;
    quantityRequested: string | number;
    quantityIssued: string | number;
    item: { id: string; name: string; code: string };
  }>;
}

interface StudentStoreSale {
  id: string;
  saleReceiptNo: string;
  totalAmount: string | number;
  isInvoiceCharge: boolean;
  paymentMethod: string | null;
  status: string;
  createdAt: string;
  student: { id: string; admissionNo: string; firstName: string; lastName: string };
  store: { id: string; name: string };
  items: Array<{
    id: string;
    itemNameSnapshot: string;
    quantity: string | number;
    unitPrice: string | number;
    totalAmount: string | number;
  }>;
}

interface ValuationItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  unitOfMeasure: string;
  unitCostPrice: string | number;
  totalQuantityOnHand: string | number;
  totalValuation: string | number;
}

interface ValuationReport {
  totalValuation: string | number;
  totalDistinctSKUs: number;
  items: ValuationItem[];
}

export default function InventoryWorkstationPage() {
  const [activeTab, setActiveTab] = useState<'stocks' | 'procurement' | 'sales' | 'requisitions' | 'reports'>('stocks');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Core entities
  const [stores, setStores] = useState<InventoryStore[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [requisitions, setRequisitions] = useState<StoreRequisition[]>([]);
  const [sales, setSales] = useState<StudentStoreSale[]>([]);

  // Valuation report
  const [valuation, setValuation] = useState<ValuationReport | null>(null);

  // Modals state
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [isNewPOModalOpen, setIsNewPOModalOpen] = useState(false);
  const [isNewGRNModalOpen, setIsNewGRNModalOpen] = useState(false);
  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);
  const [isNewReqModalOpen, setIsNewReqModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isStocktakeModalOpen, setIsStocktakeModalOpen] = useState(false);
  const [isWriteoffModalOpen, setIsWriteoffModalOpen] = useState(false);

  // Form states
  const [newStore, setNewStore] = useState({ code: '', name: '', storeType: 'CENTRAL_STORE', location: '' });
  const [newItem, setNewItem] = useState({ code: '', name: '', category: 'GENERAL', unitOfMeasure: 'pcs', unitCostPrice: 0, sellingPrice: 0, reorderLevel: 5 });
  const [newSupplier, setNewSupplier] = useState({ supplierCode: '', name: '', contactName: '', phone: '', email: '', taxIdNumber: '', paymentTerms: 'Net 30' });
  const [newPO, setNewPO] = useState<{ supplierId: string; items: { itemId: string; quantityOrdered: number; unitCostPrice: number }[] }>({
    supplierId: '',
    items: [{ itemId: '', quantityOrdered: 1, unitCostPrice: 0 }]
  });
  const [newGRN, setNewGRN] = useState<{ poId?: string; supplierId: string; storeId: string; supplierInvoiceRef: string; items: { itemId: string; quantityReceived: number; unitCostPrice: number }[] }>({
    supplierId: '',
    storeId: '',
    supplierInvoiceRef: '',
    items: [{ itemId: '', quantityReceived: 1, unitCostPrice: 0 }]
  });
  const [newSale, setNewSale] = useState<{ studentId: string; storeId: string; isInvoiceCharge: boolean; paymentMethod: string; items: { itemId: string; quantity: number; unitPrice: number }[] }>({
    studentId: '',
    storeId: '',
    isInvoiceCharge: false,
    paymentMethod: 'CASH',
    items: [{ itemId: '', quantity: 1, unitPrice: 0 }]
  });
  const [newReq, setNewReq] = useState<{ storeId: string; departmentId: string; requestedById: string; purpose: string; items: { itemId: string; quantityRequested: number }[] }>({
    storeId: '',
    departmentId: '',
    requestedById: '',
    purpose: '',
    items: [{ itemId: '', quantityRequested: 1 }]
  });
  const [transferData, setTransferData] = useState({ sourceStoreId: '', destStoreId: '', itemId: '', quantity: 1, reason: '' });
  const [stocktakeData, setStocktakeData] = useState({ storeId: '', itemId: '', physicalCount: 0, reason: '' });
  const [writeoffData, setWriteoffData] = useState({ storeId: '', itemId: '', quantity: 1, reason: '' });

  const reloadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resStores, resItems, resSuppliers, resPOs, resGRNs, resReqs, resSales, resValuation] = await Promise.all([
        fetch('/api/inventory/stores').then((r) => r.json()),
        fetch('/api/inventory/items').then((r) => r.json()),
        fetch('/api/inventory/suppliers').then((r) => r.json()),
        fetch('/api/inventory/purchase-orders').then((r) => r.json()),
        fetch('/api/inventory/grn').then((r) => r.json()),
        fetch('/api/inventory/requisitions').then((r) => r.json()),
        fetch('/api/inventory/sales').then((r) => r.json()),
        fetch('/api/inventory/reports?type=valuation').then((r) => r.json()),
      ]);

      if (resStores.stores) setStores(resStores.stores);
      if (resItems.items) setItems(resItems.items);
      if (resSuppliers.suppliers) setSuppliers(resSuppliers.suppliers);
      if (resPOs.purchaseOrders) setPurchaseOrders(resPOs.purchaseOrders);
      if (resGRNs.grns) setGrns(resGRNs.grns);
      if (resReqs.requisitions) setRequisitions(resReqs.requisitions);
      if (resSales.sales) setSales(resSales.sales);
      if (resValuation) setValuation(resValuation);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        const [resStores, resItems, resSuppliers, resPOs, resGRNs, resReqs, resSales, resValuation] = await Promise.all([
          fetch('/api/inventory/stores').then((r) => r.json()),
          fetch('/api/inventory/items').then((r) => r.json()),
          fetch('/api/inventory/suppliers').then((r) => r.json()),
          fetch('/api/inventory/purchase-orders').then((r) => r.json()),
          fetch('/api/inventory/grn').then((r) => r.json()),
          fetch('/api/inventory/requisitions').then((r) => r.json()),
          fetch('/api/inventory/sales').then((r) => r.json()),
          fetch('/api/inventory/reports?type=valuation').then((r) => r.json()),
        ]);

        if (!isMounted) return;
        if (resStores.stores) setStores(resStores.stores);
        if (resItems.items) setItems(resItems.items);
        if (resSuppliers.suppliers) setSuppliers(resSuppliers.suppliers);
        if (resPOs.purchaseOrders) setPurchaseOrders(resPOs.purchaseOrders);
        if (resGRNs.grns) setGrns(resGRNs.grns);
        if (resReqs.requisitions) setRequisitions(resReqs.requisitions);
        if (resSales.sales) setSales(resSales.sales);
        if (resValuation) setValuation(resValuation);
      } catch (err: unknown) {
        if (isMounted) setError((err as Error).message || 'Failed to load inventory data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Action handlers
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStore),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Store created successfully');
      setIsNewStoreModalOpen(false);
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Catalog item created successfully');
      setIsNewItemModalOpen(false);
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Supplier added successfully');
      setIsNewSupplierModalOpen(false);
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPO),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Purchase order created in DRAFT status');
      setIsNewPOModalOpen(false);
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleApprovePO = async (poId: string) => {
    try {
      const res = await fetch(`/api/inventory/purchase-orders/${poId}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Purchase order approved');
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newGRN, createExpenseVoucher: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Goods received, WAC recalculated, and stock incremented');
      setIsNewGRNModalOpen(false);
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferData),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Stock transferred between stores successfully');
      setIsTransferModalOpen(false);
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleStocktake = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/stocktake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stocktakeData),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Stocktake audit adjustment recorded');
      setIsStocktakeModalOpen(false);
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleWriteoff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/writeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(writeoffData),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Damaged / expired items written off');
      setIsWriteoffModalOpen(false);
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleApproveReq = async (reqId: string) => {
    try {
      const res = await fetch(`/api/inventory/requisitions/${reqId}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Requisition approved');
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleIssueReq = async (reqId: string) => {
    try {
      const res = await fetch(`/api/inventory/requisitions/${reqId}/issue`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Goods issued from store to department');
      reloadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📦</span> School Stores, Procurement & Student Store Engine
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Phase 3.1J: Weighted Average Cost (WAC) Inventory, POs, GRNs, Department Requisitions, and Student Uniform Sales
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsNewItemModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
          >
            + New Item
          </button>
          <button
            onClick={() => setIsNewPOModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
          >
            + Purchase Order
          </button>
          <button
            onClick={() => setIsNewGRNModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
          >
            + Receive Goods (GRN)
          </button>
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition"
          >
            ⇄ Store Transfer
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold text-lg">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-sm flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="font-bold text-lg">&times;</button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Total Inventory Valuation (WAC)</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            UGX {valuation?.totalValuation ? Number(valuation.totalValuation).toLocaleString() : '0'}
          </p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{valuation?.totalDistinctSKUs || 0} Distinct SKUs</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Store Locations</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stores.length}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Central & Sub-stores</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Purchase Orders</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{purchaseOrders.length}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            {purchaseOrders.filter((p) => p.status === 'SUBMITTED').length} Pending Approval
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Pending Department Requisitions</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            {requisitions.filter((r) => r.status === 'PENDING_APPROVAL').length}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{requisitions.length} Total Requests</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {[
          { id: 'stocks', label: '📦 Stocks & Catalog', icon: '📦' },
          { id: 'procurement', label: '🛒 Procurement & GRN', icon: '🛒' },
          { id: 'sales', label: '🏷️ Student Store POS', icon: '🏷️' },
          { id: 'requisitions', label: '📑 Department Requisitions', icon: '📑' },
          { id: 'reports', label: '📊 Audit & Valuation', icon: '📊' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'stocks' | 'procurement' | 'sales' | 'requisitions' | 'reports')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Stocks & Catalog */}
      {activeTab === 'stocks' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Item Master & Stock Quantities</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsStocktakeModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
              >
                📝 Stocktake Audit
              </button>
              <button
                onClick={() => setIsWriteoffModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-950/40 text-red-700 dark:text-red-400"
              >
                ⚠️ Write-off Damage
              </button>
              <button
                onClick={() => setIsNewStoreModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400"
              >
                + New Store Location
              </button>
            </div>
          </div>

          {/* Catalog Items Table */}
          <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">SKU / Code</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">WAC Cost</th>
                  <th className="px-4 py-3">Selling Price</th>
                  <th className="px-4 py-3">Store Balances</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No catalog items found. Click &quot;+ New Item&quot; to add an item.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const totalQty = item.storeStocks?.reduce((acc, s) => acc + Number(s.quantityOnHand), 0) || 0;
                    const isLowStock = totalQty <= item.reorderLevel;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-mono font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                          {item.code}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {item.category}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {item.unitOfMeasure}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          UGX {Number(item.unitCostPrice).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          {item.sellingPrice ? `UGX ${Number(item.sellingPrice).toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {item.storeStocks && item.storeStocks.length > 0 ? (
                              item.storeStocks.map((s) => (
                                <span
                                  key={s.id}
                                  className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono text-xs"
                                >
                                  {s.store.code}: <b>{Number(s.quantityOnHand)}</b>
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isLowStock ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400">
                              Low Stock ({totalQty} / {item.reorderLevel})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                              In Stock ({totalQty})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Procurement & GRN */}
      {activeTab === 'procurement' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase Orders & Goods Receiving</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsNewSupplierModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
              >
                + Add Supplier
              </button>
            </div>
          </div>

          {/* PO List */}
          <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Total Amount</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No purchase orders recorded.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-mono font-semibold text-xs text-blue-600 dark:text-blue-400">
                        {po.poNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {po.supplier.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        UGX {Number(po.totalAmount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {po.createdBy.firstName} {po.createdBy.lastName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            po.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : po.status === 'RECEIVED'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                              : po.status === 'SUBMITTED'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {po.status === 'SUBMITTED' && (
                          <button
                            onClick={() => handleApprovePO(po.id)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Approve PO
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* GRN List */}
          <div className="pt-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">Recent Goods Received Notes (GRN)</h3>
            <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">GRN Number</th>
                    <th className="px-4 py-3">Supplier Snapshot</th>
                    <th className="px-4 py-3">Destination Store</th>
                    <th className="px-4 py-3">Total Cost</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Expense Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {grns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                        No goods received notes recorded yet.
                      </td>
                    </tr>
                  ) : (
                    grns.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {g.grnNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {g.supplierNameSnapshot}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {g.store.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          UGX {Number(g.totalAmount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(g.deliveryDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {g.expenseId ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-mono text-xs">
                              Linked Expense
                            </span>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Student Store POS */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Student Store & Uniform Sales Counter</h2>
            <button
              onClick={() => setIsNewSaleModalOpen(true)}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
            >
              + New Store Sale
            </button>
          </div>

          {/* Sales History Table */}
          <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Receipt No</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Type / Method</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No student store sales recorded yet.
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-mono font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                        {s.saleReceiptNo}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {s.student.firstName} {s.student.lastName} ({s.student.admissionNo})
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {s.store.name}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {s.isInvoiceCharge ? (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-semibold text-xs">
                            On-Account (Invoice)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold text-xs">
                            Paid ({s.paymentMethod})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        UGX {Number(s.totalAmount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Department Requisitions */}
      {activeTab === 'requisitions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Department Requisitions & Stock Issues</h2>
          </div>

          <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Req Number</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Requested By</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {requisitions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No departmental requisitions found.
                    </td>
                  </tr>
                ) : (
                  requisitions.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-mono font-semibold text-xs text-purple-600 dark:text-purple-400">
                        {r.requisitionNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {r.department.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {r.requestedBy.firstName} {r.requestedBy.lastName}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {r.purpose || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            r.status === 'ISSUED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : r.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {r.status === 'PENDING_APPROVAL' && (
                          <button
                            onClick={() => handleApproveReq(r.id)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Approve
                          </button>
                        )}
                        {r.status === 'APPROVED' && (
                          <button
                            onClick={() => handleIssueReq(r.id)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Issue Stock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Audit & Valuation */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Valuation & Store Balances</h2>

          {valuation && (
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Consolidated Valuation Summary</h3>
                  <p className="text-xs text-gray-500">Calculated strictly under Weighted Average Cost (WAC)</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                    UGX {Number(valuation.totalValuation).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">{valuation.totalDistinctSKUs} Distinct Catalog Items</p>
                </div>
              </div>

              {/* Valuation details per store */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Quantity</th>
                      <th className="px-4 py-2">WAC Cost</th>
                      <th className="px-4 py-2 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {valuation.items?.map((vi: ValuationItem) => (
                      <tr key={vi.itemId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{vi.itemName} ({vi.itemCode})</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{vi.category}</td>
                        <td className="px-4 py-2 font-mono text-xs">{Number(vi.totalQuantityOnHand)} {vi.unitOfMeasure}</td>
                        <td className="px-4 py-2 font-mono text-xs">UGX {Number(vi.unitCostPrice).toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono text-xs font-bold text-right">UGX {Number(vi.totalValuation).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Store Modal */}
      {isNewStoreModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Store Location</h3>
            <form onSubmit={handleCreateStore} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Store Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STR-MAIN"
                  value={newStore.code}
                  onChange={(e) => setNewStore({ ...newStore, code: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Store Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Central Warehouse"
                  value={newStore.name}
                  onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Store Type</label>
                <select
                  value={newStore.storeType}
                  onChange={(e) => setNewStore({ ...newStore, storeType: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                >
                  <option value="CENTRAL_STORE">Central Store</option>
                  <option value="UNIFORM_STORE">Uniform Store</option>
                  <option value="BOOKSHOP_STORE">Bookshop Store</option>
                  <option value="SCIENCE_LAB_STORE">Science Lab Store</option>
                  <option value="FOOD_STORE">Food Store</option>
                  <option value="BOARDING_STORE">Boarding Store</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Physical Location</label>
                <input
                  type="text"
                  placeholder="e.g. Block B, Room 10"
                  value={newStore.location}
                  onChange={(e) => setNewStore({ ...newStore, location: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewStoreModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Item Modal */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Catalog Item</h3>
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Item SKU / Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UNIF-P3"
                    value={newItem.code}
                    onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="GENERAL">General</option>
                    <option value="UNIFORM">Uniform</option>
                    <option value="SCHOLASTIC_TEXTBOOK">Textbook</option>
                    <option value="STATIONERY_OFFICE">Stationery</option>
                    <option value="LAB_CHEMICAL_APPARATUS">Lab Chemicals</option>
                    <option value="BOARDING_SUPPLIES">Boarding Supplies</option>
                    <option value="CLEANING_HYGIENE">Cleaning & Hygiene</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Primary 3 Uniform Set"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Unit of Measure</label>
                  <input
                    type="text"
                    required
                    placeholder="sets / pcs"
                    value={newItem.unitOfMeasure}
                    onChange={(e) => setNewItem({ ...newItem, unitOfMeasure: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Cost Price (UGX)</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.unitCostPrice}
                    onChange={(e) => setNewItem({ ...newItem, unitCostPrice: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Selling Price (UGX)</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.sellingPrice}
                    onChange={(e) => setNewItem({ ...newItem, sellingPrice: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewItemModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
