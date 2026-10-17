import { NextRequest, NextResponse } from "next/server";
import {
  generateObjectWithFallback,
  CompositionEvaluationSchema,
  isRetryableOrOverloadError,
} from "@/lib/ai/gemini";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userSubmission,
      promptScenario,
      targetGrammarId,
      targetVocabIds,
      targetGrammar,
      targetVocab,
      userId = "default-user",
    } = body;

    if (!userSubmission || typeof userSubmission !== "string" || userSubmission.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Submission text is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Resolve Target Grammar details if needed
    let grammarInfo = targetGrammar;
    if (!grammarInfo && targetGrammarId) {
      const { data: g } = await supabase
        .from("grammar_points")
        .select("*")
        .eq("id", targetGrammarId)
        .maybeSingle();
      if (g) grammarInfo = g;
    }

    const grammarTitle = grammarInfo?.title || "Target Grammar Point";
    const grammarMeaning = grammarInfo?.meaning || "";
    const grammarFormation = grammarInfo?.formation || "";

    // 2. Resolve Target Vocabulary details if needed
    const vocabListText = Array.isArray(targetVocab)
      ? targetVocab
          .map(
            (v: { characters: string; readings?: { reading: string }[]; meanings?: { meaning: string }[] }) =>
              `${v.characters} (${v.readings?.[0]?.reading || ""}: ${v.meanings?.[0]?.meaning || ""})`
          )
          .join(", ")
      : "None specified";

    // 3. System Instruction and Prompt for Gemini
    const systemPrompt = `You are a strict, expert JLPT Japanese language evaluator and native Japanese linguist.
Evaluate the student's Japanese sentence against JLPT grammatical standards and native Japanese naturalness.
- Critique whether the target grammar point (${grammarTitle}) was applied correctly with proper conjugation and structure (${grammarFormation}).
- Identify any particle mistakes, missing particles (e.g., omitting に, で, を, は, が when required), or awkward word order.
- Provide a completely natural, native Japanese alternative sentence that communicates the scenario idea with idiomatic fluency.
- Provide an accurate English translation of what the student's exact submission actually means.
- Provide structured vocabulary usage feedback on how the student utilized words.
- Assign an overallScore from 1 to 10. Be constructive, precise, and encouraging.`;

    const userPrompt = `
Scenario Given to Student: "${promptScenario || "Express the required concept in natural Japanese."}"
Target Grammar Point: ${grammarTitle} (${grammarMeaning})
Target Formation Rule: ${grammarFormation}
Required / Suggested Vocabulary: ${vocabListText}

Student's Japanese Submission: "${userSubmission.trim()}"
`;

    try {
      const {
        object: evaluation,
        modelUsed,
        fallbackOccurred,
      } = await generateObjectWithFallback({
        schema: CompositionEvaluationSchema,
        system: systemPrompt,
        prompt: userPrompt,
      });

      // 4. Save Session to Supabase practice_sessions
      let sessionId: string | undefined;
      try {
        const { data: savedSession, error: dbError } = await supabase
          .from("practice_sessions")
          .insert({
            user_id: userId,
            mode: "composition",
            prompt_data: {
              scenario: promptScenario,
              targetGrammar: grammarInfo,
              targetVocab: targetVocab || [],
              aiMeta: {
                modelUsed,
                fallbackOccurred,
              },
            },
            user_submission: userSubmission.trim(),
            evaluation,
          })
          .select("id")
          .single();

        if (!dbError && savedSession) {
          sessionId = savedSession.id;
        }
      } catch {
        // Non-fatal if session saving fails
      }

      return NextResponse.json({
        success: true,
        evaluation,
        sessionId,
        aiMeta: {
          modelUsed,
          fallbackOccurred,
        },
      });
    } catch (aiErr: unknown) {
      const isOverloadedOrRateLimit =
        Boolean((aiErr as any)?.isOverloaded) ||
        isRetryableOrOverloadError(aiErr);

      if (isOverloadedOrRateLimit) {
        return NextResponse.json(
          {
            success: false,
            rateLimited: true,
            highTraffic: true,
            retryAfterSeconds: 15,
            error:
              "Gemini is currently experiencing high traffic volumes across all fallback models. Please wait 15 seconds and try again.",
          },
          { status: 503 }
        );
      }
      throw aiErr;
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to evaluate composition";
    const isOverloadedOrRateLimit =
      Boolean((error as any)?.isOverloaded) ||
      isRetryableOrOverloadError(error);

    return NextResponse.json(
      {
        success: false,
        rateLimited: isOverloadedOrRateLimit,
        highTraffic: isOverloadedOrRateLimit,
        retryAfterSeconds: isOverloadedOrRateLimit ? 15 : undefined,
        error: isOverloadedOrRateLimit
          ? "Gemini is currently experiencing high traffic volumes. Please wait a few moments before trying again."
          : message,
      },
      { status: isOverloadedOrRateLimit ? 503 : 500 }
    );
  }
}
