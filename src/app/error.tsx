"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Runtime Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-zinc-100 font-sans">
      <div className="max-w-md w-full rounded-2xl bg-zinc-900/90 border border-zinc-800 p-8 text-center space-y-6 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/40">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Something unexpected occurred
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {error?.message || "An error occurred during session processing."}
          </p>
          {error?.digest && (
            <p className="text-[10px] font-mono text-zinc-500">
              Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-md shadow-indigo-900/30"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <a
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Reload Home
          </a>
        </div>
      </div>
    </div>
  );
}
