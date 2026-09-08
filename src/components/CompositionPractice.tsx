"use client";

import { useState, useEffect, useRef } from "react";
import {
  PenTool,
  Sparkles,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  XCircle,
  BookOpen,
  Copy,
  Check,
  Award,
  Layers,
  Lightbulb,
  History,
  ArrowRight,
  RotateCcw,
  Sparkle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { usePersistentState } from "@/lib/hooks/usePersistentState";

export interface TargetGrammar {
  id: string;
  jlpt_level: string;
  title: string;
  meaning: string;
  formation: string;
  bunpro_lesson_tag: string;
}

export interface TargetVocab {
  id: string;
  characters: string;
  meanings: { meaning: string; primary?: boolean }[];
  readings: { reading: string; primary?: boolean }[];
  level: number;
  srs_stage: number;
}

export interface ParticleMistake {
  particle: string;
  issue: string;
  correction: string;
}

export interface VocabFeedback {
  word: string;
  note: string;
}

export interface EvaluationResult {
  isCorrect: boolean;
  naturalAlternative: string;
  englishMeaning: string;
  grammarCritique: string;
  particleMistakes: ParticleMistake[];
  vocabFeedback: VocabFeedback[];
  overallScore: number;
}

export interface PracticeSession {
  id: string;
  mode: string;
  prompt_data: {
    scenario: string;
    targetGrammar?: TargetGrammar;
    targetVocab?: TargetVocab[];
  };
  user_submission: string;
  evaluation: EvaluationResult;
  created_at: string;
}

interface StoredCompositionState {
  scenario: string;
  hint: string | null;
  targetGrammar: TargetGrammar | null;
  targetVocab: TargetVocab[];
  userSubmission: string;
  evaluation: EvaluationResult | null;
  frontierKey?: string;
}

interface CompositionPracticeProps {
  userId?: string;
  activeLevel?: string;
  activeFrontier?: string;
}

const DEFAULT_COMPOSITION_STATE: StoredCompositionState = {
  scenario: "",
  hint: null,
  targetGrammar: null,
  targetVocab: [],
  userSubmission: "",
  evaluation: null,
};

export default function CompositionPractice({
  userId = "default-user",
  activeLevel = "N3",
  activeFrontier = "N3 Lesson 7",
}: CompositionPracticeProps) {
  const [storedData, setStoredData, isHydrated] = usePersistentState<StoredCompositionState>(
    `composition_state_${userId}`,
    DEFAULT_COMPOSITION_STATE
  );

  const [loadingPrompt, setLoadingPrompt] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [recentSessions, setRecentSessions] = useState<PracticeSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentFrontierKey = `${activeLevel}-${activeFrontier}`;

  // 1. Fetch recent practice sessions
  const loadRecentSessions = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch(
        `/api/practice/sessions?userId=${encodeURIComponent(userId)}&limit=8`
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

  // 2. Generate a new composition prompt
  const generateNewPrompt = async () => {
    try {
      setLoadingPrompt(true);
      setErrorMessage(null);

      const res = await fetch(
        `/api/practice/composition-prompt?userId=${encodeURIComponent(userId)}`
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 429) {
          throw new Error("Gemini API rate limit reached. Please wait a moment and try again.");
        }
        throw new Error(data.error || "Failed to generate composition scenario");
      }

      setStoredData({
        scenario: data.scenario,
        hint: data.hint || null,
        targetGrammar: data.targetGrammar,
        targetVocab: data.targetVocab || [],
        userSubmission: "",
        evaluation: null,
        frontierKey: currentFrontierKey,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating prompt";
      setErrorMessage(msg);
    } finally {
      setLoadingPrompt(false);
    }
  };

  // Initial load: Only generate if NO prompt exists in storage
  useEffect(() => {
    if (!isHydrated) return;
    loadRecentSessions();

    if (!storedData.scenario) {
      generateNewPrompt();
    }
  }, [isHydrated, userId]);

  // 3. Submit for Gemini evaluation
  const handleEvaluate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!storedData.userSubmission.trim() || evaluating) return;

    try {
      setEvaluating(true);
      setErrorMessage(null);

      const res = await fetch("/api/evaluate/composition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userSubmission: storedData.userSubmission.trim(),
          promptScenario: storedData.scenario,
          targetGrammarId: storedData.targetGrammar?.id,
          targetGrammar: storedData.targetGrammar,
          targetVocab: storedData.targetVocab,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 429) {
          throw new Error("Gemini rate limit exceeded. Please retry in a few seconds.");
        }
        throw new Error(data.error || "Evaluation failed");
      }

      setStoredData((prev) => ({
        ...prev,
        evaluation: data.evaluation,
      }));

      loadRecentSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to evaluate sentence";
      setErrorMessage(msg);
    } finally {
      setEvaluating(false);
    }
  };

  // Insert vocabulary into textarea at cursor or end
  const insertVocab = (word: string) => {
    const currentText = storedData.userSubmission;
    if (!textareaRef.current) {
      setStoredData((prev) => ({ ...prev, userSubmission: prev.userSubmission + word }));
      return;
    }
    const start = textareaRef.current.selectionStart || currentText.length;
    const end = textareaRef.current.selectionEnd || currentText.length;
    const next = currentText.substring(0, start) + word + currentText.substring(end);

    setStoredData((prev) => ({ ...prev, userSubmission: next }));
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          start + word.length,
          start + word.length
        );
      }
    }, 50);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const getScoreBadge = (score: number) => {
    if (score >= 9) {
      return {
        bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        label: "Exceptional / Native Natural",
        icon: Award,
      };
    } else if (score >= 7) {
      return {
        bg: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        label: "Strong / Minor Nuances",
        icon: CheckCircle2,
      };
    } else if (score >= 5) {
      return {
        bg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        label: "Understandable / Grammar Flaws",
        icon: AlertCircle,
      };
    } else {
      return {
        bg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        label: "Needs Work / Unnatural",
        icon: XCircle,
      };
    }
  };

  const isStaleFrontier =
    storedData.frontierKey && storedData.frontierKey !== currentFrontierKey;

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/90 p-5 sm:p-6 md:p-8 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20">
            <PenTool className="w-3.5 h-3.5" />
            Sentence Composition Studio
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Targeted Composition &amp; Gemini Critique
          </h2>
          <p className="text-xs text-zinc-400">
            Persistent exercise state &bull; Retains your prompt and unfinished drafts across tab switches.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={generateNewPrompt}
            disabled={loadingPrompt || evaluating}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            <Sparkles className={`w-3.5 h-3.5 ${loadingPrompt ? "animate-spin" : ""}`} />
            {loadingPrompt ? "Crafting Scenario..." : "Generate New Prompt"}
          </button>
        </div>
      </div>

      {/* Stale Frontier Warning Banner */}
      {isStaleFrontier && !loadingPrompt && (
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-700/50 text-indigo-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Your frontier updated to <strong>{activeFrontier}</strong>. Current exercise is calibrated for {storedData.frontierKey?.replace("-", " ")}.
            </span>
          </div>
          <button
            onClick={generateNewPrompt}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] shrink-0 cursor-pointer transition-colors"
          >
            Refresh for {activeLevel}
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Prompt Card with Loading Skeleton */}
      <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/90 p-5 md:p-6 space-y-4 relative overflow-hidden">
        {loadingPrompt ? (
          <div className="space-y-4 animate-pulse py-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-amber-500/20 rounded" />
              <div className="h-3 w-36 bg-zinc-800 rounded" />
            </div>
            <div className="h-6 w-3/4 bg-zinc-800 rounded" />
            <div className="h-4 w-1/2 bg-zinc-900 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-850">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="h-4 w-24 bg-zinc-800 rounded" />
                <div className="h-3 w-48 bg-zinc-800 rounded" />
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="h-4 w-28 bg-zinc-800 rounded" />
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-zinc-800 rounded-xl" />
                  <div className="h-8 w-24 bg-zinc-800 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Scenario Description */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                English Scenario Prompt
              </span>
              <p className="text-base md:text-lg font-semibold text-white leading-relaxed">
                {storedData.scenario || "Click 'Generate New Prompt' to begin your composition exercise."}
              </p>
              {storedData.hint && (
                <p className="text-xs text-zinc-400 italic">
                  💡 Hint: {storedData.hint}
                </p>
              )}
            </div>

            {/* Target Grammar & Required Vocab Badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-850">
              {/* Target Grammar */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Target Grammar Pattern
                </span>
                {storedData.targetGrammar ? (
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-base text-emerald-300 font-japanese">
                        {storedData.targetGrammar.title}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                        {storedData.targetGrammar.bunpro_lesson_tag}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 font-medium">{storedData.targetGrammar.meaning}</p>
                    <p className="text-[10px] font-mono text-indigo-300/90 bg-zinc-950/80 px-2 py-1 rounded border border-zinc-800/80">
                      {storedData.targetGrammar.formation}
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">None selected</div>
                )}
              </div>

              {/* Target Vocabulary */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  Suggested WaniKani Vocabulary (Click to Insert)
                </span>
                <div className="flex flex-wrap gap-2">
                  {storedData.targetVocab.map((v) => {
                    const primaryMeaning =
                      v.meanings?.find((m) => m.primary)?.meaning ||
                      v.meanings?.[0]?.meaning ||
                      "";
                    const primaryReading =
                      v.readings?.find((r) => r.primary)?.reading ||
                      v.readings?.[0]?.reading ||
                      "";
                    return (
                      <button
                        key={v.id || v.characters}
                        onClick={() => insertVocab(v.characters)}
                        type="button"
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-left transition-all hover:scale-[1.02] cursor-pointer flex flex-col justify-center group"
                        title="Click to insert into your sentence"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white font-japanese group-hover:text-indigo-300">
                            {v.characters}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-japanese">
                            ({primaryReading})
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 truncate max-w-[130px]">
                          {primaryMeaning}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Composition Input Form with IME & Safe Typography Attributes */}
      <form onSubmit={handleEvaluate} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>Your Japanese Sentence (IME / Japanese Input):</span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {storedData.userSubmission.length} characters &bull; Saved locally &bull; Press Ctrl+Enter to evaluate
            </span>
          </label>
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={storedData.userSubmission}
              onChange={(e) =>
                setStoredData((prev) => ({ ...prev, userSubmission: e.target.value }))
              }
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleEvaluate();
                }
              }}
              placeholder="ここに日本語で文を入力してください..."
              rows={3}
              lang="ja"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              inputMode="text"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-4 text-white text-base md:text-lg font-japanese focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600 resize-none shadow-inner"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStoredData((prev) => ({ ...prev, userSubmission: "" }))}
            disabled={!storedData.userSubmission || evaluating}
            className="min-h-[44px] px-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30 cursor-pointer"
          >
            Clear Text
          </button>

          <button
            type="submit"
            disabled={!storedData.userSubmission.trim() || evaluating}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-lg shadow-emerald-950/40 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {evaluating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Gemini Analyzing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Evaluate Sentence
              </>
            )}
          </button>
        </div>
      </form>

      {/* Evaluation Results Card with Smooth Skeletons */}
      {evaluating && (
        <div className="p-6 md:p-8 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4 animate-pulse">
          <div className="flex justify-between items-center pb-4 border-b border-zinc-800/80">
            <div className="h-6 w-48 bg-zinc-800 rounded-full" />
            <div className="h-10 w-32 bg-zinc-850 rounded-xl" />
          </div>
          <div className="h-16 w-full bg-indigo-950/30 border border-indigo-900/30 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-24 bg-zinc-900 rounded-xl" />
            <div className="h-24 bg-zinc-900 rounded-xl" />
          </div>
        </div>
      )}

      {storedData.evaluation && !evaluating && (
        <div className="rounded-2xl bg-zinc-950/90 border border-zinc-800/90 p-6 md:p-8 space-y-6 shadow-2xl animate-in fade-in duration-300">
          {/* Result Header & Score */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {(() => {
                  const badge = getScoreBadge(storedData.evaluation.overallScore);
                  const Icon = badge.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {badge.label}
                    </span>
                  );
                })()}
                {storedData.evaluation.isCorrect ? (
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
                    JLPT Rule Passed
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-rose-400 bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-800/40">
                    Corrections Required
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white">Gemini Detailed Linguistic Critique</h3>
            </div>

            <div className="flex items-center gap-4 self-start sm:self-auto">
              <div className="flex items-center gap-3 bg-zinc-900/80 px-4 py-2.5 rounded-2xl border border-zinc-800">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Overall Score
                  </div>
                  <div className="text-xs text-zinc-500 font-medium">JLPT Standard</div>
                </div>
                <div className="text-3xl font-black text-white">
                  <span
                    className={
                      storedData.evaluation.overallScore >= 8
                        ? "text-emerald-400"
                        : storedData.evaluation.overallScore >= 5
                        ? "text-amber-400"
                        : "text-rose-400"
                    }
                  >
                    {storedData.evaluation.overallScore}
                  </span>
                  <span className="text-sm font-normal text-zinc-500">/10</span>
                </div>
              </div>

              <button
                onClick={generateNewPrompt}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-900/30 cursor-pointer transition-all active:scale-[0.98]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Next Exercise
              </button>
            </div>
          </div>

          {/* Native Alternative Card */}
          <div className="p-4 md:p-5 rounded-xl bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-zinc-950 border border-indigo-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Native Japanese Expression
              </span>
              <button
                onClick={() => copyToClipboard(storedData.evaluation!.naturalAlternative)}
                className="min-h-[36px] px-2 text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-lg md:text-xl font-bold text-white font-japanese leading-relaxed">
              {storedData.evaluation.naturalAlternative}
            </p>
          </div>

          {/* Exact English Meaning Interpretation */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Literal English Meaning of Your Sentence:
            </span>
            <p className="text-sm text-zinc-200 italic leading-relaxed">
              &quot;{storedData.evaluation.englishMeaning}&quot;
            </p>
          </div>

          {/* Grammar Critique */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Target Grammar Usage Critique
            </span>
            <p className="text-sm text-zinc-200 leading-relaxed">
              {storedData.evaluation.grammarCritique}
            </p>
          </div>

          {/* Particle Mistakes Breakdown */}
          {storedData.evaluation.particleMistakes &&
            storedData.evaluation.particleMistakes.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Particle Adjustments
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {storedData.evaluation.particleMistakes.map((pm, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 text-xs flex items-start gap-3"
                    >
                      <span className="px-2 py-0.5 rounded font-bold font-japanese text-sm bg-rose-900/50 text-rose-200 border border-rose-700/50">
                        {pm.particle || "助詞"}
                      </span>
                      <div className="space-y-0.5 flex-1">
                        <p className="text-rose-200 font-medium">{pm.issue}</p>
                        <p className="text-emerald-300 font-semibold flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />
                          Correction: {pm.correction}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Vocabulary Feedback */}
          {storedData.evaluation.vocabFeedback &&
            storedData.evaluation.vocabFeedback.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                  Vocabulary Feedback
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {storedData.evaluation.vocabFeedback.map((vf, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs space-y-0.5"
                    >
                      <span className="font-bold text-zinc-200 font-japanese">
                        {vf.word}
                      </span>
                      <p className="text-zinc-400">{vf.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Collapsible Recent Submissions Drawer */}
      <div className="pt-2 border-t border-zinc-800">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="min-h-[44px] flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors py-2 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-400" />
            Recent Composition History ({recentSessions.length})
          </span>
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHistory && (
          <div className="mt-3 space-y-3">
            {loadingHistory ? (
              <div className="text-center py-6 text-xs text-zinc-500">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-zinc-400" />
                Loading submission history...
              </div>
            ) : recentSessions.length > 0 ? (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {recentSessions.map((session) => {
                  const evalData = session.evaluation;
                  const score = evalData?.overallScore ?? 0;
                  return (
                    <div
                      key={session.id}
                      className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs space-y-1.5 hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              score >= 8
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : score >= 5
                                ? "bg-amber-950 text-amber-300 border border-amber-800"
                                : "bg-rose-950 text-rose-300 border border-rose-800"
                            }`}
                          >
                            Score: {score}/10
                          </span>
                          <span className="text-zinc-400 font-mono text-[10px]">
                            {new Date(session.created_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {session.prompt_data?.targetGrammar && (
                          <span className="text-[10px] font-japanese font-bold text-emerald-400">
                            {session.prompt_data.targetGrammar.title}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-white font-japanese text-sm">
                        {session.user_submission}
                      </p>
                      {evalData?.naturalAlternative && (
                        <p className="text-indigo-300 text-[11px] font-japanese">
                          💡 Native: {evalData.naturalAlternative}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-zinc-500">
                No past composition sessions found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
