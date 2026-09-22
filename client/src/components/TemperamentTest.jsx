// client/src/components/TemperamentTest.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestSession } from '../hooks/useTestSession';
import Swal from 'sweetalert2';
import { CountdownTimer } from './tests/TestLayout';

function TemperamentTest({ assignmentId }) {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [justAnswered, setJustAnswered] = useState(false);

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

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    useEffect(() => {
        testDataRef.current = testData;
    }, [testData]);

    useEffect(() => {
        timeLeftRef.current = timeLeft;
    }, [timeLeft]);

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

    // Handle answer selection with auto-advance
    const handleSelect = (optionId) => {
        const qId = questions[currentIndex].id;
        setAnswers({ ...answers, [qId]: optionId });
        syncAnswer(qId, optionId, 'single');
        setJustAnswered(true);

        // Auto‑next after delay with visual feedback
        setTimeout(() => {
            setJustAnswered(false);
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(currentIndex + 1);
            } else {
                setShowConfirmModal(true); // This will trigger the global confirmation modal
            }
        }, 350);
    };

    const goNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    // Handle confirm submission from global modal
    const handleConfirmSubmit = useCallback(() => {
        setShowConfirmModal(false);
        handleSubmit(false);
    }, [handleSubmit, setShowConfirmModal]);

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

    if (loading) return <div className="p-8 text-center">Memuat...</div>;

    const currentQ = testData.questions[currentIndex];
    const progress = ((Object.keys(answers).length) / testData.questions.length * 100).toFixed(0);

    return (
        <>
            {/* Standard Confirmation Modal Wrapper (Legacy fix) */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full text-center shadow-xl">
                        <h3 className="text-xl font-bold mb-4 text-gray-900">Selesaikan Tes?</h3>
                        <p className="mb-6 text-gray-600">
                            Anda telah menjawab {Object.keys(answers).length} pertanyaan.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="px-6 py-3 bg-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-300 transition-colors min-h-[44px]"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleConfirmSubmit}
                                disabled={hookIsSubmitting}
                                className={`px-6 py-3 text-white rounded-lg font-bold min-h-[44px] transition-colors ${hookIsSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-md'
                                    }`}
                            >
                                {hookIsSubmitting ? 'Mengirim...' : 'Ya, Kirim'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* Header with progress and timer */}
            <div className="bg-white shadow p-4 flex justify-between items-center">
                <h1 className="font-bold text-lg">{testData.test_name}</h1>
                <div className="flex gap-4 items-center">
                    <div className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded">
                        {Object.keys(answers).length} / {testData.questions.length} terjawab
                    </div>
                    {timeLeft !== null && (
                        <div className="text-xl font-mono bg-red-100 text-red-700 px-3 py-1 rounded">
                            <CountdownTimer initialTime={timeLeft} formatTime={formatTime} onTimeUp={() => handleSubmit(true)} isActive={!isLocked && !hookIsSubmitting} />
                        </div>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 h-2">
                <div className="bg-blue-500 h-2 transition-all" style={{ width: `${progress}%` }}></div>
            </div>

            {/* Question area */}
            <div className="flex-1 p-3 sm:p-6 flex flex-col items-center">
                <div className={`bg-white p-4 sm:p-8 rounded-lg shadow-lg w-full max-w-2xl transition-all duration-300 ${
                    justAnswered ? 'scale-[1.02] shadow-xl' : ''
                }`}>
                    <p className="text-sm text-gray-500 mb-2">Pertanyaan {currentIndex + 1}</p>
                    <h2 className="text-xl font-semibold mb-6">{currentQ.content}</h2>

                    <div className="space-y-3">
                        {currentQ.options.map((opt) => (
                            <label
                                key={opt.id}
                                className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${answers[currentQ.id] === opt.id ? 'bg-blue-500 text-white border-blue-500' : 'bg-white hover:bg-gray-50'
                                    } ${justAnswered && answers[currentQ.id] === opt.id ? 'animate-pulse' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name={`q${currentQ.id}`}
                                    value={opt.id}
                                    checked={answers[currentQ.id] === opt.id}
                                    onChange={() => handleSelect(opt.id)}
                                    className="mr-3"
                                />
                                <span>{opt.label}. {opt.content}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Navigation footer - Forward only */}
            <div className="bg-white p-4 shadow flex justify-end">
                {currentIndex === testData.questions.length - 1 ? (
                    <button
                        onClick={() => handleSubmit()}
                        className="px-6 py-3 bg-green-500 text-white rounded font-bold hover:bg-green-600 min-h-[44px]"
                    >
                        Selesai
                    </button>
                ) : (
                    <button
                        onClick={goNext}
                        className="px-6 py-3 bg-blue-500 text-white rounded font-bold hover:bg-blue-600 min-h-[44px]"
                    >
                        Selanjutnya
                    </button>
                )}
            </div>

            {/* Confirmation modal from Layout */}
            {/* Standard Confirmation modal is now handled by TestLayout or useTestSession */}

            {/* Fullscreen overlay - Only show if fullscreen is supported */}
            {!isFullscreen && !isLocked && isFullscreenSupported && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex flex-col items-center justify-center z-40 text-white">
                    <h2 className="text-2xl font-bold mb-4">Dijeda</h2>
                    <p>Harap kembali ke mode layar penuh.</p>
                    <button
                        onClick={() => enterFullscreen()}
                        className="mt-4 px-4 py-2 bg-blue-500 rounded font-bold hover:bg-blue-600"
                    >
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
        </>
    );
}

export default TemperamentTest;
