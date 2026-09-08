import { NextRequest, NextResponse } from "next/server";
import { seedGrammarPoints } from "@/lib/grammar/seed";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let cleanFirst = false;
    const searchParams = req.nextUrl.searchParams;
    if (searchParams.get("clean") === "true") {
      cleanFirst = true;
    }

    try {
      const body = await req.json();
      if (body.cleanFirst !== undefined) {
        cleanFirst = Boolean(body.cleanFirst);
      }
    } catch {
      // Body might be empty
    }

    const result = await seedGrammarPoints({ cleanFirst });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to seed grammar points";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: points, error } = await supabase
      .from("grammar_points")
      .select("id, jlpt_level, title, meaning, formation, bunpro_lesson_tag, created_at")
      .order("jlpt_level", { ascending: false })
      .order("bunpro_lesson_tag", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const byLevel: Record<string, number> = {};
    const byLesson: Record<string, number> = {};

    for (const p of points || []) {
      byLevel[p.jlpt_level] = (byLevel[p.jlpt_level] || 0) + 1;
      byLesson[p.bunpro_lesson_tag] = (byLesson[p.bunpro_lesson_tag] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      total: (points || []).length,
      byLevel,
      byLesson,
      points: points || [],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch grammar stats";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
