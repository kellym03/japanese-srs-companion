"use client";

import { useState, useEffect } from "react";
import {
  Compass,
  CheckCircle2,
  AlertCircle,
  Database,
  Sparkles,
  BookOpen,
  Layers,
  RefreshCw,
  Lock,
  Unlock,
  GraduationCap,
  Check,
  TrendingUp,
} from "lucide-react";

export interface GrammarPoint {
  id: string;
  jlpt_level: string;
  title: string;
  meaning: string;
  formation: string;
  bunpro_lesson_tag: string;
}

export interface UserProfile {
  id?: string;
  user_id: string;
  target_jlpt_level: string;
  current_bunpro_frontier: string;
}

interface FrontierSelectorProps {
  userId?: string;
  onFrontierChange?: (level: string, frontier: string) => void;
}

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

// 10 Lessons for all JLPT tiers matching Bunpro's actual curriculum structure
const LESSON_METADATA: Record<
  string,
  { tag: string; lessonNum: number; title: string; label: string }[]
> = {
  N5: [
    { tag: "N5.1", lessonNum: 1, label: "N5 Lesson 1", title: "Foundations & Copula" },
    { tag: "N5.2", lessonNum: 2, label: "N5 Lesson 2", title: "Core Particles & Basic Verbs" },
    { tag: "N5.3", lessonNum: 3, label: "N5 Lesson 3", title: "Adjectives & Desires" },
    { tag: "N5.4", lessonNum: 4, label: "N5 Lesson 4", title: "Te-Form Connections & Rules" },
    { tag: "N5.5", lessonNum: 5, label: "N5 Lesson 5", title: "Experience & Comparisons" },
    { tag: "N5.6", lessonNum: 6, label: "N5 Lesson 6", title: "Quotes & Decisions" },
    { tag: "N5.7", lessonNum: 7, label: "N5 Lesson 7", title: "Giving/Receiving & Purpose" },
    { tag: "N5.8", lessonNum: 8, label: "N5 Lesson 8", title: "Frequency & Conditionals" },
    { tag: "N5.9", lessonNum: 9, label: "N5 Lesson 9", title: "Counters & Degree Adverbs" },
    { tag: "N5.10", lessonNum: 10, label: "N5 Lesson 10", title: "Time Relations & Quantifiers" },
  ],
  N4: [
    { tag: "N4.1", lessonNum: 1, label: "N4 Lesson 1", title: "Nuance Te-Forms & Auxiliaries" },
    { tag: "N4.2", lessonNum: 2, label: "N4 Lesson 2", title: "Verb Voices & Conditionals" },
    { tag: "N4.3", lessonNum: 3, label: "N4 Lesson 3", title: "Contrast, Purpose & Expectations" },
    { tag: "N4.4", lessonNum: 4, label: "N4 Lesson 4", title: "Benefactives & Commands" },
    { tag: "N4.5", lessonNum: 5, label: "N4 Lesson 5", title: "Likeness, Suffixes & Limiting" },
    { tag: "N4.6", lessonNum: 6, label: "N4 Lesson 6", title: "Compound Verbs & State Continuations" },
    { tag: "N4.7", lessonNum: 7, label: "N4 Lesson 7", title: "Explanations & Formal Relational Markers" },
    { tag: "N4.8", lessonNum: 8, label: "N4 Lesson 8", title: "Discourse Triggers & Contrastive Connectors" },
    { tag: "N4.9", lessonNum: 9, label: "N4 Lesson 9", title: "Certainty, Propensities & Suffix Markers" },
    { tag: "N4.10", lessonNum: 10, label: "N4 Lesson 10", title: "Inevitable Actions & Temporal Moments" },
  ],
  N3: [
    { tag: "N3.1", lessonNum: 1, label: "N3 Lesson 1", title: "Fundamental Relations & Viewpoints" },
    { tag: "N3.2", lessonNum: 2, label: "N3 Lesson 2", title: "Logical Conviction & Objective Proof" },
    { tag: "N3.3", lessonNum: 3, label: "N3 Lesson 3", title: "Emotional Intensity & Extreme Expressions" },
    { tag: "N3.4", lessonNum: 4, label: "N3 Lesson 4", title: "Temporal Sequence, Change & Progression" },
    { tag: "N3.5", lessonNum: 5, label: "N3 Lesson 5", title: "Contextual Comparison & Purpose Triggers" },
    { tag: "N3.6", lessonNum: 6, label: "N3 Lesson 6", title: "Conditionals, Concessions & Parallel Themes" },
    { tag: "N3.7", lessonNum: 7, label: "N3 Lesson 7", title: "Speaker Stance, Contrast & Nuances" },
    { tag: "N3.8", lessonNum: 8, label: "N3 Lesson 8", title: "Causality, Inevitability & Strict Obligations" },
    { tag: "N3.9", lessonNum: 9, label: "N3 Lesson 9", title: "Degrees, Limitations & Psychological Resonance" },
    { tag: "N3.10", lessonNum: 10, label: "N3 Lesson 10", title: "Formal Master Expressions & Boundaries" },
  ],
  N2: [
    { tag: "N2.1", lessonNum: 1, label: "N2 Lesson 1", title: "Advanced Relationships & Topics" },
    { tag: "N2.2", lessonNum: 2, label: "N2 Lesson 2", title: "Complex Conditionals & Concessions" },
    { tag: "N2.3", lessonNum: 3, label: "N2 Lesson 3", title: "Degrees, Bounds & Psychological Tendencies" },
    { tag: "N2.4", lessonNum: 4, label: "N2 Lesson 4", title: "Temporal Simultaneity & Triggers" },
    { tag: "N2.5", lessonNum: 5, label: "N2 Lesson 5", title: "Extreme Emphasis & Unique Stances" },
    { tag: "N2.6", lessonNum: 6, label: "N2 Lesson 6", title: "Formal Causes, Reasons & Excuses" },
    { tag: "N2.7", lessonNum: 7, label: "N2 Lesson 7", title: "Exclusions, Additions & Contrasts" },
    { tag: "N2.8", lessonNum: 8, label: "N2 Lesson 8", title: "Determinations & Personal Evaluations" },
    { tag: "N2.9", lessonNum: 9, label: "N2 Lesson 9", title: "Advanced Auxiliary & Compound Forms" },
    { tag: "N2.10", lessonNum: 10, label: "N2 Lesson 10", title: "Formal Discourse Mastery" },
  ],
  N1: [
    { tag: "N1.1", lessonNum: 1, label: "N1 Lesson 1", title: "High-Formal & Written Relationships" },
    { tag: "N1.2", lessonNum: 2, label: "N1 Lesson 2", title: "Classical & Archaic Sentence Endings" },
    { tag: "N1.3", lessonNum: 3, label: "N1 Lesson 3", title: "Supreme Degrees & Incomparable Qualities" },
    { tag: "N1.4", lessonNum: 4, label: "N1 Lesson 4", title: "Extreme Hypotheses & Inevitable Concessions" },
    { tag: "N1.5", lessonNum: 5, label: "N1 Lesson 5", title: "Immediate Sequences & Critical Moments" },
    { tag: "N1.6", lessonNum: 6, label: "N1 Lesson 6", title: "Nuanced Speaker Conviction & Evaluation" },
    { tag: "N1.7", lessonNum: 7, label: "N1 Lesson 7", title: "Complete Inability & Formal Denial" },
    { tag: "N1.8", lessonNum: 8, label: "N1 Lesson 8", title: "Deep Psychological & Literary Resonance" },
    { tag: "N1.9", lessonNum: 9, label: "N1 Lesson 9", title: "Rigorous Structural Symmetry & Contrast" },
    { tag: "N1.10", lessonNum: 10, label: "N1 Lesson 10", title: "Literary & Native Fluency Pinnacle" },
  ],
};

export default function FrontierSelector({
  userId = "default-user",
  onFrontierChange,
}: FrontierSelectorProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>("N3");
  const [selectedFrontier, setSelectedFrontier] = useState<string>("N3 Lesson 7");
  const [grammarPoints, setGrammarPoints] = useState<GrammarPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch Profile and Grammar Data
  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // Fetch Profile
      const profileRes = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
      const profileJson = await profileRes.json();
      if (profileJson.success && profileJson.profile) {
        const lvl = profileJson.profile.target_jlpt_level || "N3";
        const frontier = profileJson.profile.current_bunpro_frontier || "N3 Lesson 7";
        setSelectedLevel(lvl);
        setSelectedFrontier(frontier);
        if (onFrontierChange) onFrontierChange(lvl, frontier);
      }

      // Fetch Grammar Points
      const grammarRes = await fetch("/api/grammar/seed");
      const grammarJson = await grammarRes.json();
      if (grammarJson.success && grammarJson.points) {
        setGrammarPoints(grammarJson.points);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load frontier state";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  // 2. Handle Seeding Grammar
  const handleSeedGrammar = async () => {
    try {
      setSeeding(true);
      setErrorMessage(null);
      const res = await fetch("/api/grammar/seed?clean=true", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to seed grammar");
      }
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Seeding failed";
      setErrorMessage(msg);
    } finally {
      setSeeding(false);
    }
  };

  // 3. Save Frontier Updates
  const saveFrontier = async (level: string, frontier: string) => {
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          target_jlpt_level: level,
          current_bunpro_frontier: frontier,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2000);
        if (onFrontierChange) onFrontierChange(level, frontier);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save profile";
      setErrorMessage(msg);
    }
  };

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level);
    const availableLessons = LESSON_METADATA[level] || [];
    // Default to Lesson 7 if N3, or Lesson 1 otherwise
    const defaultLesson =
      level === "N3"
        ? availableLessons.find((l) => l.lessonNum === 7) || availableLessons[0]
        : availableLessons[0];
    const newFrontier = defaultLesson?.label || `${level} Lesson 1`;
    setSelectedFrontier(newFrontier);
    saveFrontier(level, newFrontier);
  };

  const handleFrontierChange = (frontier: string) => {
    setSelectedFrontier(frontier);
    saveFrontier(selectedLevel, frontier);
  };

  // Calculate frontier unlocking logic
  const currentLessons = LESSON_METADATA[selectedLevel] || [];
  const activeLessonMeta =
    currentLessons.find((l) => l.label === selectedFrontier) || currentLessons[0];
  const activeLessonNum = activeLessonMeta ? activeLessonMeta.lessonNum : 1;

  // Level ranks: N5=1, N4=2, N3=3, N2=4, N1=5
  const levelRank: Record<string, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
  const currentLevelRank = levelRank[selectedLevel] || 1;

  const isPointUnlocked = (point: GrammarPoint) => {
    const pointRank = levelRank[point.jlpt_level] || 99;
    if (pointRank < currentLevelRank) {
      return true; // Mastered lower levels
    }
    if (pointRank === currentLevelRank) {
      const tagMatch = point.bunpro_lesson_tag.match(/\.([0-9]+)/);
      const pointLessonNum = tagMatch ? parseInt(tagMatch[1], 10) : 1;
      return pointLessonNum <= activeLessonNum;
    }
    return false;
  };

  const unlockedPoints = grammarPoints.filter(isPointUnlocked);
  const currentLevelPoints = grammarPoints.filter((p) => p.jlpt_level === selectedLevel);
  const currentLevelUnlocked = currentLevelPoints.filter(isPointUnlocked);
  const currentLevelRemaining = currentLevelPoints.length - currentLevelUnlocked.length;
  const progressPercent =
    currentLevelPoints.length > 0
      ? Math.round((currentLevelUnlocked.length / currentLevelPoints.length) * 100)
      : 0;

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/90 p-6 md:p-8 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <Compass className="w-3.5 h-3.5" />
            Phase 2: Adaptive Grammar Frontier
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            JLPT &amp; Bunpro Study Horizon
          </h2>
          <p className="text-xs text-zinc-400">
            Full curriculum (N5–N1) with calibrated lesson frontiers for AI sentence generation and adaptive practice.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {savedToast && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-xs font-medium animate-in fade-in duration-200">
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          <button
            onClick={handleSeedGrammar}
            disabled={seeding || loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 transition-colors disabled:opacity-50 cursor-pointer"
            title="Re-seed complete 950+ grammar dataset"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${seeding ? "animate-spin text-emerald-400" : ""}`} />
            {seeding ? "Re-seeding 950+ Items..." : "Refresh Seed"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Frontier Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* JLPT Level Selector */}
        <div className="md:col-span-4 space-y-3">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-indigo-400" />
            Target JLPT Level
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {JLPT_LEVELS.map((lvl) => {
              const isSelected = selectedLevel === lvl;
              const pointsInLevel = grammarPoints.filter((p) => p.jlpt_level === lvl).length;
              return (
                <button
                  key={lvl}
                  onClick={() => handleLevelChange(lvl)}
                  className={`flex flex-col items-center justify-center py-3 px-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer border ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                      : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  <span className="text-sm font-extrabold">{lvl}</span>
                  <span className="text-[10px] font-normal opacity-75 mt-0.5">
                    {pointsInLevel > 0 ? `${pointsInLevel}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-zinc-500 leading-normal">
            Mastery includes all preceding JLPT tiers + active lessons in {selectedLevel}.
          </p>
        </div>

        {/* Bunpro Frontier Selector */}
        <div className="md:col-span-8 space-y-3">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              Active Bunpro Lesson Frontier
            </span>
            <span className="text-emerald-400 font-mono text-xs font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
              {selectedFrontier}
            </span>
          </label>

          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {currentLessons.map((lesson) => {
                const isCurrent = lesson.label === selectedFrontier;
                const isPassed = lesson.lessonNum < activeLessonNum;
                return (
                  <button
                    key={lesson.tag}
                    onClick={() => handleFrontierChange(lesson.label)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 border flex flex-col items-center justify-center gap-1 cursor-pointer text-center ${
                      isCurrent
                        ? "bg-emerald-600/30 text-emerald-200 border-emerald-500/80 shadow-md shadow-emerald-900/30 font-bold"
                        : isPassed
                        ? "bg-zinc-800/80 text-zinc-300 border-zinc-700/60 hover:bg-zinc-800"
                        : "bg-zinc-950/40 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {isCurrent ? (
                        <Unlock className="w-3 h-3 text-emerald-400" />
                      ) : isPassed ? (
                        <CheckCircle2 className="w-3 h-3 text-zinc-400" />
                      ) : (
                        <Lock className="w-3 h-3 text-zinc-600" />
                      )}
                      <span>L{lesson.lessonNum}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeLessonMeta && (
              <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80 text-xs flex items-center justify-between">
                <span className="text-zinc-400">Current Unit Topic:</span>
                <span className="font-semibold text-zinc-200">{activeLessonMeta.title}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Frontier Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 p-4 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span>Total Unlocked Grammar Pool</span>
            <Unlock className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {unlockedPoints.length} <span className="text-xs font-normal text-zinc-400">active points</span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Available for sentence composition &amp; reading generation
          </p>
        </div>

        <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 p-4 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
            <span>{selectedLevel} Progress</span>
            <span className="font-bold">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500 pt-1">
            <span>{currentLevelUnlocked.length} in level</span>
            <span>{currentLevelRemaining} remaining</span>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 p-4 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span>Total JLPT Curriculum</span>
            <Database className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {grammarPoints.length} <span className="text-xs font-normal text-zinc-400">seeded points</span>
          </div>
          <p className="text-[11px] text-zinc-500">
            N5 (135) &bull; N4 (190) &bull; N3 (220) &bull; N2 (221) &bull; N1 (187)
          </p>
        </div>
      </div>

      {/* Grammar Points Preview Drawer */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            Grammar Points in {selectedLevel} ({currentLevelUnlocked.length} / {currentLevelPoints.length} Active)
          </h3>
          <span className="text-[11px] text-zinc-500">
            Unlocked up to {selectedFrontier}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            Loading grammar points...
          </div>
        ) : currentLevelPoints.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            {currentLevelPoints.map((point) => {
              const unlocked = isPointUnlocked(point);
              return (
                <div
                  key={point.id}
                  className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-1.5 ${
                    unlocked
                      ? "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-200"
                      : "bg-zinc-950/20 border-zinc-900 text-zinc-600 opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-white font-japanese">
                      {point.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {point.bunpro_lesson_tag}
                      </span>
                      {unlocked ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
                          <Unlock className="w-2.5 h-2.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-600 font-medium px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          <Lock className="w-2.5 h-2.5" />
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-1">
                    {point.meaning}
                  </p>
                  <p className="text-[10px] font-mono text-indigo-300/80 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800/60 truncate">
                    {point.formation}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-zinc-500 rounded-xl bg-zinc-950/40 border border-zinc-800 space-y-2">
            <p>No grammar points found for {selectedLevel}.</p>
            <button
              onClick={handleSeedGrammar}
              className="text-emerald-400 hover:underline font-semibold cursor-pointer"
            >
              Re-seed Grammar Points
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
