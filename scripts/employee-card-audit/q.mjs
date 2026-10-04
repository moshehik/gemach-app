import { serve, launch, sleep, PORT } from './lib.mjs';
const s = await serve(); const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' }); await sleep(1500);
console.log(JSON.stringify(await p.evaluate(process.argv[2] ? new Function('return ' + process.argv[2])() : () => 0), null, 1));
await b.close(); s.close(); process.exit(0);
