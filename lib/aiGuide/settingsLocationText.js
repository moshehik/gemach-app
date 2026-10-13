// lib/aiGuide/settingsLocationText.js - מוסיף לתשובת "איפה ההגדרה" שורת מיקום מדויקת (לשונית + סעיף במסך ההגדרות החדש) מהקטלוג, בקוד ולא מהמודל.
// טהור: נבדק ב-scripts/test_ai_site_guide.mjs.
export function appendSettingLocations(text, catalog) {
  const src = String(text || '');
  const keys = [];
  for (const m of src.matchAll(/\[OPEN_SETTING:([^\]]+)\]/g)) if (!keys.includes(m[1])) keys.push(m[1]);
  const lines = [];
  for (const k of keys.slice(0, 3)) {
    const e = (catalog || []).find((c) => c.key === k);
    if (!e) continue;
    lines.push(e.location ? `מיקום "${e.name}": ${e.location}` : `"${e.name}" אינה מוצגת במסך ההגדרות.`);
  }
  if (!lines.length) return src;
  const idx = src.search(/\[OPEN_SETTING:/);
  return `${src.slice(0, idx).trimEnd()}\n${lines.join('\n')}\n${src.slice(idx)}`;
}
