import { NextRequest, NextResponse } from "next/server";
import { syncWaniKaniVocab } from "@/lib/wanikani/sync";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60; // Allow sufficient time for paginated sync if running on serverless

export async function POST(req: NextRequest) {
  try {
    let token: string | undefined;
    let userId: string | undefined;

    // Check header first
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const customHeader = req.headers.get("x-wanikani-token");
    if (customHeader) {
      token = customHeader.trim();
    }

    // Check JSON body
    try {
      const body = await req.json();
      if (body.token) token = body.token;
      if (body.userId) userId = body.userId;
    } catch {
      // Body might be empty, that's fine
    }

    // Fall back to query params if any
    const searchParams = req.nextUrl.searchParams;
    if (!token && searchParams.get("token")) {
      token = searchParams.get("token") || undefined;
    }
    if (!userId && searchParams.get("userId")) {
      userId = searchParams.get("userId") || undefined;
    }

    const result = await syncWaniKaniVocab({ token, userId });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const shouldTrigger = searchParams.get("trigger") === "true";

  if (shouldTrigger) {
    return POST(req);
  }

  try {
    const userId = searchParams.get("userId") || "default-user";
    const supabase = createAdminClient();

    // Query current count and latest sync in database
    const { count, error } = await supabase
      .from("known_vocab")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const { data: latestItems } = await supabase
      .from("known_vocab")
      .select("characters, meanings, readings, level, srs_stage, last_synced_at")
      .eq("user_id", userId)
      .order("last_synced_at", { ascending: false })
      .limit(10);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      count: count ?? 0,
      userId,
      latestItems: latestItems || [],
      profile,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
