import { useEffect, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../utils/api';

function GrowthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-xl"><p className="text-xs font-semibold text-slate-800">{label}</p><p className="mt-1 text-xs text-slate-500">Peserta: {payload[0].value}</p></div>;
}

export default function ParticipantGrowthChart({ filters }) {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState('');
  const [data, setData] = useState([]);

  useEffect(() => {
    api.get('/analytics/participant-growth-years', { params: filters }).then(({ data: available }) => {
      setYears(available);
      if (available.length) setYear(String(available[0]));
    });
  }, [filters]);

  useEffect(() => {
    if (!year) return;
    api.get('/analytics/participant-growth', { params: { year, ...filters } }).then(({ data: response }) => setData(response));
  }, [year, filters]);

  return <article data-export-exclude="true" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_4px_18px_rgb(15,23,42,0.05)] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">Perkembangan Peserta</p><h2 className="mt-1 text-xl font-bold text-neutral-900">Jumlah peserta terdaftar per bulan</h2></div><label className="shrink-0 text-xs font-semibold text-neutral-500">Tahun<select value={year} onChange={(event) => setYear(event.target.value)} className="ml-2 h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-700">{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div><div className="mt-6 h-[330px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 4 }}><CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<GrowthTooltip />} /><Bar dataKey="value" name="Peserta" fill="#14b8a6" radius={[8, 8, 0, 0]}><LabelList dataKey="value" position="top" fill="#475569" fontSize={10} fontWeight={700} /></Bar><Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3, fill: '#8b5cf6' }} /></ComposedChart></ResponsiveContainer></div></article>;
}
