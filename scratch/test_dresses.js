const http = require('http');

http.get('http://localhost:3000/api/dresses?eventDate=2026-09-06T00:00:00.000Z', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const dresses = JSON.parse(data);
    const dress = dresses.find(d => d.id === 483);
    console.log(JSON.stringify(dress, null, 2));
  });
});
