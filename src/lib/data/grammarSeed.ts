import rawData from "./grammarSeedData.json";

export interface GrammarPointSeed {
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1";
  title: string;
  meaning: string;
  formation: string;
  bunpro_lesson_tag: string;
}

export const GRAMMAR_SEED_DATA: GrammarPointSeed[] = rawData as GrammarPointSeed[];
