// client/src/CreateUser.jsx
import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { api } from './utils/api';
import Swal from 'sweetalert2';

function CreateUser({ onUserCreated, initialRole = 'participant' }) {
  const { token, isSuperadmin: currentUserRole } = useAuth();
  const [classes, setClasses] = useState([]);
  const getInitialFormData = () => ({
    username: '',
    password: '',
    full_name: '',
    gender: '',
    age: '',
    education: '',
    department: '',
    position: '',
    level: '',
    business_unit: '',
    participant_status: '',
    role: initialRole,
    class_id: '',
    assign_all_tests: false
  });
  const [formData, setFormData] = useState({
    ...getInitialFormData()
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Fetch classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.getClasses();
        setClasses(res.data);
      } catch (err) {
        // Silently fail - classes are optional
        console.error('Failed to fetch classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Determine which roles are allowed based on current user's role
  const allowedRoles = currentUserRole
    ? ['participant', 'admin', 'assessor']
    : ['participant'];

  const validateForm = () => {
    const newErrors = {};
    const trimmedUsername = formData.username.trim();
    const trimmedFullName = formData.full_name.trim();
    const trimmedPassword = formData.password;
    const parsedAge = formData.age === '' ? null : Number(formData.age);

    // Username validation
    if (!trimmedUsername) {
      newErrors.username = 'Username wajib diisi';
    } else if (trimmedUsername.length < 3) {
      newErrors.username = 'Username minimal 3 karakter';
    }

    // Password validation
    if (!trimmedPassword) {
      newErrors.password = 'Kata sandi wajib diisi';
    } else if (trimmedPassword.length < 6) {
      newErrors.password = 'Kata sandi minimal 6 karakter';
    }

    // Full name validation
    if (!trimmedFullName) {
      newErrors.full_name = 'Nama lengkap wajib diisi';
    }

    // Level validation
    if (!formData.level) {
      newErrors.level = 'Level wajib dipilih';
    }

    // Age validation
    if (formData.age !== '') {
      if (Number.isNaN(parsedAge)) {
        newErrors.age = 'Usia harus berupa angka';
      } else if (parsedAge < 1 || parsedAge > 120) {
        newErrors.age = 'Usia harus antara 1 hingga 120';
      }
    }

    if (formData.role === 'participant') {
      if (!formData.gender) newErrors.gender = 'Jenis kelamin wajib dipilih untuk peserta';
      if (parsedAge === null) newErrors.age = 'Usia wajib diisi untuk peserta';
      if (!formData.education.trim()) newErrors.education = 'Pendidikan wajib diisi untuk peserta';
      if (!formData.department) newErrors.department = 'Departemen wajib dipilih untuk peserta';
      if (!formData.position.trim()) newErrors.position = 'Jabatan wajib diisi untuk peserta';
      if (!formData.business_unit) newErrors.business_unit = 'Unit Bisnis wajib dipilih untuk peserta';
      if (!formData.participant_status) newErrors.participant_status = 'Status Peserta wajib dipilih';
      if (!formData.class_id) newErrors.class_id = 'Kelas wajib dipilih';
    }

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, newErrors };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { isValid, newErrors } = validateForm();
    if (!isValid) {
      // Scroll to first error
      const firstErrorField = Object.keys(newErrors)[0];
      if (firstErrorField) {
        document.getElementsByName(firstErrorField)[0]?.focus();
      }
      return;
    }

    setLoading(true);

    // Prepare data: convert age to null if empty, otherwise to number
    const payload = {
      username: formData.username.trim(),
      password: formData.password,
      full_name: formData.full_name.trim(),
      gender: formData.gender || null,
      age: formData.age === '' ? null : Number(formData.age),
      education: formData.education.trim() || null,
      department: formData.department || null,
      position: formData.position.trim() || null,
      business_unit: formData.business_unit || null,
      level: formData.level || null,
      participant_status: formData.role === 'participant' ? formData.participant_status : null,
      role: formData.role,
      class_id: formData.class_id || null
    };

    try {
      const res = await api.createUser(payload);

      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `${formData.role === 'admin' ? 'Admin' : (formData.role === 'assessor' ? 'Assessor' : 'Peserta')} berhasil dibuat!`,
        timer: 2000,
        showConfirmButton: false
      });

      // Reset form
      setFormData({
        ...getInitialFormData()
      });
      setErrors({});

      if (onUserCreated) onUserCreated();

      // If assign all tests is checked, do it now
      if (payload.role === 'participant' && formData.assign_all_tests && res.data.id) {
        try {
          await api.assignAllTests(res.data.id);
          Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: `Peserta berhasil dibuat dan semua tes telah ditugaskan!`,
            timer: 2500,
            showConfirmButton: false
          });
        } catch (assignErr) {
          console.error('Failed to assign all tests:', assignErr);
          Swal.fire({
            icon: 'warning',
            title: 'Peserta Dibuat',
            text: 'Peserta berhasil dibuat, tetapi gagal menugaskan semua tes secara otomatis.',
          });
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      let errorMessage = 'Failed to create user';

      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map(d => d.msg).join(', ');
      }

      Swal.fire({
        icon: 'error',
        title: 'Kesalahan!',
        text: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (fieldName) => `
    mt-1 block w-full border rounded-md shadow-sm py-2 px-3 
    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
    transition-colors duration-200
    ${errors[fieldName] ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
  `;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900">
          {formData.role === 'admin' ? 'Tambah Admin Baru' : (formData.role === 'assessor' ? 'Tambah Assessor Baru' : 'Tambah Peserta Baru')}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Isi informasi di bawah ini. Kolom bertanda * wajib diisi.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Account Info Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
            Informasi Akun
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={inputClass('username')}
                placeholder="contoh: john.doe"
                autoComplete="off"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Kata Sandi <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={inputClass('password')}
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Role dropdown – only if multiple roles allowed */}
            {allowedRoles.length > 1 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Peran <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2.5 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-neutral-50 font-semibold text-neutral-800"
                >
                  {allowedRoles.map(role => (
                    <option key={role} value={role}>
                      {role === 'participant' ? 'Peserta' : (role === 'admin' ? 'Admin (Koordinator)' : 'Assessor (Psikolog)')}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Personal Info Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
            Informasi Personal
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className={inputClass('full_name')}
                placeholder="contoh: John Doe"
              />
              {errors.full_name && (
                <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Jenis Kelamin</label>
              <select
                name="gender"
                value={formData.gender || ''}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Pilih jenis kelamin</option>
                <option value="Male">Laki-laki</option>
                <option value="Female">Perempuan</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Age</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                min="1"
                max="120"
                placeholder="contoh: 25"
                className={inputClass('age')}
              />
              {errors.age && (
                <p className="mt-1 text-sm text-red-600">{errors.age}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Pendidikan</label>
              <input
                type="text"
                name="education"
                value={formData.education}
                onChange={handleChange}
                placeholder="contoh: S1 Jurusan - Universitas"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Job/Organizational Info Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
            Informasi Pekerjaan
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Level <span className="text-red-500">*</span>
              </label>
              <select
                name="level"
                value={formData.level}
                onChange={handleChange}
                className={inputClass('level')}
              >
                <option value="">Pilih Level</option>
                <option value="Operator / Mekanik">Operator / Mekanik</option>
                <option value="Admin / Non - Staff">Admin / Non - Staff</option>
                <option value="Foreman / Officer">Foreman / Officer</option>
                <option value="Supervisor / Section Head">Supervisor / Section Head</option>
                <option value="Superintendent / Dept. Head / Management">Superintendent / Dept. Head / Management</option>
              </select>
              {errors.level && (
                <p className="mt-1 text-sm text-red-600">{errors.level}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Departemen</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-sm font-medium text-gray-700">Unit Bisnis</label>
              <select
                name="business_unit"
                value={formData.business_unit}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Pilih Unit Bisnis</option>
                <option value="PT. Long Daliq Primacoal - BP">PT. Long Daliq Primacoal - BP</option>
                <option value="PT. Long Daliq Primacoal - SPGA">PT. Long Daliq Primacoal - SPGA</option>
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

            {formData.role === 'participant' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Status Peserta <span className="text-red-500">*</span>
                </label>
                <select
                  name="participant_status"
                  value={formData.participant_status}
                  onChange={handleChange}
                  className={inputClass('participant_status')}
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
                {errors.participant_status && (
                  <p className="mt-1 text-sm text-red-600">{errors.participant_status}</p>
                )}
              </div>
            )}

            {formData.role === 'participant' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Jabatan</label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  placeholder="contoh: Manajer SDM"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {/* Class dropdown - Only for participants */}
            {formData.role === 'participant' && classes.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Kelas <span className="text-red-500">*</span>
                </label>
                <select
                  name="class_id"
                  value={formData.class_id || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Pilih kelas</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}{cls.description ? ` — ${cls.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}



            {/* Assign All Tests Checkbox - Only for participants */}
            {formData.role === 'participant' && (
              <div className="md:col-span-2 mt-2">
                <label className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-100 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                  <input
                    type="checkbox"
                    name="assign_all_tests"
                    checked={formData.assign_all_tests}
                    onChange={(e) => setFormData({ ...formData, assign_all_tests: e.target.checked })}
                    className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-bold text-blue-900">Tugaskan Semua Tes Secara Otomatis</span>
                    <p className="text-xs text-blue-700">Jika dicentang, semua tes yang tersedia akan langsung ditugaskan ke peserta ini.</p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={loading}
            className={`
              bg-gradient-to-r from-green-500 to-green-600 
              hover:from-green-600 hover:to-green-700 
              text-white font-semibold py-2.5 px-6 rounded-lg 
              shadow-md hover:shadow-lg 
              transform transition-all duration-200 
              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
              flex items-center gap-2
            `}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Membuat...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {formData.role === 'admin' ? 'Buat Admin' : (formData.role === 'assessor' ? 'Buat Assessor' : 'Tambah Peserta')}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setFormData(getInitialFormData());
              setErrors({});
            }}
            className="text-gray-600 hover:text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Bersihkan Form
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateUser;
