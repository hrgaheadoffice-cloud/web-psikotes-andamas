import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import ParticipantsPage from './pages/ParticipantsPage';
import ResultsPage from './pages/ResultsPage';
import ResultAnalyticsPage from './pages/ResultAnalyticsPage';
import AddParticipantPage from './pages/AddParticipantPage';
import AddAdminPage from './pages/AddAdminPage';
import ParticipantProfilePage from './pages/ParticipantProfilePage';
import SecurityDashboard from './pages/SecurityDashboard';
import ManageAdmins from './pages/ManageAdmins';
import Dashboard from './pages/Dashboard';
import ReportDecisionPage from './pages/ReportDecisionPage';
import LiveMonitor from './pages/LiveMonitor';
import SchedulePage from './pages/SchedulePage';

function AdminLayout({ onLogout }) {
    const { user, isAdmin, isSuperadmin, canSeeResults } = useAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Redirect /dashboard to / for admin users
    if (location.pathname === '/dashboard') {
        return <Navigate to="/" replace />;
    }

    const navLinks = [
        { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { to: '/participants', label: 'Peserta', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    ];

    if (canSeeResults) {
        navLinks.push(
            { to: '/results', label: 'Hasil', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { to: '/result-analytics', label: 'Result Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }
        );
    }

    if (canSeeResults || isAdmin) {
        navLinks.push(
            { to: '/security', label: 'Keamanan', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' }
        );
    }

    if (isSuperadmin || isAdmin) {
        navLinks.push(
            { to: '/schedule', label: 'Penjadwalan', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { to: '/live-monitor', label: 'Live Monitor', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }
        );
    }

    if (isSuperadmin) {
        navLinks.push(
            { to: '/admins', label: 'Admin', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }
        );
    }

    const getPageTitle = (pathname) => {
        if (pathname === '/') return 'Dashboard';
        if (pathname === '/live-monitor') return 'Live Monitor';
        if (pathname === '/schedule') return 'Penjadwalan Tes';
        if (pathname.startsWith('/participants')) return 'Kelola Peserta';
        if (pathname === '/admins') return 'Kelola Admin';
        if (pathname === '/results') return 'Hasil Tes';
        if (pathname === '/result-analytics') return 'Result Analytics';
        if (pathname === '/security') return 'Dashboard Keamanan';
        return 'Panel Admin';
    };

    return (
        <div className="min-h-screen flex bg-neutral-50 font-body">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* SIDEBAR */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-64 bg-primary-900 text-white flex flex-col shadow-2xl lg:shadow-none
                transform transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* User info at the top */}
                <div className="p-4 border-b border-primary-800/50">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-700 to-[#d3c0aa] flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-inner">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate font-display">{user.full_name || user.username}</p>
                            <p className="text-xs text-primary-200/60 truncate font-display tracking-wider uppercase">{user.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className="mt-4 w-full text-left text-sm text-error hover:text-error-dark bg-primary-800/30 hover:bg-primary-800/70 px-3 py-2 rounded-xl transition-colors flex items-center gap-2"
                    >
                        Keluar
                    </button>
                </div>

                {/* Navigation links */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navLinks.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            onClick={() => setSidebarOpen(false)}
                            className={`block py-3 px-4 rounded-xl transition-all duration-200 flex items-center gap-3 font-medium ${
                                location.pathname === link.to || 
                                (link.to !== '/' && location.pathname.startsWith(link.to))
                                    ? 'bg-primary-700/80 shadow-inner text-white' 
                                    : 'text-primary-100 hover:text-white hover:bg-primary-800/50'
                            }`}
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                            </svg>
                            <span>{link.label}</span>
                        </Link>
                    ))}
                </nav>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10 w-full">
                    <div className="flex items-center gap-3">
                        {/* Hamburger button - mobile only */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-600"
                            aria-label="Open menu"
                        >
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        {location.pathname === '/result-analytics' ? (
                            <div className="flex items-center gap-4">
                                <img src="/logo-h.png" alt="Andamas Group Logo" className="h-10 w-auto" />
                                <div>
                                    <h1 className="text-xl font-bold text-neutral-900 leading-tight">RESULT ANALYTICS</h1>
                                    <p className="text-sm text-neutral-500">Psikotes & Recruitment Assessment - Andamas Group</p>
                                </div>
                            </div>
                        ) : location.pathname === '/' ? (
                            <div className="flex items-center gap-2.5">
                                <img src="/logo-h.png" alt="Andamas Group Logo" className="h-8 w-auto" />
                                <span className="text-xl font-bold text-neutral-900/80 font-display">-</span>
                                <h2 className="text-xl font-bold text-neutral-900 font-display">
                                    Dashboard
                                </h2>
                            </div>
                        ) : (
                            <h2 className="text-xl font-bold text-neutral-900 font-display">
                                {getPageTitle(location.pathname)}
                            </h2>
                        )}
                    </div>
                    
                    {/* User badge - desktop */}
                    <div className="hidden sm:flex items-center gap-2.5 text-sm text-neutral-600 bg-neutral-100/50 py-1.5 px-2.5 rounded-full border border-neutral-200/60">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-700 to-[#d3c0aa] flex items-center justify-center text-white font-bold text-xs shadow-sm">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold px-1">{user.username}</span>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-6 overflow-y-auto overflow-x-hidden">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/participants" element={<ParticipantsPage />} />
                        <Route path="/participants/new" element={<AddParticipantPage />} />
                        <Route path="/participants/:id" element={<ParticipantProfilePage />} />
                        {(isSuperadmin || isAdmin) && (
                            <>
                                <Route path="/live-monitor" element={<LiveMonitor />} />
                                <Route path="/schedule" element={<SchedulePage />} />
                            </>
                        )}
                        {isSuperadmin && (
                            <>
                                <Route path="/admins" element={<ManageAdmins />} />
                                <Route path="/admins/new" element={<AddAdminPage />} />
                            </>
                        )}
                        {canSeeResults && (
                            <>
                                <Route path="/results" element={<ResultsPage />} />
                                <Route path="/result-analytics" element={<ResultAnalyticsPage />} />
                                <Route path="/participants/:id/decision" element={<ReportDecisionPage />} />
                            </>
                        )}
                        {(canSeeResults || isAdmin) && (
                            <Route path="/security" element={<SecurityDashboard />} />
                        )}
                    </Routes>
                </main>
            </div>
        </div>
    );
}

export default AdminLayout;