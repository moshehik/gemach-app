// Deterministic phonetic key for Hebrew names, aimed at collapsing the
// recurring Ashkenazi/Yiddish transliteration variants this app has actually
// hit in real data (e.g. שיינועטר / שינוטר / שיינאטר all describe the same
// surname, spelled differently by whoever transcribed it). Not a general
// Hebrew NLP tool - a narrow, curated heuristic for exactly this failure
// class. See docs/smart-quick-search-plan-2026-09-27.md for the full design
// (this is Tier 3 of a 3-tier cascade - exact match and pg_trgm similarity
// are tiers 1-2 and are unaffected by this file).

const NIQQUD_RE = /[֑-ׇ]/g;
const NON_HEBREW_LETTER_RE = /[^א-ת]/g;

const FINAL_TO_REGULAR = {
  'ך': 'כ',
  'ם': 'מ',
  'ן': 'נ',
  'ף': 'פ',
  'ץ': 'צ',
};

// Small, curated table of letters that are genuinely interchangeable in real
// Ashkenazi-surname transliterations - NOT a blanket per-letter merge.
const CONSONANT_SUBSTITUTIONS = {
  'ט': 'ת',
  'ק': 'כ',
};

// Letters that commonly act as optional vowel-placeholders in Yiddish-derived
// Hebrew spellings (א/ע/ה/ו can all represent, or silently stand in for, the
// same vowel sound depending on who transcribed the name). Dropped when they
// appear anywhere except the first letter, which carries more information and
// is rarely just decorative.
const DROPPABLE_IF_INTERNAL = new Set(['א', 'ע', 'ה', 'ו']);

function stripToHebrewLetters(input) {
  return String(input || '')
    .normalize('NFC')
    .replace(NIQQUD_RE, '')
    .replace(NON_HEBREW_LETTER_RE, '');
}

function collapseRuns(chars) {
  const out = [];
  for (const ch of chars) {
    if (out.length === 0 || out[out.length - 1] !== ch) out.push(ch);
  }
  return out;
}

/**
 * Computes a coarse phonetic key for a single Hebrew name field (first name
 * OR last name - call separately per field, matching the existing
 * multi-word first/last matching convention in lib/searchUtils.js).
 * Returns null for empty/non-Hebrew input (e.g. a phone number, or a name
 * that has no Hebrew letters at all).
 */
function hebrewPhoneticKey(rawName) {
  const stripped = stripToHebrewLetters(rawName);
  if (!stripped) return null;

  const finalsNormalized = [...stripped].map((ch) => FINAL_TO_REGULAR[ch] || ch);
  const substituted = finalsNormalized.map((ch) => CONSONANT_SUBSTITUTIONS[ch] || ch);
  const collapsed = collapseRuns(substituted);

  const kept = collapsed.filter((ch, i) => i === 0 || !DROPPABLE_IF_INTERNAL.has(ch));
  return kept.join('') || collapsed[0];
}

module.exports = { hebrewPhoneticKey };
