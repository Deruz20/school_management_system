'use client'

import React, { useEffect } from 'react'
import { STABILIZED_REPORT_ORIENTATIONS } from '@/lib/report-constants'
import type { StabilizedReportType } from '@/types/report'

interface ReportViewportProps {
  children: React.ReactNode
  reportType: StabilizedReportType
}

export function ReportViewport({ children, reportType }: ReportViewportProps) {
  const dimensions = STABILIZED_REPORT_ORIENTATIONS[reportType]
  const orientation = dimensions.orientation
  const pageOrientation = dimensions.pageOrientation

  useEffect(() => {
    document.body.classList.add('print-orientation-' + pageOrientation);
    return () => {
      document.body.classList.remove('print-orientation-' + pageOrientation);
    };
  }, [pageOrientation]);

  return (
    <>
      <div 
        className="report-viewport relative mx-auto print:!m-0 print:!shadow-none print:!border-0 print:!rounded-none overflow-visible print:!overflow-hidden"
        data-report-orientation={orientation}
        style={{
          width: orientation === 'landscape' ? '297mm' : '210mm',
          height: orientation === 'landscape' ? '210mm' : '297mm',
          background: '#fffbf0', // Figma's CREAM color
          boxShadow: '0 4px 40px rgba(0,0,0,0.18)',
          borderRadius: 4,
        }}
      >
        {/* Faint Centered Watermark */}
        <div 
          className="absolute inset-0 pointer-events-none flex items-center justify-center z-0"
          style={{ opacity: 0.05 }}
        >
          <img 
            src="/school_budge.jpeg" 
            alt="Watermark" 
            className="w-[80%] max-h-[80%] object-contain grayscale"
          />
        </div>

        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      </div>
    </>
  )
}
