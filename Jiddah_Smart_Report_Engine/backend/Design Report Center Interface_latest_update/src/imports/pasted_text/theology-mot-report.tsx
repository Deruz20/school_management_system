import { getTheologyComment } from '@/lib/grading'
import { ReportContainer } from '@/components/reports/shared/ReportContainer'

export default function TheologyMOTReport({ reportData }: any) {
  const getTheologyRemark = (score: number | null): string => {
    if (score == null) return '--'
    if (score >= 90) return 'ممتاز'
    if (score >= 80) return 'جيد جدا'
    if (score >= 70) return 'جيد'
    if (score >= 60) return 'مقبول'
    return 'ضعيف'
  }

  const toAr = (val: number | string | null | undefined): string => {
    if (val == null) return '--'
    return String(val).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])
  }

  const toHijri = (gregorianYear: number): number =>
    Math.round((gregorianYear - 622) * (33 / 32))

  const termInArabic = (n: number): string => {
    if (n === 1) return 'الأولى'
    if (n === 2) return 'الثاني'
    if (n === 3) return 'الثالث'
    return String(n)
  }

  const subjects = reportData?.theology?.subjects ?? []
  const s = (i: number) => toAr(subjects[i]?.mot_score)
  const sg = (i: number) => subjects[i]?.mot_grade_display ?? '--'

  const renderCard = () => (
    <div className="theology-mot-report font-cairo">
      <div className="corner top-right"></div>
      <div className="corner top-left"></div>
      <div className="corner bottom-right"></div>
      <div className="corner bottom-left"></div>

      <div className="inner">
        <div className="header">
          <div className="basmala">بسم الله الرحمن الرحيم</div>
          <div className="school">
            مدرسة جدة الإسلامية للروضة والابتدائية _ نساغو واكيسو
          </div>
          <div className="title">كشف الدرجات لمنتصف الفترة</div>
        </div>

        <div className="info">
          <div className="row">
            <span>اسم الطالب/ة :</span>
            <div className="line-dots">
              <span className="line-text">
                {reportData?.student?.arabic_name ?? reportData?.student?.name}
              </span>
            </div>
          </div>

          <div className="row">
            <span>الفترة:</span>
            <div className="line-dots short">
              <span className="line-text">
                {toAr(termInArabic(reportData?.term?.term_number))}
              </span>
            </div>

            <span>الفصل:</span>
            <div className="line-dots short">
              <span className="line-text">
                {reportData?.student?.theology_class_arabic ?? '--'}
              </span>
            </div>

            <span>السنة :</span>
            <div className="line-dots medium">
              <span className="line-text">
                {toAr(toHijri(Number(reportData?.term?.academic_year)))}
              </span>
            </div>
            <span>ه‍</span>
            <div className="line-dots medium">
              <span className="line-text">
                {toAr(reportData?.term?.academic_year)}
              </span>
            </div>
            <span>م</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <th>القرآن</th>
                <th>اللغة العربية</th>
                <th>الفقه</th>
                <th>التربية</th>
                <th>المجموع</th>
                <th className="red">الدرجة</th>
              </tr>
              <tr>
                <td>{s(0)}</td>
                <td>{s(1)}</td>
                <td>{s(2)}</td>
                <td>{s(3)}</td>
                <td>{toAr(reportData?.theology?.mot_total)}</td>
                <td className="red">
                  {reportData?.theology?.division ?? '--'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="students">
          <span>عدد الطلبة :</span>
          <div className="line-dots">
            <span className="line-text">
              {toAr(reportData?.circular?.total_students)}
            </span>
          </div>
          <span className="rank">الترتيب :</span>
          <div className="line-dots">
            <span className="line-text">
              {toAr(reportData?.circular?.position)}
            </span>
          </div>
        </div>

        <div className="comment">
          <span>تقرير مرب الفصل :</span>
          <div className="line-dots">
            <span className="line-text"></span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <ReportContainer reportType="TheologyMOTReport">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

.theology-mot-report-page {
    --data-navy: #0f172a;
    --data-indigo: #3730a3;
    --data-teal: #0f766e;
    
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    background: #fcf4db; /* matching the user's PDF yellow background */
}

.cut-line {
    height: 0;
    border-top: 1.5px dashed #b5a371;
    position: relative;
    z-index: 10;
}

.cut-line::after {
    content: '✂ Cut Here';
    position: absolute;
    top: -9px;
    left: 40px;
    background: #fcf4db;
    padding: 0 10px;
    color: #888;
    font-size: 11px;
    font-family: sans-serif;
    font-weight: 600;
}

/* MAIN CARD */
.theology-mot-report {
    flex: 1;
    width: 100%;
    background: transparent;
    position: relative;
    overflow: hidden;
    direction: rtl;
    color: #111;
    font-family: 'Cairo', sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

/* INNER BORDER DECOR */
.theology-mot-report::after {
    content: '';
    position: absolute;
    inset: 15px;
    border: 2px solid #000;
    pointer-events: none;
    border-radius: 2px;
}

/* WATERMARK */
.theology-mot-report::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url('/school_budge.jpeg') center center no-repeat;
    background-size: 250px;
    opacity: 0.08;
    pointer-events: none;
}

/* CONTENT */
.theology-mot-report .inner {
    padding: 16px 28px 12px;
    position: relative;
    z-index: 2;
}

/* HEADER */
.theology-mot-report .header {
    text-align: center;
    position: relative;
}

.theology-mot-report .basmala {
    font-family: 'Amiri', serif;
    font-size: 24px;
    font-weight: 700;
    color: #0d5c46;
    margin-bottom: 4px;
    letter-spacing: .5px;
}

.theology-mot-report .school {
    font-size: 22px;
    font-weight: 800;
    color: #b71c1c;
    text-shadow: 1px 1px 0 #ffffff, 2px 2px 0 rgba(13,92,70,.15);
    line-height: 1.3;
}

.theology-mot-report .title {
    margin-top: 6px;
    font-size: 18px;
    font-weight: 900;
    color: #111;
    display: inline-block;
    padding: 2px 22px;
    border-bottom: 3px solid #0d5c46;
}

/* INFO AREA */
.theology-mot-report .info {
    margin-top: 16px;
    font-size: 15px;
    font-weight: 700;
    color: #111;
    line-height: 1.5;
}

.theology-mot-report .row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    border-bottom: 1px dashed rgba(13,92,70,0.35);
    padding-bottom: 8px;
}

.theology-mot-report .short { width: 100px; }
.theology-mot-report .medium { width: 150px; }

.theology-mot-report .comment {
    margin-top: 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.4;
}

.theology-mot-report .line-dots {
    flex: 1;
    min-width: 0;
    border-bottom: 1.5px dotted #9ca3af;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px 2px 4px;
    color: var(--data-navy);
    font-weight: 900;
    font-size: 16px;
}

.theology-mot-report .line-text {
    line-height: 1.1;
    padding-right: 4px;
    color: var(--data-teal);
    font-style: italic;
    font-weight: 900;
    font-size: 16px;
}

/* TABLE */
.theology-mot-report .table-wrap {
    margin-top: 14px;
    display: flex;
    justify-content: center;
}

.theology-mot-report .table {
    width: 95%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 15px;
    background: rgba(255,255,255,.22);
}

.theology-mot-report .table th,
.theology-mot-report .table td {
    border: 1.5px solid #0d5c46;
    text-align: center;
}

.theology-mot-report .table th {
    padding: 6px 4px;
    background: linear-gradient(180deg, #f6e6b4 0%, #e3c25a 100%);
    color: #111;
    font-weight: 900;
}

.theology-mot-report .table td {
    height: 28px;
    background: rgba(255,255,255,.35);
    vertical-align: middle;
    padding: 2px;
    color: var(--data-indigo);
    font-weight: 900;
    font-size: 16px;
}

.theology-mot-report .red {
    color: #c1121f;
    font-weight: 900;
}

/* STUDENTS ROW */
.theology-mot-report .students {
    margin-top: 10px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 700;
}

.theology-mot-report .students .line-dots {
    width: 140px;
    flex: none;
}

.theology-mot-report .rank {
    color: #c1121f;
    font-weight: 900;
}

/* PREMIUM CORNER ORNAMENTS */
.theology-mot-report .corner {
    position: absolute;
    width: 30px;
    height: 30px;
    border-color: #0d5c46;
    z-index: 3;
}

.theology-mot-report .top-right { top: 12px; right: 12px; border-top: 3px solid; border-right: 3px solid; }
.theology-mot-report .top-left { top: 12px; left: 12px; border-top: 3px solid; border-left: 3px solid; }
.theology-mot-report .bottom-right { bottom: 12px; right: 12px; border-bottom: 3px solid; border-right: 3px solid; }
.theology-mot-report .bottom-left { bottom: 12px; left: 12px; border-bottom: 3px solid; border-left: 3px solid; }

@media print {
    .theology-mot-report-page {
        margin: 0;
        border: none;
        box-shadow: none;
        padding: 10px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
}
        `
        }}
      />

      <div className="theology-mot-report-page">
        {renderCard()}
      </div>
    </ReportContainer>
  )
}
