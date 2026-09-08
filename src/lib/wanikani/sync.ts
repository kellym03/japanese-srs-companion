import { createAdminClient } from "@/lib/supabase/server";

export interface WaniKaniMeaning {
  meaning: string;
  primary: boolean;
  accepted_answer: boolean;
}

export interface WaniKaniReading {
  reading: string;
  primary: boolean;
  accepted_answer: boolean;
  type?: string;
}

export interface WaniKaniAssignment {
  id: number;
  data: {
    subject_id: number;
    subject_type: string;
    srs_stage: number;
    unlocked_at: string | null;
    started_at: string | null;
    passed_at: string | null;
    burned_at: string | null;
  };
}

export interface WaniKaniSubject {
  id: number;
  object: string;
  data: {
    characters?: string;
    slug?: string;
    level: number;
    meanings: WaniKaniMeaning[];
    readings?: WaniKaniReading[];
    subject_type?: string;
  };
}

export interface SyncOptions {
  token?: string;
  userId?: string;
}

export interface SyncResult {
  success: boolean;
  totalSynced: number;
  user: {
    username: string;
    level: number;
  } | null;
  srsBreakdown: {
    guru1: number; // stage 5
    guru2: number; // stage 6
    master: number; // stage 7
    enlightened: number; // stage 8
    burned: number; // stage 9
  };
  durationMs: number;
}

const WANIKANI_API_BASE = "https://api.wanikani.com/v2";

async function fetchWaniKaniPaginated<T>(
  initialUrl: string,
  token: string
): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Wanikani-Revision": "20170710",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`WaniKani API error (${res.status}): ${errorText}`);
    }

    const json = (await res.json()) as {
      pages?: { next_url: string | null };
      data?: T[];
    };

    if (json.data && Array.isArray(json.data)) {
      items.push(...json.data);
    }

    nextUrl = json.pages?.next_url ?? null;
  }

  return items;
}

export async function syncWaniKaniVocab(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const token = options.token || process.env.WANIKANI_API_TOKEN;
  const userId = options.userId || "default-user";

  if (!token) {
    throw new Error(
      "WaniKani API token is required. Please set WANIKANI_API_TOKEN or pass a token."
    );
  }

  // 1. Optional: Fetch user profile to verify token and get username
  let userInfo: { username: string; level: number } | null = null;
  try {
    const userRes = await fetch(`${WANIKANI_API_BASE}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Wanikani-Revision": "20170710",
      },
    });
    if (userRes.ok) {
      const userData = (await userRes.json()) as {
        data?: { username: string; level: number };
      };
      if (userData.data) {
        userInfo = {
          username: userData.data.username,
          level: userData.data.level,
        };
      }
    }
  } catch {
    // If user info fails, continue with sync
  }

  // 2. Fetch all assignments where srs_stage >= 5 (Guru+) and subject_types are vocabulary
  // WaniKani srs_stages: 5 (Guru I), 6 (Guru II), 7 (Master), 8 (Enlightened), 9 (Burned)
  const assignmentsUrl = `${WANIKANI_API_BASE}/assignments?srs_stages=5,6,7,8,9&subject_types=vocabulary,kana_vocabulary`;
  const assignments = await fetchWaniKaniPaginated<WaniKaniAssignment>(
    assignmentsUrl,
    token
  );

  const srsBreakdown = {
    guru1: 0,
    guru2: 0,
    master: 0,
    enlightened: 0,
    burned: 0,
  };

  const assignmentMap = new Map<
    number,
    { srs_stage: number; subject_type: string }
  >();

  for (const item of assignments) {
    const stage = item.data.srs_stage;
    if (stage === 5) srsBreakdown.guru1++;
    else if (stage === 6) srsBreakdown.guru2++;
    else if (stage === 7) srsBreakdown.master++;
    else if (stage === 8) srsBreakdown.enlightened++;
    else if (stage === 9) srsBreakdown.burned++;

    assignmentMap.set(item.data.subject_id, {
      srs_stage: stage,
      subject_type: item.data.subject_type,
    });
  }

  const subjectIds = Array.from(assignmentMap.keys());
  if (subjectIds.length === 0) {
    return {
      success: true,
      totalSynced: 0,
      user: userInfo,
      srsBreakdown,
      durationMs: Date.now() - startTime,
    };
  }

  // 3. Fetch subjects in batches of 500 (WaniKani supports up to 1000 IDs per request)
  const CHUNK_SIZE = 500;
  const subjects: WaniKaniSubject[] = [];

  for (let i = 0; i < subjectIds.length; i += CHUNK_SIZE) {
    const chunkIds = subjectIds.slice(i, i + CHUNK_SIZE);
    const subjectsUrl = `${WANIKANI_API_BASE}/subjects?ids=${chunkIds.join(",")}`;
    const chunkSubjects = await fetchWaniKaniPaginated<WaniKaniSubject>(
      subjectsUrl,
      token
    );
    subjects.push(...chunkSubjects);
  }

  // 4. Map subjects to database schema
  const syncTimestamp = new Date().toISOString();
  const dbRecords = subjects.map((subj) => {
    const assignment = assignmentMap.get(subj.id);
    const characters = subj.data.characters || subj.data.slug || "";
    const meanings = subj.data.meanings || [];
    const readings =
      subj.data.readings && subj.data.readings.length > 0
        ? subj.data.readings
        : characters
        ? [{ reading: characters, primary: true, accepted_answer: true }]
        : [];

    return {
      user_id: userId,
      wk_subject_id: subj.id,
      subject_type: subj.object || assignment?.subject_type || "vocabulary",
      characters,
      meanings,
      readings,
      level: subj.data.level ?? 0,
      srs_stage: assignment?.srs_stage ?? 5,
      last_synced_at: syncTimestamp,
    };
  });

  // 5. Upsert into Supabase in batches of 500
  const supabase = createAdminClient();
  const DB_BATCH_SIZE = 500;

  for (let i = 0; i < dbRecords.length; i += DB_BATCH_SIZE) {
    const batch = dbRecords.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase.from("known_vocab").upsert(batch, {
      onConflict: "user_id,wk_subject_id",
    });

    if (error) {
      throw new Error(`Database upsert error: ${error.message}`);
    }
  }

  // 6. Ensure user profile exists / is updated
  try {
    await supabase.from("user_profiles").upsert(
      {
        user_id: userId,
        wk_api_token: token,
      },
      { onConflict: "user_id" }
    );
  } catch {
    // Non-fatal if profile update fails
  }

  return {
    success: true,
    totalSynced: dbRecords.length,
    user: userInfo,
    srsBreakdown,
    durationMs: Date.now() - startTime,
  };
}
