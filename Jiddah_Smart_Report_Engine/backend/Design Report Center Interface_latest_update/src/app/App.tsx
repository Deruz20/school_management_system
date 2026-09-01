import { useState, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { TopToolbar } from './components/TopToolbar';
import { SearchFilterBar } from './components/SearchFilterBar';
import { DocumentCanvas } from './components/DocumentCanvas';
import { SidePanel } from './components/SidePanel';
import type { ReportData, FilterState } from './components/types';
import { mockEnrollments, mockClasses, generateReport } from './components/mock-data';

const DEFAULT_FILTER: FilterState = {
  mode: 'class',
  studentIds: [],
  classId: '',
  section: 'all',
  gender: 'All',
  term: '',
  phase: '',
  curriculum: 'secular',
  layout: 'single',
};

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.75);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFilterChange = useCallback((patch: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...patch }));
  }, []);

  const handleGenerate = useCallback(async () => {
    const { mode, studentIds, classId, term, phase } = filterState;

    if (!term || !phase) {
      toast.error('Please select a Term and Phase before generating.');
      return;
    }
    if (mode === 'class' && !classId) {
      toast.error('Please select a class.');
      return;
    }
    if (mode === 'individual' && studentIds.length === 0) {
      toast.error('Please select at least one student.');
      return;
    }

    setIsGenerating(true);
    const loadingId = toast.loading(
      mode === 'class' ? 'Generating batch reports…' : 'Generating report…'
    );

    await new Promise(resolve => setTimeout(resolve, 1400));

    let targetIds: string[] = [];
    if (mode === 'class') {
      targetIds = mockClasses.find(c => c.id === classId)?.enrollmentIds ?? [];
    } else {
      targetIds = studentIds;
    }

    const generated: ReportData[] = targetIds
      .filter(id => mockEnrollments.find(e => e.enrollment_id === id))
      .map(id => generateReport(id, term as any, phase as any, 2025));

    toast.dismiss(loadingId);

    if (generated.length === 0) {
      toast.warning('No students found for the selected filters.');
      setIsGenerating(false);
      return;
    }

    setReports(generated);
    setActiveReportId(generated[0].id);

    // Warn if dual-curriculum
    const dualCount = generated.filter(r => !!r.theology).length;
    if (dualCount > 0) {
      setTimeout(() => {
        toast.warning(
          `${dualCount} student${dualCount !== 1 ? 's' : ''} with dual-curriculum detected — verify theology marks are complete.`,
          { duration: 6000 }
        );
      }, 1500);
    }

    toast.success(
      `${generated.length} report${generated.length !== 1 ? 's' : ''} generated successfully.`,
      { duration: 3500 }
    );

    setIsGenerating(false);
    setSearchOpen(false);
    setSidePanelOpen(true);
  }, [filterState]);

  const handleDownload = useCallback(() => {
    if (reports.length === 0) {
      toast.error('No reports loaded — generate reports first.');
      return;
    }
    const id = toast.loading(`Preparing ${reports.length} report${reports.length !== 1 ? 's' : ''} for download…`);
    setTimeout(() => {
      toast.dismiss(id);
      toast.success(`${reports.length} report${reports.length !== 1 ? 's' : ''} downloaded.`);
    }, 1800);
  }, [reports]);

  const handlePrint = useCallback(() => {
    if (reports.length === 0) {
      toast.error('No reports loaded — generate reports first.');
      return;
    }
    toast.info('Opening print dialog…');
    setTimeout(() => window.print(), 600);
  }, [reports]);

  const handleShare = useCallback(() => {
    if (reports.length === 0) {
      toast.error('No reports loaded — generate reports first.');
      return;
    }
    toast.success('Share link copied to clipboard!');
  }, [reports]);

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(2, +(z + 0.25).toFixed(2))), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2))), []);
  const handleFitScreen = useCallback(() => setZoom(0.75), []);

  const activeReport = reports.find(r => r.id === activeReportId) ?? null;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: '#f1f5f9' }}
    >
      <Toaster position="top-right" richColors closeButton />

      <TopToolbar
        searchOpen={searchOpen}
        onSearchToggle={() => setSearchOpen(o => !o)}
        onDownload={handleDownload}
        onPrint={handlePrint}
        onShare={handleShare}
        reportCount={reports.length}
        layout={filterState.layout}
        onLayoutToggle={() =>
          handleFilterChange({ layout: filterState.layout === 'grid' ? 'single' : 'grid' })
        }
        isGenerating={isGenerating}
      />

      <SearchFilterBar
        open={searchOpen}
        filterState={filterState}
        onChange={handleFilterChange}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />

      <div className="flex flex-1 overflow-hidden">
        <DocumentCanvas
          reports={reports}
          zoom={zoom}
          layout={filterState.layout}
          activeReportId={activeReportId}
          onSelectReport={setActiveReportId}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitScreen={handleFitScreen}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <SidePanel
          open={sidePanelOpen}
          onToggle={() => setSidePanelOpen(o => !o)}
          reports={reports}
          activeReport={activeReport}
        />
      </div>
    </div>
  );
}
