// client/src/hooks/useTestSession.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import Swal from 'sweetalert2';
import { useFullscreenLock } from './useFullscreenLock';

/**
 * Shared test session logic for all test types
 * @param {number} assignmentId - The assignment ID
 * @param {object} options - Additional options
 * @param {boolean} options.requireAllAnswers - Whether all questions must be answered
 * @param {function} options.formatAnswers - Function to format answers for submission
 * @param {function} options.onTestComplete - Callback when test is completed
 * @param {boolean} options.disableTimer - Disable the built-in timer (for tests with custom timers like Memory)
 */
export function useTestSession(assignmentId, options = {}) {
  const navigate = useNavigate();
  const { token } = useAuth();

  const {
    requireAllAnswers = true,
    formatAnswers = null,
    onTestComplete,
    disableTimer = false
  } = options;

  // Session storage key
  const sessionKey = `test_session_${assignmentId}`;

  // Test state
  const [testData, setTestData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  // Refs for stable callbacks
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

  // Fullscreen lock
  const { isLocked, isFullscreen, enterFullscreen, exitCount, setExitCount } = useFullscreenLock({
    assignmentId,
    token
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(sessionKey);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        console.log('🔄 Restored test session from storage:', parsed);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.currentQuestion !== undefined) setCurrentQuestion(parsed.currentQuestion);
        // Don't restore timeLeft from session - it will be set by loadTest effect
        // The timer will continue from where it should be based on elapsed time
      } catch (e) {
        console.error('Gagal memulihkan sesi:', e);
        localStorage.removeItem(sessionKey);
      }
    }
  }, [sessionKey]);

  // Save session to localStorage whenever state changes
  useEffect(() => {
    if (!testData) return; // Don't save until test data is loaded

    const sessionData = {
      answers,
      currentQuestion,
      timestamp: Date.now()
    };
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
  }, [answers, currentQuestion, testData, sessionKey]);

  // Load test data
  useEffect(() => {
    const loadTest = async () => {
      try {
        const res = await api.startTest(assignmentId);
        setTestData(res.data);
        setQuestions(res.data.questions || []);

        // Restore answers from server if local state is empty (e.g. first load on new device)
        if (Object.keys(answersRef.current).length === 0 && res.data.existing_answers) {
          console.log('☁️ Restored answers from server sync');
          setAnswers(res.data.existing_answers);
        }
        
        // Use remaining_time from backend if available (to handle refreshes)
        const initialTime = res.data.remaining_time ?? (res.data.time_limit === 0 ? null : res.data.time_limit);
        setTimeLeft(initialTime);
        
        setLoading(false);
        enterFullscreen();
      } catch (err) {
        console.error('Failed to load test:', err);
        setLoading(false);
        if (err.response?.status === 403 && err.response.data.detail.includes('locked')) {
          Swal.fire('Tes Terkunci', 'Anda terlalu sering keluar dari mode layar penuh.', 'error');
        } else {
          Swal.fire('Kesalahan', 'Gagal memuat tes. Harap coba lagi.', 'error');
        }
        navigate('/dashboard');
      }
    };
    loadTest();
  }, [assignmentId, enterFullscreen, navigate]);

  // Prevent context menu and dev tools
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

  // Prevent browser back button and tab navigation during test
  // Returns a cleanup function that can be called to disable the prevention
  const disableBackButtonPrevention = useRef(null);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Safari requires returnValue to be set to a non-empty string
      e.preventDefault();
      e.returnValue = 'You have unsaved changes';
      return e.returnValue;
    };

    // Push a state to the history stack to intercept back button
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // Push the state again to prevent navigation
      window.history.pushState(null, '', window.location.href);

      // Show warning
      Swal.fire({
        title: 'Tidak Bisa Kembali',
        text: 'Anda tidak dapat meninggalkan halaman ini saat tes sedang berlangsung.',
        icon: 'warning',
        confirmButtonText: 'OK',
        allowOutsideClick: false
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Store cleanup function for manual invocation
    disableBackButtonPrevention.current = () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Timer state for submission prevention
  const isSubmittingRef = useRef(false);

  // CountdownTimer owns the ticking state; keep the latest value without rerendering the page.
  const handleSubmitRef = useRef(null);
  const handleTimerTick = useCallback((seconds) => {
    timeLeftRef.current = seconds;
  }, []);

  // Submit test
  const handleSubmit = useCallback(async (isTimeout = false, overrideAnswers = null) => {
    if (isSubmittingRef.current) {
        return;
    }
    
    let currentAnswers;

    // Priority: 1) overrideAnswers, 2) formatAnswers() if provided (for custom answer storage like DISC), 3) answersRef.current
    // Note: formatAnswers is always used when provided (not just on timeout) to ensure proper answer formatting
    // This is critical for Safari which has stricter closure handling
    if (overrideAnswers !== null) {
      currentAnswers = overrideAnswers;
    } else if (formatAnswers) {
      // Always use the custom formatter when provided (for DISC, SpeedTest, etc.)
      currentAnswers = formatAnswers();
    } else {
      currentAnswers = answersRef.current;
    }
    
    const currentTestData = testDataRef.current;
    const currentTimeLeft = timeLeftRef.current;

    // Check if all questions answered
    if (requireAllAnswers && !isTimeout) {
      const missingIndices = (currentTestData?.questions || [])
        .map((q, idx) => {
          // Check if answered. Some tests (DISC) have complex answer structures
          const answer = answersRef.current[q.id];
          if (!answer) return idx;
          if (typeof answer === 'object' && (!answer.most || !answer.least)) return idx; // DISC check
          return null;
        })
        .filter(idx => idx !== null);

      if (missingIndices.length > 0) {
        Swal.fire({
          title: 'Jawaban Belum Lengkap',
          html: `Anda belum menjawab ${missingIndices.length} soal.<br/><br/><div class="text-sm font-mono bg-neutral-50 p-2 border border-neutral-200">Nomor: ${missingIndices.map(i => i + 1).join(', ')}</div>`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Lengkapi Jawaban',
          cancelButtonText: 'Batal',
          confirmButtonColor: '#0F172A',
        }).then((result) => {
          if (result.isConfirmed && options.onJump) {
            options.onJump(missingIndices[0]);
          }
        });
        return;
      }
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    const timeTaken = currentTestData?.time_limit === 0 ? 0 : (currentTestData?.time_limit || 0) - (currentTimeLeft ?? 0);

    try {
      // Format answers - if formatAnswers is provided, always use it (for DISC, etc.)
      let finalAnswers;
      if (overrideAnswers !== null) {
        // overrideAnswers is already in array format from SpeedTest
        finalAnswers = overrideAnswers;
      } else if (formatAnswers) {
        // formatAnswers returns array format directly (for DISC, etc.)
        finalAnswers = formatAnswers();
      } else {
        // Default: convert from { qId: optionId } to array format
        finalAnswers = Object.keys(currentAnswers).map(qId => ({
          question_id: parseInt(qId),
          option_id: currentAnswers[qId],
          type: 'single'
        }));
      }

      // Get device info
      const ua = navigator.userAgent;
      let deviceType = "Desktop";
      if (/Android/i.test(ua)) deviceType = "Android";
      else if (/iPhone|iPad|iPod/i.test(ua)) deviceType = "iOS";
      
      let browserName = "Unknown Browser";
      if (ua.indexOf("Chrome") > -1) browserName = "Chrome";
      else if (ua.indexOf("Safari") > -1) browserName = "Safari";
      else if (ua.indexOf("Firefox") > -1) browserName = "Firefox";
      else if (ua.indexOf("MSIE") > -1 || !!document.documentMode === true) browserName = "IE";
      
      const deviceInfo = `${deviceType} (${browserName})`;

      await api.submitTest(assignmentId, finalAnswers, timeTaken, deviceInfo);

      // Clear session storage on successful submission
      localStorage.removeItem(sessionKey);

      // Disable back button prevention before navigating
      if (disableBackButtonPrevention.current) {
        disableBackButtonPrevention.current();
      }

      // Clear all history states by replacing the current state
      window.history.replaceState(null, '', window.location.pathname);

      if (isTimeout) {
        Swal.fire({
          title: 'Waktu Habis',
          text: 'Tes telah dikirim otomatis.',
          icon: 'info',
          confirmButtonText: 'Kembali ke Dashboard',
          confirmButtonColor: '#0F172A',
          timer: 3000,
          timerProgressBar: true,
          allowOutsideClick: false
        }).then(() => {
          if (onTestComplete) {
            onTestComplete();
          } else {
            navigate('/dashboard', { replace: true });
          }
        });
      } else {
        Swal.fire({
          title: 'Tes Terkirim',
          text: 'Jawaban Anda telah berhasil dikirim.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#0F172A',
        }).then(() => {
          if (onTestComplete) {
            onTestComplete();
          } else {
            navigate('/dashboard', { replace: true });
          }
        });
      }
    } catch (err) {
      console.error('Failed to submit test:', err);
      setIsSubmitting(false);
      
      // Better error handling with Retry option
      Swal.fire({
        title: 'Gagal Mengirim',
        text: 'Terjadi kesalahan saat mengirim jawaban. Periksa koneksi internet Anda.',
        icon: 'error',
        showCancelButton: true,
        confirmButtonText: 'Coba Lagi',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#0F172A',
      }).then((result) => {
        if (result.isConfirmed) {
          handleSubmit(isTimeout, overrideAnswers);
        }
      });
    }
  }, [assignmentId, formatAnswers, requireAllAnswers, onTestComplete, navigate]);

  // Store handleSubmit in ref for timer access
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Format time
  const formatTime = useCallback((seconds) => {
    if (seconds === null || seconds === undefined) return '∞';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  return {
    // State
    testData,
    questions,
    answers,
    setAnswers,
    timeLeft,
    loading,
    isSubmitting,
    showConfirmModal,
    setShowConfirmModal,
    currentQuestion,
    setCurrentQuestion,

    // Fullscreen
    isLocked,
    isFullscreen,
    enterFullscreen,
    exitCount,

    // Actions
    handleSubmit,
    formatTime,
    onTimeTick: handleTimerTick,
    
    // Real-time Sync
    syncAnswer: async (qId, optionId, type = 'single') => {
      try {
        await api.saveAnswer(assignmentId, {
          question_id: qId,
          option_id: optionId,
          type: type
        });
      } catch (err) {
        console.error("Failed to sync answer to server:", err);
      }
    }
  };
}
