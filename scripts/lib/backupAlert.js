/**
 * התראת מייל למתכנת על כשל גיבוי ענני (scripts/cloud_backup.js).
 *
 * עד 2026-10-07 כשל גיבוי נרשם רק ב-BackupRun ('failed') ו-ריצת ה-workflow נשארה "ירוקה" -
 * אף אחד לא קיבל הודעה. כאן נשלח מייל לכל המתכנתים הפעילים (roleId=2 עם מייל, בדיוק כמו
 * דיווחי תקלה ב-app/api/error-report/route.js) דרך אותו Apps Script שמשמש את כל מיילי המערכת.
 *
 * הסקריפט רץ ב-GitHub Actions כ-CommonJS רגיל ולכן לא יכול לייבא את lib/mailer.js (ESM עם
 * alias של Next). הוא משחזר רק את הצורה המינימלית של ה-payload (buildGasPayload) וקורא את
 * אותן הגדרות ניתוב (email_link_a/b + email_routing_strategy). כתובת ה-fallback משוכפלת
 * כאן במכוון - אם משנים אותה ב-lib/mailer.js (FALLBACK_SCRIPT_URL) צריך לעדכן גם כאן.
 *
 * הגנות:
 *  - הגבלת תדירות: ה-workflow רץ כל 15 דק' וגיבוי שנכשל מנסה שוב בכל ריצה, ולכן לא נשלח
 *    יותר ממייל אחד לכל ארגון ב-THROTTLE_HOURS (נבדק מול EmailLog של אותו ארגון).
 *  - הכול עטוף ב-try/catch - כשל בשליחת ההתראה אף פעם לא מפיל את הגיבוי עצמו.
 *  - אם ה-DB עצמו לא נגיש (אין מאיפה לקרוא מתכנתים) - נופלים ל-BACKUP_ALERT_EMAIL (env/secret).
 */

'use strict';

const FALLBACK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';
const SUBJECT_PREFIX = 'כשל בגיבוי הנתונים';
const THROTTLE_HOURS = 3;
const PLACEHOLDER_FILE_B64 = Buffer.from('נשלח ממערכת הגמ"ח').toString('base64');

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function resolveScriptUrl(prisma) {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ['email_link_a', 'email_link_b', 'email_routing_strategy', 'gmach_name'] } },
    });
    const v = (k) => rows.find((r) => r.key === k)?.value || '';
    const strategy = v('email_routing_strategy') || 'all_a';
    const a = v('email_link_a');
    const b = v('email_link_b');
    const url = (strategy === 'all_b' || strategy === 'bugs_b_rest_a') && b ? b : a || FALLBACK_SCRIPT_URL;
    return { url, gmachName: v('gmach_name') };
  } catch {
    return { url: FALLBACK_SCRIPT_URL, gmachName: '' };
  }
}

async function resolveRecipients(prisma) {
  const out = new Set();
  try {
    const progs = await prisma.employee.findMany({
      where: { roleId: 2, isActive: true, email: { not: null } },
      select: { email: true },
    });
    // כתובות לא תקינות (למשל "shimonjacobs" בלי @ ב-DB של נווה יעקב) נזרקות - ה-Apps Script
    // דוחה אותן ("אימייל לא חוקי") והיו גורמות לכך שלא יישלח כלום בכלל.
    progs.forEach((p) => {
      const e = (p.email || '').trim();
      if (EMAIL_RE.test(e)) out.add(e);
      else if (e) console.warn(`[backup-alert] skipping invalid programmer email "${e}"`);
    });
  } catch (e) {
    console.warn('[backup-alert] could not read programmers from DB:', e.message);
  }
  const extra = (process.env.BACKUP_ALERT_EMAIL || '').split(/[,;\s]+/).filter(Boolean);
  // כתובת ה-env היא רשת ביטחון: משמשת תמיד כשאין מתכנת ב-DB, ובנוסף אליהם אם הוגדרה.
  extra.filter((e) => EMAIL_RE.test(e)).forEach((e) => out.add(e));
  return [...out];
}

function runLink() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : '';
}

/**
 * @param {object} prisma  PrismaClient של הארגון (יכול להיות null אם אין חיבור בכלל)
 * @param {object} info    { org, stage, error, trigger, lastOkAt }
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
async function notifyBackupFailure(prisma, info) {
  try {
    const { org, stage = 'backup', error, trigger, lastOkAt } = info;
    const errText = String((error && error.message) || error || 'שגיאה לא ידועה').slice(0, 1500);

    let url = FALLBACK_SCRIPT_URL;
    let gmachName = '';
    let to = [];
    if (prisma) {
      ({ url, gmachName } = await resolveScriptUrl(prisma));
      to = await resolveRecipients(prisma);
      // הגבלת תדירות - לפי EmailLog של אותו ארגון (כל ארגון עם DB משלו)
      try {
        const since = new Date(Date.now() - THROTTLE_HOURS * 3600 * 1000);
        const recent = await prisma.emailLog.count({
          where: { subject: { startsWith: SUBJECT_PREFIX }, sentAt: { gte: since }, status: 'success' },
        });
        if (recent > 0) {
          console.log(`[backup-alert] already alerted in the last ${THROTTLE_HOURS}h (org${org}) - not sending again.`);
          return { sent: false, reason: 'throttled' };
        }
      } catch (e) {
        console.warn('[backup-alert] throttle check failed, sending anyway:', e.message);
      }
    } else {
      (process.env.BACKUP_ALERT_EMAIL || '').split(/[,;\s]+/).filter((e) => EMAIL_RE.test(e)).forEach((e) => to.push(e));
    }
    if (!to.length) {
      console.warn('[backup-alert] no recipients (no active programmer with email and no BACKUP_ALERT_EMAIL) - nothing sent.');
      return { sent: false, reason: 'no-recipients' };
    }

    const orgLabel = gmachName || (org === 1 ? 'הגמ"ח הראשי' : org === 2 ? 'נווה יעקב' : `ארגון ${org}`);
    const subject = `${SUBJECT_PREFIX} - ${orgLabel}`;
    const link = runLink();
    const lines = [
      `הגיבוי האוטומטי של ${orgLabel} נכשל ולא נשמר גיבוי חדש.`,
      '',
      `שלב: ${stage}`,
      `סוג הפעלה: ${trigger || 'לא ידוע'}`,
      `גיבוי תקין אחרון: ${lastOkAt ? new Date(lastOkAt).toISOString() : 'לא ידוע / אין'}`,
      `זמן הכשל: ${new Date().toISOString()}`,
      '',
      'השגיאה:',
      errText,
      '',
      ...(link ? ['הרצה ב-GitHub Actions:', link, ''] : []),
      'המערכת תנסה שוב אוטומטית בהרצה הבאה (כל 15 דקות). מייל נוסף על אותה תקלה לא יישלח לפני שעברו 3 שעות.',
      'רשימת הריצות והשגיאות: מסך ניהול ← גיבויים (/admin/backups).',
    ];
    const body = lines.join('\n');
    const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.6">
<h2 style="color:#b91c1c;margin:0 0 8px">⚠️ ${esc(SUBJECT_PREFIX)} - ${esc(orgLabel)}</h2>
<p>הגיבוי האוטומטי נכשל ולא נשמר גיבוי חדש.</p>
<table style="border-collapse:collapse;margin:8px 0">
<tr><td style="padding:2px 12px 2px 0;color:#555">שלב</td><td>${esc(stage)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#555">סוג הפעלה</td><td>${esc(trigger || 'לא ידוע')}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#555">גיבוי תקין אחרון</td><td dir="ltr" style="text-align:right">${esc(lastOkAt ? new Date(lastOkAt).toISOString() : 'לא ידוע / אין')}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#555">זמן הכשל</td><td dir="ltr" style="text-align:right">${esc(new Date().toISOString())}</td></tr>
</table>
<p style="margin:12px 0 4px"><b>השגיאה:</b></p>
<pre dir="ltr" style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px;white-space:pre-wrap;text-align:left">${esc(errText)}</pre>
${link ? `<p><a href="${esc(link)}">הרצה ב-GitHub Actions</a></p>` : ''}
<p style="color:#555;font-size:13px">המערכת תנסה שוב אוטומטית (כל 15 דקות). מייל נוסף על אותה תקלה לא יישלח לפני שעברו ${THROTTLE_HOURS} שעות. פירוט: מסך ניהול ← גיבויים.</p>
</div>`;

    let allOk = true;
    for (const addr of to) {
      let ok = false;
      let errMsg = null;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            noAttachment: true,
            to: addr,
            cc: '',
            subject,
            body,
            htmlBody: html,
            senderName: gmachName || undefined,
            fileName: 'הודעה.txt',
            fileContent: PLACEHOLDER_FILE_B64,
            attachments: [],
            sendMode: 'email',
            driveFolderId: '',
            driveShareEmail: addr,
            driveAllowDownload: false,
            grantFullDownload: false,
          }),
        });
        const text = await res.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = { status: 'error', message: text.slice(0, 300) }; }
        ok = parsed.status === 'success';
        if (!ok) errMsg = parsed.message || 'Unknown error';
      } catch (e) {
        errMsg = e.message;
      }
      if (!ok) allOk = false;
      console.log(`[backup-alert] ${ok ? 'sent' : 'FAILED to send'} to ${addr}${errMsg ? ': ' + errMsg : ''}`);
      if (prisma) {
        try {
          await prisma.emailLog.create({
            data: { to: addr, subject, body, status: ok ? 'success' : 'error', errorMessage: ok ? null : errMsg },
          });
        } catch { /* ignore */ }
      }
    }
    return { sent: allOk };
  } catch (e) {
    console.error('[backup-alert] unexpected error (ignored):', e.message);
    return { sent: false, reason: 'error' };
  }
}

module.exports = { notifyBackupFailure, SUBJECT_PREFIX };
