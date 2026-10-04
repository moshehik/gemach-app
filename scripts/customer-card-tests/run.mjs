// מריץ את כל בדיקות כרטיס הלקוח החדש: node scripts/customer-card-tests/run.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
let bad = 0;
for (const f of ['logic.test.mjs', 'parity.test.mjs', 'static.test.mjs']) {
  const r = spawnSync(process.execPath, ['--no-warnings', path.join(HERE, f)], { stdio: 'inherit' });
  if (r.status) bad++;
}
process.exit(bad ? 1 : 0);
