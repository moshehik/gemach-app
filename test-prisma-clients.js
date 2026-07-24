const { PrismaClient: RemoteClient } = require('@prisma/client');
const { PrismaClient: LocalClient } = require('@prisma/local-client');

async function main() {
  const remoteClient = new RemoteClient();
  const localClient = new LocalClient();

  try {
    console.log('Connecting to remote Postgres...');
    const randomCustomer = await remoteClient.customer.findFirst();
    if (!randomCustomer) {
      console.log('No customer found in remote Postgres DB.');
      return;
    }
    
    console.log('Random customer found from remote Postgres:', randomCustomer.id, randomCustomer.firstName, randomCustomer.lastName);
    
    console.log('Writing to local SQLite...');
    // Check if it already exists to avoid unique constraint errors
    const existing = await localClient.customer.findUnique({
      where: { id: randomCustomer.id }
    });
    
    if (existing) {
       console.log('Customer already exists in local DB. Deleting for a clean test...');
       await localClient.customer.delete({ where: { id: randomCustomer.id } });
    }
    
    await localClient.customer.create({
      data: randomCustomer
    });
    console.log('Successfully written to local SQLite.');
    
    console.log('Reading from local SQLite to verify...');
    const verifiedCustomer = await localClient.customer.findUnique({
      where: { id: randomCustomer.id }
    });
    
    if (verifiedCustomer) {
      console.log('Success! Customer verified in local SQLite DB. Matching IDs:', verifiedCustomer.id === randomCustomer.id);
    } else {
      console.log('Failure! Could not find customer in local SQLite DB after writing.');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await remoteClient.$disconnect();
    await localClient.$disconnect();
  }
}

main();
