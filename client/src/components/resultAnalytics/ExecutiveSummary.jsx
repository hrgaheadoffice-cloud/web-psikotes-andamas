import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { api } from '../../utils/api';

// Tiap tone dikasih warna solid berbeda supaya 7 KPI card gampang dibedain sekilas.
// (sebelumnya "Penyelesaian Psikotes" & "Rata-rata Memory Test" sama-sama hijau)
const TONE_STYLES = {
  primary: { from: '#6366f1', to: '#4f46e5', accent: '#6366f1', badgeBg: '#eef2ff', badgeText: '#4338ca' },
  success: { from: '#10b981', to: '#059669', accent: '#10b981', badgeBg: '#ecfdf5', badgeText: '#047857' },
  teal: { from: '#14b8a6', to: '#0d9488', accent: '#14b8a6', badgeBg: '#f0fdfa', badgeText: '#0f766e' },
  violet: { from: '#a855f7', to: '#7e22ce', accent: '#a855f7', badgeBg: '#faf5ff', badgeText: '#7e22ce' },
  gold: { from: '#f59e0b', to: '#d97706', accent: '#f59e0b', badgeBg: '#fffbeb', badgeText: '#b45309' },
  cyan: { from: '#06b6d4', to: '#0891b2', accent: '#06b6d4', badgeBg: '#ecfeff', badgeText: '#0e7490' },
  rose: { from: '#f43f5e', to: '#e11d48', accent: '#f43f5e', badgeBg: '#fff1f2', badgeText: '#be123c' },
};

function KpiSkeleton() {
  return (
    <div className="flex min-h-[176px] flex-col rounded-2xl border border-neutral-100 bg-white p-5 shadow-[0_2px_10px_rgb(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-neutral-200" />
        <span className="text-[10px] font-medium text-neutral-400">Loading...</span>
      </div>
      <div className="mt-4 h-4 w-24 animate-pulse rounded bg-neutral-200" />
      <div className="mt-2 h-8 w-16 animate-pulse rounded bg-neutral-200" />
      <div className="mt-auto h-3 w-32 animate-pulse rounded bg-neutral-200" />
    </div>
  );
}

function KpiCard({ label, value, meta, footer, icon, tone, description }) {
  const style = TONE_STYLES[tone] || TONE_STYLES.primary;

  return (
    <article
      title={description}
      className="group relative flex min-h-[176px] flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white p-5 shadow-[0_2px_10px_rgb(0,0,0,0.04)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_28px_rgb(15,23,42,0.10)]"
    >
      {/* accent bar atas, gradient tipis sesuai tone */}
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${style.from}, ${style.to})` }}
      />

      <div className="flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
        >
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Realtime
        </span>
      </div>

      <p className="mt-4 text-sm font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-neutral-900">{value}</p>

      {meta ? (
        <span
          className="mt-1.5 inline-block w-fit rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: style.badgeBg, color: style.badgeText }}
        >
          {meta}
        </span>
      ) : (
        <span className="mt-1.5 h-[22px]" />
      )}

      <p className="mt-auto pt-2 text-xs leading-5 text-neutral-400">{footer}</p>
    </article>
  );
}

export default function ExecutiveSummary({ filters }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const endpoint = '/analytics/executive-summary';
    const fetchData = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const { data: response } = await api.get(endpoint, { params: filters });
        if (active) { setData(response); setIsLoading(false); }
      } catch (error) {
        if (active) {
          const status = error?.response?.status;
          const responseData = error?.response?.data;
          console.error('Executive Summary API error:', endpoint, status, responseData);
          setError(true);
          setIsLoading(false);
        }
      }
    };
    fetchData();
    return () => { active = false; };
  }, [filters]);

  const cards = data ? [
    { label: 'Total Peserta', value: data.total_participants ?? '—', meta: 'Peserta terdaftar', footer: 'Data diperbarui realtime mengikuti filter dashboard.', icon: 'users', tone: 'primary', description: 'Jumlah seluruh peserta yang mengikuti psikotes sesuai filter.' },
    { label: 'Penyelesaian Psikotes', value: data.completion?.percentage == null ? '—' : data.completion.percentage + '%', meta: (data.completion?.completed ?? 0) + ' / ' + (data.total_participants ?? 0) + ' Peserta', footer: (data.completion?.pending ?? 0) + ' peserta masih memiliki tes yang belum selesai.', icon: 'checkcircle', tone: 'success', description: 'Persentase peserta yang telah menyelesaikan seluruh rangkaian psikotes.' },
    { label: 'Rata-rata IQ CFIT', value: data.iq_cfit?.average ?? '—', meta: 'CFIT / Logic', footer: 'Rata-rata berdasarkan hasil tes CFIT (Culture Fair Intelligence Test).', icon: 'brain', tone: 'teal', description: 'Nilai rata-rata IQ dari tes CFIT (Aritmatika & Logika).' },
    { label: 'Rata-rata IQ WPT', value: data.iq_wpt?.average ?? '—', meta: 'WPT / Pattern', footer: 'Rata-rata berdasarkan hasil tes WPT (Wonderlic Personnel Test).', icon: 'brain', tone: 'violet', description: 'Nilai rata-rata IQ dari tes WPT (Pola).'},
    { label: 'Rata-rata Speed Test', value: data.speed?.average ?? '—', meta: data.speed?.band || 'Belum tersedia', footer: 'Mayoritas kategori berdasarkan data Speed Test.', icon: 'activity', tone: 'gold', description: 'Nilai rata-rata kemampuan Processing Speed.' },
    { label: 'Rata-rata Memory Test', value: data.memory?.average ?? '—', meta: data.memory?.band || 'Belum tersedia', footer: 'Mayoritas kategori berdasarkan data Memory Test.', icon: 'brain', tone: 'cyan', description: 'Nilai rata-rata kemampuan Memory Test.' },
    { label: 'Risiko Rekrutmen', value: data.cbi?.dominant_level ? data.cbi.dominant_level + ' Level' : '—', meta: data.cbi?.risk || 'Belum tersedia', footer: data.cbi?.percentage == null ? 'Data CBI belum tersedia.' : data.cbi.participant + ' peserta (' + data.cbi.percentage + '%) berada pada kategori dominan.', icon: 'warning', tone: 'rose', description: 'Mayoritas peserta berdasarkan tingkat risiko CBI.' },
  ] : [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">At a glance</p>
          <h2 className="mt-1 text-xl font-bold text-neutral-900">Executive Summary</h2>
        </div>
        {error && <span className="text-xs text-red-500">Failed to fetch executive summary</span>}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        {isLoading
          ? [...Array(7)].map((_, index) => <KpiSkeleton key={index} />)
          : error || !data
          ? [...Array(7)].map((_, index) => <KpiSkeleton key={index} />)
          : cards.map((card) => <KpiCard key={card.label} {...card} />)}
      </div>
    </section>
  );
}
