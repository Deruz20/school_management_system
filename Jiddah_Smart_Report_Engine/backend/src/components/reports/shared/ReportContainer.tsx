/**
 * SHARED REPORT CONTAINER
 *
 * Universal wrapper for all stabilized report components.
 * Centralized dimension and print context management.
 *
 * CONSTRAINTS:
 * - All dimensions from STABILIZED_REPORT_ORIENTATIONS (canonical mapping)
 * - All types from report.ts
 * - px units only (no mm, vh, in, cm)
 * - No inline dimension hardcoding
 * - Stable data attributes for testing
 * - TheologyMOTReport type-safe rejection at compile time
 * - Single source of truth: reportType determines dimensions
 */

import React from 'react'
import { STABILIZED_REPORT_ORIENTATIONS } from '@/lib/report-constants'
import type { ReportContainerProps } from '@/types/report'

/**
 * ReportContainer wraps all stabilized A4 report components.
 *
 * Dimensions are derived ONLY from reportType. This ensures:
 * - No mismatched orientation/dimensions combinations
 * - Single source of truth (STABILIZED_REPORT_ORIENTATIONS)
 * - Type-safe enforcement (StabilizedReportType excludes TheologyMOTReport)
 *
 * @param children - Report content (tables, sections, etc.)
 * @param reportType - One of 6 stabilized report types (canonically mapped to A4 dimensions)
 * @param className - Optional additional CSS classes
 *
 * @example
 * <ReportContainer reportType="PrimaryMOTReport">
 *   <YourReportContent />
 * </ReportContainer>
 */
export const ReportContainer: React.FC<ReportContainerProps> = ({
  children,
  reportType,
  className = '',
}) => {
  // Derive dimensions ONLY from canonical mapping
  // This is the single source of truth for each report's dimensions
  const dimensions = STABILIZED_REPORT_ORIENTATIONS[reportType]
  const orientation = dimensions.orientation

  // Inline styles with exact dimensions from constants
  // Using minHeight instead of height to allow content expansion while maintaining A4 baseline
  const containerStyle: React.CSSProperties = {
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    position: 'relative',
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
    backgroundColor: '#ffffff',
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    flexGrow: 0,
  }

  return (
    <div
      role="report"
      data-report-type={reportType}
      data-report-orientation={orientation}
      style={containerStyle}
      className={`report-container ${className}`}
    >
      {children}
    </div>
  )
}

export default ReportContainer
