'use client';

// הדגשת מילות החיפוש בהיסטוריה (hfHl בדגימה: <mark class="hf-mk">) - בלי innerHTML.
export default function Hl({ text, words }) {
  const s = text === null || text === undefined ? '' : String(text);
  if (!s || !words || !words.length) return s;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = s.split(re);
  return parts.map((p, i) => (i % 2 === 1 ? <mark className="hf-mk" key={i}>{p}</mark> : p));
}
