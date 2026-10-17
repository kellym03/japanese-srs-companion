import { google } from "@ai-sdk/google";
import { z } from "zod";

export * from "./fallback";

export const compositionModel = google(process.env.AI_PRIMARY_MODEL || "gemini-2.5-flash");

export const CompositionEvaluationSchema = z.object({
  isCorrect: z
    .boolean()
    .describe(
      "Whether the sentence is grammatically correct and successfully fulfills the scenario"
    ),
  naturalAlternative: z
    .string()
    .describe("How a native Japanese speaker would express this idea most naturally"),
  englishMeaning: z
    .string()
    .describe("Accurate English translation of the student's exact submission"),
  grammarCritique: z
    .string()
    .describe(
      "Detailed breakdown of whether the target grammar point was used and conjugated accurately according to JLPT standards"
    ),
  particleMistakes: z
    .array(
      z.object({
        particle: z.string().describe("The particle involved (e.g. に, で, を, は, が)"),
        issue: z.string().describe("The specific mistake or reason it sounds unnatural"),
        correction: z.string().describe("The correct particle or structural replacement"),
      })
    )
    .describe("List of particle errors, awkward particle usage, or missing particles"),
  vocabFeedback: z
    .array(
      z.object({
        word: z.string().describe("The Japanese vocabulary word analyzed"),
        note: z.string().describe("Feedback on appropriateness, nuance, or conjugation"),
      })
    )
    .describe("Feedback on the usage of the required vocabulary words"),
  overallScore: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe(
      "Overall rating from 1 to 10 (10 = flawless native, 8-9 = minor nuance, 5-7 = understandable but flawed grammar/particles, 1-4 = broken/unintelligible)"
    ),
});

export type CompositionEvaluation = z.infer<typeof CompositionEvaluationSchema>;

export const ReadingPassageSchema = z.object({
  title: z.string().describe("Engaging Japanese title for the reading passage"),
  passage: z
    .string()
    .describe(
      "A coherent Japanese passage (story, article, or dialog) calibrated to the JLPT tier"
    ),
  englishTranslation: z
    .string()
    .describe("Complete, natural English reference translation of the passage"),
  furiganaGlossary: z
    .array(
      z.object({
        kanji: z.string().describe("The Japanese term or kanji compound"),
        kana: z.string().describe("Hiragana/Katakana reading"),
        englishMeaning: z.string().describe("English meaning in this context"),
      })
    )
    .describe("Glossary of essential or stretch terms appearing in the passage"),
  questions: z
    .array(
      z.object({
        id: z.number().int().describe("Question number (1, 2, 3)"),
        question: z.string().describe("Reading comprehension question"),
        options: z
          .array(z.string())
          .length(4)
          .describe("Array of exactly 4 distinct multiple-choice options"),
        correctOptionIndex: z
          .number()
          .int()
          .min(0)
          .max(3)
          .describe("Index (0-3) of the correct choice"),
        explanation: z
          .string()
          .describe("Clear explanation referencing passage context on why this answer is correct"),
      })
    )
    .min(2)
    .max(3)
    .describe("2 to 3 reading comprehension questions"),
});

export type ReadingPassage = z.infer<typeof ReadingPassageSchema>;
