import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "default-user";
    const supabase = createAdminClient();

    let { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Auto-initialize default profile if not present
    if (!profile) {
      const defaultProfile = {
        user_id: userId,
        target_jlpt_level: "N5",
        current_bunpro_frontier: "N5 Lesson 1",
      };

      const { data: created, error: insertError } = await supabase
        .from("user_profiles")
        .insert(defaultProfile)
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { success: false, error: insertError.message },
          { status: 500 }
        );
      }
      profile = created;
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch user profile";
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
    const supabase = createAdminClient();

    const updates: {
      user_id: string;
      target_jlpt_level?: string;
      current_bunpro_frontier?: string;
      wk_api_token?: string;
      bunpro_api_token?: string;
    } = { user_id: userId };

    if (body.target_jlpt_level !== undefined) {
      updates.target_jlpt_level = body.target_jlpt_level;
    }
    if (body.current_bunpro_frontier !== undefined) {
      updates.current_bunpro_frontier = body.current_bunpro_frontier;
    }
    if (body.wk_api_token !== undefined) {
      updates.wk_api_token = body.wk_api_token;
    }
    if (body.bunpro_api_token !== undefined) {
      updates.bunpro_api_token = body.bunpro_api_token;
    }

    const { data: updated, error } = await supabase
      .from("user_profiles")
      .upsert(updates, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: updated,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update user profile";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return POST(req);
}
