export function StatisticCharts() {
    return (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Gender Pie Chart</p>
                <div className="flex items-center justify-center relative">
                    <div className="relative h-32 w-32 rounded-full border-8 border-primary-500 border-r-teal-500 border-b-amber-500" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="rounded-lg bg-neutral-800 px-2 py-1 text-xs text-white">Laki-laki 62%, Perempuan 38%</div>
                    </div>
                </div>
                <div className="mt-3 flex justify-center gap-4 text-xs">
                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary-500" /> Laki-laki 62%</span>
                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-teal-500" /> Perempuan 38%</span>
                </div>
            </div>
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Umur Bar Chart</p>
                <div className="flex items-end justify-center gap-2 h-32">
                    {[{value:45,label:'18-20',tooltip:'45 peserta'},{value:78,label:'21-24',tooltip:'78 peserta'},{value:92,label:'25-28',tooltip:'92 peserta'},{value:65,label:'29-32',tooltip:'65 peserta'},{value:35,label:'33-36',tooltip:'35 peserta'},{value:18,label:'37+',tooltip:'18 peserta'}].map((item, i) => (
                        <div key={i} className="relative w-8">
                            <div className="w-8 rounded-t bg-primary-100 group-hover:bg-primary-300 transition-colors" style={{ height: `${item.value}%` }} />
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.tooltip}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex justify-center gap-2 text-[10px] text-neutral-500">
                    <span className="w-8 text-center">18-20</span>
                    <span className="w-8 text-center">21-24</span>
                    <span className="w-8 text-center">25-28</span>
                    <span className="w-8 text-center">29-32</span>
                    <span className="w-8 text-center">33-36</span>
                    <span className="w-8 text-center">37+</span>
                </div>
            </div>
        </div>
    );
}

export function RecruitmentCharts() {
    return (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Recruitment Trend</p>
                <div className="flex items-end justify-center gap-1 h-28">
                    {[{value:30,month:'Jan',tooltip:'30 peserta'},{value:45,month:'Feb',tooltip:'45 peserta'},{value:35,month:'Mar',tooltip:'35 peserta'},{value:60,month:'Apr',tooltip:'60 peserta'},{value:55,month:'May',tooltip:'55 peserta'},{value:75,month:'Jun',tooltip:'75 peserta'},{value:68,month:'Jul',tooltip:'68 peserta'},{value:85,month:'Aug',tooltip:'85 peserta'}].map((item, i) => (
                        <div key={i} className="relative w-7">
                            <div className="w-7 rounded-t bg-teal-400 group-hover:bg-teal-500 transition-colors" style={{ height: `${item.value}%` }} />
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.tooltip}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex justify-center gap-1 text-[10px] text-neutral-500">
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'].map((m, i) => <span key={i} className="w-7 text-center">{m}</span>)}
                </div>
            </div>
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Completion Donut</p>
                <div className="flex items-center justify-center relative">
                    <div className="relative h-28 w-28 rounded-full border-8 border-emerald-500 border-r-neutral-200 border-b-neutral-200" />
                </div>
                <p className="mt-2 text-center text-xs text-neutral-500">92% Completed - 1181 dari 1284 peserta</p>
            </div>
        </div>
    );
}

export function IQCharts() {
    return (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">IQ Distribution</p>
                <div className="flex items-end justify-center gap-1 h-28">
                    {[{value:12,range:'<80',count:'154 peserta'},{value:35,range:'81-90',count:'449 peserta'},{value:78,range:'91-100',count:'1002 peserta'},{value:95,range:'101-110',count:'1220 peserta'},{value:65,range:'111-120',count:'835 peserta'},{value:42,range:'121-130',count:'539 peserta'},{value:18,range:'130+',count:'231 peserta'}].map((item, i) => (
                        <div key={i} className="relative w-7">
                            <div className="w-7 rounded-t bg-amber-400 group-hover:bg-amber-500 transition-colors" style={{ height: `${item.value}%` }} />
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.count}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex justify-center gap-1 text-[10px] text-neutral-500">
                    {['<80','81-90','91-100','101-110','111-120','121-130','130+'].map((r, i) => <span key={i} className="w-7 text-center">{r}</span>)}
                </div>
            </div>
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md">
                <p className="mb-3 text-sm font-semibold text-neutral-700">IQ Category</p>
                <div className="space-y-2">
                    {[{label:'Superior (>130)',pct:5,color:'bg-amber-500',count:'64 peserta'},{label:'Above Avg (111-129)',pct:32,color:'bg-amber-400',count:'411 peserta'},{label:'Average (90-110)',pct:55,color:'bg-amber-300',count:'706 peserta'},{label:'Below (<89)',pct:8,color:'bg-amber-200',count:'103 peserta'}].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-28 text-xs text-neutral-600">{item.label}</span>
                            <div className="flex-1 h-4 bg-neutral-100 rounded-full overflow-hidden">
                                <div className={`h-full ${item.color} transition-all duration-500`} style={{width:`${item.pct}%`}} />
                            </div>
                            <span className="w-12 text-xs text-right text-neutral-600">{item.pct}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function DISCCharts() {
    return (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md">
                <p className="mb-3 text-sm font-semibold text-neutral-700">DISC Distribution</p>
                <div className="grid grid-cols-4 gap-2">
                    {[{label:'Dominance',pct:28,color:'bg-rose-500',count:'360 peserta'},{label:'Influence',pct:25,color:'bg-amber-500',count:'321 peserta'},{label:'Steadiness',pct:30,color:'bg-emerald-500',count:'385 peserta'},{label:'Conscientious',pct:17,color:'bg-blue-500',count:'218 peserta'}].map((item, i) => (
                        <div key={i} className="rounded-lg bg-neutral-50 p-2 text-center hover:bg-neutral-100 transition-colors">
                            <p className="text-lg font-bold text-neutral-900">{item.pct}%</p>
                            <p className="text-[10px] text-neutral-500">{item.label}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md">
                <p className="mb-3 text-sm font-semibold text-neutral-700">DISC per Department</p>
                <div className="space-y-2">
                    {['IT','HR','Finance','Marketing'].map((dept, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-16 text-xs text-neutral-600">{dept}</span>
                            <div className="flex-1 flex h-3">
                                <div className="bg-rose-500" style={{width:`${25 + Math.random()*20}%`}} />
                                <div className="bg-amber-500" style={{width:`${20 + Math.random()*15}%`}} />
                                <div className="bg-emerald-500" style={{width:`${25 + Math.random()*20}%`}} />
                                <div className="bg-blue-500" style={{width:`${15 + Math.random()*15}%`}} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function TemperamentCharts() {
    return (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Temperament Types</p>
                <div className="grid grid-cols-4 gap-2">
                    {[{label:'Sanguine',pct:32,color:'bg-slate-400',count:'411 peserta'},{label:'Choleric',pct:24,color:'bg-slate-500',count:'308 peserta'},{label:'Melancholic',pct:21,color:'bg-slate-600',count:'270 peserta'},{label:'Phlegmatic',pct:23,color:'bg-slate-300',count:'295 peserta'}].map((item, i) => (
                        <div key={i} className="rounded-lg bg-neutral-50 p-2 text-center hover:bg-neutral-100 transition-colors">
                            <p className="text-lg font-bold text-neutral-900">{item.pct}%</p>
                            <p className="text-[10px] text-neutral-500">{item.label}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Trend 6 Months</p>
                <div className="flex items-end justify-center gap-1 h-24">
                    {[{value:45,month:'Mar',count:'45'},{value:52,month:'Apr',count:'52'},{value:48,month:'May',count:'48'},{value:60,month:'Jun',count:'60'},{value:55,month:'Jul',count:'55'},{value:65,month:'Aug',count:'65'}].map((item, i) => (
                        <div key={i} className="relative w-8">
                            <div className="w-8 rounded-t bg-slate-400 group-hover:bg-slate-500 transition-colors" style={{ height: `${item.value}%` }} />
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.count} peserta</div>
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
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md group">
                <p className="mb-3 text-sm font-semibold text-neutral-700">CBI Score Distribution</p>
                <div className="flex items-end justify-center gap-2 h-28">
                    {[{value:18,range:'0-20',count:'231 peserta'},{value:42,range:'21-40',count:'539 peserta'},{value:68,range:'41-60',count:'873 peserta'},{value:85,range:'61-80',count:'1091 peserta'},{value:55,range:'81-90',count:'706 peserta'},{value:22,range:'91-100',count:'282 peserta'}].map((item, i) => (
                        <div key={i} className="relative w-9">
                            <div className="w-9 rounded-t bg-emerald-400 group-hover:bg-emerald-500 transition-colors" style={{ height: `${item.value}%` }} />
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <div className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white whitespace-nowrap">{item.count}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex justify-center gap-2 text-[10px] text-neutral-500">
                    {['0-20','21-40','41-60','61-80','81-90','91-100'].map((r, i) => <span key={i} className="w-9 text-center">{r}</span>)}
                </div>
            </div>
            <div className="rounded-xl border border-neutral-100 bg-white p-4 transition-all duration-300 hover:shadow-md">
                <p className="mb-3 text-sm font-semibold text-neutral-700">Risk Category</p>
                <div className="space-y-3">
                    {[{label:'Low Risk',pct:68,color:'bg-emerald-500',count:'873 peserta'},{label:'Medium',pct:22,color:'bg-amber-500',count:'282 peserta'},{label:'High Risk',pct:10,color:'bg-rose-500',count:'129 peserta'}].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-20 text-xs text-neutral-600">{item.label}</span>
                            <div className="flex-1 h-5 bg-neutral-100 rounded-full overflow-hidden flex items-center">
                                <div className={`h-full ${item.color} flex items-center justify-end pr-2 transition-all duration-700`} style={{width:`${item.pct}%`}}>
                                    <span className="text-[10px] font-bold text-white">{item.pct}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}