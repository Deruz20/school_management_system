"use client";

import { useState } from "react";
import { assignUserAction, updateUserRoleAction, removeUserAction } from "@/app/(dashboard)/settings/users/actions";
import { Edit2, Trash2, Plus, X } from "lucide-react";

export default function UsersClient({ branchUsers, orgUsers, roles }: { branchUsers: (import('@prisma/client').UserBranchAccess & { user: import('@prisma/client').User, role: import('@prisma/client').Role })[], orgUsers: import('@prisma/client').User[], roles: import('@prisma/client').Role[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccess, setEditingAccess] = useState<(import('@prisma/client').UserBranchAccess & { user: import('@prisma/client').User, role: import('@prisma/client').Role }) | null>(null);
  const [formData, setFormData] = useState({ userId: '', roleId: '' });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter org users to those not already in the branch (for the Add User dropdown)
  const availableUsers = orgUsers.filter(ou => !branchUsers.some(bu => bu.userId === ou.id));

  const openModal = (access?: import('@prisma/client').UserBranchAccess & { user: import('@prisma/client').User, role: import('@prisma/client').Role }) => {
    if (access) {
      setEditingAccess(access);
      setFormData({ userId: access.userId, roleId: access.roleId });
    } else {
      setEditingAccess(null);
      setFormData({ userId: '', roleId: '' });
    }
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId || !formData.roleId) {
      setError("Please select both a user and a role.");
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (editingAccess) {
        await updateUserRoleAction(formData.userId, formData.roleId);
      } else {
        await assignUserAction(formData.userId, formData.roleId);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      setError(((err as Error).message) || 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (access: import('@prisma/client').UserBranchAccess & { user: import('@prisma/client').User }) => {
    if (confirm(`Are you sure you want to remove ${access.user.firstName} ${access.user.lastName} from this branch?`)) {
      try {
        await removeUserAction(access.userId);
      } catch (err: unknown) {
        alert(((err as Error).message) || "Failed to remove user.");
      }
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-medium text-slate-900">Branch Access</h2>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Plus size={16} /> Assign User
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-300">
          <thead className="bg-slate-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">User Name</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Email</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Assigned Role</th>
              <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {branchUsers.map((access) => (
              <tr key={access.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                  {access.user.firstName} {access.user.lastName}
                </td>
                <td className="whitespace-nowrap py-4 px-3 text-sm text-slate-500">
                  {access.user.email}
                </td>
                <td className="whitespace-nowrap py-4 px-3 text-sm text-slate-500">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {access.role.name}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button onClick={() => openModal(access)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(access)} className="text-red-600 hover:text-red-900">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {branchUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-sm text-slate-500">No users assigned to this branch.</td>
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
                  {editingAccess ? 'Edit Branch Access' : 'Assign User to Branch'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">User</label>
                  {editingAccess ? (
                    <div className="mt-1 block w-full rounded-md border-slate-300 py-2 px-3 shadow-sm bg-slate-50 text-slate-700 sm:text-sm">
                      {editingAccess.user.firstName} {editingAccess.user.lastName} ({editingAccess.user.email})
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.userId}
                      onChange={e => setFormData({ ...formData, userId: e.target.value })}
                      className="mt-1 block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select User</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Role</label>
                  <select
                    required
                    value={formData.roleId}
                    onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                    className="mt-1 block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select Role</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
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
