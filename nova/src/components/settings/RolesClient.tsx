"use client";

import { useState } from "react";
import { createRoleAction, updateRoleAction, deleteRoleAction } from "@/app/(dashboard)/settings/roles/actions";
import { Edit2, Trash2, Plus, X } from "lucide-react";

const AVAILABLE_PERMISSIONS = [
  { id: 'all', label: 'Super Admin (All Access)' },
  { id: 'students:read', label: 'View Students' },
  { id: 'students:write', label: 'Manage Students' },
  { id: 'attendance:read', label: 'View Attendance' },
  { id: 'attendance:write', label: 'Manage Attendance' },
  { id: 'curriculum:read', label: 'View Curriculum' },
  { id: 'curriculum:write', label: 'Manage Curriculum' },
  { id: 'assessments:read', label: 'View Assessments' },
  { id: 'assessments:write', label: 'Manage Assessments' },
  { id: 'finance:read', label: 'View Finance' },
  { id: 'finance:write', label: 'Manage Finance' },
];

export default function RolesClient({ initialRoles }: { initialRoles: import('@prisma/client').Role[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<import('@prisma/client').Role | null>(null);
  const [formData, setFormData] = useState({ name: '', permissions: [] as string[] });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openModal = (role?: import('@prisma/client').Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({ name: role.name, permissions: role.permissions });
    } else {
      setEditingRole(null);
      setFormData({ name: '', permissions: [] });
    }
    setError('');
    setIsModalOpen(true);
  };

  const handleTogglePermission = (permId: string) => {
    setFormData(prev => {
      // If they toggle 'all', just set it exclusively or clear it
      if (permId === 'all') {
        return { ...prev, permissions: prev.permissions.includes('all') ? [] : ['all'] };
      }

      // If 'all' is currently checked, uncheck it if they select something else?
      // Actually better to just toggle normally, and if 'all' is there, the backend respects it.
      let newPerms = prev.permissions.filter(p => p !== 'all'); // remove 'all' if they check specific
      
      if (prev.permissions.includes(permId)) {
        newPerms = newPerms.filter(p => p !== permId);
      } else {
        newPerms.push(permId);
      }
      return { ...prev, permissions: newPerms };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      if (editingRole) {
        await updateRoleAction(editingRole.id, formData);
      } else {
        await createRoleAction(formData);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      setError(((err as Error).message) || 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (role: import('@prisma/client').Role) => {
    if (confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      try {
        await deleteRoleAction(role.id);
      } catch (err: unknown) {
        alert(((err as Error).message) || "Failed to delete role.");
      }
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-medium text-slate-900">Organizational Roles</h2>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Plus size={16} /> New Role
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-300">
          <thead className="bg-slate-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Role Name</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Permissions</th>
              <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {initialRoles.map((role) => (
              <tr key={role.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                  {role.name}
                </td>
                <td className="py-4 px-3 text-sm text-slate-500">
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p: string) => (
                      <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button onClick={() => openModal(role)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(role)} className="text-red-600 hover:text-red-900">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {initialRoles.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-sm text-slate-500">No roles found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 text-center">
            <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)} />
            <div className="inline-block w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all relative z-20">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-slate-900">
                  {editingRole ? 'Edit Role' : 'Create Role'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Role Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-slate-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Permissions</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                    {AVAILABLE_PERMISSIONS.map(perm => (
                      <div key={perm.id} className="flex items-start">
                        <div className="flex h-5 items-center">
                          <input
                            id={`perm-${perm.id}`}
                            type="checkbox"
                            checked={formData.permissions.includes(perm.id)}
                            onChange={() => handleTogglePermission(perm.id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor={`perm-${perm.id}`} className="font-medium text-slate-700">
                            {perm.label}
                          </label>
                          <p className="text-slate-500 text-xs">{perm.id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-md border border-slate-300 bg-white py-2 px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
