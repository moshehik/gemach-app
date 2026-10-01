// Stand-in for lib/auth.js in route-level tests: every request is "logged in".
export async function checkAuth() { return true; }
export async function getSessionEmployee() { return null; }
