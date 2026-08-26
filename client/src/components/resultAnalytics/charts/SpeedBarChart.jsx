import { useEffect, useRef, useState, useCallback } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import html2canvas from 'html2canvas';
import { api } from '../../../utils/api';
import ChartWrapper from './ChartWrapper';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-xl"><p className="text-xs font-semibold text-slate-800">{label}</p><p className="mt-1 text-xs text-slate-500">{payload[0].value} peserta</p></div>;
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

const SpeedBarChart = ({ filters }) => {
  const state = useRecruitmentData('/analytics/recruitment/speed', filters);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef(null);

  // Capture the whole card (title + chart + legend) into one JPG and trigger a
  // browser download. Same self-contained pattern as IQCfitBarChart.jsx.
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
      link.download = `Speed-Test-${today}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download Speed Test chart image', err);
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

      <ChartWrapper title="Speed Test" isLoading={state.loading} isError={state.error}>
        <div className="flex h-full min-h-[330px] w-full flex-col">
          <div className="min-h-0 flex-1 w-full">
            {state.data.length === 0 ? <div className="flex h-full min-h-[250px] items-center justify-center text-sm text-slate-400">No Data Available</div> : <ResponsiveContainer width="100%" height="100%">
              <BarChart data={state.data} margin={{ top: 22, right: 16, left: -18, bottom: 4 }}>
                <defs><linearGradient id="speedRecruitmentGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" /><stop offset="100%" stopColor="#0ea5e9" /></linearGradient></defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="url(#speedRecruitmentGradient)" radius={[9, 9, 0, 0]} isAnimationActive animationDuration={900}><LabelList dataKey="value" position="top" fill="#475569" fontSize={10} fontWeight={700} /></Bar>
              </BarChart>
            </ResponsiveContainer>}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <p className="text-center text-xs font-semibold text-slate-700">Average Score: {state.average === null ? '-' : state.average.toFixed(2)}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-500">
              {state.data.map((item) => <span key={item.name} className="flex items-center justify-between gap-2"><span className="truncate">{item.name}</span><strong className="text-slate-700">{item.value}</strong></span>)}
            </div>
          </div>
        </div>
      </ChartWrapper>
    </div>
  );
};

export default SpeedBarChart;