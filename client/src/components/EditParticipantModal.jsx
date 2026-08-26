// client/src/components/EditParticipantModal.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import Swal from 'sweetalert2';

function EditParticipantModal({ user, onClose, onSaved }) {
    const { token, isSuperadmin } = useAuth();
    const [classes, setClasses] = useState([]);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        age: '',
        education: '',
        department: '',
        position: '',
        level: '',
        business_unit: '',
        role: 'participant',
        class_id: '',
        participant_status: ''
    });
    const [loading, setLoading] = useState(false);

    // Fetch classes on mount
    useEffect(() => {
        api.getClasses().then(res => setClasses(res.data)).catch(() => { });
    }, []);

    // Populate form when user prop changes
    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username || '',
                password: '',
                full_name: user.full_name || '',
                age: user.age || '',
                education: user.education || '',
                department: user.department || '',
                position: user.position || '',
                level: user.level || '',
                business_unit: user.business_unit || '',
                role: user.role || 'participant',
                class_id: user.class_id || '',
                participant_status: user.participant_status || ''
            });
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Prepare payload: only send fields that have changed? We'll send all, backend handles optional.
        const payload = {
            ...formData,
            age: formData.age === '' ? null : Number(formData.age),
            password: formData.password || undefined,
            class_id: formData.class_id ? Number(formData.class_id) : null,
            participant_status: formData.participant_status || null,
        };

        try {
            await api.updateUser(user.id, payload);
            Swal.fire('Berhasil', 'Data peserta berhasil diperbarui', 'success');
            onSaved(); // refresh parent list
            onClose(); // close modal
        } catch (err) {
            const detail = err.response?.data?.detail;
            Swal.fire('Kesalahan', detail || 'Gagal memperbarui data peserta', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] overflow-hidden flex justify-end">
            <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div
                className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 border-l border-neutral-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Sticky */}
                <div className="flex-shrink-0 bg-gradient-to-r from-primary-700 to-primary-900 px-8 py-8 flex justify-between items-center text-white shadow-lg">
                    <div>
                        <h2 className="text-2xl font-bold font-display tracking-tight flex items-center gap-3">
                            <span className="p-2 bg-white/10 rounded-lg">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </span>
                            Edit Profil
                        </h2>
                        <p className="text-white/70 text-sm mt-1">Perbarui informasi akun dan personal</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors group">
                        <svg className="w-6 h-6 transform group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form Content - Scrollable */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                        {/* Essential Info */}
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                                <span className="w-8 h-px bg-neutral-200"></span>
                                Informasi Akun
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Username</label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Role</label>
                                    {isSuperadmin ? (
                                        <select
                                            name="role"
                                            value={formData.role}
                                            onChange={handleChange}
                                            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="participant">Peserta</option>
                                            <option value="admin">Admin (Koordinator)</option>
                                            <option value="assessor">Assessor (Psikolog)</option>
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={formData.role === 'admin' ? 'Admin' : (formData.role === 'assessor' ? 'Assessor' : 'Peserta')}
                                            className="mt-1 block w-full border border-neutral-200 bg-neutral-50 rounded-md shadow-sm py-2 px-3 text-neutral-500 cursor-not-allowed"
                                            disabled
                                        />
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Kata sandi (kosongkan jika tidak ingin mengubah)</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Personal Info */}
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                                <span className="w-8 h-px bg-neutral-200"></span>
                                Informasi Personal
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        name="full_name"
                                        value={formData.full_name}
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Usia</label>
                                    <input
                                        type="number"
                                        name="age"
                                        value={formData.age}
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Pendidikan</label>
                                    <input
                                        type="text"
                                        name="education"
                                        value={formData.education}
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Organization Info */}
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                                <span className="w-8 h-px bg-neutral-200"></span>
                                Organisasi
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Level <span className="text-red-500">*</span></label>
                                    <select
                                        name="level"
                                        value={formData.level}
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                        required
                                    >
                                        <option value="">Pilih Level</option>
                                        <option value="Operator / Mekanik">Operator / Mekanik</option>
                                        <option value="Admin / Non - Staff">Admin / Non - Staff</option>
                                        <option value="Foreman / Officer">Foreman / Officer</option>
                                        <option value="Supervisor / Section Head">Supervisor / Section Head</option>
                                        <option value="Superintendent / Dept. Head / Management">Superintendent / Dept. Head / Management</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Departemen</label>
                                    <select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="">Pilih Departemen</option>
                                        <option value="HRGA">HRGA</option>
                                        <option value="Production">Production</option>
                                        <option value="Engineering">Engineering</option>
                                        <option value="HSE">HSE</option>
                                        <option value="Legal">Legal</option>
                                        <option value="FAT">FAT</option>
                                        <option value="CSR">CSR</option>
                                        <option value="Plant">Plant</option>
                                        <option value="SCM">SCM</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Unit Bisnis</label>
                                    <select
                                        name="business_unit"
                                        value={formData.business_unit}
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="">Pilih Unit Bisnis</option>
                                        <option value="PT. Long Daliq Primacoal - Site BP">PT. Long Daliq Primacoal - Site BP</option>
                                        <option value="PT. Long Daliq Primacoal - Site SPGA">PT. Long Daliq Primacoal - Site SPGA</option>
                                        <option value="PT. Long Daliq Primacoal - Head Office">PT. Long Daliq Primacoal - Head Office</option>
                                        <option value="PT. Muncul Kilau Persada">PT. Muncul Kilau Persada</option>
                                        <option value="PT. Batubara Lahat">PT. Batubara Lahat</option>
                                        <option value="PT. Batubara Lahat - Head Office">PT. Batubara Lahat - Head Office</option>
                                        <option value="PT. Andamas Global Energi">PT. Andamas Global Energi</option>
                                        <option value="PT. Andamas Global Energi - Head Office">PT. Andamas Global Energi - Head Office</option>
                                        <option value="PT. Long Daliq Logistik">PT. Long Daliq Logistik</option>
                                        <option value="PT. Andamas Propertindo">PT. Andamas Propertindo</option>
                                        <option value="PT. Bukit Artha Persada Arsy Nusantara - Site">PT. Bukit Artha Persada Arsy Nusantara - Site</option>
                                        <option value="PT. Bukit Artha Persada Arsy Nusantara - Head Office">PT. Bukit Artha Persada Arsy Nusantara - Head Office</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Jabatan</label>
                                    <input
                                        type="text"
                                        name="position"
                                        value={formData.position}
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                {formData.role === 'participant' && (
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Status Peserta</label>
                                        <select
                                            name="participant_status"
                                            value={formData.participant_status}
                                            onChange={handleChange}
                                            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="">Pilih Status Peserta</option>
                                            <option value="Recruitment Process">Recruitment Process</option>
                                            <option value="Promotion Process">Promotion Process</option>
                                            <option value="Development Process">Development Process</option>
                                            <option value="Mutasi / Rotasi Internal">Mutasi / Rotasi Internal</option>
                                            <option value="Job Fit Re-Assessment">Job Fit Re-Assessment</option>
                                            <option value="Talent Mapping">Talent Mapping</option>
                                            <option value="Internship Assessment">Internship Assessment</option>
                                            <option value="Re-Test / Validating Check">Re-Test / Validating Check</option>
                                        </select>
                                    </div>
                                )}
                                {classes.length > 0 && (
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Kelas</label>
                                        <select
                                            name="class_id"
                                            value={formData.class_id}
                                            onChange={handleChange}
                                            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="">— Tidak ada —</option>
                                            {classes.map(cls => (
                                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer - Sticky */}
                    <div className="flex-shrink-0 flex justify-end gap-3 p-8 border-t bg-neutral-50/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 text-sm font-bold text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-10 py-3 bg-primary-700 hover:bg-primary-800 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-primary-700/20 transition-all transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:transform-none"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Menyimpan...</span>
                                </div>
                            ) : 'Simpan Perubahan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

export default EditParticipantModal;