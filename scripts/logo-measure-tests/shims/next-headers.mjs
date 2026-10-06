// stand-in for next/headers: cookies() reads globalThis.__COOKIES = { auth_token: 'emp-id' }
export async function cookies() {
  const jar = globalThis.__COOKIES || {};
  return { get: (name) => (jar[name] !== undefined ? { name, value: jar[name] } : undefined) };
}
export async function headers() { return new Headers(); }
