export const NextResponse = {
  json(body, init) {
    return { status: (init && init.status) || 200, headers: (init && init.headers) || {}, __json: body, json: async () => body };
  },
};
// after() של Next: מחוץ להקשר בקשה הוא זורק - כך גם כאן (ברירת מחדל), והקוד נופל לריצה מקומית. בדיקה שרוצה לראות את מסלול after מגדירה globalThis.__MOCK_AFTER = (fn) => { ... }.
export const after = (fn) => {
  if (typeof globalThis.__MOCK_AFTER === 'function') return globalThis.__MOCK_AFTER(fn);
  throw new Error('`after` was called outside a request scope');
};
