/**
 * מתזמן דיוורים של מרכז המיילים (Google Apps Script) - 12.10.2026.
 *
 * אותו דפוס בדיוק כמו המתזמן של הצינתוקים המתוזמנים ב-print-center (apps-script-scheduler): האתר שולח לכאן {action:'schedule', id, runAt, site}
 * כשקובעים דיוור מתוזמן; כאן נוצר טריגר חד-פעמי לאותה דקה, ובה נשלחת קריאה אחת בלבד לאתר (POST <site>/api/cron/email-campaigns,
 * Authorization: Bearer <הסוד>) שמריצה את מה שהגיע זמנו. בלי polling - אפס קריאות מיותרות. ביטול: {action:'cancel', id} מוחק את הטריגר.
 * {action:'status'} מחזיר טריגרים ממתינים ואת ההפעלות האחרונות.
 *
 * הבדלים מהמתזמן של print-center (שיפורים):
 *  - הסוד וה-allow-list של האתרים נשמרים ב-Script Properties (לא בקוד המקור): SECRET, ALLOWED_SITES (רשימה מופרדת בפסיקים של origins, למשל
 *    https://gemach-main.vercel.app,https://gemach-neve.vercel.app). סקריפט אחד משרת את שני הגמ"חים.
 *  - תשובת האתר כוללת more>0 כשנשאר דיוור שהתקדם ועוד לא הסתיים (דיוור גדול / מכסת מיילים) - נוצר טריגר המשך בעוד דקה (עד MAX_CHAIN פעמים).
 *  - כשל (אין תשובה / סטטוס לא 2xx): עד MAX_RETRIES ניסיונות חוזרים בהפרשי 3, 6, 9 דקות.
 *
 * הפעלה (חד-פעמית, ע"י הבעלים):
 *  1. script.google.com > פרויקט חדש "gemach-campaign-scheduler" > להדביק את הקובץ הזה; appsscript.json: timeZone "Asia/Jerusalem" וההרשאות
 *     https://www.googleapis.com/auth/script.scriptapp + https://www.googleapis.com/auth/script.external_request.
 *  2. Project Settings > Script Properties: SECRET = מחרוזת אקראית ארוכה; ALLOWED_SITES = כתובות שני האתרים.
 *  3. Deploy > New deployment > Web app: Execute as "Me", Access "Anyone" > לאשר הרשאות פעם אחת > להעתיק את כתובת ה-/exec.
 *  4. ב-Vercel של כל אחד משני הפרויקטים (Production): EMAIL_SCHEDULER_URL = כתובת ה-/exec, EMAIL_SCHEDULER_SECRET = אותו SECRET. אחרי פריסה
 *     "מרכז המיילים > דיוורים" יציג "שליחה מדויקת בשעה שנבחרה".
 *  בלי השלבים האלה הדיוורים המתוזמנים עדיין יוצאים - בהרצות ה-cron של Vercel (~08:30, ~17:30, ~00:30 שעון ישראל), לא בדקה המדויקת.
 */
var MAX_RETRIES = 3;
var MAX_CHAIN = 20; // טריגרי המשך רצופים לאותו דיוור (כ-20 דקות שליחה)

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function props_() { return PropertiesService.getScriptProperties(); }
function secret_() { return props_().getProperty('SECRET') || ''; }
function allowedSites_() { return (props_().getProperty('ALLOWED_SITES') || '').split(',').map(function (x) { return x.trim().replace(/\/+$/, ''); }).filter(Boolean); }

function doPost(e) {
  var b = {};
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  var s = secret_();
  if (!s || !b || b.secret !== s) return json_({ ok: false, error: 'unauthorized' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (b.action === 'schedule') return json_(schedule_(String(b.id || ''), b.runAt, String(b.site || '')));
    if (b.action === 'cancel') return json_(cancel_(String(b.id || '')));
    if (b.action === 'status') return json_(status_());
    return json_({ ok: false, error: 'unknown action' });
  } finally { lock.releaseLock(); }
}

function doGet() { return json_({ ok: true, service: 'gemach-campaign-scheduler' }); }

function schedule_(id, runAt, site) {
  var when = new Date(runAt);
  site = site.replace(/\/+$/, '');
  if (!/^c[a-z0-9]{6,30}$/.test(id) || isNaN(when.getTime())) return { ok: false, error: 'bad args' };
  if (allowedSites_().indexOf(site) < 0) return { ok: false, error: 'site not allowed' };
  cancel_(id);
  var trig = ScriptApp.newTrigger('fire_').timeBased().at(when).create();
  var p = props_();
  p.setProperty('t:' + trig.getUniqueId(), JSON.stringify({ id: id, runAt: when.toISOString(), site: site, tries: 0, chain: 0 }));
  p.setProperty('b:' + id, trig.getUniqueId());
  return { ok: true, triggerId: trig.getUniqueId(), runAt: when.toISOString() };
}

function deleteTrigger_(uid) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getUniqueId() === uid) ScriptApp.deleteTrigger(t); });
}

function cancel_(id) {
  var p = props_();
  var uid = p.getProperty('b:' + id);
  if (uid) { deleteTrigger_(uid); p.deleteProperty('t:' + uid); p.deleteProperty('b:' + id); }
  return { ok: true, cancelled: !!uid };
}

function later_(meta, ms) {
  var p = props_();
  var next = ScriptApp.newTrigger('fire_').timeBased().after(ms).create();
  p.setProperty('t:' + next.getUniqueId(), JSON.stringify(meta));
  p.setProperty('b:' + meta.id, next.getUniqueId());
}

// נקרא ע"י הטריגר בדקה שנקבעה. קריאה אחת לאתר; כשל -> טריגר חוזר; more>0 -> טריגר המשך בעוד דקה.
function fire_(e) {
  var uid = e && e.triggerUid;
  var p = props_();
  var meta = uid ? JSON.parse(p.getProperty('t:' + uid) || 'null') : null;
  if (uid) deleteTrigger_(uid);
  if (!meta) return;
  var ok = false, code = 0, more = 0;
  try {
    var res = UrlFetchApp.fetch(meta.site + '/api/cron/email-campaigns', { method: 'post', headers: { Authorization: 'Bearer ' + secret_() }, muteHttpExceptions: true, followRedirects: true });
    code = res.getResponseCode();
    ok = code >= 200 && code < 300;
    if (ok) { try { more = Number(JSON.parse(res.getContentText()).more) || 0; } catch (err) { more = 0; } }
  } catch (err2) { code = -1; }
  var log = JSON.parse(p.getProperty('log') || '[]');
  log.push({ id: meta.id, wanted: meta.runAt, at: new Date().toISOString(), code: code, ok: ok, more: more });
  p.setProperty('log', JSON.stringify(log.slice(-15)));
  p.deleteProperty('t:' + uid);
  if (ok) {
    p.deleteProperty('b:' + meta.id);
    if (more > 0 && meta.chain < MAX_CHAIN) later_({ id: meta.id, runAt: meta.runAt, site: meta.site, tries: 0, chain: meta.chain + 1 }, 60 * 1000);
    return;
  }
  if (meta.tries < MAX_RETRIES) later_({ id: meta.id, runAt: meta.runAt, site: meta.site, tries: meta.tries + 1, chain: meta.chain }, (meta.tries + 1) * 3 * 60 * 1000);
}

function status_() {
  var p = props_();
  var pending = ScriptApp.getProjectTriggers().map(function (t) { var m = p.getProperty('t:' + t.getUniqueId()); return m ? JSON.parse(m) : null; }).filter(Boolean);
  return { ok: true, pending: pending, log: JSON.parse(p.getProperty('log') || '[]'), triggers: ScriptApp.getProjectTriggers().length };
}
