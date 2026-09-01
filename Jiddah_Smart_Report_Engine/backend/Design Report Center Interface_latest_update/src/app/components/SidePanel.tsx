import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  ChevronLeft,
  User,
  Users,
  AlertTriangle,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import type { ReportData } from './types';

interface SidePanelProps {
  open: boolean;
  onToggle: () => void;
  reports: ReportData[];
  activeReport: ReportData | null;
}

const EMERALD = '#047857';
const ORANGE = '#f97316';
const MAROON = '#7a1408';
const TEAL = '#0f766e';
const NAVY = '#0f172a';

const DIVISION_COLORS: Record<string, string> = {
  I: EMERALD, II: '#0369a1', III: '#7c3aed', IV: '#d97706', U: '#dc2626',
};

function divColor(d: string | null) {
  return DIVISION_COLORS[d ?? ''] ?? '#64748b';
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function SidePanel({ open, onToggle, reports, activeReport }: SidePanelProps) {
  const isBatch = !activeReport;
  const hasTheology = !!activeReport?.theology;
  const hasDualCurriculum = reports.some(r => !!r.theology);
  const hasMissingTheology = reports.some(r => !r.theology && !!r.student.theology_class_arabic);

  return (
    <div className="relative flex shrink-0" style={{ zIndex: 10 }}>
      {/* Toggle tab */}
      <motion.button
        onClick={onToggle}
        className="absolute flex items-center justify-center rounded-l-xl shadow-md"
        style={{
          left: -28, top: '50%', transform: 'translateY(-50%)',
          width: 28, height: 52,
          background: open ? '#047857' : 'white',
          border: `1px solid ${open ? '#047857' : 'rgba(0,0,0,0.1)'}`,
          borderRight: 'none',
          cursor: 'pointer',
          color: open ? 'white' : '#64748b',
        }}
        whileHover={{ scale: 1.05, x: -2 }}
        whileTap={{ scale: 0.95 }}
      >
        {open ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </motion.button>

      {/* Panel body */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                width: 300, height: '100%',
                background: 'white',
                borderLeft: '1px solid rgba(0,0,0,0.07)',
                display: 'flex', flexDirection: 'column',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
              }}
            >
              {/* Panel header */}
              <div style={{
                padding: '14px 16px 12px',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                background: `linear-gradient(135deg, ${EMERALD}08, ${ORANGE}06)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: isBatch
                      ? `linear-gradient(135deg, ${EMERALD}, #065f46)`
                      : `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white',
                  }}>
                    {isBatch ? <Users size={14} /> : <User size={14} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>
                      {isBatch ? 'Batch Summary' : 'Student Details'}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                      {reports.length} report{reports.length !== 1 ? 's' : ''} loaded
                    </div>
                  </div>
                </div>
              </div>

              {reports.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  No reports loaded yet
                </div>
              ) : isBatch ? (
                <BatchView reports={reports} hasMissingTheology={hasMissingTheology} hasDualCurriculum={hasDualCurriculum} />
              ) : (
                <IndividualView report={activeReport} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Batch View ──────────────────────────────────────────────────────────────

function BatchView({
  reports,
  hasMissingTheology,
  hasDualCurriculum,
}: {
  reports: ReportData[];
  hasMissingTheology: boolean;
  hasDualCurriculum: boolean;
}) {
  const sections = {
    nursery: reports.filter(r => r.section_type === 'nursery').length,
    lower_primary: reports.filter(r => r.section_type === 'lower_primary').length,
    upper_primary: reports.filter(r => r.section_type === 'upper_primary').length,
  };

  const avgPosition = reports.reduce((acc, r) => acc + (r.circular.position ?? 0), 0) / reports.length;

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Total Reports" value={reports.length} color={EMERALD} />
        <StatCard label="Avg Position" value={`${ordinal(Math.round(avgPosition))}`} color={ORANGE} />
      </div>

      {/* Section breakdown */}
      {(sections.nursery > 0 || sections.lower_primary > 0 || sections.upper_primary > 0) && (
        <Section label="By Section">
          {sections.nursery > 0 && <SectionRow icon="🌱" label="Nursery" count={sections.nursery} />}
          {sections.lower_primary > 0 && <SectionRow icon="📚" label="Lower Primary" count={sections.lower_primary} />}
          {sections.upper_primary > 0 && <SectionRow icon="🎓" label="Upper Primary" count={sections.upper_primary} />}
        </Section>
      )}

      {/* Warnings */}
      {hasMissingTheology && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 10, padding: '10px 12px',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: '#92400e' }}>
            Some students are missing theology marks. Verify before printing.
          </div>
        </div>
      )}

      {hasDualCurriculum && (
        <div style={{
          background: '#f5f3ff', border: '1px solid #ddd6fe',
          borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#5b21b6',
        }}>
          ✦ Dual-curriculum reports detected (Circular + Theology).
        </div>
      )}

      {/* Student list */}
      <Section label="Students">
        {reports.map((r) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{r.student.name}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{r.student.class_name}</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {r.circular.position && (
                <Chip
                  label={ordinal(r.circular.position)}
                  bg="#f0fdf4" border="#bbf7d0" color={EMERALD}
                />
              )}
              {r.circular.division && (
                <Chip
                  label={`Div ${r.circular.division}`}
                  bg={`${divColor(r.circular.division)}15`}
                  border={`${divColor(r.circular.division)}33`}
                  color={divColor(r.circular.division)}
                />
              )}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ─── Individual View ─────────────────────────────────────────────────────────

function IndividualView({ report }: { report: ReportData }) {
  const { student, circular, theology, score_type, term } = report;
  const scoreLabel = score_type.toUpperCase();
  const scoreColor = score_type === 'bot' ? '#0369a1' : score_type === 'mot' ? '#7c3aed' : EMERALD;

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Student card */}
      <div style={{
        background: `linear-gradient(135deg, ${ORANGE}06, ${EMERALD}08)`,
        borderRadius: 12, padding: '14px 14px 12px',
        border: `1px solid ${EMERALD}18`,
      }}>
        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'white', flexShrink: 0,
          }}>
            {student.name[0]}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{student.name}</div>
            <div style={{ fontSize: 13, fontFamily: "'Cairo', sans-serif", color: '#64748b', direction: 'rtl', textAlign: 'left' }}>
              {student.arabic_name}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          <Chip label={student.class_name} bg="#f0fdf4" border="#bbf7d0" color={EMERALD} />
          <Chip
            label={scoreLabel}
            bg={`${scoreColor}18`} border={`${scoreColor}33`} color={scoreColor}
          />
          <Chip label={term.label} bg="#f8fafc" border="#e2e8f0" color="#475569" />
          {student.theology_class_arabic && (
            <Chip label={student.theology_class_arabic} bg="#fdf2f8" border="#fbcfe8" color="#9d174d" arabic />
          )}
        </div>
      </div>

      {/* Admission & year */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <InfoRow label="Admission No." value={student.admission_number} />
        <InfoRow label="Academic Year" value={`${student.academic_year}/${student.academic_year + 1}`} />
      </div>

      {/* Circular performance */}
      <Section label="Circular Performance">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {circular.position && (
            <StatCard label="Position" value={ordinal(circular.position)} color={ORANGE} />
          )}
          {circular.division && (
            <StatCard label="Division" value={circular.division} color={divColor(circular.division)} />
          )}
          {circular.aggregate != null && (
            <StatCard label="Aggregate" value={`${circular.aggregate}%`} color={EMERALD} />
          )}
          {circular.total != null && (
            <StatCard label="Total Score" value={String(circular.total)} color="#0369a1" />
          )}
        </div>
        {circular.conduct_remark && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Conduct:</span>
            <Chip label={circular.conduct_remark} bg="#f0fdf4" border="#bbf7d0" color={EMERALD} />
          </div>
        )}
      </Section>

      {/* Theology performance */}
      {theology && (
        <Section label="Theology Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <StatCard label="Total" value={String(theology.total)} color={MAROON} />
            {theology.aggregate != null && (
              <StatCard label="Average" value={`${theology.aggregate}%`} color={MAROON} />
            )}
            {theology.division && (
              <StatCard label="Division" value={theology.division} color={divColor(theology.division)} />
            )}
          </div>

          {theology.subjects.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.04)',
            }}>
              <span style={{
                fontSize: 12, fontFamily: "'Cairo', sans-serif",
                color: MAROON, direction: 'rtl',
              }}>
                {s.subject_name_arabic}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {s.theology_remark && (
                  <span style={{ fontSize: 10, color: TEAL, fontStyle: 'italic' }}>
                    {s.theology_remark}
                  </span>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Teacher comment */}
      {circular.class_teacher_comment && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: EMERALD, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Teacher's Comment
          </div>
          <div style={{
            fontSize: 12, color: TEAL, fontStyle: 'italic',
            background: `${EMERALD}06`, padding: '10px 12px',
            borderRadius: 8, border: `1px solid ${EMERALD}15`, lineHeight: 1.5,
          }}>
            "{circular.class_teacher_comment}"
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: `${color}08`, border: `1px solid ${color}22`,
      borderRadius: 8, padding: '8px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{value}</div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SectionRow({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: NAVY, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: EMERALD }}>{count}</span>
    </div>
  );
}

function Chip({
  label, bg, border, color, arabic,
}: {
  label: string; bg: string; border: string; color: string; arabic?: boolean;
}) {
  return (
    <span style={{
      background: bg, border: `1px solid ${border}`,
      color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
      fontFamily: arabic ? "'Cairo', sans-serif" : undefined,
      direction: arabic ? 'rtl' : undefined,
    }}>
      {label}
    </span>
  );
}
