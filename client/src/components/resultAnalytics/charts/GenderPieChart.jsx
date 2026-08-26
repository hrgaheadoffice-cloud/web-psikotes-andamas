import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import html2canvas from 'html2canvas';
import { api } from '../../../utils/api';
import ChartWrapper from './ChartWrapper';

// Gradient (terang -> agak lebih terang lagi, dua-tone) tetap dipakai buat isi slice,
// warna solid dipakai buat swatch legend & tooltip supaya konsisten.
const GRADIENT_IDS = ['genderGradientPrimary', 'genderGradientSecondary', 'genderGradientTertiary', 'genderGradientQuaternary'];
const SOLID_COLORS = ['#6366f1', '#ec4899', '#06b6d4', '#f59e0b'];
const FALLBACK_COLOR = '#94a3b8';

// Kategori "Tidak Mengisi" ditandai `*` di tampilan saja (tooltip/legend/footnote).
// Nilai/`name` asli dari data tidak pernah diubah — cuma dipakai untuk menampilkan teksnya.
const MISSING_LABEL = 'Tidak Mengisi';
const displayCategoryLabel = (name) => (name === MISSING_LABEL ? `${name}*` : name);

const GenderTooltip = ({ active, payload, total }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const color = item.solid || FALLBACK_COLOR;
    const count = Number(item.value || 0);
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

    return (
        <div className="rounded-xl border border-gray-100 bg-white/95 px-4 py-3 shadow-lg shadow-gray-200/60 backdrop-blur-sm">
            <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <p className="text-sm font-semibold text-gray-800">{displayCategoryLabel(item.name)}</p>
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

const GenderPieChart = ({ filters }) => {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(null);
    const [activeIndex, setActiveIndex] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const cardRef = useRef(null);

    // Capture the whole card (title + donut + legend list) into one JPG and
    // trigger a browser download. Self-contained on purpose — no separate
    // component file, so this chart file is the only thing that needs to
    // change. `data-export-exclude="true"` on the button itself makes
    // html2canvas skip it both here (own capture) and in the big multi-page
    // PDF export in ResultAnalyticsPage.jsx, which already ignores any
    // element carrying that same attribute.
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
            link.download = `Gender-Distribution-${today}.jpg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Failed to download Gender Distribution chart image', error);
        } finally {
            setIsDownloading(false);
        }
    }, [isDownloading]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(null);
            try {
                const response = await api.get('/analytics/overview/gender', { params: filters });
                setData(response.data);
            } catch {
                setIsError('Failed to fetch gender data');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [filters]);

    // Dihitung dari data yang sudah ada (bukan data baru/dummy), dipakai untuk label
    // di tengah donut. Persentase per kategori tetap pakai field `percentage` dari API.
    const total = useMemo(() => data.reduce((sum, entry) => sum + Number(entry.value || 0), 0), [data]);

    const chartData = useMemo(
        () =>
            data.map((entry, index) => ({
                ...entry,
                fill: `url(#${GRADIENT_IDS[index % GRADIENT_IDS.length]})`,
                solid: SOLID_COLORS[index % SOLID_COLORS.length] || FALLBACK_COLOR,
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

            <ChartWrapper title="Gender Distribution" isLoading={isLoading} isError={isError} hasData={data.length > 0}>
            {/* Wrapper tunggal: memaksa chart selalu di atas & legend di bawah,
                walau parent card menerapkan flex-row pada children-nya */}
            <div className="flex w-full flex-col items-center">
                <div className="relative h-[220px] w-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <defs>
                                <linearGradient id="genderGradientPrimary" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#4338ca" />
                                </linearGradient>
                                <linearGradient id="genderGradientSecondary" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#ec4899" />
                                    <stop offset="100%" stopColor="#be185d" />
                                </linearGradient>
                                <linearGradient id="genderGradientTertiary" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#06b6d4" />
                                    <stop offset="100%" stopColor="#0e7490" />
                                </linearGradient>
                                <linearGradient id="genderGradientQuaternary" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#f59e0b" />
                                    <stop offset="100%" stopColor="#b45309" />
                                </linearGradient>
                            </defs>
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={68}
                                outerRadius={98}
                                paddingAngle={3}
                                cornerRadius={8}
                                stroke="#ffffff"
                                strokeWidth={2}
                                isAnimationActive
                                animationDuration={700}
                                animationEasing="ease-out"
                                activeIndex={activeIndex}
                                activeShape={renderActiveShape}
                                onMouseEnter={(_, index) => setActiveIndex(index)}
                                onMouseLeave={() => setActiveIndex(null)}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={entry.name || index} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip content={<GenderTooltip total={total} />} />
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
                        const percentage = entry.percentage ?? (total > 0 ? ((count / total) * 100).toFixed(1) : '0.0');
                        const isActive = activeIndex === index;

                        return (
                            <li
                                key={entry.name || index}
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
                                        {displayCategoryLabel(entry.name)}
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

                {chartData.some((entry) => entry.name === MISSING_LABEL) && (
                    <p className="mt-2 w-full text-center text-[10px] text-slate-400">
                        * Menunjukkan data yang tidak diisi oleh peserta.
                    </p>
                )}
            </div>
            </ChartWrapper>
        </div>
    );
};

export default GenderPieChart;