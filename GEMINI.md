# Project: Japanese Adaptive SRS Production Companion

## 1. Project Overview & Objective
An adaptive Japanese practice application that syncs with WaniKani (SRS items) and Bunpro (JLPT grammar targets). It generates level-appropriate sentence composition exercises and reading comprehension passages, evaluating user submissions using Google Gemini via the Vercel AI SDK.

## 2. Target Tech Stack
- **Framework:** Next.js (App Router, React 19, TypeScript)
- **Styling:** Tailwind CSS + Lucide Icons
- **Database & Auth:** Supabase (PostgreSQL)
- **LLM Engine:** Vercel AI SDK (`ai` + `@ai-sdk/google`) with Zod structured output
- **Deployment:** Vercel (PWA enabled)

## 3. Core Architecture & Constraints
- **Multi-device / Free Tier:** Use Vercel free tier and Supabase free tier. Zero-cost footprint.
- **Provider Portability:** Always use the Vercel AI SDK abstraction (`generateObject`, `streamObject`) so switching from Gemini to Claude/OpenAI requires only swapping the provider import.
- **WaniKani Ingestion:** Pull `/assignments` and `/subjects` where SRS stage >= 5 (Guru+).
- **Bunpro Strategy:** Bunpro's public API is limited. Do NOT rely on scraping unversioned internal endpoints. Seed an explicit JLPT grammar list (N5 to N1 with lesson/unit mappings) and provide a manual "Current Study Frontier" selector (e.g., "N4 Lesson 5") alongside an optional API sync.
- **Evaluation Standard:** Always enforce strict JSON output for grammar critiques, particle corrections, and natural native alternatives.

## 4. Database Schema (Supabase / Postgres)
- `user_profiles`: `id`, `user_id`, `wk_api_token`, `current_jlpt_level`, `current_bunpro_lesson`, `created_at`
- `known_vocab`: `id`, `user_id`, `wk_subject_id`, `characters`, `readings` (jsonb), `meanings` (jsonb), `level`, `srs_stage`, `last_synced_at`
- `grammar_points`: `id`, `jlpt_level` (N5-N1), `title`, `meaning`, `structure`, `bunpro_lesson_tag`
- `practice_sessions`: `id`, `user_id`, `type` ('composition' | 'reading'), `prompt_data` (jsonb), `user_submission` (text), `evaluation` (jsonb), `created_at`

## 5. Development Phases for Antigravity Agent
- **Phase 1:** Supabase schema migration and WaniKani sync route (`/api/sync/wanikani`).
- **Phase 2:** JLPT grammar seed loader + Frontier selector UI.
- **Phase 3:** Composition generation & evaluation engine (`/api/evaluate/composition`).
- **Phase 4:** Reading passage generator with furigana/ruby tag annotations.
- **Phase 5:** PWA manifest setup and mobile-responsive polish.