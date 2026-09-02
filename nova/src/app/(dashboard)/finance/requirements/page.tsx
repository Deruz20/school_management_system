'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface CatalogItem {
  id: string;
  code: string;
  name: string;
  category: 'CLEANING_HYGIENE' | 'ACADEMIC_STATIONERY' | 'BOARDING_PERSONAL' | 'GENERAL';
  unit: string;
  defaultCashInLieu: string | null;
  description: string | null;
  isActive: boolean;
}

interface ClassBlueprint {
  id: string;
  classId: string;
  academicYearId: string;
  termId: string | null;
  title: string;
  description: string | null;
  isActive: boolean;
  class: { id: string; name: string };
  academicYear: { id: string; name: string };
  term: { id: string; name: string } | null;
  items: {
    id: string;
    name: string;
    category: string;
    unit: string;
    quantity: string;
    cashInLieuAmount: string | null;
    isMandatory: boolean;
  }[];
}

interface StudentReqRecord {
  id: string;
  studentId: string;
  academicYearId: string;
  termId: string | null;
  totalItemsCount: number;
  fulfilledCount: number;
  pendingCount: number;
  isFullyCompliant: boolean;
  student: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
    classRef?: { id: string; name: string } | null;
  };
  classRequirement: {
    title: string;
    class: { name: string };
  };
  items: {
    id: string;
    name: string;
    category: string;
    unit: string;
    quantityRequired: string;
    quantityDelivered: string;
    quantityMonetized: string;
    cashInLieuAmount: string | null;
    status: 'PENDING' | 'PARTIAL' | 'FULFILLED' | 'MONETIZED' | 'EXEMPTED';
    isMandatory: boolean;
  }[];
}

interface StoreTallyItem {
  name: string;
  category: string;
  unit: string;
  totalRequired: number;
  totalDelivered: number;
  totalMonetized: number;
  totalPending: number;
  fulfillmentRate: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  CLEANING_HYGIENE: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  ACADEMIC_STATIONERY: 'bg-purple-50 text-purple-700 border-purple-200',
  BOARDING_PERSONAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  GENERAL: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function RequirementsHubPage() {
  const [activeTab, setActiveTab] = useState<'TRACKER' | 'BLUEPRINTS' | 'CATALOG' | 'STORE_TALLY'>('TRACKER');
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');

  // Data states
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [blueprints, setBlueprints] = useState<ClassBlueprint[]>([]);
  const [studentRecords, setStudentRecords] = useState<StudentReqRecord[]>([]);
  const [storeTally, setStoreTally] = useState<StoreTallyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Marking Drawer state
  const [activeMarkingRecord, setActiveMarkingRecord] = useState<StudentReqRecord | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Catalog Modal state
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatCategory, setNewCatCategory] = useState('ACADEMIC_STATIONERY');
  const [newCatUnit, setNewCatUnit] = useState('REAM');
  const [newCatCashInLieu, setNewCatCashInLieu] = useState('');

  // Initial lookup data
  useEffect(() => {
    async function loadMeta() {
      try {
        const [yearRes, catRes] = await Promise.all([
          fetch('/api/academic-years'),
          fetch('/api/requirements/catalog')
        ]);
        if (yearRes.ok) {
          const yData = await yearRes.json();
          setAcademicYears(yData.academicYears || []);
          if (yData.academicYears?.length > 0) {
            setSelectedYearId(yData.academicYears[0].id);
          }
        }
        if (catRes.ok) {
          const cData = await catRes.json();
          setCatalogItems(cData.items || []);
        }
      } catch (err: unknown) {
        console.error('Failed to load initial metadata', err);
      }
    }
    loadMeta();
  }, []);

  // Fetch tab data whenever filters or tab changes
  useEffect(() => {
    if (!selectedYearId) return;

    let ignore = false;
    async function loadTabData() {
      setIsLoading(true);
      setError(null);
      try {
        if (activeTab === 'TRACKER') {
          const url = `/api/requirements/students?academicYearId=${selectedYearId}${searchQuery ? `&search=${searchQuery}` : ''}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          if (!ignore) setStudentRecords(data.records || []);
        } else if (activeTab === 'BLUEPRINTS') {
          const url = `/api/requirements/blueprints?academicYearId=${selectedYearId}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          if (!ignore) setBlueprints(data.blueprints || []);
        } else if (activeTab === 'CATALOG') {
          const res = await fetch('/api/requirements/catalog');
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          if (!ignore) setCatalogItems(data.items || []);
        } else if (activeTab === 'STORE_TALLY') {
          const url = `/api/requirements/reports/tally?academicYearId=${selectedYearId}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          if (!ignore) setStoreTally(data.items || []);
        }
      } catch (err: unknown) {
        if (!ignore) setError((err as Error).message);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadTabData();
    return () => {
      ignore = true;
    };
  }, [activeTab, selectedYearId, searchQuery]);

  // Handle Delivery Submission
  const handleDeliverItem = async (itemId: string, qty: number) => {
    try {
      setError(null);
      const res = await fetch(`/api/requirements/students/${activeMarkingRecord?.studentId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentRequirementItemId: itemId,
          deltaDelivered: qty,
          allowOverDelivery: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setActionSuccess(`Successfully recorded delivery of ${qty} unit(s).`);

      // Refresh student checklist
      const updatedRes = await fetch(`/api/requirements/students/${activeMarkingRecord?.studentId}?academicYearId=${selectedYearId}`);
      if (updatedRes.ok) {
        const uData = await updatedRes.json();
        setActiveMarkingRecord(uData.record);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Handle Monetization (Cash-in-Lieu)
  const handleMonetizeItem = async (itemId: string, qty: number) => {
    try {
      setError(null);
      const res = await fetch(`/api/requirements/students/${activeMarkingRecord?.studentId}/monetize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentRequirementItemId: itemId,
          monetizedQuantity: qty,
          paymentMethod: 'CASH',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setActionSuccess(`Cash-in-lieu payment recorded successfully into Subledger.`);

      const updatedRes = await fetch(`/api/requirements/students/${activeMarkingRecord?.studentId}?academicYearId=${selectedYearId}`);
      if (updatedRes.ok) {
        const uData = await updatedRes.json();
        setActiveMarkingRecord(uData.record);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Create Catalog Item
  const handleCreateCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const res = await fetch('/api/requirements/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCatCode,
          name: newCatName,
          category: newCatCategory,
          unit: newCatUnit,
          defaultCashInLieu: newCatCashInLieu ? parseFloat(newCatCashInLieu) : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowCatalogModal(false);
      setNewCatCode('');
      setNewCatName('');
      setNewCatCashInLieu('');
      // Refresh catalog list
      const cRes = await fetch('/api/requirements/catalog');
      const cData = await cRes.json();
      setCatalogItems(cData.items || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
              Finance 3.1H
            </span>
            <span className="text-xs text-gray-500 font-mono">NON-CASH &amp; IN-KIND</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1">
            School Requirements &amp; In-Kind Collections
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Physical materials tracking, class blueprints, cash-in-lieu monetization, and store handover tally.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/finance/clearance"
            className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition shadow-sm"
          >
            🎓 Financial Clearance &amp; Exam Permits →
          </Link>
          <Link
            href="/finance"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Finance Home
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          {activeTab === 'TRACKER' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Search Student</label>
              <input
                type="text"
                placeholder="Name or Admission No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 w-64 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => setActiveTab('TRACKER')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'TRACKER' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Student Tracker
          </button>
          <button
            onClick={() => setActiveTab('BLUEPRINTS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'BLUEPRINTS' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📐 Class Blueprints
          </button>
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'CATALOG' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📦 Item Catalog
          </button>
          <button
            onClick={() => setActiveTab('STORE_TALLY')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'STORE_TALLY' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏪 Storekeeper Tally
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-900 font-bold ml-4">✕</button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center justify-between">
          <span>✅ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-950 font-bold ml-4">✕</button>
        </div>
      )}

      {/* TAB 1: STUDENT TRACKER */}
      {activeTab === 'TRACKER' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                Active Student Checklists ({studentRecords.length})
              </h2>
              <span className="text-xs text-gray-500 font-medium">Click &apos;Mark Items&apos; to record deliveries or cash</span>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-gray-400">Loading requirement records...</div>
            ) : studentRecords.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                No requirement checklists found. Assign a Class Blueprint to generate student checklists.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
                    <tr>
                      <th className="p-3">Student</th>
                      <th className="p-3">Admission No</th>
                      <th className="p-3">Class / Blueprint</th>
                      <th className="p-3">Compliance Progress</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentRecords.map((rec) => {
                      const pct = rec.totalItemsCount > 0
                        ? Math.round((rec.fulfilledCount / rec.totalItemsCount) * 100)
                        : 0;

                      return (
                        <tr key={rec.id} className="hover:bg-gray-50 transition">
                          <td className="p-3 font-semibold text-gray-900">
                            {rec.student.firstName} {rec.student.lastName}
                          </td>
                          <td className="p-3 font-mono text-xs text-gray-600">{rec.student.admissionNo}</td>
                          <td className="p-3 text-gray-700">
                            <span className="font-medium text-xs bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                              {rec.classRequirement.class?.name || 'Class'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="w-48">
                              <div className="flex justify-between text-xs mb-1 font-medium">
                                <span>{rec.fulfilledCount} / {rec.totalItemsCount} items</span>
                                <span className="font-bold">{pct}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-red-400'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            {rec.isFullyCompliant ? (
                              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                                ✅ Fully Compliant
                              </span>
                            ) : rec.fulfilledCount > 0 ? (
                              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                                ⚠️ Partial ({rec.pendingCount} left)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800">
                                ⏳ Pending
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setActiveMarkingRecord(rec)}
                              className="px-3 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm"
                            >
                              ✏️ Mark Items
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CLASS BLUEPRINTS */}
      {activeTab === 'BLUEPRINTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blueprints.map((bp) => (
              <div key={bp.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-purple-100 text-purple-800">
                      {bp.class?.name}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">{bp.items.length} items required</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mt-2">{bp.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{bp.description || 'Standard class requirement blueprint.'}</p>

                  <div className="mt-4 space-y-2">
                    {bp.items.slice(0, 4).map((it) => (
                      <div key={it.id} className="flex justify-between text-xs py-1 border-b border-gray-50">
                        <span className="font-medium text-gray-800">{it.name}</span>
                        <span className="text-gray-500">
                          {it.quantity} {it.unit} {it.cashInLieuAmount && `(UGX ${parseInt(it.cashInLieuAmount).toLocaleString()})`}
                        </span>
                      </div>
                    ))}
                    {bp.items.length > 4 && (
                      <p className="text-xs text-emerald-600 font-semibold">+ {bp.items.length - 4} more items</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs text-emerald-600 font-bold">✓ Active Blueprint</span>
                  <button
                    onClick={async () => {
                      if (!confirm(`Assign blueprint '${bp.title}' to all enrolled students in ${bp.class?.name}?`)) return;
                      const res = await fetch(`/api/requirements/blueprints/${bp.id}/assign`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ academicYearId: selectedYearId }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        alert(`Assigned to ${data.assignedCount} students (${data.skippedCount} skipped).`);
                        setActiveTab('TRACKER');
                      } else {
                        alert('Assignment failed');
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-sm"
                  >
                    👥 Assign to Class
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ITEM CATALOG */}
      {activeTab === 'CATALOG' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-900">Standard Requirement Catalog ({catalogItems.length})</h2>
            <button
              onClick={() => setShowCatalogModal(true)}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm"
            >
              + Add Catalog Item
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {catalogItems.map((it) => (
              <div key={it.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
                <div className="flex justify-between items-start">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${CATEGORY_COLORS[it.category] || 'bg-gray-100 text-gray-700'}`}>
                    {it.category}
                  </span>
                  <span className="text-xs font-mono text-gray-400 font-bold">{it.code}</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900">{it.name}</h3>
                <div className="flex justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
                  <span>Unit: <b className="text-gray-900">{it.unit}</b></span>
                  <span>Cash-in-lieu: <b className="text-emerald-700 font-mono">{it.defaultCashInLieu ? `UGX ${parseInt(it.defaultCashInLieu).toLocaleString()}` : 'N/A'}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STOREKEEPER TALLY */}
      {activeTab === 'STORE_TALLY' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-4">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                Storekeeper Physical Goods Custody Tally
              </h2>
              <p className="text-xs text-gray-500">Aggregated quantities received for school store inventory transfer.</p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-bold bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              🖨️ Print Tally Sheet
            </button>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
              <tr>
                <th className="p-3">Requirement Item</th>
                <th className="p-3">Category</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Total Required</th>
                <th className="p-3 text-emerald-700">Physical Received</th>
                <th className="p-3 text-purple-700">Monetized (Cash)</th>
                <th className="p-3 text-red-600">Pending</th>
                <th className="p-3">Fulfillment %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-xs">
              {storeTally.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-sans font-bold text-gray-900 text-sm">{item.name}</td>
                  <td className="p-3 font-sans">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${CATEGORY_COLORS[item.category] || 'bg-gray-100'}`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 font-sans">{item.unit}</td>
                  <td className="p-3 font-bold text-gray-900">{item.totalRequired}</td>
                  <td className="p-3 font-bold text-emerald-700 bg-emerald-50/50">{item.totalDelivered}</td>
                  <td className="p-3 font-bold text-purple-700 bg-purple-50/50">{item.totalMonetized}</td>
                  <td className="p-3 font-bold text-red-600">{item.totalPending}</td>
                  <td className="p-3 font-bold text-gray-900">{item.fulfillmentRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MARK REQUIREMENTS SLIDE-OVER DRAWER */}
      {activeMarkingRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col justify-between">
            {/* Drawer Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-emerald-900 text-white sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Student Requirements Checklist</span>
                <button
                  onClick={() => setActiveMarkingRecord(null)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>
              <h2 className="text-xl font-bold mt-2">
                {activeMarkingRecord.student.firstName} {activeMarkingRecord.student.lastName}
              </h2>
              <p className="text-xs text-white/80 font-mono mt-0.5">
                Adm: {activeMarkingRecord.student.admissionNo} • {activeMarkingRecord.classRequirement.class?.name}
              </p>
            </div>

            {/* Checklist Items */}
            <div className="p-6 space-y-6 flex-1">
              {activeMarkingRecord.items.map((it) => {
                const reqQty = parseFloat(it.quantityRequired);
                const delQty = parseFloat(it.quantityDelivered);
                const monQty = parseFloat(it.quantityMonetized);
                const unfulfilled = Math.max(0, reqQty - delQty - monQty);

                return (
                  <div key={it.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{it.name}</span>
                          {!it.isMandatory && (
                            <span className="text-xs text-gray-400 font-medium">(optional)</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Required: <b>{it.quantityRequired} {it.unit}</b>
                          {it.cashInLieuAmount && ` • Cash value: UGX ${parseInt(it.cashInLieuAmount).toLocaleString()}`}
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                        it.status === 'FULFILLED' ? 'bg-emerald-100 text-emerald-800' :
                        it.status === 'MONETIZED' ? 'bg-purple-100 text-purple-800' :
                        it.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                        it.status === 'EXEMPTED' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {it.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-gray-200">
                      <span>Physical: <b className="text-emerald-700">{it.quantityDelivered}</b></span>
                      <span>Paid Cash: <b className="text-purple-700">{it.quantityMonetized}</b></span>
                      <span>Remaining: <b className="text-red-600">{unfulfilled}</b></span>
                    </div>

                    {/* Quick Delivery & Monetize Actions */}
                    {unfulfilled > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          onClick={() => handleDeliverItem(it.id, unfulfilled)}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                        >
                          ✓ Deliver All ({unfulfilled} {it.unit})
                        </button>
                        {it.cashInLieuAmount && (
                          <button
                            onClick={() => handleMonetizeItem(it.id, unfulfilled)}
                            className="px-3 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                          >
                            💰 Pay Cash (UGX {(unfulfilled * parseFloat(it.cashInLieuAmount)).toLocaleString()})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setActiveMarkingRecord(null)}
                className="px-5 py-2 text-sm font-bold bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition shadow-sm"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CATALOG MODAL */}
      {showCatalogModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCatalog} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Add Standard Catalog Item</h3>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Item Code</label>
              <input
                type="text"
                required
                placeholder="e.g. A4_PAPER"
                value={newCatCode}
                onChange={(e) => setNewCatCode(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg p-2 font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Item Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Rotatrim A4 Copier Paper"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg p-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                <select
                  value={newCatCategory}
                  onChange={(e) => setNewCatCategory(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2"
                >
                  <option value="ACADEMIC_STATIONERY">Academic &amp; Stationery</option>
                  <option value="CLEANING_HYGIENE">Cleaning &amp; Hygiene</option>
                  <option value="BOARDING_PERSONAL">Boarding &amp; Personal</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Unit of Measure</label>
                <select
                  value={newCatUnit}
                  onChange={(e) => setNewCatUnit(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2"
                >
                  <option value="REAM">Ream</option>
                  <option value="ROLL">Roll</option>
                  <option value="PIECE">Piece</option>
                  <option value="BAR">Bar</option>
                  <option value="BOTTLE">Bottle</option>
                  <option value="BOOK">Book</option>
                  <option value="SET">Set</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Default Cash-in-Lieu (UGX)</label>
              <input
                type="number"
                placeholder="e.g. 35000"
                value={newCatCashInLieu}
                onChange={(e) => setNewCatCashInLieu(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg p-2 font-mono"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"
              >
                Save Catalog Item
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
