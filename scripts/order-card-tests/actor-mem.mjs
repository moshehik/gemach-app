// מסד בזיכרון לבדיקות item-actors: ה-shim של הלו״ז + createMany (שאינו ב-shim). כתיבה מותרת ל-orderItem / auditLog / dressItem (globalThis.__MOCK_WRITABLE).
import shim from '../schedule-tests/shims/prisma.mjs';

export default new Proxy({}, {
  get(_, name) {
    if (typeof name !== 'string') return undefined;
    const m = shim[name];
    return new Proxy({}, {
      get(__, op) {
        if (op === 'createMany') return async ({ data }) => { for (const d of data) await m.create({ data: d }); return { count: data.length }; };
        return m[op];
      },
    });
  },
});
