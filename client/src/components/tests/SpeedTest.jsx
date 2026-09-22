// client/src/components/tests/SpeedTest.jsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestSession } from '../../hooks/useTestSession';
import { TestLayout } from './TestLayout';

/**
 * Speed Test component with auto-advance functionality
 * Optimized for fast-paced testing with immediate feedback
 */
export function SpeedTest({ assignmentId }) {
  const navigate = useNavigate();
  const [showLocalConfirm, setShowLocalConfirm] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);

  const handleTestComplete = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

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
    handleSubmit: submitTestSession,
    formatTime,
    syncAnswer,
    currentQuestion: currentIndex,
    setCurrentQuestion: setCurrentIndex,
  } = useTestSession(assignmentId, {
    requireAllAnswers: false, // Speed tests allow partial answers
    onTestComplete: handleTestComplete,
    // Pass a ref getter so the hook can access local answers on timeout
    formatAnswers: () => Object.keys(answers).map(qId => ({
      question_id: parseInt(qId),
      option_id: answers[qId],
      type: 'single'
    }))
  });

  // Custom submit handler that uses answers from hook
  const handleSubmit = useCallback(async () => {
    // Convert to array format for the API
    const formattedAnswers = Object.keys(answers).map(qId => ({
      question_id: parseInt(qId),
      option_id: answers[qId],
      type: 'single'
    }));

    // Call the original submit with formatted answers, skipping confirmation modal
    await submitTestSession(false, formattedAnswers);
  }, [submitTestSession, answers]);

  // Use local confirm state to avoid conflict with hook
  const showConfirm = showConfirmModal || showLocalConfirm;
  const setShowConfirm = setShowConfirmModal;

  // Handle answer selection with auto-advance
  const handleSelect = useCallback((optionId) => {
    const qId = questions[currentIndex]?.id;
    if (!qId) return;

    // Record answer and trigger visual feedback
    setAnswers(prev => ({ ...prev, [qId]: optionId }));
    syncAnswer(qId, optionId, 'single');
    setJustAnswered(true);

    // Auto-advance after delay to let user see their selection
    setTimeout(() => {
      setJustAnswered(false);
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Last question - show confirm modal
        setShowConfirm(true);
      }
    }, 350);
  }, [questions, currentIndex, setShowConfirm]);

  // Keyboard navigation for faster interaction
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only if not in modal
      if (showConfirm) return;

      // Number keys 1-9 for options
      if (e.key >= '1' && e.key <= '9') {
        const optionIndex = parseInt(e.key) - 1;
        const currentQuestion = questions[currentIndex];
        if (currentQuestion?.options[optionIndex]) {
          handleSelect(currentQuestion.options[optionIndex].id);
        }
      }

      // Enter to confirm on last question
      if (e.key === 'Enter' && currentIndex === questions.length - 1) {
        setShowConfirm(true);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, questions, showConfirm, handleSelect, setShowConfirm]);

  const handleConfirmSubmit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  const goToQuestion = useCallback((index) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  }, [questions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat Speed Test...</p>
        </div>
      </div>
    );
  }

  if (!testData || !questions || questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <TestLayout
      testTitle={testData.test_name}
      timeLeft={timeLeft}
      formatTime={formatTime}
      onTimeUp={() => submitTestSession(true)}
      isFullscreen={isFullscreen}
      isLocked={isLocked}
      onReturnFullscreen={enterFullscreen}
      showConfirmModal={showConfirm}
      setShowConfirmModal={setShowConfirm}
      onConfirmSubmit={handleConfirmSubmit}
      isSubmitting={isSubmitting}
      answeredCount={answeredCount}
      totalQuestions={questions.length}
    >
      {/* Progress Bar - More prominent for speed test */}
      <div className="w-full bg-gray-200 h-2">
        <div 
          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 transition-all duration-300" 
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question Counter - Large and clear */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
            {currentIndex + 1} / {questions.length}
          </span>
          <span className="text-sm text-gray-500">Soal</span>
        </div>
        <div className="text-sm text-gray-500">
          {answeredCount} dijawab
        </div>
      </div>

      {/* Question Card - Optimized for speed */}
      <div className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-center overflow-y-auto">
        <div className={`bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow-lg w-full max-w-2xl transition-all duration-300 ${
          justAnswered ? 'scale-[1.02] shadow-xl' : ''
        }`}>
          {/* Question Text */}
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6 sm:mb-8 text-center text-gray-800">
            {currentQuestion.content}
          </h2>

          {/* Options - Large touch targets */}
          <div className="space-y-3 sm:space-y-4">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = answers[currentQuestion.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className={`w-full text-left p-4 sm:p-5 border-2 rounded-xl transition-all min-h-[56px] sm:min-h-[60px] transform hover:scale-[1.02] active:scale-[0.98] ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-blue-600 shadow-lg'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  } ${justAnswered && isSelected ? 'animate-pulse' : ''}`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {opt.label || idx + 1}
                    </span>
                    <span className="text-base sm:text-lg font-medium flex-1">
                      {opt.content}
                    </span>
                    {isSelected && (
                      <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>


        </div>
      </div>

      {/* Navigation Footer - Simplified for speed */}
      <div className="bg-white border-t px-4 py-3 flex justify-between items-center">
        <button
          onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className={`px-4 py-2.5 rounded-lg font-medium transition min-h-[44px] flex items-center gap-2 ${
            currentIndex === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        {currentIndex === questions.length - 1 ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-semibold shadow-sm transition min-h-[44px] min-w-[44px]"
          >
            Selesaikan Tes
          </button>
        ) : (
          <button
            onClick={() => goToQuestion(Math.min(questions.length - 1, currentIndex + 1))}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition min-h-[44px] flex items-center gap-2"
          >
            <span className="hidden sm:inline">Lewati</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </TestLayout>
  );
}

export default SpeedTest;
