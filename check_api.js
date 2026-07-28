fetch('http://localhost:3000/api/settings')
  .then(r => r.json())
  .then(data => console.log(data.find(x => x.key === 'hide_ai_features')))
  .catch(console.error);
