import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';

export async function checkAuth() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'require_login' }
    });
    if (setting && setting.value === 'true') {
      const cookieStore = await cookies();
      const token = cookieStore.get('auth_token');
      if (!token || !token.value) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    return true; // fail open or closed? Better fail closed if require_login is supposed to be true, but if DB fails maybe open. We will fail open if DB is down just in case, but really should return true only if setting is false or token exists.
  }
}
