import { seedGrammarPoints } from "../src/lib/grammar/seed";

async function main() {
  console.log("🌱 Starting JLPT Grammar Seeder...");
  try {
    const result = await seedGrammarPoints();
    console.log("✅ Grammar points successfully seeded!");
    console.log(`📊 Total: ${result.total} items (Inserted: ${result.inserted}, Updated: ${result.updated}) in ${result.durationMs}ms`);
    console.log("📚 Breakdown by JLPT Level:", result.byLevel);
    console.log("🏷️  Breakdown by Bunpro Lesson:", result.byLesson);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

main();
