import type { CSSProperties } from 'react';
import type { ReportData } from './types';

interface JiddahReportProps {
  data: ReportData;
  zoom?: number;
}

const EMERALD = '#047857';
const EMERALD_LIGHT = '#059669';
const GOLD = '#d4af37';
const CREAM = '#fffbf0';
const NAVY = '#0f172a';
const TEAL = '#0f766e';
const MAROON = '#7a1408';
const ORANGE = '#f97316';

const DIVISION_COLORS: Record<string, string> = {
  I: '#047857',
  II: '#0369a1',
  III: '#7c3aed',
  IV: '#d97706',
  U: '#dc2626',
};

const GRADE_COLORS: Record<string, string> = {
  D1: '#047857', D2: '#059669',
  C3: '#0284c7', C4: '#0369a1',
  C5: '#7c3aed', C6: '#6d28d9',
  P7: '#d97706', P8: '#b45309',
  F9: '#dc2626',
};

function gradeColor(g: string | null) {
  return GRADE_COLORS[g ?? ''] ?? '#64748b';
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function toAr(val: number | string | null | undefined): string {
  if (val == null) return '--';
  return String(val).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

export function JiddahReport({ data }: JiddahReportProps) {
  const { student, term, score_type, section_type, circular, theology, meta } = data;
  const isNursery = section_type === 'nursery';
  const scoreLabel = score_type.toUpperCase();
  const hasTheology = !!theology && theology.subjects.length > 0;
  const isCombined = hasTheology && circular.subjects.length > 0;
  const isP7 = student.class_name === 'P.7';

  const scoreTypeColor = score_type === 'bot' ? '#0369a1' : score_type === 'mot' ? '#7c3aed' : EMERALD;

  const activeScoreKey = score_type === 'eot' ? 'eot_score' : score_type === 'mot' ? 'mot_score' : 'bot_score';
  const activeGradeKey = score_type === 'eot' ? 'eot_grade_display' : score_type === 'mot' ? 'mot_grade_display' : 'bot_grade_display';

  return (
    <div
      style={{
        width: 680,
        minHeight: 960,
        background: CREAM,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: NAVY,
        position: 'relative',
        boxShadow: '0 4px 40px rgba(0,0,0,0.18)',
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── HEADER ────────────────────────────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${EMERALD} 0%, #064e3b 55%, #0f172a 100%)`,
          padding: '20px 28px 18px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: -20,
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(249,115,22,0.12)', pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative', zIndex: 1 }}>
          {/* Crest placeholder */}
          <div style={{
            width: 60, height: 60, borderRadius: 12,
            background: 'rgba(255,255,255,0.12)',
            border: `2px solid rgba(${GOLD.replace('#','')},0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 26 }}>🕌</span>
          </div>

          {/* School names */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3,
            }}>
              Academic Progress Report
            </div>
            <div style={{
              fontSize: 17, fontWeight: 800, color: 'white', lineHeight: 1.25, marginBottom: 2,
            }}>
              Jiddah Islamic Nursery &amp; Primary School
            </div>
            <div style={{
              fontSize: 13, fontFamily: "'Cairo', sans-serif",
              fontWeight: 700, color: 'rgba(255,255,255,0.75)',
              direction: 'rtl',
            }}>
              مدرسة جدة الإسلامية — نساغو، واكيسو
            </div>
          </div>

          {/* Score type badge */}
          <div style={{
            background: scoreTypeColor,
            color: 'white',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textAlign: 'center',
            boxShadow: `0 2px 12px ${scoreTypeColor}66`,
          }}>
            <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 1 }}>{term.label}</div>
            {scoreLabel}
          </div>
        </div>

        {/* Gold divider */}
        <div style={{
          height: 1.5, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
          marginTop: 14, opacity: 0.6,
        }} />
      </div>

      {/* ── STUDENT INFO STRIP ────────────────────────────── */}
      <div style={{
        background: 'white',
        borderBottom: `1px solid rgba(0,0,0,0.06)`,
        padding: '12px 28px',
        display: 'flex', gap: 24, alignItems: 'center',
      }}>
        {/* Avatar */}
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: `linear-gradient(135deg, ${EMERALD}22, ${EMERALD}44)`,
          border: `2px solid ${EMERALD}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 20,
        }}>
          {isNursery ? '🌱' : '📚'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{student.name}</div>
          <div style={{
            fontSize: 13, fontFamily: "'Cairo', sans-serif",
            color: '#64748b', direction: 'rtl', textAlign: 'left',
          }}>
            {student.arabic_name}
          </div>
        </div>

        <InfoPair label="Admission No." value={student.admission_number} />
        <InfoPair label="Class" value={student.class_name} />
        <InfoPair label="Academic Year" value={`${student.academic_year}/${student.academic_year + 1}`} />
        {student.theology_class_arabic && (
          <InfoPair label="Theology Class" value={student.theology_class_arabic} arabic />
        )}
      </div>

      {/* ── BODY ──────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '20px 28px', display: 'flex', gap: 16 }}>

        {/* LEFT: Circular subjects */}
        <div style={{ flex: isCombined && !isNursery ? '0 0 390px' : 1, minWidth: 0 }}>
          <SectionHeading
            icon="📘"
            title={isNursery ? 'Progress Report' : 'Circular Curriculum'}
            color={EMERALD}
          />

          {isNursery ? (
            <NurseryGrid data={data} />
          ) : (
            <SubjectsTable data={data} activeScoreKey={activeScoreKey} activeGradeKey={activeGradeKey} />
          )}

          {/* Summary row */}
          {!isNursery && (
            <div style={{
              display: 'flex', gap: 8, marginTop: 12,
              background: `${EMERALD}08`, border: `1px solid ${EMERALD}20`,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <SummaryBox
                label="Total Score"
                value={String(circular.total)}
                color={EMERALD}
              />
              <SummaryBox
                label="Aggregate"
                value={`${circular.aggregate ?? '--'}%`}
                color={EMERALD}
              />
              <SummaryBox
                label="Division"
                value={circular.division ?? '--'}
                color={DIVISION_COLORS[circular.division ?? ''] ?? '#64748b'}
              />
              <SummaryBox
                label="Position"
                value={circular.position ? ordinal(circular.position) : '--'}
                color={ORANGE}
              />
              {!isP7 && circular.total_students && (
                <SummaryBox
                  label="Out of"
                  value={String(circular.total_students)}
                  color="#64748b"
                />
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Theology panel */}
        {hasTheology && !isNursery && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <SectionHeading
              icon="📖"
              title="Theology Curriculum"
              color={MAROON}
              arabic
            />
            <TheologyTable theology={theology} scoreType={score_type} />

            <div style={{
              display: 'flex', gap: 8, marginTop: 12,
              background: `${MAROON}08`, border: `1px solid ${MAROON}20`,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <SummaryBox
                label="Total (Theology)"
                value={String(theology.total)}
                color={MAROON}
              />
              <SummaryBox
                label="Average"
                value={`${theology.aggregate ?? '--'}%`}
                color={MAROON}
              />
              <SummaryBox
                label="Division"
                value={theology.division ?? '--'}
                color={DIVISION_COLORS[theology.division ?? ''] ?? '#64748b'}
              />
            </div>
          </div>
        )}

        {/* Nursery theology panel */}
        {hasTheology && isNursery && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <SectionHeading icon="🕌" title="التربية الإسلامية" color={MAROON} arabic />
            <NurseryTheologyGrid theology={theology} scoreType={score_type} />
          </div>
        )}
      </div>

      {/* ── COMMENTS ─────────────────────────────────────── */}
      <div style={{
        padding: '0 28px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: "Class Teacher's Comment", value: circular.class_teacher_comment },
            { label: "Head Teacher's Comment", value: circular.head_teacher_comment },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 700, color: EMERALD, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {label}
              </div>
              <div style={{
                fontSize: 12, color: TEAL, fontStyle: 'italic', lineHeight: 1.5,
                background: 'rgba(5,150,105,0.04)', padding: '8px 10px', borderRadius: 8,
                border: '1px solid rgba(5,150,105,0.1)', minHeight: 36,
              }}>
                {value ?? '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Conduct + promotion */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Conduct:</span>
            <span style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              color: '#15803d', borderRadius: 20, padding: '2px 12px', fontSize: 12, fontWeight: 700,
            }}>
              {circular.conduct_remark ?? '—'}
            </span>
          </div>

          {meta.promotion_status && (
            <div style={{
              background: meta.promotion_status === 'PROMOTED' ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${meta.promotion_status === 'PROMOTED' ? '#bbf7d0' : '#fde68a'}`,
              color: meta.promotion_status === 'PROMOTED' ? '#15803d' : '#92400e',
              borderRadius: 20, padding: '2px 14px', fontSize: 12, fontWeight: 700,
            }}>
              {meta.promotion_status === 'PROMOTED' ? '✓ Promoted' : '⚠ Conditional'}
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(90deg, ${EMERALD}08, ${EMERALD}14, ${EMERALD}08)`,
        borderTop: `1.5px solid ${GOLD}44`,
        padding: '10px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          <span style={{ fontWeight: 600 }}>Term Ends:</span>{' '}
          {term.end_date} &nbsp;|&nbsp;
          <span style={{ fontWeight: 600 }}>Next Term:</span>{' '}
          {term.next_term_start}
        </div>

        {/* Stamp circle */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          border: `2px solid ${EMERALD}55`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: 'white',
          fontSize: 8, color: EMERALD, fontWeight: 700, textAlign: 'center',
          lineHeight: 1.3,
        }}>
          <div style={{ fontSize: 14 }}>✅</div>
          <div>VERIFIED</div>
        </div>

        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>
          <div style={{ fontFamily: "'Cairo', sans-serif", direction: 'rtl', fontSize: 13, fontWeight: 700, color: EMERALD }}>
            بالتوفيق
          </div>
          <div style={{ color: '#94a3b8', fontSize: 10 }}>Jiddah Islamic School</div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoPair({ label, value, arabic }: { label: string; value: string; arabic?: boolean }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: NAVY,
        fontFamily: arabic ? "'Cairo', sans-serif" : undefined,
        direction: arabic ? 'rtl' : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

function SectionHeading({ icon, title, color, arabic }: { icon: string; title: string; color: string; arabic?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{
        fontSize: 12, fontWeight: 800, color,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        fontFamily: arabic ? "'Cairo', sans-serif" : undefined,
        direction: arabic ? 'rtl' : undefined,
      }}>
        {title}
      </div>
      <div style={{ flex: 1, height: 1, background: `${color}33` }} />
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>
        {value}
      </div>
    </div>
  );
}

function SubjectsTable({ data, activeScoreKey, activeGradeKey }: {
  data: ReportData;
  activeScoreKey: string;
  activeGradeKey: string;
}) {
  const { circular, score_type } = data;
  const showBOT = true;
  const showMOT = score_type !== 'bot';
  const showEOT = score_type === 'eot';

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: `${EMERALD}12` }}>
          <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 10 }}>Subject</th>
          {showBOT && <th style={thStyle}>BOT</th>}
          {showBOT && <th style={thStyle}>Grd</th>}
          {showMOT && <th style={thStyle}>MOT</th>}
          {showMOT && <th style={thStyle}>Grd</th>}
          {showEOT && <th style={thStyle}>EOT</th>}
          {showEOT && <th style={thStyle}>Grd</th>}
          <th style={thStyle}>Remark</th>
        </tr>
      </thead>
      <tbody>
        {circular.subjects.map((subject, i) => {
          const activeScore = (subject as any)[activeScoreKey] as number | null;
          const activeGrade = (subject as any)[activeGradeKey] as string | null;
          return (
            <tr
              key={subject.subject_name}
              style={{ background: i % 2 === 0 ? 'white' : `${EMERALD}04` }}
            >
              <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: 10, fontWeight: 600 }}>
                {subject.subject_name}
              </td>
              {showBOT && (
                <td style={{ ...tdStyle, color: '#334155', fontWeight: 600 }}>
                  {subject.bot_score ?? '--'}
                </td>
              )}
              {showBOT && (
                <td style={{ ...tdStyle }}>
                  <GradePill grade={subject.bot_grade_display} />
                </td>
              )}
              {showMOT && (
                <td style={{ ...tdStyle, color: '#334155', fontWeight: 600 }}>
                  {subject.mot_score ?? '--'}
                </td>
              )}
              {showMOT && (
                <td style={{ ...tdStyle }}>
                  <GradePill grade={subject.mot_grade_display} />
                </td>
              )}
              {showEOT && (
                <td style={{ ...tdStyle, color: '#334155', fontWeight: 600 }}>
                  {subject.eot_score ?? '--'}
                </td>
              )}
              {showEOT && (
                <td style={{ ...tdStyle }}>
                  <GradePill grade={subject.eot_grade_display} />
                </td>
              )}
              <td style={{ ...tdStyle, color: TEAL, fontStyle: 'italic', fontSize: 11 }}>
                {subject.remark ?? '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TheologyTable({ theology, scoreType }: { theology: NonNullable<ReportData['theology']>; scoreType: string }) {
  const showMOT = scoreType !== 'bot';
  const showEOT = scoreType === 'eot';

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, direction: 'rtl' }}>
      <thead>
        <tr style={{ background: `${MAROON}10` }}>
          <th style={{ ...thStyle, textAlign: 'right', paddingRight: 10, fontFamily: "'Cairo', sans-serif" }}>
            المادة
          </th>
          {showMOT && <th style={thStyle}>MOT</th>}
          {showEOT && <th style={thStyle}>EOT</th>}
          <th style={thStyle}>التقدير</th>
        </tr>
      </thead>
      <tbody>
        {theology.subjects.map((subject, i) => (
          <tr key={subject.subject_name_arabic} style={{ background: i % 2 === 0 ? 'white' : `${MAROON}04` }}>
            <td style={{ ...tdStyle, textAlign: 'right', paddingRight: 10, fontFamily: "'Cairo', sans-serif", fontWeight: 700, fontSize: 13, direction: 'rtl' }}>
              {subject.subject_name_arabic}
            </td>
            {showMOT && (
              <td style={{ ...tdStyle, fontWeight: 600, color: '#334155' }}>
                {subject.mot_score != null ? toAr(subject.mot_score) : '--'}
              </td>
            )}
            {showEOT && (
              <td style={{ ...tdStyle, fontWeight: 600, color: '#334155' }}>
                {subject.eot_score != null ? toAr(subject.eot_score) : '--'}
              </td>
            )}
            <td style={{ ...tdStyle, fontFamily: "'Cairo', sans-serif", color: TEAL, fontStyle: 'italic', fontSize: 11 }}>
              {subject.theology_remark ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const NURSERY_EMOJIS: Record<string, string> = {
  'Number Work': '🔢',
  'English Literacy': '📝',
  'Writing & Drawing': '✏️',
  'Social Studies': '🌍',
  'Health & Safety': '🏥',
  'Islamic Studies': '☪️',
};

function NurseryGrid({ data }: { data: ReportData }) {
  const { circular, score_type } = data;
  const activeKey = score_type === 'eot' ? 'eot_score' : score_type === 'mot' ? 'mot_score' : 'bot_score';
  const activeGradeKey = score_type === 'eot' ? 'eot_grade_display' : score_type === 'mot' ? 'mot_grade_display' : 'bot_grade_display';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {circular.subjects.map((subj) => {
        const score = (subj as any)[activeKey] as number | null;
        const grd = (subj as any)[activeGradeKey] as string | null;
        const emoji = NURSERY_EMOJIS[subj.subject_name] ?? '📌';
        const color = gradeColor(grd);

        return (
          <div key={subj.subject_name} style={{
            background: 'white', borderRadius: 10,
            border: `1px solid ${color}33`,
            padding: '12px 10px', textAlign: 'center',
            boxShadow: `0 1px 4px ${color}22`,
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{emoji}</div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, lineHeight: 1.3, marginBottom: 6 }}>
              {subj.subject_name}
            </div>
            <div style={{
              fontSize: 20, fontWeight: 800, color,
              lineHeight: 1,
            }}>
              {score ?? '--'}
            </div>
            {grd && (
              <div style={{
                fontSize: 10, fontWeight: 700, color,
                background: `${color}15`, borderRadius: 20,
                padding: '1px 8px', marginTop: 4, display: 'inline-block',
              }}>
                {grd}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NurseryTheologyGrid({ theology, scoreType }: { theology: NonNullable<ReportData['theology']>; scoreType: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {theology.subjects.map((subj, i) => {
        const score = scoreType === 'eot' ? subj.eot_score : subj.mot_score;
        const remark = subj.theology_remark;
        const color = score != null ? (score >= 80 ? EMERALD : score >= 60 ? '#0369a1' : '#d97706') : '#64748b';

        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: `${MAROON}06`, borderRadius: 8, padding: '10px 14px',
            border: `1px solid ${MAROON}15`,
          }}>
            <div style={{
              fontSize: 14, fontFamily: "'Cairo', sans-serif",
              fontWeight: 700, color: MAROON, direction: 'rtl',
            }}>
              {subj.subject_name_arabic}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 16, fontWeight: 800, color,
                fontFamily: "'Cairo', sans-serif",
              }}>
                {score != null ? toAr(score) : '--'}
              </span>
              {remark && (
                <span style={{
                  fontSize: 11, fontFamily: "'Cairo', sans-serif",
                  color: TEAL, fontStyle: 'italic',
                }}>
                  {remark}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GradePill({ grade }: { grade: string | null }) {
  if (!grade) return <span style={{ color: '#94a3b8' }}>—</span>;
  const color = gradeColor(grade);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color,
      background: `${color}15`, borderRadius: 4,
      padding: '1px 5px', display: 'inline-block',
    }}>
      {grade}
    </span>
  );
}

const thStyle: CSSProperties = {
  padding: '7px 6px',
  fontWeight: 700,
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: EMERALD,
  textAlign: 'center',
  borderBottom: `2px solid ${EMERALD}22`,
};

const tdStyle: CSSProperties = {
  padding: '5px 6px',
  textAlign: 'center',
  borderBottom: '1px solid rgba(0,0,0,0.04)',
  fontSize: 12,
  color: NAVY,
};
