import { motion } from 'motion/react';
import { Sparkles, Users, User, LayoutGrid, Square, CheckSquare } from 'lucide-react';
import type { FilterState, Term, Phase } from './types';
import type { Student, ClassInfo } from './types';

interface SearchFilterBarProps {
  students: Student[];
  classes: ClassInfo[];
  filterState: FilterState;
  onChange: (state: FilterState) => void;
  onGenerate: () => void;
  onClose: () => void;
  isGenerating: boolean;
}

const TERMS: Term[] = ['1', '2', '3'];
const PHASES: Phase[] = ['BOT', 'MOT', 'EOT'];
const PHASE_LABELS: Record<Phase, string> = { BOT: 'Beginning of Term', MOT: 'Middle of Term', EOT: 'End of Term' };
const SECTIONS = [{ id: 'all', label: 'All Sections' }, { id: 'nursery', label: 'Nursery' }, { id: 'lower_primary', label: 'Lower Primary' }, { id: 'upper_primary', label: 'Upper Primary' }];
const CURRICULA = [{ id: 'secular', label: 'Secular' }, { id: 'theology', label: 'Theology' }, { id: 'combined', label: 'Combined' }];

export function SearchFilterBar({ students, classes, filterState, onChange, onGenerate, isGenerating }: SearchFilterBarProps) {
  const update = (patch: Partial<FilterState>) => onChange({ ...filterState, ...patch });

  const toggleStudent = (id: string) => {
    const current = filterState.studentIds || [];
    if (current.includes(id)) update({ studentIds: current.filter(x => x !== id) });
    else update({ studentIds: [...current, id] });
  };

  const selectAllStudents = () => update({ studentIds: filteredStudents.map(s => s.id) });
  const clearStudents = () => update({ studentIds: [] });

  // Filter students based on selected class/section if needed
  const filteredStudents = students.filter(s => {
    if (filterState.classId && s.classId !== filterState.classId) return false;
    return true;
  });

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="bg-white border-b border-slate-200 overflow-hidden flex-shrink-0 shadow-sm"
      style={{ zIndex: 10 }}
    >
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-4 mb-3.5">
          {/* Mode Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 uppercase tracking-widest">Query Mode</span>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => update({ mode: 'individual', classId: '' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${filterState.mode === 'individual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <User className="w-3.5 h-3.5" /> Selected Students
              </button>
              <button
                onClick={() => update({ mode: 'class', studentIds: [] })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${filterState.mode === 'class' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Users className="w-3.5 h-3.5" /> Entire Class
              </button>
            </div>
          </div>

          {/* Curriculum Toggle */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-slate-400 uppercase tracking-widest">Curriculum</span>
            <div className="flex bg-emerald-50 rounded-lg p-0.5 border border-emerald-100">
              {CURRICULA.map(c => (
                <button
                  key={c.id}
                  onClick={() => update({ curriculum: c.id as any })}
                  className={`px-3 py-1.5 rounded-md text-xs transition-all ${filterState.curriculum === c.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-100'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Layout Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => update({ layout: 'single' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${filterState.layout === 'single' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                title="Single Column View"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => update({ layout: 'grid' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${filterState.layout === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                title="Grid/Lines View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-start gap-4">
          
          {/* Section Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">Section</label>
            <select
              value={filterState.section}
              onChange={e => update({ section: e.target.value, classId: '' })}
              className="h-9 px-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-32"
            >
              {SECTIONS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Class Selector (always visible so we can filter students by class even in individual mode) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">Class</label>
            <select
              value={filterState.classId}
              onChange={e => update({ classId: e.target.value })}
              className="h-9 px-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-44"
            >
              <option value="">{filterState.mode === 'class' ? 'Select class…' : 'All Classes'}</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Term */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">Term</label>
            <div className="flex gap-1.5">
              {TERMS.map(t => (
                <button
                  key={t}
                  onClick={() => update({ term: filterState.term === t ? '' : t })}
                  className={`w-9 h-9 text-xs rounded-lg border transition-all ${filterState.term === t ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Phase */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">Phase</label>
            <div className="flex gap-1.5">
              {PHASES.map(p => (
                <button
                  key={p}
                  onClick={() => update({ phase: filterState.phase === p ? '' : p })}
                  title={PHASE_LABELS[p]}
                  className={`px-3 h-9 text-xs rounded-lg border transition-all ${filterState.phase === p ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex flex-col gap-1.5 ml-auto justify-end h-[58px]">
            <motion.button
              onClick={onGenerate}
              disabled={isGenerating || (filterState.mode === 'class' && !filterState.classId) || (filterState.mode === 'individual' && filterState.studentIds?.length === 0)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg text-xs hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed h-9"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGenerating ? 'Generating…' : 'Generate Reports'}
            </motion.button>
          </div>
        </div>

        {/* Multi-Student Selection Grid */}
        {filterState.mode === 'individual' && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500 font-medium">Select Students ({filterState.studentIds?.length || 0} selected)</label>
              <div className="flex gap-2">
                <button onClick={selectAllStudents} className="text-xs text-emerald-600 hover:underline">Select All</button>
                <span className="text-slate-300">|</span>
                <button onClick={clearStudents} className="text-xs text-slate-500 hover:underline">Clear</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2" style={{ scrollbarWidth: 'thin' }}>
              {filteredStudents.length === 0 ? (
                <div className="col-span-full p-4 text-center text-xs text-slate-400">No students found.</div>
              ) : (
                filteredStudents.map(s => {
                  const isSelected = (filterState.studentIds || []).includes(s.id);
                  return (
                    <div 
                      key={s.id} 
                      onClick={() => toggleStudent(s.id)}
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors border ${isSelected ? 'bg-emerald-100/50 border-emerald-200' : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-100'}`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center border ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <CheckSquare className="w-3 h-3" />}
                      </div>
                      <span className="text-xs text-slate-700 truncate select-none">{s.name}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
}
