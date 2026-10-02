// עוטף את quick-popup.render.mjs (דורש טעינת JSX דרך register-render.mjs, שאינה זמינה ל-run.mjs) כבדיקת node:test.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = process.env.PROJ || path.resolve(here, '..', '..');

test('quick popup / full wizard render checks', () => {
  const r = spawnSync(process.execPath, ['--no-warnings', '--import', pathToFileURL(path.join(here, 'register-render.mjs')).href, path.join(here, 'quick-popup.render.mjs')], {
    cwd: proj, encoding: 'utf8', env: { ...process.env, PROJ: proj },
  });
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  assert.match(r.stdout, /quick-popup: 6 passed/);
});
