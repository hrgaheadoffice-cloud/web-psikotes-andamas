import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Rectangle,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import html2canvas from 'html2canvas';
import { api } from '../../../utils/api';
import ChartWrapper from './ChartWrapper';

// Palet sequential nuansa indigo/violet (terang -> gelap), cocok buat data usia
// yang berjenjang. Cycle otomatis kalau kelompok usianya lebih banyak dari palet.
const BASE_COLORS = ['#818cf8', '#6366f1', '#8b5cf6', '#a78bfa', '#6d28d9', '#4f46e5'];
const DARK_COLORS = ['#4f46e5', '#4338ca', '#6d28d9', '#7c3aed', '#5b21b6', '#3730a3'];

const gradientId = (index) => `age-bar-grad-${index}`;

// Kategori "Tidak Mengisi" ditandai `*` di tampilan saja (label chart/tooltip/footnote).
// Nilai/`name` asli dari data tidak pernah diubah — cuma dipakai untuk menampilkan teksnya.
const MISSING_LABEL = 'Tidak Mengisi';
const displayCategoryLabel = (name) => (name === MISSING_LABEL ? `${name}*` : name);

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
                <p className="text-sm font-semibold text-gray-800">{displayCategoryLabel(label)}</p>
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
        <g style={{ filter: 'drop-shadow(0px 10px 14px rgba(79, 70, 229, 0.35))' }}>
            <Rectangle {...props} fill={fill} />
        </g>
    );
};

const AgeBarChart = ({ filters }) => {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const cardRef = useRef(null);

    // Capture the whole card (title + chart) into one JPG and trigger a browser
    // download. Same self-contained pattern as GenderPieChart.jsx.
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
            link.download = `Age-Distribution-${today}.jpg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Failed to download Age Distribution chart image', error);
        } finally {
            setIsDownloading(false);
        }
    }, [isDownloading]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(null);
            try {
                const response = await api.get('/analytics/overview/age', { params: filters });
                setData(response.data);
            } catch {
                setIsError('Failed to fetch age data');
            } finally {
                setIsLoading(false);
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
                fill: `url(#${gradientId(index % BASE_COLORS.length)})`,
                solid: BASE_COLORS[index % BASE_COLORS.length],
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

            <ChartWrapper title="Distribusi Usia" isLoading={isLoading} isError={isError} hasData={data.length > 0}>
                <div className="flex w-full flex-col">
                    <div className="h-[286px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 24, right: 12, left: -18, bottom: 4 }}>
                                <defs>
                                    {BASE_COLORS.map((color, index) => (
                                        <linearGradient key={color} id={gradientId(index)} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={color} />
                                            <stop offset="100%" stopColor={DARK_COLORS[index] || color} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid stroke="#eef1f6" strokeDasharray="4 4" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#64748b', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0}
                                    tickFormatter={displayCategoryLabel}
                                />
                                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip total={total} />} cursor={{ fill: '#f8fafc' }} />
                                <Bar
                                    dataKey="value"
                                    radius={[10, 10, 4, 4]}
                                    name="Peserta"
                                    isAnimationActive
                                    animationDuration={800}
                                    animationEasing="ease-out"
                                    activeBar={<ActiveBar />}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                                    ))}
                                    <LabelList dataKey="value" position="top" fill="#475569" fontSize={11} fontWeight={700} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {chartData.some((entry) => entry.name === MISSING_LABEL) && (
                        <p className="mt-1.5 text-center text-[10px] text-slate-400">
                            * Menunjukkan data yang tidak diisi oleh peserta.
                        </p>
                    )}
                </div>
            </ChartWrapper>
        </div>
    );
};

export default AgeBarChart;