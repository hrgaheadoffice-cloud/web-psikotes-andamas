import { useEffect, useRef, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { api } from '../../../utils/api';
import ChartWrapper from './ChartWrapper';

const CBI_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

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

const CbiRiskDistribution = ({ filters }) => {
  const state = useRecruitmentData('/analytics/recruitment/cbi', filters);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef(null);

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
      link.download = `CBI-Risk-Distribution-${today}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download CBI Risk Distribution chart image', err);
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

      <ChartWrapper title="CBI Risk Distribution" isLoading={state.loading} isError={state.error}>
        <div className="flex min-h-[330px] w-full flex-col">
          <p className="mb-3 text-xs text-slate-500">Participant distribution by risk level</p>
          <div className="space-y-3 overflow-y-auto pr-1">
            {state.data.length === 0 ? (
              <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-400">No Data Available</div>
            ) : (
              state.data.map((dimension) => {
                const total = dimension.levels.reduce((sum, level) => sum + level.value, 0);
                return (
                  <div key={dimension.name}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-semibold text-slate-700">{dimension.name}</span>
                      <span className="text-[10px] text-slate-400">{total} peserta</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                      {dimension.levels.map((level, index) => (
                        <div
                          key={level.name}
                          className="transition-all duration-700"
                          style={{ width: (total ? (level.value / total * 100) : 0) + '%', backgroundColor: CBI_COLORS[index % CBI_COLORS.length] }}
                          title={level.name + ': ' + level.value}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-[9px] text-slate-500">
                      {dimension.levels.map((level, index) => (
                        <span key={level.name}>
                          <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CBI_COLORS[index % CBI_COLORS.length] }} />
                          {level.name}: {level.value}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </ChartWrapper>
    </div>
  );
};

export default CbiRiskDistribution;