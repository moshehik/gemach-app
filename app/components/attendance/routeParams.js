// פרמטרי הפתיחה של "סיכום נוכחות" מה-query (?view=month|byemp|emp&emp=<id>&y=2026&m=8) - טהור, נקרא מקבצי הנתיב (שרת).
// m מ-0 (כמו Date.getMonth). ערך לא תקין = ברירת המחדל של הדף (AT-11: החודש הקודם).
export function parseAttendanceQuery(sp = {}) {
  const one = (v) => (Array.isArray(v) ? v[0] : v);
  const view = ['month', 'byemp', 'emp'].includes(one(sp.view)) ? one(sp.view) : undefined;
  const emp = typeof one(sp.emp) === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(one(sp.emp)) ? one(sp.emp) : undefined;
  const y = Number(one(sp.y));
  const m = Number(one(sp.m));
  const okPeriod = Number.isInteger(y) && y >= 2000 && y <= 2100 && Number.isInteger(m) && m >= 0 && m <= 11;
  return { view, empId: emp, ...(okPeriod ? { y, m } : {}) };
}
