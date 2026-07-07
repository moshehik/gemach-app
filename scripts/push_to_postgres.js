const { execSync } = require('child_process');

function run(command) {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}

try {
  run('node scripts/migrate.js');
  run('node scripts/import_all_data.js');
  run('node scripts/migrate_payments.js');
  run('node scripts/migrate_prices.js');
  run('node scripts/seed_settings.js');
  console.log('All data successfully migrated to Postgres!');
} catch (error) {
  console.error('Migration failed', error);
}
