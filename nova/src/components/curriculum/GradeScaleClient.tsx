'use client';

import { useState } from 'react';
import { GradeScale, GradeBand } from '@prisma/client';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { createGradeScale } from '@/app/curriculum/grading/actions';

type GradeScaleWithBands = GradeScale & { bands: GradeBand[] };

export function GradeScaleClient({
  initialScales,
  branchId
}: {
  initialScales: GradeScaleWithBands[];
  branchId: string;
}) {
  const [scales, setScales] = useState(initialScales);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bands, setBands] = useState<Array<{ minScore: number; maxScore: number; grade: string; points: number; remarks: string }>>([
    { minScore: 0, maxScore: 0, grade: '', points: 0, remarks: '' }
  ]);

  const addBand = () => {
    setBands([...bands, { minScore: 0, maxScore: 0, grade: '', points: 0, remarks: '' }]);
  };

  const removeBand = (index: number) => {
    setBands(bands.filter((_, i) => i !== index));
  };

  const updateBand = (index: number, field: string, value: string | number) => {
    const newBands = [...bands];
    (newBands[index] as Record<string, unknown>)[field] = value;
    setBands(newBands);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await createGradeScale({
      branchId,
      name,
      description,
      bands
    });

    if (res.success && res.data) {
      setScales([...scales, res.data as unknown as GradeScaleWithBands]);
      setIsCreating(false);
      setName('');
      setDescription('');
      setBands([{ minScore: 0, maxScore: 0, grade: '', points: 0, remarks: '' }]);
    } else {
      setError(res.error || 'Failed to create grade scale');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scales.map(scale => (
          <div key={scale.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-900">{scale.name}</h3>
                {scale.description && <p className="text-xs text-gray-500 mt-1">{scale.description}</p>}
              </div>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
                {scale.bands.length} bands
              </span>
            </div>
            <div className="p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Range</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scale.bands.map(band => (
                    <tr key={band.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{band.minScore} - {band.maxScore}</td>
                      <td className="px-4 py-2 text-sm font-semibold text-gray-900">{band.grade}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{band.points}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{band.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {scales.length === 0 && !isCreating && (
          <div className="col-span-2 text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
            <p className="text-gray-500">No grade scales defined.</p>
          </div>
        )}
      </div>

      {/* Form */}
      {isCreating ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Create Grade Scale</h2>
            <button type="button" onClick={() => setIsCreating(false)} className="text-gray-500 hover:text-gray-700">Cancel</button>
          </div>

          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. O-Level Standard" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">Grade Bands</label>
              <button type="button" onClick={addBand} className="text-sm text-indigo-600 font-medium flex items-center hover:text-indigo-700">
                <PlusIcon className="w-4 h-4 mr-1" /> Add Band
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
              {bands.map((band, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[80px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Min Score</label>
                    <input type="number" required value={band.minScore} onChange={e => updateBand(idx, 'minScore', Number(e.target.value))} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div className="flex-1 min-w-[80px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Max Score</label>
                    <input type="number" required value={band.maxScore} onChange={e => updateBand(idx, 'maxScore', Number(e.target.value))} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div className="flex-1 min-w-[80px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Grade</label>
                    <input type="text" required value={band.grade} onChange={e => updateBand(idx, 'grade', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" placeholder="e.g. A" />
                  </div>
                  <div className="flex-1 min-w-[80px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Points</label>
                    <input type="number" required value={band.points} onChange={e => updateBand(idx, 'points', Number(e.target.value))} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div className="flex-[2] min-w-[120px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Remarks</label>
                    <input type="text" value={band.remarks} onChange={e => updateBand(idx, 'remarks', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" placeholder="e.g. Distinction" />
                  </div>
                  {bands.length > 1 && (
                    <button type="button" onClick={() => removeBand(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-md mb-[2px]">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Grade Scale'}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setIsCreating(true)} className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition-colors">
          <PlusIcon className="w-5 h-5 mr-2" />
          Create New Scale
        </button>
      )}
    </div>
  );
}
