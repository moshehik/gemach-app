const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/orders/availability?dressModelId=483&eventDate=2026-09-06&bufferDays=3&isWeekdayEvent=true&isAbroad=false',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        console.log(`Returned ${parsed.length} sizes`);
        parsed.slice(0, 3).forEach(s => console.log(`${s.sizeText}: ${s.availableQuantity}/${s.totalInStock}`));
        const size04 = parsed.find(s => s.sizeText === '04' || s.sizeText === '0');
        console.log('Size 04 or 0 details:', size04);
      } else {
        console.log('Returned object:', parsed);
      }
    } catch (e) {
      console.log('Failed to parse:', data);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
