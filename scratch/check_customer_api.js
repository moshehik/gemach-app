const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/dresses?eventDate=2026-09-06T00:00:00.000Z',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const model483 = parsed.find(m => m.id === 483);
        if (model483) {
          console.log(`Found model 483: ${model483.name}`);
          console.log(`Sizes returned: ${model483.sizes ? model483.sizes.length : 0}`);
          if (model483.sizes) {
            console.log('Size 04 details:', model483.sizes.find(s => s.sizeText === '04' || s.sizeText === '4'));
          }
        } else {
          console.log('Model 483 not found in results.');
        }
      } else {
        console.log('Returned object:', parsed.error || String(data).slice(0, 100));
      }
    } catch (e) {
      console.log('Failed to parse:', data.slice(0, 100));
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
