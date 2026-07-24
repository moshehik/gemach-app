const { PrismaClient: PostgresClient } = require('@prisma/client');
const { PrismaClient: SQLiteClient } = require('@prisma/local-client');
const fs = require('fs');
const path = require('path');

const cloudClient = new PostgresClient();
const localClient = new SQLiteClient();

const SYNC_STATE_FILE = path.join(__dirname, 'sync_state.json');

// List of all models to sync, ordered by dependency to avoid foreign key constraints errors during insert
const models = [
  'systemSetting', 'priceList', 'dressModel', 'employee', 'customer', 
  'dressItem', 'order', 'orderItem', 'payment', 'paymentObligation', 
  'shift', 'pageVisitLog', 'auditLog', 'emailLog', 'queryLog', 
  'notificationTag', 'notification'
];

function getSyncState() {
  if (fs.existsSync(SYNC_STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveSyncState(state) {
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}

async function syncModel(modelName, lastSyncDate) {
  console.log(`\n--- Syncing ${modelName} ---`);
  
  // Helper to chunk arrays for processing
  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

  try {
    // 1. PULL from Cloud -> Local
    const cloudUpdates = await cloudClient[modelName].findMany({
      where: lastSyncDate ? { updatedAt: { gt: lastSyncDate } } : undefined,
      orderBy: { updatedAt: 'asc' }
    });
    
    if (cloudUpdates.length > 0) {
      console.log(`Found ${cloudUpdates.length} updates in Cloud for ${modelName}. Pulling to local...`);
      let pullErrors = 0;
      const chunks = chunk(cloudUpdates, 500);
      for (const c of chunks) {
        try {
          const ops = c.map(record => localClient[modelName].upsert({
            where: { id: record.id },
            update: record,
            create: record
          }));
          await localClient.$transaction(ops);
        } catch (txError) {
          // Fallback to row by row if chunk fails
          for (const record of c) {
            try {
              await localClient[modelName].upsert({
                where: { id: record.id },
                update: record,
                create: record
              });
            } catch (e) {
              pullErrors++;
              if (pullErrors <= 3) {
                console.warn(`Pull Error for ${modelName} ID ${record.id}: ${e.message.split('\\n')[0]}`);
              }
            }
          }
        }
      }
      console.log(`Pulled ${cloudUpdates.length - pullErrors} ${modelName} to local. (${pullErrors} errors)`);
    }

    // 2. PUSH from Local -> Cloud
    if (!lastSyncDate) {
      console.log(`Initial sync: Skipping PUSH for ${modelName} to avoid circular updates.`);
    } else {
      const localUpdates = await localClient[modelName].findMany({
      where: lastSyncDate ? { updatedAt: { gt: lastSyncDate } } : undefined,
      orderBy: { updatedAt: 'asc' }
    });
    
    if (localUpdates.length > 0) {
      console.log(`Found ${localUpdates.length} updates in Local for ${modelName}. Pushing to cloud...`);
      let pushErrors = 0;
      const localChunks = chunk(localUpdates, 500);
      for (const c of localChunks) {
        // PUSH conflicts should be checked row by row
        for (const record of c) {
          try {
            const cloudRecord = await cloudClient[modelName].findUnique({ where: { id: record.id } });
            if (cloudRecord && new Date(cloudRecord.updatedAt) > new Date(record.updatedAt)) {
               continue;
            }
            await cloudClient[modelName].upsert({
              where: { id: record.id },
              update: record,
              create: record
            });
          } catch (e) {
            pushErrors++;
            if (pushErrors <= 3) {
              console.warn(`Push Error for ${modelName} ID ${record.id}: ${e.message.split('\\n')[0]}`);
            }
          }
        }
      }
      console.log(`Pushed ${localUpdates.length - pushErrors} ${modelName} to cloud. (${pushErrors} errors)`);
    }
    }
    
  } catch (error) {
    console.error(`Error syncing model ${modelName}:`, error);
  }
}

async function runSync() {
  const syncState = getSyncState();
  const syncStartTime = new Date();

  console.log(`Starting sync cycle at ${syncStartTime.toISOString()}`);
  
  for (const model of models) {
    const lastSyncStr = syncState[model];
    const lastSyncDate = lastSyncStr ? new Date(lastSyncStr) : null;
    await syncModel(model, lastSyncDate);
    // Update the sync state for this model to the time we started the sync cycle
    syncState[model] = syncStartTime.toISOString();
    saveSyncState(syncState);
  }
  
  console.log(`Sync cycle completed.`);
}

async function startEngine() {
  console.log("=========================================");
  console.log("   OFFLINE SYNC ENGINE STARTED");
  console.log("=========================================");
  
  // Run once immediately
  await runSync();
  
  // Then run every 30 seconds
  setInterval(async () => {
    try {
      await runSync();
    } catch (e) {
      console.error("Sync interval error:", e);
    }
  }, 30000);
}

startEngine().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log("Shutting down sync engine...");
  await cloudClient.$disconnect();
  await localClient.$disconnect();
  process.exit(0);
});
