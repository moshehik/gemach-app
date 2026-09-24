// tools/v3-lint/lib.mjs — עזרים משותפים לסקריפטי הבדיקה (CONSTITUTION §ח.1).
import { readFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

export function glob(pattern, opts = {}) {
  return globSync(pattern, { cwd: ROOT, ...opts }).map((p) => p.replace(/\\/g, '/'));
}

export function read(relPath) {
  return readFileSync(path.join(ROOT, relPath), 'utf8');
}

export function loadBaseline() {
  const p = path.join(ROOT, 'tools/v3-lint/lint-baseline.json');
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * report(ruleId, findings) — findings: [{file, line, text}]. מפריד לפי baseline:
 * findings שכבר ב-baseline[ruleId] לא נכשלים (הפרות קיימות שלא גדלות, CONSTITUTION
 * §ח.1 "הכנסה הדרגתית"); findings חדשים נכשלים את הסקריפט (exit 1).
 * מדפיס תמיד את שני הסטים כדי שאפשר יהיה לעדכן את ה-baseline במודע.
 */
export function report(ruleId, findings) {
  const baseline = loadBaseline();
  const known = new Set(baseline[ruleId]?.entries || []);
  const asKey = (f) => `${f.file}:${f.line}`;
  const newOnes = findings.filter((f) => !known.has(asKey(f)));
  const knownOnes = findings.filter((f) => known.has(asKey(f)));

  console.log(`\n[v3-lint] ${ruleId}: ${findings.length} הפרות (${knownOnes.length} ב-baseline, ${newOnes.length} חדשות)`);
  if (knownOnes.length) console.log(`  (${knownOnes.length} הפרות ישנות ב-lint-baseline.json - לא נכשלות; לא לגדול)`);
  if (newOnes.length) {
    console.log('  הפרות חדשות:');
    newOnes.forEach((f) => console.log(`   - ${f.file}:${f.line}  ${f.text}`));
  }
  if (newOnes.length > 0) {
    process.exitCode = 1;
  } else {
    console.log('  OK (0 הפרות חדשות)');
  }
  return { newOnes, knownOnes };
}
