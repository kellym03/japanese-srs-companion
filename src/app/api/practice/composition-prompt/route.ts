import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateObjectWithFallback } from "@/lib/ai/gemini";
import { z } from "zod";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "default-user";
    const supabase = createAdminClient();

    // 1. Fetch user's active frontier
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("target_jlpt_level, current_bunpro_frontier")
      .eq("user_id", userId)
      .maybeSingle();

    const targetLevel = profile?.target_jlpt_level || "N3";
    const currentFrontier = profile?.current_bunpro_frontier || "N3 Lesson 7";

    // Extract lesson number from frontier e.g. "N3 Lesson 7" -> 7
    const lessonMatch = currentFrontier.match(/Lesson\s+([0-9]+)/i);
    const activeLessonNum = lessonMatch ? parseInt(lessonMatch[1], 10) : 7;
    const activeLessonTag = `${targetLevel}.${activeLessonNum}`;

    // 2. Fetch grammar points at or near active frontier
    let { data: grammarCandidates } = await supabase
      .from("grammar_points")
      .select("id, jlpt_level, title, meaning, formation, bunpro_lesson_tag")
      .eq("jlpt_level", targetLevel)
      .eq("bunpro_lesson_tag", activeLessonTag);

    if (!grammarCandidates || grammarCandidates.length === 0) {
      const { data: fallbackCandidates } = await supabase
        .from("grammar_points")
        .select("id, jlpt_level, title, meaning, formation, bunpro_lesson_tag")
        .eq("jlpt_level", targetLevel);
      grammarCandidates = fallbackCandidates || [];
    }

    if (grammarCandidates.length === 0) {
      const { data: anyGrammar } = await supabase
        .from("grammar_points")
        .select("id, jlpt_level, title, meaning, formation, bunpro_lesson_tag")
        .limit(20);
      grammarCandidates = anyGrammar || [];
    }

    if (grammarCandidates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No grammar points found in database. Please seed grammar points first." },
        { status: 400 }
      );
    }

    const targetGrammar =
      grammarCandidates[Math.floor(Math.random() * grammarCandidates.length)];

    // 3. Fetch 2-3 random vocabulary words from known_vocab (srs_stage >= 5)
    const { data: vocabPool } = await supabase
      .from("known_vocab")
      .select("id, characters, meanings, readings, level, srs_stage")
      .gte("srs_stage", 5)
      .limit(200);

    let targetVocab: Array<{
      id: string;
      characters: string;
      meanings: { meaning: string; primary?: boolean }[];
      readings: { reading: string; primary?: boolean }[];
      level: number;
      srs_stage: number;
    }> = [];

    if (vocabPool && vocabPool.length > 0) {
      const shuffled = [...vocabPool].sort(() => 0.5 - Math.random());
      targetVocab = shuffled.slice(0, Math.min(3, shuffled.length));
    } else {
      targetVocab = [
        {
          id: "default-1",
          characters: "勉強",
          meanings: [{ meaning: "Study", primary: true }],
          readings: [{ reading: "べんきょう", primary: true }],
          level: 3,
          srs_stage: 5,
        },
        {
          id: "default-2",
          characters: "時間",
          meanings: [{ meaning: "Time", primary: true }],
          readings: [{ reading: "じかん", primary: true }],
          level: 3,
          srs_stage: 5,
        },
      ];
    }

    // 4. Generate an engaging English scenario using Gemini
    const vocabListText = targetVocab
      .map(
        (v) =>
          `${v.characters} (${v.readings?.[0]?.reading || ""}: ${
            v.meanings?.[0]?.meaning || ""
          })`
      )
      .join(", ");

    const promptGeneratorSchema = z.object({
      scenario: z
        .string()
        .describe(
          "A clear, creative English prompt instructing the student on what specific situation or thought to express in Japanese"
        ),
      hint: z
        .string()
        .describe("A brief helpful tip on phrasing or situational nuance"),
    });

    try {
      const { object: scenarioData, modelUsed, fallbackOccurred } =
        await generateObjectWithFallback({
          schema: promptGeneratorSchema,
          prompt: `Generate a realistic everyday Japanese composition scenario for a JLPT ${targetLevel} student.
Target Grammar Point: ${targetGrammar.title} (${targetGrammar.meaning})
Formation rule: ${targetGrammar.formation}
Required/Suggested Vocabulary: ${vocabListText}

Create a prompt in English (1-2 sentences) instructing the user to express a situation where using this grammar pattern and these vocabulary words is completely natural. Provide an encouraging, concise situation.`,
        });

      return NextResponse.json({
        success: true,
        scenario: scenarioData.scenario,
        hint: scenarioData.hint,
        targetGrammar,
        targetVocab,
        userFrontier: {
          level: targetLevel,
          frontier: currentFrontier,
          lessonTag: activeLessonTag,
        },
        aiMeta: {
          modelUsed,
          fallbackOccurred,
        },
      });
    } catch (aiErr: unknown) {
      console.warn(
        "[composition-prompt] AI models exhausted or unavailable, using deterministic template fallback:",
        aiErr instanceof Error ? aiErr.message : aiErr
      );

      // Fallback static scenario if generation times out or all AI models fail
      const vocabWord1 = targetVocab[0]?.characters || "言葉";
      const vocabWord2 = targetVocab[1]?.characters || "会話";
      const fallbackScenario = `Express a situation where you explain or remark on something using ${targetGrammar.title} (${targetGrammar.meaning}), incorporating "${vocabWord1}" and "${vocabWord2}".`;

      return NextResponse.json({
        success: true,
        scenario: fallbackScenario,
        hint: `Remember the formation: ${targetGrammar.formation}`,
        targetGrammar,
        targetVocab,
        userFrontier: {
          level: targetLevel,
          frontier: currentFrontier,
          lessonTag: activeLessonTag,
        },
        aiMeta: {
          modelUsed: "offline-fallback-template",
          fallbackOccurred: true,
        },
      });
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to generate composition prompt";
    const isRateLimit =
      (error as any)?.status === 429 ||
      /429|quota|rate limit|ResourceExhausted/i.test(message);

    return NextResponse.json(
      {
        success: false,
        rateLimited: isRateLimit,
        retryAfterSeconds: isRateLimit ? 30 : undefined,
        error: isRateLimit
          ? "Gemini API rate limit reached (Free Tier). Please wait a few seconds before retrying."
          : message,
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
