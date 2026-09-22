// client/src/components/tests/StandardTest.jsx
import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTestSession } from '../../hooks/useTestSession';
import { TestLayout, QuestionNavGrid, QuestionCard, TestFooter } from './TestLayout';

/**
 * Standard test component for single-choice tests (IQ, etc.)
 * Uses shared test session logic and layout components
 * Note: Speed, DISC, Memory, Logic, Temperament, PAPI Kostick have their own components
 *
 * Auto-next behavior:
 * - IQ: Auto-next enabled, no back navigation (config saved for future implementation)
 * - Other tests: No auto-next, can navigate freely
 */
export function StandardTest() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState(new Set());

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
    handleSubmit,
    formatTime,
    onTimeTick,
    syncAnswer,
  } = useTestSession(assignmentId, {
    requireAllAnswers: true,
    onTestComplete: handleTestComplete,
    onJump: (index) => setCurrentIndex(index)
  });

  // Auto-advance for tests with speed setting (IQ)
  const handleSelect = useCallback((optionId) => {
    const qId = questions[currentIndex]?.id;
    if (!qId) return;

    setAnswers(prev => ({ ...prev, [qId]: optionId }));
    syncAnswer(qId, optionId, 'single');

    // Auto-advance for IQ tests
    if (testData?.settings?.type === 'speed') {
      setTimeout(() => {
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setShowConfirmModal(true);
        }
      }, 350);
    }
  }, [questions, currentIndex, setAnswers, syncAnswer, testData, setCurrentIndex, setShowConfirmModal]);

  const toggleFlag = useCallback(() => {
    const qId = questions[currentIndex]?.id;
    if (!qId) return;

    setFlagged(prev => {
      const newSet = new Set(prev);
      if (newSet.has(qId)) {
        newSet.delete(qId);
      } else {
        newSet.add(qId);
      }
      return newSet;
    });
  }, [questions, currentIndex]);

  const goToQuestion = useCallback((index) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  }, [questions]);

  const goNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, questions.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleFinish = useCallback(() => {
    setShowConfirmModal(true);
  }, [setShowConfirmModal]);

  const handleConfirmSubmit = useCallback(() => {
    setShowConfirmModal(false);
    handleSubmit(false);
  }, [handleSubmit, setShowConfirmModal]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!testData || questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentIndex === questions.length - 1;
  // Hide question nav and footer for auto-next tests (speed, IQ)
  const isAutoNext = testData?.settings?.type === 'speed';
  const showQuestionNav = !isAutoNext;

  return (
    <TestLayout
      testTitle={testData.test_name}
      timeLeft={timeLeft}
      formatTime={formatTime}
      onTimeUp={() => handleSubmit(true)}
      onTimeTick={onTimeTick}
      isFullscreen={isFullscreen}
      isLocked={isLocked}
      onReturnFullscreen={enterFullscreen}
      showConfirmModal={showConfirmModal}
      setShowConfirmModal={setShowConfirmModal}
      onConfirmSubmit={handleConfirmSubmit}
      isSubmitting={isSubmitting}
      answeredCount={answeredCount}
      totalQuestions={questions.length}
    >
      {/* Progress Bar - always visible */}
      <div className="w-full bg-gray-200 h-2">
        <div
          className="bg-blue-500 h-2 transition-all duration-300"
          style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
        />
      </div>

      {/* Question Navigation Grid - hidden for auto-next tests */}
      {showQuestionNav && (
        <QuestionNavGrid
          questions={questions}
          answers={answers}
          currentIndex={currentIndex}
          onQuestionClick={goToQuestion}
          flagged={flagged}
        />
      )}

      {/* Question Card */}
      <QuestionCard
        questionId={currentQuestion.id}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        content={currentQuestion.content}
        options={currentQuestion.options}
        selectedAnswer={answers[currentQuestion.id]}
        onSelect={handleSelect}
        onFlag={toggleFlag}
        isFlagged={flagged.has(currentQuestion.id)}
        showFlag={!isAutoNext}
      />

      {/* Footer Navigation - hidden for auto-next tests */}
      {showQuestionNav && (
        <TestFooter
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          answeredCount={answeredCount}
          onPrevious={goPrev}
          onNext={goNext}
          onFinish={handleFinish}
          isLastQuestion={isLastQuestion}
        />
      )}
    </TestLayout>
  );
}

export default StandardTest;
