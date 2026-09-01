import { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ReportData, FilterState } from './types';
import { JiddahReport } from './JiddahReport';
import { FloatingControls } from './FloatingControls';
import { EmptyState } from './EmptyState';

interface DocumentCanvasProps {
  reports: ReportData[];
  zoom: number;
  layout: FilterState['layout'];
  activeReportId: string | null;
  onSelectReport: (id: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitScreen: () => void;
  onOpenSearch: () => void;
}

export function DocumentCanvas({
  reports,
  zoom,
  layout,
  activeReportId,
  onSelectReport,
  onZoomIn,
  onZoomOut,
  onFitScreen,
  onOpenSearch,
}: DocumentCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIndex = reports.findIndex(r => r.id === activeReportId);

  function handleNavigate(index: number) {
    if (index < 0 || index >= reports.length) return;
    const newReport = reports[index];
    onSelectReport(newReport.id);
    const el = scrollRef.current?.querySelector(`[data-report-id="${newReport.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Workspace */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto"
        style={{
          background: `
            radial-gradient(circle, rgba(5,150,105,0.035) 1px, transparent 1px),
            radial-gradient(circle, rgba(5,150,105,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '28px 28px, 56px 56px',
          backgroundColor: '#f1f5f9',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.1) transparent',
        }}
      >
        {reports.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-96">
            <EmptyState onSearchOpen={onOpenSearch} />
          </div>
        ) : layout === 'grid' ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap' as const,
              gap: 32,
              padding: 48,
              justifyContent: 'center',
            }}
          >
            <AnimatePresence>
              {reports.map((report, index) => (
                <motion.div
                  key={report.id}
                  data-report-id={report.id}
                  onClick={() => onSelectReport(report.id)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.055, type: 'spring', stiffness: 260, damping: 26 }}
                  style={{
                    zoom: zoom,
                    cursor: 'pointer',
                    borderRadius: 6,
                    outline: report.id === activeReportId
                      ? '3px solid #f97316'
                      : '3px solid transparent',
                    outlineOffset: 4,
                    transition: 'outline-color 0.15s',
                    boxShadow: report.id === activeReportId
                      ? '0 0 0 8px rgba(249,115,22,0.12), 0 12px 48px rgba(0,0,0,0.22)'
                      : '0 8px 32px rgba(0,0,0,0.14)',
                  }}
                >
                  <JiddahReport data={report} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Single scroll layout */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              gap: 40,
              padding: '48px 48px 100px',
            }}
          >
            <AnimatePresence>
              {reports.map((report, index) => (
                <motion.div
                  key={report.id}
                  data-report-id={report.id}
                  onClick={() => onSelectReport(report.id)}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07, type: 'spring', stiffness: 250, damping: 26 }}
                  style={{
                    zoom: zoom,
                    cursor: 'pointer',
                    borderRadius: 6,
                    outline: report.id === activeReportId
                      ? '3px solid #f97316'
                      : '3px solid transparent',
                    outlineOffset: 4,
                    transition: 'outline-color 0.15s',
                    boxShadow: report.id === activeReportId
                      ? '0 0 0 8px rgba(249,115,22,0.12), 0 16px 56px rgba(0,0,0,0.22)'
                      : '0 8px 40px rgba(0,0,0,0.16)',
                  }}
                >
                  <JiddahReport data={report} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Floating controls — always visible */}
      <FloatingControls
        zoom={zoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFitScreen={onFitScreen}
        totalReports={reports.length}
        activeIndex={activeIndex >= 0 ? activeIndex : 0}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
