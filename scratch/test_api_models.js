const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/dresses/483', // wait, is this route valid? Let's check /api/inventory/models?q=ורוד גוונים
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      console.log('Result:', data.slice(0, 500));
    } catch (e) {
      console.log('Failed:', e);
    }
  });
});
req.end();
