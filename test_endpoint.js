const http = require('http');

http.get('http://localhost:3000/api/orders?page=1&limit=50', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const ordersWithItems = json.data.filter(o => o.items && o.items.length > 0);
      console.log('Total orders returned:', json.data.length);
      console.log('Orders with items:', ordersWithItems.length);
      if (ordersWithItems.length > 0) {
        console.log('Sample item:', ordersWithItems[0].items[0]);
      }
    } catch(err) {
      console.error(err);
    }
  });
}).on('error', (err) => {
  console.log('Error: ', err.message);
});
