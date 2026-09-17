// client/src/components/tests/TestLayout.jsx
import { useNavigate } from 'react-router-dom';

// Check if fullscreen is supported (for UI messaging)
const isFullscreenSupported = () => {
    return !!(
        document.documentElement.requestFullscreen ||
        document.documentElement.webkitRequestFullscreen ||
        document.documentElement.msRequestFullscreen
    );
};

/**
 * Common layout wrapper for test screens
 * Provides consistent header, fullscreen overlay, and confirmation modal
 */
export function TestLayout({
  children,
  testTitle,
  timeLeft,
  formatTime,
  isFullscreen,
  isLocked,
  onReturnFullscreen,
  showConfirmModal,
  setShowConfirmModal,
  onConfirmSubmit,
  isSubmitting,
  answeredCount,
  totalQuestions
}) {
  const navigate = useNavigate();
  const fullscreenSupported = isFullscreenSupported();

  // Locked screen
  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center z-50 text-white p-4">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-center">Tes Terkunci</h2>
        <p className="mb-6 text-gray-300 text-center text-sm sm:text-base">
          Anda terlalu sering keluar dari mode layar penuh.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition min-h-[48px]"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col notranslate" translate="no">
      {/* Header */}
      <div className="bg-white shadow px-3 sm:p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="font-bold text-base sm:text-lg truncate max-w-[150px] sm:max-w-none">
          {testTitle}
        </h1>
        <div className="text-base sm:text-xl font-mono bg-red-100 text-red-700 px-2 sm:px-3 py-1 rounded text-sm sm:text-base">
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Content */}
      {children}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full text-center shadow-2xl">
            <h3 className="text-lg sm:text-xl font-bold mb-4">Selesaikan Tes?</h3>
            <p className="mb-6 text-gray-600 text-sm sm:text-base">
              Anda telah menjawab <span className="font-semibold">{answeredCount}</span> dari <span className="font-semibold">{totalQuestions}</span> pertanyaan.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition min-h-[44px] flex-1"
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                onClick={onConfirmSubmit}
                className={`px-5 py-2.5 text-white rounded-lg font-semibold transition min-h-[44px] flex-1 ${
                  isSubmitting ? 'bg-gray-400 cursor-wait' : 'bg-green-500 hover:bg-green-600'
                }`}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Mengirim...' : 'Kirim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Overlay - Only show if fullscreen is supported */}
      {!isFullscreen && !isLocked && fullscreenSupported && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex flex-col items-center justify-center z-40 text-white p-4">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center">Dijeda</h2>
          <p className="mb-6 text-gray-200 text-center text-sm sm:text-base">Harap kembali ke mode layar penuh.</p>
          <button
            onClick={onReturnFullscreen}
            className="px-6 py-3 bg-blue-500 rounded-lg font-semibold hover:bg-blue-600 transition min-h-[48px] min-w-[48px]"
          >
            Kembali ke Layar Penuh
          </button>
        </div>
      )}

      {/* Info banner for unsupported browsers (e.g., iOS Safari) */}
      {!isFullscreen && !isLocked && !fullscreenSupported && (
        <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white p-3 text-center text-sm z-40">
          ⚠️ Mode layar penuh tidak didukung di browser Anda. Harap jangan berpindah tab.
        </div>
      )}
    </div>
  );
}

/**
 * Question navigation grid component
 */
export function QuestionNavGrid({ 
  questions, 
  answers, 
  currentIndex, 
  onQuestionClick,
  flagged = new Set()
}) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="bg-gray-50 border-b px-3 sm:px-4 py-2 sm:py-3 overflow-x-auto">
      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-start sm:justify-center">
        {questions.map((q, idx) => {
          let btnClass = 'w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full transition-all ';
          
          if (answers[q.id]) {
            btnClass += 'bg-green-500 text-white hover:bg-green-600';
          } else if (flagged.has(q.id)) {
            btnClass += 'bg-yellow-400 text-white hover:bg-yellow-500';
          } else {
            btnClass += 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100';
          }
          
          if (idx === currentIndex) {
            btnClass += ' ring-2 ring-blue-500 ring-offset-1';
          }
          
          return (
            <button
              key={q.id}
              onClick={() => onQuestionClick(idx)}
              className={btnClass}
              type="button"
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Question card component
 */
export function QuestionCard({ 
  questionNumber, 
  totalQuestions, 
  content, 
  options, 
  selectedAnswer,
  onSelect,
  onFlag,
  isFlagged,
  showFlag = true,
  hideNumbering = false
}) {
  return (
    <div className="flex-1 p-3 sm:p-6 flex flex-col items-center justify-center overflow-y-auto">
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow-lg w-full max-w-2xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
          {!hideNumbering && (
            <p className="text-xs sm:text-sm text-gray-500">
              Pertanyaan {questionNumber} dari {totalQuestions}
            </p>
          )}
          {showFlag && (
            <button
              onClick={onFlag}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition min-h-[40px] ${
                isFlagged
                  ? 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {isFlagged ? '⛳ Ditinggalkan' : 'Tandai'}
            </button>
          )}
        </div>

        {/* Question */}
        <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-4 sm:mb-6 leading-relaxed">
          {content}
        </h2>

        {/* Options */}
        <div className="space-y-2 sm:space-y-3">
          {options?.map((opt) => {
            const isSelected = selectedAnswer === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onSelect(opt.id)}
                className={`w-full text-left p-3 sm:p-4 border-2 rounded-lg transition-all min-h-[48px] sm:min-h-[52px] ${
                  isSelected
                    ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <span className={`font-bold mr-2 sm:mr-3 ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                  {opt.label}.
                </span>
                <span className="text-sm sm:text-base">{opt.content}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Footer navigation component
 */
export function TestFooter({ 
  currentIndex, 
  totalQuestions, 
  answeredCount,
  onPrevious, 
  onNext, 
  onFinish,
  isLastQuestion
}) {
  return (
    <div className="bg-white border-t px-3 sm:p-4 shadow flex justify-between items-center safe-area-pb">
      <button
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition min-h-[44px] min-w-[44px] flex items-center justify-center ${
          currentIndex === 0
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="hidden sm:inline ml-1">Sebelumnya</span>
      </button>

      <div className="text-xs sm:text-sm text-gray-600 font-medium bg-gray-100 px-3 py-1.5 rounded-lg">
        {answeredCount} / {totalQuestions}
      </div>

      {isLastQuestion ? (
        <button
          onClick={onFinish}
          className="px-4 sm:px-5 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 shadow-sm transition min-h-[44px] min-w-[44px]"
        >
          Selesai
        </button>
      ) : (
        <button
          onClick={onNext}
          className="px-3 sm:px-5 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 shadow-sm transition min-h-[44px] min-w-[44px] flex items-center gap-1"
        >
          <span className="hidden sm:inline">Selanjutnya</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
