#!/usr/bin/env node
/**
 * מוריד את הצרופות של דיווח תקלה (ErrorReport + כל התגובות בשרשור) וממיר אותן לפורמט שקלוד
 * יכול לקרוא: מסמכי וורד (docx/doc), אקסל (xlsx/xls/csv), פאוור פוינט (pptx), טקסט (txt/rtf)
 * נחלצים לטקסט; תמונות ו-PDF נשמרים לדיסק וקלוד קורא אותם ישירות עם כלי Read (הוא רואה תמונות
 * וקורא PDF). הצרופות מאוחסנות בטבלת Attachment (ר' lib/attachmentUpload.js) - הכתובת
 * /api/attachment/<id>?n=<שם קובץ>, וה-?n= נושא את השם/הסיומת המקורית.
 *
 * Usage:
 *   node scripts/read-error-attachments.js <reportId>            # גמח 1 (ראשי)
 *   node scripts/read-error-attachments.js <reportId> --org=2    # נווה יעקב
 *   node scripts/read-error-attachments.js --all-open [--org=2]  # כל הדיווחים הפתוחים שיש להם צרופות
 *   --out=<dir>  תיקיית פלט (ברירת מחדל: תיקיית temp של המערכת)
 *
 * פלט (JSON ל-stdout): לכל צרופה - מקור (דיווח/תגובה), שם, סוג, נתיב לקובץ שהורד, ו-text
 * (הטקסט שחולץ) כשמדובר במסמך. צרופות "gdrive:" (הקלטות מסך ב-Drive) ותמונות/PDF מקבלים רק path/url.
 *
 * טעינת env/בחירת DB: ר' scripts/lib/db-env.js.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const MAX_TEXT_CHARS = 60000;

// ---- קורא zip מינימלי (docx/pptx/xlsx הם zip) - בלי תלות חדשה ----
function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('לא zip תקין');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries[name] = () => (method === 0 ? raw : zlib.inflateRawSync(raw));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

// XML של וורד/פאוור פוינט -> טקסט: פסקאות/שורות טבלה -> שורות, טאבים ושבירות שורה נשמרים.
function officeXmlToText(xml, paraTag) {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:(br|cr)\/>/g, '\n')
      .replace(new RegExp(`</${paraTag}>`, 'g'), '\n')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<[^>]+>/g, '')
  ).replace(/\n{3,}/g, '\n\n').trim();
}

function docxToText(buf) {
  const e = readZipEntries(buf);
  const parts = [];
  if (e['word/document.xml']) parts.push(officeXmlToText(e['word/document.xml']().toString('utf8'), 'w:p'));
  for (const name of Object.keys(e).filter((n) => /^word\/(header|footer|footnotes|endnotes|comments)\d*\.xml$/.test(n))) {
    const t = officeXmlToText(e[name]().toString('utf8'), 'w:p');
    if (t) parts.push(`[${path.basename(name, '.xml')}]\n${t}`);
  }
  return parts.join('\n\n');
}

function pptxToText(buf) {
  const e = readZipEntries(buf);
  const slides = Object.keys(e).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml/)[1]) - Number(b.match(/(\d+)\.xml/)[1]));
  return slides.map((n, i) => `--- שקף ${i + 1} ---\n${officeXmlToText(e[n]().toString('utf8'), 'a:p')}`).join('\n\n');
}

function spreadsheetToText(buf) {
  const XLSX = require('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  return wb.SheetNames.map((name) => `--- גיליון: ${name} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`).join('\n\n');
}

// .doc ישן (בינארי): אין פענוח מלא - שולפים רצפי טקסט UTF-16LE קריאים (עברית/לטינית/ספרות).
function legacyDocToText(buf) {
  const text = buf.toString('utf16le');
  const runs = text.match(/[֐-׿ -~ -ÿ -⁯\r\n\t]{6,}/g) || [];
  return runs.map((r) => r.trim()).filter(Boolean).join('\n');
}

function rtfToText(buf) {
  return buf.toString('latin1')
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => Buffer.from(h, 'hex').toString('latin1'))
    .replace(/\\u(-?\d+)\??/g, (_, d) => String.fromCharCode(Number(d) < 0 ? Number(d) + 65536 : Number(d)))
    .replace(/\\par[d]?/g, '\n').replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '');
}

function extractText(ext, buf) {
  switch (ext) {
    case 'docx': return docxToText(buf);
    case 'pptx': return pptxToText(buf);
    case 'xlsx': case 'xls': return spreadsheetToText(buf);
    case 'doc': return legacyDocToText(buf);
    case 'rtf': return rtfToText(buf);
    case 'csv': case 'txt': return buf.toString('utf8');
    default: return null;
  }
}

function parseAttachmentUrl(url) {
  const m = /\/api\/attachment\/([0-9a-f-]{36})(?:\?(.*))?$/i.exec(url);
  if (!m) return null;
  const n = new URLSearchParams(m[2] || '').get('n');
  return { id: m[1], name: n || null };
}

function sniffExt(buf, contentType) {
  if (/^image\/(png|jpe?g|gif|webp)/.test(contentType)) return contentType.split('/')[1].replace('jpeg', 'jpg');
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('video/')) return 'video';
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  return 'bin';
}

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const allOpen = rest.includes('--all-open');
  const outArg = rest.find((a) => a.startsWith('--out='));
  const reportId = rest.find((a) => !a.startsWith('--'));
  if (!allOpen && !reportId) {
    console.error('Usage: node scripts/read-error-attachments.js <reportId> [--org=2] [--out=dir]  |  --all-open');
    process.exit(1);
  }
  const outDir = outArg ? outArg.slice(6) : path.join(os.tmpdir(), 'error-report-attachments');
  fs.mkdirSync(outDir, { recursive: true });

  const prisma = new PrismaClient({ datasourceUrl: resolveDbUrl(org) });
  try {
    const reports = await prisma.errorReport.findMany({
      where: allOpen ? { status: 'OPEN' } : { id: reportId },
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });
    const result = [];
    for (const r of reports) {
      const sources = [{ from: 'report', urls: r.attachmentUrls }, ...r.replies.map((rep) => ({ from: `reply ${rep.id}`, urls: rep.attachmentUrls }))];
      const attachments = [];
      for (const src of sources) {
        let urls = [];
        try { urls = src.urls ? JSON.parse(src.urls) : []; } catch { /* ignore */ }
        for (const url of urls) {
          const item = { from: src.from, url };
          const parsed = typeof url === 'string' ? parseAttachmentUrl(url) : null;
          if (!parsed) { item.note = String(url).startsWith('gdrive:') ? 'הקלטת מסך ב-Google Drive - לא ניתנת לקריאה כאן' : 'כתובת חיצונית'; attachments.push(item); continue; }
          // SQL גולמי ולא prisma.attachment - עובד גם מול Prisma Client שנוצר לפני שהמודל Attachment נוסף
          const [row] = await prisma.$queryRaw`SELECT "data", "contentType" FROM "Attachment" WHERE "id" = ${parsed.id}`;
          if (!row) { item.note = 'הקובץ לא נמצא במסד'; attachments.push(item); continue; }
          const buf = Buffer.from(row.data);
          const declaredExt = parsed.name && /\.([a-z0-9]+)$/i.exec(parsed.name)?.[1].toLowerCase();
          const ext = declaredExt || sniffExt(buf, row.contentType);
          const fileName = parsed.name || `${parsed.id}.${ext}`;
          const filePath = path.join(outDir, `${r.id.slice(0, 8)}-${parsed.id.slice(0, 8)}-${fileName}`);
          fs.writeFileSync(filePath, buf);
          Object.assign(item, { name: fileName, contentType: row.contentType, sizeBytes: buf.length, path: filePath });
          if (IMAGE_EXT.includes(ext) || ext === 'pdf') {
            item.note = 'תמונה/PDF - לקרוא ישירות עם כלי Read על ה-path';
          } else if (ext === 'video') {
            item.note = 'וידאו - לא ניתן לקריאה כטקסט';
          } else {
            try {
              const text = extractText(ext, buf);
              if (text != null) {
                item.text = text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n...[נחתך - ${text.length} תווים]` : text;
              }
            } catch (err) {
              item.note = `חילוץ הטקסט נכשל: ${err.message}`;
            }
          }
          attachments.push(item);
        }
      }
      if (attachments.length > 0) result.push({ reportId: r.id, title: r.title, attachments });
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('ERROR:', err.message || err);
    process.exit(1);
  });
}

module.exports = { extractText, docxToText, parseAttachmentUrl };
