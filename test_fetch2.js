fetch('http://localhost:3000/api/dresses').then(r => r.json()).then(d => console.log(JSON.stringify(d[0].items, null, 2))).catch(console.error);
