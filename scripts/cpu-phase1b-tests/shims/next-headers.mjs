// next/headers stand-in: cookies() resolves to a store whose get(name) reads globalThis.__COOKIES (name -> value).
export async function cookies() {
  const jar = globalThis.__COOKIES || {};
  return { get: (n) => (n in jar ? { name: n, value: jar[n] } : undefined) };
}
export async function headers() { return new Map(Object.entries(globalThis.__HEADERS || {})); }
