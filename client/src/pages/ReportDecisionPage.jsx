import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import Swal from 'sweetalert2';

// Final Recommendation Logic Mapping
const RECOMMENDATION_LOGIC = {
    "Operator / Mekanik": {
        must: ["SPEED", "CBI", "IQ"],
        supporting: ["LOGIC", "MEM", "DISC"],
        minSupporting: 1
    },
    "Admin / Non - Staff": {
        must: ["CBI", "IQ", "LOGIC", "TEMP"],
        supporting: ["DISC", "MEM", "SPEED"],
        minSupporting: 1
    },
    "Foreman / Officer": {
        must: ["CBI", "IQ", "DISC", "SPEED"],
        supporting: ["TEMP", "LOGIC", "MEM"],
        minSupporting: 1
    },
    "Supervisor / Section Head": {
        must: ["CBI", "IQ", "DISC", "TEMP", "LEAD"],
        supporting: ["LOGIC", "MEM", "SPEED"],
        minSupporting: 2
    },
    "Superintendent / Dept. Head / Management": {
        must: ["CBI", "IQ", "DISC", "TEMP", "LEAD", "SPEED"],
        supporting: ["LOGIC", "MEM"],
        minSupporting: 1
    },
    "Superintendent / Dept Head": {
        must: ["CBI", "IQ", "DISC", "TEMP", "LEAD", "SPEED"],
        supporting: ["LOGIC", "MEM"],
        minSupporting: 1
    }
};

function ReportDecisionPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [decisions, setDecisions] = useState({});
    const [finalStatus, setFinalStatus] = useState('DIPERTIMBANGKAN');
    const [isManualOverride, setIsManualOverride] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                setLoading(true);
                const res = await api.getParticipantSummary(id);
                setData(res.data);

                // Initialize decisions from existing data or defaults
                const existing = res.data.existing_decisions?.test_decisions || {};
                const initialDecisions = {};
                res.data.summary.forEach(item => {
                    // Map backend status (SESUAI, AMAN, UNGGUL) to LANJUT
                    // Map backend status (TIDAK SESUAI, RISIKO) to TIDAK LANJUT
                    let defStatus = 'LANJUT';
                    const backendStatus = (item.default_status || '').toUpperCase();
                    if (backendStatus === 'TIDAK SESUAI' || backendStatus === 'RISIKO') {
                        defStatus = 'TIDAK LANJUT';
                    }

                    // Get existing and normalize to uppercase
                    const existingStatus = existing[item.code]?.status?.toUpperCase();
                    const existingRec = existing[item.code]?.recommendation?.toUpperCase();

                    initialDecisions[item.code] = {
                        status: existingStatus || defStatus,
                        recommendation: existingRec || 'LULUS'
                    };
                });
                setDecisions(initialDecisions);

                // Initialize final status from database if it exists
                if (res.data.existing_decisions?.final_status) {
                    setFinalStatus(res.data.existing_decisions.final_status);
                    setIsManualOverride(true);
                }
            } catch (err) {
                console.error('Error fetching summary:', err);
                Swal.fire('Kesalahan', 'Gagal memuat ringkasan hasil.', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [id]);

    const handleDecisionChange = (code, field, value) => {
        setDecisions(prev => ({
            ...prev,
            [code]: {
                ...prev[code],
                [field]: value
            }
        }));
    };

    // Calculate system suggestion based on final recommendation counts
    const calculateSystemSuggestion = useCallback(() => {
        const recommendations = Object.values(decisions || {}).map(item => item?.recommendation);
        const notLulusCount = recommendations.filter(value => value === 'TIDAK LULUS').length;
        const dipertimbangkanCount = recommendations.filter(value => value === 'DIPERTIMBANGKAN').length;

        if (notLulusCount >= 2) {
            return 'TIDAK DISARANKAN';
        }

        if (dipertimbangkanCount >= 2) {
            return 'DIPERTIMBANGKAN';
        }

        return 'DIREKOMENDASIKAN';
    }, [decisions]);

    // Sync final status with suggestion if not overridden
    useEffect(() => {
        if (!isManualOverride && data) {
            setFinalStatus(calculateSystemSuggestion());
        }
    }, [calculateSystemSuggestion, data, isManualOverride]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                report_decisions: {
                    test_decisions: decisions,
                    final_status: finalStatus,
                    updated_at: new Date().toISOString()
                }
            };
            await api.updateUser(id, payload);
            await Swal.fire({
                title: 'Berhasil!',
                text: 'Keputusan laporan telah disimpan.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            navigate(`/participants/${id}`);
        } catch (err) {
            console.error('Error saving decisions:', err);
            Swal.fire('Kesalahan', 'Gagal menyimpan keputusan.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">Menyusun Ringkasan...</p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto font-sans animate-fade-in pb-20">
            {/* Floating Header Container */}
            <div className="sticky top-0 z-30 space-y-4 bg-neutral-50/90 backdrop-blur-md pt-1 pb-4 -mx-4 px-4 md:-mx-6 md:px-6">
                {/* Page Header (Simplified) */}
                <div className="bg-white shadow rounded-lg border border-gray-200">
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
                                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate tracking-tight">Keputusan Laporan Akhir</h1>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Industrial Profile Header (Consistent with Profile Page) */}
                <div className="bg-white border-2 border-neutral-900 rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden">
                    <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-neutral-900">
                        {/* Primary Identity Section */}
                        <div className="flex-1 p-6 md:p-8 bg-neutral-50">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-1 block">Profil Peserta</span>
                                    <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight leading-none group flex items-baseline gap-3">
                                        {data.full_name}
                                        <span className="text-sm font-mono text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 uppercase">
                                            ID-{data.user_id?.toString().padStart(4, '0')}
                                        </span>
                                    </h2>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Jabatan</span>
                                    <span className="text-sm font-semibold text-neutral-800 uppercase">{data.position || 'N/A'}</span>
                                </div>
                                <div className="w-px h-8 bg-neutral-200 hidden md:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Departemen</span>
                                    <span className="text-sm font-semibold text-neutral-800 uppercase">{data.department || 'N/A'}</span>
                                </div>
                                <div className="w-px h-8 bg-neutral-200 hidden md:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Unit Bisnis</span>
                                    <span className="text-sm font-semibold text-neutral-800 uppercase">{data.business_unit || 'N/A'}</span>
                                </div>
                                <div className="w-px h-8 bg-neutral-200 hidden md:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Level</span>
                                    <span className="text-sm font-bold text-indigo-600 uppercase tracking-tighter">{data.level || 'N/A'}</span>
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
                                    {data.class_name || 'Standard'}
                                </h4>
                                <div className="mt-4 h-1 w-12 bg-accent-gold"></div>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Specs Grid */}
                    <div className="bg-white border-t-2 border-neutral-900 p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Username</label>
                            <p className="font-mono text-sm font-bold text-neutral-700 select-all">@{data.username}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Jenis Kelamin</label>
                            <p className="text-sm font-bold text-neutral-900 uppercase">
                                {data.gender === 'Male' ? 'LAKI-LAKI' : (data.gender === 'Female' ? 'PEREMPUAN' : (data.gender || '–'))}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Usia</label>
                            <p className="text-sm font-bold text-neutral-900">{data.age ? `${data.age} Tahun` : '–'}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Pendidikan Terakhir</label>
                            <p className="text-sm font-bold text-neutral-900 uppercase">{data.education || '–'}</p>
                        </div>
                        <div className="space-y-1 md:col-span-4">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Status Peserta</label>
                            <p className="font-semibold text-sm text-neutral-700">{data.participant_status || '–'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Warning Box */}
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 flex items-start gap-4 rounded-r-lg">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-800 font-medium">
                    Tentukan status dan rekomendasi untuk setiap tes di bawah ini.
                </p>
            </div>

            {/* Decision Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                                <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-center w-12">No</th>
                                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest w-48">Nama Tes</th>
                                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest w-48 text-center">Status Tes</th>
                                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest w-64">Hasil</th>
                                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest w-48 text-center">Rekomendasi Internal Asesor</th>
                                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest w-48 text-center">Opsi Kelulusan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.summary.map((item, idx) => (
                                <tr key={item.code} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-6 text-center font-mono text-sm font-bold text-gray-400">{idx + 1}</td>
                                    <td className="px-6 py-6 font-bold text-gray-900 tracking-tight text-sm uppercase">{item.name}</td>
                                    <td className="px-6 py-6">
                                        <div className="flex justify-center">
                                            {item.assignment_status === 'completed' ? (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black rounded-full border border-green-200 uppercase tracking-widest">Selesai</span>
                                            ) : item.assignment_status === 'in_progress' ? (
                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-black rounded-full border border-yellow-200 uppercase tracking-widest animate-pulse">Proses</span>
                                            ) : item.assignment_status === 'locked' ? (
                                                <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black rounded-full border border-red-200 uppercase tracking-widest">Terkunci</span>
                                            ) : item.assignment_status === 'not_assigned' ? (
                                                <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-full border border-gray-200 uppercase tracking-widest opacity-50">N/A</span>
                                            ) : (
                                                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-[10px] font-black rounded-full border border-gray-200 uppercase tracking-widest">Pending</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-sm font-medium text-gray-600 leading-snug">{item.hasil}</td>
                                    <td className="px-6 py-6">
                                        <div className="relative group">
                                            <select
                                                value={decisions[item.code]?.status}
                                                onChange={(e) => handleDecisionChange(item.code, 'status', e.target.value)}
                                                className={`w-full appearance-none px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${decisions[item.code]?.status === 'LANJUT'
                                                    ? 'bg-green-50 border border-green-200 text-green-700 focus:ring-green-500'
                                                    : 'bg-red-50 border border-red-200 text-red-700 focus:ring-red-500'
                                                    }`}
                                            >
                                                <option value="LANJUT">LANJUT</option>
                                                <option value="TIDAK LANJUT">TIDAK LANJUT</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-current">
                                                <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="relative">
                                            <select
                                                value={decisions[item.code]?.recommendation}
                                                onChange={(e) => handleDecisionChange(item.code, 'recommendation', e.target.value)}
                                                className={`w-full appearance-none px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${decisions[item.code]?.recommendation === 'LULUS'
                                                    ? 'bg-blue-50 border border-blue-200 text-blue-700 focus:ring-blue-500'
                                                    : 'bg-red-50 border border-red-200 text-red-700 focus:ring-red-500'
                                                    }`}
                                            >
                                                <option value="LULUS">LULUS</option>
                                                <option value="TIDAK LULUS">TIDAK LULUS</option>
                                                <option value="DIPERTIMBANGKAN">DIPERTIMBANGKAN</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-current">
                                                <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Final Recommendation Engine & Action Bar */}
            <div className="mt-8 bg-white border-2 border-neutral-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] relative">
                <div className="flex flex-col lg:flex-row items-stretch">
                    {/* System Suggestion Section */}
                    <div className="flex-1 p-6 bg-neutral-50 flex flex-col justify-center border-b lg:border-b-0 lg:border-r-2 border-neutral-900">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 mb-2">Saran Sistem</span>
                        <div className="flex items-center gap-4">
                            <div className={`px-4 py-2 rounded-sm font-black text-sm uppercase tracking-widest border-2 ${
                                data.summary.some(i => i.assignment_status !== 'completed' && i.assignment_status !== 'not_assigned') ? 'bg-gray-200 border-gray-400 text-gray-500' :
                                calculateSystemSuggestion() === 'DIREKOMENDASIKAN' ? 'bg-green-100 border-green-600 text-green-700' :
                                calculateSystemSuggestion() === 'DIPERTIMBANGKAN' ? 'bg-yellow-100 border-yellow-600 text-yellow-700' :
                                'bg-red-100 border-red-600 text-red-700'
                            }`}>
                                {data.summary.some(i => i.assignment_status !== 'completed' && i.assignment_status !== 'not_assigned') ? 'BELUM LENGKAP' : calculateSystemSuggestion()}
                            </div>
                            <p className="text-[10px] font-bold text-neutral-500 max-w-[200px] leading-tight">
                                {data.summary.some(i => i.assignment_status !== 'completed' && i.assignment_status !== 'not_assigned')
                                    ? 'Saran tidak dapat dihitung karena ada tes yang belum selesai.'
                                    : calculateSystemSuggestion() === 'TIDAK DISARANKAN'
                                        ? 'Terdapat 2 atau lebih rekomendasi "TIDAK LULUS".'
                                        : calculateSystemSuggestion() === 'DIPERTIMBANGKAN'
                                            ? 'Terdapat 2 atau lebih rekomendasi "DIPERTIMBANGKAN".'
                                            : 'Tidak ada dua rekomendasi "TIDAK LULUS" maupun dua rekomendasi "DIPERTIMBANGKAN".'}
                            </p>
                        </div>
                    </div>

                    {/* Final Decision Selector */}
                    <div className="w-full lg:w-96 p-6 flex flex-col justify-center bg-white border-b lg:border-b-0 lg:border-r-2 border-neutral-900">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 mb-2">Keputusan Akhir</span>
                        <div className="relative">
                            <select
                                value={finalStatus}
                                onChange={(e) => {
                                    setFinalStatus(e.target.value);
                                    setIsManualOverride(true);
                                }}
                                className={`w-full appearance-none px-4 py-3 rounded-none border-2 border-neutral-900 font-black text-sm uppercase tracking-widest cursor-pointer transition-all focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                                    finalStatus === 'DIREKOMENDASIKAN' ? 'text-green-700' :
                                    finalStatus === 'DIPERTIMBANGKAN' ? 'text-yellow-700' :
                                    'text-red-700'
                                }`}
                            >
                                <option value="DIREKOMENDASIKAN">DIREKOMENDASIKAN</option>
                                <option value="DIPERTIMBANGKAN">DIPERTIMBANGKAN</option>
                                <option value="TIDAK DISARANKAN">TIDAK DISARANKAN</option>
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-neutral-900">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                        {isManualOverride && (
                            <button 
                                onClick={() => setIsManualOverride(false)}
                                className="mt-2 text-[9px] font-bold text-blue-600 uppercase tracking-widest hover:underline text-left"
                            >
                                ↺ Reset ke saran sistem
                            </button>
                        )}
                    </div>

                    {/* Save Button */}
                    <div className="p-6 flex items-center justify-center bg-neutral-900 lg:w-80">
                        <div className="w-full relative group">
                            {data.summary.some(i => i.assignment_status !== 'completed' && i.assignment_status !== 'not_assigned') && (
                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] z-50 flex items-center gap-2 border border-red-700">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span>DATA BELUM LENGKAP - PESERTA BELUM SELESAI</span>
                                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-600 rotate-45 border-r border-b border-red-700"></div>
                                </div>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving || data.summary.some(i => i.assignment_status !== 'completed' && i.assignment_status !== 'not_assigned')}
                                className={`w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-neutral-100 text-neutral-900 font-black rounded-none transition-all active:scale-[0.98] ${
                                    (saving || data.summary.some(i => i.assignment_status !== 'completed' && i.assignment_status !== 'not_assigned')) ? 'opacity-40 cursor-not-allowed grayscale' : ''
                                }`}
                            >
                                <span className="uppercase tracking-[0.2em] text-xs">{saving ? 'Menyimpan...' : 'Simpan Keputusan'}</span>
                                {!saving && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ReportDecisionPage;
