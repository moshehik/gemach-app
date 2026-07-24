const { PrismaClient: PostgresClient } = require('@prisma/client');
const { PrismaClient: SQLiteClient } = require('@prisma/local-client');
const { spawn } = require('child_process');

const cloudClient = new PostgresClient();
const localClient = new SQLiteClient();
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('--- Starting Sync Test ---');
  
  // Initialize sync_state.json to prevent full pull of 20k+ records
  const syncState = {
    customer: new Date(Date.now() - 60000).toISOString()
  };
  fs.writeFileSync(path.join(__dirname, 'sync_state.json'), JSON.stringify(syncState));
  
  const testId = `test-sync-${Date.now()}`;
  const testPhone = `050${Math.floor(1000000 + Math.random() * 9000000)}`;
  
  try {
    // 1. Insert mock customer locally
    console.log(`Inserting mock customer into local DB...`);
    const newCustomer = await localClient.customer.create({
      data: {
        id: testId,
        firstName: 'Test',
        lastName: 'Offline Sync',
        phone1: testPhone,
        street: 'Test St',
        houseNum: 123,
        city: 'Testville',
        updatedAt: new Date()
      }
    });
    console.log('Customer created locally:', newCustomer.id);

    // 2. Run offline-sync.js to sync the data
    console.log('Running offline-sync.js as background process...');
    const syncProcess = spawn('node', ['offline-sync.js']);
    
    syncProcess.stdout.on('data', (data) => {
      process.stdout.write(`[SYNC STDOUT]: ${data}`);
    });
    
    syncProcess.stderr.on('data', (data) => {
      process.stderr.write(`[SYNC STDERR]: ${data}`);
    });

    // Wait 15 seconds to let the first sync cycle finish
    console.log('Waiting 15 seconds for sync to complete...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log('Killing offline-sync.js process...');
    syncProcess.kill();

    // 3. Check if mock customer exists in Cloud DB
    console.log(`Checking cloud DB for customer ${testId}...`);
    const cloudCustomer = await cloudClient.customer.findUnique({
      where: { id: testId }
    });

    if (cloudCustomer) {
      console.log('\n✅ TEST PASSED: Mock customer found in Cloud DB!');
      console.log('Details:', cloudCustomer);
    } else {
      console.log('\n❌ TEST FAILED: Mock customer NOT found in Cloud DB.');
    }
  } catch (err) {
    console.error('Test encountered an error:', err);
  } finally {
    await cloudClient.$disconnect();
    await localClient.$disconnect();
  }
}

runTest();
