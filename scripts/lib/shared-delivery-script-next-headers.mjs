// next/headers stand-in for scripts (no request): empty cookies.
export async function cookies() { return { get: () => undefined, set() {}, delete() {} }; }
export async function headers() { return new Map(); }
