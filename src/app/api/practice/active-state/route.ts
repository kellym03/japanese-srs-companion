import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "default-user";
    const mode = searchParams.get("mode") || "composition";
    const activeMode = `active_${mode}`;

    const supabase = createAdminClient();

    const { data: session, error } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("mode", activeMode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json({
        success: true,
        state: null,
      });
    }

    if (mode === "composition") {
      const promptData = session.prompt_data || {};
      const reconstructed = {
        scenario: promptData.scenario || "",
        hint: promptData.hint || null,
        targetGrammar: promptData.targetGrammar || null,
        targetVocab: promptData.targetVocab || [],
        userSubmission: session.user_submission || "",
        evaluation:
          session.evaluation && Object.keys(session.evaluation).length > 0
            ? session.evaluation
            : null,
        frontierKey: promptData.frontierKey,
        updatedAt: session.created_at,
      };
      return NextResponse.json({ success: true, state: reconstructed });
    } else {
      const promptData = session.prompt_data || {};
      const reconstructed = {
        activeThemeId: promptData.activeThemeId || "daily-life",
        passagesByTheme: promptData.passagesByTheme || {},
        fontSize: promptData.fontSize || "md",
        updatedAt: session.created_at,
      };
      return NextResponse.json({ success: true, state: reconstructed });
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch active state";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId || "default-user";
    const mode = body.mode || "composition";
    const state = body.state;
    const activeMode = `active_${mode}`;

    if (!state) {
      return NextResponse.json(
        { success: false, error: "State payload required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    let promptData: any = {};
    let userSubmission = "";
    let evaluation: any = {};

    if (mode === "composition") {
      promptData = {
        scenario: state.scenario || "",
        hint: state.hint || null,
        targetGrammar: state.targetGrammar || null,
        targetVocab: state.targetVocab || [],
        frontierKey: state.frontierKey,
      };
      userSubmission = state.userSubmission || "";
      evaluation = state.evaluation || {};
    } else {
      promptData = {
        activeThemeId: state.activeThemeId || "daily-life",
        passagesByTheme: state.passagesByTheme || {},
        fontSize: state.fontSize || "md",
      };
      userSubmission = "";
      evaluation = {};
    }

    // Clean up previous active session for this user/mode
    await supabase
      .from("practice_sessions")
      .delete()
      .eq("user_id", userId)
      .eq("mode", activeMode);

    const { error: insertError } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: userId,
        mode: activeMode,
        prompt_data: promptData,
        user_submission: userSubmission,
        evaluation: evaluation,
      });

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to save active state";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
