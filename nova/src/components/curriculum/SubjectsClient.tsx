"use client";

import { useState } from "react";
import { Subject } from "@prisma/client";
import { createSubjectAction, updateSubjectAction } from "@/app/(dashboard)/curriculum/subjects/actions";

export default function SubjectsClient({ initialSubjects }: { initialSubjects: Subject[] }) {
  const [subjects] = useState(initialSubjects);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (editingId) {
      const res = await updateSubjectAction(editingId, formData);
      if (res.error) setError(res.error);
      else {
        setEditingId(null);
        window.location.reload();
      }
    } else {
      const res = await createSubjectAction(formData);
      if (res.error) setError(res.error);
      else {
        setIsCreating(false);
        window.location.reload();
      }
    }
  };

  const handleEdit = (subject: Subject) => {
    setFormData({ name: subject.name, code: subject.code, description: subject.description || "" });
    setEditingId(subject.id);
  };

  const toggleActive = async (subject: Subject) => {
    const res = await updateSubjectAction(subject.id, { isActive: !subject.isActive });
    if (!res.error) {
      window.location.reload();
    }
  };

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}
      
      <div className="mb-4">
        {!isCreating && !editingId ? (
          <button 
            onClick={() => { setIsCreating(true); setFormData({ name: "", code: "", description: "" }); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            New Subject
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-4 rounded-md shadow flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
              <input required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="border rounded-md px-3 py-2 text-sm w-32 text-black" placeholder="e.g. MTH" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="border rounded-md px-3 py-2 text-sm w-48 text-black" placeholder="e.g. Mathematics" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="border rounded-md px-3 py-2 text-sm w-full text-black" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm">Save</button>
              <button type="button" onClick={() => { setIsCreating(false); setEditingId(null); }} className="bg-white border text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white shadow rounded-md overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Code</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Name</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
              <th className="px-6 py-3 text-right font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {subjects.map(s => (
              <tr key={s.id}>
                <td className="px-6 py-4 font-medium text-black">{s.code}</td>
                <td className="px-6 py-4 text-black">{s.name}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button onClick={() => handleEdit(s)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                  <button onClick={() => toggleActive(s)} className={`${s.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}>
                    {s.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No subjects found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
