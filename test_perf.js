const http = require('http');

const endpoints = [
  { path: '/api/orders?page=1&limit=50', name: 'Orders - Default' },
  { path: '/api/orders?filterStatus=unpaid&page=1&limit=50', name: 'Orders - Unpaid Filter' },
  { path: '/api/dresses?page=1&limit=50', name: 'Dresses - Default' },
  { path: '/api/dresses?eventDate=2026-08-01&page=1&limit=50', name: 'Dresses - With Event Date' },
  { path: '/api/dashboard/debts', name: 'Dashboard - Debts' }
];

async function measure(endpoint) {
  const start = Date.now();
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${endpoint.path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const time = Date.now() - start;
        console.log(`${endpoint.name}: ${time}ms (Status: ${res.statusCode}, Size: ${data.length})`);
        resolve(time);
      });
    }).on('error', (err) => {
      console.error(`${endpoint.name} Error:`, err.message);
      resolve(null);
    });
  });
}

async function run() {
  console.log('--- Performance Tests ---');
  for (const ep of endpoints) await measure(ep);
}
run();
