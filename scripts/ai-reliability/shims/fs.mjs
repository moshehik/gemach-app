import realFs from 'node:fs';
const fs = { ...realFs, appendFileSync: (p, d) => { (globalThis.__AILOG ||= []).push(String(d)); } };
export default fs;
export const readFileSync = realFs.readFileSync;
export const appendFileSync = fs.appendFileSync;
