'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function EmployeeTypeForm({ 
  initialData
}: { 
  initialData?: { id: string; name: string; description: string | null; isTeachingStaff: boolean } 
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
      isTeachingStaff: formData.get('isTeachingStaff') === 'on'
    };

    try {
      const res = await fetch(`/api/employee-types${initialData ? `/${initialData.id}` : ''}`, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      router.push('/staff/types');
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
        <label className="text-sm font-medium">Type Name *</label>
        <input required name="name" defaultValue={initialData?.name} className="w-full p-2 border rounded" />
      </div>

      <div className="space-y-2">
        <textarea name="description" defaultValue={initialData?.description || ""} className="w-full p-2 border rounded" rows={3} />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <input 
          type="checkbox" 
          id="isTeachingStaff" 
          name="isTeachingStaff" 
          defaultChecked={initialData?.isTeachingStaff} 
          className="w-4 h-4"
        />
        <label htmlFor="isTeachingStaff" className="text-sm font-medium">
          Is Teaching Staff?
        </label>
      </div>
      <p className="text-xs text-slate-500 ml-6">Checking this box allows employees of this type to be assigned to classes as teachers.</p>

      <div className="pt-4 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Employee Type'}</Button>
      </div>
    </form>
  );
}
