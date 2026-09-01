import { getTheologyComment } from '@/lib/grading'
import { ReportContainer } from '@/components/reports/shared/ReportContainer'

export default function NurseryTheologyEOTReport({ reportData }: any) {
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
    return String(val).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d])
  }

  const toHijri = (gregorianYear: number): number =>
    Math.round((gregorianYear - 622) * (33 / 32))

  const termInArabic = (n: number): string => {
    if (n === 1) return 'الأولى'
    if (n === 2) return 'الثاني'
    if (n === 3) return 'الثالث'
    return String(n)
  }

  const getGradeColor = (score: number | null) => {
    if (score == null) return { bg: '#fff', border: 'var(--nursery-gold)', color: 'var(--nursery-gold)' }
    if (score >= 90) return { bg: '#dcfce7', border: '#16a34a', color: '#16a34a' } // A - Green
    if (score >= 80) return { bg: '#dbeafe', border: '#2563eb', color: '#2563eb' } // B - Blue
    if (score >= 70) return { bg: '#fef3c7', border: '#d97706', color: '#d97706' } // C - Yellow
    if (score >= 50) return { bg: '#ffedd5', border: '#ea580c', color: '#ea580c' } // D - Orange
    return { bg: '#fee2e2', border: '#dc2626', color: '#dc2626' } // E - Red
  }

  const getSubjectIcon = (arabicName: string) => {
    if (!arabicName) return '☪️'
    if (arabicName.includes('قرآن')) return '📖'
    if (arabicName.includes('حديث')) return '💬'
    if (arabicName.includes('فقه')) return '⚖️'
    if (arabicName.includes('عقيدة')) return '❤️'
    if (arabicName.includes('سيرة')) return '🐪'
    if (arabicName.includes('أدعية') || arabicName.includes('دعاء')) return '🤲'
    if (arabicName.includes('لغة عربية') || arabicName.includes('عربي')) return '✍️'
    return '☪️'
  }

  return (
    <ReportContainer reportType="NurseryTheologyEOTReport">
      <style dangerouslySetInnerHTML={{
        __html: `
.nursery-theology-eot-report,
.nursery-theology-eot-report * {
    box-sizing: border-box;
}

.nursery-theology-eot-report {
    --nursery-blue: #e3f2fd;
    --nursery-mint: #e8f5e9;
    --nursery-gold: #d4af37;
    --nursery-text: #2c3e50;
    --primary-green: #0f5b48;
    --data-navy: #0f172a;
    --data-indigo: #3730a3;
    --data-teal: #0f766e;
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    direction: rtl;
    padding: 5mm 10mm;
    margin: 0 auto;
    font-family: 'Cairo', sans-serif;
    color: var(--nursery-text);
}

@media print {
    .nursery-theology-eot-report {
        box-shadow: none;
        margin: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    .nursery-theology-eot-report .info-grid {
        gap: 8px;
    }
    .nursery-theology-eot-report .subject-row {
        margin-bottom: 8px;
    }
    .nursery-theology-eot-report .remarks-area {
        margin-top: 15px;
    }
    .nursery-theology-eot-report .remark-box {
        margin-bottom: 8px;
    }
    .nursery-theology-eot-report .signature-row {
        margin-top: 15px;
    }
    .nursery-theology-eot-report .footer-stamp {
        margin-top: 20px;
    }
}

.nursery-theology-eot-report::before {
    content: "⭐";
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 30px;
    opacity: 0.5;
}

.nursery-theology-eot-report::after {
    content: "🌙";
    position: absolute;
    bottom: 10px;
    left: 10px;
    font-size: 30px;
    opacity: 0.5;
}

.nursery-theology-eot-report .watermark-bg {
    position: absolute;
    inset: 0;
    background: url('/school_budge.jpeg') center center no-repeat;
    background-size: contain;
    opacity: 0.04;
    pointer-events: none;
    z-index: 0;
}

.nursery-theology-eot-report > *:not(.watermark-bg) {
    position: relative;
    z-index: 1;
}

.nursery-theology-eot-report .header {
    flex: 0 0 auto;
    text-align: center;
    margin-bottom: 10px;
    border-bottom: 3px double var(--nursery-mint);
    padding-bottom: 5px;
}

.nursery-theology-eot-report .basmala {
    font-family: 'Amiri', serif;
    font-size: 36px;
    color: var(--primary-green);
    margin-bottom: 10px;
}

.nursery-theology-eot-report .school-name {
    font-size: 32px;
    font-weight: 900;
    color: #b71c1c;
    margin: 5px 0;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
}

.nursery-theology-eot-report .report-badge {
    background: var(--nursery-gold);
    color: white;
    display: inline-block;
    padding: 5px 30px;
    border-radius: 50px;
    font-size: 22px;
    font-weight: 700;
    margin-top: 10px;
    box-shadow: 0 4px 10px rgba(212,175,55,0.3);
}

.nursery-theology-eot-report .info-grid {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 10px 0;
    background: var(--nursery-blue);
    padding: 10px 15px;
    border-radius: 15px;
}

.nursery-theology-eot-report .info-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 700;
}

.nursery-theology-eot-report .dot-line {
    flex: 1;
    min-width: 0;
    border-bottom: 1.5px dotted #9ca3af;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px 2px 4px;
    color: var(--data-navy);
    font-weight: 900;
    font-size: 17px;
}

.nursery-theology-eot-report .subjects-container {
    flex: 1 1 auto;
    margin-top: 10px;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.nursery-theology-eot-report .subject-row {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1.5fr 1fr 2fr;
    align-items: center;
    background: #fff;
    border: 2px solid var(--nursery-mint);
    margin-bottom: 8px;
    border-radius: 12px;
    overflow: visible;
    color: var(--primary-green);
    border-right: 5px solid var(--nursery-gold);
}

.nursery-theology-eot-report .grade-circle-wrap {
    display: flex;
    justify-content: center;
    padding: 5px;
}

.nursery-theology-eot-report .grade-circle {
    width: 50px;
    height: 50px;
    border: 3px solid var(--nursery-gold);
    border-radius: 50%;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    color: var(--nursery-gold);
}

.nursery-theology-eot-report .comment-text {
    padding: 10px;
    font-size: 16px;
    color: var(--data-teal);
    font-style: italic;
    font-weight: 900;
    text-align: right;
    direction: rtl;
    line-height: 1.4;
    word-break: break-word;
    white-space: normal;
}

.nursery-theology-eot-report .table-head {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1.5fr 1fr 2fr;
    text-align: center;
    font-weight: 900;
    font-size: 18px;
    margin-bottom: 10px;
    color: var(--primary-green);
    direction: rtl;
}

.nursery-theology-eot-report .subject-name {
    word-break: break-word;
    white-space: normal;
    padding: 0.5rem;
}

.nursery-theology-eot-report .remarks-area {
    flex: 0 0 auto;
    margin-top: 20px;
}

.nursery-theology-eot-report .remark-box {
    border: 2px dashed var(--nursery-gold);
    border-radius: 15px;
    padding: 12px;
    margin-bottom: 12px;
    position: relative;
    background: #fffaf0;
}

.nursery-theology-eot-report .remark-label {
    position: absolute;
    top: -12px;
    right: 20px;
    background: var(--nursery-gold);
    color: white;
    padding: 2px 15px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
}

.nursery-theology-eot-report .signature-row {
    flex: 0 0 auto;
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
    padding: 0 10px;
}

.nursery-theology-eot-report .sign-field {
    text-align: center;
    font-weight: 700;
}

.nursery-theology-eot-report .sign-line {
    width: 180px;
    border-top: 2px solid var(--nursery-text);
    margin-top: 35px;
}

.nursery-theology-eot-report .footer-stamp {
    flex: 0 0 auto;
    text-align: center;
    margin-top: 20px;
    padding: 10px;
    border-radius: 10px;
    background: #fff1f0;
    color: #d32f2f;
    font-weight: 900;
    font-size: 18px;
    border: 2px solid #ffcdd2;
    text-transform: uppercase;
}
        `
      }} />

      <div className="nursery-theology-eot-report font-cairo" dir="rtl">
        <div className="watermark-bg"></div>
        <div className="header">
          <div className="basmala">بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْم</div>
          <div className="school-name">مدرسة جدة الإسلامية للروضة والإبتدائية</div>
          <div className="report-badge">بطاقة تقرير للروضة</div>
        </div>

        <div className="info-grid">
          <div className="info-item" style={{ gridColumn: 'span 2' }}>
            <span>اسم الطفل/ة:</span>
            <div className="dot-line">{reportData?.student?.arabic_name ?? reportData?.student?.name}</div>
          </div>
          <div className="info-item">
            <span>الروضة:</span>
            <div className="dot-line">{reportData?.student?.theology_class_arabic ?? reportData?.student?.class_name}</div>
          </div>
          <div className="info-item">
            <span>الفترة:</span>
            <div className="dot-line">{toAr(termInArabic(reportData?.term?.term_number))}</div>
          </div>
          <div className="info-item">
            <span>السنة:</span>
            <div className="dot-line">{toAr(reportData?.term?.academic_year)}</div>
          </div>
          <div className="info-item">
            <span>عدد الأطفال:</span>
            <div className="dot-line">{toAr(reportData?.circular?.total_students)}</div>
          </div>
        </div>

        <div className="subjects-container">
          <div className="table-head">
            <div>المادة</div>
            <div>الدرجة</div>
            <div>التعليق</div>
          </div>

          {reportData?.theology?.subjects?.map((subject: any) => {
            const colors = getGradeColor(subject.score)
            return (
              <div key={subject.subject_name_arabic} className="subject-row">
                <div className="subject-name">
                  <span style={{ fontSize: '18px', marginLeft: '8px' }}>{getSubjectIcon(subject.subject_name_arabic)}</span>
                  {subject.subject_name_arabic}
                </div>
                <div className="grade-circle-wrap">
                  <div className="grade-circle" style={{ background: colors.bg, borderColor: colors.border, color: colors.color, boxShadow: `0 0 10px ${colors.bg}` }}>
                    {toAr(subject.score)}
                  </div>
                </div>
                <div className="comment-text">
                  {subject.theology_remark ?? ''}
                </div>
              </div>
            )
          })}
        </div>

        <div className="remarks-area">
          <div className="remark-box">
            <span className="remark-label">ملاحظات مرب الفصل</span>
            <div style={{ height: '40px' }}>
              <span style={{ color: 'var(--data-teal)', fontStyle: 'italic', fontWeight: 900, fontSize: '16px', direction: 'rtl' }}>{getTheologyComment(reportData?.theology?.total ?? null)}</span>
            </div>
          </div>
          <div className="remark-box">
            <span className="remark-label">ملاحظات مدير المدرسة</span>
            <div style={{ height: '40px' }}>
              <span style={{ color: 'var(--data-teal)', fontStyle: 'italic', fontWeight: 900, fontSize: '16px', direction: 'rtl' }}>{getTheologyComment(reportData?.theology?.total ?? null)}</span>
            </div>
          </div>
        </div>

        <div className="signature-row">
          <div className="sign-field">
            <div>تقرير مرب الفصل</div>
            <div className="sign-line"></div>
          </div>
          <div className="sign-field">
            <div>تقرير مدير المدرسة</div>
            <div className="sign-line"></div>
          </div>
        </div>

        <div className="footer-stamp">
          هذا التقرير غير صالح بدون ختم المدرسة الرسمي
        </div>
      </div>
    </ReportContainer>
  )
}
