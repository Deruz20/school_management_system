'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Toaster, toast } from 'sonner'
import { AnimatePresence } from 'motion/react'
import { TopToolbar } from './figma-ui/TopToolbar'
import { SearchFilterBar } from './figma-ui/SearchFilterBar'
import { DocumentCanvas } from './figma-ui/DocumentCanvas'
import { SidePanel } from './figma-ui/SidePanel'
import type { FilterState, ReportData, ClassGroup, EnrollmentItem } from './figma-ui/types'
import * as AlertDialog from '@radix-ui/react-alert-dialog'

// Jiddah Templates
import PrimaryEOTReport from './reports/PrimaryEOTReport'
import P7EOTReport from './reports/P7EOTReport'
import PrimaryBOTReport from './reports/PrimaryBOTReport'
import PrimaryMOTReport from './reports/PrimaryMOTReport'
import NurseryEOTReport from './reports/NurseryEOTReport'
import NurseryMOTReport from './reports/NurseryMOTReport'
import TheologyMOTReport from './reports/TheologyMOTReport'
import NurseryTheologyEOTReport from './reports/NurseryTheologyEOTReport'
import { ReportViewport } from './reports/ReportViewport'
import { STABILIZED_REPORT_ORIENTATIONS } from '@/lib/report-constants'

type TermData = {
  id: string
  term?: string
  year?: number
  term_number?: number
  academic_year?: number
  label?: string
  is_current?: boolean
}

type RawEnrollment = {
  enrollment_id: string
  name: string
  admission_number: string
  circular_class: string
  section: string | null
  theology_class_arabic: string | null
}

const DEFAULT_FILTER: FilterState = {
  mode: 'class',
  studentIds: [],
  classIds: [],
  section: 'all',
  gender: 'All',
  term: '',
  phase: '',
  curriculum: 'secular',
  layout: 'single',
}

interface ReportGeneratorClientProps {
  terms: TermData[]
}

export function ReportGeneratorClient({ terms }: ReportGeneratorClientProps) {
  const [enrollments, setEnrollments] = useState<RawEnrollment[]>([])
  
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER)
  
  // Real data store
  const [rawReports, setRawReports] = useState<ReportData[]>([])
  
  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  // Load roster
  useEffect(() => {
    async function loadEnrollments() {
      try {
        const response = await fetch('/api/enrollments')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load enrollments')
        setEnrollments(data)
      } catch (err: any) {
        toast.error('Failed to load students list.')
      }
    }
    loadEnrollments()
  }, [])

  // Map enrollments to Figma's ClassInfo and EnrollmentItem for the search filter
  const { figmaClasses, figmaEnrollments } = useMemo(() => {
    const eList: any[] = []
    const classMap = new Map<string, ClassGroup>()

    for (const e of enrollments) {
      const clsName = e.circular_class && e.circular_class !== '—' ? e.circular_class : e.theology_class_arabic || 'Unassigned'
      const id = e.enrollment_id
      
      let track: 'Secular' | 'Theology' | 'Both' = 'Secular'
      const hasCirc = e.circular_class && e.circular_class !== '—'
      const hasTheo = !!e.theology_class_arabic
      if (hasCirc && hasTheo) track = 'Both'
      else if (hasTheo) track = 'Theology'

      eList.push({
        enrollment_id: id,
        name: e.name,
        arabic_name: '', // Backend lacks arabic_name
        admission_number: e.admission_number,
        circular_class: clsName,
        section_type: e.section || 'unknown',
        theology_class_arabic: e.theology_class_arabic,
        track,
      })

      if (!classMap.has(clsName)) {
        classMap.set(clsName, { 
          id: clsName, 
          name: clsName, 
          section_type: (e.section as any) || 'unknown',
          enrollmentIds: []
        })
      }
      classMap.get(clsName)!.enrollmentIds.push(id)
    }

    return { figmaClasses: Array.from(classMap.values()), figmaEnrollments: eList }
  }, [enrollments])

  const handleGenerate = useCallback(async () => {
    const { mode, studentIds, classIds, section, term, phase } = filterState

    if (!term || !phase) {
      toast.error('Please select both a Term and Phase before generating.')
      return
    }
    if (mode === 'individual' && (!studentIds || studentIds.length === 0)) {
      toast.error('Please select at least one student.')
      return
    }
    if (mode === 'class' && (!classIds || classIds.length === 0)) {
      toast.error('Please select at least one class.')
      return
    }

    if (mode === 'class' && (filterState.curriculum === 'theology' || filterState.curriculum === 'combined')) {
      toast.warning('Theology marks may be incomplete for some students.')
      setIsConfirmOpen(true)
      return
    }

    executeGeneration()
  }, [filterState])

  const executeGeneration = useCallback(async () => {
    const { mode, studentIds, classIds, section, term, phase } = filterState

    // Determine target enrollment IDs
    let targets: string[] = [];
    if (mode === 'individual') {
      targets = studentIds;
    } else {
      // In class mode, we just get students from the selected classes
      targets = figmaClasses
        .filter(c => classIds.includes(c.id))
        .flatMap(c => c.enrollmentIds);
    }

    if (targets.length === 0) {
      toast.warning('No students found for this selection.')
      return
    }

    // Map the selected term "1", "2", "3" to the actual backend TermData id
    const termObj = terms.find(t => String(t.term_number) === term)
    if (!termObj) {
      toast.error('Term not found in database.')
      return
    }

    setIsGenerating(true)
    const loadingId = toast.loading(
      mode === 'class' ? 'Generating batch reports…' : 'Generating report…'
    )

    try {
      const response = await fetch('/api/report/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollment_ids: targets,
          term_id: termObj.id,
          score_type: phase.toLowerCase()
        })
      })
      const data = await response.json()

      toast.dismiss(loadingId)

      if (!response.ok) throw new Error(data.error || 'Failed to generate reports')
      
      const generatedReportsData: ReportData[] = data.reports || []

      if (generatedReportsData.length === 0) {
        toast.warning('No report data found for the selected students.')
        setIsGenerating(false)
        return
      }

      setRawReports(generatedReportsData)
      setActiveReportId(generatedReportsData[0].id)

      toast.success(
        `${generatedReportsData.length} report${generatedReportsData.length !== 1 ? 's' : ''} generated.`,
        { duration: 3000 }
      )
      setSearchOpen(false)

      // Post-generation alerts
      setTimeout(() => {
        const missingTheology = generatedReportsData.filter(r => 
          r.section_type !== 'nursery' && r.score_type === 'eot' && !r.theology && r.student.theology_class_arabic
        );
        if (missingTheology.length > 0) {
          toast.warning(`${missingTheology.length} students are missing theology EOT marks`, {
            duration: 7000,
            action: {
              label: 'View',
              onClick: () => setActiveReportId(missingTheology[0].id)
            }
          });
        }

        const incompleteMarks = generatedReportsData.filter(r => 
          r.score_type === 'eot' && r.circular.subjects.some((subj: any) => subj.eot_score === null)
        );
        if (incompleteMarks.length > 0) {
          toast.warning(`Incomplete marks detected for ${incompleteMarks.length} students`, {
            duration: 7000,
            action: {
              label: 'View',
              onClick: () => setActiveReportId(incompleteMarks[0].id)
            }
          });
        }
      }, 1500)

    } catch (err: any) {
      toast.dismiss(loadingId)
      toast.error(err.message || 'Report generation failed')
      setRawReports([])
    } finally {
      setIsGenerating(false)
    }
  }, [filterState, figmaClasses, terms])

  const handleDownload = useCallback(() => {
    if (rawReports.length === 0) { toast.error('No reports loaded. Generate reports first.'); return; }
    const id = toast.loading('Preparing download…')
    setTimeout(() => {
      toast.dismiss(id)
      window.print() // Fallback to print
    }, 600)
  }, [rawReports])

  const handlePrint = useCallback(() => {
    if (rawReports.length === 0) { toast.error('No reports loaded. Generate reports first.'); return; }
    toast.info('Opening print dialog…')
    setTimeout(() => window.print(), 600)
  }, [rawReports])

  const handleShare = useCallback(() => {
    if (rawReports.length === 0) { toast.error('No reports loaded. Generate reports first.'); return; }
    toast.success('Share feature coming soon!')
  }, [rawReports])

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(2, +(z + 0.25).toFixed(2))), [])
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2))), [])
  const handleFitScreen = useCallback(() => setZoom(1), [])

  const activeReport = rawReports.find(r => r.id === activeReportId) ?? null

  // RENDER CUSTOM REPORT TEMPLATE
  const renderJiddahReport = (report: ReportData, isActive: boolean) => {
    let component: React.ReactNode = null
    let type: keyof typeof STABILIZED_REPORT_ORIENTATIONS | null = null

    const isP7 = report.student.class_name?.toLowerCase() === 'p.7'
    const isPrim = report.section_type === 'lower_primary' || report.section_type === 'upper_primary'
    
    const hasCirc = report.circular.subjects.length > 0
    const hasTheo = !!report.theology
    
    let format = 'circular'
    if (isPrim && report.score_type === 'eot') {
      if (hasCirc && hasTheo) format = 'combined'
      else if (hasCirc) format = 'circular'
      else if (hasTheo) format = 'theology'
    } else {
      if (hasCirc) format = 'circular'
      else if (hasTheo) format = 'theology'
    }
    
    // Override format based on user's curriculum selection in the UI
    if (filterState.curriculum === 'theology') {
      if (hasTheo) format = 'theology'
    } else if (filterState.curriculum === 'secular') {
      if (hasCirc) format = 'circular'
    } else if (filterState.curriculum === 'combined') {
      if (hasCirc && hasTheo && isPrim && report.score_type === 'eot') {
        format = 'combined'
      }
      // Else it naturally falls back to the default format computed above
    }

    if (format === 'combined' || format === 'circular') {
      if (isPrim && report.score_type === 'eot') {
        component = isP7 ? <P7EOTReport reportData={report} /> : <PrimaryEOTReport reportData={report} />
        type = isP7 ? 'P7EOTReport' : 'PrimaryEOTReport'
      } else if (report.section_type === 'nursery') {
        if (report.score_type === 'mot') {
          component = <NurseryMOTReport reportData={report} />
          type = 'NurseryMOTReport'
        } else {
          component = <NurseryEOTReport reportData={report} />
          type = 'NurseryEOTReport'
        }
      } else if (report.score_type === 'bot') {
        component = <PrimaryBOTReport reportData={report} />
        type = 'PrimaryBOTReport'
      } else {
        component = <PrimaryMOTReport reportData={report} />
        type = 'PrimaryMOTReport'
      }
    } else if (format === 'theology') {
      if (report.section_type === 'nursery' && report.score_type === 'eot') {
        component = <NurseryTheologyEOTReport reportData={report} />
        type = 'NurseryTheologyEOTReport'
      } else {
        component = <TheologyMOTReport reportData={report} />
        type = 'TheologyMOTReport'
      }
    }

    if (!component || !type) return <div className="p-8 text-rose-500">Error: Unmapped report format.</div>

    return (
      <div className="bg-white" style={{ pointerEvents: isActive ? 'auto' : 'none' }}>
        <ReportViewport reportType={type}>
          {component}
        </ReportViewport>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#f1f5f9] font-sans flex flex-col relative print:bg-white overflow-hidden text-slate-800 print:overflow-visible print:h-auto print:block">
      <Toaster position="top-right" richColors closeButton />

      <AlertDialog.Root open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity animate-in fade-in" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-white p-6 shadow-xl animate-in zoom-in-95 fade-in border border-slate-100">
            <div className="flex flex-col gap-4">
              <AlertDialog.Title className="text-lg font-semibold text-slate-800">
                Are you sure?
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-slate-600 leading-relaxed">
                You are generating reports that include Theology, but some students may have incomplete theology marks. Do you want to proceed anyway?
              </AlertDialog.Description>
              <div className="flex justify-end gap-3 mt-4">
                <AlertDialog.Cancel asChild>
                  <button className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <button 
                    onClick={() => executeGeneration()}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    Proceed
                  </button>
                </AlertDialog.Action>
              </div>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <div className="print:hidden">
        <TopToolbar
          onSearchToggle={() => setSearchOpen(o => !o)}
          searchOpen={searchOpen}
          onDownload={handleDownload}
          onPrint={handlePrint}
          onShare={handleShare}
          reportCount={rawReports.length}
          layout={filterState.layout || 'single'}
          onLayoutToggle={() => setFilterState({ ...filterState, layout: filterState.layout === 'grid' ? 'single' : 'grid' })}
        />
      </div>

      <AnimatePresence>
        {searchOpen && (
          <div className="print:hidden absolute top-[56px] left-0 right-0 z-40">
            <SearchFilterBar
              open={searchOpen}
              enrollments={figmaEnrollments}
              classes={figmaClasses}
              filterState={filterState}
              onChange={(patch) => setFilterState({ ...filterState, ...patch })}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
        <DocumentCanvas
          reports={rawReports}
          activeReportId={activeReportId}
          onSelectReport={setActiveReportId}
          renderReport={renderJiddahReport}
          zoom={zoom}
          layout={filterState.layout}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitScreen={handleFitScreen}
          onSearchOpen={() => setSearchOpen(true)}
        />

        <div className="print:hidden flex flex-col h-full">
          <SidePanel
            open={sidePanelOpen}
            onToggle={() => setSidePanelOpen(o => !o)}
            activeReport={rawReports.find(r => r.id === activeReportId) || null}
            reports={rawReports}
          />
        </div>
      </div>
    </div>
  )
}
