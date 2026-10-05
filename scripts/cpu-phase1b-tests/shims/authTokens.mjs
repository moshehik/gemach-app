// lib/authTokens.js stand-in: the verified cookie is whatever the test put in globalThis.__COOKIES.auth_token.
export function getVerifiedAuthCookie(store) { return store.get('auth_token') || null; }
export function issueSessionCookie() {}
