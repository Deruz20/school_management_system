/**
 * SHARED REPORT TYPE DEFINITIONS
 */

export type ReportOrientation = 'portrait' | 'landscape';

export interface ReportDimensions {
  width: number;
  height: number;
  orientation: ReportOrientation;
}

/**
 * STABILIZED REPORTS — Reports included in the print engine stabilization
 */
export type StabilizedReportType =
  | 'PrimaryBOTReport'
  | 'PrimaryMOTReport'
  | 'NurseryMOTReport'
  | 'NurseryEOTReport'
  | 'NurseryTheologyEOTReport'
  | 'PrimaryEOTReport'
  | 'P7EOTReport'
  | 'TheologyMOTReport';

/**
 * ALL REPORT TYPES — Includes non-stabilized reports
 */
export type ReportType = StabilizedReportType | 'TheologyMOTReport';

export interface ReportContainerProps {
  children: React.ReactNode;
  reportType: StabilizedReportType;
  className?: string;
}

export interface PrintableReportProps {
  reportData: any;
}
