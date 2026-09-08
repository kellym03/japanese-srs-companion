import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { compositionModel, ReadingPassageSchema } from "@/lib/ai/gemini";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let topic = "Daily Life in Japan";
    let userId = "default-user";

    try {
      const body = await req.json();
      if (body.topic) topic = body.topic;
      if (body.userId) userId = body.userId;
    } catch {
      // Body may be empty
    }

    const searchParams = req.nextUrl.searchParams;
    if (searchParams.get("topic")) topic = searchParams.get("topic") || topic;
    if (searchParams.get("userId")) userId = searchParams.get("userId") || userId;

    const supabase = createAdminClient();

    // 1. Fetch user's active frontier
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("target_jlpt_level, current_bunpro_frontier")
      .eq("user_id", userId)
      .maybeSingle();

    const targetLevel = profile?.target_jlpt_level || "N3";
    const currentFrontier = profile?.current_bunpro_frontier || "N3 Lesson 7";

    // 2. Fetch sample of Guru+ vocab from known_vocab
    const { data: vocabPool } = await supabase
      .from("known_vocab")
      .select("characters, readings, meanings, level")
      .gte("srs_stage", 5)
      .limit(60);

    const sampleVocabList = (vocabPool || [])
      .slice(0, 15)
      .map((v) => `${v.characters} (${v.readings?.[0]?.reading || ""})`)
      .join(", ");

    // 3. Fetch grammar points up to current level
    const { data: grammarPool } = await supabase
      .from("grammar_points")
      .select("title, bunpro_lesson_tag")
      .eq("jlpt_level", targetLevel)
      .limit(30);

    const grammarTags = (grammarPool || []).map((g) => g.title).join(", ");

    // 4. Determine target character length
    const charRange =
      targetLevel === "N5" || targetLevel === "N4"
        ? "150–250 Japanese characters"
        : "300–450 Japanese characters";

    // 5. Generate reading passage with Gemini
    const systemPrompt = `You are a master JLPT reading passage creator and Japanese pedagogue.
Create an authentic, culturally rich, and engaging Japanese reading passage calibrated precisely for a JLPT ${targetLevel} learner (Active Frontier: ${currentFrontier}).
- Passage length must be strictly around ${charRange}.
- Use natural, everyday Japanese sentences. Keep sentence structures and conjugations calibrated to ${targetLevel} grammar.
- Incorporate natural instances of known vocabulary and level-appropriate grammar patterns.
- If you use any stretch words or kanji that are advanced for ${targetLevel}, define them in the furiganaGlossary.
- Generate 2 to 3 reading comprehension questions with 4 distinct options each (0-indexed correct option). Questions should test true comprehension (main idea, character motivation, detail recall, or contextual inference).
- Provide a clean, complete English reference translation of the whole passage.`;

    const userPrompt = `
Topic / Scenario Theme: "${topic}"
Target JLPT Tier: ${targetLevel}
Student Active Frontier: ${currentFrontier}
Sample Known Vocabulary: ${sampleVocabList || "General everyday Japanese vocabulary"}
Representative ${targetLevel} Grammar: ${grammarTags || "Standard " + targetLevel + " patterns"}

Generate a complete, high-quality Japanese reading comprehension passage with glossary and questions.
`;

    try {
      const { object: readingPassage } = await generateObject({
        model: compositionModel,
        schema: ReadingPassageSchema,
        system: systemPrompt,
        prompt: userPrompt,
      });

      return NextResponse.json({
        success: true,
        readingPassage,
        userFrontier: {
          level: targetLevel,
          frontier: currentFrontier,
        },
        topic,
      });
    } catch (aiErr: unknown) {
      const isRateLimit =
        (aiErr as any)?.status === 429 ||
        /429|quota|rate limit|ResourceExhausted/i.test(
          aiErr instanceof Error ? aiErr.message : ""
        );

      if (isRateLimit) {
        return NextResponse.json(
          {
            success: false,
            rateLimited: true,
            retryAfterSeconds: 30,
            error:
              "Gemini API rate limit reached (Free Tier). Please wait a few moments before generating a new story.",
          },
          { status: 429 }
        );
      }
      throw aiErr;
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to generate reading passage";
    const isRateLimit =
      (error as any)?.status === 429 ||
      /429|quota|rate limit|ResourceExhausted/i.test(message);

    return NextResponse.json(
      {
        success: false,
        rateLimited: isRateLimit,
        retryAfterSeconds: isRateLimit ? 30 : undefined,
        error: isRateLimit
          ? "Gemini API rate limit reached (Free Tier). Please wait a moment before generating another passage."
          : message,
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
