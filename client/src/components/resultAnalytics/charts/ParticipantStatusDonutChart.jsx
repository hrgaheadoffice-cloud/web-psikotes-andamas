import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import html2canvas from 'html2canvas';
import { api } from '../../../utils/api';
import ChartWrapper from './ChartWrapper';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6', '#64748b'];
const FALLBACK_COLOR = '#94a3b8';

const TooltipContent = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const color = item.solid || FALLBACK_COLOR;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-slate-800">{item.name}</p>
      <p className="mt-1 text-xs text-slate-500">{item.value} peserta</p>
      <p className="text-xs text-slate-400">{Number(item.percentage || 0).toFixed(2)}%</p>
      <div className="mt-1 h-1.5 w-8 rounded-full" style={{ backgroundColor: color }} />
    </div>
  );
};

export default function ParticipantStatusDonutChart({ filters }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/analytics/overview/participant_status', { params: filters });
        if (active) setData(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        if (active) setError('Failed to fetch participant status data');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [filters]);

  const chartData = useMemo(
    () => data.map((entry, index) => ({ ...entry, solid: COLORS[index % COLORS.length] || FALLBACK_COLOR })),
    [data]
  );
  const total = useMemo(() => chartData.reduce((sum, item) => sum + Number(item.value || 0), 0), [chartData]);

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
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.download = `Status-Peserta-${new Date().toISOString().slice(0, 10)}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
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
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-white/90 text-gray-400 shadow-sm backdrop-blur-sm transition hover:border-gray-200 hover:text-gray-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </button>
      <ChartWrapper title="Status Peserta" isLoading={loading} isError={error} hasData={data.length > 0}>
        <div className="flex min-h-[380px] w-full flex-col items-center gap-4">
          <div className="relative h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={78} outerRadius={116} paddingAngle={3} cornerRadius={9} stroke="#ffffff" strokeWidth={4}>
                  {chartData.map((entry, index) => <Cell key={entry.name || index} fill={entry.solid} />)}
                </Pie>
                <Tooltip content={<TooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Total</span>
              <span className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{total}</span>
              <span className="text-xs text-slate-500">Peserta</span>
            </div>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            {chartData.map((item) => (
              <div key={item.name} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.solid }} />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-slate-700" title={item.name}>{item.name}</p>
                  <p className="text-[10px] text-slate-400">{item.value} Peserta · {Number(item.percentage || 0).toFixed(2)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ChartWrapper>
    </div>
  );
}
