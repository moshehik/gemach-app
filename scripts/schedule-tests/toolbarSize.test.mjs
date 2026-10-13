// סרגל הכלים בכותרת הלו״ז (הבעלים 12.10.2026, "הלחצן לא באותו גודל"): גלגל ההגדרות (.ibtn) היה 44px והדפסה / הורדה / XL
// (.xlbtn) 36px. עכשיו כלל אחד ב-app/schedule/schedule.css קובע לכולם קוטר, מסגרת וגודל אייקון, וגם את גובה מתג התצוגה.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROJ = process.env.PROJ;
const css = readFileSync(path.join(PROJ, 'app/schedule/schedule.css'), 'utf8').replace(/\r\n/g, '\n');
const slots = readFileSync(path.join(PROJ, 'app/components/schedule/ScheduleToolbarSlots.js'), 'utf8');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));

test('one shared rule sizes .xlbtn and .ibtn in the toolbars from --lz-tool / --lz-tool-ic', () => {
  const r = rules.find((x) => /:is\(\.lz-dtools,\.lz-stools\) :is\(\.xlbtn,\.ibtn\)$/.test(x.sel));
  assert.ok(r, 'shared button rule exists');
  assert.match(r.body, /width:var\(--lz-tool\)/);
  assert.match(r.body, /height:var\(--lz-tool\)/);
  assert.match(r.body, /border-width:1px/);
  assert.match(r.body, /border-radius:999px/);
  const ic = rules.find((x) => /:is\(\.xlbtn,\.ibtn\) :is\(\.ic,\.xlic,\.prtic,\.dlic\)$/.test(x.sel));
  assert.ok(ic && /width:var\(--lz-tool-ic\)/.test(ic.body) && /height:var\(--lz-tool-ic\)/.test(ic.body), 'shared icon size rule');
  assert.ok(rules.some((x) => /\.gm-ds\.gm-lz$/.test(x.sel) && /--lz-tool:\d+px/.test(x.body) && /--lz-tool-ic:\d+px/.test(x.body)), 'tokens defined once');
});

test('no other schedule.css rule gives the toolbar buttons their own px width/height', () => {
  const bad = rules.filter((x) => /(\.lz-dtools|\.lz-stools)[^,]*(\.xlbtn|\.ibtn)/.test(x.sel) && /(^|;)\s*(width|height):\s*\d/.test(x.body));
  assert.deepEqual(bad.map((x) => x.sel), []);
});

test('view switch height follows the same token', () => {
  const r = rules.find((x) => /\.lz-hb \.vsw$/.test(x.sel));
  assert.ok(r && /height:var\(--lz-tool\)/.test(r.body));
});

test('PageTools renders the gear and the three wizard buttons inside the same .tools.lz-dtools container, colours untouched', () => {
  const page = slots.slice(slots.indexOf('export function PageTools'), slots.indexOf('export function SectionTools'));
  assert.ok(/className="tools lz-dtools"/.test(page));
  assert.ok(/<WizButton mode="xl"/.test(page) && /<WizButton mode="dl"/.test(page) && /<WizButton mode="print"/.test(page));
  assert.ok(/className="ibtn"/.test(page));
  assert.ok(!/style=/.test(page), 'no inline sizes on the buttons');
  assert.ok(!/(background|border-color|color)\s*:/.test(rules.filter((x) => /--lz-tool|\.lz-dtools,\.lz-stools/.test(x.sel + x.body)).map((x) => x.body).join(';')), 'the sizing rules do not touch colours');
});
