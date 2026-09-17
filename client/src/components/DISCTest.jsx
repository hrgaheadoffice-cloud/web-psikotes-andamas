// client/src/components/DISCTest.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestSession } from '../hooks/useTestSession';
import Swal from 'sweetalert2';

function DISCTest({ assignmentId }) {
    const navigate = useNavigate();

    const handleTestComplete = useCallback(() => {
        navigate('/dashboard');
    }, [navigate]);

    // Check if fullscreen is supported (for UI messaging)
    const isFullscreenSupported = !!(
        document.documentElement.requestFullscreen ||
        document.documentElement.webkitRequestFullscreen ||
        document.documentElement.msRequestFullscreen
    );

    // Refs to hold latest values for stable callbacks
    const answersRef = useRef({});
    const testDataRef = useRef(null);
    const timeLeftRef = useRef(null);

    const {
        testData,
        questions,
        answers,
        setAnswers,
        timeLeft,
        loading,
        isSubmitting,
        showConfirmModal,
        setShowConfirmModal,
        isLocked,
        isFullscreen,
        enterFullscreen,
        handleSubmit,
        formatTime,
        syncAnswer,
    } = useTestSession(assignmentId, {
        requireAllAnswers: true,
        onTestComplete: handleTestComplete,
        onJump: (index) => {
            const el = document.getElementById(`q-${index}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
        formatAnswers: () => {
            const payload = [];
            Object.keys(answersRef.current).forEach(qId => {
                const selection = answersRef.current[qId];
                if (selection.most) {
                    payload.push({ question_id: parseInt(qId), option_id: selection.most, type: 'most' });
                }
                if (selection.least) {
                    payload.push({ question_id: parseInt(qId), option_id: selection.least, type: 'least' });
                }
            });
            return payload;
        }
    });

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    useEffect(() => {
        testDataRef.current = testData;
    }, [testData]);

    useEffect(() => {
        timeLeftRef.current = timeLeft;
    }, [timeLeft]);

    const timerRef = useRef(null);

    // ----- DISC-specific helpers -----
    const handleDiscRadio = (questionId, optionId, type) => {
        setAnswers(prev => {
            const currentQ = prev[questionId] || { most: null, least: null };
            let newMost = currentQ.most;
            let newLeast = currentQ.least;

            if (type === 'most') {
                newMost = optionId;
                if (newLeast === optionId) newLeast = null;
            } else {
                newLeast = optionId;
                if (newMost === optionId) newMost = null;
            }
            return { ...prev, [questionId]: { most: newMost, least: newLeast } };
        });

        // Sync to backend
        syncAnswer(questionId, optionId, type);
    };

    const checkAllAnswered = () => {
        let missing = [];
        testData?.questions.forEach((q, idx) => {
            if (!answers[q.id]?.most || !answers[q.id]?.least) {
                missing.push(idx + 1);
            }
        });
        if (missing.length > 0) {
            Swal.fire({
                title: "Belum Lengkap",
                html: `Anda belum mengisi pertanyaan nomor: <strong>${missing.join(", ")}</strong>`,
                icon: "warning"
            });
            return false;
        }
        return true;
    };

    // Handle confirm submission
    const handleConfirmSubmit = useCallback(() => {
        setShowConfirmModal(false);
        handleSubmit(false);
    }, [handleSubmit, setShowConfirmModal]);

    // ----- Render locked screen -----
    if (isLocked) {
        return (
            <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center z-50 text-white">
                <h2 className="text-3xl font-bold mb-4">Tes Terkunci</h2>
                <p className="mb-2">Anda terlalu sering keluar dari mode layar penuh.</p>
                <button onClick={() => navigate('/dashboard')} className="mt-6 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
                    Kembali ke Dashboard
                </button>
            </div>
        );
    }

    if (loading) return <div className="p-8 text-center">Memuat Tes...</div>;

    // ----- Render DISC table -----
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col notranslate" translate="no">
            {/* Header with timer */}
            <div className="bg-white shadow px-3 sm:p-4 flex justify-between items-center sticky top-0 z-10">
                <h1 className="font-bold text-base sm:text-lg truncate max-w-[150px] sm:max-w-none">{testData?.test_name}</h1>
                <div className="text-base sm:text-xl font-mono bg-red-100 text-red-700 px-2 sm:px-3 py-1 rounded text-sm sm:text-base">
                    {timeLeft !== null ? formatTime(timeLeft) : "∞"}
                </div>
            </div>

            {/* DISC Table */}
            <div className="flex-1 p-3 sm:p-6 overflow-auto">
                <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-4 sm:p-6 mx-auto">
                    <h2 className="text-base sm:text-xl font-bold mb-4 text-center px-2">
                        Pilih yang PALING SESUAI (P) dan PALING TIDAK SESUAI (K)
                    </h2>
                    
                    {/* Mobile: Card view */}
                    <div className="lg:hidden space-y-4">
                        {testData?.questions.map((q, qIdx) => (
                            <div key={q.id} id={`q-${qIdx}`} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">No. {qIdx + 1}</span>
                                </div>
                                {q.options.map((opt, optIdx) => {
                                    const isMost = answers[q.id]?.most === opt.id;
                                    const isLeast = answers[q.id]?.least === opt.id;
                                    return (
                                        <div key={opt.id} className="mb-3 last:mb-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm text-gray-700 flex-1">{opt.content}</p>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleDiscRadio(q.id, opt.id, 'most')}
                                                        className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all min-w-[44px] ${
                                                            isMost 
                                                                ? 'bg-green-500 border-green-600 text-white' 
                                                                : 'bg-white border-gray-300 text-gray-400 hover:border-green-500'
                                                        }`}
                                                        title="Paling Sesuai"
                                                    >
                                                        <span className="text-xs font-bold">P</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDiscRadio(q.id, opt.id, 'least')}
                                                        className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all min-w-[44px] ${
                                                            isLeast 
                                                                ? 'bg-red-500 border-red-600 text-white' 
                                                                : 'bg-white border-gray-300 text-gray-400 hover:border-red-500'
                                                        }`}
                                                        title="Paling Tidak Sesuai"
                                                    >
                                                        <span className="text-xs font-bold">K</span>
                                                    </button>
                                                </div>
                                            </div>
                                            {optIdx < q.options.length - 1 && <div className="border-t border-gray-200 mt-2"></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Desktop: Table view */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="border p-2 text-left w-12">No</th>
                                    <th className="border p-2 text-left">Gambaran Diri</th>
                                    <th className="border p-2 text-center w-16">P</th>
                                    <th className="border p-2 text-center w-16">K</th>
                                </tr>
                            </thead>
                            <tbody>
                                {testData?.questions.map((q, qIdx) => (
                                    <React.Fragment key={q.id}>
                                        {q.options.map((opt, optIdx) => {
                                            const isMost = answers[q.id]?.most === opt.id;
                                            const isLeast = answers[q.id]?.least === opt.id;
                                            let rowClass = "hover:bg-gray-50";
                                            if (isMost) rowClass = "bg-green-100 border-green-300";
                                            if (isLeast) rowClass = "bg-red-100 border-red-300";
                                            return (
                                                <tr key={opt.id} id={optIdx === 0 ? `q-${qIdx}` : undefined} className={rowClass}>
                                                    <td className="border p-2 text-center text-gray-500 font-bold">
                                                        {optIdx === 0 ? qIdx + 1 : ""}
                                                    </td>
                                                    <td className="border p-2">{opt.content}</td>
                                                    <td
                                                        className="border p-2 text-center cursor-pointer select-none"
                                                        onClick={() => handleDiscRadio(q.id, opt.id, 'most')}
                                                    >
                                                        <div className={`w-8 h-8 mx-auto rounded-full border-2 flex items-center justify-center ${
                                                            isMost ? 'bg-green-500 border-green-600' : 'bg-white border-gray-300'
                                                        }`}>
                                                            {isMost && (
                                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="border p-2 text-center cursor-pointer select-none"
                                                        onClick={() => handleDiscRadio(q.id, opt.id, 'least')}
                                                    >
                                                        <div className={`w-8 h-8 mx-auto rounded-full border-2 flex items-center justify-center ${
                                                            isLeast ? 'bg-red-500 border-red-600' : 'bg-white border-gray-300'
                                                        }`}>
                                                            {isLeast && (
                                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {qIdx < testData.questions.length - 1 && (
                                            <tr><td colSpan="4" className="border-b-4 border-gray-200"></td></tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setShowConfirmModal(true)}
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 sm:px-8 rounded-lg text-base sm:text-lg w-full sm:w-auto min-h-[48px]"
                        >
                            Selesai & Kirim
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 sm:p-8 max-w-md w-full text-center">
                        <h3 className="text-xl font-bold mb-4">Kirim Tes?</h3>
                        <p className="mb-6 text-gray-600">
                            Anda telah menjawab {Object.keys(answers).length} soal.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={() => setShowConfirmModal(false)} className="px-6 py-3 bg-gray-200 rounded min-h-[44px]" disabled={isSubmitting}>Batal</button>
                            <button onClick={handleConfirmSubmit} disabled={isSubmitting} className={`px-6 py-3 text-white rounded font-bold min-h-[44px] ${isSubmitting ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}>
                                {isSubmitting ? "Mengirim..." : "Kirim Sekarang"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen overlay - Only show if fullscreen is supported */}
            {!isFullscreen && !isLocked && isFullscreenSupported && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex flex-col items-center justify-center z-40 text-white">
                    <h2 className="text-2xl font-bold mb-4">Dijeda</h2>
                    <p>Harap kembali ke mode layar penuh.</p>
                    <button onClick={enterFullscreen} className="mt-4 px-4 py-2 bg-blue-500 rounded font-bold hover:bg-blue-600">
                        Kembali ke Layar Penuh
                    </button>
                </div>
            )}

            {/* Info banner for unsupported browsers (e.g., iOS Safari) */}
            {!isFullscreen && !isLocked && !isFullscreenSupported && (
                <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white p-3 text-center text-sm z-40">
                    ⚠️ Mode layar penuh tidak didukung di browser Anda. Harap jangan berpindah tab.
                </div>
            )}
        </div>
    );
}

export default DISCTest;
