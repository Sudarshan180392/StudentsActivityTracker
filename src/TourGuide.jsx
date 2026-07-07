// ═══════════════════════════════════════════════════════════════
//  TOUR GUIDE — Interactive Onboarding Walkthrough
//  Highlights key features with spotlight overlay + animated tooltips
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';

const TOUR_STORAGE_KEY = 'upsc_tracker_tour_completed';

/* ─────────────────────── Tour Steps ─────────────────────── */

const TOUR_STEPS = [
  {
    target: null, // Welcome — no spotlight
    title: '👋 Welcome to UPSC Prep Tracker!',
    description: 'Let\'s take a quick tour of all the features that will supercharge your exam preparation. This will only take a minute!',
    position: 'center',
    icon: '🚀',
  },
  {
    target: '#tab-dashboard',
    title: '📊 Dashboard',
    description: 'Your command center! See total study hours, streak count, subject-wise distribution chart, 30-day heatmap, and export your data as PDF or JSON.',
    position: 'bottom',
    icon: '📊',
  },
  {
    target: '#tab-daysheet',
    title: '📅 Day Sheet',
    description: 'Plan and track your daily study sessions. Set target hours per subject, log actual hours, use the built-in stopwatch timer, and track wellbeing metrics.',
    position: 'bottom',
    icon: '📅',
  },
  {
    target: '#tab-summary',
    title: '📈 Summary',
    description: 'Get a bird\'s-eye view of your entire 30-day sprint with detailed charts, completion rates, and trends across all your subjects.',
    position: 'bottom',
    icon: '📈',
  },
  {
    target: '#tab-community',
    title: '🤝 Community',
    description: 'Connect with fellow aspirants! Share your daily progress, cheer others on, and climb the leaderboard together.',
    position: 'bottom',
    icon: '🤝',
  },
  {
    target: '#tab-mocks',
    title: '🎯 Mock Tests',
    description: 'Log your mock test scores with subject-wise breakdowns. Track improvement trends, estimate percentiles, and identify weak areas.',
    position: 'bottom',
    icon: '🎯',
  },
  {
    target: '#tab-ca',
    title: '📰 Current Affairs Log',
    description: 'Never miss an important topic! Log current affairs by category, mark them as revised, and filter by date or category for quick revision.',
    position: 'bottom',
    icon: '📰',
  },
  {
    target: '#tab-settings',
    title: '⚙️ Settings',
    description: 'Customize your exam date, manage subjects, update your profile for the community, and configure your tracker preferences.',
    position: 'bottom',
    icon: '⚙️',
  },
  {
    target: null, // Completion — no spotlight
    title: '🎉 You\'re All Set!',
    description: 'Start by heading to the Day Sheet to plan your first day. Consistency is the key — even 1 hour a day adds up! In case you still need help, contact on the email address at the end of the page. Best of luck for your journey. 🇮🇳',
    position: 'center',
    icon: '✨',
  },
];

/* ─────────────────────── Spotlight Overlay ─────────────────────── */

function SpotlightOverlay({ targetRect, onClick }) {
  if (!targetRect) {
    // Full-screen dimmed overlay for center steps
    return (
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-[2px] transition-all duration-500"
        onClick={onClick}
      />
    );
  }

  const padding = 8;
  const borderRadius = 14;
  const x = targetRect.left - padding;
  const y = targetRect.top - padding;
  const w = targetRect.width + padding * 2;
  const h = targetRect.height + padding * 2;

  return (
    <div className="fixed inset-0 z-[9998]" onClick={onClick}>
      <svg width="100%" height="100%" className="fixed inset-0">
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={x} y={y} width={w} height={h}
              rx={borderRadius} ry={borderRadius}
              fill="black"
              className="transition-all duration-500 ease-out"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-spotlight-mask)"
          style={{ backdropFilter: 'blur(2px)' }}
        />
      </svg>
      {/* Glowing ring around the spotlight */}
      <div
        className="fixed border-2 border-indigo-400/60 shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all duration-500 ease-out pointer-events-none"
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: borderRadius,
        }}
      />
    </div>
  );
}

/* ─────────────────────── Tooltip Bubble ─────────────────────── */

function TooltipBubble({
  step, stepIndex, totalSteps,
  targetRect, onNext, onPrev, onSkip,
}) {
  const bubbleRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!bubbleRef.current) return;
    const bubble = bubbleRef.current.getBoundingClientRect();

    if (step.position === 'center' || !targetRect) {
      // Center on screen
      setPos({
        top: Math.max(20, (window.innerHeight - bubble.height) / 2),
        left: Math.max(20, (window.innerWidth - bubble.width) / 2),
      });
      return;
    }

    const padding = 16;
    let top, left;

    // Position below the target by default
    top = targetRect.bottom + padding;
    left = targetRect.left + (targetRect.width / 2) - (bubble.width / 2);

    // If it goes off the bottom, place above
    if (top + bubble.height > window.innerHeight - 20) {
      top = targetRect.top - bubble.height - padding;
    }

    // Clamp horizontal
    left = Math.max(12, Math.min(left, window.innerWidth - bubble.width - 12));
    // Clamp vertical
    top = Math.max(12, top);

    setPos({ top, left });
  }, [targetRect, step.position]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div
      ref={bubbleRef}
      className="fixed z-[9999] w-[340px] max-w-[calc(100vw-24px)] tour-tooltip-enter"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-500/5 border border-slate-200/80 dark:border-slate-700/60 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-5">
          {/* Step Icon + Counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl tour-icon-bounce">{step.icon}</span>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-full">
              {stepIndex + 1}/{totalSteps}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-snug">
            {step.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
            {step.description}
          </p>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={onSkip}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors font-medium"
            >
              {isLast ? '' : 'Skip Tour'}
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={onPrev}
                  className="px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={onNext}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLast ? 'Get Started! 🚀' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Main Tour Guide ─────────────────────── */

export default function TourGuide({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const step = TOUR_STEPS[currentStep];

  // Measure the target element's position
  const measureTarget = useCallback(() => {
    if (!step?.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Scroll into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!isOpen) return;
    // Small delay to let layout settle
    const timer = setTimeout(measureTarget, 150);
    return () => clearTimeout(timer);
  }, [isOpen, currentStep, measureTarget]);

  // Re-measure on resize/scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => measureTarget();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, measureTarget]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Tour complete
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      setCurrentStep(0);
      onClose();
    }
  }, [currentStep, onClose]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setCurrentStep(0);
    onClose();
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  if (!isOpen) return null;

  return (
    <>
      <SpotlightOverlay targetRect={targetRect} onClick={() => {}} />
      <TooltipBubble
        step={step}
        stepIndex={currentStep}
        totalSteps={TOUR_STEPS.length}
        targetRect={targetRect}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
      />
    </>
  );
}

/* ─── Helper: Check if tour has been completed ─── */
export function isTourCompleted() {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/* ─── Helper: Reset tour (for re-triggering) ─── */
export function resetTour() {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // ignore
  }
}
