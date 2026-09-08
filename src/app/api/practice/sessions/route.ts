import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "default-user";
    const mode = searchParams.get("mode") || "composition";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const supabase = createAdminClient();

    const { data: sessions, error } = await supabase
      .from("practice_sessions")
      .select("id, user_id, mode, prompt_data, user_submission, evaluation, created_at")
      .eq("user_id", userId)
      .eq("mode", mode)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessions: sessions || [],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch practice sessions";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
