// One-time migration: hashes every Employee's plaintext password in place (bcrypt), and
// derives+stores a separate hash of the last 4 characters (pinHash) so the trusted-device
// fast login path (see lib/trustedDevice.js) works immediately for every employee without
// anyone needing to log in and set anything.
//
// Safe to re-run: any password that already looks like a bcrypt hash ($2a$/$2b$/$2y$...)
// is left untouched, so running this twice (or against a DB that's already migrated) is a
// no-op for those rows.
//
// IMPORTANT: this bypasses the app's Prisma client (app/lib/prisma.js) on purpose - that
// wrapper needs a request-scoped `cookies()` call it can't get from a plain node script, and
// its audit-log extension would otherwise write one noisy AuditLog row per employee for a
// bulk system migration, which CLAUDE.md's own guidance says to avoid (raw script instead
// of the audited Prisma client for bulk fixes).
//
// Usage (this project's convention is to pass DATABASE_URL explicitly, never rely on a
// default, to avoid accidentally running against the wrong database):
//   DATABASE_URL="<target db url>" node scripts/migrate_hash_passwords.js [--dry-run]

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const DRY_RUN = process.argv.includes('--dry-run');
const SALT_ROUNDS = 10;
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

function last4Of(plain) {
  const s = String(plain);
  return s.length <= 4 ? s : s.slice(-4);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Refusing to run without an explicit DATABASE_URL env var (avoids accidentally hitting the wrong database).');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const employees = await prisma.employee.findMany({
      select: { id: true, legacyId: true, password: true, pinHash: true }
    });

    let migrated = 0;
    let alreadyHashed = 0;
    let empty = 0;
    let errors = 0;

    console.log(`Found ${employees.length} employee row(s). Dry run: ${DRY_RUN}`);

    for (const emp of employees) {
      if (!emp.password) {
        empty++;
        continue;
      }
      if (BCRYPT_HASH_RE.test(emp.password) && emp.pinHash) {
        alreadyHashed++;
        continue;
      }

      try {
        // If password is already hashed but pinHash is missing for some reason, we can't
        // derive the PIN from a hash (one-way) - that row is flagged, not silently skipped.
        if (BCRYPT_HASH_RE.test(emp.password) && !emp.pinHash) {
          console.warn(`Employee ${emp.legacyId || emp.id}: password already hashed but pinHash missing - cannot derive PIN from a hash, skipping (trusted-device login won't work for this employee until they change their password).`);
          continue;
        }

        const plain = emp.password;
        const hashedPassword = bcrypt.hashSync(plain, SALT_ROUNDS);
        const pinHash = bcrypt.hashSync(last4Of(plain), SALT_ROUNDS);

        if (!DRY_RUN) {
          await prisma.employee.update({
            where: { id: emp.id },
            data: { password: hashedPassword, pinHash }
          });
        }
        migrated++;
      } catch (e) {
        errors++;
        console.error(`Failed to migrate employee ${emp.legacyId || emp.id}:`, e.message);
      }
    }

    console.log('--- Migration summary ---');
    console.log(`Migrated:       ${migrated}`);
    console.log(`Already hashed: ${alreadyHashed}`);
    console.log(`Empty password: ${empty}`);
    console.log(`Errors:         ${errors}`);
    if (DRY_RUN) console.log('(dry run - no rows were actually written)');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
