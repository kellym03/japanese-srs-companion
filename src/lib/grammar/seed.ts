import { createAdminClient } from "@/lib/supabase/server";
import { GRAMMAR_SEED_DATA, GrammarPointSeed } from "@/lib/data/grammarSeed";

export interface SeedResult {
  success: boolean;
  inserted: number;
  updated: number;
  total: number;
  byLevel: Record<string, number>;
  byLesson: Record<string, number>;
  durationMs: number;
}

export interface SeedOptions {
  cleanFirst?: boolean;
  data?: GrammarPointSeed[];
}

export async function seedGrammarPoints(
  options: SeedOptions = {}
): Promise<SeedResult> {
  const startTime = Date.now();
  const supabase = createAdminClient();
  const dataset = options.data || GRAMMAR_SEED_DATA;
  const cleanFirst = options.cleanFirst ?? false;

  let inserted = 0;
  let updated = 0;

  if (cleanFirst) {
    // 1. Delete all existing records to ensure clean reset without stale or mismatched entries
    const { error: deleteError } = await supabase
      .from("grammar_points")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all rows

    if (deleteError) {
      throw new Error(`Failed to clean grammar points table: ${deleteError.message}`);
    }

    // 2. Insert all items in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < dataset.length; i += BATCH_SIZE) {
      const batch = dataset.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from("grammar_points")
        .insert(batch);

      if (insertError) {
        throw new Error(`Batch insert error: ${insertError.message}`);
      }
      inserted += batch.length;
    }
  } else {
    // Safe upsert matching by jlpt_level + title
    const { data: existing, error: fetchError } = await supabase
      .from("grammar_points")
      .select("id, title, jlpt_level");

    if (fetchError) {
      throw new Error(`Failed to read existing grammar points: ${fetchError.message}`);
    }

    const existingMap = new Map<string, string>();
    for (const row of existing || []) {
      const key = `${row.jlpt_level}:${row.title.trim()}`;
      existingMap.set(key, row.id);
    }

    const toInsert: Array<{
      jlpt_level: string;
      title: string;
      meaning: string;
      formation: string;
      bunpro_lesson_tag: string;
    }> = [];

    const toUpdate: Array<{
      id: string;
      jlpt_level: string;
      title: string;
      meaning: string;
      formation: string;
      bunpro_lesson_tag: string;
    }> = [];

    for (const item of dataset) {
      const key = `${item.jlpt_level}:${item.title.trim()}`;
      const existingId = existingMap.get(key);

      if (existingId) {
        toUpdate.push({
          id: existingId,
          jlpt_level: item.jlpt_level,
          title: item.title,
          meaning: item.meaning,
          formation: item.formation,
          bunpro_lesson_tag: item.bunpro_lesson_tag,
        });
      } else {
        toInsert.push({
          jlpt_level: item.jlpt_level,
          title: item.title,
          meaning: item.meaning,
          formation: item.formation,
          bunpro_lesson_tag: item.bunpro_lesson_tag,
        });
      }
    }

    if (toInsert.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from("grammar_points")
          .insert(batch);

        if (insertError) {
          throw new Error(`Failed to insert grammar points: ${insertError.message}`);
        }
        inserted += batch.length;
      }
    }

    // Update existing records in parallel batches
    const UPDATE_BATCH = 20;
    for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
      const slice = toUpdate.slice(i, i + UPDATE_BATCH);
      await Promise.all(
        slice.map(async (item) => {
          const { error: updateError } = await supabase
            .from("grammar_points")
            .update({
              jlpt_level: item.jlpt_level,
              title: item.title,
              meaning: item.meaning,
              formation: item.formation,
              bunpro_lesson_tag: item.bunpro_lesson_tag,
            })
            .eq("id", item.id);

          if (updateError) {
            throw new Error(`Failed to update ${item.title}: ${updateError.message}`);
          }
        })
      );
      updated += slice.length;
    }
  }

  // 3. Compute final counts from DB
  const { data: allPoints } = await supabase
    .from("grammar_points")
    .select("jlpt_level, bunpro_lesson_tag");

  const byLevel: Record<string, number> = {};
  const byLesson: Record<string, number> = {};

  for (const p of allPoints || []) {
    byLevel[p.jlpt_level] = (byLevel[p.jlpt_level] || 0) + 1;
    byLesson[p.bunpro_lesson_tag] = (byLesson[p.bunpro_lesson_tag] || 0) + 1;
  }

  return {
    success: true,
    inserted,
    updated,
    total: (allPoints || []).length,
    byLevel,
    byLesson,
    durationMs: Date.now() - startTime,
  };
}
