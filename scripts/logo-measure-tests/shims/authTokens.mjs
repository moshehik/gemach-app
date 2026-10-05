// stand-in for lib/authTokens.js: the "verified" cookie is simply the auth_token one from the fake jar
export function getVerifiedAuthCookie(store) { return store.get('auth_token') || null; }
