import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, Rectangle } from 'recharts';
import html2canvas from 'html2canvas';
import ChartWrapper from './ChartWrapper';
import { api } from '../../../utils/api';

const COLORS = ['#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87', '#4c1d95', '#3b0764'];

const IQ_LEGEND = [
  ['<70', 'Very Low'],
  ['70–79', 'Borderline'],
  ['80–89', 'Low Avg'],
  ['90–99', 'Average'],
  ['100–109', 'High Avg'],
  ['110–119', 'Superior'],
  ['120+', 'Genius'],
];

// Bikin versi lebih gelap dari warna hex, dipakai buat gradient bar (atas terang -> bawah gelap)
const shadeColor = (hex, percent) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
};

const gradientId = (index) => `wpt-bar-grad-${index}`;

const CustomTooltip = ({ active, payload, label, total }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const color = item.solid;
  const count = Number(payload[0].value || 0);
  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="rounded-xl border border-gray-100 bg-white/95 px-4 py-3 shadow-lg shadow-gray-200/60 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-sm font-semibold text-gray-800">{label}</p>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 pl-4.5">
        <span className="text-lg font-bold tabular-nums text-gray-900">{count}</span>
        <span className="text-xs text-gray-500">peserta</span>
        <span
          className="ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          {percentage}%
        </span>
      </div>
    </div>
  );
};

// Bar yang lagi di-hover "pop" dengan glow shadow, dikelola otomatis oleh
// recharts lewat prop activeBar (nyambung sama trigger Tooltip).
const ActiveBar = (props) => {
  const { fill } = props;
  return (
    <g style={{ filter: 'drop-shadow(0px 10px 14px rgba(126, 34, 206, 0.35))' }}>
      <Rectangle {...props} fill={fill} />
    </g>
  );
};

const IQWptBarChart = ({ filters }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef(null);

  // Capture the whole card (title + chart + legend) into one JPG and trigger a
  // browser download. Same self-contained pattern as GenderPieChart.jsx / AgeBarChart.jsx.
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
      link.download = `IQ-WPT-${today}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download IQ WPT chart image', err);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await api.get('/analytics/personality/iq-wpt', { params: filters });
        setData(response.data.distribution);
      } catch (error) {
        setError(true);
        console.error('Error fetching IQ WPT data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  // Dihitung dari data yang sudah ada (bukan data baru/dummy), dipakai untuk
  // badge persentase di tooltip.
  const total = useMemo(() => data.reduce((sum, entry) => sum + Number(entry.value || 0), 0), [data]);

  const chartData = useMemo(
    () =>
      data.map((entry, index) => ({
        ...entry,
        fill: `url(#${gradientId(index % COLORS.length)})`,
        solid: COLORS[index % COLORS.length],
      })),
    [data]
  );

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

      <ChartWrapper title="IQ WPT (Pattern)" isLoading={loading} isError={error}>
        <div className="flex h-full w-full flex-col">
          <div className="min-h-0 w-full flex-1">
            <ResponsiveContainer width="100%" height={255}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  {COLORS.map((color, index) => (
                    <linearGradient key={color} id={gradientId(index)} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} />
                      <stop offset="100%" stopColor={shadeColor(color, -20)} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="#eef1f6" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip total={total} />} cursor={{ fill: '#faf5ff' }} />
                <Bar
                  dataKey="value"
                  radius={[10, 10, 4, 4]}
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                  activeBar={<ActiveBar />}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="value" position="top" fill="#581c87" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-1.5 grid shrink-0 grid-cols-2 gap-x-3 gap-y-0.5 border-t border-slate-100 pt-1.5">
            {IQ_LEGEND.map(([range, category], index) => {
              const color = COLORS[index % COLORS.length];
              return (
                <div
                  key={range}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-1.5 py-0.5 text-[11px] leading-none"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="truncate font-semibold text-slate-600">{range}</span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                    style={{ backgroundColor: `${color}14`, color }}
                  >
                    {category}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </ChartWrapper>
    </div>
  );
};

export default IQWptBarChart;