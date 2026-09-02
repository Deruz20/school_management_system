'use client';

import React, { useState, useEffect } from 'react';

interface RouteStop {
  id: string;
  stopName: string;
  landmark: string | null;
  sequenceOrder: number;
  morningPickupTime: string | null;
  eveningDropTime: string | null;
  surchargeAmount: string | number;
}

interface TransportRoute {
  id: string;
  code: string;
  name: string;
  description: string | null;
  destinationZone: string | null;
  twoWayFee: string | number;
  oneWayFee: string | number;
  isActive: boolean;
  stops: RouteStop[];
  assignments?: Array<{
    id: string;
    vehicle: { id: string; registrationNumber: string; capacity: number };
    driver: { id: string; fullName: string; phone: string } | null;
  }>;
  _count?: {
    subscriptions: number;
  };
}

interface TransportVehicle {
  id: string;
  registrationNumber: string;
  makeModel: string;
  capacity: number;
  fuelType: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  insuranceExpiry: string | null;
  inspectionDueDate: string | null;
  currentOdometerKm: number;
  notes: string | null;
  assignments?: Array<{
    route: { id: string; code: string; name: string };
    driver: { id: string; fullName: string } | null;
  }>;
}

interface TransportDriver {
  id: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string | null;
  isActive: boolean;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
}

interface StudentSubscription {
  id: string;
  studentId: string;
  routeId: string;
  stopId: string | null;
  subscriptionType: 'TWO_WAY' | 'ONE_WAY_MORNING' | 'ONE_WAY_EVENING';
  status: 'REQUESTED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  routeNameSnapshot: string;
  stopNameSnapshot: string | null;
  baseFeeSnapshot: string | number;
  stopSurchargeSnapshot: string | number;
  finalFeeAmount: string | number;
  invoiceItemId: string | null;
  student: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
    classRef?: { id: string; name: string } | null;
  };
  route: { id: string; code: string; name: string };
  stop?: { id: string; stopName: string } | null;
}

interface FuelLog {
  id: string;
  vehicleId: string;
  logDate: string;
  odometerKm: number;
  litersFilled: string | number;
  unitPrice: string | number;
  totalCost: string | number;
  fuelStation: string;
  receiptNumber: string | null;
  vehicle: { id: string; registrationNumber: string; makeModel: string };
  driver?: { id: string; fullName: string } | null;
  expenseId: string | null;
}

interface MaintenanceLog {
  id: string;
  vehicleId: string;
  maintenanceDate: string;
  maintenanceType: 'ROUTINE_SERVICE' | 'REPAIR' | 'TYRES' | 'INSPECTION' | 'BATTERY' | 'OTHER';
  garageName: string;
  description: string;
  partsCost: string | number;
  laborCost: string | number;
  totalCost: string | number;
  odometerAtService: number | null;
  nextServiceKm: number | null;
  isVoided: boolean;
  voidReason: string | null;
  vehicle: { id: string; registrationNumber: string };
  expenseId: string | null;
}

interface FleetEfficiencyItem {
  vehicleId: string;
  registrationNumber: string;
  makeModel: string;
  capacity: number;
  status: string;
  currentOdometerKm: number;
  kmDriven: number;
  totalLiters: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalOperatingCost: number;
  kmPerLiter: number;
  fuelCostPerKm: number;
  activeSubscribers: number;
  capacityUtilizationPercent: number;
}

interface ManifestPassenger {
  subscriptionId: string;
  studentId: string;
  admissionNo: string;
  studentName: string;
  className: string;
}

interface ManifestStop {
  stopId: string;
  stopName: string;
  landmark: string | null;
  sequenceOrder: number;
  time: string | null;
  studentsCount: number;
  students: ManifestPassenger[];
}

interface ManifestPayload {
  route?: { id: string; code: string; name: string; destinationZone: string | null };
  vehicle?: { id: string; plate: string; makeModel: string; capacity: number } | null;
  driver?: { id: string; name: string; phone: string } | null;
  tripType: string;
  generatedAt: string;
  totalPassengers: number;
  vehicleCapacity: number;
  loadFactorPercent: number;
  isOverloaded: boolean;
  stops: ManifestStop[];
}

export default function TransportHubPage() {
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'routes' | 'fleet' | 'logs' | 'analytics'>('subscriptions');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Core Data
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [drivers, setDrivers] = useState<TransportDriver[]>([]);
  const [subscriptions, setSubscriptions] = useState<StudentSubscription[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [fleetReport, setFleetReport] = useState<FleetEfficiencyItem[]>([]);

  // Modals
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [manifestData, setManifestData] = useState<ManifestPayload | null>(null);

  // Form States
  const [routeForm, setRouteForm] = useState({
    code: '',
    name: '',
    description: '',
    destinationZone: '',
    twoWayFee: '',
    oneWayFee: '',
    academicYearId: '',
    termId: '',
  });

  const [vehicleForm, setVehicleForm] = useState<{
    registrationNumber: string;
    makeModel: string;
    capacity: number;
    fuelType: string;
    status: 'ACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
    insuranceExpiry: string;
    inspectionDueDate: string;
    notes: string;
  }>({
    registrationNumber: '',
    makeModel: '',
    capacity: 30,
    fuelType: 'DIESEL',
    status: 'ACTIVE',
    insuranceExpiry: '',
    inspectionDueDate: '',
    notes: '',
  });

  const [driverForm, setDriverForm] = useState({
    fullName: '',
    phone: '',
    licenseNumber: '',
    licenseClass: 'CM, CH',
    licenseExpiry: '',
    notes: '',
  });

  const [subForm, setSubForm] = useState<{
    studentId: string;
    routeId: string;
    stopId: string;
    academicYearId: string;
    termId: string;
    subscriptionType: 'TWO_WAY' | 'ONE_WAY_MORNING' | 'ONE_WAY_EVENING';
    overrideJustification: string;
    notes: string;
  }>({
    studentId: '',
    routeId: '',
    stopId: '',
    academicYearId: '',
    termId: '',
    subscriptionType: 'TWO_WAY',
    overrideJustification: '',
    notes: '',
  });

  const [fuelForm, setFuelForm] = useState({
    vehicleId: '',
    odometerKm: '',
    litersFilled: '',
    unitPrice: '',
    totalCost: '',
    fuelStation: '',
    receiptNumber: '',
    paymentMethod: 'CASH',
  });

  const [maintForm, setMaintForm] = useState<{
    vehicleId: string;
    maintenanceType: 'ROUTINE_SERVICE' | 'REPAIR' | 'TYRES' | 'INSPECTION' | 'BATTERY' | 'OTHER';
    garageName: string;
    description: string;
    partsCost: string;
    laborCost: string;
    totalCost: string;
    odometerAtService: string;
    paymentMethod: string;
  }>({
    vehicleId: '',
    maintenanceType: 'ROUTINE_SERVICE',
    garageName: '',
    description: '',
    partsCost: '0',
    laborCost: '0',
    totalCost: '',
    odometerAtService: '',
    paymentMethod: 'BANK_TRANSFER',
  });

  const [billingForm, setBillingForm] = useState({
    academicYearId: '',
    termId: '',
  });

  const [manifestForm, setManifestForm] = useState<{
    routeId: string;
    academicYearId: string;
    termId: string;
    tripType: 'MORNING' | 'EVENING';
  }>({
    routeId: '',
    academicYearId: '',
    termId: '',
    tripType: 'MORNING',
  });

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [resRoutes, resVehicles, resDrivers, resSubs, resFuel, resMaint, resFleet] = await Promise.all([
        fetch('/api/transport/routes').then((r) => r.json()).catch(() => ({ routes: [] })),
        fetch('/api/transport/vehicles').then((r) => r.json()).catch(() => ({ vehicles: [] })),
        fetch('/api/transport/drivers').then((r) => r.json()).catch(() => ({ drivers: [] })),
        fetch('/api/transport/subscriptions').then((r) => r.json()).catch(() => ({ subscriptions: [] })),
        fetch('/api/transport/fuel').then((r) => r.json()).catch(() => ({ fuelLogs: [] })),
        fetch('/api/transport/maintenance').then((r) => r.json()).catch(() => ({ maintenanceLogs: [] })),
        fetch('/api/transport/reports/fleet').then((r) => r.json()).catch(() => ({ report: [] })),
      ]);

      if (resRoutes.routes) setRoutes(resRoutes.routes);
      if (resVehicles.vehicles) setVehicles(resVehicles.vehicles);
      if (resDrivers.drivers) setDrivers(resDrivers.drivers);
      if (resSubs.subscriptions) setSubscriptions(resSubs.subscriptions);
      if (resFuel.fuelLogs) setFuelLogs(resFuel.fuelLogs);
      if (resMaint.maintenanceLogs) setMaintenanceLogs(resMaint.maintenanceLogs);
      if (resFleet.report) setFleetReport(resFleet.report);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message || 'Failed to load transport data' });
    } finally {
      setLoading(false);
    }
  }

  // Handlers
  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/transport/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setFeedback({ type: 'success', message: 'Transport route created successfully!' });
      setShowRouteModal(false);
      loadAllData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterVehicle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/transport/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setFeedback({ type: 'success', message: 'Vehicle registered successfully!' });
      setShowVehicleModal(false);
      loadAllData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterDriver(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/transport/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(driverForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setFeedback({ type: 'success', message: 'Driver registered successfully!' });
      setShowDriverModal(false);
      loadAllData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribeStudent(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/transport/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setFeedback({ type: 'success', message: 'Student enrolled in transport route successfully!' });
      setShowSubModal(false);
      loadAllData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogFuel(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/transport/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fuelForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setFeedback({ type: 'success', message: 'Fuel purchase logged and Expense voucher created!' });
      setShowFuelModal(false);
      loadAllData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogMaintenance(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/transport/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setFeedback({ type: 'success', message: 'Vehicle maintenance logged and Expense voucher created!' });
      setShowMaintModal(false);
      loadAllData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkBill(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/transport/billing/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billingForm),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setFeedback({
        type: 'success',
        message: `Successfully billed ${result.billedCount} subscriptions (Total UGX ${Number(result.totalBilledAmount).toLocaleString()})!`,
      });
      setShowBillingModal(false);
      loadAllData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateManifest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const query = new URLSearchParams({
        routeId: manifestForm.routeId,
        academicYearId: manifestForm.academicYearId,
        tripType: manifestForm.tripType,
        ...(manifestForm.termId ? { termId: manifestForm.termId } : {}),
      });
      const res = await fetch(`/api/transport/manifest?${query}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setManifestData(json.manifest);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSubscription(id: string) {
    const reason = prompt('Please enter the reason for subscription cancellation:');
    if (!reason) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/transport/subscriptions/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellationReason: reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      setFeedback({ type: 'success', message: 'Subscription cancelled successfully.' });
      loadAllData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  // Summary Metrics
  const activeSubsCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const activeVehiclesCount = vehicles.filter((v) => v.status === 'ACTIVE').length;
  const totalFuelCost = fuelLogs.reduce((acc, f) => acc + Number(f.totalCost), 0);
  const totalMaintCost = maintenanceLogs.filter((m) => !m.isVoided).reduce((acc, m) => acc + Number(m.totalCost), 0);
  const totalOperatingCosts = totalFuelCost + totalMaintCost;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded-full border border-amber-500/20 tracking-wide uppercase">
              Phase 3.1I
            </span>
            <span className="text-slate-400 text-sm font-medium">Finance &amp; Operations</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">School Transport &amp; Fleet Operations Hub</h1>
          <p className="text-slate-400 text-sm">
            Manage transport routes, vehicles, driver assignments, passenger rosters, automated billing, and fleet cost efficiency.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSubModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition duration-150 flex items-center gap-2"
          >
            <span>+ Enroll Student</span>
          </button>
          <button
            onClick={() => setShowBillingModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition duration-150 flex items-center gap-2"
          >
            <span>⚡ Bulk Bill Fees</span>
          </button>
          <button
            onClick={() => setShowManifestModal(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 transition duration-150 flex items-center gap-2"
          >
            <span>📋 Daily Manifest</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-xs uppercase font-bold opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Subscriptions</div>
          <div className="text-3xl font-black text-white mt-1">{activeSubsCount}</div>
          <div className="text-slate-500 text-xs mt-1">Students enrolled in daily commute</div>
        </div>

        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Fleet</div>
          <div className="text-3xl font-black text-amber-400 mt-1">
            {activeVehiclesCount} <span className="text-sm font-normal text-slate-400">/ {vehicles.length}</span>
          </div>
          <div className="text-slate-500 text-xs mt-1">Certified buses &amp; vans operating</div>
        </div>

        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Active Routes</div>
          <div className="text-3xl font-black text-indigo-400 mt-1">{routes.filter((r) => r.isActive).length}</div>
          <div className="text-slate-500 text-xs mt-1">Mapped school transit routes</div>
        </div>

        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Fleet Operating Costs</div>
          <div className="text-2xl font-black text-rose-400 mt-1">
            UGX {totalOperatingCosts.toLocaleString()}
          </div>
          <div className="text-slate-500 text-xs mt-1">Fuel &amp; Garage Maintenance Vouchers</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'subscriptions'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Subscriptions &amp; Rosters ({subscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'routes'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Routes &amp; Stages ({routes.length})
        </button>
        <button
          onClick={() => setActiveTab('fleet')}
          className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'fleet'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Fleet &amp; Drivers ({vehicles.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'logs'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Fuel &amp; Maintenance ({fuelLogs.length + maintenanceLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'analytics'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Profitability &amp; Analytics
        </button>
      </div>

      {/* Tab 1: Subscriptions Table */}
      {activeTab === 'subscriptions' && (
        <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Student Transport Subscriptions</h2>
            <button
              onClick={() => setShowSubModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
            >
              + Enroll Student
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Pickup / Drop Stage</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Fee (UGX)</th>
                  <th className="p-3 text-center">Billing</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      No student transport subscriptions found.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-semibold text-white">
                        {s.student?.firstName} {s.student?.lastName}
                        <div className="text-xs text-slate-500 font-normal">{s.student?.admissionNo}</div>
                      </td>
                      <td className="p-3">{s.student?.classRef?.name || 'N/A'}</td>
                      <td className="p-3">
                        <span className="font-semibold text-indigo-400">{s.routeNameSnapshot}</span>
                      </td>
                      <td className="p-3 text-slate-400">{s.stopNameSnapshot || 'Main Route Stop'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded border border-slate-700">
                          {s.subscriptionType}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold text-white">
                        {Number(s.finalFeeAmount).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        {s.invoiceItemId ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-full">
                            BILLED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs rounded-full">
                            UNBILLED
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {s.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleCancelSubscription(s.id)}
                            className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold"
                          >
                            Cancel
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

      {/* Tab 2: Routes Table */}
      {activeTab === 'routes' && (
        <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Transport Routes &amp; Pricing Catalog</h2>
            <button
              onClick={() => setShowRouteModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
            >
              + Create Route
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routes.map((r) => (
              <div key={r.id} className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-xs font-bold rounded border border-indigo-500/20">
                      {r.code}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">{r.name}</h3>
                    <p className="text-xs text-slate-400">{r.description || 'No description provided.'}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      r.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {r.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/40 text-xs">
                  <div>
                    <span className="text-slate-400">Two-Way Term Fee:</span>
                    <div className="font-bold text-white">UGX {Number(r.twoWayFee).toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">One-Way Term Fee:</span>
                    <div className="font-bold text-white">UGX {Number(r.oneWayFee).toLocaleString()}</div>
                  </div>
                </div>

                {r.stops && r.stops.length > 0 && (
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Designated Stops ({r.stops.length}):
                    </div>
                    <div className="space-y-1">
                      {r.stops.map((st) => (
                        <div key={st.id} className="flex justify-between text-xs bg-slate-900/60 p-2 rounded border border-slate-800">
                          <span className="text-slate-200">
                            {st.sequenceOrder}. {st.stopName}
                          </span>
                          <span className="text-amber-400 font-semibold">
                            {Number(st.surchargeAmount) > 0 ? `+UGX ${Number(st.surchargeAmount).toLocaleString()}` : 'No surcharge'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Fleet & Drivers Directory */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">School Fleet Directory</h2>
              <button
                onClick={() => setShowVehicleModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
              >
                + Register Vehicle
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vehicles.map((v) => (
                <div key={v.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-black text-amber-400 tracking-wider">{v.registrationNumber}</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        v.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white">{v.makeModel}</div>
                  <div className="text-xs text-slate-400">
                    Capacity: <span className="text-white font-bold">{v.capacity} Seats</span> | Fuel:{' '}
                    <span className="text-white font-bold">{v.fuelType}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Odometer: <span className="text-white font-bold">{v.currentOdometerKm.toLocaleString()} KM</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Licensed Drivers Directory</h2>
              <button
                onClick={() => setShowDriverModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
              >
                + Register Driver
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {drivers.map((d) => (
                <div key={d.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">{d.fullName}</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        d.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {d.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Phone: <span className="text-white font-semibold">{d.phone}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    License: <span className="text-indigo-400 font-semibold">{d.licenseNumber}</span> ({d.licenseClass})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Fuel & Maintenance Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Vehicle Fuel Purchases</h2>
              <button
                onClick={() => setShowFuelModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
              >
                + Log Fuel Purchase
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Vehicle</th>
                    <th className="p-3">Odometer</th>
                    <th className="p-3">Liters</th>
                    <th className="p-3">Price / L</th>
                    <th className="p-3 text-right">Total Cost (UGX)</th>
                    <th className="p-3">Fuel Station</th>
                    <th className="p-3 text-center">Expense Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {fuelLogs.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3">{new Date(f.logDate).toLocaleDateString()}</td>
                      <td className="p-3 font-semibold text-white">{f.vehicle?.registrationNumber}</td>
                      <td className="p-3">{f.odometerKm.toLocaleString()} KM</td>
                      <td className="p-3">{Number(f.litersFilled).toFixed(1)} L</td>
                      <td className="p-3">UGX {Number(f.unitPrice).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-white">
                        {Number(f.totalCost).toLocaleString()}
                      </td>
                      <td className="p-3 text-slate-400">{f.fuelStation}</td>
                      <td className="p-3 text-center">
                        {f.expenseId ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-full">
                            LINKED
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">NONE</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Vehicle Maintenance &amp; Repairs</h2>
              <button
                onClick={() => setShowMaintModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
              >
                + Log Maintenance
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Vehicle</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Garage</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Total (UGX)</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {maintenanceLogs.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3">{new Date(m.maintenanceDate).toLocaleDateString()}</td>
                      <td className="p-3 font-semibold text-white">{m.vehicle?.registrationNumber}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded border border-slate-700">
                          {m.maintenanceType}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">{m.garageName}</td>
                      <td className="p-3 text-xs text-slate-400">{m.description}</td>
                      <td className="p-3 text-right font-bold text-white">
                        {Number(m.totalCost).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        {m.isVoided ? (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs rounded-full">
                            VOIDED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-full">
                            ACTIVE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Analytics & Fleet Efficiency */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Fleet Operating Efficiency &amp; Utilization</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Vehicle</th>
                    <th className="p-3">Capacity</th>
                    <th className="p-3 text-right">KM Driven</th>
                    <th className="p-3 text-right">Fuel Consumed</th>
                    <th className="p-3 text-right">Economy (KM/L)</th>
                    <th className="p-3 text-right">Fuel Cost</th>
                    <th className="p-3 text-right">Maintenance Cost</th>
                    <th className="p-3 text-right">Utilization %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {fleetReport.map((v) => (
                    <tr key={v.vehicleId} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-semibold text-white">{v.registrationNumber}</td>
                      <td className="p-3">{v.capacity} Seats</td>
                      <td className="p-3 text-right font-semibold text-slate-200">{v.kmDriven.toLocaleString()} KM</td>
                      <td className="p-3 text-right">{v.totalLiters.toFixed(1)} L</td>
                      <td className="p-3 text-right font-bold text-indigo-400">{v.kmPerLiter} KM/L</td>
                      <td className="p-3 text-right font-semibold text-white">UGX {v.totalFuelCost.toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold text-white">UGX {v.totalMaintenanceCost.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-amber-400">{v.capacityUtilizationPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Route Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Create New Transport Route</h3>
              <button onClick={() => setShowRouteModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateRoute} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Route Code</label>
                <input
                  type="text"
                  placeholder="e.g. RT-01"
                  value={routeForm.code}
                  onChange={(e) => setRouteForm({ ...routeForm, code: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Route Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ntinda - Kisaasi Route"
                  value={routeForm.name}
                  onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Two-Way Fee (UGX)</label>
                  <input
                    type="number"
                    placeholder="450000"
                    value={routeForm.twoWayFee}
                    onChange={(e) => setRouteForm({ ...routeForm, twoWayFee: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">One-Way Fee (UGX)</label>
                  <input
                    type="number"
                    placeholder="280000"
                    value={routeForm.oneWayFee}
                    onChange={(e) => setRouteForm({ ...routeForm, oneWayFee: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Academic Year ID</label>
                <input
                  type="text"
                  placeholder="Academic Year CUID"
                  value={routeForm.academicYearId}
                  onChange={(e) => setRouteForm({ ...routeForm, academicYearId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRouteModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm"
                >
                  Save Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Vehicle Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Register School Vehicle</h3>
              <button onClick={() => setShowVehicleModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleRegisterVehicle} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Registration Plate</label>
                <input
                  type="text"
                  placeholder="e.g. UBJ 412X"
                  value={vehicleForm.registrationNumber}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, registrationNumber: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Make &amp; Model</label>
                <input
                  type="text"
                  placeholder="e.g. Toyota Coaster 30-Seater"
                  value={vehicleForm.makeModel}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, makeModel: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Capacity (Seats)</label>
                  <input
                    type="number"
                    value={vehicleForm.capacity}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: Number(e.target.value) })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fuel Type</label>
                  <select
                    value={vehicleForm.fuelType}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, fuelType: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  >
                    <option value="DIESEL">Diesel</option>
                    <option value="PETROL">Petrol</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Driver Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Register Driver</h3>
              <button onClick={() => setShowDriverModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleRegisterDriver} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Mukasa"
                  value={driverForm.fullName}
                  onChange={(e) => setDriverForm({ ...driverForm, fullName: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+256772123456"
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">License Number</label>
                  <input
                    type="text"
                    placeholder="DL-UG-998822"
                    value={driverForm.licenseNumber}
                    onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">License Class</label>
                  <input
                    type="text"
                    placeholder="CM, CH"
                    value={driverForm.licenseClass}
                    onChange={(e) => setDriverForm({ ...driverForm, licenseClass: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDriverModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm"
                >
                  Save Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Fuel Purchase Modal */}
      {showFuelModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Log Vehicle Fuel Purchase</h3>
              <button onClick={() => setShowFuelModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleLogFuel} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Vehicle</label>
                <select
                  value={fuelForm.vehicleId}
                  onChange={(e) => setFuelForm({ ...fuelForm, vehicleId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNumber} - {v.makeModel} ({v.currentOdometerKm} KM)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">New Odometer (KM)</label>
                  <input
                    type="number"
                    placeholder="e.g. 45000"
                    value={fuelForm.odometerKm}
                    onChange={(e) => setFuelForm({ ...fuelForm, odometerKm: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Liters Filled</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 50"
                    value={fuelForm.litersFilled}
                    onChange={(e) => {
                      const liters = Number(e.target.value);
                      const price = Number(fuelForm.unitPrice);
                      setFuelForm({
                        ...fuelForm,
                        litersFilled: e.target.value,
                        totalCost: price > 0 ? String(liters * price) : fuelForm.totalCost,
                      });
                    }}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Price / L (UGX)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5200"
                    value={fuelForm.unitPrice}
                    onChange={(e) => {
                      const price = Number(e.target.value);
                      const liters = Number(fuelForm.litersFilled);
                      setFuelForm({
                        ...fuelForm,
                        unitPrice: e.target.value,
                        totalCost: liters > 0 ? String(liters * price) : fuelForm.totalCost,
                      });
                    }}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Total Cost (UGX)</label>
                  <input
                    type="number"
                    placeholder="Total UGX"
                    value={fuelForm.totalCost}
                    onChange={(e) => setFuelForm({ ...fuelForm, totalCost: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Fuel Station</label>
                <input
                  type="text"
                  placeholder="e.g. TotalEnergies Ntinda"
                  value={fuelForm.fuelStation}
                  onChange={(e) => setFuelForm({ ...fuelForm, fuelStation: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFuelModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm"
                >
                  Save &amp; Generate Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Maintenance Modal */}
      {showMaintModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Log Vehicle Maintenance</h3>
              <button onClick={() => setShowMaintModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleLogMaintenance} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Vehicle</label>
                <select
                  value={maintForm.vehicleId}
                  onChange={(e) => setMaintForm({ ...maintForm, vehicleId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNumber} - {v.makeModel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Service Type</label>
                  <select
                    value={maintForm.maintenanceType}
                    onChange={(e) =>
                      setMaintForm({
                        ...maintForm,
                        maintenanceType: e.target.value as
                          | 'ROUTINE_SERVICE'
                          | 'REPAIR'
                          | 'TYRES'
                          | 'INSPECTION'
                          | 'BATTERY'
                          | 'OTHER',
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  >
                    <option value="ROUTINE_SERVICE">Routine Service</option>
                    <option value="REPAIR">Repair</option>
                    <option value="TYRES">Tyres</option>
                    <option value="INSPECTION">Inspection</option>
                    <option value="BATTERY">Battery</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Garage / Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. Spear Motors"
                    value={maintForm.garageName}
                    onChange={(e) => setMaintForm({ ...maintForm, garageName: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Work done, parts replaced"
                  value={maintForm.description}
                  onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Parts Cost</label>
                  <input
                    type="number"
                    value={maintForm.partsCost}
                    onChange={(e) => {
                      const parts = Number(e.target.value);
                      const labor = Number(maintForm.laborCost);
                      setMaintForm({
                        ...maintForm,
                        partsCost: e.target.value,
                        totalCost: String(parts + labor),
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Labor Cost</label>
                  <input
                    type="number"
                    value={maintForm.laborCost}
                    onChange={(e) => {
                      const labor = Number(e.target.value);
                      const parts = Number(maintForm.partsCost);
                      setMaintForm({
                        ...maintForm,
                        laborCost: e.target.value,
                        totalCost: String(parts + labor),
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Total Cost</label>
                  <input
                    type="number"
                    value={maintForm.totalCost}
                    onChange={(e) => setMaintForm({ ...maintForm, totalCost: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMaintModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm"
                >
                  Save &amp; Generate Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Passenger Manifest Modal */}
      {showManifestModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Daily Passenger Commute Manifest</h3>
              <button onClick={() => setShowManifestModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateManifest} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Route</label>
                <select
                  value={manifestForm.routeId}
                  onChange={(e) => setManifestForm({ ...manifestForm, routeId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                >
                  <option value="">Select Route</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Academic Year ID</label>
                <input
                  type="text"
                  placeholder="Academic Year ID"
                  value={manifestForm.academicYearId}
                  onChange={(e) => setManifestForm({ ...manifestForm, academicYearId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Trip Direction</label>
                <select
                  value={manifestForm.tripType}
                  onChange={(e) => setManifestForm({ ...manifestForm, tripType: e.target.value as 'MORNING' | 'EVENING' })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                >
                  <option value="MORNING">Morning Pick-up</option>
                  <option value="EVENING">Evening Drop-off</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full p-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm"
                >
                  Generate Manifest
                </button>
              </div>
            </form>

            {manifestData && (
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="bg-slate-800/60 p-4 rounded-xl flex justify-between items-center">
                  <div>
                    <h4 className="text-base font-bold text-white">{manifestData.route?.name}</h4>
                    <p className="text-xs text-slate-400">
                      Vehicle: <span className="text-white font-semibold">{manifestData.vehicle?.plate || 'Unassigned'}</span> |
                      Driver: <span className="text-white font-semibold">{manifestData.driver?.name || 'Unassigned'}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Load Factor:</span>
                    <div className="text-lg font-bold text-amber-400">
                      {manifestData.totalPassengers} / {manifestData.vehicleCapacity} ({manifestData.loadFactorPercent}%)
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {manifestData.stops?.map((st) => (
                    <div key={st.stopId} className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                      <div className="flex justify-between font-bold text-sm text-slate-200">
                        <span>
                          {st.sequenceOrder}. {st.stopName}
                        </span>
                        <span className="text-amber-400 text-xs">{st.time || 'N/A'}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {st.students?.length} Passengers:
                      </div>
                      <ul className="mt-1 space-y-1">
                        {st.students?.map((stu) => (
                          <li key={stu.subscriptionId} className="text-xs text-slate-300 flex justify-between">
                            <span>• {stu.studentName} ({stu.className})</span>
                            <span className="text-slate-500">{stu.admissionNo}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enroll Student Subscription Modal */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Enroll Student in Transport Route</h3>
              <button onClick={() => setShowSubModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubscribeStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Student ID</label>
                <input
                  type="text"
                  placeholder="Student CUID"
                  value={subForm.studentId}
                  onChange={(e) => setSubForm({ ...subForm, studentId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Route</label>
                <select
                  value={subForm.routeId}
                  onChange={(e) => setSubForm({ ...subForm, routeId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                >
                  <option value="">Choose Route</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Subscription Type</label>
                <select
                  value={subForm.subscriptionType}
                  onChange={(e) => setSubForm({ ...subForm, subscriptionType: e.target.value as 'TWO_WAY' | 'ONE_WAY_MORNING' | 'ONE_WAY_EVENING' })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                >
                  <option value="TWO_WAY">Two-Way (Morning + Evening)</option>
                  <option value="ONE_WAY_MORNING">One-Way (Morning Pick-up Only)</option>
                  <option value="ONE_WAY_EVENING">One-Way (Evening Drop-off Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Academic Year ID</label>
                <input
                  type="text"
                  placeholder="Academic Year ID"
                  value={subForm.academicYearId}
                  onChange={(e) => setSubForm({ ...subForm, academicYearId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Capacity Override Justification (Optional)</label>
                <input
                  type="text"
                  placeholder="Provide reason if vehicle is at capacity"
                  value={subForm.overrideJustification}
                  onChange={(e) => setSubForm({ ...subForm, overrideJustification: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm"
                >
                  Confirm Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Billing Modal */}
      {showBillingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Bulk Bill Transport Fees</h3>
              <button onClick={() => setShowBillingModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              This will automatically post invoice line items and debit the student subledger for all active unbilled subscriptions in the selected term.
            </p>

            <form onSubmit={handleBulkBill} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Academic Year ID</label>
                <input
                  type="text"
                  placeholder="Academic Year ID"
                  value={billingForm.academicYearId}
                  onChange={(e) => setBillingForm({ ...billingForm, academicYearId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Term ID</label>
                <input
                  type="text"
                  placeholder="Term ID"
                  value={billingForm.termId}
                  onChange={(e) => setBillingForm({ ...billingForm, termId: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBillingModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-sm"
                >
                  ⚡ Execute Bulk Billing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
