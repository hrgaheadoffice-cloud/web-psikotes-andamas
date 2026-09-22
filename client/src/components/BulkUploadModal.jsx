// client/src/components/BulkUploadModal.jsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import apiClient from '../utils/api';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import Swal from 'sweetalert2';

const BULK_COLUMNS = [
    'username', 'password', 'full_name', 'age', 'gender', 'education',
    'department', 'position', 'level', 'unit_bisnis', 'participant_status', 'class'
];
const VALID_GENDERS = ['Male', 'Female'];
const VALID_DEPARTMENTS = ['HRGA', 'Production', 'Engineering', 'HSE', 'Legal', 'FAT', 'CSR', 'Plant', 'SCM'];
const VALID_LEVELS = [
    'Operator / Mekanik', 'Admin / Non - Staff', 'Foreman / Officer',
    'Supervisor / Section Head', 'Superintendent / Dept. Head / Management'
];
const VALID_BUSINESS_UNITS = [
    'PT. Long Daliq Primacoal - BP', 'PT. Long Daliq Primacoal - SPGA',
    'PT. Long Daliq Primacoal - Head Office', 'PT. Muncul Kilau Persada',
    'PT. Batubara Lahat', 'PT. Batubara Lahat - Head Office',
    'PT. Andamas Global Energi', 'PT. Andamas Global Energi - Head Office',
    'PT. Long Daliq Logistik', 'PT. Andamas Propertindo',
    'PT. Bukit Artha Persada Arsy Nusantara - Site',
    'PT. Bukit Artha Persada Arsy Nusantara - Head Office'
];
const VALID_PARTICIPANT_STATUSES = [
    'Recruitment Process', 'Promotion Process', 'Development Process',
    'Mutasi / Rotasi Internal', 'Job Fit Re-Assessment', 'Talent Mapping',
    'Internship Assessment', 'Re-Test / Validating Check'
];

const matchesChoice = (value, choices) => choices.some(choice => choice.toLowerCase() === value.toLowerCase());

function BulkUploadModal({ onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [assignAll, setAssignAll] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const fileInputRef = useRef();

    const [classes, setClasses] = useState([]);

    // Prevent body scrolling while modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        
        // Fetch classes to show valid options in instructions
        const fetchClasses = async () => {
            try {
                const res = await apiClient.get('/users/classes');
                setClasses(res.data);
            } catch (err) {
                console.error('Failed to fetch classes:', err);
            }
        };
        fetchClasses();

        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const validateRows = (headers, rows) => {
        const errors = [];
        const missingHeaders = BULK_COLUMNS.filter(column => !headers.includes(column));
        if (missingHeaders.length > 0) {
            return [`Header wajib tidak lengkap. Kolom yang hilang: ${missingHeaders.join(', ')}`];
        }

        rows.forEach((row, index) => {
            const rowNumber = index + 2;
            const missing = BULK_COLUMNS.filter(column => !String(row[column] ?? '').trim());
            if (missing.length > 0) {
                errors.push(`Baris ${rowNumber}: Kolom kosong: ${missing.join(', ')}`);
                return;
            }

            const age = Number(row.age);
            if (!Number.isInteger(age) || age < 17 || age > 80) {
                errors.push(`Baris ${rowNumber}: Usia harus berupa angka bulat 17-80.`);
            }
            if (!matchesChoice(String(row.gender).trim(), VALID_GENDERS)) errors.push(`Baris ${rowNumber}: Gender tidak valid.`);
            if (!matchesChoice(String(row.department).trim(), VALID_DEPARTMENTS)) errors.push(`Baris ${rowNumber}: Department tidak valid.`);
            if (!matchesChoice(String(row.level).trim(), VALID_LEVELS)) errors.push(`Baris ${rowNumber}: Level tidak valid.`);
            if (!matchesChoice(String(row.unit_bisnis).trim(), VALID_BUSINESS_UNITS)) errors.push(`Baris ${rowNumber}: Unit Bisnis tidak valid.`);
            if (!matchesChoice(String(row.participant_status).trim(), VALID_PARTICIPANT_STATUSES)) errors.push(`Baris ${rowNumber}: Status Peserta tidak valid.`);
        });
        return errors;
    };

    const applyParsedRows = (headers, rows) => {
        const normalizedHeaders = headers.map(header => String(header).trim());
        const normalizedRows = rows.map(row => {
            const normalized = {};
            BULK_COLUMNS.forEach(column => { normalized[column] = String(row[column] ?? ''); });
            return normalized;
        });
        const errors = validateRows(normalizedHeaders, normalizedRows);
        setValidationErrors(errors);
        setPreviewData(normalizedRows.slice(0, 5));
        if (errors.length > 0) {
            Swal.fire('Validasi gagal', errors.slice(0, 10).join('<br>'), 'error');
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        setPreviewData([]); // Clear old preview
        setValidationErrors([]);

        const fileExt = selectedFile.name.split('.').pop().toLowerCase();

        if (fileExt === 'csv') {
            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (result) => applyParsedRows(result.meta.fields || [], result.data),
                error: (err) => Swal.fire('Kesalahan', 'Gagal memproses CSV: ' + err.message, 'error')
            });
        } else if (['xlsx', 'xls'].includes(fileExt)) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                try {
                    const data = new Uint8Array(loadEvent.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheet];
                    // Convert sheet to array of arrays, preserving empty cells
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                    if (jsonData.length === 0) {
                        Swal.fire('Kesalahan', 'File Excel kosong.', 'error');
                        return;
                    }
                    const headers = jsonData[0];
                    // Take up to 5 data rows for preview
                    const parsedRows = jsonData.slice(1).map(row => {
                        const obj = {};
                        headers.forEach((header, idx) => {
                            obj[header] = row[idx] !== undefined ? String(row[idx]) : '';
                        });
                        return obj;
                    });
                    applyParsedRows(headers, parsedRows);
                } catch (err) {
                    Swal.fire('Kesalahan', 'Gagal memproses file Excel: ' + err.message, 'error');
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        } else {
            Swal.fire('Kesalahan', 'Jenis file tidak didukung. Harap unggah CSV atau Excel.', 'error');
            setFile(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            Swal.fire('Kesalahan', 'Harap pilih file.', 'error');
            return;
        }
        if (validationErrors.length > 0) {
            Swal.fire('Kesalahan', validationErrors.slice(0, 10).join('<br>'), 'error');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assign_all', assignAll.toString());

        try {
            const res = await apiClient.post('/admin/users/bulk', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResults(res.data);
            if (res.data.failed === 0) {
                Swal.fire('Berhasil', `${res.data.success} peserta berhasil dibuat.`, 'success');
            } else {
                Swal.fire('Sebagian Berhasil', `${res.data.success} dibuat, ${res.data.failed} gagal.`, 'warning');
            }
            onSuccess(); // Let parent know to refresh
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail || 'Gagal mengunggah.';
            Swal.fire('Kesalahan', detail, 'error');
        } finally {
            setUploading(false);
        }
    };

    const downloadTemplate = () => {
        // Create sample data
        // Create sample data based on current classifications
        const exampleClass = classes.length > 0 ? classes[0].name : 'HO Staff';
        const wsData = [
            BULK_COLUMNS,
            ['johndoe', 'pass123', 'John Doe', '30', 'Male', 'S1', 'HRGA', 'Manager', 'Supervisor / Section Head', 'PT. Long Daliq Primacoal - BP', 'Recruitment Process', exampleClass],
            ['janedoe', 'pass456', 'Jane Doe', '28', 'Female', 'S2', 'Production', 'Staff', 'Admin / Non - Staff', 'PT. Muncul Kilau Persada', 'Promotion Process', classes.length > 1 ? classes[1].name : 'Site Operator']
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, 'participant_template.xlsx');
    };

    const modalContent = (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center z-[9999] pt-10 px-4 pb-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Unggah Peserta Massal</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {!results ? (
                        <>
                            <p className="text-sm text-gray-600 mb-4">Upload file CSV atau Excel dengan urutan 12 kolom berikut. SELURUH kolom pada setiap baris wajib diisi.</p>
                            <div className="mb-6 overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-gray-300 px-3 py-2">username *</th>
                                            <th className="border border-gray-300 px-3 py-2">password *</th>
                                            <th className="border border-gray-300 px-3 py-2">full_name *</th>
                                            <th className="border border-gray-300 px-3 py-2">age *</th>
                                            <th className="border border-gray-300 px-3 py-2">gender *</th>
                                            <th className="border border-gray-300 px-3 py-2">education *</th>
                                            <th className="border border-gray-300 px-3 py-2">department *</th>
                                            <th className="border border-gray-300 px-3 py-2">position *</th>
                                            <th className="border border-gray-300 px-3 py-2">level *</th>
                                            <th className="border border-gray-300 px-3 py-2">unit_bisnis *</th>
                                            <th className="border border-gray-300 px-3 py-2">participant_status *</th>
                                            <th className="border border-gray-300 px-3 py-2">class *</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border border-gray-300 px-3 py-2">johndoe</td>
                                            <td className="border border-gray-300 px-3 py-2">pass123</td>
                                            <td className="border border-gray-300 px-3 py-2">John Doe</td>
                                            <td className="border border-gray-300 px-3 py-2">30</td>
                                            <td className="border border-gray-300 px-3 py-2">Male</td>
                                            <td className="border border-gray-300 px-3 py-2">S1</td>
                                            <td className="border border-gray-300 px-3 py-2">HRGA</td>
                                            <td className="border border-gray-300 px-3 py-2">Manager</td>
                                            <td className="border border-gray-300 px-3 py-2">Supervisor / Section Head</td>
                                            <td className="border border-gray-300 px-3 py-2">PT. Long Daliq Primacoal - BP</td>
                                            <td className="border border-gray-300 px-3 py-2">Recruitment Process</td>
                                            <td className="border border-gray-300 px-3 py-2">HO Staff</td>
                                        </tr>
                                        <tr className="bg-gray-50">
                                            <td className="border border-gray-300 px-3 py-2">janedoe</td>
                                            <td className="border border-gray-300 px-3 py-2">pass456</td>
                                            <td className="border border-gray-300 px-3 py-2">Jane Doe</td>
                                            <td className="border border-gray-300 px-3 py-2">28</td>
                                            <td className="border border-gray-300 px-3 py-2">Female</td>
                                            <td className="border border-gray-300 px-3 py-2">S2</td>
                                            <td className="border border-gray-300 px-3 py-2">Production</td>
                                            <td className="border border-gray-300 px-3 py-2">Staff</td>
                                            <td className="border border-gray-300 px-3 py-2">Admin / Non - Staff</td>
                                            <td className="border border-gray-300 px-3 py-2">PT. Muncul Kilau Persada</td>
                                            <td className="border border-gray-300 px-3 py-2">Promotion Process</td>
                                            <td className="border border-gray-300 px-3 py-2">Site Operator</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <p className="text-xs text-info-600 mt-1 font-medium bg-info-50 p-2 rounded border border-info-200">
                                    <strong>Semua kolom wajib diisi.</strong> Gunakan nilai yang sesuai persis dengan daftar berikut:<br/>
                                    <strong>Gender:</strong> Male, Female<br/>
                                    <strong>Department:</strong> {VALID_DEPARTMENTS.join(', ')}<br/>
                                    <strong>Level:</strong> {VALID_LEVELS.join(', ')}<br/>
                                    <strong>Unit Bisnis:</strong> {VALID_BUSINESS_UNITS.join(', ')}<br/>
                                    <strong>Status Peserta:</strong> {VALID_PARTICIPANT_STATUSES.join(', ')}<br/>
                                    <strong>Klasifikasi/Class aktif:</strong> {classes.length > 0 ? classes.map(c => c.name).join(', ') : 'Memuat daftar kelas...'}
                                </p>
                            </div>

                            <div className="flex justify-between items-center mb-6">
                                <button
                                    onClick={downloadTemplate}
                                    className="text-blue-500 hover:text-blue-700 text-sm font-medium inline-flex items-center"
                                >
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Unduh template (Excel)
                                </button>
                            </div>

                            {/* File Drop Area */}
                            <div
                                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                                onClick={() => fileInputRef.current.click()}
                            >
                                <input
                                    type="file"
                                    accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                    onChange={handleFileChange}
                                    ref={fileInputRef}
                                    className="hidden"
                                />
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-600">
                                    {file ? file.name : 'Klik untuk pilih file CSV atau Excel'}
                                </p>
                            </div>

                            {/* Preview */}
                            {previewData.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="font-semibold mb-2">Preview (5 baris pertama):</h3>
                                    <div className="overflow-x-auto border rounded">
                                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    {Object.keys(previewData[0] || {}).map(key => (
                                                        <th key={key} className="px-3 py-2 text-left font-medium text-gray-700">
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {previewData.map((row, idx) => (
                                                    <tr key={idx}>
                                                        {Object.values(row).map((val, i) => (
                                                            <td key={i} className="px-3 py-2 text-gray-600">{val}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {validationErrors.length > 0 && (
                                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                    <p className="font-semibold">File belum dapat diunggah:</p>
                                    <ul className="mt-1 list-disc list-inside space-y-1">
                                        {validationErrors.slice(0, 10).map((error, index) => <li key={index}>{error}</li>)}
                                    </ul>
                                    {validationErrors.length > 10 && <p className="mt-1">Dan {validationErrors.length - 10} kesalahan lainnya.</p>}
                                </div>
                            )}

                            {/* Assign all checkbox */}
                            <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                                <input
                                    type="checkbox"
                                    checked={assignAll}
                                    onChange={(e) => setAssignAll(e.target.checked)}
                                    className="form-checkbox h-5 w-5 text-blue-600 rounded"
                                />
                                <span className="text-sm text-gray-700">Tugaskan semua tes ke setiap peserta baru</span>
                            </label>
                        </>
                    ) : (
                        // Results display
                        <div>
                            <h3 className="font-bold text-lg mb-2">Hasil Upload</h3>
                            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                <p>Total baris: {results.total}</p>
                                <p className="text-green-600 font-medium">Berhasil: {results.success}</p>
                                <p className="text-red-600 font-medium">Gagal: {results.failed}</p>
                            </div>
                            {results.errors?.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="font-semibold mb-2">Kesalahan:</h4>
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                                        <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                                            {results.errors.map((err, idx) => (
                                                <li key={idx}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                    >
                        Batal
                    </button>
                    {!results ? (
                        <button
                            onClick={handleUpload}
                            disabled={uploading || !file || validationErrors.length > 0}
                            className={`px-4 py-2 text-white rounded-lg transition ${uploading || !file
                                    ? 'bg-blue-300 cursor-not-allowed'
                                    : 'bg-blue-500 hover:bg-blue-600'
                                }`}
                        >
                            {uploading ? 'Mengunggah...' : validationErrors.length > 0 ? 'Perbaiki file terlebih dahulu' : 'Unggah'}
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setResults(null);
                                setFile(null);
                                setPreviewData([]);
                                onSuccess();
                                onClose();
                            }}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                        >
                            Selesai
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    // Render via portal to avoid layout issues
    if (typeof document !== 'undefined' && document.getElementById('root')) {
        return ReactDOM.createPortal(modalContent, document.getElementById('root'));
    }
    return modalContent;
}

export default BulkUploadModal;
