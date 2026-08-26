import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import html2canvas from 'html2canvas';
import { api } from '../../../utils/api';
import ChartWrapper from './ChartWrapper';

const PIE_COLORS = [
    '#0ea5e9', // sky
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ec4899', // pink
    '#8b5cf6', // violet
    '#ef4444', // red
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
    '#84cc16', // lime
    '#d946ef', // fuchsia
    '#06b6d4', // cyan
    '#a16207', // amber-dark/brown
    '#64748b', // slate
];
const FALLBACK_COLOR = '#94a3b8';

const BusinessUnitTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const percentage = Number(item?.percentage || 0).toFixed(2);
    return (
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-xl">
            <p className="text-xs font-semibold text-slate-800">{item.name}</p>
            <p className="mt-1 text-xs text-slate-500">{item.value} peserta</p>
            <p className="text-xs text-slate-400">{percentage}%</p>
        </div>
    );
};

const BusinessUnitDonutChart = ({ filters }) => {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const cardRef = useRef(null);

    // Capture the whole card (title + donut + legend list) into one JPG and
    // trigger a browser download. Same self-contained pattern as
    // GenderPieChart.jsx / AgeBarChart.jsx / EducationBarChart.jsx.
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
            link.download = `Business-Unit-Distribution-${today}.jpg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Failed to download Business Unit Distribution chart image', error);
        } finally {
            setIsDownloading(false);
        }
    }, [isDownloading]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(null);
            try {
                const response = await api.get('/analytics/overview/business_unit', { params: filters });
                setData(response.data);
            } catch {
                setIsError('Failed to fetch business unit data');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [filters]);

    // Warna dikunci per NAMA business unit (bukan posisi index), diambil dari urutan
    // `data` yang asli (sebelum difilter). Ini yang membuat warna di chart & legend
    // selalu sama persis, walau ada item dengan value 0 yang di-skip dari pie.
    const colorMap = useMemo(() => {
        const map = {};
        data.forEach((item, index) => {
            map[item.name] = PIE_COLORS[index % PIE_COLORS.length];
        });
        return map;
    }, [data]);

    const total = data.reduce((sum, item) => sum + Number(item?.value || 0), 0);
    const chartData = data.filter((item) => Number(item?.value || 0) > 0);

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

            <ChartWrapper title="Business Unit Distribution" isLoading={isLoading} isError={isError} hasData={data.length > 0}>
                <div className="flex min-h-[380px] w-full flex-col items-center gap-4">
                    <div className="relative h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <defs>
                                    <filter id="businessRingShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#64748b" floodOpacity="0.2" /></filter>
                                </defs>
                                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={78} outerRadius={116} paddingAngle={3} cornerRadius={9} stroke="#ffffff" strokeWidth={4} isAnimationActive animationDuration={900} filter="url(#businessRingShadow)">
                                    {chartData.map((entry, index) => <Cell key={entry.name || index} fill={colorMap[entry.name] || FALLBACK_COLOR} />)}
                                </Pie>
                                <Tooltip content={<BusinessUnitTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Total</span>
                            <span className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{total}</span>
                            <span className="text-xs text-slate-500">Peserta</span>
                        </div>
                    </div>
                    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                        {data.map((item, index) => {
                            const percentage = total > 0 ? ((Number(item?.value || 0) / total) * 100).toFixed(2) : '0.00';
                            return (
                                <div key={item.name || index} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorMap[item.name] || FALLBACK_COLOR }} />
                                    <div className="min-w-0">
                                        <p className="truncate text-[11px] font-semibold text-slate-700" title={item.name}>{item.name}</p>
                                        <p className="text-[10px] text-slate-400">{item.value} Peserta · {percentage}%</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </ChartWrapper>
        </div>
    );
};

export default BusinessUnitDonutChart;