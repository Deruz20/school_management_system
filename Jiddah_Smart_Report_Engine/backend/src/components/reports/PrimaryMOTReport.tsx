/* eslint-disable react/style-prop-object */

import { getClassTeacherComment, getHeadTeacherComment, getConductRemark } from '@/lib/grading'
import { ReportContainer } from '@/components/reports/shared/ReportContainer'

export default function PrimaryMOTReport({ reportData }: any) {
  const className = reportData?.class_name || reportData?.class || '';
  const lowerClasses = ['baby', 'middle', 'top', 'p.1', 'p.2', 'p.3'];
  const isLower = lowerClasses.some(c => className.toLowerCase().includes(c)) || reportData?.section_type === 'lower_primary';

  return (
    <ReportContainer reportType="PrimaryMOTReport">
      <style dangerouslySetInnerHTML={{
        __html: `
    .primary-mot-report,
    .primary-mot-report * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }


    .primary-mot-report {
        --data-navy: #0f172a;
        --data-indigo: #3730a3;
        --data-teal: #0f766e;
        
        margin: 0;
        background: #fffef8;
        border: 4px solid #163f2d;
        position: relative;
        overflow: hidden;
        padding: 12px;
        color: #1a1a1a;
        page-break-inside: avoid;
        page-break-after: avoid;
        font-family: 'Poppins', sans-serif;
        box-sizing: border-box;
        flex: 1 1 auto;
        width: 100%;
        height: 100%;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    /* Decorative Watermark */
    .primary-mot-report .watermark-bg {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: url('/school_budge.jpeg') center center no-repeat;
        background-size: contain;
        opacity: 0.04;
        pointer-events: none;
        z-index: 0;
    }
    .primary-mot-report > *:not(.watermark-bg):not(.final-footer) {
        position: relative;
        z-index: 1;
    }

    /* Decorative Border */
    .primary-mot-report::before {
        content: "✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦";
        position: absolute;
        top: 6px;
        left: 0;
        width: 100%;
        text-align: center;
        color: #0d5c3f;
        letter-spacing: 6px;
        font-size: 14px;
    }

    .primary-mot-report::after {
        content: "✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦";
        position: absolute;
        bottom: 6px;
        left: 0;
        width: 100%;
        text-align: center;
        color: #0d5c3f;
        letter-spacing: 6px;
        font-size: 14px;
    }

    /* Header */
    .primary-mot-report .top-arabic {
        text-align: center;
        font-family: 'Cairo', sans-serif;
        font-size: 24px;
        color: #0d5c3f;
        font-weight: 700;
        margin-top: 5px;
    }

    .primary-mot-report .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 5px;
        width: 100%;
        gap: 12px;
    }

    .primary-mot-report .school-left { flex: 1; }
    .primary-mot-report .school-left h1 {
        color: #7a1408;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 700;
    }

    .primary-mot-report .school-left p {
        margin-top: 5px;
        font-size: 11px;
        line-height: 1.3;
        color: #444;
    }

    .primary-mot-report .logo {
        width: 85px;
        height: auto;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .primary-mot-report .school-right { flex: 1; text-align: right; font-family: 'Cairo', sans-serif; direction: rtl; }
    .primary-mot-report .school-right h2 { color: #7a1408; font-size: 21px; line-height: 1.4; font-weight: 700; }

    /* Ribbon */
    .primary-mot-report .ribbon {
        width: 100%;
        margin: 12px auto;
        background: linear-gradient(to right, #0d5c3f, #15734f);
        color: #fff;
        text-align: center;
        padding: 10px;
        border-radius: 50px;
        font-size: 18px;
        font-weight: 700;
        box-shadow: 0 4px 10px rgba(0,0,0,.15);
        border: 3px solid #d6b14c;
    }

    /* Info Section */
    .primary-mot-report .info {
        margin-top: 10px;
        border: 2px solid #d6b14c;
        border-radius: 12px;
        padding: 10px 15px;
    }

    .primary-mot-report .info-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
    }

    .primary-mot-report .field { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
    .primary-mot-report .line { 
        border-bottom: 1.5px dotted #9ca3af; 
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--data-navy);
        font-weight: 900;
        font-size: 15px;
        padding-bottom: 2px;
    }

    /* Main Table */
    .primary-mot-report .main-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
    }

    .primary-mot-report .main-table th {
        background: #0d5c3f;
        color: #fff;
        padding: 4px 2px;
        border: 1px solid #d6b14c;
        font-size: 11px;
    }

    .primary-mot-report .main-table td {
        border: 1px solid #d6b14c;
        padding: 10px 8px;
        height: 32px;
        font-size: 11px;
        text-align: center;
        font-weight: 600;
    }

    .primary-mot-report .main-table .subhead { background: #e8f3ec; color: #0d5c3f; font-weight: 700; }
    .primary-mot-report .subject { font-weight: 700; text-align: left !important; }
    
    .primary-mot-report .data-cell {
        color: var(--data-indigo);
        font-weight: 900;
        font-size: 14px;
        text-align: center;
    }
    
    .primary-mot-report .remarks-cell {
        color: var(--data-teal);
        font-weight: 800;
        font-style: italic;
        font-size: 11px;
        text-align: left;
    }

    /* Grading */
    .primary-mot-report .grading { margin-top: 10px; }
    .primary-mot-report .grade-title { font-size: 13px; font-weight: 700; color: #7a1408; margin-bottom: 4px; }
    .primary-mot-report .grade-table { width: 100%; border-collapse: collapse; }
    .primary-mot-report .grade-table th { background: #d6b14c; color: #000; padding: 6px; border: 1px solid #333; font-size: 10px; }
    .primary-mot-report .grade-table td { border: 1px solid #333; text-align: center; padding: 6px; font-size: 11px; }

    /* Bottom Section */
    .primary-mot-report .bottom { margin-top: 10px; padding-bottom: 0.5rem; }
    .primary-mot-report .comment-box { margin-bottom: 12px; }
    .primary-mot-report .comment-label { font-weight: 700; font-size: 13px; margin-bottom: 5px; color: #111; }
    .primary-mot-report .comment-line { border-bottom: 2px dotted #444; height: 22px; margin-bottom: 5px; }
    
    .primary-mot-report .comment-field {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-bottom: 12px;
      flex: 0 0 auto;
    }
    .primary-mot-report .comment-field > span:first-child {
      font-weight: 700;
      font-size: 13px;
      color: #111;
    }
    .primary-mot-report .filled-line {
      width: 100%;
      border-bottom: 1.5px dotted #9ca3af;
      min-height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px 2px 4px;
    }

    .primary-mot-report .line-text {
      font-style: italic;
      color: var(--data-teal);
      font-weight: 900; font-size: 15px;
      line-height: 1.2;
      background: transparent;
      padding-right: 4px;
    }

    .primary-mot-report .footer-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-top: 10px;
    }

    .primary-mot-report .signature { width: 200px; }
    .primary-mot-report .signature .line { width: 100%; }

    .primary-mot-report .stamp {
        width: 120px;
        height: 120px;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #7584a0;
        font-size: 11px;
        font-weight: 700;
        text-align: center;
        background: transparent;
        border: 2px dashed #7584a0;
        border-radius: 50%;
        box-shadow: none;
    }

    .primary-mot-report .final-footer {
        flex: 0 0 auto;
        margin-top: 10px;
        width: 100%;
        background: #7a1408;
        color: white;
        text-align: center;
        padding: 5px;
        font-size: 11px;
        font-weight: 800;
        border-radius: 4px;
        letter-spacing: 1px;
    }
        `
      }} />

      <div className="primary-mot-report font-poppins">
        <div className="watermark-bg"></div>
        <div className="top-arabic" style={{ visibility: 'hidden' }}>.</div>

        <div className="header">
          <div className="school-left">
            <h1>JIDDAH ISLAMIC NURSERY <br /> AND PRIMARY SCHOOL - Nsaggu</h1>
            <p>
              P.O.Box 34008 Kampala (U)<br />
              Tel: +256 744950042 / 0705316961<br />
              jiddahislamicnurseryandpri@gmail.com
            </p>
          </div>

          <div className="logo">
            <img src="/school_budge.jpeg" alt="School Badge" style={{ width: '100%', height: 'auto' }} />
          </div>

          <div className="school-right">
            <h2>مدرسة جدة الإسلامية للروضة والإبتدائية - نساغو - واكيسو</h2>
          </div>
        </div>

        <div className="ribbon">{reportData?.section_type === 'upper_primary' ? 'UPPER' : 'LOWER'} REPORT FORM - MID TERM</div>

        <div className="info">
          <div className="info-row">
            <div className="field">Class: <div className="line">{reportData?.student?.class_name}</div></div>
            <div className="field">Term: <div className="line">{reportData?.term?.label}</div></div>
            <div className="field">Year: <div className="line" style={{ width: '100px' }}>{reportData?.term?.academic_year}</div></div>
          </div>
          <div className="info-row" style={{ marginBottom: 0 }}>
            <div className="field" style={{ width: '100%' }}>
              Pupil’s Name: <div className="line" style={{ width: '100%' }}>{reportData?.student?.name}</div>
            </div>
          </div>
          <div className="info-row" style={{ marginTop: '12px' }}>
            <div className="field">Position: <div className="line">{reportData?.circular?.position ?? '--'}</div></div>
            <div className="field">Out Of: <div className="line">{reportData?.circular?.total_students ?? '--'}</div></div>
            <div className="field">Division: <div className="line">{reportData?.circular?.division ?? '--'}</div></div>
          </div>
        </div>

        <table className="main-table">
          <tbody>
            <tr className="subhead">
              <th rowSpan={2} style={{ width: '20%' }}>SUBJECTS</th>
              <th colSpan={2} style={{ width: '22%' }}>BEGINNING OF TERM</th>
              <th colSpan={2} style={{ width: '22%' }}>MID TERM</th>
              <th rowSpan={2} style={{ width: '36%' }}>SUBJECT TEACHER’S COMMENT</th>
            </tr>
            <tr className="subhead">
              <th style={{ width: '11%' }}>MARK</th>
              <th style={{ width: '11%' }}>AGG</th>
              <th style={{ width: '11%' }}>MARK</th>
              <th style={{ width: '11%' }}>AGG</th>
            </tr>
            {reportData?.circular?.subjects?.map((subject: any) => (
              <tr key={subject.subject_name}>
                <td className="subject">{subject.subject_name}</td>
                <td className="data-cell">{subject.bot_score ?? '--'}</td>
                <td className="data-cell">{subject.bot_grade_display ?? '--'}</td>
                <td className="data-cell">{subject.mot_score ?? '--'}</td>
                <td className="data-cell">{subject.mot_grade_display ?? '--'}</td>
                <td className="remarks-cell">{subject.remark ?? ''}</td>
              </tr>
            ))}
            <tr>
              <td><b>TOTAL</b></td>
              <td className="data-cell">{reportData?.circular?.bot_total ?? '--'}</td>
              <td className="data-cell">{reportData?.circular?.bot_aggregate ?? '--'}</td>
              <td className="data-cell">{reportData?.circular?.mot_total ?? reportData?.circular?.total ?? '--'}</td>
              <td className="data-cell">{reportData?.circular?.mot_aggregate ?? '--'}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div className="grading">
          <div className="grade-title">Grading</div>
          <table className="grade-table">
            <tbody>
              <tr>
                <th>Grade</th><th>D1</th><th>D2</th><th>C3</th><th>C4</th><th>C5</th><th>C6</th><th>P7</th><th>P8</th><th>F9</th>
              </tr>
              <tr>
                <td><strong>Marks</strong></td>
                <td>85-100</td><td>75-84</td><td>70-74</td><td>60-69</td><td>55-59</td><td>50-54</td><td>40-49</td><td>35-39</td><td>0-34</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bottom">
          <div className="comment-field">
            <span>Class Teacher's Comment:</span>
            <div className="filled-line">
              <span className="line-text">
                {reportData?.circular?.class_teacher_comment ?? getClassTeacherComment(reportData?.circular?.division ?? null)}
              </span>
            </div>
          </div>

          <div className="footer-row">
            <div style={{ width: '68%' }}>
              <div className="comment-field">
                <span>Conduct:</span>
                <div className="filled-line">
                  <span className="line-text">
                    {reportData?.circular?.conduct_remark ?? getConductRemark(reportData?.circular?.division ?? null)}
                  </span>
                </div>
              </div>
            </div>
            <div className="signature">
              <div className="comment-field">
                <span>Signature:</span>
                <div className="filled-line"></div>
              </div>
            </div>
          </div>

          <div className="comment-field" style={{ marginTop: '15px' }}>
            <span>Head Teacher's Comment:</span>
            <div className="filled-line">
              <span className="line-text">
                {reportData?.circular?.head_teacher_comment ?? getHeadTeacherComment(reportData?.circular?.division ?? null)}
              </span>
            </div>
          </div>

          <div className="footer-row">
            <div className="signature">
              <div className="comment-field">
                <span>Signature:</span>
                <div className="filled-line"></div>
              </div>
            </div>
            <div className="stamp">OFFICIAL<br />SCHOOL STAMP</div>
          </div>
        </div>

        <div className="final-footer">
          THIS REPORT FORM IS INVALID WITHOUT THE OFFICIAL SCHOOL STAMP
        </div>

      </div>
    </ReportContainer>
  )
}
