'use client'

import NurseryEOTReport from './reports/NurseryEOTReport'
import NurseryMOTReport from './reports/NurseryMOTReport'
import PrimaryEOTReport from './reports/PrimaryEOTReport'
import P7EOTReport from './reports/P7EOTReport'
import PrimaryMOTReport from './reports/PrimaryMOTReport'

interface ReportRendererProps {
  data: any
  examMode: 'BOT' | 'MOT' | 'EOT'
}

export function ReportRenderer({ data, examMode }: ReportRendererProps) {
  if (!data || !data.student) return null

  const section = data.student.section
  const scoreType = examMode === 'BOT' ? 'mot' : examMode === 'MOT' ? 'mot' : 'eot'

  const handlePrint = () => {
    setTimeout(() => {
      window.print()
    }, 300)
  }

  return (
    <div className="report-renderer-container mt-8 print:mt-0">
      <div className="flex justify-end mb-4 print:hidden">
        <button
          onClick={handlePrint}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-lg transition duration-200 shadow-sm flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Report Card
        </button>
      </div>

      <div className="report-wrapper print:p-0 print:m-0">
        {section === 'nursery' ? (
          scoreType === 'mot' ? (
            <NurseryMOTReport reportData={data} />
          ) : (
            <NurseryEOTReport reportData={data} />
          )
        ) : section === 'lower_primary' || section === 'upper_primary' ? (
          scoreType === 'mot' ? (
            <PrimaryMOTReport reportData={data} />
          ) : (
            data.student.class_name?.toLowerCase() === 'p.7' ? (
              <P7EOTReport reportData={data} />
            ) : (
              <PrimaryEOTReport reportData={data} />
            )
          )
        ) : (
          <div className="bg-red-50 text-red-800 p-8 text-center rounded-lg border border-red-200 print:hidden">
            <h3 className="font-bold text-lg mb-2">Unknown Section</h3>
            <p>The system cannot render a report for section: "{section}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
