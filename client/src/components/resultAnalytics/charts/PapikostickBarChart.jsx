import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { api } from '../../../utils/api';
import ChartWrapper from './ChartWrapper';

const PAPI_LABELS = {
  N: 'Need to finish task', G: 'Hard intense worker', A: 'Need to achieve',
  L: 'Leadership role', P: 'Need to control others', I: 'Ease in decision making',
  T: 'Pace', V: 'Vigorous type', O: 'Need for closeness', B: 'Need to belong',
  S: 'Social extension', X: 'Need to be noticed', C: 'Organized type', D: 'Interest in details',
  R: 'Theoretical type', Z: 'Need for change', E: 'Emotional resistant', K: 'Need to be forceful',
  F: 'Need to support authority', W: 'Need for rules',
};

function useRecruitmentData(endpoint, filters) {
  const [state, setState] = useState({ data: [], total: 0, average: null, loading: true, error: false });
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setState((current) => ({ ...current, loading: true, error: false }));
      try {
        const { data } = await api.get(endpoint, { params: filters });
        if (active) setState({ data: Array.isArray(data.distribution) ? data.distribution : [], total: data.total ?? 0, average: data.average_score ?? null, loading: false, error: false });
      } catch {
        if (active) setState((current) => ({ ...current, loading: false, error: true }));
      }
    };
    fetchData();
    return () => { active = false; };
  }, [endpoint, filters]);
  return state;
}

const PapikostickBarChart = ({ filters }) => {
  const state = useRecruitmentData('/analytics/recruitment/papikostick', filters);
  const data = state.data;
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef(null);

  // Diurutkan dari terbesar supaya paling gampang dibaca (murni urutan tampilan,
  // nilai & data sama sekali tidak diubah).
  const sorted = useMemo(() => [...data].sort((a, b) => Number(b.value || 0) - Number(a.value || 0)), [data]);
  const maxValue = useMemo(() => Math.max(1, ...sorted.map((item) => Number(item.value || 0))), [sorted]);

  // Capture the whole card (title + chart + legend) into one JPG and trigger a
  // browser download. Same self-contained pattern as SpeedBarChart.jsx / MemoryDonutChart.jsx.
  // `data-export-exclude="true"` on the button makes html2canvas skip it both
  // here and in the multi-page PDF export in ResultAnalyticsPage.jsx.
  const handleDownloadJpg = useCallback(async (event) => {
    event.stopPropagation();
    if (isDownloading || !cardRef.current) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.dataset?.exportExclude === 'true',
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const today = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `PAPIKOSTICK-${today}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download PAPIKOSTICK chart image', err);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  return (
    <div ref={cardRef} className="relative flex h-full w-full flex-col">
      <button
        type="button"
        onClick={handleDownloadJpg}
        disabled={isDownloading}
        data-export-exclude="true"
        title="Download sebagai JPG"
        aria-label="Download chart sebagai JPG"
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-white/90 text-gray-400 shadow-sm backdrop-blur-sm transition hover:border-gray-200 hover:text-gray-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDownloading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        )}
      </button>

      <ChartWrapper title="PAPIKOSTICK" isLoading={state.loading} isError={state.error}>
        <div className="flex w-full flex-col">
          <p className="mb-3 text-xs text-slate-500">Distribusi 19 indikator kepribadian kerja</p>

          {sorted.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">No Data Available</div>
          ) : (
            <ul className="space-y-1">
              {sorted.map((item) => {
                const code = item.name;
                const desc = PAPI_LABELS[code] || 'PAPI indicator';
                const value = Number(item.value || 0);
                const percentage = state.total > 0 ? ((value / state.total) * 100).toFixed(1) : '0.0';
                const widthPct = Math.max(3, (value / maxValue) * 100);

                return (
                  <li
                    key={code}
                    title={`${code} — ${desc}: ${value} peserta (${percentage}%)`}
                    className="flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors duration-150 hover:bg-violet-50/60"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-100 text-[10px] font-bold text-violet-600">
                      {code}
                    </span>
                    <span className="w-[118px] shrink-0 truncate text-[11px] font-medium text-slate-600">{desc}</span>
                    <div className="relative h-2 min-w-0 flex-1 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500 ease-out"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-700">{value}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ChartWrapper>
    </div>
  );
};

export default PapikostickBarChart;