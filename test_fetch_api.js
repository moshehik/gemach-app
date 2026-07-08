fetch('http://localhost:3000/api/admin/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT tablename as name FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema' AND tablename != '_prisma_migrations' ORDER BY name" })
}).then(r => {
  return r.json();
}).then(d => {
  console.log("Type of d:", typeof d);
  console.log("Is array:", Array.isArray(d));
  if (typeof d === 'string') {
    const parsed = JSON.parse(d);
    console.log("Parsed is array:", Array.isArray(parsed));
  }
})
.catch(e => console.error(e));
