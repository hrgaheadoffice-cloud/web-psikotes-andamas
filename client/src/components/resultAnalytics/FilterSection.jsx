import { useState, useEffect } from 'react';
import Icon from '../../components/Icon';
import SectionTitle from './SectionTitle';
import { api } from '../../utils/api';


const filters = [
    ['Periode', 'Semua Periode'], ['Department', 'Semua Department'], ['Position', 'Semua Posisi'], ['Business Unit', 'Semua Unit'], ['Session', 'Semua Session'],
    ['Class', 'Semua Class'], ['Umur', 'Semua Usia'], ['Range Umur', 'Semua Range Umur'], ['Gender', 'Semua Gender'], ['Pendidikan', 'Semua Pendidikan'], ['Jenis Tes', 'Semua Jenis Tes'],
    ['Search Peserta', 'Cari nama atau NIK...'], ['IQ Range', 'Semua Range IQ'], ['DISC', 'Semua Profil DISC'], ['Temperament', 'Semua Temperament'], ['CBI', 'Semua Kategori CBI'],
    ['Status Peserta', 'Semua Status'], ['Status Tes', 'Semua Status'],
];


export default function FilterSection({ onApplyFilters, onExportPdf, onExportExcel, exporting, excelExporting }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [filterOptions, setFilterOptions] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedFilters, setSelectedFilters] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    
    // Calculate active filters automatically
    const activeFilters = Object.values(selectedFilters).filter(value => value !== '').length;

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                setIsLoading(true);
                const response = await api.get('/filters/options');
                setFilterOptions(response.data);
                setError(null);
            } catch (err) {
                setError(err.message);
                console.error('Error fetching filter options:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFilterOptions();
    }, []);

    const handleFilterChange = (label, value) => {
        setSelectedFilters(prev => ({
            ...prev,
            [label]: value
        }));
    };

    const parseAgeRange = (value) => {
        if (!value) return {};
        if (value.endsWith('+')) {
            const min = Number.parseInt(value, 10);
            return Number.isNaN(min) ? {} : { age_min: min };
        }
        const [min, max] = value.split('-').map((part) => Number.parseInt(part, 10));
        if (Number.isNaN(min) || Number.isNaN(max)) return {};
        return { age_min: min, age_max: max };
    };

    const handleReset = () => {
        setSelectedFilters({});
        setSearchQuery('');
        // Reset all select elements to default
        const selects = document.querySelectorAll('select');
        selects.forEach(select => select.value = '');
        // Reset input
        const searchInput = document.querySelector('input[aria-label="Search Peserta"]');
        if (searchInput) searchInput.value = '';
    };

    const handleApply = () => {
        if (onApplyFilters) {
            const filterParamMap = {
                Periode: 'periode',
                Department: 'department',
                Position: 'position',
                'Business Unit': 'business_unit',
                Session: 'session',
                Class: 'class_id',
                Umur: 'age',
                Gender: 'gender',
                Pendidikan: 'education',
                'Status Peserta': 'participant_status',
                'Jenis Tes': 'test_id',
            };

            const normalizedFilters = Object.entries(selectedFilters).reduce((params, [label, value]) => {
                const key = filterParamMap[label];
                if (key && value !== '') params[key] = value;
                return params;
            }, {});

            const ageRange = selectedFilters['Range Umur'];
            const rangeFilters = parseAgeRange(ageRange);

            onApplyFilters({
                ...normalizedFilters,
                ...rangeFilters,
                search: searchQuery
            });
        }
    };
    return (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_2px_10px_rgb(0,0,0,0.04)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <SectionTitle title="Global Filter" icon="filter" eyebrow="Refine your view" />
                    {activeFilters > 0 && (
                        <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
                            {activeFilters} Filter Aktif
                        </span>
                    )}
                </div>
                <button 
                    type="button" 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition-all hover:bg-neutral-50"
                >
                    <Icon name={isCollapsed ? "chevron-down" : "chevron-up"} className="h-4 w-4" />
                    {isCollapsed ? "Expand" : "Collapse"}
                </button>
            </div>

            {!isCollapsed && (
                <>
                    {error && (
                        <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">
                            Error: {error}
                        </div>
                    )}
                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {filters.map(([label, placeholder]) => (
                            <label key={label} className="block text-sm font-semibold text-neutral-700">
                                <span className="mb-2 block">{label}</span>
                                {label === 'Search Peserta' ? (
                                    <div className="relative">
                                        <input 
                                            aria-label={label} 
                                            className="input-field h-11 w-full bg-white pl-10 pr-3 text-sm" 
                                            placeholder={placeholder}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        <Icon name="search" className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                                    </div>
                                ) : (
                                    <select 
                                        aria-label={label} 
                                        defaultValue="" 
                                        className="input-field h-11 w-full bg-white px-3 text-sm" 
                                        disabled={isLoading}
                                        onChange={(e) => handleFilterChange(label, e.target.value)}
                                    >
                                        <option value="">{placeholder}</option>
                                        {isLoading && <option value="">Loading...</option>}
                                        {!isLoading && !error && label === 'Periode' && filterOptions.periods?.map(period => (
                                            <option key={period} value={period}>{period}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Session' && filterOptions.sessions?.map(session => (
                                            <option key={session.id} value={session.id}>{session.name}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Class' && filterOptions.classes?.map(cls => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Jenis Tes' && filterOptions.tests?.map(test => (
                                            <option key={test.id} value={test.id}>{test.name}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Department' && filterOptions.departments?.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Position' && filterOptions.positions?.map(pos => (
                                            <option key={pos} value={pos}>{pos}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Business Unit' && filterOptions.business_units?.map(bu => (
                                            <option key={bu} value={bu}>{bu}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Range Umur' && filterOptions.age_ranges?.map(range => (
                                            <option key={range} value={range}>{range}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Gender' && filterOptions.genders?.map(gender => (
                                            <option key={gender} value={gender}>{gender}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Pendidikan' && filterOptions.educations?.map(edu => (
                                            <option key={edu} value={edu}>{edu}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Status Peserta' && filterOptions.participant_statuses?.map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Umur' && filterOptions.ages?.map(age => (
                                            <option key={age} value={age}>{age}</option>
                                        ))}
                                        {!isLoading && !error && label === 'Status Peserta' && !filterOptions.participant_statuses?.length && (
                                            <option value="" disabled>Tidak ada data</option>
                                        )}
                                    </select>
                                )}
                            </label>
                        ))}
                    </div>
                    <div className="mt-5 flex flex-col justify-end gap-3 border-t border-neutral-100 pt-5 sm:flex-row">
                        <button 
                            type="button" 
                            className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm"
                            onClick={handleReset}
                        >
                            <Icon name="refresh" className="h-4 w-4" />Reset Filter
                        </button>
                        <button 
                            type="button" 
                            className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm"
                            onClick={handleApply}
                        >
                            <Icon name="filter" className="h-4 w-4" />Apply Filter
                        </button>
                        <button
                            type="button"
                            onClick={onExportPdf}
                            disabled={exporting}
                            className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2 border-primary-200 bg-primary-50 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Icon name={exporting ? 'loader' : 'download'} className={`h-4 w-4 ${exporting ? 'animate-spin' : ''}`} />
                            {exporting ? 'Exporting...' : 'Export PDF'}
                        </button>
                        <button
                            type="button"
                            onClick={onExportExcel}
                            disabled={excelExporting}
                            className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2 border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Icon name={excelExporting ? 'loader' : 'download'} className={`h-4 w-4 ${excelExporting ? 'animate-spin' : ''}`} />
                            {excelExporting ? 'Exporting...' : 'Export Excel'}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
