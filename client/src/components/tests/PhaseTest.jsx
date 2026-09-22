// client/src/components/tests/PhaseTest.jsx
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../utils/api';
import Swal from 'sweetalert2';
import { CountdownTimer } from './TestLayout';

const PhaseQuestionCard = memo(function PhaseQuestionCard({ question, multi, selectedAnswers, onSelect }) {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-2xl notranslate" translate="no">
      {multi && <p className="text-sm text-blue-600 font-medium mb-3 notranslate" translate="no">Pilih 2 jawaban</p>}
      <div className="text-base sm:text-lg font-semibold mb-6 leading-relaxed notranslate" translate="no" dangerouslySetInnerHTML={{ __html: question.content }} />
      <div className="space-y-3">
        {question.options?.map((option) => {
          const isSelected = selectedAnswers.includes(option.id);
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`w-full text-left px-4 py-3.5 border-2 rounded-lg transition-all min-h-[48px] flex items-center ${isSelected ? 'bg-blue-500 text-white border-blue-600 shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}
            >
              <span className="font-bold mr-3 flex-shrink-0 w-6 notranslate" translate="no">{option.label}.</span>
              <span className="flex-1 notranslate" translate="no" dangerouslySetInnerHTML={{ __html: option.content }} />
              {isSelected && <span className="ml-2 text-white flex-shrink-0">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}, (previous, next) => (
  previous.question.id === next.question.id &&
  previous.multi === next.multi &&
  previous.selectedAnswers.length === next.selectedAnswers.length &&
  previous.selectedAnswers.every((id, index) => id === next.selectedAnswers[index])
));

/**
 * Phase Test — Timed assessment with auto-advance (single) or manual (multi).
 * Light theme, matching the rest of the website.
 */
export function PhaseTest({ phase, assignmentId, onReturnToHub, isLocked, syncAnswer }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialTime, setInitialTime] = useState(phase.timer_seconds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState([]);

  // Refs for stable access in closures
  const allAnswersRef = useRef([]);
  const isSubmittingRef = useRef(false);
  const advanceTimerRef = useRef(null);
  const questionsRef = useRef([]);
  const currentIndexRef = useRef(0);
  const phaseRef = useRef(phase);

  // Keep refs in sync
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Load questions
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const res = await api.get(`/assignments/${assignmentId}/phase/${phase.id}/questions`);
        setQuestions(res.data.questions);
        questionsRef.current = res.data.questions;

        // Restore session
        const sessionKey = `iq_phase_${phase.id}_answers`;
        const saved = localStorage.getItem(sessionKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            allAnswersRef.current = parsed;
            setCurrentIndex(parsed.length);
            currentIndexRef.current = parsed.length;
          } catch (e) {
            console.error('Failed to restore session:', e);
          }
        }

        const endKey = `iq_phase_${phase.id}_end`;
        const savedEnd = localStorage.getItem(endKey);
        if (savedEnd) {
          const remaining = Math.floor((parseInt(savedEnd, 10) - Date.now()) / 1000);
          setInitialTime(remaining > 0 ? remaining : 0);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to load questions:', err);
        Swal.fire('Kesalahan', 'Gagal memuat soal.', 'error');
        onReturnToHub();
      }
    };
    loadQuestions();
  }, [phase, assignmentId, onReturnToHub]);

  // Prevent context menu
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if (e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j'].includes(e.key)) ||
          (e.ctrlKey && ['U', 'u'].includes(e.key))) {
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

  // Set/Initialize end time in localStorage on mount
  useEffect(() => {
    if (loading) return;
    const endKey = `iq_phase_${phase.id}_end`;
    const savedEnd = localStorage.getItem(endKey);
    if (!savedEnd) {
      const endTime = Date.now() + (phase.timer_seconds * 1000);
      localStorage.setItem(endKey, endTime.toString());
    }
  }, [loading, phase]);

  // Cleanup advance timer
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const isMultiQuestion = useCallback(() => {
    const q = questions[currentIndex];
    return q?.meta_data?.multi_select || false;
  }, [questions, currentIndex]);

  /**
   * Internal submit — uses refs to avoid stale closures.
   */
  const handleSubmitPhaseInternal = useCallback(async (isTimeout = false) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const answers = allAnswersRef.current;
    const qCount = questionsRef.current.length;
    const phaseId = phaseRef.current.id;

    if (!isTimeout && answers.length < qCount) {
      Swal.fire({
        title: 'Belum Lengkap',
        text: `Anda baru menjawab ${answers.length} dari ${qCount} pertanyaan.`,
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      isSubmittingRef.current = false;
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post(`/assignments/${assignmentId}/submit-phase`, {
        phase_id: phaseId,
        answers,
      });

      localStorage.removeItem(`iq_phase_${phaseId}_answers`);
      localStorage.removeItem(`iq_phase_${phaseId}_end`);

      if (isTimeout) {
        Swal.fire({
          title: 'Waktu Selesai',
          text: 'Jawaban fase ini telah disimpan otomatis.',
          icon: 'info',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false,
          allowOutsideClick: false
        }).then(() => {
          onReturnToHub();
        });
      } else {
        Swal.fire({
          title: 'Tes Selesai',
          text: 'Jawaban Anda telah berhasil dikirim.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          allowOutsideClick: false
        }).then(() => {
          onReturnToHub();
        });
      }
    } catch (err) {
      console.error('Failed to submit phase:', err);
      Swal.fire('Kesalahan', 'Gagal mengirim fase.', 'error');
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [assignmentId, onReturnToHub]);

  const handleSelect = useCallback((optionId) => {
    if (isMultiQuestion()) {
      setSelectedAnswers(prev => {
        if (prev.includes(optionId)) return prev.filter(id => id !== optionId);
        if (prev.length >= 2) return prev;
        
        // No auto-sync here yet, wait for manual "Next" button for multi-select
        return [...prev, optionId];
      });
    } else {
      // Single answer — save and auto-advance
      const q = questionsRef.current[currentIndexRef.current];
      const newAnswer = { question_id: q.id, option_id: optionId };

      const updated = [...allAnswersRef.current, newAnswer];
      allAnswersRef.current = updated;

      // Sync to backend
      if (syncAnswer) syncAnswer(q.id, optionId, 'single');

      // Save session
      const sessionKey = `iq_phase_${phaseRef.current.id}_answers`;
      localStorage.setItem(sessionKey, JSON.stringify(updated));

      // Advance after short delay
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        if (currentIndexRef.current < questionsRef.current.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          handleSubmitPhaseInternal(false);
        }
      }, 350);
    }
  }, [isMultiQuestion, handleSubmitPhaseInternal, syncAnswer]);

  const handleNext = useCallback(() => {
    if (selectedAnswers.length === 0) return;

    const q = questionsRef.current[currentIndexRef.current];
    const newAnswer = { question_id: q.id, option_ids: selectedAnswers };

    const updated = [...allAnswersRef.current, newAnswer];
    allAnswersRef.current = updated;

    const sessionKey = `iq_phase_${phaseRef.current.id}_answers`;
    localStorage.setItem(sessionKey, JSON.stringify(updated));

    // Sync multi-select to backend
    if (syncAnswer) syncAnswer(q.id, selectedAnswers.join(','), 'multi');

    setSelectedAnswers([]);

    if (currentIndexRef.current < questionsRef.current.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleSubmitPhaseInternal(false);
    }
  }, [selectedAnswers, handleSubmitPhaseInternal, syncAnswer]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Locked screen
  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center text-white p-4 z-50">
        <h2 className="text-2xl font-bold mb-4">Tes Terkunci</h2>
        <p className="mb-6 text-gray-300 text-center text-sm">Anda terlalu sering keluar dari mode layar penuh.</p>
        <button onClick={onReturnToHub} className="px-6 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition min-h-[48px]">
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

  if (questions.length === 0) return null;

  const q = questions[currentIndex];
  const multi = isMultiQuestion();
  const canProceed = multi ? selectedAnswers.length === 2 : selectedAnswers.length === 1;
  const pct = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col notranslate" translate="no">
      {/* Header */}
      <div className="bg-white shadow px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div>
          <p className="text-sm text-gray-500">Fase {phase.order_number}</p>
          <p className="font-semibold">
            Soal {currentIndex + 1}/{questions.length}
          </p>
        </div>
        <div className="text-xl font-mono bg-red-100 text-red-700 px-3 py-1 rounded">
          <CountdownTimer
            initialTime={initialTime}
            formatTime={formatTime}
            onTimeUp={() => handleSubmitPhaseInternal(true)}
            isActive={!isSubmitting && !isLocked && !loading}
          />
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 h-2">
        <div
          className="bg-blue-500 h-2 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
           <PhaseQuestionCard
             question={q}
             multi={multi}
             selectedAnswers={selectedAnswers}
             onSelect={handleSelect}
           />
      </div>

      {/* Footer — only for multi-select (single auto-advances) */}
      {multi && (
        <div className="bg-white border-t px-4 py-3 flex justify-end">
          <button
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className={`px-6 py-2.5 rounded-lg font-semibold transition min-h-[44px] ${
              canProceed && !isSubmitting
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {currentIndex < questions.length - 1 ? 'Selanjutnya' : 'Selesai'}
          </button>
        </div>
      )}
    </div>
  );
}

export default PhaseTest;
