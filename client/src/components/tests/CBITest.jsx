import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTestSession } from '../../hooks/useTestSession';
import { TestLayout, QuestionCard, QuestionNavGrid } from './TestLayout';

export function CBITest() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showQuestionNav, setShowQuestionNav] = useState(false);

  const handleTestComplete = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const handleQuestionJump = useCallback((questionIndex) => {
    setCurrentIndex(questionIndex);
    setShowQuestionNav(false);
  }, []);

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
    onJump: handleQuestionJump
  });

  const handleSelect = useCallback((optionId) => {
    const qId = questions[currentIndex]?.id;
    if (!qId) return;

    setAnswers(prev => ({ ...prev, [qId]: optionId }));
    syncAnswer(qId, optionId, 'single');

    // Auto-advance
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setShowConfirmModal(true);
      }
    }, 250);
  }, [questions, currentIndex, setAnswers, setShowConfirmModal, syncAnswer]);

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

  const answeredCount = Object.keys(answers).length;

  // Render Instruction Screen
  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 notranslate" translate="no">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            {testData.test_name}
          </h1>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-8">
            <h2 className="font-semibold text-blue-800 mb-3 text-lg">Instruksi Pengerjaan (Test Rules):</h2>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {testData.settings?.instructions || 
                "Pada tes ini, Anda akan diberikan sejumlah pernyataan mengenai sikap dan perilaku. Tugas Anda adalah memilih salah satu jawaban:\n• Benar (B) → Jika pernyataan sesuai dengan diri Anda\n• Salah (S) → Jika pernyataan tidak sesuai dengan diri Anda\n\nWaktu pengerjaan pada tes ini 15 menit. Jawab pernyataan secara spontan."}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-sm text-yellow-800 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <p>
              <strong>Perhatian:</strong> Setiap kali Anda memilih jawaban, sistem akan otomatis melanjutkan ke soal berikutnya.
              Gunakan navigasi nomor soal untuk meninjau atau melengkapi jawaban yang masih kosong.
            </p>
          </div>

          <button
            onClick={() => {
              setShowInstructions(false);
              enterFullscreen();
            }}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-lg shadow-md"
          >
            Mulai Tes Sekarang
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <>
      <style>{`
        @keyframes slideFadeUp {
          0% {
            opacity: 0;
            transform: translateY(15px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-fade {
          animation: slideFadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <TestLayout
      testTitle={testData.test_name}
      timeLeft={timeLeft}
      formatTime={formatTime}
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
      <div className="px-3 pt-3 sm:px-4 sm:pt-4">
        <button
          type="button"
          onClick={() => setShowQuestionNav((isVisible) => !isVisible)}
          aria-expanded={showQuestionNav}
          aria-controls="cbi-question-navigation"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>{showQuestionNav ? 'Sembunyikan nomor soal' : 'Tampilkan nomor soal'}</span>
        </button>
      </div>

      {showQuestionNav && (
        <div id="cbi-question-navigation" className="mt-3">
          <QuestionNavGrid
            questions={questions}
            answers={answers}
            currentIndex={currentIndex}
            onQuestionClick={handleQuestionJump}
          />
        </div>
      )}

      <div key={currentIndex} className="animate-slide-fade w-full flex-1 flex flex-col">
        {/* Question Card without Flag capability */}
        <QuestionCard
          hideNumbering={true}
          content={currentQuestion.content}
        options={currentQuestion.options}
        selectedAnswer={answers[currentQuestion.id]}
        onSelect={handleSelect}
        onFlag={() => {}} 
        isFlagged={false}
        showFlag={false}
      />
      </div>
    </TestLayout>
    </>
  );
}

export default CBITest;
