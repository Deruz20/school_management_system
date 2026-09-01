'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Toaster, toast } from 'sonner'
import { AnimatePresence } from 'motion/react'
import { TopToolbar } from './figma-ui/TopToolbar'
import { SearchFilterBar } from './figma-ui/SearchFilterBar'
import { DocumentCanvas } from './figma-ui/DocumentCanvas'
import { SidePanel } from './figma-ui/SidePanel'
import type { Report, FilterState, Student, ClassInfo } from './figma-ui/types'
import { adaptReportData } from './figma-ui/adapter'

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

export type ReportData = {
  id: string
  student: {
    name: string
    admission_number: string
    class_name: string
    section: string
    academic_year: number
  }
  term: {
    label: string
    term_number: number
    academic_year: number
  }
  score_type: 'bot' | 'mot' | 'eot'
  section_type: 'nursery' | 'lower_primary' | 'upper_primary' | 'unknown'
  circular: {
    subjects: any[]
    total: number
    aggregate: number | null
    division: string | null
    position: number | null
  }
  theology: {
    subjects: any[]
    total: number
    aggregate: number | null
    division: string | null
  } | null
  meta: {
    is_term_3: boolean
    promotion_status: string | null
  }
  debug?: any
}

type TermData = {
  id: string
  term?: string
  year?: number
  term_number?: number
  academic_year?: number
  label?: string
  is_current?: boolean
}

type EnrollmentItem = {
  enrollment_id: string
  name: string
  admission_number: string
  circular_class: string
  section: string | null
  theology_class_arabic: string | null
}

const DEFAULT_FILTER: FilterState = {
  mode: 'class',
  studentId: '',
  studentIds: [],
  classId: '',
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
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([])
  
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER)
  
  // Real data store
  const [rawReports, setRawReports] = useState<ReportData[]>([])
  // Figma data models for SidePanel
  const [reports, setReports] = useState<Report[]>([])
  const [studentsData, setStudentsData] = useState<Student[]>([])
  
  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

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

  // Map enrollments to Figma's Student and ClassInfo for the search filter
  const { figmaStudents, figmaClasses } = useMemo(() => {
    const sList: Student[] = []
    const classMap = new Map<string, ClassInfo>()

    for (const e of enrollments) {
      const clsName = e.circular_class && e.circular_class !== '—' ? e.circular_class : e.theology_class_arabic || 'Unassigned'
      const id = e.enrollment_id
      
      let track: 'Secular' | 'Theology' | 'Both' = 'Secular'
      const hasCirc = e.circular_class && e.circular_class !== '—'
      const hasTheo = !!e.theology_class_arabic
      if (hasCirc && hasTheo) track = 'Both'
      else if (hasTheo) track = 'Theology'

      sList.push({
        id,
        name: e.name,
        classId: clsName,
        className: clsName,
        gender: 'Male', // Backend lacks gender currently
        track,
        enrollmentId: e.admission_number,
        dob: 'N/A', // Stub
        parentName: 'Parent / Guardian',
        parentContact: 'N/A'
      })

      if (!classMap.has(clsName)) {
        classMap.set(clsName, { id: clsName, name: clsName, studentIds: [], teacher: 'Class Teacher' })
      }
      classMap.get(clsName)!.studentIds.push(id)
    }

    return { figmaStudents: sList, figmaClasses: Array.from(classMap.values()) }
  }, [enrollments])

  const handleGenerate = useCallback(async () => {
    const { mode, studentIds, classId, section, term, phase } = filterState

    if (!term || !phase) {
      toast.error('Please select both a Term and Phase before generating.')
      return
    }
    if (mode === 'individual' && (!studentIds || studentIds.length === 0)) {
      toast.error('Please select at least one student.')
      return
    }
    if (mode === 'class' && !classId) {
      toast.error('Please select a class.')
      return
    }

    // Determine target enrollment IDs
    let targets: string[] = [];
    if (mode === 'individual') {
      targets = studentIds;
    } else {
      // In class mode, we just get students from the selected class
      targets = figmaClasses.find(c => c.id === classId)?.studentIds ?? [];
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

      // Adapt to Figma UI models for SidePanel stats
      const adaptedReports: Report[] = []
      const updatedStudents: Student[] = []

      for (const raw of generatedReportsData) {
        const { report, student } = adaptReportData(raw)
        adaptedReports.push(report)
        updatedStudents.push(student)
      }

      setReports(adaptedReports)
      setStudentsData(updatedStudents)
      setActiveReportId(generatedReportsData[0].id)

      toast.success(
        `${adaptedReports.length} report${adaptedReports.length !== 1 ? 's' : ''} generated.`,
        { duration: 3000 }
      )
      setSearchOpen(false)
    } catch (err: any) {
      toast.dismiss(loadingId)
      toast.error(err.message || 'Report generation failed')
      setRawReports([])
      setReports([])
    } finally {
      setIsGenerating(false)
    }
  }, [filterState, figmaClasses, terms])

  const handleDownload = useCallback(() => {
    if (reports.length === 0) { toast.error('No reports loaded. Generate reports first.'); return; }
    const id = toast.loading('Preparing download…')
    setTimeout(() => {
      toast.dismiss(id)
      window.print() // Fallback to print
    }, 600)
  }, [reports])

  const handlePrint = useCallback(() => {
    if (reports.length === 0) { toast.error('No reports loaded. Generate reports first.'); return; }
    toast.info('Opening print dialog…')
    setTimeout(() => window.print(), 600)
  }, [reports])

  const handleShare = useCallback(() => {
    if (reports.length === 0) { toast.error('No reports loaded. Generate reports first.'); return; }
    toast.success('Share feature coming soon!')
  }, [reports])

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(2, +(z + 0.25).toFixed(2))), [])
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2))), [])
  const handleFitScreen = useCallback(() => setZoom(1), [])

  const activeReport = reports.find(r => r.id === activeReportId) ?? null
  const activeStudent = activeReport ? (studentsData.find(s => s.id === activeReport.studentId) ?? null) : null

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
    if (filterState.curriculum === 'theology' && hasTheo) {
      format = 'theology'
    } else if (filterState.curriculum === 'secular' && hasCirc) {
      format = 'circular'
    } else if (filterState.curriculum === 'combined' && hasCirc && hasTheo && isPrim && report.score_type === 'eot') {
      format = 'combined'
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
    <div className="h-full flex flex-col overflow-hidden font-sans print:overflow-visible print:h-auto print:block" style={{ background: '#f1f5f9' }}>
      <Toaster position="top-right" richColors closeButton />

      <div className="print:hidden">
        <TopToolbar
          onToggleSearch={() => setSearchOpen(o => !o)}
          searchOpen={searchOpen}
          onDownload={handleDownload}
          onPrint={handlePrint}
          onShare={handleShare}
          reportCount={reports.length}
        />
      </div>

      <AnimatePresence>
        {searchOpen && (
          <div className="print:hidden">
            <SearchFilterBar
              students={figmaStudents}
              classes={figmaClasses}
              filterState={filterState}
              onChange={setFilterState}
              onGenerate={handleGenerate}
              onClose={() => setSearchOpen(false)}
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

        <div className="print:hidden">
          <SidePanel
            isOpen={sidePanelOpen}
            onToggle={() => setSidePanelOpen(o => !o)}
            activeReport={activeReport}
            activeStudent={activeStudent}
            reports={reports}
            students={studentsData}
          />
        </div>
      </div>
    </div>
  )
}
