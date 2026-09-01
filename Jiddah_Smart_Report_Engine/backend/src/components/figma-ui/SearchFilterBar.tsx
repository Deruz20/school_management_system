import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Users, User, Check, Search, ChevronDown } from 'lucide-react';
import type { FilterState, Term, Phase, EnrollmentItem, ClassGroup } from './types';

interface SearchFilterBarProps {
  open: boolean;
  filterState: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  enrollments: EnrollmentItem[];
  classes: ClassGroup[];
}

const SECTION_LABELS: Record<string, string> = {
  all: 'All Sections',
  nursery: 'Nursery',
  lower_primary: 'Lower Primary',
  upper_primary: 'Upper Primary',
};

const CURRICULUM_OPTIONS = [
  { value: 'secular', label: 'Secular', color: '#047857', bg: '#f0fdf4', border: '#bbf7d0' },
  { value: 'theology', label: 'Theology', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { value: 'combined', label: 'Combined', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
];

const TERM_OPTS: { value: Term; label: string }[] = [
  { value: '1', label: 'Term 1' },
  { value: '2', label: 'Term 2' },
  { value: '3', label: 'Term 3' },
];

const PHASE_OPTS: { value: Phase; label: string; full: string }[] = [
  { value: 'BOT', label: 'BOT', full: 'Beginning of Term' },
  { value: 'MOT', label: 'MOT', full: 'Mid-Term' },
  { value: 'EOT', label: 'EOT', full: 'End of Term' },
];

export function SearchFilterBar({
  open,
  filterState,
  onChange,
  onGenerate,
  isGenerating,
  enrollments,
  classes,
}: SearchFilterBarProps) {
  const [studentSearch, setStudentSearch] = useState('');

  const { mode, studentIds = [], classIds = [], section, term, phase, curriculum } = filterState;

  const filteredClasses = useMemo(() => {
    if (section === 'all') return classes;
    return classes.filter(c => c.section_type === section);
  }, [section, classes]);

  const filteredEnrollments = useMemo(() => {
    let list = enrollments;
    if (section !== 'all') list = list.filter(e => e.section_type === section);
    if (classIds && classIds.length > 0) list = list.filter(e => {
      const cls = classes.find(c => classIds.includes(c.id));
      return cls?.enrollmentIds.includes(e.enrollment_id);
    });
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.arabic_name.includes(q));
    }
    return list;
  }, [section, classIds, studentSearch, classes, enrollments]);

  const canGenerate = !!term && !!phase && (
    mode === 'class' ? classIds.length > 0 : studentIds.length > 0
  );

  function toggleStudent(id: string) {
    const next = studentIds.includes(id)
      ? studentIds.filter(s => s !== id)
      : [...studentIds, id];
    onChange({ studentIds: next });
  }

  function selectAllStudents() {
    onChange({ studentIds: filteredEnrollments.map(e => e.enrollment_id) });
  }

  function clearAllStudents() {
    onChange({ studentIds: [] });
  }

  function toggleClass(id: string) {
    const next = classIds.includes(id)
      ? classIds.filter(c => c !== id)
      : [...classIds, id];
    onChange({ classIds: next });
  }

  function selectAllClasses() {
    onChange({ classIds: filteredClasses.map(c => c.id) });
  }

  function clearAllClasses() {
    onChange({ classIds: [] });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          style={{ overflow: 'hidden' }}
        >
          <div
            style={{
              background: 'white',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column' as const,
              gap: 14,
            }}
          >
            {/* ── Row 1: Mode + Section + Curriculum ── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' as const }}>

              {/* Mode toggle */}
              <FilterGroup label="Mode">
                <SegmentedPair
                  options={[
                    { value: 'class', label: 'Class', icon: <Users size={13} /> },
                    { value: 'individual', label: 'Student', icon: <User size={13} /> },
                  ]}
                  value={mode}
                  onChange={(v) => onChange({ mode: v as 'class' | 'individual', studentIds: [], classIds: [] })}
                  activeColor="#047857"
                />
              </FilterGroup>

              {/* Section filter */}
              <FilterGroup label="Section">
                <div style={{ display: 'flex', gap: 4 }}>
                  {Object.entries(SECTION_LABELS).map(([val, lbl]) => (
                    <PillButton
                      key={val}
                      active={section === val}
                      onClick={() => onChange({ section: val as FilterState['section'], classIds: [] })}
                      activeColor="#047857"
                      size="sm"
                    >
                      {lbl}
                    </PillButton>
                  ))}
                </div>
              </FilterGroup>

              {/* Curriculum */}
              <FilterGroup label="Curriculum">
                <div style={{ display: 'flex', gap: 4 }}>
                  {CURRICULUM_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.value}
                      onClick={() => onChange({ curriculum: opt.value as FilterState['curriculum'] })}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', border: `1px solid`,
                        background: curriculum === opt.value ? opt.bg : 'white',
                        borderColor: curriculum === opt.value ? opt.border : 'rgba(0,0,0,0.1)',
                        color: curriculum === opt.value ? opt.color : '#64748b',
                        transition: 'all 0.15s',
                      }}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {opt.label}
                    </motion.button>
                  ))}
                </div>
              </FilterGroup>
            </div>

            {/* ── Row 2: Class/Student selector ── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' as const }}>

              {mode === 'class' ? (
                <FilterGroup label={`Select Classes${classIds.length > 0 ? ` (${classIds.length} selected)` : ''}`}>
                  {/* Select all / clear classes */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button
                      onClick={selectAllClasses}
                      style={{
                        fontSize: 11, fontWeight: 600, color: '#047857', background: 'none',
                        border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                      }}
                    >
                      Select All
                    </button>
                    {classIds.length > 0 && (
                      <button
                        onClick={clearAllClasses}
                        style={{
                          fontSize: 11, fontWeight: 600, color: '#ef4444', background: 'none',
                          border: '1px solid #fecaca', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                    {filteredClasses.map((cls) => {
                      const selected = classIds.includes(cls.id);
                      return (
                      <motion.button
                        key={cls.id}
                        onClick={() => toggleClass(cls.id)}
                        style={{
                          padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer',
                          background: selected ? '#047857' : 'white',
                          color: selected ? 'white' : '#374151',
                          border: `1.5px solid ${selected ? '#047857' : 'rgba(0,0,0,0.12)'}`,
                        }}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {cls.name}
                        <span style={{
                          marginLeft: 6, fontSize: 10, opacity: 0.7,
                          background: selected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.07)',
                          padding: '0 5px', borderRadius: 10,
                        }}>
                          {cls.enrollmentIds.length}
                        </span>
                      </motion.button>
                      );
                    })}
                    {filteredClasses.length === 0 && (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>No classes in this section</span>
                    )}
                  </div>
                </FilterGroup>
              ) : (
                <FilterGroup label={`Select Students${studentIds.length > 0 ? ` (${studentIds.length} selected)` : ''}`}>
                  {/* Search input */}
                  <div style={{ position: 'relative', marginBottom: 8, maxWidth: 280 }}>
                    <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by name…"
                      style={{
                        width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                        borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)',
                        fontSize: 12, outline: 'none', boxSizing: 'border-box' as const,
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#059669'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; }}
                    />
                  </div>

                  {/* Select all / clear */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button
                      onClick={selectAllStudents}
                      style={{
                        fontSize: 11, fontWeight: 600, color: '#047857', background: 'none',
                        border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                      }}
                    >
                      Select All
                    </button>
                    {studentIds.length > 0 && (
                      <button
                        onClick={clearAllStudents}
                        style={{
                          fontSize: 11, fontWeight: 600, color: '#ef4444', background: 'none',
                          border: '1px solid #fecaca', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    )}
                    {studentIds.length > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#ea580c',
                        background: '#fff7ed', border: '1px solid #fed7aa',
                        borderRadius: 12, padding: '3px 10px',
                      }}>
                        {studentIds.length} selected
                      </span>
                    )}
                  </div>

                  {/* Student grid */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: 4, maxHeight: 150, overflowY: 'auto',
                      scrollbarWidth: 'thin',
                      paddingBottom: 20,
                      WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
                      maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
                    }}>
                    {filteredEnrollments.map((enr) => {
                      const selected = studentIds.includes(enr.enrollment_id);
                      return (
                        <motion.button
                          key={enr.enrollment_id}
                          onClick={() => toggleStudent(enr.enrollment_id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                            background: selected ? '#f0fdf4' : 'white',
                            border: `1px solid ${selected ? '#86efac' : 'rgba(0,0,0,0.08)'}`,
                            textAlign: 'left' as const,
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <div style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            background: selected ? '#047857' : 'white',
                            border: `1.5px solid ${selected ? '#047857' : '#cbd5e1'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {selected && <Check size={10} color="white" strokeWidth={3} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {enr.name}
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                              {enr.circular_class} · {enr.admission_number}
                            </div>
                          </div>
                          {enr.track === 'Both' && (
                            <span style={{
                              marginLeft: 'auto', fontSize: 9, color: '#7c3aed',
                              background: '#f5f3ff', border: '1px solid #ddd6fe',
                              borderRadius: 8, padding: '1px 5px', flexShrink: 0,
                            }}>
                              Dual
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                    </div>
                  </div>
                </FilterGroup>
              )}
            </div>

            {/* ── Row 3: Term + Phase + Generate ── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' as const }}>

              <FilterGroup label="Term">
                <div style={{ display: 'flex', gap: 4 }}>
                  {TERM_OPTS.map((t) => (
                    <PillButton
                      key={t.value}
                      active={term === t.value}
                      onClick={() => onChange({ term: term === t.value ? '' : t.value })}
                      activeColor="#f97316"
                    >
                      {t.label}
                    </PillButton>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup label="Phase">
                <div style={{ display: 'flex', gap: 4 }}>
                  {PHASE_OPTS.map((p) => (
                    <motion.button
                      key={p.value}
                      onClick={() => onChange({ phase: phase === p.value ? '' : p.value })}
                      title={p.full}
                      style={{
                        padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', letterSpacing: '0.04em',
                        background: phase === p.value ? '#f97316' : 'white',
                        color: phase === p.value ? 'white' : '#64748b',
                        border: `1.5px solid ${phase === p.value ? '#f97316' : 'rgba(0,0,0,0.1)'}`,
                        boxShadow: phase === p.value ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {p.label}
                    </motion.button>
                  ))}
                </div>
              </FilterGroup>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Generate button */}
              <motion.button
                onClick={onGenerate}
                disabled={!canGenerate || isGenerating}
                className="flex items-center gap-2"
                style={{
                  padding: '9px 22px', borderRadius: 10,
                  background: canGenerate && !isGenerating ? '#047857' : '#e2e8f0',
                  color: canGenerate && !isGenerating ? 'white' : '#94a3b8',
                  border: 'none', cursor: canGenerate && !isGenerating ? 'pointer' : 'not-allowed',
                  fontSize: 13, fontWeight: 700,
                  boxShadow: canGenerate && !isGenerating ? '0 3px 12px rgba(4,120,87,0.35)' : 'none',
                  transition: 'all 0.2s',
                }}
                animate={canGenerate && !isGenerating ? {
                  boxShadow: ['0 3px 12px rgba(4,120,87,0.35)', '0 3px 18px rgba(4,120,87,0.55)', '0 3px 12px rgba(4,120,87,0.35)'],
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                whileHover={canGenerate ? { scale: 1.03, background: '#065f46' } : {}}
                whileTap={canGenerate ? { scale: 0.97 } : {}}
              >
                {isGenerating ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{ display: 'inline-block' }}
                    >
                      ⟳
                    </motion.span>
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Generate Reports
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
  activeColor = '#047857',
  size = 'md',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeColor?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <motion.button
      onClick={onClick}
      style={{
        padding: size === 'sm' ? '3px 10px' : '4px 14px',
        borderRadius: 20, fontSize: 12, fontWeight: 600,
        cursor: 'pointer',
        background: active ? activeColor : 'white',
        color: active ? 'white' : '#64748b',
        border: `1.5px solid ${active ? activeColor : 'rgba(0,0,0,0.1)'}`,
        boxShadow: active ? `0 2px 8px ${activeColor}44` : 'none',
        transition: 'all 0.15s',
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
}

function SegmentedPair({
  options,
  value,
  onChange,
  activeColor = '#047857',
}: {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
  activeColor?: string;
}) {
  return (
    <div style={{
      display: 'inline-flex', gap: 0,
      background: 'rgba(0,0,0,0.04)', borderRadius: 8,
      border: '1px solid rgba(0,0,0,0.08)', padding: 2,
    }}>
      {options.map((opt) => (
        <motion.button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex items-center gap-1.5"
          style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: 'none',
            background: value === opt.value ? activeColor : 'transparent',
            color: value === opt.value ? 'white' : '#64748b',
            boxShadow: value === opt.value ? `0 1px 4px ${activeColor}44` : 'none',
            transition: 'all 0.15s',
          }}
          whileHover={value !== opt.value ? { color: activeColor } : {}}
          whileTap={{ scale: 0.96 }}
        >
          {opt.icon}
          {opt.label}
        </motion.button>
      ))}
    </div>
  );
}
