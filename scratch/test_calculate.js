const http = require('http');

const data = JSON.stringify({
  items: [
    { dressModelId: 483, sizeText: "04", quantity: 1 }
  ],
  eventDate: "2026-09-06T00:00:00.000Z",
  isWeekdayEvent: true,
  isAbroad: false
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/orders/calculate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const startTime = Date.now();
const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Time taken: ${Date.now() - startTime}ms`);
    console.log('Response:', body);
  });
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
