// client/src/components/tests/PapiKostickTest.jsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTestSession } from '../../hooks/useTestSession';
import { TestLayout } from './TestLayout';
import Swal from 'sweetalert2';

const ITEMS_PER_PAGE = 5;
const TOTAL_PAGES = 18;

/**
 * PAPI Kostick Test Component
 * 90 forced-choice items displayed 5 per page (18 pages).
 * Each item: two statements in a split-card layout — pick ONE.
 * Can go back to previous pages and change answers.
 * Uses useTestSession for session persistence, fullscreen lock, submission.
 */
export function PapiKostickTest() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const papiSessionKey = `papi_session_${assignmentId}`;

  // State
  const [currentPage, setCurrentPage] = useState(0); // 0-indexed, 0-17
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { questionIndex: 'a' | 'b' }

  const handleTestComplete = useCallback(() => {
    localStorage.removeItem(papiSessionKey);
    navigate('/dashboard');
  }, [navigate, papiSessionKey]);

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
      const page = Math.floor(index / ITEMS_PER_PAGE);
      setCurrentPage(page);
      window.scrollTo(0, 0);
    },
    formatAnswers: () => {
      const formatted = [];
      Object.entries(selectedAnswers).forEach(([qIdx, selection]) => {
        const question = questions[parseInt(qIdx)];
        if (!question) return;
        const option = question.options[selection === 'a' ? 0 : 1];
        if (option) {
          formatted.push({
            question_id: question.id,
            option_id: option.id,
            type: 'single',
          });
        }
      });
      return formatted;
    },
  });

  // Restore session
  useEffect(() => {
    if (questions.length > 0 && Object.keys(selectedAnswers).length === 0) {
      // 1. Check localStorage
      const saved = localStorage.getItem(papiSessionKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.selectedAnswers) {
            setSelectedAnswers(parsed.selectedAnswers);
            // Also sync to hook answers
            const newAnswers = {};
            Object.entries(parsed.selectedAnswers).forEach(([idx, sel]) => {
                const q = questions[parseInt(idx)];
                if (q) newAnswers[q.id] = q.options[sel === 'a' ? 0 : 1].id;
            });
            setAnswers(prev => ({ ...prev, ...newAnswers }));
          }
          if (parsed.papiPage !== undefined) {
            setCurrentPage(parsed.papiPage);
          }
          return;
        } catch (e) { /* ignore */ }
      }

      // 2. If nothing in localStorage, but hook has answers (restored from server sync)
      if (Object.keys(answers).length > 0) {
        const restored = {};
        questions.forEach((q, idx) => {
          const ansId = answers[q.id];
          if (ansId) {
            restored[idx] = q.options[0].id === ansId ? 'a' : 'b';
          }
        });
        if (Object.keys(restored).length > 0) {
            setSelectedAnswers(restored);
        }
      }
    }
  }, [questions, assignmentId, answers, setAnswers]);

  // Persist answers + current page
  useEffect(() => {
    const data = { selectedAnswers, papiPage: currentPage };
    localStorage.setItem(papiSessionKey, JSON.stringify(data));
  }, [selectedAnswers, currentPage]);

  const pageItems = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return questions.slice(start, end).map((q, i) => ({
      questionIndex: start + i,
      question: q,
    }));
  }, [questions, currentPage]);

  const currentPageAnswered = useMemo(() => {
    return pageItems.every(item => selectedAnswers[item.questionIndex] !== undefined);
  }, [pageItems, selectedAnswers]);

  const handleSelect = useCallback((questionIndex, selection) => {
    const question = questions[questionIndex];
    if (!question) return;

    const option = question.options[selection === 'a' ? 0 : 1];
    if (!option) return;

    // Update local state (for UI)
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: selection,
    }));

    // Update hook state (for validation)
    setAnswers(prev => ({ ...prev, [question.id]: option.id }));

    // Sync to backend
    syncAnswer(question.id, option.id, 'single');
  }, [questions, setAnswers, syncAnswer]);

  const goNext = useCallback(() => {
    if (!currentPageAnswered) return;
    if (currentPage < TOTAL_PAGES - 1) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  }, [currentPage, currentPageAnswered]);

  const goPrev = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  }, [currentPage]);

  const handleFinish = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  const handleConfirmSubmit = useCallback(() => {
    setShowConfirmModal(false);
    handleSubmit(false);
  }, [handleSubmit, setShowConfirmModal]);

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

  const answeredCount = Object.keys(selectedAnswers).length;
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === TOTAL_PAGES - 1;
  const progressPct = (answeredCount / 90) * 100;

  return (
    <TestLayout
      testTitle={testData.test_name}
      timeLeft={timeLeft}
      formatTime={formatTime}
      onTimeUp={() => handleSubmit(true)}
      isFullscreen={isFullscreen}
      isLocked={isLocked}
      onReturnFullscreen={enterFullscreen}
      showConfirmModal={showConfirmModal}
      setShowConfirmModal={setShowConfirmModal}
      onConfirmSubmit={handleConfirmSubmit}
      isSubmitting={isSubmitting}
      answeredCount={answeredCount}
      totalQuestions={90}
    >
      <div className="mx-auto max-w-3xl">
        {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Halaman {currentPage + 1} <span className="text-gray-400 font-normal">/ {TOTAL_PAGES}</span>
          </h2>
          <span className="text-sm tabular-nums text-gray-500">
            {answeredCount}/90 dijawab
          </span>
        </div>
        {/* Thin progress line */}
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-800 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Instruction */}
      <p className="text-sm text-gray-500 mb-5 italic">
        Pada setiap nomor, pilih satu pernyataan yang paling sesuai dengan diri Anda.
      </p>

      {/* Forced-Choice Items */}
      <div className="space-y-3">
        {pageItems.map(({ questionIndex, question }) => (
          <ForcedChoiceItem
            key={question.id}
            itemNumber={questionIndex + 1}
            statementA={question.settings?.statement_a || ''}
            statementB={question.settings?.statement_b || ''}
            selected={selectedAnswers[questionIndex]}
            onSelect={(sel) => handleSelect(questionIndex, sel)}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-200">
        <button
          onClick={goPrev}
          disabled={isFirstPage}
          className={`
            flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px]
            ${isFirstPage
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }
          `}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali
        </button>

        {isLastPage ? (
          <button
            onClick={handleFinish}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]"
          >
            Selesai
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        ) : (
          <button
            onClick={goNext}
            disabled={!currentPageAnswered}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px]
              ${currentPageAnswered
                ? 'bg-gray-900 hover:bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Lanjut
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      </div>{/* end max-w-3xl wrapper */}
    </TestLayout>
  );
}

/**
 * Forced-choice item: two statements in a split-card layout.
 * Clean divider between options, subtle selection state.
 */
function ForcedChoiceItem({ itemNumber, statementA, statementB, selected, onSelect }) {
  return (
    <div className={`
      bg-white rounded-lg border transition-all duration-200 overflow-hidden
      ${selected
        ? 'border-gray-300 shadow-sm'
        : 'border-gray-200 hover:border-gray-300'
      }
    `}>
      {/* Number bar */}
      <div className={`
        flex items-center gap-2 px-4 py-1.5 text-xs font-medium tracking-wide uppercase
        ${selected ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500'}
        transition-colors duration-200
      `}>
        <span className={`
          inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
          ${selected ? 'bg-white text-blue-600' : 'bg-gray-200 text-gray-600'}
        `}>
          {itemNumber}
        </span>
        <span>Pilih salah satu</span>
      </div>

      {/* Split options */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {/* Option A */}
        <button
          onClick={() => onSelect('a')}
          className={`
            flex items-start gap-3 p-4 text-left transition-all duration-150
            ${selected === 'a'
              ? 'bg-blue-50/60'
              : 'hover:bg-gray-50/50'
            }
          `}
        >
          <div className={`
            mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors
            ${selected === 'a'
              ? 'border-blue-600 bg-blue-600'
              : 'border-gray-300'
            }
          `}>
            {selected === 'a' && (
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            )}
          </div>
          <span className="text-[15px] leading-relaxed text-gray-800">{statementA}</span>
        </button>

        {/* Option B */}
        <button
          onClick={() => onSelect('b')}
          className={`
            flex items-start gap-3 p-4 text-left transition-all duration-150
            ${selected === 'b'
              ? 'bg-blue-50/60'
              : 'hover:bg-gray-50/50'
            }
          `}
        >
          <div className={`
            mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors
            ${selected === 'b'
              ? 'border-blue-600 bg-blue-600'
              : 'border-gray-300'
            }
          `}>
            {selected === 'b' && (
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            )}
          </div>
          <span className="text-[15px] leading-relaxed text-gray-800">{statementB}</span>
        </button>
      </div>
    </div>
  );
}

export default PapiKostickTest;
