import SectionTitle from './SectionTitle';
import { StatisticCharts } from './StatisticCharts';
import RecruitmentAnalytics from './RecruitmentAnalytics';

export function RecruitmentCharts({ filters }) {
    return <RecruitmentAnalytics filters={filters} />;
}

export function IQCharts() {
    return (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50/40 p-5 transition-all duration-200 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">IQ Distribution</p>
                <div className="flex items-end justify-center gap-1 h-28">
                    {[{value:12,label:'<80',tooltip:'12 peserta'},{value:35,label:'81-90',tooltip:'35 peserta'},{value:78,label:'91-100',tooltip:'78 peserta'},{value:95,label:'101-110',tooltip:'95 peserta'},{value:65,label:'111-120',tooltip:'65 peserta'},{value:42,label:'121-130',tooltip:'42 peserta'},{value:18,label:'130+',tooltip:'18 peserta'}].map((item, i) => (
                        <div key={i} className="relative w-7">
                            <div className="w-7 rounded-t bg-amber-400 group-hover:bg-amber-500 transition-colors" style={{ height: `${item.value}%` }} />
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.tooltip}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex justify-center gap-1 text-[10px] text-neutral-500">
                    {['<80','81-90','91-100','101-110','111-120','121-130','130+'].map((r, i) => <span key={i} className="w-7 text-center">{r}</span>)}
                </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50/40 p-5 transition-all duration-200 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">IQ Category</p>
                <div className="space-y-2">
                    {[{label:'Superior (>130)',pct:5,color:'bg-amber-500',tooltip:'5%'},{label:'Above Avg (111-129)',pct:32,color:'bg-amber-400',tooltip:'32%'},{label:'Average (90-110)',pct:55,color:'bg-amber-300',tooltip:'55%'},{label:'Below (<89)',pct:8,color:'bg-amber-200',tooltip:'8%'}].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 group relative">
                            <span className="w-20 text-xs text-neutral-600">{item.label}</span>
                            <div className="flex-1 h-4 bg-neutral-100 rounded-full overflow-hidden">
                                <div className={`h-full ${item.color}`} style={{width:`${item.pct}%`}} />
                            </div>
                            <span className="w-8 text-xs text-right text-neutral-600">{item.pct}%</span>
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.tooltip}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function DISCCharts() {
    return (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50/40 p-5 transition-all duration-200 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">DISC Distribution</p>
                <div className="grid grid-cols-2 gap-2">
                    {[{label:'Dominance',pct:28,color:'bg-rose-500',tooltip:'28%'},{label:'Influence',pct:25,color:'bg-amber-500',tooltip:'25%'},{label:'Steadiness',pct:30,color:'bg-emerald-500',tooltip:'30%'},{label:'Conscientious',pct:17,color:'bg-blue-500',tooltip:'17%'}].map((item, i) => (
                        <div key={i} className="rounded-lg bg-neutral-50 p-2 text-center group relative">
                            <p className="text-lg font-bold text-neutral-900">{item.pct}%</p>
                            <p className="text-[10px] text-neutral-500">{item.label}</p>
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.tooltip}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50/40 p-5 transition-all duration-200 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">DISC per Department</p>
                <div className="space-y-2">
                    {['IT','HR','Finance','Marketing'].map((dept, i) => {
                        const data = [{d:34,i:26,s:24,c:16},{d:29,i:31,s:25,c:15},{d:37,i:22,s:28,c:13},{d:24,i:28,s:33,c:15}][i];
                        const total = data.d + data.i + data.s + data.c;
                        return (
                            <div key={i} className="flex items-center gap-2 group relative">
                                <span className="w-16 text-xs text-neutral-600">{dept}</span>
                                <div className="flex-1 flex h-3">
                                    <div className="bg-rose-500" style={{width:`${(data.d/total)*100}%`}} />
                                    <div className="bg-amber-500" style={{width:`${(data.i/total)*100}%`}} />
                                    <div className="bg-emerald-500" style={{width:`${(data.s/total)*100}%`}} />
                                    <div className="bg-blue-500" style={{width:`${(data.c/total)*100}%`}} />
                                </div>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{`D:${Math.round(data.d)}% I:${Math.round(data.i)}% S:${Math.round(data.s)}% C:${Math.round(data.c)}%`}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function TemperamentCharts() {
    return (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50/40 p-5 transition-all duration-200 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Temperament Types</p>
                <div className="grid grid-cols-4 gap-2">
                    {[{label:'Sanguine',pct:32,color:'bg-slate-400',tooltip:'32%'},{label:'Choleric',pct:24,color:'bg-slate-500',tooltip:'24%'},{label:'Melancholic',pct:21,color:'bg-slate-600',tooltip:'21%'},{label:'Phlegmatic',pct:23,color:'bg-slate-300',tooltip:'23%'}].map((item, i) => (
                        <div key={i} className="rounded-lg bg-neutral-50 p-2 text-center group relative">
                            <p className="text-lg font-bold text-neutral-900">{item.pct}%</p>
                            <p className="text-[10px] text-neutral-500">{item.label}</p>
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.tooltip}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50/40 p-5 transition-all duration-200 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Trend 6 Months</p>
                <div className="flex items-end justify-center gap-1 h-24">
                    {[{value:45,label:'Mar',tooltip:'45 peserta'},{value:52,label:'Apr',tooltip:'52 peserta'},{value:48,label:'May',tooltip:'48 peserta'},{value:60,label:'Jun',tooltip:'60 peserta'},{value:55,label:'Jul',tooltip:'55 peserta'},{value:65,label:'Aug',tooltip:'65 peserta'}].map((item, i) => (
                        <div key={i} className="relative w-8">
                            <div className="w-8 rounded-t bg-slate-400 group-hover:bg-slate-500 transition-colors" style={{ height: `${item.value}%` }} />
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.tooltip}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex justify-center gap-1 text-[10px] text-neutral-500">
                    {['Mar','Apr','May','Jun','Jul','Aug'].map((m, i) => <span key={i} className="w-8 text-center">{m}</span>)}
                </div>
            </div>
        </div>
    );
}

export function CBICharts() {
    return (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50/40 p-5 transition-all duration-200 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">CBI Score Distribution</p>
                <div className="flex items-end justify-center gap-2 h-28">
                    {[{value:18,label:'0-20',tooltip:'18 peserta'},{value:42,label:'21-40',tooltip:'42 peserta'},{value:68,label:'41-60',tooltip:'68 peserta'},{value:85,label:'61-80',tooltip:'85 peserta'},{value:55,label:'81-90',tooltip:'55 peserta'},{value:22,label:'91-100',tooltip:'22 peserta'}].map((item, i) => (
                        <div key={i} className="relative w-9">
                            <div className="w-9 rounded-t bg-emerald-400 group-hover:bg-emerald-500 transition-colors" style={{ height: `${item.value}%` }} />
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.tooltip}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex justify-center gap-2 text-[10px] text-neutral-500">
                    {['0-20','21-40','41-60','61-80','81-90','91-100'].map((r, i) => <span key={i} className="w-9 text-center">{r}</span>)}
                </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50/40 p-5 transition-all duration-200 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Risk Category</p>
                <div className="space-y-3">
                    {[{label:'Low Risk',pct:68,color:'bg-emerald-500',tooltip:'68%'},{label:'Medium',pct:22,color:'bg-amber-500',tooltip:'22%'},{label:'High Risk',pct:10,color:'bg-rose-500',tooltip:'10%'}].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 group relative">
                            <span className="w-20 text-xs text-neutral-600">{item.label}</span>
                            <div className="flex-1 h-5 bg-neutral-100 rounded-full overflow-hidden flex items-center">
                                <div className={`h-full ${item.color} flex items-center justify-end pr-2`} style={{width:`${item.pct}%`}}>
                                    <span className="text-[10px] font-bold text-white">{item.pct}%</span>
                                </div>
                            </div>
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.tooltip}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AnalyticsCard({ title, icon, tone, chartType, filters }) {
    const renderChart = () => {
        switch(chartType) {
            case 'statistics': return <StatisticCharts filters={filters} />;
            case 'recruitment': return <RecruitmentCharts filters={filters} />;
            case 'iq': return <IQCharts />;
            case 'disc': return <DISCCharts />;
            case 'temperament': return <TemperamentCharts />;
            case 'cbi': return <CBICharts />;
            default: return <StatisticCharts />;
        }
    };

    return (
        <article className="w-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_4px_18px_rgb(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(15,23,42,0.08)] sm:p-6">
            <SectionTitle title={title} icon={icon} tone={tone} />
            {renderChart()}
        </article>
    );
}


