import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import html2canvas from 'html2canvas';
import ChartWrapper from './ChartWrapper';
import { api } from '../../../utils/api';

const DISC_MAP = {
  D: 'Dominance',
  I: 'Influence',
  S: 'Steadiness',
  C: 'Compliance',
};

// Warna dikunci per nama kategori (bukan index) supaya konsisten
// chart -> legend -> badge -> tooltip walau urutan data dari API berubah.
const COLOR_MAP = {
  Compliance: '#16a34a', // green
  Dominance: '#6366f1', // indigo
  Influence: '#2563eb', // blue
  Steadiness: '#14b8a6', // teal
};
const FALLBACK_COLOR = '#94a3b8';

// Versi gelap dari tiap warna, dipakai buat gradient (bawah/kanan sedikit lebih gelap = efek depth)
const DARK_COLOR_MAP = {
  Compliance: '#15803d',
  Dominance: '#4338ca',
  Influence: '#1d4ed8',
  Steadiness: '#0f766e',
};

const gradientId = (name) => `disc-grad-${name.replace(/\s+/g, '-')}`;

const CustomTooltip = ({ active, payload, total }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const color = COLOR_MAP[item.name] || item.fill || FALLBACK_COLOR;
  const count = Number(item.value || 0);
  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="rounded-xl border border-gray-100 bg-white/95 px-4 py-3 shadow-lg shadow-gray-200/60 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-sm font-semibold text-gray-800">{item.name}</p>
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

// Segment "pop out" halus + soft shadow saat di-hover
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g style={{ filter: 'drop-shadow(0px 8px 12px rgba(15, 23, 42, 0.22))' }}>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={10}
      />
    </g>
  );
};

const DiscDonutChart = ({ filters }) => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef(null);

  // Capture the whole card (title + donut + legend list) into one JPG and
  // trigger a browser download. Same self-contained pattern as
  // GenderPieChart.jsx / TemperamentDonutChart.jsx.
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
      link.download = `DISC-${today}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download DISC chart image', err);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await api.get('/analytics/personality/disc', { params: filters });
        const normalizedData = (response.data.distribution || []).map((entry) => ({
          ...entry,
          name: DISC_MAP[entry.name] || entry.name,
        }));
        setData(normalizedData);
        setTotal(response.data.total || 0);
      } catch (error) {
        setError(true);
        console.error('Error fetching DISC data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  const chartData = useMemo(
    () =>
      data.map((entry) => ({
        ...entry,
        fill: `url(#${gradientId(entry.name)})`,
        solid: COLOR_MAP[entry.name] || FALLBACK_COLOR,
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

      <ChartWrapper title="DISC" isLoading={loading} isError={error}>
        {/* Wrapper tunggal: memaksa chart selalu di atas & legend di bawah,
            walau parent card menerapkan flex-row pada children-nya */}
        <div className="flex w-full flex-col items-center">
          <div className="relative h-[220px] w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {Object.keys(COLOR_MAP).map((name) => (
                    <linearGradient key={name} id={gradientId(name)} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={COLOR_MAP[name]} />
                      <stop offset="100%" stopColor={DARK_COLOR_MAP[name] || COLOR_MAP[name]} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={98}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                  cornerRadius={8}
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums leading-none text-gray-900">{total}</span>
              <span className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Total Peserta
              </span>
            </div>
          </div>

          <ul className="mt-6 w-full space-y-1.5">
            {chartData.map((entry, index) => {
              const color = entry.solid;
              const count = Number(entry.value || 0);
              const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
              const isActive = activeIndex === index;

              return (
                <li
                  key={entry.name}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 ${
                    isActive ? 'bg-gray-50' : 'bg-transparent'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-4"
                      style={{ backgroundColor: color, ringColor: `${color}1A` }}
                    />
                    <span className="whitespace-nowrap text-sm font-medium text-gray-700">
                      {entry.name}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="whitespace-nowrap text-sm tabular-nums text-gray-500">
                      {count} peserta
                    </span>
                    <span
                      className="min-w-[56px] rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums"
                      style={{ backgroundColor: `${color}14`, color }}
                    >
                      {percentage}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </ChartWrapper>
    </div>
  );
};

export default DiscDonutChart;