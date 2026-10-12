// stationEvents.js - ספירה אנונימית של שלבי הפתיחה בעמדה הציבורית (/station), למסך "המרות בעמדה" שבניהול.
// נשלח רק { type, sid } אל POST /api/public-kiosk/event. sid = מזהה אקראי שנשמר ב-sessionStorage של הלשונית (נעלם עם סגירתה, לא עוגייה,
// לא מקושר לשום פרט של הלקוחה); השרת שומר ממנו רק גיבוב יומי. כשל רשת / חסימה לא משפיע על העמדה בשום צורה.
const KEY = 'station_sid';
const sentThisLoad = new Set();
let memorySid = null;

function randomSid() {
  try {
    const a = new Uint8Array(18);
    window.crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 40).padEnd(16, '0');
  }
}

function sessionId() {
  try {
    let s = window.sessionStorage.getItem(KEY);
    if (!s) { s = randomSid(); window.sessionStorage.setItem(KEY, s); }
    return s;
  } catch (e) {
    if (!memorySid) memorySid = randomSid();
    return memorySid;
  }
}

/** type: 'visit' | 'availability' | 'form_start'. פעם אחת לכל סוג בטעינת העמוד (והשרת מוסיף ספירה אחת לסשן ליום). */
export function trackStationEvent(type) {
  if (typeof window === 'undefined' || sentThisLoad.has(type)) return;
  sentThisLoad.add(type);
  try {
    fetch('/api/public-kiosk/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, sid: sessionId() }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) { /* ספירה בלבד - מתעלמים */ }
}
