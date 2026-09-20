export async function cookies() {
  return {
    get: (n) => (n === 'auth_token' && globalThis.__AUTH_TOKEN ? { value: globalThis.__AUTH_TOKEN } : undefined),
    set() {}, delete() {},
  };
}
