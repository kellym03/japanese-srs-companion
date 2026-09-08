"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Sparkles,
  RefreshCw,
  AlertCircle,
  XCircle,
  ChevronDown,
  Languages,
  Eye,
  EyeOff,
  Award,
  History,
  Check,
  Compass,
  Bookmark,
  Type,
  RotateCcw,
  Sparkle,
  HelpCircle,
  ChevronUp,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { ReadingPassage } from "@/lib/ai/gemini";
import { usePersistentState } from "@/lib/hooks/usePersistentState";

interface QuestionResult {
  questionId: number;
  question: string;
  selectedIndex: number;
  selectedOption: string;
  correctOptionIndex: number;
  correctOption: string;
  isCorrect: boolean;
  explanation: string;
}

interface ReadingEvaluation {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  breakdown: QuestionResult[];
}

interface ReadingPracticeSession {
  id: string;
  mode: string;
  prompt_data: ReadingPassage;
  user_submission: string;
  evaluation: ReadingEvaluation;
  created_at: string;
}

export interface ThemeState {
  passageData: ReadingPassage | null;
  selectedAnswers: Record<number, number>;
  evaluation: ReadingEvaluation | null;
  showTranslation: boolean;
  frontierKey?: string;
}

export interface StoredReadingState {
  activeThemeId: string;
  passagesByTheme: Record<string, ThemeState>;
  fontSize: "sm" | "md" | "lg";
}

interface ReadingPracticeProps {
  userId?: string;
  activeLevel?: string;
  activeFrontier?: string;
}

export const TOPIC_PRESETS = [
  { id: "daily-life", label: "Daily Life & Routines", prompt: "A realistic daily life situation or dilemma in modern Japan" },
  { id: "travel", label: "Travel & Exploration", prompt: "A travel story exploring a historic town, onsen, or scenic spot in Japan" },
  { id: "work-study", label: "Work & Study", prompt: "A conversational scenario or diary entry about work, study, or career challenges" },
  { id: "food-culture", label: "Food & Traditions", prompt: "A story about Japanese cuisine, dining etiquette, or traditional seasonal festivals" },
  { id: "technology", label: "Hobbies & Society", prompt: "An article or discussion about hobbies, modern technology, and society" },
];

const DEFAULT_THEME_STATE: ThemeState = {
  passageData: null,
  selectedAnswers: {},
  evaluation: null,
  showTranslation: false,
};

const DEFAULT_READING_STATE: StoredReadingState = {
  activeThemeId: TOPIC_PRESETS[0].id,
  passagesByTheme: {
    [TOPIC_PRESETS[0].id]: { ...DEFAULT_THEME_STATE },
  },
  fontSize: "md",
};

export default function ReadingPractice({
  userId = "default-user",
  activeLevel = "N3",
  activeFrontier = "N3 Lesson 7",
}: ReadingPracticeProps) {
  const [storedData, setStoredData, isHydrated] = usePersistentState<StoredReadingState>(
    `reading_state_${userId}`,
    DEFAULT_READING_STATE
  );

  const [loadingPassage, setLoadingPassage] = useState<boolean>(false);
  const [submittingAnswers, setSubmittingAnswers] = useState<boolean>(false);
  const [showGlossary, setShowGlossary] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const [recentSessions, setRecentSessions] = useState<ReadingPracticeSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const currentFrontierKey = `${activeLevel}-${activeFrontier}`;

  // Find active preset and state
  const activeThemeId = storedData.activeThemeId || TOPIC_PRESETS[0].id;
  const activePreset =
    TOPIC_PRESETS.find((p) => p.id === activeThemeId) || TOPIC_PRESETS[0];
  const currentThemeState: ThemeState =
    storedData.passagesByTheme?.[activeThemeId] || { ...DEFAULT_THEME_STATE };

  // 1. Fetch reading sessions history
  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch(
        `/api/practice/sessions?userId=${encodeURIComponent(userId)}&mode=reading&limit=6`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setRecentSessions(data.sessions);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingHistory(false);
    }
  };

  // 2. Generate a new reading passage scoped strictly to the specified or active theme
  const generatePassage = async (targetThemeId?: string) => {
    const themeToGenerate = targetThemeId || activeThemeId;
    const preset =
      TOPIC_PRESETS.find((p) => p.id === themeToGenerate) || TOPIC_PRESETS[0];

    try {
      setLoadingPassage(true);
      setErrorMessage(null);

      const res = await fetch("/api/practice/reading-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          topic: preset.prompt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 429) {
          throw new Error("Gemini rate limit reached. Please wait a few seconds before generating another story.");
        }
        throw new Error(data.error || "Failed to generate reading passage");
      }

      setStoredData((prev) => {
        const prevThemes = prev.passagesByTheme || {};
        return {
          ...prev,
          activeThemeId: themeToGenerate,
          passagesByTheme: {
            ...prevThemes,
            [themeToGenerate]: {
              passageData: data.readingPassage,
              selectedAnswers: {},
              evaluation: null,
              showTranslation: false,
              frontierKey: currentFrontierKey,
            },
          },
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error generating passage";
      setErrorMessage(msg);
    } finally {
      setLoadingPassage(false);
    }
  };

  // Initial load: Only auto-generate if active theme has no cached passage AND no themes exist
  useEffect(() => {
    if (!isHydrated) return;
    loadHistory();

    const hasAnyPassage = Object.values(storedData.passagesByTheme || {}).some(
      (t) => t?.passageData !== null && t?.passageData !== undefined
    );

    if (!hasAnyPassage && !currentThemeState.passageData) {
      generatePassage(activeThemeId);
    }
  }, [isHydrated, userId]);

  // 3. Switch active theme tab
  const handleSelectTheme = (themeId: string) => {
    setStoredData((prev) => ({
      ...prev,
      activeThemeId: themeId,
    }));
    setErrorMessage(null);
  };

  // 4. Invalidate all cached themes with confirmation
  const confirmResetAllThemes = () => {
    setShowResetConfirm(false);
    setStoredData((prev) => ({
      ...prev,
      passagesByTheme: {},
    }));
    generatePassage(activeThemeId);
  };

  // 5. Submit multiple-choice answers for grading (scoped to active theme)
  const handleSubmitAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentThemeState.passageData || submittingAnswers) return;

    // Check if all questions have been answered
    const unanswered = currentThemeState.passageData.questions.filter(
      (q) => currentThemeState.selectedAnswers[q.id] === undefined
    );
    if (unanswered.length > 0) {
      setErrorMessage(
        `Please answer all ${currentThemeState.passageData.questions.length} questions before submitting.`
      );
      return;
    }

    try {
      setSubmittingAnswers(true);
      setErrorMessage(null);

      const res = await fetch("/api/practice/reading-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          passageData: currentThemeState.passageData,
          selectedAnswers: currentThemeState.selectedAnswers,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 429) {
          throw new Error("Gemini rate limit exceeded. Please retry in a few seconds.");
        }
        throw new Error(data.error || "Failed to submit answers");
      }

      setStoredData((prev) => {
        const prevThemes = prev.passagesByTheme || {};
        const current = prevThemes[activeThemeId] || { ...DEFAULT_THEME_STATE };
        return {
          ...prev,
          passagesByTheme: {
            ...prevThemes,
            [activeThemeId]: {
              ...current,
              evaluation: data.evaluation,
            },
          },
        };
      });

      loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Grading error";
      setErrorMessage(msg);
    } finally {
      setSubmittingAnswers(false);
    }
  };

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    if (currentThemeState.evaluation) return; // Prevent changing after evaluation
    setStoredData((prev) => {
      const prevThemes = prev.passagesByTheme || {};
      const current = prevThemes[activeThemeId] || { ...DEFAULT_THEME_STATE };
      return {
        ...prev,
        passagesByTheme: {
          ...prevThemes,
          [activeThemeId]: {
            ...current,
            selectedAnswers: {
              ...current.selectedAnswers,
              [questionId]: optionIndex,
            },
          },
        },
      };
    });
  };

  const toggleTranslation = () => {
    setStoredData((prev) => {
      const prevThemes = prev.passagesByTheme || {};
      const current = prevThemes[activeThemeId] || { ...DEFAULT_THEME_STATE };
      return {
        ...prev,
        passagesByTheme: {
          ...prevThemes,
          [activeThemeId]: {
            ...current,
            showTranslation: !current.showTranslation,
          },
        },
      };
    });
  };

  const fontSizeClass = {
    sm: "text-base leading-relaxed",
    md: "text-lg leading-loose",
    lg: "text-xl leading-loose",
  }[storedData.fontSize || "md"];

  const isStaleFrontier =
    currentThemeState.frontierKey &&
    currentThemeState.frontierKey !== currentFrontierKey;

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/90 p-5 sm:p-6 md:p-8 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-semibold border border-cyan-500/20">
            <BookOpen className="w-3.5 h-3.5" />
            Reading Comprehension Studio
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Context-Restricted Reading &amp; Interpretation
          </h2>
          <p className="text-xs text-zinc-400">
            Independent theme cache &bull; Passages and quiz progress are saved per scenario theme.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => generatePassage(activeThemeId)}
            disabled={loadingPassage || submittingAnswers}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/30 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            <Sparkles className={`w-3.5 h-3.5 ${loadingPassage ? "animate-spin" : ""}`} />
            {loadingPassage
              ? "Generating Passage..."
              : currentThemeState.passageData
              ? `Regenerate "${activePreset.label}"`
              : `Generate "${activePreset.label}"`}
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Resetting All Themes */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-zinc-900 border border-zinc-700 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset All Theme Passages?</h3>
                <p className="text-xs text-zinc-400">This will clear stored passages across all 5 themes.</p>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Your cached stories, answers, and evaluations will be cleared and freshly regenerated for your current frontier (<strong>{activeFrontier}</strong>).
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetAllThemes}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer shadow-md shadow-rose-900/30"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stale Frontier Warning Banner */}
      {isStaleFrontier && !loadingPassage && (
        <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-700/50 text-cyan-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Your frontier updated to <strong>{activeFrontier}</strong>. Current passage was generated for {currentThemeState.frontierKey?.replace("-", " ")}.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => generatePassage(activeThemeId)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] cursor-pointer transition-colors"
            >
              Refresh Active Theme
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-[11px] cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3 text-zinc-400" />
              Reset All Themes
            </button>
          </div>
        </div>
      )}

      {/* Topic Preset Chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Reading Scenario Themes:
          </span>
          <span className="text-[11px] text-zinc-500">
            Each theme maintains its own persistent passage and answers
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TOPIC_PRESETS.map((preset) => {
            const isSelected = activeThemeId === preset.id;
            const themeCached = storedData.passagesByTheme?.[preset.id];
            const hasPassage = Boolean(themeCached?.passageData);
            const isEvaluated = Boolean(themeCached?.evaluation);

            return (
              <button
                key={preset.id}
                onClick={() => handleSelectTheme(preset.id)}
                disabled={loadingPassage || submittingAnswers}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-medium transition-all border cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? "bg-cyan-600/30 text-cyan-200 border-cyan-500/80 shadow-md shadow-cyan-900/30 font-bold"
                    : "bg-zinc-950/50 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                <span>{preset.label}</span>
                {isEvaluated ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" title="Completed & Evaluated" />
                ) : hasPassage ? (
                  <span className="w-2 h-2 rounded-full bg-cyan-400" title="Passage Ready" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Passage Container with Loading Skeletons */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/90 p-5 sm:p-6 md:p-8 space-y-6 shadow-inner">
        {loadingPassage ? (
          <div className="space-y-6 animate-pulse py-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-cyan-950/60 rounded" />
                <div className="h-7 w-64 bg-zinc-800 rounded-lg" />
              </div>
              <div className="h-9 w-44 bg-zinc-900 rounded-lg" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full bg-zinc-850 rounded" />
              <div className="h-4 w-11/12 bg-zinc-850 rounded" />
              <div className="h-4 w-4/5 bg-zinc-850 rounded" />
              <div className="h-4 w-full bg-zinc-850 rounded" />
              <div className="h-4 w-3/4 bg-zinc-850 rounded" />
            </div>
            <div className="pt-4 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="h-14 bg-zinc-900 rounded-xl" />
              <div className="h-14 bg-zinc-900 rounded-xl" />
              <div className="h-14 bg-zinc-900 rounded-xl" />
            </div>
          </div>
        ) : currentThemeState.passageData ? (
          <>
            {/* Passage Controls & Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 font-semibold">
                    JLPT {activeLevel} Comprehension
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {activePreset.label}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white font-japanese tracking-tight">
                  {currentThemeState.passageData.title}
                </h3>
              </div>

              {/* Typography & Translation Controls */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 text-xs text-zinc-400">
                  <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <Type className="w-3 h-3 inline mr-1" />
                    Size
                  </span>
                  {(["sm", "md", "lg"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() =>
                        setStoredData((prev) => ({ ...prev, fontSize: size }))
                      }
                      className={`min-h-[32px] min-w-[32px] px-2.5 py-1 rounded font-bold uppercase text-[10px] cursor-pointer transition-colors ${
                        (storedData.fontSize || "md") === size
                          ? "bg-cyan-600 text-white"
                          : "hover:text-zinc-200"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <button
                  onClick={toggleTranslation}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    currentThemeState.showTranslation
                      ? "bg-indigo-600/30 text-indigo-200 border-indigo-500/80"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                  title="Toggle English reference translation"
                >
                  {currentThemeState.showTranslation ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {currentThemeState.showTranslation ? "Hide English" : "English Translation"}
                  </span>
                </button>
              </div>
            </div>

            {/* Japanese Passage Body */}
            <div className="space-y-4">
              <div
                className={`font-japanese text-zinc-100 font-normal tracking-wide select-text whitespace-pre-wrap ${fontSizeClass}`}
              >
                {currentThemeState.passageData.passage}
              </div>

              {/* English Reference Translation Drawer */}
              {currentThemeState.showTranslation && (
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-800/40 text-xs md:text-sm text-indigo-200/90 leading-relaxed italic animate-in fade-in duration-200">
                  <div className="font-bold text-indigo-300 not-italic text-xs mb-1 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5" />
                    English Reference Translation:
                  </div>
                  {currentThemeState.passageData.englishTranslation}
                </div>
              )}
            </div>

            {/* Furigana / Stretch Vocabulary Glossary */}
            {currentThemeState.passageData.furiganaGlossary &&
              currentThemeState.passageData.furiganaGlossary.length > 0 && (
                <div className="pt-4 border-t border-zinc-850 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
                      Vocabulary &amp; Stretch Terms Glossary (
                      {currentThemeState.passageData.furiganaGlossary.length})
                    </span>
                    <button
                      onClick={() => setShowGlossary(!showGlossary)}
                      className="min-h-[36px] px-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showGlossary ? "Collapse" : "Expand"}
                    </button>
                  </div>

                  {showGlossary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {currentThemeState.passageData.furiganaGlossary.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 text-xs space-y-0.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white font-japanese">
                              {item.kanji}
                            </span>
                            <span className="text-[10px] text-cyan-300 font-japanese font-medium">
                              【{item.kana}】
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {item.englishMeaning}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            {/* Comprehension Questions Section */}
            <form onSubmit={handleSubmitAnswers} className="pt-6 border-t border-zinc-800 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  Reading Comprehension Questions
                </h4>
                <span className="text-xs text-zinc-400">
                  {Object.keys(currentThemeState.selectedAnswers).length} /{" "}
                  {currentThemeState.passageData.questions.length} Answered (Saved in {activePreset.label})
                </span>
              </div>

              <div className="space-y-6">
                {currentThemeState.passageData.questions.map((q, qIndex) => {
                  const selected = currentThemeState.selectedAnswers[q.id];
                  const qEval = currentThemeState.evaluation?.breakdown?.find(
                    (b) => b.questionId === q.id
                  );

                  return (
                    <div
                      key={q.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        qEval
                          ? qEval.isCorrect
                            ? "bg-emerald-950/20 border-emerald-800/50"
                            : "bg-rose-950/20 border-rose-800/50"
                          : "bg-zinc-900/50 border-zinc-800/80"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold text-sm text-white font-japanese leading-relaxed">
                            Q{qIndex + 1}. {q.question}
                          </span>
                          {qEval && (
                            <span
                              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                qEval.isCorrect
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-rose-950 text-rose-300 border border-rose-800"
                              }`}
                            >
                              {qEval.isCorrect ? (
                                <>
                                  <Check className="w-3 h-3" /> Correct
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" /> Incorrect
                                </>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Options Grid with 44px min height touch ergonomics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {q.options.map((opt, optIndex) => {
                            const isSelected = selected === optIndex;
                            const isCorrectChoice = q.correctOptionIndex === optIndex;
                            const showCorrectHighlight = currentThemeState.evaluation && isCorrectChoice;
                            const showIncorrectHighlight =
                              currentThemeState.evaluation && isSelected && !isCorrectChoice;

                            return (
                              <button
                                key={optIndex}
                                type="button"
                                onClick={() => handleSelectOption(q.id, optIndex)}
                                disabled={Boolean(currentThemeState.evaluation)}
                                className={`min-h-[48px] p-3 rounded-xl border text-left text-xs font-japanese transition-all flex items-start gap-2.5 cursor-pointer ${
                                  showCorrectHighlight
                                    ? "bg-emerald-950/80 border-emerald-600 text-emerald-100 font-bold ring-1 ring-emerald-500"
                                    : showIncorrectHighlight
                                    ? "bg-rose-950/80 border-rose-600 text-rose-100 font-bold"
                                    : isSelected
                                    ? "bg-cyan-600/30 border-cyan-500 text-white font-semibold ring-1 ring-cyan-500/50"
                                    : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white"
                                }`}
                              >
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                    showCorrectHighlight
                                      ? "bg-emerald-500 text-black"
                                      : showIncorrectHighlight
                                      ? "bg-rose-500 text-white"
                                      : isSelected
                                      ? "bg-cyan-500 text-black"
                                      : "bg-zinc-800 text-zinc-400"
                                  }`}
                                >
                                  {["A", "B", "C", "D"][optIndex]}
                                </span>
                                <span className="leading-snug pt-0.5">{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Question Explanation after grading */}
                        {qEval && (
                          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-300 space-y-1">
                            <span className="font-semibold text-cyan-400 text-[11px] uppercase tracking-wider">
                              Explanation:
                            </span>
                            <p className="leading-relaxed">{qEval.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Submit / Reset Actions */}
              <div className="flex items-center justify-between pt-2">
                {currentThemeState.evaluation ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
                      <Award className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-zinc-400">Score ({activePreset.label}):</span>
                      <span className="text-base font-black text-white">
                        {currentThemeState.evaluation.score} / {currentThemeState.evaluation.total} (
                        {currentThemeState.evaluation.percentage}%)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => generatePassage(activeThemeId)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-900/40 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Next {activePreset.label} Passage
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={submittingAnswers}
                    className="min-h-[48px] inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-950/40 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer ml-auto"
                  >
                    {submittingAnswers ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Grading Answers...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Submit Answers for Grading
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </>
        ) : (
          <div className="py-14 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h4 className="text-base font-bold text-white">
                No passage loaded for &ldquo;{activePreset.label}&rdquo;
              </h4>
              <p className="text-xs text-zinc-400">
                {activePreset.prompt}. Generate a customized story for this scenario.
              </p>
            </div>
            <button
              onClick={() => generatePassage(activeThemeId)}
              disabled={loadingPassage}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Generate &ldquo;{activePreset.label}&rdquo; Passage
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Recent Reading Submissions Drawer */}
      <div className="pt-2 border-t border-zinc-800">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="min-h-[44px] flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors py-2 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-400" />
            Recent Reading Comprehension History ({recentSessions.length})
          </span>
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHistory && (
          <div className="mt-3 space-y-2.5">
            {loadingHistory ? (
              <div className="text-center py-6 text-xs text-zinc-500">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-zinc-400" />
                Loading history...
              </div>
            ) : recentSessions.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {recentSessions.map((session) => {
                  const evalData = session.evaluation;
                  return (
                    <div
                      key={session.id}
                      className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs flex items-center justify-between gap-4 hover:border-zinc-700 transition-all"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-white font-japanese truncate block">
                          {session.prompt_data?.title || "Reading Passage"}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {new Date(session.created_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            (evalData?.percentage ?? 0) >= 66
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-rose-950 text-rose-300 border border-rose-800"
                          }`}
                        >
                          {evalData?.score ?? 0} / {evalData?.total ?? 3} (
                          {evalData?.percentage ?? 0}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-zinc-500">
                No past reading sessions found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
