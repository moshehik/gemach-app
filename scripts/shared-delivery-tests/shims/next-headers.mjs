// cookies(): auth_token comes from globalThis.__AUTH_TOKEN (set per test). No AUTH_SECRET in the test
// process, so lib/authTokens.js accepts the raw cookie (its documented legacy fallback).
export async function cookies() {
  return {
    get: (name) => (name === 'auth_token' && globalThis.__AUTH_TOKEN ? { value: globalThis.__AUTH_TOKEN } : undefined),
    set() {},
    delete() {},
  };
}
