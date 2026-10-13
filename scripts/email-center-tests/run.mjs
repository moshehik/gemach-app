// מריץ את כל בדיקות מרכז המיילים (בלי DB, בלי רשת): node scripts/email-center-tests/run.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const dir = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const f of ['templates-parity.test.mjs', 'registry.test.mjs', 'campaign.test.mjs', 'hostinger-mail.test.mjs', 'mailbox.test.mjs', 'confirmation-wiring.test.mjs', 'ui-smoke.test.mjs', '../test_email_log_secrets.mjs']) {
  console.log(`\n=== ${f}`);
  const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} קבצי בדיקה נכשלו` : '\nהכול עבר');
process.exit(failed ? 1 : 0);
