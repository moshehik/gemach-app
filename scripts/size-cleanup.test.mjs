// Tests for scripts/size_cleanup_apply.js + scripts/size_cleanup_rollback.js (12.10.2026). No DB, no network: the pg client is an
// in-memory fake that understands exactly the statements the two scripts send (and enforces READ ONLY / transactions / the
// compare-and-swap WHERE clauses), so the REAL planning, backup and rollback code runs against a synthetic dataset.
//   node --test scripts/size-cleanup.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const apply = require('./size_cleanup_apply.js');
const rb = require('./size_cleanup_rollback.js');

const quiet = () => {};
const clone = (o) => JSON.parse(JSON.stringify(o));

function fixture() {
  const models = {
    m607: { name: '607', exit: '2025-09-28' }, m136: { name: '136', exit: '2023-07-01' }, m420: { name: '420', exit: '2023-07-12' },
    m533: { name: '533', exit: null }, // active model: must never be touched
  };
  const mk = (id, model, barcode, sizeText, extra = {}) => ({ id, model, barcode, sizeText, isDeleted: false, notInUse: false, notInUseSince: null, notInUseReason: null, updatedAt: '2024-01-01 10:00:00', ...extra });
  return {
    models,
    items: [
      mk('i1', 'm607', '6073201', ' 32'), mk('i2', 'm607', '6073601', '  36'), mk('i3', 'm607', '6074001', '40 '),
      mk('i4', 'm136', '1363601', '36א'), mk('i5', 'm136', '1363602', '36ד'), mk('i6', 'm136', '1364002', '  40א'),
      mk('i7', 'm420', '4200501', '05.2'), mk('i8', 'm420', '4200001', '00.5'),
      mk('i9', 'm420', '4200901', '38.0'),                 // zero fraction: not a decimal size -> untouched
      mk('i10', 'm420', '4200902', '09.2', { notInUse: true, notInUseReason: 'ידני' }), // already not in use -> untouched
      mk('i11', 'm533', '5330601', ' 36'),                   // active model -> untouched
      mk('i12', 'm607', '6073602', ' 38', { isDeleted: true }), // deleted -> untouched
      mk('i13', 'm607', '6074201', '08'), mk('i14', 'm607', '6074202', '8'), // plain whole sizes -> untouched
      mk('i15', 'm533', '5330602', '06.1'),                  // decimal on an ACTIVE model -> untouched
    ],
  };
}

/** In-memory stand-in for a pg Client. hooks.afterSelect lets a test change a row between the plan and the UPDATEs. */
function fakeClient(db, hooks = {}) {
  const log = [];
  let snap = null; let readOnly = false; let inTx = false;
  const modelOf = (i) => db.models[i.model];
  const client = {
    log,
    async query(sql, params = []) {
      const s = sql.trim();
      if (s === 'BEGIN' || s === 'BEGIN READ ONLY') { assert.equal(inTx, false); inTx = true; readOnly = s !== 'BEGIN'; snap = clone(db.items); log.push(s); return { rows: [], rowCount: 0 }; }
      if (s === 'COMMIT') { inTx = false; snap = null; log.push('COMMIT'); return { rows: [], rowCount: 0 }; }
      if (s === 'ROLLBACK') { if (snap) db.items = snap; inTx = false; snap = null; log.push('ROLLBACK'); return { rows: [], rowCount: 0 }; }
      assert.ok(inTx, 'statement outside a transaction: ' + s.slice(0, 40));
      if (s.startsWith('SELECT i.id')) {
        if (s.includes('FOR UPDATE')) assert.equal(readOnly, false, 'FOR UPDATE inside READ ONLY');
        log.push('SELECT candidates');
        const rows = db.items.filter((i) => !i.isDeleted && modelOf(i).exit && i.sizeText != null && !/^[0-9]{1,3}$/.test(i.sizeText))
          .map((i) => ({ id: i.id, barcode: i.barcode, sizeText: i.sizeText, notInUse: i.notInUse, notInUseSince: i.notInUseSince, notInUseReason: i.notInUseReason, updatedAt: i.updatedAt, model: modelOf(i).name, modelExit: modelOf(i).exit }));
        if (hooks.afterSelect) { hooks.afterSelect(db); hooks.afterSelect({ items: snap }); hooks.afterSelect = null; } // a concurrent edit by ANOTHER transaction survives our ROLLBACK
        return { rows, rowCount: rows.length };
      }
      if (s.startsWith('SELECT id, "sizeText"')) {
        const rows = db.items.filter((i) => params[0].includes(i.id)).map((i) => ({ id: i.id, sizeText: i.sizeText, notInUse: i.notInUse, notInUseReason: i.notInUseReason, notInUseSince: i.notInUseSince }));
        return { rows, rowCount: rows.length };
      }
      assert.equal(readOnly, false, 'write statement inside READ ONLY: ' + s.slice(0, 40));
      const find = (id) => db.items.find((i) => i.id === id);
      if (s === apply.UPDATE_SIZE.trim()) {
        const [id, to, from, at] = params; const i = find(id); log.push('UPDATE size ' + id);
        if (!i || i.sizeText !== from || i.isDeleted) return { rows: [], rowCount: 0 };
        i.sizeText = to; i.updatedAt = at; return { rows: [], rowCount: 1 };
      }
      if (s === apply.UPDATE_FLAG.trim()) {
        const [id, reason, from, at] = params; const i = find(id); log.push('UPDATE flag ' + id);
        if (!i || i.notInUse || i.sizeText !== from || i.isDeleted) return { rows: [], rowCount: 0 };
        i.notInUse = true; i.notInUseSince = at; i.notInUseReason = reason; i.updatedAt = at; return { rows: [], rowCount: 1 };
      }
      if (s === rb.RESTORE_SIZE.trim()) {
        const [id, to, from, at] = params; const i = find(id); log.push('RESTORE size ' + id);
        if (!i || i.sizeText !== from) return { rows: [], rowCount: 0 };
        i.sizeText = to; i.updatedAt = at; return { rows: [], rowCount: 1 };
      }
      if (s === rb.RESTORE_FLAG.trim()) {
        const [id, since, afterReason, at, beforeReason] = params; const i = find(id); log.push('RESTORE flag ' + id);
        if (!i || !i.notInUse || i.notInUseReason !== afterReason) return { rows: [], rowCount: 0 };
        i.notInUse = false; i.notInUseSince = since; i.notInUseReason = beforeReason; i.updatedAt = at; return { rows: [], rowCount: 1 };
      }
      throw new Error('fake client: unexpected SQL ' + s.slice(0, 80));
    },
  };
  return client;
}

const HOST = 'ep-young-math-test.c-5.eu-central-1.aws.neon.tech';
const memBackup = () => { const store = { files: [] }; return { store, backupWriter: (b) => { store.files.push(clone(b)); return 'mem://backup-' + store.files.length; }, backupFinalizer: (f, b) => { b.status = 'committed'; } }; };

test('planning: only the approved groups, only exited models, nothing else', () => {
  const db = fixture();
  const c = fakeClient(db);
  return apply.run(c, { write: false, host: HOST, log: quiet }).then(({ plan, applied }) => {
    assert.equal(applied, 0);
    assert.deepEqual(plan.summary, { TRIM: 3, LETTER: 3, DECIMAL_NOT_IN_USE: 2 });
    const ids = plan.changes.map((x) => x.id).sort();
    assert.deepEqual(ids, ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8']);
    const byId = Object.fromEntries(plan.changes.map((x) => [x.id, x]));
    assert.equal(byId.i2.fields.sizeText.after, '36');
    assert.equal(byId.i3.fields.sizeText.after, '40');
    assert.equal(byId.i4.fields.sizeText.after, '36');
    assert.equal(byId.i6.fields.sizeText.after, '40');
    assert.equal(byId.i7.fields.sizeText, undefined, 'a decimal size value is never changed');
    assert.deepEqual(Object.keys(byId.i7.fields).sort(), ['notInUse', 'notInUseReason']);
  });
});

test('dry-run: READ ONLY transaction, no UPDATE, data untouched', async () => {
  const db = fixture(); const before = clone(db.items);
  const c = fakeClient(db);
  await apply.run(c, { write: false, host: HOST, log: quiet });
  assert.deepEqual(db.items, before);
  assert.equal(c.log[0], 'BEGIN READ ONLY');
  assert.ok(!c.log.some((l) => l.startsWith('UPDATE')));
});

test('write: backup is persisted BEFORE the first UPDATE, plan JSON identical to the dry-run, one COMMIT', async () => {
  const dry = await apply.run(fakeClient(fixture()), { write: false, host: HOST, log: quiet });
  const db = fixture(); const c = fakeClient(db); const m = memBackup();
  const order = [];
  const res = await apply.run(c, { write: true, host: HOST, runAt: new Date('2026-10-13T08:00:00Z'), log: quiet, backupWriter: (b) => { order.push(c.log.length); return m.backupWriter(b); }, backupFinalizer: m.backupFinalizer });
  assert.equal(res.applied, 8);
  assert.equal(JSON.stringify(res.plan), JSON.stringify(dry.plan), 'dry-run JSON === run JSON');
  assert.equal(JSON.stringify(m.store.files[0].plan), JSON.stringify(dry.plan), 'backup.plan === dry-run JSON');
  const firstUpdate = c.log.findIndex((l) => l.startsWith('UPDATE'));
  assert.ok(order[0] <= firstUpdate, 'backup written before the first UPDATE');
  assert.equal(c.log.filter((l) => l === 'COMMIT').length, 1);
  const get = (id) => db.items.find((i) => i.id === id);
  assert.equal(get('i1').sizeText, '32'); assert.equal(get('i2').sizeText, '36'); assert.equal(get('i3').sizeText, '40');
  assert.equal(get('i4').sizeText, '36'); assert.equal(get('i6').sizeText, '40');
  assert.equal(get('i7').sizeText, '05.2', 'decimal value untouched'); assert.equal(get('i7').notInUse, true);
  assert.equal(get('i7').notInUseSince, '2026-10-13T08:00:00.000Z');
  assert.equal(get('i7').notInUseReason, apply.NOT_IN_USE_REASON);
  for (const id of ['i9', 'i10', 'i11', 'i12', 'i13', 'i14', 'i15']) assert.deepEqual(get(id), fixture().items.find((i) => i.id === id), 'untouched: ' + id);
  // backup rows carry before/after for every changed field
  const b = m.store.files[0]; assert.equal(b.rows.length, 8);
  const r7 = b.rows.find((r) => r.id === 'i7'); assert.equal(r7.before.notInUse, false); assert.equal(r7.after.notInUse, true); assert.equal(r7.before.sizeText, '05.2'); assert.equal(r7.after.sizeText, '05.2');
});

test('idempotent: a second write run finds nothing and changes nothing', async () => {
  const db = fixture(); const m = memBackup();
  await apply.run(fakeClient(db), { write: true, host: HOST, log: quiet, backupWriter: m.backupWriter });
  const afterFirst = clone(db.items);
  const c2 = fakeClient(db);
  const res = await apply.run(c2, { write: true, host: HOST, log: quiet, backupWriter: m.backupWriter });
  assert.equal(res.applied, 0); assert.equal(res.plan.changes.length, 0);
  assert.deepEqual(db.items, afterFirst);
  assert.equal(m.store.files.length, 1, 'no second backup file for an empty plan');
  assert.ok(!c2.log.some((l) => l.startsWith('UPDATE')));
});

test('compare-and-swap: a row edited between plan and UPDATE aborts and rolls the whole transaction back', async () => {
  const db = fixture(); const before = clone(db.items); const m = memBackup();
  const c = fakeClient(db, { afterSelect: (d) => { d.items.find((i) => i.id === 'i6').sizeText = '  40א '; } });
  await assert.rejects(apply.run(c, { write: true, host: HOST, log: quiet, backupWriter: m.backupWriter }), /Compare-and-swap failed/);
  const expected = clone(before); expected.find((i) => i.id === 'i6').sizeText = '  40א ';
  assert.deepEqual(db.items, expected, 'earlier UPDATEs were rolled back; only the concurrent edit remains');
  assert.equal(c.log.at(-1), 'ROLLBACK');
});

test('backup writer failure: nothing is updated', async () => {
  const db = fixture(); const before = clone(db.items); const c = fakeClient(db);
  await assert.rejects(apply.run(c, { write: true, host: HOST, log: quiet, backupWriter: () => { throw new Error('disk full'); } }), /disk full/);
  assert.deepEqual(db.items, before); assert.ok(!c.log.some((l) => l.startsWith('UPDATE')));
});

test('--max-changes guard aborts an unexpectedly large plan', async () => {
  await assert.rejects(apply.run(fakeClient(fixture()), { write: false, host: HOST, maxChanges: 3, log: quiet }), /more than --max-changes/);
});

test('rollback: dry-run classifies, write restores every field exactly, repeat is a no-op, conflicts abort', async () => {
  const db = fixture(); const original = clone(db.items); const m = memBackup();
  await apply.run(fakeClient(db), { write: true, host: HOST, runAt: new Date('2026-10-13T08:00:00Z'), log: quiet, backupWriter: m.backupWriter });
  const backup = m.store.files[0];
  const changed = clone(db.items);

  const dry = await rb.rollback(fakeClient(db), backup, { write: false, host: HOST, log: quiet });
  assert.deepEqual(dry.tally, { WOULD_RESTORE: 8 }); assert.deepEqual(db.items, changed, 'rollback dry-run changes nothing');

  // a conflicting edit after the clean-up
  db.items.find((i) => i.id === 'i2').sizeText = '37';
  await assert.rejects(rb.rollback(fakeClient(db), backup, { write: true, host: HOST, log: quiet }), /Conflict on item i2/);
  assert.equal(db.items.find((i) => i.id === 'i1').sizeText, '32', 'conflict abort restored nothing');
  const part = await rb.rollback(fakeClient(db), backup, { write: true, skipConflicts: true, host: HOST, log: quiet });
  assert.equal(part.restored, 7);
  db.items.find((i) => i.id === 'i2').sizeText = '  36'; // owner puts it back by hand
  const again = await rb.rollback(fakeClient(db), backup, { write: true, host: HOST, log: quiet });
  assert.equal(again.restored, 0);
  const strip = (arr) => arr.map(({ updatedAt, ...r }) => r);
  assert.deepEqual(strip(db.items), strip(original), 'every field except updatedAt is back to the original');
});

test('rollback refuses a backup from another host', async () => {
  const db = fixture(); const m = memBackup();
  await apply.run(fakeClient(db), { write: true, host: HOST, log: quiet, backupWriter: m.backupWriter });
  await assert.rejects(rb.rollback(fakeClient(db), m.store.files[0], { host: 'ep-other.example.com', log: quiet }), /Backup was taken on/);
});

test('host policy: Neve prod only for writes; main gemach and unknown hosts refused; TEST dry-run only', () => {
  assert.deepEqual(apply.checkHost('ep-young-math-b1veujp3.c-5.eu-central-1.aws.neon.tech', 'ep-young-math'), { allowWrite: true, label: 'neve-prod' });
  assert.equal(apply.checkHost('ep-fancy-pine-aw5fbjvp-pooler.c-12.us-east-1.aws.neon.tech', 'ep-fancy-pine').allowWrite, false);
  assert.throws(() => apply.checkHost('ep-weathered-tree-avpypjjr-pooler.c-11.us-east-1.aws.neon.tech', 'ep-weathered-tree'), /main gemach/);
  assert.throws(() => apply.checkHost('ep-weathered-tree-avpypjjr-pooler.c-11.us-east-1.aws.neon.tech', 'ep-'), /main gemach/);
  assert.throws(() => apply.checkHost('ep-something-else.neon.tech', 'ep-something'), /Unknown host/);
  assert.throws(() => apply.checkHost('ep-young-math-x.neon.tech', null), /--expect-host/);
  assert.throws(() => apply.checkHost('ep-young-math-x.neon.tech', 'ep-other'), /Host mismatch/);
});

test('CLI refuses before any connection: main gemach, missing flags', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sizecleanup-'));
  const envMain = path.join(dir, 'main.env'); fs.writeFileSync(envMain, 'DATABASE_URL="postgresql://u:p@ep-weathered-tree-x.c-11.us-east-1.aws.neon.tech/db"\n');
  const envNeve = path.join(dir, 'neve.env'); fs.writeFileSync(envNeve, 'DATABASE_URL="postgresql://u:p@ep-young-math-x.c-5.eu-central-1.aws.neon.tech/db"\n');
  const run = (args) => spawnSync(process.execPath, [path.join(here, 'size_cleanup_apply.js'), ...args], { encoding: 'utf8' });
  let r = run(['--env', envMain, '--expect-host=ep-weathered-tree']); assert.notEqual(r.status, 0); assert.match(r.stderr, /main gemach/);
  r = run(['--env', envMain, '--expect-host=ep-weathered-tree', '--write', '--i-know-this-is-prod', '--backup-dir=' + dir]); assert.match(r.stderr, /main gemach/);
  r = run(['--env', envNeve]); assert.match(r.stderr, /--expect-host/);
  r = run(['--env', envNeve, '--expect-host=ep-young-math', '--write']); assert.match(r.stderr, /i-know-this-is-prod/);
  r = run(['--env', envNeve, '--expect-host=ep-young-math', '--write', '--i-know-this-is-prod']); assert.match(r.stderr, /backup-dir/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('real backup file writer: creates the directory, fsyncs readable JSON, never overwrites', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sizecleanup-')), 'nested', 'backups');
  const write = apply.writeBackupFile(dir, HOST, '2026-10-13T08:00:00.000Z');
  const file = write({ format: 'size-cleanup-backup/1', rows: [1, 2] });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).rows, [1, 2]);
  assert.match(path.basename(file), /^size_cleanup_ep-young-math-test_2026-10-13T08-00-00-000Z.json$/);
  assert.throws(() => write({ again: true }), /EEXIST/);
  fs.rmSync(path.dirname(path.dirname(dir)), { recursive: true, force: true });
});
