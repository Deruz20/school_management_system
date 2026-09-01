import { useRef, useEffect, useState } from 'react';
import { BookOpen, Award } from 'lucide-react';
import type { Report, Student } from './types';

interface ReportCardProps {
  report: Report;
  student: Student;
  zoom: number;
  isActive: boolean;
  onClick: () => void;
}

const getGrade = (score: number) => {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
};

const gradeTextColor: Record<string, string> = {
  A: '#059669', B: '#2563eb', C: '#d97706', D: '#ea580c', F: '#dc2626',
};
const gradeBgStyle: Record<string, { background: string; border: string; color: string }> = {
  A: { background: '#f0fdf4', border: '#86efac', color: '#166534' },
  B: { background: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
  C: { background: '#fffbeb', border: '#fcd34d', color: '#92400e' },
  D: { background: '#fff7ed', border: '#fdba74', color: '#c2410c' },
  F: { background: '#fef2f2', border: '#fca5a5', color: '#991b1b' },
};

const AVATAR_PALETTE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#f43f5e','#06b6d4','#ec4899','#14b8a6'];
const getAvatarColor = (name: string) =>
  AVATAR_PALETTE[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_PALETTE.length];
const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

const PHASE_LABELS: Record<string, string> = { BOT: 'Beginning of Term', MOT: 'Middle of Term', EOT: 'End of Term' };
const TRACK_PILL: Record<string, { bg: string; border: string; color: string }> = {
  Secular:  { bg: '#f0f9ff', border: '#bae6fd', color: '#0369a1' },
  Theology: { bg: '#faf5ff', border: '#d8b4fe', color: '#7e22ce' },
  Both:     { bg: '#eef2ff', border: '#a5b4fc', color: '#3730a3' },
};
const CARD_WIDTH = 680;

function ScaledWrapper({ zoom, children }: { zoom: number; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [naturalHeight, setNaturalHeight] = useState(950);

  useEffect(() => {
    if (!innerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height;
      if (h && h > 0) setNaturalHeight(h);
    });
    obs.observe(innerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      style={{
        width: `${CARD_WIDTH * zoom}px`,
        height: `${naturalHeight * zoom}px`,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        ref={innerRef}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          width: `${CARD_WIDTH}px`,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ReportCard({ report, student, zoom, isActive, onClick }: ReportCardProps) {
  const overallGrade = getGrade(report.average);
  const gradeStyle = gradeBgStyle[overallGrade];
  const trackPill = TRACK_PILL[student.track];
  const avatarColor = getAvatarColor(student.name);

  return (
    <ScaledWrapper zoom={zoom}>
      <div
        onClick={onClick}
        className="bg-white rounded-xl cursor-pointer overflow-hidden transition-shadow duration-200"
        style={{
          boxShadow: isActive
            ? '0 0 0 2.5px #3b82f6, 0 20px 40px -8px rgba(0,0,0,0.18)'
            : '0 4px 24px -4px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        {/* ── School Header ── */}
        <div style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen color="white" size={26} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'white', fontSize: 17, letterSpacing: '0.06em', margin: 0 }}>GREENFIELD ACADEMY</p>
              <p style={{ color: '#93c5fd', fontSize: 12, margin: '2px 0 0' }}>Excellence in Education &amp; Faith</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '8px 16px', textAlign: 'right' }}>
              <p style={{ color: '#93c5fd', fontSize: 10, margin: 0 }}>Academic Year</p>
              <p style={{ color: 'white', fontSize: 13, margin: '2px 0 0' }}>{report.year}/{report.year + 1}</p>
            </div>
          </div>
        </div>

        {/* ── Title Bar ── */}
        <div style={{ background: '#eff6ff', borderBottom: '1px solid #dbeafe', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: '#1d4ed8', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Academic Report Card</p>
            <p style={{ color: '#60a5fa', fontSize: 11, margin: '3px 0 0' }}>Term {report.term} &bull; {PHASE_LABELS[report.phase]}</p>
          </div>
          <span style={{ background: trackPill.bg, border: `1px solid ${trackPill.border}`, color: trackPill.color, fontSize: 11, padding: '3px 12px', borderRadius: 999 }}>
            {student.track === 'Both' ? 'Dual Curriculum' : `${student.track} Track`}
          </span>
        </div>

        {/* ── Student Info ── */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, flexShrink: 0 }}>
            {getInitials(student.name)}
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 24px' }}>
            <div style={{ gridColumn: '1 / -1', marginBottom: 2 }}>
              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Full Name</p>
              <p style={{ fontSize: 13, color: '#1e293b', margin: '2px 0 0' }}>{student.name}</p>
            </div>
            {[
              { label: 'Enrollment ID', value: student.enrollmentId },
              { label: 'Class', value: student.className },
              { label: 'Gender', value: student.gender },
              { label: 'Date of Birth', value: student.dob },
              { label: 'Parent / Guardian', value: student.parentName },
              { label: 'Contact', value: student.parentContact },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Academic Performance ── */}
        <div style={{ padding: '16px 24px' }}>
          {report.secularSubjects.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#0ea5e9' }} />
                <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Secular Curriculum</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px 6px 0', color: '#94a3b8', fontWeight: 500 }}>Subject</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#94a3b8', fontWeight: 500 }}>Score</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#cbd5e1', fontWeight: 500 }}>Max</th>
                    <th style={{ textAlign: 'center', padding: '6px 16px', color: '#94a3b8', fontWeight: 500 }}>Grade</th>
                    <th style={{ textAlign: 'left', padding: '6px 0', color: '#94a3b8', fontWeight: 500 }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.secularSubjects.map((subj, i) => (
                    <tr key={subj.name} style={{ background: i % 2 === 1 ? '#f8fafc' : 'white', borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '8px 8px 8px 0', color: '#334155' }}>{subj.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#1e293b' }}>{subj.score}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#cbd5e1' }}>{subj.maxScore}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center', color: gradeTextColor[subj.grade] }}>{subj.grade}</td>
                      <td style={{ padding: '8px 0', color: '#64748b' }}>{subj.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.theologySubjects.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#a855f7' }} />
                <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Theology Curriculum</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px 6px 0', color: '#94a3b8', fontWeight: 500 }}>Subject</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#94a3b8', fontWeight: 500 }}>Score</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#cbd5e1', fontWeight: 500 }}>Max</th>
                    <th style={{ textAlign: 'center', padding: '6px 16px', color: '#94a3b8', fontWeight: 500 }}>Grade</th>
                    <th style={{ textAlign: 'left', padding: '6px 0', color: '#94a3b8', fontWeight: 500 }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.theologySubjects.map((subj, i) => (
                    <tr key={subj.name} style={{ background: i % 2 === 1 ? '#fdf4ff' : 'white', borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '8px 8px 8px 0', color: '#334155' }}>{subj.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#1e293b' }}>{subj.score}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#cbd5e1' }}>{subj.maxScore}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center', color: gradeTextColor[subj.grade] }}>{subj.grade}</td>
                      <td style={{ padding: '8px 0', color: '#64748b' }}>{subj.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Performance Summary ── */}
        <div style={{ padding: '0 24px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={{ background: gradeStyle.background, border: `1px solid ${gradeStyle.border}`, borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: gradeStyle.color, opacity: 0.7, margin: 0 }}>Average</p>
            <p style={{ fontSize: 26, color: gradeStyle.color, margin: '2px 0 0', lineHeight: 1 }}>{report.average}%</p>
            <p style={{ fontSize: 11, color: gradeStyle.color, margin: '4px 0 0' }}>Grade {overallGrade}</p>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Class Position</p>
            <p style={{ fontSize: 26, color: '#1e293b', margin: '2px 0 0', lineHeight: 1 }}>{report.position}<sup style={{ fontSize: 10, color: '#94a3b8' }}>th</sup></p>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>of {report.outOf}</p>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Attendance</p>
            <p style={{ fontSize: 26, color: '#1e293b', margin: '2px 0 0', lineHeight: 1 }}>{report.attendance.present}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>of {report.attendance.total} days</p>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Conduct</p>
            <p style={{ fontSize: 13, color: '#334155', margin: '6px 0 0' }}>{report.conductGrade}</p>
          </div>
        </div>

        {/* ── Remarks ── */}
        <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: "Class Teacher's Remarks", text: report.teacherRemarks },
            { label: "Principal's Remarks", text: report.principalRemarks },
          ].map(({ label, text }) => (
            <div key={label} style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 12, padding: '12px 16px' }}>
              <p style={{ fontSize: 10, color: '#94a3b8', margin: '0 0 6px' }}>{label}</p>
              <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>"{text}"</p>
            </div>
          ))}
        </div>

        {/* ── Signatures ── */}
        <div style={{ padding: '16px 24px 20px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 16 }}>
            {['Class Teacher', 'Parent / Guardian', 'Principal'].map(role => (
              <div key={role} style={{ textAlign: 'center' }}>
                <div style={{ height: 32, borderBottom: '1px solid #cbd5e1', marginBottom: 8 }} />
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{role}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 10, color: '#cbd5e1', margin: 0 }}>
              Generated: {report.generatedAt.toLocaleString()}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={12} color="#93c5fd" />
              <p style={{ fontSize: 10, color: '#cbd5e1', margin: 0 }}>ID: {report.id.slice(7, 27)}</p>
            </div>
          </div>
        </div>
      </div>
    </ScaledWrapper>
  );
}
