// Shared text sanitising of the two history feeds (customer card + order card).
//
// Pure module (imports only labels.js) so `node scripts/*-history.test.mjs` loads it without a bundler.
//
// The rule both feeds follow: nothing that identifies a payment instrument or a bank account may reach
// the browser through a history entry - no card number longer than its last four digits, no ID number,
// no bank account, no Nedarim / standing-order JSON, no e-mail address or account inside an error text.
// Free text typed by staff or written by the payment / refund flows goes through redactFreeText();
// raw Payment.notes go through safePaymentNote(); identifiers of a person's file (ID number, bank
// account) shown in an edit line go through maskIdentifier().

import { shorten, isEmptyValue } from './labels.js';

export const MASK = '•••';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function parseJsonObject(text) {
  if (text && typeof text === 'object') return text;
  if (typeof text !== 'string' || !text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// Internal ids inside a text: "(פריט #<id>)" tails of charge descriptions and bare UUIDs.
export function stripInternalIds(text) {
  return String(text)
    // no leading \s*: it made this pattern quadratic on a long whitespace run (PERF-1); the \s{2,} pass below
    // collapses the gap the removed tail leaves behind
    .replace(/\(?פריט\s*#\s*[0-9a-f-]{8,}\)?/gi, '')
    .replace(UUID_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Digits of other scripts (Arabic-Indic, Extended Arabic-Indic, full-width) -> ASCII, so one set of
// patterns covers every way a card / ID / account number can be typed.
const NON_ASCII_DIGITS = /[٠-٩۰-۹０-９]/g;
export function toAsciiDigits(text) {
  return String(text).replace(NON_ASCII_DIGITS, (ch) => {
    const c = ch.charCodeAt(0);
    if (c >= 0xFF10) return String(c - 0xFF10);
    if (c >= 0x06F0) return String(c - 0x06F0);
    return String(c - 0x0660);
  });
}

// "(פריט #<id>)" tails are internal ids (AGENTS.md ID display rule). Free text also never shows a card number
// (ORD-3): every free-text field of the order feed (item / rental notes, charge descriptions, mail subjects)
// goes through here, so it masks card numbers - and an ID / account number behind its keyword (ת.ז / ח-ן /
// חשבון / IBAN) like safeNoteText does.
export function cleanText(text, max = 300) {
  if (isEmptyValue(text)) return '';
  return shorten(maskIdentifierText(stripInternalIds(text)), max);
}

// ---- card numbers -------------------------------------------------------------------------------
//
// A card number is typed in every way a person can: "4580123456789012", "4580 1234 5678 9012",
// "4580-1234-...", "4580 - 1234 - ...", "4580.1234...", "4580/1234/...", "4580,1234,...", with NBSP, the
// Unicode hyphens / maqaf, glued to letters ("ref4580 ..."), in Arabic-Indic digits ...
//
// Rule (SAN-1 .. SAN-4). A CHAIN is a run of digit groups joined by 1-3 separator characters (whitespace,
// hyphens U+2010-2015 / U+2212, maqaf U+05BE, "." "_" "/" ","). A chain never starts or ends inside a longer
// digit run ((?<!\d) / (?!\d), not \b: a Latin letter next to a digit is not a boundary).
// A window of consecutive groups of a chain is a CARD when it has 13-19 digits in total AND
//   (a) it has a card SHAPE: 4-4-4-4 (last group 1-4 digits, so also 4-4-4-1..3 and 4-4-4-4-1..3),
//       4-6-5 / 4-6-4 (Amex / Diners) or 8-8; or
//   (b) it passes the Luhn check, no separator is a comma, and either every group has 4+ digits or the
//       groups are uniformly 1-3 digits wide (a card typed "4 5 8 0 ..." or "45 80 12 ...").
// Everything else is a plain list of numbers and is left alone: "28315 1200 5000" (order + amounts, fails
// Luhn), two dates "16.9.2026 17.9.2026" (mixed widths), "1,200 1,300", a phone number (10 digits) or two
// phones whose groups are not uniform. A single group of 13+ digits is always masked. Windows are searched
// inside a longer chain, so "הזמנה 28315 4580 1234 5678 9012" masks only the card.
const SEP = String.raw`[\s \-‐-―−־._/,]{1,3}`;
const DIGIT_CHAIN = new RegExp(String.raw`(?<!\d)\d+(?:${SEP}\d+)*(?!\d)`, 'g');
const CHAIN_GROUP = new RegExp(String.raw`(\d+)(${SEP})?`, 'g');

function luhnOk(digits) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function hasCardShape(sizes) {
  const n = sizes.length;
  // 4-4-4-(1..4) and 4-4-4-4-(1..4)
  if (n >= 4 && sizes.slice(0, n - 1).every((x) => x === 4) && sizes[n - 1] >= 1 && sizes[n - 1] <= 4) return true;
  if (n === 3 && sizes[0] === 4 && sizes[1] === 6 && (sizes[2] === 5 || sizes[2] === 4)) return true;
  if (n === 2 && sizes[0] === 8 && sizes[1] === 8) return true;
  return false;
}
// A card number starts with a real network digit: 3 (Amex / Diners / JCB), 4 (Visa), 5 (Mastercard), 6
// (Discover / UnionPay / Maestro) or 2221-2720 (Mastercard 2-series, always exactly 16 digits: order numbers
// start with 2 as well - "25138 21757 21552" - so the 2-series needs the full 16). Lists of order numbers,
// amounts, years and sizes mostly do not (SAN-6): the shape / Luhn paths require this.
function plausibleCardStart(digits) {
  if (/^[3-6]/.test(digits)) return true;
  const n = Number(digits.slice(0, 4));
  return n >= 2221 && n <= 2720 && digits.length === 16;
}
function uniformNarrow(sizes) {
  const w = sizes[0];
  if (w > 3) return false;
  return sizes.slice(0, -1).every((x) => x === w) && sizes[sizes.length - 1] <= w;
}

// [start, end) character ranges of the cards inside one chain
function cardRangesOfChain(chain) {
  const groups = [];
  CHAIN_GROUP.lastIndex = 0;
  let m;
  while ((m = CHAIN_GROUP.exec(chain)) !== null) {
    groups.push({ start: m.index, end: m.index + m[1].length, digits: m[1], sep: m[2] || '' });
  }
  const covered = new Array(groups.length).fill(false);
  const ranges = [];
  for (const pass of ['shape', 'luhn']) {
    for (let i = 0; i < groups.length; i += 1) {
      if (covered[i] || !/^[2-6]/.test(groups[i].digits)) continue; // cannot start a card (plausibleCardStart)
      let total = 0;
      let best = -1;
      let digits = '';
      const sizes = [];
      for (let j = i; j < groups.length && !covered[j]; j += 1) {
        total += groups[j].digits.length;
        if (total > 19) break;
        digits += groups[j].digits;
        sizes.push(groups[j].digits.length);
        if (total < 13) continue;
        if (!plausibleCardStart(digits)) continue;
        if (pass === 'shape') {
          if (hasCardShape(sizes)) best = j;
        } else if (sizes.length > 1) {
          const seps = groups.slice(i, j).map((g) => g.sep).join('');
          if (seps.includes(',') || !luhnOk(digits)) continue;
          // groups of 1-3 digits ("4 5 8 0 ..." / "45 80 12 ..."): a 15-16 digit number only - 7 consecutive sizes
          // ("34 36 38 40 42 44 46") reach 13-14 digits and pass Luhn one time in ten (SAN-9)
          if (sizes.every((x) => x >= 4) || (uniformNarrow(sizes) && (digits.length === 15 || digits.length === 16))) best = j;
        }
      }
      if (best >= 0) {
        for (let k = i; k <= best; k += 1) covered[k] = true;
        ranges.push([groups[i].start, groups[best].end]);
      }
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

const BARCODE_BEFORE = /(?:ברקוד|barcode|EAN|GTIN)[\s:.\-#'"׳״]{0,4}$/i;

function maskCardChains(text) {
  return toAsciiDigits(text).replace(DIGIT_CHAIN, (chain, offset, whole) => {
    if (chain.length < 13) return chain; // 13 digits need at least 13 characters
    const ranges = cardRangesOfChain(chain);
    // a single group of 13+ digits is always masked (a card, or an id too long to be anything else) - except a
    // 13-digit EAN barcode that is introduced as one (SAN-8)
    const isBarcode = BARCODE_BEFORE.test(whole.slice(Math.max(0, offset - 14), offset));
    for (const run of chain.matchAll(/\d{13,}/g)) {
      const a = run.index;
      if (run[0].length === 13 && isBarcode) continue;
      if (!ranges.some(([x, y]) => a >= x && a < y)) ranges.push([a, a + run[0].length]);
    }
    if (!ranges.length) return chain;
    ranges.sort((x, y) => x[0] - y[0]);
    let out = '';
    let pos = 0;
    for (const [a, b] of ranges) {
      if (a < pos) continue;
      out += chain.slice(pos, a) + MASK;
      pos = b;
    }
    return out + chain.slice(pos);
  });
}

// An identifier introduced by its keyword ("חשבון 99887", "ת.ז. 12345678", "IBAN IL62..."): 5+ digits right
// after the keyword. Only punctuation or "מס'" / "מספר" / "בנק" / "סניף" may sit between the keyword and the
// digits, so "חשבון להזמנה 28315" / "זיכוי אשראי להזמנה 28315" keep their order number (SAN-3).
const CONTEXT_GAP = String.raw`(?:[\s:.\-#'"׳״]|מס(?:פר|['׳])?\.?|בנק|סניף|הפועלים|לאומי|דיסקונט|מזרחי|טפחות|הבינלאומי|מרכנתיל|יהב){0,6}`;
// The keywords, in every spelling (SAN-5): ת.ז ת"ז ת״ז ת''ז תז ת ז, ח.ן ח"ן ח״ן ח-ן (a bare "חן" is a first
// name and is NOT a keyword), ID, account / acct, IBAN, חשבון, זהות, תעודת זהות. The Hebrew abbreviations may not be
// glued to a preceding / following Hebrew letter ("מתז", "תזמון" are words).
const CONTEXT_KEYWORD = String.raw`(?<![א-ת])ת[."״'׳]{0,2}\s?ז(?![א-ת])\.?|(?<![א-ת])ח[-."״'׳]ן(?![א-ת])|חשבון|תעודת זהות|זהות|IBAN|(?<![A-Za-z0-9])(?:ID|acc(?:oun)?t)(?![A-Za-z])`;
// SAN-7: up to 3 short filler words between the keyword and the number ("ת.ז. הלקוחה היא 123456789", "חשבון הבנק:
// 1234567", "account number 12345678", "חשבון בנק הפועלים 123456"). A filler word never contains "הזמנ" / "order"
// (an order number after the keyword is not an id: "חשבון להזמנה 28315"), nor "מס'" / "בנק" / "סניף" (those
// belong to the gap), and a match through fillers needs 6+
// digits (fewer is indistinguishable from an order number) - see the replacer.
const CONTEXT_FILLER = String.raw`((?:\s{1,3}(?![א-תA-Za-z()]*(?:הזמנ|order))(?!(?:מס(?:פר)?['׳]?|בנק|סניף)(?![א-ת]))[א-תA-Za-z()'׳]{1,10}){1,3})`;
const CONTEXT_DIGITS = new RegExp(
  String.raw`(${CONTEXT_KEYWORD})${CONTEXT_FILLER}?(${CONTEXT_GAP})((?:[A-Z]{2})?\d[\d\- ]{3,}\d)`,
  'gi',
);
function maskAfterContextWord(whole, word, filler, gap, digits) {
  if (filler && digits.replace(/\D/g, '').length < 6) return whole;
  return `${word}${filler || ''}${gap}${MASK}`;
}
// digits right after a card word ("כרטיס" / "אשראי" / card / visa ...): the intent is explicit, so a chain of
// 13-19 digits in ANY grouping is a card, and so is a partial number of 2+ groups of 4 digits. A plain
// order number after the word ("אשראי 28315") is neither.
const CARD_WORD_DIGITS = new RegExp(
  String.raw`(כרטיס|אשראי|card|visa|mastercard|ויזה|מאסטרקארד|ישראכרט)([\s:.\-#'"׳״]{0,4})(\d+(?:${SEP}\d+)*)`,
  'gi',
);
function maskAfterCardWord(whole, word, gap, chain) {
  const digits = chain.replace(/\D/g, '').length;
  const fours = /^\d{4}(?:[ \-]\d{4})+$/.test(chain);
  return (digits >= 13 && digits <= 19) || fours ? `${word}${gap}${MASK}` : whole;
}
// grouped IBAN: IL62 0108 0000 0009 9999 999 (also with dashes)
const IBAN_RE = /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]{4}){2,7}(?:[\s-]?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g;

// Card numbers of any typing (see the rule above) + digits that follow a card word.
export function maskCardNumbers(text) {
  return maskCardChains(text).replace(CARD_WORD_DIGITS, maskAfterCardWord);
}

// Identifier masking that keeps ordinary digits (phone numbers, house numbers): card numbers, digits behind
// an ID / account keyword, IBANs. For free text that is legitimately full of digits (ORD-4).
export function maskIdentifierText(text) {
  return maskCardNumbers(toAsciiDigits(text).replace(IBAN_RE, MASK))
    .replace(CONTEXT_DIGITS, maskAfterContextWord);
}

// Every long digit run (ID number, phone, account, card) is masked; 1-5 digit numbers survive
// (order numbers, amounts, years, days).
export function maskDigits(text) {
  return maskIdentifierText(text).replace(/\d{6,}/g, MASK);
}

// Free text typed by staff or written by the refund flow ("החזר ללקוח (בנק 12 סניף 345 חשבון 999888)").
// The refund note carries the bank account: replaced outright; any long digit run is masked.
export function redactFreeText(text, max) {
  if (isEmptyValue(text)) return '';
  const s = stripInternalIds(text);
  if (/^החזר ללקוח\s*\(?\s*בנק/.test(s)) return 'החזר ללקוח (פרטי הבנק אינם מוצגים)';
  return shorten(maskDigits(s), max);
}

// Text that is legitimately full of digits (phone numbers, house numbers) but must still never show a
// card number: only the card patterns are masked.
export function safeDisplayText(text, max = 300) {
  if (isEmptyValue(text)) return '';
  return shorten(maskCardNumbers(stripInternalIds(text)), max);
}

// Notes typed by staff (customer notes, order notes / internal notes): readable on the card itself, so phone
// numbers and house numbers stay, but a card number and any ID / bank-account number introduced by its
// keyword (ת.ז / ח-ן / חשבון / IBAN) are masked (ORD-4). A bare 9-digit number with no keyword is NOT
// masked here (it cannot be told from a phone number).
export function safeNoteText(text, max = 300) {
  if (isEmptyValue(text)) return '';
  return shorten(maskIdentifierText(stripInternalIds(text)), max);
}

// Identifier of a person's file (ID number, bank account): the last 3-4 characters only.
export function maskIdentifier(value) {
  const s = String(value ?? '').replace(/[\s-]/g, '');
  if (s.length <= 4) return MASK;
  return `${MASK}${s.slice(-(s.length >= 8 ? 4 : 3))}`;
}

// Payment notes hold the raw Nedarim response for card payments (ID number, phone, e-mail, address,
// card expiry ...). Only the last four digits and the instalment count survive.
//   -> { last4, installments, text }
export function safePaymentNote(notes) {
  if (isEmptyValue(notes)) return { last4: null, installments: null, text: null };
  const s = String(notes).trim();
  if (s.startsWith('{')) {
    const j = parseJsonObject(s);
    if (j) {
      const digits = String(j.LastNum ?? '').replace(/\D/g, '');
      const inst = num(j.Tashloumim);
      const user = j['הערות משתמש'];
      return {
        last4: digits ? digits.slice(-4) : null,
        installments: inst && inst > 1 ? inst : null,
        text: isEmptyValue(user) ? null : redactFreeText(user, 120),
      };
    }
    return { last4: null, installments: null, text: null }; // JSON we cannot read: show nothing rather than raw text
  }
  // legacy Access import: "<last4> | מס_אישור: <n> | ... | מערכת: { ...the raw Nedarim response... }".
  // Everything from the first "{" on is dropped; a leading 4-digit token is the card's last digits.
  const brace = s.indexOf('{');
  const head = (brace >= 0 ? s.slice(0, brace) : s).replace(/מערכת\s*:?\s*$/, '');
  let last4 = null;
  const keep = [];
  head.split('|').map((x) => x.trim()).filter(Boolean).forEach((part, i) => {
    if (/^מס_אישור\s*:/.test(part) || part.includes('}')) return;
    if (i === 0 && /^\d{4}$/.test(part)) { last4 = part; return; }
    keep.push(redactFreeText(part, 120));
  });
  return { last4, installments: null, text: keep.length ? keep.join(' · ') : null };
}

// One short line for a payment note: "ספרות 1234 · 3 תשלומים" for a card, else the redacted text.
export function paymentNoteSummary(notes) {
  const n = safePaymentNote(notes);
  if (n.last4) return [`ספרות ${n.last4}`, n.installments ? `${n.installments} תשלומים` : null, n.text].filter(Boolean).join(' · ');
  return n.text || '';
}

// ---- e-mail errors -----------------------------------------------------------------------------

const MAIL_ERROR_KINDS = [
  [/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ESOCKET|timed? ?out|connect/i, 'תקלת חיבור לשרת הדואר'],
  [/EAUTH|auth|credential|login|535|534|password/i, 'שרת הדואר דחה את ההזדהות'],
  [/invalid recipient|recipient|mailbox|no such user|user unknown|550|551|552|553|554|address/i, 'כתובת הנמען נדחתה'],
  [/rate|limit|quota|too many|421|450|451|452/i, 'שרת הדואר הגביל את השליחה'],
  [/size|too large|attachment/i, 'הקובץ המצורף גדול מדי'],
];

// SMTP errors usually contain the sender account, the recipient address or a server host. The feed says
// "שליחה נכשלה" and, at most, a generic reason; an unrecognised message contributes a short snippet with
// addresses, hosts, ids and long numbers removed.
export function safeMailError(message) {
  const base = 'שליחה נכשלה';
  if (isEmptyValue(message)) return base;
  // the input is cut BEFORE any regex runs (PERF-2): only the first 1000 characters can end up in the 60-char snippet
  const raw = String(message).slice(0, 1000);
  for (const [re, reason] of MAIL_ERROR_KINDS) if (re.test(raw)) return `${base} (${reason})`;
  const snippet = shorten(
    maskDigits(stripInternalIds(raw
      .replace(/[^\s<>"']+@[^\s<>"']+/g, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+){1,}\b/gi, '')
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '')))
      .replace(/[<>"']/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim(),
    60,
  );
  return snippet ? `${base} (${snippet})` : base;
}
