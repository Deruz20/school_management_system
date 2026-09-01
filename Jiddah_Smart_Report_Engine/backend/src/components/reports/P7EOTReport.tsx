import { getClassTeacherComment, getHeadTeacherComment, getConductRemark } from '@/lib/grading'
import { ReportContainer } from '@/components/reports/shared/ReportContainer'

export default function P7EOTReport({ reportData }: any) {
  const teacherComment =
    reportData?.circular?.class_teacher_comment ??
    getClassTeacherComment(reportData?.circular?.division ?? null)

  const headComment =
    reportData?.circular?.head_teacher_comment ??
    getHeadTeacherComment(reportData?.circular?.division ?? null)

  const conductRemark =
    reportData?.circular?.conduct_remark ??
    getConductRemark(reportData?.circular?.division ?? null)

  const renderSubjectRow = (subject: any) => (
    <tr key={subject.subject_name}>
      <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
        {subject.subject_name}
      </td>

      <td className="data-cell">{subject.bot_score ?? '--'}</td>
      <td className="data-cell">{subject.bot_grade_display ?? '--'}</td>

      <td className="data-cell">{subject.mot_score ?? '--'}</td>
      <td className="data-cell">{subject.mot_grade_display ?? '--'}</td>

      <td className="data-cell">{subject.eot_score ?? '--'}</td>
      <td className="data-cell">{subject.eot_grade_display ?? '--'}</td>

      <td className="remarks-cell">
        {subject.remark ?? ''}
      </td>
    </tr>
  )

  return (
    <ReportContainer reportType="P7EOTReport">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Poppins:wght@400;500;600;700;800&family=Cairo:wght@600;700&display=swap');

.p7-eot-report,
.p7-eot-report * {
  box-sizing: border-box;
}

.p7-eot-report {
  --primary-green: #0f5b48;
  --accent-gold: #c5a059;
  --deep-maroon: #7d140c;
  --bg-cream: #fdfaf2;
  --border-light: #d8c68a;
  --data-navy: #0f172a;
  --data-indigo: #3730a3;
  --data-teal: #0f766e;
  
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;

  margin: 0 auto;
  background: var(--bg-cream);
  border: 4px double var(--primary-green);
  padding: 12px 24px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-family: 'Poppins', sans-serif;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.p7-eot-report::before {
  content: "";
  position: absolute;
  inset: 0;
  background: url('/school_budge.jpeg') center center no-repeat;
  background-size: 350px;
  opacity: 0.04;
  pointer-events: none;
  z-index: 0;
}

.p7-eot-report > * {
  position: relative;
  z-index: 1;
}

/* ================= HEADER ================= */
.p7-eot-report .header {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.p7-eot-report .school-left {
  width: 32%;
}

.p7-eot-report .school-left h1 {
  margin: 0;
  font-size: 16px;
  line-height: 1.15;
  color: var(--deep-maroon);
  font-weight: 800;
}

.p7-eot-report .school-left p {
  margin: 2px 0;
  font-size: 10px;
  color: #444;
}

.p7-eot-report .header-center {
  width: 36%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.p7-eot-report .bismillah {
  font-family: 'Amiri', serif;
  font-size: 22px;
  color: var(--primary-green);
  margin-bottom: 2px;
}

.p7-eot-report .logo {
  width: 50px;
  height: 50px;
  margin: 0 auto 6px;
}

.p7-eot-report .logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.p7-eot-report .report-badge {
  display: inline-block;
  background: var(--primary-green);
  color: white;
  padding: 4px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
}

.p7-eot-report .header-right {
  width: 32%;
  direction: rtl;
  text-align: right;
  font-family: 'Cairo', sans-serif;
}

.p7-eot-report .header-right h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  color: var(--deep-maroon);
}

/* ================= INFO ================= */
.p7-eot-report .info-box {
  flex: 0 0 auto;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 6px 14px;
  margin-bottom: 6px;
}

.p7-eot-report .info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.p7-eot-report .info-row:last-child {
  margin-bottom: 0;
}

.p7-eot-report .label {
  font-weight: 700;
  white-space: nowrap;
}

.p7-eot-report .line {
  flex: 1;
  min-width: 0;
  border-bottom: 1.5px dotted #9ca3af;
  padding: 0 0 2px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--data-navy);
  font-weight: 900;
  font-size: 15px;
}

/* ================= TABLE ================= */
.p7-eot-report .tables-container {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Important for flexing down */
}

.p7-eot-report table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border: 1px solid var(--border-light);
}

.p7-eot-report th {
  background: var(--primary-green);
  color: white;
  border: 1px solid rgba(255,255,255,0.2);
  padding: 5px 4px;
  font-size: 11px;
}

.p7-eot-report .table-banner {
  background: var(--accent-gold);
  color: white;
  font-size: 13px;
  letter-spacing: 1px;
  padding: 4px;
}

.p7-eot-report td {
  border: 1px solid #ddd;
  padding: 5px 4px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  vertical-align: middle;
}

.p7-eot-report .data-cell {
  color: var(--data-indigo);
  font-weight: 900;
  font-size: 14px;
  text-align: center;
}

.p7-eot-report .remarks-cell {
  color: var(--data-teal);
  font-weight: 800;
  font-style: italic;
  font-size: 11px;
  text-align: left;
}

/* ================= GRADING ================= */
.p7-eot-report .grading-key {
  margin-top: 6px;
  flex: 0 0 auto;
}

.p7-eot-report .grading-key th {
  background: #555;
  font-size: 10px;
  padding: 6px;
}

.p7-eot-report .grading-key td {
  font-size: 10px;
  font-weight: 700;
  padding: 4px;
}

/* ================= FOOTER ================= */
.p7-eot-report .premium-footer {
  flex: 0 0 auto;
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin-top: 6px;
}

.p7-eot-report .footer-left {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.p7-eot-report .comment-card {
  border: 1.5px dashed var(--primary-green);
  border-radius: 8px;
  padding: 8px 14px;
  background: rgba(255,255,255,0.85);
}

.p7-eot-report .comment-row {
  display: flex;
  gap: 14px;
  margin-bottom: 6px;
}

.p7-eot-report .comment-row:last-child {
  margin-bottom: 0;
}

.p7-eot-report .c-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.p7-eot-report .c-field span {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.p7-eot-report .w-line {
  flex: 1;
  border-bottom: 1.5px dotted #9ca3af;
  padding-bottom: 2px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.p7-eot-report .line-text {
  font-size: 12px;
  line-height: 1.2;
  white-space: normal;
  color: var(--data-teal);
  font-style: italic;
  font-weight: 900; font-size: 15px;
}

.p7-eot-report .term-dates-bar {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}

.p7-eot-report .date-item {
  flex: 1;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
}

.p7-eot-report .red-date {
  background: #fff0f0;
  border-color: #ffb3b3;
  color: var(--deep-maroon);
}

.p7-eot-report .blue-date {
  background: #eef3ff;
  border-color: #a9c2ff;
  color: #1d4ed8;
}

.p7-eot-report .validity-strip {
  margin-top: 10px;
  background: var(--deep-maroon);
  color: white;
  border-radius: 4px;
  text-align: center;
  padding: 6px;
  font-size: 10px;
  font-weight: 800;
}

.p7-eot-report .stamp-box {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  border: 2px dashed #9aa8bd;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  color: #7584a0;
  flex-shrink: 0;
  align-self: flex-end;
}
          `
        }}
      />

      <div className="p7-eot-report">
        <header className="header">
          <div className="school-left">
            <h1>
              JIDDAH ISLAMIC NURSERY
              <br />
              AND PRIMARY SCHOOL - Nsaggu
            </h1>
            <p>P.O.Box 34008 Kampala (U)</p>
            <p>Tel: +256 744950042 / 0705316961</p>
            <p style={{ fontSize: '9px', opacity: 0.8 }}>
              jiddahislamicnurseryandpri@gmail.com
            </p>
          </div>

          <div className="header-center">
            <div className="bismillah">
              بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْم
            </div>
            <div className="logo">
              <img src="/school_budge.jpeg" alt="School Badge" />
            </div>
            <div className="report-badge">
              P.7 REPORT FORM - END OF TERM
            </div>
          </div>

          <div className="header-right">
            <h2>مدرسة جدة الإسلامية للروضة والابتدائية بنساغو</h2>
          </div>
        </header>

        <section className="info-box">
          <div className="info-row">
            <span className="label">Pupil's Name:</span>
            <div className="line">{reportData?.student?.name}</div>
          </div>

          <div className="info-row">
            <span className="label">Class:</span>
            <div className="line">{reportData?.student?.class_name}</div>
            <span className="label">Term:</span>
            <div className="line">{reportData?.term?.label}</div>
            <span className="label">Year:</span>
            <div className="line" style={{ flex: 0.5 }}>
              {reportData?.term?.academic_year}
            </div>
          </div>

          <div className="info-row">
            <span className="label">Position:</span>
            <div className="line">
              {reportData?.circular?.position ?? '--'}
            </div>
            <span className="label">Out Of:</span>
            <div className="line">
              {reportData?.circular?.total_students ??
                reportData?.circular?.total ??
                '--'}
            </div>
            <span className="label">Division:</span>
            <div className="line" style={{ flex: 0.3 }}>
              {reportData?.circular?.division ?? '--'}
            </div>
          </div>
        </section>

        <div className="tables-container">
          <table>
            <tbody>
              <tr>
                <th colSpan={8} className="table-banner">
                  COMPARATIVE PERFORMANCE
                </th>
              </tr>

              <tr>
                <th rowSpan={2} style={{ width: '18%' }}>SUBJECTS</th>
                <th colSpan={2} style={{ width: '18%' }}>BEGINNING OF TERM</th>
                <th colSpan={2} style={{ width: '18%' }}>MIDTERM</th>
                <th colSpan={2} style={{ width: '18%' }}>END OF TERM</th>
                <th rowSpan={2} style={{ width: '28%' }}>COMMENT</th>
              </tr>

              <tr>
                <th style={{ width: '9%' }}>MARK</th>
                <th style={{ width: '9%' }}>AGG</th>
                <th style={{ width: '9%' }}>MARK</th>
                <th style={{ width: '9%' }}>AGG</th>
                <th style={{ width: '9%' }}>MARK</th>
                <th style={{ width: '9%' }}>AGG</th>
              </tr>

              {reportData?.circular?.subjects?.map(renderSubjectRow)}

              <tr
                style={{
                  background: '#f2f2f2',
                  fontWeight: 800,
                }}
              >
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
                  TOTAL
                </td>
                <td className="data-cell">{reportData?.circular?.bot_total ?? '--'}</td>
                <td className="data-cell">{reportData?.circular?.bot_aggregate ?? '--'}</td>
                <td className="data-cell">{reportData?.circular?.mot_total ?? '--'}</td>
                <td className="data-cell">{reportData?.circular?.mot_aggregate ?? '--'}</td>
                <td className="data-cell">{reportData?.circular?.eot_total ?? '--'}</td>
                <td className="data-cell">{reportData?.circular?.aggregate ?? '--'}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <table className="grading-key">
            <tbody>
              <tr>
                <th>Grade</th>
                <td>D1</td>
                <td>D2</td>
                <td>C3</td>
                <td>C4</td>
                <td>C5</td>
                <td>C6</td>
                <td>P7</td>
                <td>P8</td>
                <td>F9</td>
              </tr>
              <tr>
                <td>
                  <b>Marks</b>
                </td>
                <td>85-100</td>
                <td>75-84</td>
                <td>70-74</td>
                <td>60-69</td>
                <td>55-59</td>
                <td>50-54</td>
                <td>40-49</td>
                <td>35-39</td>
                <td>0-34</td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer className="premium-footer">
          <div className="footer-left">
            <div className="comment-card">
              <div className="comment-row">
                <div className="c-field" style={{ flex: 1 }}>
                  <span>Conduct:</span>
                  <div className="w-line">
                    <span className="line-text">{conductRemark}</span>
                  </div>
                </div>
              </div>

              <div className="comment-row">
                <div className="c-field" style={{ flex: 1 }}>
                  <span>Class Teacher's Comment:</span>
                  <div className="w-line">
                    <span className="line-text">{teacherComment}</span>
                  </div>
                </div>
                <div className="c-field" style={{ width: '180px' }}>
                  <span>Signature:</span>
                  <div className="w-line"></div>
                </div>
              </div>

              <div className="comment-row">
                <div className="c-field" style={{ flex: 1 }}>
                  <span>Head Teacher's Comment:</span>
                  <div className="w-line">
                    <span className="line-text">{headComment}</span>
                  </div>
                </div>
                <div className="c-field" style={{ width: '180px' }}>
                  <span>Signature:</span>
                  <div className="w-line"></div>
                </div>
              </div>
            </div>

            <div className="term-dates-bar">
              <div className="date-item red-date">
                <span>This Term Ends On:</span>
                <span>
                  {reportData?.term?.end_date
                    ? new Date(reportData.term.end_date).toLocaleDateString(
                        'en-UG',
                        {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }
                      )
                    : ''}
                </span>
              </div>

              <div className="date-item blue-date">
                <span>Next Term Begins On:</span>
                <span>
                  {reportData?.term?.next_term_start
                    ? new Date(
                        reportData.term.next_term_start
                      ).toLocaleDateString('en-UG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : ''}
                </span>
              </div>
            </div>

            <div className="validity-strip">
              THIS REPORT FORM IS NOT VALID WITHOUT THE OFFICIAL SCHOOL STAMP
            </div>
          </div>

          <div className="stamp-box">
            OFFICIAL
            <br />
            SCHOOL
            <br />
            STAMP
          </div>
        </footer>
      </div>
    </ReportContainer>
  )
}
