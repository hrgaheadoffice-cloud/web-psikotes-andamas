import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import Swal from 'sweetalert2';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

/**
 * Compute primary_trait from result details for old results
 * that were scored before the primary_trait field was added to backend.
 */
function computePrimaryTrait(details) {
    if (!details) return null;
    if (details.primary_trait) return details.primary_trait; // already computed by backend

    const percentages = details.percentages;
    if (!percentages) return null;

    const entries = Object.entries(percentages);
    if (entries.length === 0) return null;

    const maxPct = Math.max(...entries.map(([, v]) => v));
    const topNorms = entries.filter(([, v]) => v === maxPct).map(([k]) => k);

    if (topNorms.length === 1) {
        return topNorms[0];
    }
    return topNorms.join(' & ');
}

const CBI_INTERPRETATION = {
    "Overall": {
        "White": "Menunjukkan individu dengan risiko sangat rendah terhadap perilaku kontraproduktif. Kandidat cenderung stabil, dapat diandalkan, dan cocok untuk lingkungan kerja profesional.",
        "Light Blue": "Menunjukkan adanya beberapa area yang perlu diperhatikan, namun masih dapat dikembangkan melalui pembinaan atau supervisi.",
        "Dark Blue": "Menunjukkan individu dengan risiko tinggi terhadap perilaku kontraproduktif, yang berpotensi mengganggu kinerja, tim, maupun organisasi."
    },
    "Dependability": {
        "White": "Menunjukkan individu yang disiplin, bertanggung jawab, dan dapat diandalkan. Memiliki komitmen terhadap pekerjaan serta mampu menjaga konsistensi kinerja.",
        "Light Blue": "Menunjukkan adanya inkonsistensi dalam kedisiplinan dan tanggung jawab. Terkadang kurang fokus atau menunda pekerjaan, namun masih dalam batas yang dapat diperbaiki.",
        "Dark Blue": "Menunjukkan individu yang kurang dapat diandalkan, cenderung lalai, tidak disiplin, dan berpotensi mengganggu produktivitas kerja."
    },
    "Aggression": {
        "White": "Menunjukkan individu yang mampu mengontrol emosi dengan baik, tidak mudah terpancing konflik, dan cenderung menjaga hubungan kerja yang positif.",
        "Light Blue": "Menunjukkan adanya kecenderungan emosi yang fluktuatif, mudah tersinggung dalam situasi tertentu, namun masih dapat dikendalikan.",
        "Dark Blue": "Menunjukkan individu yang mudah marah, agresif, dan berpotensi konflik, yang dapat mengganggu lingkungan kerja."
    },
    "Substance Abuse": {
        "White": "Menunjukkan individu yang tidak memiliki kecenderungan penggunaan zat berbahaya, serta menjaga kondisi kerja yang aman.",
        "Light Blue": "Menunjukkan adanya potensi atau paparan terhadap penggunaan zat, namun belum menunjukkan dampak signifikan terhadap pekerjaan.",
        "Dark Blue": "Menunjukkan individu dengan risiko tinggi penyalahgunaan zat, yang dapat berdampak pada keselamatan dan kinerja kerja."
    },
    "Honesty": {
        "White": "Menunjukkan individu dengan integritas tinggi, jujur, dan dapat dipercaya dalam pekerjaan.",
        "Light Blue": "Menunjukkan adanya potensi perilaku tidak jujur dalam kondisi tertentu, terutama jika ada tekanan atau kesempatan.",
        "Dark Blue": "Menunjukkan individu dengan risiko tinggi perilaku tidak jujur, seperti manipulasi, penyalahgunaan, atau pelanggaran aturan."
    },
    "Computer Abuse": {
        "White": "Menunjukkan individu yang menggunakan teknologi secara profesional dan sesuai aturan.",
        "Light Blue": "Menunjukkan adanya penggunaan teknologi untuk kepentingan pribadi secara terbatas, namun belum mengganggu pekerjaan secara signifikan.",
        "Dark Blue": "Menunjukkan individu dengan risiko tinggi penyalahgunaan teknologi, seperti akses tidak sah atau penggunaan tidak sesuai kebijakan."
    },
    "Sexual Harassment": {
        "White": "Menunjukkan individu yang menjaga batas profesional dan menghormati orang lain.",
        "Light Blue": "Menunjukkan adanya potensi perilaku yang dapat menimbulkan ketidaknyamanan, meskipun tidak selalu disengaja.",
        "Dark Blue": "Menunjukkan individu dengan risiko tinggi melakukan perilaku yang tidak pantas, yang dapat berdampak serius pada lingkungan kerja."
    },
    "Good Impression": {
        "White": "Menunjukkan responden menjawab secara jujur dan terbuka.",
        "Light Blue": "Menunjukkan adanya kecenderungan memberikan jawaban yang lebih baik dari kondisi sebenarnya.",
        "Dark Blue": "Menunjukkan kemungkinan besar distorsi/faking good, sehingga hasil tes lain perlu diinterpretasikan dengan hati-hati."
    }
};

function ParticipantProfilePage() {
    const { token, canSeeResults, isSuperadmin, isStaff } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();

    // Route Protection: Non-staff users cannot see details
    useEffect(() => {
        if (token && !isStaff) {
            Swal.fire({
                title: "Akses Ditolak",
                text: "Anda tidak memiliki izin untuk melihat detail peserta.",
                icon: "error"
            });
            navigate('/');
        }
    }, [isStaff, navigate, token]);

    const [user, setUser] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [docxExporting, setDocxExporting] = useState(false);

    // DOCX export handler
    const handleExportDOCX = async () => {
        setDocxExporting(true);
        try {
            const response = await api.exportParticipantDocx(id);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${user?.username || 'participant'}_report.docx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error(err);
            Swal.fire('Kesalahan', 'Gagal mengekspor DOCX.', 'error');
        } finally {
            setDocxExporting(false);
        }
    };

    // Export handler
    const handleExportParticipant = async () => {
        setExporting(true);
        try {
            const response = await api.exportParticipant(id);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${user?.username || 'participant'}_results.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error(err);
            Swal.fire('Kesalahan', 'Gagal mengekspor hasil.', 'error');
        } finally {
            setExporting(false);
        }
    };

    // Define loadParticipantData FIRST using useCallback
    const loadParticipantData = useCallback(async () => {
        try {
            setLoading(true);
            const userRes = await api.getUser(id);
            setUser(userRes.data);

            const assignRes = await api.getAssignments(id);
            setAssignments(assignRes.data);

            // Only fetch results if user has assessor/superadmin role
            // Admin role will get 403 from /results/ endpoint
            if (canSeeResults) {
                const resultsRes = await api.getResults({ user_id: id });
                setResults(resultsRes.data);
            }
        } catch (err) {
            console.error('Error loading participant data:', err);
        } finally {
            setLoading(false);
        }
    }, [id, canSeeResults]);

    // Load data on mount and when id/token changes
    useEffect(() => {
        loadParticipantData();
    }, [loadParticipantData]);

    const getResultForTest = (testId) => {
        // Get all results for this test and return the latest one
        const testResults = results.filter(r => r.test_id === testId);
        if (testResults.length === 0) return null;
        // Sort by completed_at descending and return the latest
        testResults.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
        return testResults[0];
    };

    // Deduplicate results - keep only the latest per test
    const getLatestResults = () => {
        const latestResults = {};
        results.forEach(r => {
            if (!latestResults[r.test_id] ||
                new Date(r.completed_at) > new Date(latestResults[r.test_id].completed_at)) {
                latestResults[r.test_id] = r;
            }
        });
        return Object.values(latestResults);
    };

    // Define handleReset AFTER loadParticipantData
    const handleReset = async (assignmentId, testName) => {
        const result = await Swal.fire({
            title: 'Reset Tes?',
            text: `Yakin ingin mereset "${testName}"? Semua jawaban dan hasil akan dihapus, dan peserta dapat mengerjakan ulang.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, reset'
        });

        if (result.isConfirmed) {
            try {
                await api.resetAssignment(assignmentId);
                Swal.fire('Berhasil direset!', 'Tes telah direset.', 'success');
                loadParticipantData(); // refresh data
            } catch (err) {
                console.error('Reset error:', err);
                Swal.fire('Kesalahan', 'Gagal mereset tes.', 'error');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg max-w-xl mx-auto my-8">
                Peserta tidak ditemukan
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto font-sans">
            {/* Floating Header Container */}
            <div className="sticky top-0 z-30 space-y-4 bg-neutral-50/90 backdrop-blur-md pt-1 pb-4 -mx-4 px-4 md:-mx-6 md:px-6">
                {/* Page Header with Back and Actions */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors min-h-[44px] flex-shrink-0"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    <span className="hidden sm:inline">Kembali</span>
                                </button>
                                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Profil Peserta</h1>
                            </div>
                            {/* Show export and decision buttons only if the logged-in user can see results (Assessor or Superadmin) */}
                            {canSeeResults && (
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={handleExportParticipant}
                                        disabled={exporting}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm"
                                    >
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="hidden sm:inline">{exporting ? 'Mengekspor...' : 'Ekspor CSV'}</span>
                                        <span className="sm:hidden">CSV</span>
                                    </button>
                                    <button
                                        onClick={handleExportDOCX}
                                        disabled={docxExporting}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm"
                                    >
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        <span className="hidden sm:inline">{docxExporting ? 'Membuat...' : 'Ekspor DOCX'}</span>
                                        <span className="sm:hidden">DOCX</span>
                                    </button>
                                    <button
                                        onClick={() => navigate(`/participants/${id}/decision`)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors min-h-[44px] text-sm"
                                    >
                                        <span>Selanjutnya</span>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Profile Header - Industrial Utilitarian Aesthetic */}
                <div className="bg-white border-2 border-neutral-900 rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden">
                    <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-neutral-900">
                        {/* Primary Identity Section */}
                        <div className="flex-1 p-6 md:p-8 bg-neutral-50">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-1 block">Profil Peserta</span>
                                    <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight leading-none group flex items-baseline gap-3">
                                        {user.full_name || user.username}
                                        <span className="text-sm font-mono text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 uppercase">
                                            ID-{user.id?.toString().padStart(4, '0')}
                                        </span>
                                    </h2>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Jabatan</span>
                                    <span className="text-sm font-semibold text-neutral-800 uppercase">{user.position || 'N/A'}</span>
                                </div>
                                <div className="w-px h-8 bg-neutral-200 hidden md:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Departemen</span>
                                    <span className="text-sm font-semibold text-neutral-800 uppercase">{user.department || 'N/A'}</span>
                                </div>
                                <div className="w-px h-8 bg-neutral-200 hidden md:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Unit Bisnis</span>
                                    <span className="text-sm font-semibold text-neutral-800 uppercase">{user.business_unit || 'N/A'}</span>
                                </div>
                                <div className="w-px h-8 bg-neutral-200 hidden md:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Level</span>
                                    <span className="text-sm font-bold text-indigo-600 uppercase tracking-tighter">{user.level || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Classification Anchor Section */}
                        <div className="w-full lg:w-72 bg-neutral-900 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden group">
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-[0.03] rotate-45 translate-x-16 -translate-y-16 group-hover:opacity-[0.06] transition-opacity"></div>

                            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 mb-2">Klasifikasi</span>
                            <div className="flex flex-col">
                                <h4 className="text-2xl font-bold text-white tracking-tighter leading-tight uppercase">
                                    {user.class_name || 'Standard'}
                                </h4>
                                <div className="mt-4 h-1 w-12 bg-accent-gold"></div>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Specs Grid */}
                    <div className="bg-white border-t-2 border-neutral-900 p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Username</label>
                            <p className="font-mono text-sm font-bold text-neutral-700 select-all">@{user.username}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Jenis Kelamin</label>
                            <p className="text-sm font-bold text-neutral-900 uppercase">
                                {user.gender === 'Male' ? 'Laki-laki' : (user.gender === 'Female' ? 'Perempuan' : (user.gender || '–'))}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Usia</label>
                            <p className="text-sm font-bold text-neutral-900">{user.age ? `${user.age} Tahun` : '–'}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Pendidikan Terakhir</label>
                            <p className="text-sm font-bold text-neutral-900 uppercase">{user.education || '–'}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Status Peserta</label>
                            <p className="font-semibold text-sm text-neutral-700">{user.participant_status || '–'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ringkasan Aktivitas & Integritas Sesi */}
            <section className="animate-fade-in-up mt-12 mb-12">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-8 w-1.5 bg-neutral-900"></div>
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black text-neutral-900 uppercase tracking-tight leading-none">Integritas Sesi & Aktivitas</h2>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Audit log aktivitas pengerjaan tes</span>
                    </div>
                </div>

                <div className="bg-white border-2 border-neutral-900 overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)]">
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-300">
                        <table className="w-full text-left border-collapse min-w-[700px] lg:min-w-full">
                            <thead>
                                <tr className="bg-neutral-900 text-white border-b-2 border-neutral-900">
                                    <th className="px-3 md:px-5 py-3 text-[10px] font-black uppercase tracking-widest border-r border-neutral-700 w-auto md:w-1/4">Nama Pengujian</th>
                                    <th className="px-3 md:px-5 py-3 text-[10px] font-black uppercase tracking-widest border-r border-neutral-700 text-center w-[80px] md:w-[120px]">Status</th>
                                    <th className="px-3 md:px-5 py-3 text-[10px] font-black uppercase tracking-widest border-r border-neutral-700 min-w-[180px]">Sesi Pengerjaan (WIB)</th>
                                    <th className="px-3 md:px-5 py-3 text-[10px] font-black uppercase tracking-widest border-r border-neutral-700 text-center w-[80px] md:w-[100px]">Durasi</th>
                                    <th className="px-3 md:px-5 py-3 text-[10px] font-black uppercase tracking-widest border-r border-neutral-700 text-center w-[100px] md:w-[130px]">Perangkat</th>
                                    <th className="px-3 md:px-5 py-3 text-[10px] font-black uppercase tracking-widest text-center min-w-[120px]">Indikasi Kecurangan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200">
                                {assignments.map((a, idx) => {
                                    const result = results.find(r => r.assignment_id === a.id);
                                    const started_at = a.started_at || result?.started_at;
                                    const completed_at = result?.completed_at;
                                    const device = result?.details?.session?.device || result?.details?.device || (a.status === 'completed' ? 'Desktop' : '–');
                                    const exit_count = a.exit_count || 0;

                                    const formatIndoDate = (dateStr) => {
                                        if (!dateStr) return null;
                                        return new Date(dateStr).toLocaleString('id-ID', {
                                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                        });
                                    };

                                    const startStr = formatIndoDate(started_at);
                                    const endStr = formatIndoDate(completed_at);

                                    return (
                                        <tr key={a.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'} hover:bg-neutral-100/50 transition-colors`}>
                                            <td className="px-3 md:px-5 py-3 border-r border-neutral-100">
                                                <span className="text-[11px] md:text-xs font-black text-neutral-900 uppercase tracking-tighter block truncate max-w-[150px] md:max-w-none" title={a.test_name}>{a.test_name}</span>
                                            </td>
                                            <td className="px-3 md:px-5 py-3 border-r border-neutral-100">
                                                <div className="flex items-center justify-center gap-1.5 md:gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.status === 'completed' ? 'bg-success' : 'bg-neutral-300'
                                                        }`}></div>
                                                    <span className="text-[9px] md:text-[10px] font-black text-neutral-600 uppercase whitespace-nowrap">
                                                        {a.status === 'completed' ? (
                                                            result?.details?.is_complete === false ? 'Selesai (Parsial)' : 'Selesai'
                                                        ) : a.status === 'in_progress' ? 'Proses' : a.status === 'locked' ? 'Terkunci' : 'Belum Mulai'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 md:px-5 py-3 border-r border-neutral-100">
                                                <div className="flex flex-col xl:flex-row xl:items-center gap-1 xl:gap-2 font-mono text-[9px] md:text-[10px]">
                                                    <span className={startStr ? 'text-neutral-900 font-bold whitespace-nowrap' : 'text-neutral-300'}>
                                                        {startStr ? `${startStr} WIB` : '––/–– ––:––'}
                                                    </span>
                                                    <span className="text-neutral-300 hidden xl:inline">→</span>
                                                    <span className={endStr ? 'text-neutral-900 font-bold whitespace-nowrap' : 'text-neutral-300'}>
                                                        {endStr ? `${endStr} WIB` : '––/–– ––:––'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 border-r border-neutral-100 text-center font-mono text-[10px]">
                                                {(() => {
                                                    const duration = result?.time_taken || (started_at && completed_at ? Math.floor((new Date(completed_at) - new Date(started_at)) / 1000) : 0);
                                                    if (!duration) return '–';
                                                    return (
                                                        <span className="font-bold text-neutral-900">
                                                            {Math.floor(duration / 60)}m {duration % 60}s
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-5 py-3 border-r border-neutral-100 text-center">
                                                <div className="flex justify-center items-center gap-2 text-neutral-500">
                                                    {device === 'Mobile' ? (
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                    ) : device !== '–' ? (
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 21h6l-.75-4M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                    ) : <span className="text-neutral-300">–</span>}
                                                    <span className="text-[9px] font-black uppercase tracking-tighter">{device !== '–' ? device : ''}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 border ${exit_count > 5 ? 'bg-error text-white border-neutral-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' :
                                                        exit_count > 0 ? 'bg-warning-light text-warning-dark border-warning/30' :
                                                            'bg-neutral-50 text-neutral-400 border-neutral-200'
                                                        }`}>
                                                        {exit_count} GANGGUAN
                                                    </span>
                                                    {exit_count > 5 && (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[9px] font-black text-error uppercase tracking-tighter">Beresiko</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Assigned Tests - Industrial Grid (assessor/superadmin only) */}
            {canSeeResults && (
            <section className="animate-fade-in-up">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-8 w-1.5 bg-neutral-900"></div>
                    <h2 className="text-xl font-black text-neutral-900 uppercase tracking-tight">
                        Tes yang Ditugaskan
                    </h2>
                </div>

                {assignments.length === 0 ? (
                    <div className="text-center py-12 bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-none">
                        <p className="text-neutral-500 font-mono text-sm uppercase tracking-widest">Belum ada tes yang ditugaskan.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {assignments.map((a) => {
                            const result = getResultForTest(a.test_id);
                            const isIncomplete = result?.details?.is_complete === false;
                            const answeredCount = result?.details?.answered_count;
                            const totalQuestions = result?.details?.total_questions;

                            const isDiscIncomplete = a.test_code === 'DISC' &&
                                result?.details &&
                                (Object.keys(result.details.graph_i || {}).length < 4);

                            let statusBadgeColor;
                            switch (a.status) {
                                case 'completed':
                                    statusBadgeColor = 'bg-success text-white border-neutral-900';
                                    break;
                                case 'in_progress':
                                    statusBadgeColor = 'bg-warning text-white border-neutral-900';
                                    break;
                                case 'locked':
                                    statusBadgeColor = 'bg-error text-white border-neutral-900';
                                    break;
                                default:
                                    statusBadgeColor = 'bg-neutral-100 text-neutral-500 border-neutral-300';
                            }

                            return (
                                <div
                                    key={a.id}
                                    className="bg-white border-2 border-neutral-900 rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,0.08)] flex flex-col h-full hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.12)] transition-all duration-200"
                                >
                                    {/* Card Header */}
                                    <div className="p-5 border-b-2 border-neutral-900 bg-neutral-50 flex-1">
                                        <div className="flex justify-between items-start gap-4">
                                            <h4 className="font-black text-neutral-900 leading-tight uppercase tracking-tighter">
                                                {a.test_name}
                                            </h4>
                                            <span className={`text-[10px] font-bold px-2 py-1 border-2 uppercase tracking-widest flex-shrink-0 ${statusBadgeColor}`}>
                                                {a.status.replace('_', ' ')}
                                            </span>
                                        </div>

                                        {/* Metics / Stats */}
                                        <div className="mt-6 space-y-3">
                                            {/* Score Metric */}
                                            {result && a.test_name !== "Temperament Test" && a.test_code !== 'LEAD' && !isDiscIncomplete && (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Skor Akhir</span>
                                                    {a.test_code === 'DISC' ? (
                                                        <span className="text-xs font-bold text-neutral-800 uppercase italic">Profil Kepribadian</span>
                                                    ) : (
                                                        <p className="text-lg font-black text-neutral-900">
                                                            {result.score} <span className="text-neutral-300 text-sm font-normal">/ {result.max_score || '?'}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Question Progress */}
                                            {result && answeredCount !== undefined && totalQuestions !== undefined && (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Progress Soal</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-black ${isIncomplete ? 'text-error' : 'text-success'}`}>
                                                            {answeredCount} / {totalQuestions}
                                                        </span>
                                                        {isIncomplete && <span className="text-[10px] bg-error-light text-error font-black px-1 border border-error">INCOMPLETE</span>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Test Specific Insights */}
                                            {result && a.test_name === "Temperament Test" && (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Dominasi Tipe</span>
                                                    <span className="text-sm font-black text-primary-600 uppercase">{result.details?.primary || 'N/A'}</span>
                                                </div>
                                            )}

                                            {result && a.test_code === "LEAD" && (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Profil Kepemimpinan</span>
                                                    <span className="text-sm font-black text-primary-600 uppercase">{computePrimaryTrait(result.details) || 'General Profile'}</span>
                                                </div>
                                            )}

                                            {result && a.test_name === "Test IQ ( POLA )" && result.details?.iq && (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Potensi IQ</span>
                                                    <span className="text-sm font-black text-primary-700 uppercase">{result.details.iq} — {result.details.classification}</span>
                                                </div>
                                            )}

                                        </div>
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="p-4 bg-white border-t-2 border-neutral-900 flex justify-end">
                                        {a.status !== 'pending' ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReset(a.id, a.test_name);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-error-light hover:bg-error text-error hover:text-white text-xs font-bold rounded-lg border border-error transition-all"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                RESET DATA
                                            </button>
                                        ) : (
                                            <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-[0.2em] py-1.5">Waiting Participant</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
            )}
            {canSeeResults && results.length > 0 && (
                <section className="animate-fade-in-up mt-12 pb-20">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-8 w-1.5 bg-neutral-900"></div>
                        <h2 className="text-xl font-black text-neutral-900 uppercase tracking-tight">
                            Hasil Pengujian Detail
                        </h2>
                    </div>

                    <div className="space-y-10">
                        {getLatestResults().map((r) => (
                            <div
                                key={r.id}
                                className="bg-white border-2 border-neutral-900 rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] overflow-hidden"
                            >
                                {/* Results Header - Technical Bar */}
                                <div className="bg-neutral-900 px-6 py-4 border-b-2 border-neutral-900 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                                    <h3 className="text-lg font-black text-white uppercase tracking-wider">{r.test_name}</h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                            {r.test_name === "Test Kepemimpinan" || r.test_name === "Temperament Test" ? "Profile" : "Global Score"}
                                        </span>
                                        {r.max_score && r.test_name !== "Test Kepemimpinan" && r.test_name !== "Temperament Test" && (
                                            <div className="px-3 py-1 bg-white border-2 border-white text-neutral-900 font-mono font-black text-sm">
                                                {r.score} <span className="text-neutral-400 font-normal">/ {r.max_score}</span>
                                            </div>
                                        )}
                                        {(r.test_name === "Test Kepemimpinan" || r.test_name === "Temperament Test") && (
                                            <div className="px-3 py-1 bg-accent-gold text-neutral-900 font-bold text-xs uppercase border-2 border-accent-gold">
                                                {r.test_name === "Temperament Test" ? r.details?.primary || "Personality Profile" : computePrimaryTrait(r.details) || "Personality Profile"}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 md:p-8">
                                    {/* DISC Assessment */}
                                    {r.test_name === "DISC Test" && r.details && (
                                        <div className="space-y-8">
                                            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                                                <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest">Matriks Profil DISC</h4>
                                                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-tighter">
                                                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500"></span> Publik</div>
                                                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500"></span> Alami</div>
                                                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500"></span> Int.</div>
                                                </div>
                                            </div>

                                            {/* Tally Table - Industrial Style */}
                                            <div className="overflow-hidden border-2 border-neutral-900">
                                                <table className="min-w-full divide-y-2 divide-neutral-900 bg-white">
                                                    <thead className="bg-neutral-50">
                                                        <tr className="divide-x-2 divide-neutral-900">
                                                            <th className="px-4 py-3 text-left text-[10px] font-black text-neutral-500 uppercase tracking-widest">Dimensi</th>
                                                            <th className="px-4 py-3 text-center text-[10px] font-black text-neutral-500 uppercase tracking-widest">Grafik I</th>
                                                            <th className="px-4 py-3 text-center text-[10px] font-black text-neutral-500 uppercase tracking-widest">Grafik II</th>
                                                            <th className="px-4 py-3 text-center text-[10px] font-black text-neutral-500 uppercase tracking-widest">Grafik III</th>
                                                            <th className="px-4 py-3 text-center text-[10px] font-black text-neutral-500 uppercase tracking-widest">H/L Change</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-neutral-200">
                                                        {['D', 'I', 'S', 'C'].map(trait => {
                                                            const i = r.details.graph_i?.[trait] || 0;
                                                            const ii = r.details.graph_ii?.[trait] || 0;
                                                            const iii = r.details.graph_iii?.[trait] || 0;
                                                            const change = i - ii;
                                                            return (
                                                                <tr key={trait} className="divide-x divide-neutral-200 hover:bg-neutral-50 transition-colors cursor-default">
                                                                    <td className="px-4 py-3 font-black text-neutral-900 text-center bg-neutral-50 border-r-2 border-r-neutral-900">{trait}</td>
                                                                    <td className="px-4 py-3 text-center font-mono font-bold">{i}</td>
                                                                    <td className="px-4 py-3 text-center font-mono font-bold">{ii}</td>
                                                                    <td className="px-4 py-3 text-center font-mono font-bold">{iii}</td>
                                                                    <td className={`px-4 py-3 text-center font-mono font-black ${change < 0 ? 'text-error' : change > 0 ? 'text-success' : 'text-neutral-400'}`}>
                                                                        {change > 0 ? `+${change}` : change}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Line Chart */}
                                            <div className="bg-neutral-50 p-6 border-2 border-neutral-900 h-[350px]">
                                                {(() => {
                                                    const chartData = ['D', 'I', 'S', 'C'].map(trait => ({
                                                        trait,
                                                        'Grafik I': r.details.graph_i?.[trait] || 0,
                                                        'Grafik II': 24 - (r.details.graph_ii?.[trait] || 0), // Visually invert so high trait presence plots high
                                                        'Grafik III': r.details.graph_iii?.[trait] || 0,
                                                    }));

                                                    return (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                                                <XAxis dataKey="trait" axisLine={{ stroke: '#171717', strokeWidth: 2 }} tick={{ fill: '#171717', fontWeight: 900 }} />
                                                                <YAxis domain={[-24, 24]} axisLine={{ stroke: '#171717', strokeWidth: 2 }} tick={{ fill: '#a3a3a3', fontSize: 10 }} />
                                                                <Tooltip formatter={(value, name) => {
                                                                    if (name === 'Grafik II') return 24 - value;
                                                                    return value;
                                                                }} />
                                                                <Line type="monotone" dataKey="Grafik I" stroke="#3b82f6" strokeWidth={4} dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                                                                <Line type="monotone" dataKey="Grafik II" stroke="#22c55e" strokeWidth={4} dot={{ r: 6, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                                                                <Line type="monotone" dataKey="Grafik III" stroke="#a855f7" strokeWidth={4} dot={{ r: 6, fill: '#a855f7', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    );
                                                })()}
                                            </div>

                                            {/* Stress Gap Indicator */}
                                            {r.details.stress_gap !== undefined && (
                                                <div className="bg-neutral-100 border-2 border-neutral-900 p-5 flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Stress Gap Index</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-2xl font-black text-neutral-900 font-mono">{Math.round(r.details.stress_gap)}</span>
                                                            <span className={`px-2 py-0.5 text-[10px] font-black border uppercase ${r.details.stress_gap > 10 ? 'bg-error text-white border-error' : 'bg-success text-white border-success'}`}>
                                                                {r.details.stress_gap > 10 ? 'Significant Tension' : 'Normal Range'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {r.details.stress_gap > 10 && <div className="text-3xl animate-pulse">⚠️</div>}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Speed Test */}
                                    {r.test_name === "Speed Test" && r.details && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest border-b border-neutral-100 pb-2">Metriks Performa</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-neutral-50 p-4 border border-neutral-200">
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Skor Akurasi</span>
                                                        <span className="text-xl font-black text-neutral-900 font-mono">{r.details.accuracy}%</span>
                                                    </div>
                                                    <div className="bg-neutral-50 p-4 border border-neutral-200">
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Total Dijawab</span>
                                                        <span className="text-xl font-black text-neutral-900 font-mono">{r.details.total_answered}</span>
                                                    </div>
                                                </div>
                                                <div className="p-4 border-2 border-neutral-900 flex items-center justify-between">
                                                    <span className="text-xs font-black uppercase text-neutral-500">Klasifikasi Performa</span>
                                                    <span className="text-sm font-black uppercase text-primary-600 tracking-tighter">{r.details.band}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col justify-center">
                                                {r.details.flag ? (
                                                    <div className="bg-error-light border-2 border-error p-6 text-error">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                            <span className="font-black text-xs uppercase tracking-widest">Peringatan Validitas</span>
                                                        </div>
                                                        <p className="text-sm font-bold leading-tight">{r.details.flag}</p>
                                                    </div>
                                                ) : (
                                                    <div className="bg-success-light border-2 border-success p-6 text-success flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-white">✓</div>
                                                        <div>
                                                            <span className="font-black text-xs uppercase tracking-widest block">Data Valid</span>
                                                            <span className="text-xs font-bold">Tidak ditemukan anomali pengisian.</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* IQ Test (POLA) */}
                                    {r.test_name === "Test IQ ( POLA )" && r.details && (
                                        <div className="space-y-8">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="bg-neutral-900 p-6 shadow-[4px_4px_0px_0px_rgba(49,97,119,1)]">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 block">IQ Quotient</span>
                                                    <span className="text-4xl font-black text-white font-mono leading-none">{r.details.iq || (r.details.scoring_error ? 'ERR' : '?')}</span>
                                                    <span className="text-[10px] font-black text-accent-gold uppercase tracking-tighter block mt-2">{r.details.classification || (r.details.scoring_error ? 'Scoring Error' : 'Pending Calculation')}</span>
                                                </div>
                                                <div className="bg-neutral-50 p-6 border-2 border-neutral-900 flex flex-col justify-center">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 block">Raw Score Summary</span>
                                                    <span className="text-2xl font-black text-neutral-900 font-mono">
                                                        {r.details.raw_score !== undefined ? r.details.raw_score : (r.score || '?')}
                                                        <span className="text-neutral-300"> / {r.details.max_score || r.max_score || '?'}</span>
                                                    </span>
                                                </div>
                                                <div className="bg-neutral-50 p-6 border-2 border-neutral-900 flex flex-col justify-center">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 block">Accuracy Matrix</span>
                                                    <span className="text-2xl font-black text-neutral-900 font-mono">
                                                        {(() => {
                                                            const raw = r.details.raw_score !== undefined ? r.details.raw_score : r.score;
                                                            const max = r.details.max_score || r.max_score;
                                                            if (max && max > 0) return Math.round((raw / max) * 100) + '%';
                                                            return '–';
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Section Analytics */}
                                            {r.details.section_scores && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="p-5 border border-neutral-200 bg-neutral-50 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-2 text-[10px] font-black text-neutral-200 uppercase tracking-widest">Section 01</div>
                                                        <span className="text-xs font-black text-neutral-500 uppercase tracking-tighter block mb-1">Visual Logika (P1-4)</span>
                                                        <span className="text-xl font-bold text-neutral-900 font-mono">{r.details.section_scores.section_1.correct} / 50</span>
                                                    </div>
                                                    <div className="p-5 border border-neutral-200 bg-neutral-50 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-2 text-[10px] font-black text-neutral-200 uppercase tracking-widest">Section 02</div>
                                                        <span className="text-xs font-black text-neutral-500 uppercase tracking-tighter block mb-1">Abstraksi Pola (P5-8)</span>
                                                        <span className="text-xl font-bold text-neutral-900 font-mono">{r.details.section_scores.section_2.correct} / 50</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Temperament Test */}
                                    {r.test_name === "Temperament Test" && r.details && (
                                        <div className="space-y-8">
                                            <div className="flex flex-col md:flex-row gap-6">
                                                <div className="flex-1 bg-neutral-50 p-6 border-2 border-neutral-900">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 block">Primary Personality Profile</span>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-16 h-16 bg-neutral-900 flex items-center justify-center text-white text-3xl font-black">
                                                            {r.details.primary?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h5 className="text-2xl font-black text-neutral-900 uppercase leading-none">{r.details.primary}</h5>
                                                            <p className="text-xs font-bold text-neutral-400 mt-1 uppercase tracking-widest">Dominant Trait</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex-1 bg-neutral-50 p-6 border-2 border-neutral-900">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 block">Secondary Personality Profile</span>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-16 h-16 bg-neutral-100 border-2 border-neutral-900 flex items-center justify-center text-neutral-900 text-3xl font-black">
                                                            {r.details.secondary?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h5 className="text-2xl font-black text-neutral-900 uppercase leading-none">{r.details.secondary}</h5>
                                                            <p className="text-xs font-bold text-neutral-400 mt-1 uppercase tracking-widest">Supporting Trait</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Intensity Bar Charts */}
                                            <div className="space-y-4">
                                                <h5 className="text-xs font-black text-neutral-500 uppercase tracking-widest">Trait Intensity Spectrum</h5>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                                                    {Object.entries(r.details.percentages || {}).map(([trait, pct]) => (
                                                        <div key={trait} className="flex flex-col gap-1">
                                                            <div className="flex justify-between items-baseline">
                                                                <span className="text-[10px] font-black uppercase text-neutral-900">
                                                                    {trait} {r.details.raw_scores && <span className="text-neutral-400 font-mono text-[9px] ml-1">({r.details.raw_scores[trait === "Sanguine" ? "S" : trait === "Choleric" ? "C" : trait === "Melancholic" ? "M" : "P"]}/30)</span>}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    {r.details.categories && r.details.categories[trait] && (
                                                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 ${r.details.categories[trait] === 'Tinggi' ? 'bg-primary-600 text-white' : r.details.categories[trait] === 'Sedang' ? 'bg-primary-300 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
                                                                            {r.details.categories[trait]}
                                                                        </span>
                                                                    )}
                                                                    <span className="font-mono text-xs font-bold">{Math.round(pct)}%</span>
                                                                </div>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-neutral-100 border border-neutral-200">
                                                                <div className="h-full bg-neutral-900" style={{ width: `${pct}%` }}></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Interpretation Text */}
                                            {r.details.interpretation_text && (
                                                <div className="bg-white border-2 border-neutral-900 p-6 mt-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]">
                                                    <h5 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">
                                                        Hasil Interpretasi Skor Tertinggi ({r.details.primary})
                                                    </h5>
                                                    <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed font-medium">
                                                        {r.details.interpretation_text}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* PAPI Kostick - Elevated */}
                                    {r.test_name === "Test Kepemimpinan" && r.details && r.details.categories && (
                                        <div className="space-y-10">
                                            <div className="flex flex-col lg:flex-row gap-8 items-center bg-neutral-50 p-8 border-2 border-neutral-900">
                                                <div className="w-full lg:w-1/2">
                                                    <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest mb-6 border-l-4 border-neutral-900 pl-4">Radar Kepemimpinan</h4>
                                                    <div className="h-[400px]">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={
                                                                (() => {
                                                                    const chartData = [];
                                                                    const categoryOrder = [
                                                                        "Work Direction - Arah Kerja",
                                                                        "Leadership - Kepemimpinan",
                                                                        "Activity - Aktivitas Kerja",
                                                                        "Social Nature - Relasi Sosial",
                                                                        "Work Style - Gaya Kerja",
                                                                        "Temperament - Sifat Temperamen",
                                                                        "Followership - Posisi Atasan-Bawahan",
                                                                    ];
                                                                    categoryOrder.forEach(cat => {
                                                                        if (r.details.categories[cat]) {
                                                                            Object.entries(r.details.categories[cat]).forEach(([code, data]) => {
                                                                                chartData.push({
                                                                                    trait: code,
                                                                                    score: data.stanine,
                                                                                    fullName: data.description?.split('—')[0]?.trim() || code,
                                                                                });
                                                                            });
                                                                        }
                                                                    });
                                                                    return chartData;
                                                                })()
                                                            }>
                                                                <PolarGrid stroke="#d1d5db" />
                                                                <PolarAngleAxis dataKey="trait" tick={{ fill: '#171717', fontSize: 11, fontWeight: 900 }} />
                                                                <PolarRadiusAxis domain={[0, 10]} tick={{ display: 'none' }} axisLine={false} />
                                                                <Radar name="Stanine" dataKey="score" stroke="#171717" strokeWidth={3} fill="#171717" fillOpacity={0.1} />
                                                                <Tooltip />
                                                            </RadarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                                <div className="w-full lg:w-1/2 space-y-4">
                                                    <div className="bg-white p-6 border-2 border-neutral-900">
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Primary Leadership Trait</span>
                                                        <span className="text-2xl font-black text-neutral-900 uppercase tracking-tighter leading-tight block">
                                                            {computePrimaryTrait(r.details) || "General Profile"}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-neutral-500 italic leading-relaxed">
                                                        Interpretasi data berdasarkan sebaran Stanine 0-9 pada 7 dimensi orientasi kerja PAPI Kostick.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Detailed Category Bars */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                                {Object.entries(r.details.categories).map(([categoryName, norms]) => (
                                                    <div key={categoryName}>
                                                        <h5 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                            <div className="w-4 h-px bg-neutral-300"></div>
                                                            {categoryName}
                                                        </h5>
                                                        <div className="space-y-4">
                                                            {Object.entries(norms).map(([normCode, normData]) => {
                                                                const stanine = normData.stanine;
                                                                let barColor = 'bg-neutral-900';
                                                                if (stanine >= 7) barColor = 'bg-success';
                                                                else if (stanine <= 3) barColor = 'bg-error';

                                                                return (
                                                                    <div key={normCode} className="space-y-1">
                                                                        <div className="flex justify-between items-end">
                                                                            <div>
                                                                                <span className="text-xs font-black text-neutral-900">{normCode}</span>
                                                                                <span className="text-[9px] text-neutral-400 font-bold uppercase ml-2 tracking-tighter">— {normData.description?.split('—')[0]?.trim()}</span>
                                                                            </div>
                                                                            <span className="font-mono text-xs font-black">{stanine}</span>
                                                                        </div>
                                                                        <div className="flex gap-0.5">
                                                                            {Array.from({ length: 9 }, (_, i) => (
                                                                                <div
                                                                                    key={i}
                                                                                    className={`h-3 flex-1 border border-neutral-100 ${i + 1 <= stanine ? barColor : 'bg-neutral-50'}`}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Memory Test Visualization */}
                                    {r.test_code === "MEM" && r.details && (
                                        <div className="space-y-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="bg-neutral-50 p-8 border-2 border-neutral-900 flex flex-col justify-center">
                                                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-4">Memory Performance Band</span>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-16 h-16 bg-neutral-900 flex items-center justify-center text-white text-3xl font-black">
                                                            {r.details.band?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h5 className="text-2xl font-black text-neutral-900 uppercase leading-none">{r.details.band}</h5>
                                                            <p className="text-[10px] font-bold text-neutral-400 mt-2 uppercase tracking-widest">Classification Index</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-neutral-50 p-6 border border-neutral-200 flex flex-col justify-center">
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 block">Accuracy</span>
                                                        <span className="text-2xl font-black text-neutral-900 font-mono">{r.details.accuracy}%</span>
                                                    </div>
                                                    <div className="bg-neutral-50 p-6 border border-neutral-200 flex flex-col justify-center">
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 block">Correct Items</span>
                                                        <span className="text-2xl font-black text-neutral-900 font-mono">{r.details.correct_count} <span className="text-neutral-300 text-sm">/ {r.details.total_answered}</span></span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-4 border-2 border-dashed border-neutral-200 text-center">
                                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Data verified via standard recall scoring protocol</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Logic & Arithmetic Visualization - WPT Standard Edition */}
                                    {r.test_code === "LOGIC" && r.details && (
                                        <div className="space-y-8">
                                            {/* Primary WPT Metrics Header */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="bg-neutral-900 text-white p-6 border-b-4 border-accent-gold">
                                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Estimated IQ</span>
                                                    <span className="text-4xl font-black font-mono">{r.details.est_iq}</span>
                                                </div>
                                                <div className="bg-neutral-50 p-6 border-2 border-neutral-900">
                                                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Percentile Rank</span>
                                                    <span className="text-4xl font-black font-mono text-neutral-900">{r.details.percentile}</span>
                                                </div>
                                                <div className="bg-neutral-50 p-6 border-2 border-neutral-900 flex flex-col justify-between">
                                                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Ability Range</span>
                                                    <span className="text-2xl font-black text-neutral-900 uppercase">{r.details.band}</span>
                                                </div>
                                            </div>

                                            {/* Detailed Interpretation Dashboard */}
                                            <div className="border-2 border-neutral-900 overflow-hidden">
                                                <div className="bg-neutral-900 text-white px-6 py-3 flex justify-between items-center">
                                                    <h4 className="text-xs font-black uppercase tracking-widest">Cognitive Classification Analysis</h4>
                                                    <span className="text-[10px] font-bold bg-accent-gold text-neutral-900 px-2 py-0.5 rounded-full">WPT Standard</span>
                                                </div>
                                                <div className="p-8 bg-white space-y-8">
                                                    <div>
                                                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-3">Classification Index</span>
                                                        <h5 className="text-2xl font-black text-neutral-900 uppercase leading-tight mb-4">{r.details.classification}</h5>
                                                        <p className="text-sm font-bold text-neutral-600 leading-relaxed border-l-4 border-neutral-200 pl-4 py-1 italic">
                                                            {r.details.description}
                                                        </p>
                                                    </div>

                                                    <div className="pt-8 border-t-2 border-dashed border-neutral-100 flex flex-col md:flex-row md:items-center gap-8">
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-3">Professional Recommendation</span>
                                                            <div className="inline-flex items-center gap-3 bg-neutral-900 text-white px-5 py-3 rounded-sm">
                                                                <svg className="w-5 h-5 text-accent-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                                </svg>
                                                                <span className="text-sm font-black uppercase tracking-wide">{r.details.recommendation}</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-neutral-50 px-6 py-4 border border-neutral-200 rounded-sm">
                                                            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Raw Precision</span>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-2xl font-black text-neutral-900 font-mono">{r.details.correct_count}</span>
                                                                <span className="text-xs font-bold text-neutral-400 uppercase">/ 50 Items</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Counterproductive Behavior - Industrial Edition */}
                                    {r.test_name === "CBI Test" && r.details && (
                                        <div className="space-y-10">
                                            {/* Top Metrics Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                                {/* Global Risk Box */}
                                                <div className="bg-neutral-50 p-8 border-2 border-neutral-900 relative">
                                                    <div className="absolute top-0 right-0 p-4 opacity-[0.05]">
                                                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                                                    </div>
                                                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-4">Overall Integrity Risk</span>
                                                    <div className="flex items-end gap-4">
                                                        <span className="text-5xl font-black text-neutral-900 leading-none font-mono tracking-tighter">{r.details.overall_concern?.score || 0}</span>
                                                        <div className="flex flex-col gap-1 pb-1">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 border-2 uppercase tracking-widest ${r.details.overall_concern?.level === 'White' ? 'bg-white text-neutral-400 border-neutral-300' :
                                                                r.details.overall_concern?.level === 'Light Blue' ? 'bg-warning-light text-warning-dark border-warning' :
                                                                    'bg-error-light text-error-dark border-error'
                                                                }`}>
                                                                {r.details.overall_concern?.level === 'White' ? 'Low Risk' : r.details.overall_concern?.level === 'Light Blue' ? 'Moderate' : 'High Risk'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="mt-6 text-xs text-neutral-500 leading-relaxed font-bold uppercase tracking-tighter italic">
                                                        {CBI_INTERPRETATION["Overall"]?.[r.details.overall_concern?.level]}
                                                    </p>
                                                </div>

                                                {/* Good Impression Box */}
                                                <div className="bg-neutral-50 p-8 border-2 border-neutral-900">
                                                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-4">Good Impression (Validity Search)</span>
                                                    <div className="flex items-center gap-6">
                                                        <span className="text-4xl font-black text-neutral-800 font-mono italic">{r.details.good_impression?.score || 0}</span>
                                                        <div className="flex flex-col">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 border uppercase tracking-widest mb-1 ${r.details.good_impression?.level === 'White' ? 'border-success text-success' :
                                                                r.details.good_impression?.level === 'Light Blue' ? 'border-warning text-warning' :
                                                                    'border-error text-error'
                                                                }`}>
                                                                {r.details.good_impression?.level === 'White' ? 'Low Risk' : r.details.good_impression?.level === 'Light Blue' ? 'Moderate' : 'High Risk'}
                                                            </span>
                                                            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter">Response Integrity Index</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-8 h-1 w-full bg-neutral-200">
                                                        <div className={`h-full ${r.details.good_impression?.level === 'White' ? 'bg-success' : r.details.good_impression?.level === 'Light Blue' ? 'bg-warning' : 'bg-error'}`} style={{ width: `${(r.details.good_impression?.score / 15) * 100}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detailed Traits Grid */}
                                            <div className="space-y-6">
                                                <h5 className="text-sm font-black text-neutral-900 uppercase tracking-widest border-b-2 border-neutral-900 pb-2 inline-block">Behavioral Concerns Matrix</h5>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {r.details.primary_concerns && Object.entries(r.details.primary_concerns).map(([trait, data]) => (
                                                        <div key={trait} className="p-5 border-2 border-neutral-900 bg-neutral-50 flex flex-col h-full">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <span className="text-xs font-black uppercase tracking-tighter leading-tight max-w-[140px]">{trait}</span>
                                                                <span className="font-mono text-lg font-black">{data.score}</span>
                                                            </div>
                                                            <div className={`text-[10px] font-black uppercase tracking-widest inline-block px-1.5 py-0.5 border ${data.level === 'White' ? 'bg-white text-neutral-900 border-neutral-200' :
                                                                data.level === 'Light Blue' ? 'bg-warning-light text-warning-dark border-warning' :
                                                                    'bg-error-light text-error-dark border-error'
                                                                }`}>
                                                                {data.level === 'White' ? 'Safe' : 'Concern'}
                                                            </div>
                                                            <p className="mt-4 text-[11px] font-bold leading-tight text-neutral-600">
                                                                {CBI_INTERPRETATION[trait]?.[data.level]}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

        </div>
    );
}

export default ParticipantProfilePage;