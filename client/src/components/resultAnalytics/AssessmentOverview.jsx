import { useEffect, useState } from 'react';
import { api } from '../../utils/api';

export default function AssessmentOverview({ filters }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/analytics/assessment-overview', { params: filters })
      .then(({ data }) => active && setRows(data))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters]);

  return (
    <article data-export-exclude="true" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_4px_18px_rgb(15,23,42,0.05)] sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">Assessment Overview</p>
        <h2 className="mt-1 text-xl font-bold text-neutral-900">Ringkasan pelaksanaan psikotes berdasarkan jenis tes</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[430px] text-left text-sm">
          <thead className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-400">
            <tr><th className="pb-3 font-semibold">Test</th><th className="pb-3 text-right font-semibold">Peserta</th><th className="pb-3 text-right font-semibold">Selesai</th><th className="pb-3 text-right font-semibold">Completion</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? [...Array(8)].map((_, index) => <tr key={index}><td colSpan="4" className="py-3"><div className="h-4 animate-pulse rounded bg-neutral-100" /></td></tr>) : rows.map((row) => <tr key={row.code}><td className="py-3 font-semibold text-neutral-700">{row.name}</td><td className="py-3 text-right text-neutral-600">{row.participants}</td><td className="py-3 text-right text-neutral-600">{row.completed}</td><td className="py-3 text-right font-bold text-primary-600">{row.completion.toFixed(1)}%</td></tr>)}
          </tbody>
        </table>
      </div>
    </article>
  );
}
