#!/usr/bin/env node
/**
 * מוריד הסרטת מסך של דיווח שגיאה מהדרייב (דרך גשר הארכיון המשותף - אותו גשר של גיבויי הדרייב) ומחלץ ממנה
 * פריימים כתמונות PNG, כך שקלוד יכול *לראות* מה המשתמש ראה (Read על קובץ PNG). למה סקריפט ולא דרך האתר:
 * `/api/recordings/<fileId>` דורש התחברות של עובד (עוגייה חתומה), ולסוכן האוטומטי אין כזו; ל-workflow יש
 * כבר את הסודות DRIVE_BRIDGE_URL / DRIVE_BRIDGE_SECRET (הגיבויים).
 *
 * Usage:
 *   node scripts/fetch-report-recording.js --file-id=<driveFileId>          # הקלטה בודדת
 *   node scripts/fetch-report-recording.js --report=<errorReportId> [--org=2] # כל ה-gdrive: של דיווח ותגובותיו
 * אופציות:
 *   --frames=N        כמה פריימים לחלץ (ברירת מחדל 8, מפוזרים שווה לאורך הסרטון)
 *   --out=<dir>       תיקיית פלט (ברירת מחדל scratch/report-recordings)
 *   --describe        בנוסף, תיאור טקסטואלי מ-Gemini (דורש GEMINI_API_KEYS ב-env; אין כזה ב-workflow, זה לשימוש מקומי)
 *   --model=<name>    מודל Gemini לתיאור (ברירת מחדל gemini-2.5-flash)
 *   --env-file=<path> קובץ env להשלמת DRIVE_BRIDGE_URL/SECRET (מקומית; מקבל גם MAILER_URL במקום ה-URL,
 *                     כמו ב-print-center). ב-GitHub Actions לא צריך - הסודות כבר ב-env.
 *
 * פלט: JSON ל-stdout - לכל הקלטה: נתיב הוידאו, משך, ורשימת פריימים (path + שנייה). את הפריימים קוראים עם Read.
 * דורש ffmpeg/ffprobe ב-PATH (או FFMPEG_PATH/FFPROBE_PATH); בלעדיו הוידאו עדיין יורד, בלי פריימים.
 * אימות: הקובץ חייב לשאת appProperties.gemachAiRecording (תג של האתר) ושם rec-* - לא מורידים קבצים אחרים מהדרייב.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const o = { frames: 8, out: 'scratch/report-recordings', describe: false, model: 'gemini-2.5-flash' };
  for (const a of argv) {
    let m;
    if ((m = /^--file-id=(.+)$/.exec(a))) o.fileId = m[1];
    else if ((m = /^--report=(.+)$/.exec(a))) o.report = m[1];
    else if ((m = /^--org=(\d+)$/.exec(a))) o.org = parseInt(m[1], 10);
    else if ((m = /^--frames=(\d+)$/.exec(a))) o.frames = Math.max(1, Math.min(24, parseInt(m[1], 10)));
    else if ((m = /^--out=(.+)$/.exec(a))) o.out = m[1];
    else if ((m = /^--model=(.+)$/.exec(a))) o.model = m[1];
    else if ((m = /^--env-file=(.+)$/.exec(a))) o.envFile = m[1];
    else if (a === '--describe') o.describe = true;
  }
  return o;
}

function loadEnvFile(file) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_0-9]+)="?([^"]*)"?\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  if (!process.env.DRIVE_BRIDGE_URL && process.env.MAILER_URL) process.env.DRIVE_BRIDGE_URL = process.env.MAILER_URL;
}

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

function hasFfmpeg() {
  const r = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

function probeDuration(file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat((r.stdout || '').trim());
  return Number.isFinite(d) && d > 0 ? d : null;
}

// הקלטת MediaRecorder (webm) לא תמיד נושאת משך בכותרת; ffprobe מעריך אותו, ואם גם זה נכשל - כל 2 שניות
function extractFrames(file, dir, count) {
  const dur = probeDuration(file);
  const times = dur ? Array.from({ length: count }, (_, i) => +(((i + 0.5) * dur) / count).toFixed(2)) : Array.from({ length: count }, (_, i) => i * 2);
  const frames = [];
  times.forEach((t, i) => {
    const out = path.join(dir, `frame_${String(i + 1).padStart(2, '0')}_t${String(t).replace('.', 'p')}s.png`);
    const r = spawnSync(FFMPEG, ['-v', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=1280:-1', out], { encoding: 'utf8' });
    if (r.status === 0 && fs.existsSync(out)) frames.push({ path: out, atSec: t });
  });
  return { durationSec: dur, frames };
}

async function describeWithGemini(file, model) {
  const keys = (process.env.GEMINI_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean);
  if (!keys.length) return { error: 'GEMINI_API_KEYS לא מוגדר ב-env - דילגתי על --describe' };
  const buf = fs.readFileSync(file);
  let key = null, uploaded = null;
  for (const k of keys) {
    const r = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${k}`, {
      method: 'POST', headers: { 'X-Goog-Upload-Protocol': 'raw', 'Content-Type': 'video/webm' }, body: buf,
    });
    if (r.ok) { uploaded = (await r.json()).file; key = k; break; }
  }
  if (!uploaded) return { error: 'העלאה ל-Gemini נכשלה בכל המפתחות (מכסה?)' };
  let f = uploaded;
  for (let i = 0; i < 30 && f.state !== 'ACTIVE'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    f = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/${uploaded.name}?key=${key}`)).json();
    if (f.state === 'FAILED') return { error: 'Gemini לא הצליח לעבד את הסרטון' };
  }
  const prompt = 'זה סרטון מסך שמשתמש/ת צירף/ה לדיווח תקלה במערכת. תאר בפירוט לפי הסדר מה רואים: אילו דפים/מסכים (כותרות, כתובת), איזה טקסט קריא, ומה המשתמש עושה. אם משהו לא קריא כתוב זאת ואל תנחש.';
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, { fileData: { mimeType: 'video/webm', fileUri: f.uri } }] }] }),
  });
  const j = await g.json();
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || null;
  return text ? { model, text } : { error: `Gemini לא החזיר תשובה (${g.status})` };
}

async function findReportRecordings(reportId, org) {
  const { PrismaClient } = require('@prisma/client');
  const { resolveDbUrl } = require('./lib/db-env');
  const prisma = new PrismaClient({ datasourceUrl: resolveDbUrl(org || 1) });
  try {
    const rows = await prisma.$queryRaw`
      SELECT 'report' AS src, "attachmentUrls" AS urls FROM "ErrorReport" WHERE id = ${reportId}
      UNION ALL
      SELECT 'reply' AS src, "attachmentUrls" AS urls FROM "ErrorReportReply" WHERE "errorReportId" = ${reportId}`;
    const ids = [];
    for (const r of rows) {
      let list = [];
      try { list = r.urls ? JSON.parse(r.urls) : []; } catch { /* ignore */ }
      for (const u of list) if (typeof u === 'string' && u.startsWith('gdrive:')) ids.push({ fileId: u.slice(7), from: r.src });
    }
    return ids;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.envFile) loadEnvFile(o.envFile);
  const driveBridge = require('./lib/driveBridge');
  if (!driveBridge.isConfigured()) {
    console.error('ERROR: חסרים DRIVE_BRIDGE_URL / DRIVE_BRIDGE_SECRET (ב-GitHub Actions הם סודות של ה-repo; מקומית: --env-file=<path>)');
    process.exit(1);
  }
  if (!o.fileId && !o.report) {
    console.error('ERROR: יש לציין --file-id=<id> או --report=<errorReportId>');
    process.exit(1);
  }

  const targets = o.fileId ? [{ fileId: o.fileId, from: 'file-id' }] : await findReportRecordings(o.report, o.org);
  if (!targets.length) {
    console.log(JSON.stringify({ recordings: [], note: 'אין הקלטות (gdrive:) בדיווח הזה או בתגובות שלו' }, null, 2));
    return;
  }

  const ffmpegOk = hasFfmpeg();
  const results = [];
  for (const t of targets) {
    const item = { fileId: t.fileId, from: t.from };
    try {
      const info = await driveBridge.getFileInfo(t.fileId);
      const tag = info.appProperties && info.appProperties.gemachAiRecording;
      if (info.trashed || !tag || !String(tag).startsWith('gemach-ai-recordings-') || !String(info.name || '').startsWith('rec-')) {
        throw new Error('הקובץ אינו הקלטה של האתר (תג/שם לא תואמים) - לא מורידים');
      }
      const dir = path.join(o.out, t.fileId);
      fs.mkdirSync(dir, { recursive: true });
      const video = path.join(dir, info.name);
      await driveBridge.downloadFile(t.fileId, video);
      item.video = video;
      item.sizeBytes = fs.statSync(video).size;
      item.createdTime = info.createdTime;
      item.site = tag;
      if (ffmpegOk) {
        const r = extractFrames(video, dir, o.frames);
        item.durationSec = r.durationSec;
        item.frames = r.frames;
      } else {
        item.frames = [];
        item.note = 'ffmpeg לא זמין ב-PATH - הוידאו ירד, בלי פריימים';
      }
      if (o.describe) item.geminiDescription = await describeWithGemini(video, o.model);
    } catch (e) {
      item.error = e.message || String(e);
    }
    results.push(item);
  }
  console.log(JSON.stringify({ recordings: results }, null, 2));
}

main().catch((e) => {
  console.error('ERROR:', e.message || e);
  process.exit(1);
});
