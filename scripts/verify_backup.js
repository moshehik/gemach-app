#!/usr/bin/env node
/**
 * אימות גיבוי ענני: מוריד את הגיבוי האחרון של ארגון מהדרייב, ובשלב נפרד משווה את הנתונים
 * ששוחזרו ממנו (למסד זמני) מול ה-DB החי, שורה-שורה. ר' .github/workflows/verify-backup.yml
 * (השחזור עצמו - prisma db push + gunzip | psql - הוא בדיוק הנוהל המתועד ב-BACKUPS.md).
 *
 * usage:
 *   node scripts/verify_backup.js download <org> <destFile.sql.gz>
 *   node scripts/verify_backup.js align    <org>      (מוסיף עמודות שקיימות רק ב-DB החי; דורש VERIFY_PG_URL)
 *   node scripts/verify_backup.js compare  <org>      (דורש VERIFY_PG_URL - המסד ששוחזר)
 *
 * השוואה: לכל טבלה - ספירה + hash מצטבר (md5 של כל השורות, לפי עמודות ממוינות). הבדלים נבדקים
 * שורה-שורה ומוסברים אך ורק על ידי יצירה/שינוי אחרי רגע הגיבוי (כותרת הקובץ). כל הבדל שלא
 * מוסבר = כשל. תעבורה מול ה-DB החי: hash מצטבר לכל טבלה, ו-(id,hash) רק לטבלאות עם הבדל.
 */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const { Client } = require('pg');
const { resolveDbUrl } = require('./lib/db-env');
const driveBridge = require('./lib/driveBridge');

const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const META = '/tmp/verify-meta.json';

async function download(org, dest) {
  const c = new Client({ connectionString: resolveDbUrl(org) });
  await c.connect();
  const r = await c.query(`select value from "SystemSetting" where key='backup_drive_folder_id'`);
  await c.end();
  const root = (r.rows[0] && r.rows[0].value) || `gemach-backup-org${org}`;
  const files = (await driveBridge.listFiles(root)).filter((f) => f.name.startsWith(`gemach-org${org}-`));
  if (!files.length) throw new Error(`אין קבצי גיבוי בתיקייה "${root}"`);
  files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
  const f = files[0];
  console.log(`latest backup of org${org}: ${f.name} (${f.size} bytes, created ${f.createdTime}); ${files.length} files in folder "${root}"`);
  await driveBridge.downloadFile(f.id, dest);
  const size = fs.statSync(dest).size;
  if (String(size) !== String(f.size)) throw new Error(`גודל הקובץ שהורד (${size}) שונה מהגודל בדרייב (${f.size})`);
  const fd = fs.openSync(dest, 'r');
  const buf = Buffer.alloc(Math.min(size, 200000));
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  const head = zlib.gunzipSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8').split('\n').slice(0, 6).join('\n');
  const gen = (head.match(/-- generated: (\S+)/) || [])[1];
  if (!gen) throw new Error('כותרת הגיבוי לא נמצאה (הקובץ לא נראה כמו גיבוי)');
  fs.writeFileSync(META, JSON.stringify({ org, name: f.name, size, generated: gen, driveCreated: f.createdTime }));
  console.log('backup header generated at', gen);
}

/**
 * סחף סכימה ידוע (ר' docs/branches-and-worktrees.md): בעמודות שקיימות ב-DB החי אבל לא ב-schema.prisma
 * (כרגע ErrorReport.isArchivedByUser) הגיבוי מכיל נתונים, ושחזור על סכימת prisma בלבד נכשל.
 * כאן מוסיפים למסד הזמני כל עמודה חסרה כזו (לפי הסוג בחי) לפני טעינת הנתונים, ומדווחים עליה.
 */
async function align(org) {
  const live = new Client({ connectionString: resolveDbUrl(org) });
  const rest = new Client({ connectionString: process.env.VERIFY_PG_URL });
  await live.connect();
  await rest.connect();
  const cols = `select c.relname t, a.attname n, format_type(a.atttypid,a.atttypmod) ty, pg_get_expr(d.adbin,d.adrelid) def
    from pg_attribute a join pg_class c on c.oid=a.attrelid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where c.relnamespace='public'::regnamespace and c.relkind='r' and a.attnum>0 and not a.attisdropped`;
  const [L, R] = [(await live.query(cols)).rows, (await rest.query(cols)).rows];
  const have = new Set(R.map((r) => r.t + '.' + r.n));
  const tables = new Set(R.map((r) => r.t));
  let added = 0;
  for (const c of L) {
    if (!tables.has(c.t)) { console.log(`SCHEMA DRIFT: table ${c.t} exists in live but not in schema.prisma`); continue; }
    if (have.has(c.t + '.' + c.n)) continue;
    console.log(`SCHEMA DRIFT: column ${c.t}.${c.n} (${c.ty}) exists in live DB but not in prisma/schema.prisma - adding to scratch DB`);
    await rest.query(`ALTER TABLE ${q(c.t)} ADD COLUMN ${q(c.n)} ${c.ty}${c.def ? ' DEFAULT ' + c.def : ''}`);
    added++;
  }
  console.log(`aligned: ${added} extra column(s) added`);
  await live.end();
  await rest.end();
}

async function compare(org) {
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const cutoff = new Date(meta.generated);
  const live = new Client({ connectionString: resolveDbUrl(org) });
  const rest = new Client({ connectionString: process.env.VERIFY_PG_URL });
  await live.connect();
  await rest.connect();

  const tabs = async (c) => (await c.query(`select table_name t from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)).rows.map((r) => r.t);
  const [lt, rt] = [await tabs(live), await tabs(rest)];
  const notes = [];
  const missingTables = lt.filter((t) => !rt.includes(t));
  if (missingTables.length) notes.push(`טבלאות חיות שחסרות במסד המשוחזר: ${missingTables.join(', ')}`);

  const colsOf = async (c, t) => (await c.query(`select column_name n from information_schema.columns where table_schema='public' and table_name=$1 order by column_name`, [t])).rows.map((r) => r.n);
  const tsColsOf = async (c, t) => (await c.query(`select column_name n from information_schema.columns where table_schema='public' and table_name=$1 and data_type like 'timestamp%'`, [t])).rows.map((r) => r.n);
  let totalRows = 0, totalExplained = 0, totalUnexplained = 0, deletedLater = 0;
  const report = [];

  for (const t of lt.filter((x) => rt.includes(x))) {
    const [lc, rc] = [await colsOf(live, t), await colsOf(rest, t)];
    const common = lc.filter((a) => rc.includes(a));
    const onlyLive = lc.filter((a) => !rc.includes(a));
    if (onlyLive.length) notes.push(`${t}: עמודות שקיימות רק בחי (לא נבדקו): ${onlyLive.join(',')}`);
    const expr = `md5(concat_ws('|', ${common.map((c) => `coalesce(${q(c)}::text,'∅')`).join(', ')}))`;
    const agg = `select count(*)::int c, coalesce(md5(string_agg(h,'' order by h)),'') m from (select ${expr} h from ${q(t)}) s`;
    const [a, b] = [(await live.query(agg)).rows[0], (await rest.query(agg)).rows[0]];
    totalRows += a.c;
    if (a.m === b.m && a.c === b.c) { report.push(`OK        ${t.padEnd(26)} ${a.c} שורות זהות`); continue; }

    // כל עמודות הזמן של הטבלה: שורה "מוסברת" אם אחת מהן מאוחרת מרגע הגיבוי (נוצרה/עודכנה אחריו)
    const tsCols = (await tsColsOf(live, t)).filter((c) => common.includes(c));
    const mx = tsCols.length ? `greatest(${tsCols.map((c) => `coalesce(${q(c)},'-infinity')`).join(', ')})::text` : 'null';
    const rows = `select id::text id, ${expr} h, ${mx} mx from ${q(t)}`;
    const [LA, RA] = [new Map((await live.query(rows)).rows.map((r) => [r.id, r])), new Map((await rest.query(rows)).rows.map((r) => [r.id, r]))];
    let explained = 0, unexplained = 0;
    const samples = [];
    // BackupRun: שורת הריצה שמבצעת את הגיבוי עצמו נראית בקובץ כ-'running' ובחי כ-'ok' - תמיד מוסבר
    const slack = t === 'BackupRun' ? 180000 : 5000;
    const after = (r) => r.mx && new Date(r.mx.replace(' ', 'T') + 'Z') > new Date(cutoff.getTime() - slack);
    for (const [id, r] of LA) {
      const o = RA.get(id);
      if (!o) { if (after(r)) explained++; else { unexplained++; samples.push(`חסר בשחזור: ${id}`); } }
      else if (o.h !== r.h) { if (after(r)) explained++; else { unexplained++; samples.push(`שונה: ${id}`); } }
    }
    // שורה שקיימת בגיבוי ולא בחי = נמחקה בחי אחרי הגיבוי (מחיקה אין לה חותמת זמן) - אזהרה, לא כשל
    for (const id of RA.keys()) if (!LA.has(id)) { deletedLater++; samples.push(`נמחקה בחי אחרי הגיבוי (אזהרה): ${id}`); }
    totalExplained += explained;
    totalUnexplained += unexplained;
    report.push(`${unexplained ? "DIFF      " : "OK(delta) "} ${t.padEnd(26)} חי=${a.c} משוחזר=${b.c} | שינויים אחרי הגיבוי (מוסברים): ${explained} | לא מוסברים: ${unexplained}${samples.length ? ' | ' + samples.slice(0, 5).join('; ') : ''}`);
  }
  console.log('\n===== תוצאות אימות org' + org + ' =====');
  console.log(`קובץ: ${meta.name} (${meta.size} bytes), נוצר ${meta.generated}`);
  report.forEach((l) => console.log(l));
  console.log(`\nסה"כ שורות חיות: ${totalRows} | הבדלים מוסברים (אחרי הגיבוי): ${totalExplained} | לא מוסברים: ${totalUnexplained} | נמחקו בחי אחרי הגיבוי (אזהרה): ${deletedLater}`);
  notes.forEach((i) => console.log('הערה: ' + i));
  await live.end();
  await rest.end();
  if (totalUnexplained > 0 || missingTables.length) { console.error('VERIFY FAILED'); process.exit(1); }
  console.log('VERIFY PASSED');
}

(async () => {
  const [mode, orgArg, dest] = process.argv.slice(2);
  const org = Number(orgArg);
  if (mode === 'download') await download(org, dest);
  else if (mode === 'align') await align(org);
  else if (mode === 'compare') await compare(org);
  else throw new Error('usage: download <org> <dest> | align <org> | compare <org>');
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
