import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ReadingPassage } from "@/lib/ai/gemini";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      passageData,
      selectedAnswers,
      userId = "default-user",
    }: {
      passageData: ReadingPassage;
      selectedAnswers: Record<string | number, number>;
      userId?: string;
    } = body;

    if (!passageData || !Array.isArray(passageData.questions)) {
      return NextResponse.json(
        { success: false, error: "Invalid passage data or missing questions" },
        { status: 400 }
      );
    }

    if (!selectedAnswers || typeof selectedAnswers !== "object") {
      return NextResponse.json(
        { success: false, error: "Missing user selected answers" },
        { status: 400 }
      );
    }

    const questions = passageData.questions;
    let correctCount = 0;

    const breakdown = questions.map((q) => {
      const selectedIndex = selectedAnswers[q.id] ?? selectedAnswers[String(q.id)];
      const isCorrect = selectedIndex === q.correctOptionIndex;
      if (isCorrect) correctCount++;

      return {
        questionId: q.id,
        question: q.question,
        selectedIndex,
        selectedOption: selectedIndex !== undefined ? q.options[selectedIndex] : "No answer",
        correctOptionIndex: q.correctOptionIndex,
        correctOption: q.options[q.correctOptionIndex],
        isCorrect,
        explanation: q.explanation,
      };
    });

    const totalQuestions = questions.length;
    const percentage =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const evaluationResult = {
      score: correctCount,
      total: totalQuestions,
      percentage,
      passed: percentage >= 66,
      breakdown,
    };

    const supabase = createAdminClient();
    let sessionId: string | undefined;

    try {
      const { data: savedSession, error: dbError } = await supabase
        .from("practice_sessions")
        .insert({
          user_id: userId,
          mode: "reading",
          prompt_data: passageData,
          user_submission: JSON.stringify(selectedAnswers),
          evaluation: evaluationResult,
        })
        .select("id")
        .single();

      if (!dbError && savedSession) {
        sessionId = savedSession.id;
      }
    } catch {
      // Non-fatal if session save fails
    }

    return NextResponse.json({
      success: true,
      evaluation: evaluationResult,
      sessionId,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to grade reading answers";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
