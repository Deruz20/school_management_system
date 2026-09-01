'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';

interface FeeTypeItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  _count?: { structureItems: number };
}

export default function FeeTypeList({ initialFeeTypes }: { initialFeeTypes: FeeTypeItem[] }) {
  const router = useRouter();
  const [feeTypes, setFeeTypes] = useState<FeeTypeItem[]>(initialFeeTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FeeTypeItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({ name: '', code: '', description: '', isActive: true });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: FeeTypeItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      code: item.code,
      description: item.description || '',
      isActive: item.isActive
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editingItem ? `/api/fee-types/${editingItem.id}` : '/api/fee-types';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to save fee type');
      }

      router.refresh();
      const updatedListRes = await fetch('/api/fee-types');
      if (updatedListRes.ok) {
        const data = await updatedListRes.json();
        setFeeTypes(data);
      }
      closeModal();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete fee type "${name}"?`)) return;

    try {
      const res = await fetch(`/api/fee-types/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errText = await res.text();
        alert(errText || 'Failed to delete fee type');
        return;
      }

      setFeeTypes(prev => prev.filter(item => item.id !== id));
      router.refresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Fee types define the individual fee categories available in fee structures.
        </p>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus size={16} />
          <span>Add Fee Type</span>
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fee Type</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Usage in Structures</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feeTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  No fee types configured yet. Click &quot;Add Fee Type&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              feeTypes.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-slate-900 flex items-center gap-2">
                    <Tag size={14} className="text-slate-400" />
                    <span>{item.name}</span>
                  </TableCell>
                  <TableCell>
                    <code className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-xs font-mono">
                      {item.code}
                    </code>
                  </TableCell>
                  <TableCell className="text-slate-600 max-w-xs truncate">
                    {item.description || '-'}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                      {item._count?.structureItems ?? 0} structures
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>
                      <Edit2 size={14} className="mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(item.id, item.name)}
                    >
                      <Trash2 size={14} className="mr-1" />
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              {editingItem ? 'Edit Fee Type' : 'New Fee Type'}
            </h2>

            {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Fee Type Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Tuition Fee"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Fee Code</label>
                <input
                  type="text"
                  placeholder="e.g. TUITION (leave blank to auto-generate)"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  rows={3}
                  placeholder="Optional details or instructions..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                  Active (available for selection in fee structures)
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Fee Type'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
