import prisma from './stub-prisma.mjs';
export async function getCachedSetting(key) { return prisma.systemSetting.findUnique({ where: { key } }).catch(() => null); }
export async function getAllCachedSettings() { return prisma.systemSetting.findMany({ where: { NOT: { key: 'BRAND_LOGO' } } }); }
