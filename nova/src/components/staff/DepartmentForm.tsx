'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DepartmentForm({ 
  employees,
  initialData
}: { 
  employees: { id: string; firstName: string; lastName: string; employeeCode: string }[],
  initialData?: { id: string; name: string; description: string | null; hodId: string | null } 
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
      const res = await fetch(`/api/departments${initialData ? `/${initialData.id}` : ''}`, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      router.push('/staff/departments');
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
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Department Name *</label>
        <input required name="name" defaultValue={initialData?.name} className="w-full p-2 border rounded" />
      </div>

      <div className="space-y-2">
        <textarea name="description" defaultValue={initialData?.description || ""} className="w-full p-2 border rounded" rows={3} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Head of Department (HOD)</label>
        <select name="hodId" defaultValue={initialData?.hodId || ""} className="w-full p-2 border rounded bg-white">
          <option value="">None</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
        </select>
      </div>

      <div className="pt-4 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Department'}</Button>
      </div>
    </form>
  );
}
