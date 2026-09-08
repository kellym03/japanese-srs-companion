"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Layers,
  Sparkles,
  BookOpen,
  ArrowUpRight,
  Flame,
  ShieldCheck,
  Zap,
  PenTool,
  BookMarked,
  Smartphone,
  Download,
  Check,
  User,
  Settings,
} from "lucide-react";
import FrontierSelector from "@/components/FrontierSelector";
import CompositionPractice from "@/components/CompositionPractice";
import ReadingPractice from "@/components/ReadingPractice";

interface SyncedVocabItem {
  characters: string;
  meanings: { meaning: string; primary?: boolean }[];
  readings: { reading: string; primary?: boolean }[];
  level: number;
  srs_stage: number;
  last_synced_at: string;
}

interface SyncStats {
  count: number;
  userId: string;
  latestItems: SyncedVocabItem[];
}

interface SyncResult {
  success: boolean;
  totalSynced?: number;
  user?: {
    username: string;
    level: number;
  } | null;
  srsBreakdown?: {
    guru1: number;
    guru2: number;
    master: number;
    enlightened: number;
    burned: number;
  };
  durationMs?: number;
  error?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"reading" | "composition" | "frontier">("reading");
  const [userId, setUserId] = useState<string>("default-user");
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [inputUserId, setInputUserId] = useState<string>("");

  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeFrontier, setActiveFrontier] = useState<{ level: string; frontier: string }>({
    level: "N3",
    frontier: "N3 Lesson 7",
  });

  // Check PWA standalone mode and listen for install prompts & load stored userId
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("japanese_srs_user_id");
      if (stored) {
        setUserId(stored);
      }

      if (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
      ) {
        setIsInstalled(true);
      }

      window.addEventListener("beforeinstallprompt", (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e);
      });

      window.addEventListener("appinstalled", () => {
        setIsInstalled(true);
        setInstallPrompt(null);
      });
    }
  }, []);

  const handleSaveUserId = (newId: string) => {
    const trimmed = newId.trim() || "default-user";
    setUserId(trimmed);
    localStorage.setItem("japanese_srs_user_id", trimmed);
    setShowUserModal(false);
    loadStats(trimmed);
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  // Load existing sync stats from Supabase
  const loadStats = async (targetUser = userId) => {
    try {
      setLoadingStats(true);
      const res = await fetch(`/api/sync/wanikani?userId=${encodeURIComponent(targetUser)}`);
      const data = await res.json();
      if (data.success) {
        setStats(data);
      } else {
        setErrorMessage(data.error || "Failed to load database status");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMessage(msg);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats(userId);
  }, [userId]);

  // Trigger sync
  const handleSync = async () => {
    try {
      setSyncing(true);
      setErrorMessage(null);
      setSyncResult(null);

      const res = await fetch("/api/sync/wanikani", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to sync items from WaniKani");
      }

      setSyncResult(data);
      await loadStats(userId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setErrorMessage(msg);
    } finally {
      setSyncing(false);
    }
  };

  const getSrsLabel = (stage: number) => {
    switch (stage) {
      case 5:
        return { label: "Guru I", bg: "bg-purple-950/40 text-purple-300 border-purple-800/50" };
      case 6:
        return { label: "Guru II", bg: "bg-purple-900/40 text-purple-200 border-purple-700/50" };
      case 7:
        return { label: "Master", bg: "bg-blue-950/40 text-blue-300 border-blue-800/50" };
      case 8:
        return { label: "Enlightened", bg: "bg-cyan-950/40 text-cyan-300 border-cyan-800/50" };
      case 9:
        return { label: "Burned", bg: "bg-amber-950/40 text-amber-300 border-amber-800/50" };
      default:
        return { label: `Stage ${stage}`, bg: "bg-zinc-800 text-zinc-300 border-zinc-700" };
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 md:p-12 pb-24 md:pb-12 selection:bg-cyan-500/30 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-zinc-800/80 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1.5">
              <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
              Japanese Adaptive SRS Companion
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              Adaptive Practice Studio
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
              Supabase cross-device sync &bull; WaniKani Guru+ vocabulary &bull; Bunpro JLPT frontier &bull; Google Gemini evaluation.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* User Profile Sync Button */}
            <button
              onClick={() => {
                setInputUserId(userId);
                setShowUserModal(true);
              }}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
              title="Configure cross-device profile ID"
            >
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>User: <strong className="text-white">{userId}</strong></span>
            </button>

            {installPrompt && !isInstalled && (
              <button
                onClick={handleInstallClick}
                className="min-h-[38px] inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-cyan-950/40 cursor-pointer hover:opacity-95 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" />
                Install PWA
              </button>
            )}

            {isInstalled && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-xs font-semibold text-cyan-300">
                <Check className="w-3.5 h-3.5 text-cyan-400" />
                PWA Installed
              </div>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              Supabase &bull; Gemini 3.6
            </div>
          </div>
        </header>

        {/* User Profile ID Switcher Modal */}
        {showUserModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-2xl bg-zinc-900 border border-zinc-700 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cross-Device User Profile</h3>
                  <p className="text-xs text-zinc-400">Sync drafts and study frontier between devices.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Sync User ID:</label>
                <input
                  type="text"
                  value={inputUserId}
                  onChange={(e) => setInputUserId(e.target.value)}
                  placeholder="default-user"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <p className="text-[11px] text-zinc-500">
                  Enter the same User ID on your phone and desktop to share all active drafts and readings.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveUserId(inputUserId)}
                  className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer shadow-md shadow-cyan-900/30"
                >
                  Save &amp; Sync
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Practice Mode Tabs (Desktop / Tablet view) */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab("reading")}
              className={`min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                activeTab === "reading"
                  ? "bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-900/30"
                  : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              <BookMarked className="w-4 h-4" />
              Reading Comprehension
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-200 border border-cyan-800/50">
                5 Themes
              </span>
            </button>

            <button
              onClick={() => setActiveTab("composition")}
              className={`min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                activeTab === "composition"
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/30"
                  : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              <PenTool className="w-4 h-4" />
              Sentence Composition
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-200 border border-indigo-800/50">
                Targeted AI
              </span>
            </button>

            <button
              onClick={() => setActiveTab("frontier")}
              className={`min-h-[44px] hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                activeTab === "frontier"
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/30"
                  : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              <Layers className="w-4 h-4" />
              Study Frontier &amp; Sync
            </button>
          </div>

          <span className="hidden lg:inline-block text-xs font-mono text-zinc-500">
            Target: {activeFrontier.level} &bull; {activeFrontier.frontier}
          </span>
        </div>

        {/* Persistent Practice Views (Mounted simultaneously to prevent re-renders / re-fetching) */}
        <div className={activeTab === "reading" ? "block" : "hidden"}>
          <ReadingPractice
            userId={userId}
            activeLevel={activeFrontier.level}
            activeFrontier={activeFrontier.frontier}
          />
        </div>

        <div className={activeTab === "composition" ? "block" : "hidden"}>
          <CompositionPractice
            userId={userId}
            activeLevel={activeFrontier.level}
            activeFrontier={activeFrontier.frontier}
          />
        </div>

        {/* Study Frontier & WaniKani Section */}
        <div className={`space-y-8 ${activeTab === "frontier" ? "block" : "block"}`}>
          {/* Phase 2: Study Frontier Selector */}
          <FrontierSelector
            userId={userId}
            onFrontierChange={(level, frontier) =>
              setActiveFrontier({ level, frontier })
            }
          />

          {/* Phase 1: WaniKani Sync Trigger Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800/80 p-5 sm:p-6 md:p-8 shadow-xl">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 text-xs font-medium border border-indigo-500/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  WaniKani Vocabulary Ingestion
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Synchronize Guru+ Vocabulary Pool
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Fetches paginated assignments with SRS stages 5 through 9, pulls character definitions, readings, and meanings, and upserts them into your Supabase database table (<code className="font-mono text-zinc-300 text-xs bg-zinc-800 px-1 py-0.5 rounded">known_vocab</code>).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing WaniKani..." : "Run WaniKani Sync"}
                </button>
              </div>
            </div>

            {/* Sync Result Banner */}
            {syncResult && (
              <div className="mt-6 p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-sm flex items-start gap-3 animate-in fade-in duration-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-200">
                    Successfully synced {syncResult.totalSynced?.toLocaleString()} vocabulary items!
                  </p>
                  <p className="text-xs text-emerald-400/80">
                    User: <span className="font-semibold text-emerald-200">{syncResult.user?.username || "kellym03"}</span> (Level {syncResult.user?.level || 15}) &bull; Finished in {((syncResult.durationMs || 0) / 1000).toFixed(2)}s
                  </p>
                  {syncResult.srsBreakdown && (
                    <div className="flex flex-wrap gap-2 pt-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/50 text-purple-300">
                        Guru I: {syncResult.srsBreakdown.guru1}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-900/60 border border-purple-700/50 text-purple-200">
                        Guru II: {syncResult.srsBreakdown.guru2}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/50 text-blue-300">
                        Master: {syncResult.srsBreakdown.master}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 text-cyan-300">
                        Enlightened: {syncResult.srsBreakdown.enlightened}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300">
                        Burned: {syncResult.srsBreakdown.burned}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="mt-6 p-4 rounded-xl bg-red-950/30 border border-red-800/50 text-red-300 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-200">Error</p>
                  <p className="text-xs text-red-400/90">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>

          {/* Database Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Known Vocab (Guru+)</span>
                <BookOpen className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {loadingStats ? "..." : (stats?.count ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Stored in Supabase <code className="font-mono text-zinc-400">known_vocab</code>
              </div>
            </div>

            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Active Frontier Target</span>
                <Flame className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {activeFrontier.frontier}
              </div>
              <div className="text-xs text-zinc-500 mt-2">
                Calibrated to {activeFrontier.level} Grammar Tier
              </div>
            </div>

            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">PWA Status</span>
                <Smartphone className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-semibold text-white tracking-tight">
                {isInstalled ? "Installed (Standalone)" : "PWA Ready"}
              </div>
              <div className="text-xs text-zinc-500 mt-2">
                Offline-capable &bull; Responsive ergonomics
              </div>
            </div>
          </div>

          {/* Synced Items Sample Table */}
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div>
                <h3 className="font-semibold text-white text-base">Synced Vocabulary Items</h3>
                <p className="text-xs text-zinc-400">Sample of items currently in the database</p>
              </div>
              <button
                onClick={() => loadStats(userId)}
                disabled={loadingStats}
                className="min-h-[36px] px-2 text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingStats ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {loadingStats ? (
              <div className="p-12 text-center text-zinc-500 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                Loading synced items...
              </div>
            ) : stats && stats.latestItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-medium text-zinc-400">
                      <th className="py-3 px-6">Vocabulary</th>
                      <th className="py-3 px-6">Reading</th>
                      <th className="py-3 px-6">Meaning</th>
                      <th className="py-3 px-6">WK Level</th>
                      <th className="py-3 px-6">SRS Stage</th>
                      <th className="py-3 px-6">Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {stats.latestItems.map((item, idx) => {
                      const srs = getSrsLabel(item.srs_stage);
                      const primaryMeaning =
                        item.meanings?.find((m) => m.primary)?.meaning ||
                        item.meanings?.[0]?.meaning ||
                        "-";
                      const primaryReading =
                        item.readings?.find((r) => r.primary)?.reading ||
                        item.readings?.[0]?.reading ||
                        "-";

                      return (
                        <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3.5 px-6 font-bold text-lg text-white font-japanese">
                            {item.characters}
                          </td>
                          <td className="py-3.5 px-6 text-zinc-300 font-medium">
                            {primaryReading}
                          </td>
                          <td className="py-3.5 px-6 text-zinc-300">
                            {primaryMeaning}
                          </td>
                          <td className="py-3.5 px-6">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                              Lvl {item.level}
                            </span>
                          </td>
                          <td className="py-3.5 px-6">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${srs.bg}`}
                            >
                              {srs.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-xs text-zinc-500">
                            {new Date(item.last_synced_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-zinc-500 text-sm space-y-2">
                <BookOpen className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-zinc-400 font-medium">No vocabulary items synced yet</p>
                <p className="text-xs text-zinc-500">
                  Click &quot;Run WaniKani Sync&quot; above to ingest your Guru+ items.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar with Safe Area Padding */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/90 md:hidden pb-safe px-4 pt-2">
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab("reading")}
            className={`min-h-[48px] py-1.5 px-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeTab === "reading"
                ? "bg-cyan-600/20 text-cyan-300 font-bold border border-cyan-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <BookMarked className="w-4 h-4" />
            <span className="text-[10px]">Reading</span>
          </button>

          <button
            onClick={() => setActiveTab("composition")}
            className={`min-h-[48px] py-1.5 px-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeTab === "composition"
                ? "bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span className="text-[10px]">Composition</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("frontier");
              window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            }}
            className={`min-h-[48px] py-1.5 px-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeTab === "frontier"
                ? "bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-[10px]">Frontier</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
