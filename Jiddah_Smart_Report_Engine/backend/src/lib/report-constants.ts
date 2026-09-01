/**
 * CANONICAL REPORT DIMENSIONS
 * 
 * All A4 dimensions are defined once here in px (96 DPI).
 * No other files should hardcode these values.
 * 
 * A4 @ 96 DPI = 210mm × 297mm = 794px × 1123px (portrait)
 *             = 297mm × 210mm = 1123px × 794px (landscape)
 */

export const REPORT_DIMENSIONS = {
  // A4 Portrait (default)
  A4_PORTRAIT: {
    width: 794,
    height: 1123,
    orientation: 'portrait',
    pageOrientation: 'portrait',
  },

  // A4 Landscape
  A4_LANDSCAPE: {
    width: 1123,
    height: 794,
    orientation: 'landscape',
    pageOrientation: 'landscape',
  },

  // A5 Portrait
  A5_PORTRAIT: {
    width: 559,
    height: 794,
    orientation: 'portrait',
    pageOrientation: 'portrait',
  },

  // A5 Landscape
  A5_LANDSCAPE: {
    width: 794,
    height: 559,
    orientation: 'landscape',
    pageOrientation: 'portrait', // Prints 2-up on A4 Portrait
  },
} as const;

/**
 * STABILIZED REPORTS — Reports included in the print engine stabilization
 * 
 * All reports now use ReportContainer with standardized A4 dimensions,
 * except TheologyMOTReport which uses A5 landscape.
 */
export const STABILIZED_REPORT_ORIENTATIONS = {
  PrimaryBOTReport: REPORT_DIMENSIONS.A4_PORTRAIT,
  PrimaryMOTReport: REPORT_DIMENSIONS.A4_PORTRAIT,
  NurseryMOTReport: REPORT_DIMENSIONS.A4_PORTRAIT,
  NurseryEOTReport: REPORT_DIMENSIONS.A4_PORTRAIT,
  NurseryTheologyEOTReport: REPORT_DIMENSIONS.A4_PORTRAIT,
  PrimaryEOTReport: REPORT_DIMENSIONS.A4_LANDSCAPE,
  P7EOTReport: REPORT_DIMENSIONS.A4_LANDSCAPE,
  TheologyMOTReport: REPORT_DIMENSIONS.A5_LANDSCAPE,
} as const;
