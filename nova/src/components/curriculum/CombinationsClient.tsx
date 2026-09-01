"use client";

import { useState } from "react";
import { Subject, SubjectCombination, CombinationSubject } from "@prisma/client";
import { createCombinationAction, deleteCombinationAction } from "@/app/(dashboard)/curriculum/combinations/actions";

type ComboWithSubjects = SubjectCombination & { 
  combinationSubjects: (CombinationSubject & { subject: Subject })[] 
};

export default function CombinationsClient({ 
  initialCombinations, subjects 
}: { 
  initialCombinations: ComboWithSubjects[], 
  subjects: Subject[] 
}) {
  const [combinations] = useState(initialCombinations);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<{id: string, isCore: boolean}[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedSubjects.length === 0) {
      setError("Please select at least one subject.");
      return;
    }
    const res = await createCombinationAction(name, selectedSubjects.map(s => ({ subjectId: s.id, isCore: s.isCore })));
    if (res.error) setError(res.error);
    else {
      setIsCreating(false);
      window.location.reload();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this combination?")) {
      const res = await deleteCombinationAction(id);
      if (!res.error) window.location.reload();
      else alert(res.error);
    }
  };

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}
      
      <div className="mb-4">
        {!isCreating ? (
          <button 
            onClick={() => { setIsCreating(true); setName(""); setSelectedSubjects([]); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            New Combination
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-4 rounded-md shadow flex flex-col gap-4">
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Combination Name</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="border rounded-md px-3 py-2 text-sm w-64 text-black" placeholder="e.g. PCM" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Subjects</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => {
                  const isSelected = selectedSubjects.find(sel => sel.id === s.id);
                  return (
                    <div key={s.id} className={`border p-2 rounded flex items-center gap-2 cursor-pointer ${isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white'}`}>
                      <input 
                        type="checkbox" 
                        checked={!!isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSubjects([...selectedSubjects, { id: s.id, isCore: true }]);
                          else setSelectedSubjects(selectedSubjects.filter(sel => sel.id !== s.id));
                        }}
                      />
                      <span className="text-sm font-medium text-slate-800">{s.code}</span>
                      {isSelected && (
                        <label className="ml-2 text-xs text-slate-600 flex items-center gap-1">
                          <input type="checkbox" checked={isSelected.isCore} onChange={(e) => {
                            setSelectedSubjects(selectedSubjects.map(sel => sel.id === s.id ? { ...sel, isCore: e.target.checked } : sel));
                          }} /> Core
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm">Save Combination</button>
              <button type="button" onClick={() => setIsCreating(false)} className="bg-white border text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {combinations.map(combo => (
          <div key={combo.id} className="bg-white border rounded-md p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg text-slate-900">{combo.name}</h3>
              <button onClick={() => handleDelete(combo.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
            </div>
            <div className="space-y-1">
              {combo.combinationSubjects.map(cs => (
                <div key={cs.subjectId} className="flex justify-between text-sm">
                  <span className="text-slate-700">{cs.subject.name} ({cs.subject.code})</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${cs.isCore ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                    {cs.isCore ? 'Core' : 'Elective'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {combinations.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-500 bg-white rounded shadow-sm">
            No subject combinations found.
          </div>
        )}
      </div>
    </div>
  );
}
