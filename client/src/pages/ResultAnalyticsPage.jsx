import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';
import ExecutiveSummary from '../components/resultAnalytics/ExecutiveSummary';
import FilterSection from '../components/resultAnalytics/FilterSection';
import AnalyticsCard from '../components/resultAnalytics/AnalyticsCard';
import { StatisticCharts } from '../components/resultAnalytics/StatisticCharts';
import SectionTitle from '../components/resultAnalytics/SectionTitle';
import PersonalityAnalytics from '../components/resultAnalytics/PersonalityAnalytics';
import AssessmentOverview from '../components/resultAnalytics/AssessmentOverview';
import ParticipantGrowthChart from '../components/resultAnalytics/ParticipantGrowthChart';
import ParticipantStatusDonutChart from '../components/resultAnalytics/charts/ParticipantStatusDonutChart';
import { exportResultAnalyticsExcel } from '../utils/exportResultAnalyticsExcel';

// CSS applied ONLY while exporting (scoped under .pdf-export-mode) and removed right after.
// It never touches the live browser layout outside of export.
// IMPORTANT: this must NOT change any chart container's width/height/padding/gap.
// Several bar charts (Age, Education, Departments, Positions) hide their value
// label when a bar gets too narrow to fit the number. Shrinking their container
// via CSS during export was exactly what made those numbers disappear, while
// IQ CFIT/WPT stayed visible because those charts never hide their labels.
// So export CSS here is intentionally limited to visibility/print-fidelity only —
// zero layout/sizing changes to any chart.
const PDF_EXPORT_CSS = `
  .pdf-export-mode [data-export-exclude="true"] { display: none !important; }
  .pdf-export-mode svg text,
  .pdf-export-mode svg tspan { opacity: 1 !important; visibility: visible !important; fill-opacity: 1 !important; }
  .pdf-export-mode .recharts-wrapper,
  .pdf-export-mode .recharts-surface { overflow: visible !important; }
  .pdf-export-mode * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .pdf-export-mode section,
  .pdf-export-mode .rounded-\\[24px\\] {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* --- Text-shift fix (Business Unit Distribution & similar list items) --- */
  /* Root cause: list items (e.g. Business Unit rows) can carry their own
     mount/enter animation (fade + translateY) separate from the Recharts bar
     animation. CHART_ANIMATION_SETTLE_MS only accounts for the Recharts
     animation, so html2canvas can still capture these rows mid-transition —
     which looks exactly like "text turun / baseline shifted".
     Fix: force every animation/transition inside the capture root to its
     FINAL state instantly. This does NOT change any element's width, height,
     padding, or gap — only removes the time-based interpolation, so charts
     keep their exact layout, just fully settled the instant export starts. */
  .pdf-export-mode * {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }

  /* Root cause: long Business Unit names commonly use truncate / line-clamp /
     overflow-hidden so the live card stays a fixed height in the browser.
     html2canvas measures/rasterizes text metrics slightly differently than
     the live browser layout engine in some cases, and a clamped box can end
     up rendering the label pressed against the bottom edge of the card
     (looks like "text turun / nempel ke bawah"). Fix: only during export,
     let text wrap and show in full instead of being clipped/clamped, so
     nothing gets cut off or crammed against the card edge. Card height is
     usually auto/flex-based so this does not distort chart containers.
     If a specific card DOES rely on a fixed pixel height with clamped text,
     that one component may still need a targeted follow-up (see note below). */
  .pdf-export-mode [class*="line-clamp"],
  .pdf-export-mode .truncate {
    -webkit-line-clamp: unset !important;
    overflow: visible !important;
    text-overflow: clip !important;
    white-space: normal !important;
  }

  /* Root cause: mixed/inherited line-height on stacked text (name line +
     meta line) can render with a slightly different baseline under
     html2canvas's rasterization than in native browser layout, showing up
     as inconsistent vertical spacing between the two lines. Fix: pin a
     stable numeric line-height for regular list/body text during export
     only. Excluded from chart SVG text so no chart label logic is touched. */
  .pdf-export-mode p,
  .pdf-export-mode span:not(.recharts-text tspan) {
    line-height: 1.35 !important;
  }
`;

export default function ResultAnalyticsPage() {
  const [filters, setFilters] = useState({});
  const [exporting, setExporting] = useState(false);
  const [excelExporting, setExcelExporting] = useState(false);
  const page1Ref = useRef(null);
  const page2Ref = useRef(null);

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  // Waits for fonts, layout and chart animations to actually settle before we screenshot anything.
  const waitForRender = async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  const filterSummary = Object.keys(filters).length
    ? Object.entries(filters)
        .filter(([, value]) => value !== '')
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ')
    : 'All Participants';

  const renderPdfHeader = (label) => (
    <div
      className={
        exporting
          ? 'mb-2 flex items-center justify-between gap-3 border-b border-slate-200 pb-4'
          : 'hidden'
      }
    >
      <img src="/logo-h.png" alt="Andamas Group" crossOrigin="anonymous" className="h-10 w-auto object-contain" />
      <div>
        <p className="text-lg font-extrabold tracking-wide text-slate-900">ANDAMAS GROUP</p>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
          Result Analytics {label ? `— ${label}` : ''}
        </p>
        <p className="text-xs text-slate-500">Psikotes &amp; Recruitment Assessment</p>
      </div>
      <div className="text-right text-[10px] text-slate-500">
        <p>Generated: {new Date().toLocaleString('id-ID')}</p>
        <p>Filter: {filterSummary}</p>
      </div>
    </div>
  );

  // Renders one "page group" (already visible in the live DOM) into a single canvas.
  // We deliberately keep scale bounded so we never crash the tab on very tall dashboards.
  const captureGroup = async (element) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const widthBudget = 4200; // px safety cap for html2canvas output
    const dynamicScale = widthBudget / rect.width;
    const scale = Math.min(3, Math.max(2, dynamicScale));

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      logging: false,
      imageTimeout: 0,
      foreignObjectRendering: false,
      ignoreElements: (el) =>
        el.dataset?.exportExclude === 'true' ||
        el.tagName === 'BUTTON' ||
        el.tagName === 'SELECT' ||
        el.getAttribute?.('role') === 'tooltip',
    });

    if (!canvas.width || !canvas.height) return null;
    return canvas;
  };

  const handleExportPdf = async () => {
    if (exporting) return;
    if (!page1Ref.current && !page2Ref.current) return;

    setExporting(true);

    const styleEl = document.createElement('style');
    styleEl.id = 'pdf-export-style';
    styleEl.textContent = PDF_EXPORT_CSS;
    document.head.appendChild(styleEl);
    document.body.classList.add('pdf-export-mode');

    try {
      // Let React apply the `exporting` state (header block, export CSS) before measuring anything.
      await waitForRender();

      // WHY THIS WAIT MATTERS:
      // Revealing the export header changes the height of every chart's container,
      // which every Recharts <ResponsiveContainer> picks up via ResizeObserver.
      // Recharts then replays each Bar's enter animation (bars grow from 0, and the
      // <LabelList> numbers fade/slide in) — the longest of which runs 800ms
      // (see AgeBarChart / EducationBarChart / DepartmentHorizontalBarChart /
      // PositionBarChart, all `animationDuration={700-800}`).
      // Page 1 used to get screenshotted only ~500ms after that trigger, i.e. mid-animation,
      // so its LabelList numbers were captured still invisible. Page 2 only "worked" because
      // it happened to be captured later, after Page 1's own (slow) html2canvas render had
      // already eaten enough real time for its animation to finish — pure luck, not a fix.
      // So: wait past the longest animation duration, with margin, before capturing ANYTHING.
      window.dispatchEvent(new Event('resize'));
      const CHART_ANIMATION_SETTLE_MS = 950; // > longest animationDuration (800ms) + margin
      await new Promise((resolve) => setTimeout(resolve, CHART_ANIMATION_SETTLE_MS));

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 7;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;

      const groups = [page1Ref.current, page2Ref.current].filter(Boolean);
      let renderedPages = 0;

      for (let i = 0; i < groups.length; i += 1) {
        let canvas = null;
        try {
          canvas = await captureGroup(groups[i]);
        } catch (captureError) {
          console.error(`Failed to capture PDF page ${i + 1}`, captureError);
        }
        if (!canvas) continue;

        // Fit the WHOLE group onto exactly one page — never crop, never spill onto a 3rd page.
        // If a group is taller than one page can hold, it is shrunk as a whole (never split mid-card).
        const widthRatio = contentWidth / canvas.width;
        const heightRatio = contentHeight / canvas.height;
        const ratio = Math.min(widthRatio, heightRatio);
        const drawWidth = canvas.width * ratio;
        const drawHeight = canvas.height * ratio;
        const offsetX = margin + (contentWidth - drawWidth) / 2;
        const offsetY = margin + (contentHeight - drawHeight) / 2;

        if (renderedPages > 0) pdf.addPage();
        const image = canvas.toDataURL('image/png');
        pdf.addImage(image, 'PNG', offsetX, offsetY, drawWidth, drawHeight, undefined, 'FAST');
        renderedPages += 1;

        // small pause so the next group's layout is fully settled before we screenshot it
        await new Promise((resolve) => setTimeout(resolve, 60));
      }

      if (renderedPages === 0) {
        throw new Error('Result Analytics content has no visible size to export');
      }

      const today = new Date().toISOString().slice(0, 10);
      pdf.save(`Andamas-Result-Analytics-${today}.pdf`);
      await Swal.fire({
        icon: 'success',
        title: 'PDF berhasil dibuat',
        text: 'Laporan Result Analytics telah diunduh.',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Failed to export Result Analytics PDF', error);
      await Swal.fire({
        icon: 'error',
        title: 'Export gagal',
        text: 'PDF Result Analytics tidak dapat dibuat. Silakan coba lagi.',
      });
    } finally {
      document.body.classList.remove('pdf-export-mode');
      styleEl.remove();
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (excelExporting) return;
    setExcelExporting(true);
    try {
      await exportResultAnalyticsExcel(filters);
      await Swal.fire({
        icon: 'success',
        title: 'Excel berhasil dibuat',
        text: 'Laporan Result Analytics telah diunduh.',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Failed to export Result Analytics Excel', error);
      await Swal.fire({
        icon: 'error',
        title: 'Export gagal',
        text: 'Excel Result Analytics tidak dapat dibuat. Silakan coba lagi.',
      });
    } finally {
      setExcelExporting(false);
    }
  };

  return (
    <div>
      <FilterSection
        onApplyFilters={handleApplyFilters}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        exporting={exporting}
        excelExporting={excelExporting}
      />

      <div className="space-y-8">
        {/* PAGE 1: header + KPI + participant analytics */}
        <div ref={page1Ref} className="pdf-page space-y-8">
          {renderPdfHeader('Halaman 1 dari 2')}

          <ExecutiveSummary filters={filters} />

          <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <SectionTitle
              title="Participant Analytics"
              icon="users"
              tone="primary"
              eyebrow="Participant distribution overview"
            />
            <div className="mt-6">
              <StatisticCharts filters={filters} />
            </div>
          </section>
        </div>

        {/* PAGE 2: personality + recruitment + assessment overview */}
        <div ref={page2Ref} className="pdf-page space-y-8">
          {renderPdfHeader('Halaman 2 dari 2')}

          <PersonalityAnalytics filters={filters} />

          <AnalyticsCard
            title="Recruitment Analytics"
            icon="briefcase"
            tone="teal"
            chartType="recruitment"
            filters={filters}
          />

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <ParticipantStatusDonutChart filters={filters} />
            <AssessmentOverview filters={filters} />
            <ParticipantGrowthChart filters={filters} />
          </section>
        </div>
      </div>
    </div>
  );
}
