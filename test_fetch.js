fetch('http://localhost:3000/api/dresses').then(r => r.json()).then(d => console.log('Length:', d.length)).catch(console.error);
