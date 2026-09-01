'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function StaffForm({ 
  departments, 
  employeeTypes,
  initialData
}: { 
  departments: { id: string; name: string }[],
  employeeTypes: { id: string; name: string }[],
  initialData?: { id: string; firstName: string; lastName: string; employeeCode: string; email: string | null; phone: string | null; departmentId: string | null; employeeTypeId: string; status: string } 
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch(`/api/staff${initialData ? `/${initialData.id}` : ''}`, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      router.push('/staff');
      router.refresh();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-100 text-red-800 rounded">{error}</div>}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">First Name *</label>
          <input required name="firstName" defaultValue={initialData?.firstName} className="w-full p-2 border rounded" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Last Name *</label>
          <input required name="lastName" defaultValue={initialData?.lastName} className="w-full p-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Employee Code *</label>
          <input required name="employeeCode" defaultValue={initialData?.employeeCode || ""} className="w-full p-2 border rounded" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <input type="email" name="email" defaultValue={initialData?.email || ""} className="w-full p-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Employee Type *</label>
          <select required name="employeeTypeId" defaultValue={initialData?.employeeTypeId || ""} className="w-full p-2 border rounded bg-white">
            <option value="" disabled>Select Type</option>
            {employeeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Department</label>
          <select name="departmentId" defaultValue={initialData?.departmentId || ""} className="w-full p-2 border rounded bg-white">
            <option value="">None</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <select name="status" defaultValue={initialData?.status || "ACTIVE"} className="w-full p-2 border rounded bg-white">
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="TERMINATED">TERMINATED</option>
          </select>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Employee'}</Button>
      </div>
    </form>
  );
}
