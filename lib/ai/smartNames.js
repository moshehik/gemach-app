// lib/ai/smartNames.js - "איות חכם" לעוזר ה-AI (הצ'אט הצף ועוזר הסטטיסטיקה): סובלנות לגיוונים באיות של שמות לקוחות / עובדים, באותה לוגיקה
// של החיפוש הראשי (lib/searchFuzzy.js: fuzzyBudget / editDistance / מפתח פונטי; lib/searchDb.js: findFuzzyNameSpellings מעל buildFuzzyNameSql).
//
// למה: המודל כותב תנאי שם מדויקים ("lastName" ILIKE '%שיינועטר%'), ולכן שיינווטר / שיינוטר / שיינאטר לא נמצאים. תיקון בפרומפט לא היה מספיק (המודל לא
// מכיר את האיותים השמורים במסד). הפתרון דטרמיניסטי ובקוד, אחרי שהמודל כתב את ה-SQL ולפני שהוא רץ - בלי קריאת Gemini נוספת:
//   1. מאתרים בשאילתה תנאי שם פשוטים על עמודות firstName / lastName (/fullName של עובדים) של Customer / Employee, מול מילה אחת: ILIKE / LIKE / =.
//   2. לכל מילה: שאילתה אחת למסד (findFuzzyNameSpellings) - כמה רשומות תואמות במדויק, ואילו איותים שמורים קרובים.
//   3. מרחיבים את התנאי ל-ILIKE ANY (ARRAY[...]) / IN (...) של המילה המקורית + האיותים הקרובים (עד NEAR_SPELLINGS_MAX). יש התאמה מדויקת -> רק גרסאות איות
//      "חזקות" (אותו מפתח פונטי / מרחק 1 במילה ארוכה); אין התאמה מדויקת -> כל מה שקרוב לפי התקציב של החיפוש הראשי.
//   4. תוצאה ריקה והיו עוד איותים קרובים שלא נכללו -> ניסיון חוזר אחד, באותה שאילתה, עם כולם.
//   5. הנוסח הסופי: שורת הודעה שהשרת כותב ("לא נמצא X בדיוק; מוצגות תוצאות עבור Y"), עובדות לפרומפט של התשובה, ועמודת "סוג התאמה" בטבלה.
// היקף ההרשאות: אותו היקף של השאילתה עצמה (לקוחות שלא נמחקו; עובדים אמיתיים). שום דבר לא נכתב למסד.

import { fuzzyTokens, nameTokens, rankNameSpellings, NEAR_SPELLINGS_MAX } from '../searchFuzzy.js';
import { HEBREW_MONTH_TABLE } from '../searchNormalize.js';
import { resultsHaveData } from './aiCommon.js';

const TABLE_COLUMNS = {
  Customer: ['firstname', 'lastname'],
  Employee: ['firstname', 'lastname', 'fullname'],
};
const TABLE_LABEL = { Customer: 'לקוחות', Employee: 'עובדים' };
const RESERVED_ALIAS = new Set(['where', 'on', 'left', 'right', 'inner', 'outer', 'full', 'cross', 'join', 'group', 'order', 'limit', 'offset', 'using', 'having', 'union', 'natural', 'as', 'and', 'or', 'lateral']);
const MAX_WORDS_PER_REQUEST = 8;
const LOOKUP_TIMEOUT_MS = 6000;

// ---------------------------------------------------------------------------------------------------------------------------------
// ניתוח ה-SQL
// ---------------------------------------------------------------------------------------------------------------------------------

/** כינויי הטבלאות Customer / Employee בשאילתה: { aliases: Map(כינוי באותיות קטנות -> טבלה), tables: Set } */
export function collectNameTables(sql) {
  const aliases = new Map();
  const tables = new Set();
  const re = /(?:\bFROM|\bJOIN|,)\s*"?(Customer|Employee)"?(?!\s*\.)(?:\s+(?:AS\s+)?("[^"]+"|[A-Za-z_]\w*))?/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    tables.add(table);
    aliases.set(table.toLowerCase(), table);
    const alias = m[2] ? m[2].replace(/"/g, '') : '';
    if (alias && !RESERVED_ALIAS.has(alias.toLowerCase())) aliases.set(alias.toLowerCase(), table);
  }
  return { aliases, tables };
}

const COLUMN_RE = '((?:(?:[A-Za-z_]\\w*|"[^"]+")\\s*\\.\\s*)?"(?:firstName|lastName|fullName)")';
const PREDICATE_RE = new RegExp(`${COLUMN_RE}(\\s*::\\s*text)?(\\s+(NOT\\s+)?(I?LIKE)\\s+|\\s*=\\s*)'((?:[^']|'')*)'`, 'gi');

function splitColumn(colText) {
  const m = /^(?:(.+?)\s*\.\s*)?"([^"]+)"$/s.exec(colText.trim());
  if (!m) return null;
  return { qualifier: m[1] ? m[1].replace(/"/g, '').toLowerCase() : '', column: m[2].toLowerCase() };
}

/**
 * תנאי שם שאפשר להרחיב: עמודת שם של Customer / Employee מול literal של מילה אחת (בלי NOT, בלי רב-מילים).
 * @returns {{start:number,end:number,table:string,word:string,lead:boolean,trail:boolean,kind:'like'|'eq',op:string,colText:string,cast:string}[]}
 */
export function findNamePredicates(sql) {
  if (typeof sql !== 'string' || !sql) return [];
  const { aliases, tables } = collectNameTables(sql);
  if (!tables.size) return [];
  const out = [];
  PREDICATE_RE.lastIndex = 0;
  let m;
  while ((m = PREDICATE_RE.exec(sql)) !== null) {
    const [full, colText, cast, opText, negated, likeOp, literalRaw] = m;
    if (negated) continue;
    const col = splitColumn(colText);
    if (!col) continue;
    let table = null;
    if (col.qualifier) table = aliases.get(col.qualifier) || null;
    else if (tables.size === 1) table = [...tables][0];
    if (!table || !TABLE_COLUMNS[table].includes(col.column)) continue;
    const literal = literalRaw.replace(/''/g, "'");
    const isLike = Boolean(likeOp);
    const core = isLike ? literal.replace(/^%+|%+$/g, '') : literal;
    if (!core || /[%_\\\s]/.test(core)) continue; // רב-מילים / תווים מיוחדים - לא נוגעים
    const toks = fuzzyTokens(core);
    if (toks.length !== 1 || nameTokens(core)[0] !== toks[0]) continue;
    out.push({
      start: m.index, end: m.index + full.length, table, word: core, colText, cast: cast || '',
      kind: isLike ? 'like' : 'eq', op: (likeOp || '=').toUpperCase(),
      lead: isLike && literal.startsWith('%'), trail: isLike && literal.endsWith('%'),
    });
  }
  return out;
}

const sqlQuote = (v) => `'${String(v).replace(/'/g, "''")}'`;

function buildReplacement(p, variants) {
  const col = `${p.colText}${p.cast}`;
  if (p.kind === 'eq') return `${col} IN (${variants.map(sqlQuote).join(', ')})`;
  const pats = variants.map((v) => sqlQuote(`${p.lead ? '%' : ''}${v}${p.trail ? '%' : ''}`));
  return `${col} ${p.op} ANY (ARRAY[${pats.join(', ')}])`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// סשן לכל בקשה: ממפה מילים -> איותים (מטמון), מרחיב שאילתות, ומייצר הודעה / עובדות / עמודת סוג התאמה
// ---------------------------------------------------------------------------------------------------------------------------------

const keyOf = (table, word) => `${table}|${nameTokens(word)[0]}`;

/**
 * @param {{lookup: (table: string, word: string) => Promise<{exactCount:number, spellings:{raw:string,count:number}[]}|null>, enabled?: boolean}} deps
 *   lookup = findFuzzyNameSpellings (הזרקה, כדי שהליבה תהיה בדיקה ללא מסד)
 */
export function createNameSession({ lookup, enabled = true } = {}) {
  const cache = new Map(); // key -> Promise<record|null>
  const records = new Map(); // key -> record שנכנס לפחות לשאילתה אחת שרצה

  async function resolveWord(table, word) {
    const key = keyOf(table, word);
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        try {
          const found = await Promise.race([
            lookup(table, word),
            new Promise((r) => setTimeout(() => r(null), LOOKUP_TIMEOUT_MS)),
          ]);
          if (!found) return null;
          const ranked = rankNameSpellings(word, found.spellings, { loose: !found.exactCount, max: NEAR_SPELLINGS_MAX });
          return { key, table, word, exactCount: found.exactCount || 0, near: ranked.near, extra: ranked.extra, more: ranked.more, widened: false };
        } catch (e) {
          console.warn('smartNames.lookup failed:', e && e.message ? e.message : e);
          return null;
        }
      })());
    }
    return cache.get(key);
  }

  /** מרחיב תנאי שם בכל השאילתות. widen=true: כולל גם את האיותים ה"רחוקים" יותר (extra). לעולם לא זורק - כשל = השאילתה המקורית. */
  async function expand(sqls, { widen = false } = {}) {
    if (!enabled || typeof lookup !== 'function') return sqls.slice();
    try {
      const perQuery = sqls.map((s) => findNamePredicates(s));
      const wanted = new Map();
      for (const preds of perQuery) for (const p of preds) if (wanted.size < MAX_WORDS_PER_REQUEST || wanted.has(keyOf(p.table, p.word))) wanted.set(keyOf(p.table, p.word), p);
      const resolved = new Map();
      await Promise.all([...wanted.entries()].map(async ([key, p]) => { const r = await resolveWord(p.table, p.word); if (r) resolved.set(key, r); }));
      return sqls.map((sql, i) => {
        let out = sql;
        for (const p of [...perQuery[i]].reverse()) { // מהסוף להתחלה, כדי שהאינדקסים לא יזוזו
          const rec = resolved.get(keyOf(p.table, p.word));
          if (!rec) continue;
          records.set(rec.key, rec);
          const extra = widen ? rec.extra : [];
          const variants = [p.word, ...rec.near.map((n) => n.raw), ...extra.map((n) => n.raw)];
          if (variants.length < 2) continue;
          out = out.slice(0, p.start) + buildReplacement(p, [...new Set(variants)]) + out.slice(p.end);
        }
        return out;
      });
    } catch (e) {
      console.warn('smartNames.expand failed, running the original SQL:', e && e.message ? e.message : e);
      return sqls.slice();
    }
  }

  const flagged = new Set(); // מילים מהשאלה שזוהו כשם לקוח (buildNameHint)
  const flag = (w) => { flagged.add(w); };
  /** המודל כתב SQL בלי אף תנאי שם למרות ששם לקוח מופיע בשאלה. */
  const droppedNameFilter = (sqls) => flagged.size > 0 && !hasNamePredicate(sqls);

  const canWiden = () => [...records.values()].some((r) => r.extra.length > 0 && !r.widened);
  const markWidened = () => { for (const r of records.values()) if (r.extra.length > 0) r.widened = true; };
  const usedNear = (r) => [...r.near, ...(r.widened ? r.extra : [])];

  /** הודעת השרת (עברית, דטרמיניסטית) שנוספת בראש התשובה. rowsEmpty = אף שאילתה לא החזירה נתונים. */
  function notice({ rowsEmpty = false } = {}) {
    const lines = [];
    for (const r of records.values()) {
      const near = usedNear(r);
      const who = TABLE_LABEL[r.table] === 'עובדים' ? 'עובד/ת' : 'לקוח/ה';
      const names = near.map((n) => `"${n.raw}"`).join(', ');
      const more = r.more > 0 ? ` (יש עוד ${r.more} איותים קרובים שלא נכללו)` : '';
      if (!r.exactCount && near.length) {
        lines.push(near.length === 1
          ? `לא נמצא "${r.word}" בדיוק; ${rowsEmpty ? 'חיפשתי גם' : 'מוצגות תוצאות עבור'} האיות הקרוב "${near[0].raw}".`
          : `לא נמצא "${r.word}" בדיוק; ${rowsEmpty ? 'חיפשתי גם' : 'מוצגות תוצאות עבור'} כמה איותים קרובים: ${names}.${more}`);
      } else if (!r.exactCount) {
        lines.push(`לא נמצא ${who} בשם "${r.word}" במערכת, וגם לא איות קרוב לו.`);
      } else if (rowsEmpty) {
        // השם קיים - התוצאה הריקה נובעת משאר התנאים (למשל "אין שמלות שנלקחו"), לא מאיות
        const found = r.exactCount > 1 ? `נמצאו ${r.exactCount} רשומות בשם` : `נמצא ${who} בשם`;
        lines.push(`${found} "${r.word}", אך אין רשומות שמתאימות לשאר תנאי החיפוש${near.length ? ` (נבדקו גם איותים קרובים: ${names})` : ''}.${more}`);
      } else if (near.length) {
        lines.push(`התוצאות כוללות גם איותים קרובים ל"${r.word}": ${names}.${more}`);
      }
    }
    return lines.join('\n');
  }

  /** עובדות לפרומפט של התשובה הסופית (באנגלית, כמו שאר העובדות שהשרת מזין). */
  function facts({ rowsEmpty = false } = {}) {
    if (!records.size) return '';
    const parts = [];
    for (const r of records.values()) {
      const near = usedNear(r);
      const nearText = near.map((n) => `"${n.raw}" (${n.count} record${n.count === 1 ? '' : 's'})`).join(', ');
      let line = `- Typed name "${r.word}" (${r.table === 'Employee' ? 'employees' : 'customers'}): ${r.exactCount} record(s) contain it exactly.`;
      if (near.length) line += ` The SQL ALSO included these similar spellings found in the database: ${nearText}${r.more > 0 ? `; ${r.more} more similar spellings were NOT included` : ''}.`;
      else if (!r.exactCount) line += ' No similar spelling exists either.';
      if (r.exactCount && rowsEmpty) line += ` The name exists, so the empty result means the OTHER conditions of the question matched nothing (e.g. no dresses were taken) - say exactly that, never that the person does not exist.`;
      parts.push(line);
    }
    return `\nSPELLING FACTS (computed by the server, authoritative):\n${parts.join('\n')}\nThe server itself adds a one-line notice about these spellings above your answer: do NOT repeat the spelling notice and do NOT write a different one. Just answer the question from the rows. Do not claim a person was found or not found by name beyond these facts.\n`;
  }

  /** מוסיף לשורות הטבלה עמודה "סוג התאמה" כשנכללו איותים קרובים (רק אם לפחות שורה אחת היא איות קרוב). */
  function annotateRows(rows) {
    if (!Array.isArray(rows) || !rows.length || !records.size) return rows;
    const nearByFold = new Map();
    const exactFolds = new Set();
    for (const r of records.values()) {
      exactFolds.add(nameTokens(r.word)[0]);
      for (const n of usedNear(r)) nearByFold.set(nameTokens(n.raw)[0], n.raw);
    }
    if (!nearByFold.size) return rows;
    const labels = rows.map((row) => {
      if (!row || typeof row !== 'object') return '';
      let exact = false;
      for (const [k, v] of Object.entries(row)) {
        if (k.startsWith('_') || typeof v !== 'string') continue;
        for (const tok of nameTokens(v)) {
          if (exactFolds.has(tok)) exact = true;
          else if (nearByFold.has(tok)) return `איות קרוב ("${nearByFold.get(tok)}")`;
        }
      }
      return exact ? 'התאמה מדויקת' : '';
    });
    if (!labels.some((l) => l.startsWith('איות קרוב'))) return rows;
    return rows.map((row, i) => (row && typeof row === 'object' ? { ...row, 'סוג התאמה': labels[i] } : row));
  }

  return { resolve: resolveWord, flag, flagged: () => [...flagged], droppedNameFilter, expand, canWiden, markWidened, reset: () => records.clear(), notice, facts, annotateRows, records: () => [...records.values()] };
}

/**
 * מריץ את השאילתות עם איות חכם. execute(sql) מריצה שאילתה אחת (כולל ה-guard) ומחזירה את השורות.
 * שאילתה ראשונה מורחבת; תוצאה ריקה והיו עוד איותים קרובים -> ניסיון חוזר אחד עם כולם (נכשל / עדיין ריק = חוזרים לתוצאה הראשונה).
 * @returns {Promise<{results: any[], queries: string[]}>}  queries = ה-SQL שרץ בפועל
 */
export async function runSqlWithSmartNames(sqls, { execute, session }) {
  const runAll = async (list) => { const res = []; for (const q of list) res.push(await execute(q)); return res; };
  let first = await session.expand(sqls);
  let results;
  try {
    results = await runAll(first);
  } catch (e) {
    // ה-SQL המורחב נכשל אבל המקורי אולי תקין: לא מרעים את ההתנהגות הקודמת בגלל ההרחבה
    if (first.every((q, i) => q === sqls[i])) throw e;
    console.warn('smartNames: expanded SQL failed, running the original SQL:', e && e.message ? e.message : e);
    session.reset();
    first = sqls.slice();
    results = await runAll(first);
  }
  if (!resultsHaveData(results) && session.canWiden()) {
    try {
      const wide = await session.expand(sqls, { widen: true });
      const wideResults = await runAll(wide);
      if (resultsHaveData(wideResults)) {
        session.markWidened();
        return { results: wideResults, queries: wide };
      }
    } catch (e) {
      console.warn('smartNames widened retry failed, keeping the first result:', e && e.message ? e.message : e);
    }
  }
  return { results, queries: first };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// זיהוי שמות בשאלה עצמה (לפני שהמודל כותב SQL)
// ---------------------------------------------------------------------------------------------------------------------------------
// הסיבה: בבדיקה על השאלה "יש שיינועטר שלקחו שמלות?" המודל השמיט לפעמים את תנאי השם לגמרי וענה "יש 420 שמלות שנלקחו" (על כל הלקוחות). לכן השרת מזהה מילים
// בשאלה שהן שם של לקוח במסד (אינדקס המפתח הפונטי), מוסיף אותן לפרומפט כעובדה, ואם ה-SQL שחזר בכל זאת בלי שום תנאי שם - מבקש ממנו תיקון פעם אחת.

// שמות חודשים עבריים (גם שם משפחה של מישהו, למשל "אלול") הם לא שם בשאלה על תאריך
const MONTH_WORDS = new Set(HEBREW_MONTH_TABLE.flatMap((m) => [...m.aliases, ...m.spellings]).flatMap((x) => x.split(' ')));
const NAME_PREFIXES = new Set(['ל', 'ב', 'מ', 'ה', 'ו', 'ש', 'כ']);
const MAX_HINT_WORDS = 4;

/** מילים עבריות מהשאלה (כפי שנכתבו - גם עם אותיות סופיות) שעשויות להיות שם: 4 אותיות ומעלה, וגם בלי תחילית ל/ב/מ/ה/ו/ש/כ (לשיינועטר -> שיינועטר). */
export function nameCandidateWords(text) {
  const toks = String(text || '').normalize('NFC').replace(/[֑-ׇ]/g, '').match(/[א-ת]+/g) || [];
  const out = new Set();
  for (const t of toks) {
    if (Array.from(t).length >= 4) out.add(t);
    if (Array.from(t).length >= 5 && NAME_PREFIXES.has(t[0])) out.add(t.slice(1));
  }
  return [...out].filter((w) => !MONTH_WORDS.has(w)).slice(0, 14);
}

/** האם באחת השאילתות יש הפניה לעמודת שם כלשהי (firstName / lastName / fullName). */
export function hasNamePredicate(sqls) {
  return (sqls || []).some((q) => /"(?:firstName|lastName|fullName)"/i.test(String(q)));
}

/**
 * עובדה לפרומפט: שמות לקוחות שנמצאו בשאלה (עם האיותים הקרובים שבמסד). session.flagged מתעדכן לבדיקה "המודל השמיט את השם".
 * @param {string} prompt
 * @param {{session: ReturnType<typeof createNameSession>, probe: (words: string[]) => Promise<string[]>}} deps  probe = findKnownNameWords
 * @returns {Promise<string>} טקסט להוספה לפרומפט ('' כשאין שמות)
 */
export async function buildNameHint(prompt, { session, probe }) {
  try {
    const words = nameCandidateWords(prompt);
    if (!words.length || typeof probe !== 'function') return '';
    const known = (await probe(words)).slice(0, MAX_HINT_WORDS);
    const lines = [];
    for (const w of known) {
      const rec = await session.resolve('Customer', w);
      if (!rec || (!rec.exactCount && !rec.near.length)) continue;
      session.flag(w);
      const near = rec.near.length ? ` Similar spellings in the database: ${rec.near.map((n) => `"${n.raw}"`).join(', ')}.` : '';
      lines.push(`- "${w}": ${rec.exactCount} customer(s) have this name exactly.${near}`);
    }
    if (!lines.length) return '';
    return `\nCUSTOMER NAMES FOUND IN THE USER'S MESSAGE (computed by the server from the database):\n${lines.join('\n')}\nThese are customer names: the SQL MUST filter by each of them as a customer name (rule S4) - never drop the name filter and never answer about all customers instead. Write the name exactly as the user typed it; the server automatically widens the filter to the similar spellings. Only if a listed word is clearly an ordinary word in the sentence and not a person's name, ignore it.\n`;
  } catch (e) {
    console.warn('smartNames.buildNameHint failed:', e && e.message ? e.message : e);
    return '';
  }
}
