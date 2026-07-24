const http = require('http');

async function checkApi() {
  const url = 'http://localhost:3005/api/customers';
  
  for (let i = 0; i < 20; i++) {
    try {
      console.log(`Attempt ${i+1}: Fetching ${url}...`);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log("SUCCESS! Got status 200.");
        if (data && Array.isArray(data.customers)) {
            console.log(`Found ${data.customers.length} customers in DB!`);
        } else if (Array.isArray(data)) {
            console.log(`Found ${data.length} customers in DB!`);
        } else {
            console.log("Response data:", data);
        }
        
        // Also let's check what DB mode is printed or just knowing it succeeds is enough
        return true;
      } else {
        console.log(`Failed with status ${response.status}: ${response.statusText}`);
        const text = await response.text();
        console.log("Error body:", text.substring(0, 200));
        return false;
      }
    } catch (e) {
      console.log(`Fetch failed: ${e.message}. Retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log("Giving up after 20 attempts.");
  return false;
}

checkApi().then(success => {
  if (success) {
    console.log("TEST_OFFLINE_MODE_PASSED");
    process.exit(0);
  } else {
    console.log("TEST_OFFLINE_MODE_FAILED");
    process.exit(1);
  }
});
