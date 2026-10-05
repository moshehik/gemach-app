// Stand-in for app/lib/prisma.js. Every property access is forwarded to globalThis.__PRISMA (installed per test), so the real route code
// runs against a tiny in-memory model. Unknown models throw loudly instead of silently returning undefined.
const prisma = new Proxy({}, {
  get(_t, model) {
    if (model === 'then') return undefined;
    const p = globalThis.__PRISMA;
    if (!p || !(model in p)) throw new Error(`prisma shim: model "${String(model)}" not mocked in this test`);
    return p[model];
  },
});
export default prisma;
export function auditAs(action, args) { return args; }
