// client/src/components/LogicTest.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestSession } from '../hooks/useTestSession';
import Swal from 'sweetalert2';
import { CountdownTimer } from './tests/TestLayout';

function LogicTest({ assignmentId }) {
    const navigate = useNavigate();
    const [flagged, setFlagged] = useState(new Set());
    const [currentIndex, setCurrentIndex] = useState(0);
    const [justAnswered, setJustAnswered] = useState(false);
    const [multiSelectAnswers, setMultiSelectAnswers] = useState({}); // For Q23, Q41

    const handleTestComplete = useCallback(() => {
        navigate('/dashboard');
    }, [navigate]);

    // Check if fullscreen is supported (for UI messaging)
    const isFullscreenSupported = !!(
        document.documentElement.requestFullscreen ||
        document.documentElement.webkitRequestFullscreen ||
        document.documentElement.msRequestFullscreen
    );

    const {
        testData,
        questions,
        answers,
        setAnswers,
        timeLeft,
        loading,
        isSubmitting: hookIsSubmitting,
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
        onJump: (index) => setCurrentIndex(index)
    });

    // Refs to hold latest values for stable callbacks
    const answersRef = useRef(answers);
    const testDataRef = useRef(testData);
    const timeLeftRef = useRef(timeLeft);
    const questionsRef = useRef(questions);

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    // Sync multi-select answers to main answers state
    useEffect(() => {
        if (Object.keys(multiSelectAnswers).length > 0) {
            setAnswers(prev => {
                const updated = { ...prev };
                let changed = false;
                Object.entries(multiSelectAnswers).forEach(([qId, optionIds]) => {
                    const newValue = optionIds.join(',');
                    if (prev[qId] !== newValue) {
                        updated[qId] = newValue;
                        changed = true;
                    }
                });
                return changed ? updated : prev;
            });
        }
    }, [multiSelectAnswers, setAnswers]);

    useEffect(() => {
        testDataRef.current = testData;
    }, [testData]);

    useEffect(() => {
        timeLeftRef.current = timeLeft;
    }, [timeLeft]);

    useEffect(() => {
        questionsRef.current = questions;
    }, [questions]);

    const toggleFlag = useCallback(() => {
        if (questions.length === 0) return;
        const qId = questions[currentIndex].id;
        setFlagged(prev => {
            const newSet = new Set(prev);
            if (newSet.has(qId)) newSet.delete(qId);
            else newSet.add(qId);
            return newSet;
        });
    }, [questions, currentIndex]);

    const handleSelect = (optionId) => {
        const qId = questions[currentIndex]?.id;
        if (!qId) return;

        const currentQuestion = questions[currentIndex];
        // Backend sends settings = meta_data directly
        const isMultiSelect = currentQuestion.settings?.multi_select || currentQuestion.settings?.multiSelect;

        if (isMultiSelect) {
            // Multi-select mode (Q23, Q41) - toggle selection
            setMultiSelectAnswers(prev => {
                const current = prev[qId] || [];
                const updated = current.includes(optionId)
                    ? current.filter(id => id !== optionId)
                    : [...current, optionId];
                // Limit to 2 selections
                if (updated.length > 2) return prev;
                
                // Sync multi-select to backend
                syncAnswer(qId, updated.join(','), 'multi');
                
                return { ...prev, [qId]: updated };
            });
        } else {
            // Single select mode
            setAnswers(prev => ({ ...prev, [qId]: optionId }));
            syncAnswer(qId, optionId, 'single');
        }

        setJustAnswered(true);

        // Auto-advance after delay (but can still go back) - only for single select
        if (!isMultiSelect) {
            setTimeout(() => {
                setJustAnswered(false);
                if (currentIndex < questions.length - 1) {
                    setCurrentIndex(prev => prev + 1);
                }
            }, 350);
        } else {
            setTimeout(() => {
                setJustAnswered(false);
            }, 350);
        }
    };

    const goToQuestion = (index) => {
        if (index >= 0 && index < questions.length) {
            setCurrentIndex(index);
        }
    };

    const goNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const goPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    // Handle confirm submission from global modal
    const handleConfirmSubmit = useCallback(() => {
        setShowConfirmModal(false);
        handleSubmit(false);
    }, [handleSubmit, setShowConfirmModal]);

    // Prevent context menu and dev tools
    useEffect(() => {
        const handleContextMenu = (e) => e.preventDefault();
        const handleKeyDown = (e) => {
            if (e.key === "F12" ||
                (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j")) ||
                (e.ctrlKey && (e.key === "U" || e.key === "u"))) {
                e.preventDefault();
            }
        };
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

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

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const currentQ = questions[currentIndex] || {};
    const answeredCount = Object.keys(answers).length;
    const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

    return (
        <>
            {/* Standard Confirmation Modal Wrapper */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
                        <h3 className="text-xl font-bold mb-3 text-gray-900">Selesaikan Tes?</h3>
                        <p className="text-gray-600 mb-6">
                            Anda telah menjawab {answeredCount} dari {questions.length} pertanyaan.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition min-h-[44px]"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleConfirmSubmit}
                                disabled={hookIsSubmitting}
                                className={`px-6 py-3 text-white rounded-lg shadow-md transition min-h-[44px] font-bold ${hookIsSubmitting
                                        ? 'bg-blue-400 cursor-wait'
                                        : 'bg-green-600 hover:bg-green-700'
                                    }`}
                            >
                                {hookIsSubmitting ? 'Mengirim...' : 'Ya, Kirim'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="min-h-screen bg-gray-100 flex flex-col notranslate" translate="no">
            {/* Header */}
            <div className="bg-white shadow px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <h1 className="font-semibold text-lg notranslate" translate="no">Tes Logika &amp; Aritmatika</h1>
                <div className="bg-red-100 text-red-700 px-3 py-1 rounded-md font-mono text-lg">
                    <CountdownTimer initialTime={timeLeft} formatTime={formatTime} onTimeUp={() => handleSubmit(true)} isActive={!isLocked && !hookIsSubmitting} />
                </div>
            </div>

            {/* Question Navigation Grid */}
            <div className="bg-white border-b px-4 py-3">
                <div className="flex flex-wrap gap-1.5 justify-center">
                    {questions.map((q, idx) => {
                        let btnClass = 'w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center transition-colors cursor-pointer ';
                        
                        // Check if answered (handle both single and multi-select)
                        const isMultiSelect = q.settings?.multi_select || q.settings?.multiSelect;
                        const isAnswered = isMultiSelect 
                            ? (multiSelectAnswers[q.id] && multiSelectAnswers[q.id].length > 0)
                            : answers[q.id];
                        
                        if (isAnswered) {
                            btnClass += 'bg-green-500 text-white hover:bg-green-600';
                        } else if (flagged.has(q.id)) {
                            btnClass += 'bg-yellow-400 text-white hover:bg-yellow-500';
                        } else {
                            btnClass += 'bg-gray-200 text-gray-700 hover:bg-gray-300';
                        }
                        if (idx === currentIndex) {
                            btnClass += ' ring-2 ring-blue-500 ring-offset-2';
                        }
                        return (
                            <button
                                key={q.id}
                                type="button"
                                onClick={() => goToQuestion(idx)}
                                className={btnClass}
                            >
                                {idx + 1}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 h-2">
                <div className="bg-blue-500 h-2 transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>

            {/* Question Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-3xl mx-auto">
                    <div className={`bg-white rounded-xl shadow-md p-6 md:p-8 transition-all duration-300 ${
                        justAnswered ? 'scale-[1.02] shadow-xl' : ''
                    }`}>
                        {/* Question Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                            <span className="text-sm text-gray-500 notranslate" translate="no">
                                Pertanyaan {currentIndex + 1} dari {questions.length}
                            </span>
                            <button
                                onClick={toggleFlag}
                                className={`px-4 py-2 rounded-full text-sm font-medium border transition min-h-[44px] ${flagged.has(currentQ.id)
                                        ? 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                {flagged.has(currentQ.id) ? '⛳ Ditinggalkan' : 'Tandai'}
                            </button>
                        </div>

                        {/* Question Text */}
                        <h2 className="text-xl font-medium text-gray-800 mb-8 leading-relaxed notranslate" translate="no">
                            <div className="notranslate" translate="no" dangerouslySetInnerHTML={{ __html: currentQ.content }} />
                        </h2>

                        {/* Options */}
                        <div className="space-y-3">
                            {currentQ.options?.map(opt => {
                                // Backend sends settings = meta_data directly
                                const isMultiSelect = currentQ.settings?.multi_select || currentQ.settings?.multiSelect;
                                const isSelected = isMultiSelect 
                                    ? (multiSelectAnswers[currentQ.id] || []).includes(opt.id)
                                    : answers[currentQ.id] === opt.id;
                                const selectionCount = multiSelectAnswers[currentQ.id]?.length || 0;
                                const isMaxSelected = selectionCount >= 2 && !isSelected;
                                
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleSelect(opt.id)}
                                        disabled={isMaxSelected}
                                        className={`w-full text-left p-4 rounded-lg border-2 transition ${
                                            isSelected
                                                ? 'bg-blue-500 text-white border-blue-600'
                                                : isMaxSelected
                                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                        } ${justAnswered && isSelected ? 'animate-pulse' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold notranslate ${isSelected ? 'text-white' : 'text-gray-500'}`} translate="no">
                                                {isMultiSelect ? (
                                                    <span className="w-5 h-5 border-2 border-current rounded flex items-center justify-center">
                                                        {isSelected ? '✓' : ''}
                                                    </span>
                                                ) : (
                                                    opt.label
                                                )}
                                            </span>
                                            <span className="notranslate" translate="no" dangerouslySetInnerHTML={{ __html: opt.content }} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Navigation */}
            <div className="bg-white border-t px-4 py-3 flex items-center justify-between">
                <button
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className={`px-4 py-3 rounded-md font-medium transition min-h-[44px] ${currentIndex === 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    ← Sebelumnya
                </button>
                <span className="text-sm text-gray-600 font-mono">
                    {answeredCount} / {questions.length}
                </span>
                {currentIndex === questions.length - 1 ? (
                    <button
                        onClick={() => setShowConfirmModal(true)}
                        className="px-5 py-3 bg-green-500 text-white rounded-md font-semibold hover:bg-green-600 shadow-sm transition min-h-[44px]"
                    >
                        Selesai
                    </button>
                ) : (
                    <button
                        onClick={goNext}
                        className="px-5 py-3 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 shadow-sm transition min-h-[44px]"
                    >
                        Selanjutnya →
                    </button>
                )}
            </div>

            {/* Standard Confirmation modal is now handled by the wrapper at the top */}

            {/* Fullscreen Overlay - Only show if fullscreen is supported */}
            {!isFullscreen && !isLocked && isFullscreenSupported && (
                <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 text-white">
                    <h2 className="text-2xl font-bold mb-4">Dijeda</h2>
                    <p className="mb-6 text-gray-200">Harap kembali ke mode layar penuh.</p>
                    <button
                        onClick={() => enterFullscreen()}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition"
                    >
                        Kembali ke Layar Penuh
                    </button>
                </div>
            )}

            {/* Info banner for unsupported browsers (e.g., iOS Safari) */}
            {!isFullscreen && !isLocked && !isFullscreenSupported && (
                <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white p-3 text-center text-sm z-50">
                    ⚠️ Mode layar penuh tidak didukung di browser Anda. Harap jangan berpindah tab.
                </div>
            )}

            {/* CSS for question and option images */}
            <style>{`
                .question-image, .option-image {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 1rem auto;
                }
                .option-image {
                    max-width: 200px;
                    margin: 0.5rem auto;
                }
                .comparison-table {
                    width: 100%;
                    margin: 1rem 0;
                }
                .comparison-table table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 0.5rem 0;
                }
                .comparison-table td {
                    padding: 0.75rem;
                    border: 1px solid #e5e7eb;
                    font-family: monospace;
                    font-size: 0.9rem;
                }
                .comparison-table tr:nth-child(even) {
                    background-color: #f9fafb;
                }
                .comparison-table p {
                    margin-bottom: 0.5rem;
                    font-weight: 500;
                }
                .multi-select-instruction {
                    background-color: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 0.75rem 1rem;
                    margin-bottom: 1rem;
                    border-radius: 0.25rem;
                }
                .multi-select-instruction strong {
                    color: #92400e;
                }
            `}</style>
        </div>
        </>
    );
}

export default LogicTest;
