// scripts/set_approval_flags.js - flips the two server-approval hardening flags (docs/server-approval-hardening.md) in ONE gemach's database.
//   node scripts/set_approval_flags.js                           # dry run: prints the DB host and the current values, writes NOTHING
//   node scripts/set_approval_flags.js tokens=true perms=false --expect-host=<part of the DB host> --apply
// Safety (a settings script once wrote one gemach's rules into the other's PROD): it always prints the target host first, and --apply is
// refused unless --expect-host matches that host. Reads DATABASE_URL from the environment (e.g. `node --env-file=.env.local ...`).
// Rollback = run it again with the value false. The category/name/notes columns are only set when the row does not exist yet.
const { PrismaClient } = require('@prisma/client');

const KEYS = { tokens: 'approval_tokens_required', perms: 'approval_permissions_enforced' };
const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];

async function main() {
  const url = process.env.DATABASE_URL || '';
  const host = (() => { try { return new URL(url).host; } catch { return ''; } })();
  console.log('Target database host:', host || '(DATABASE_URL missing or unparsable)');
  if (!host) process.exit(1);
  const prisma = new PrismaClient();
  try {
    const wanted = {};
    for (const [short, key] of Object.entries(KEYS)) {
      const a = args.find((x) => x.startsWith(`${short}=`));
      if (a) {
        const v = a.split('=')[1];
        if (v !== 'true' && v !== 'false') throw new Error(`${short} must be true or false`);
        wanted[key] = v;
      }
    }
    for (const key of Object.values(KEYS)) {
      const row = await prisma.systemSetting.findUnique({ where: { key } });
      console.log(`${key}: ${row ? row.value : '(no row = OFF)'}${wanted[key] ? `   -> ${wanted[key]}` : ''}`);
    }
    if (!args.includes('--apply')) { console.log('Dry run - nothing written. Add --apply (and --expect-host=...) to write.'); return; }
    const expect = flag('expect-host');
    if (!expect || !host.includes(expect)) throw new Error('--apply needs --expect-host=<part of the host shown above>; it did not match');
    for (const [key, value] of Object.entries(wanted)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value, name: key, category: 'כללי', type: 'boolean', notes: 'docs/server-approval-hardening.md' },
      });
      console.log(`wrote ${key}=${value}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
