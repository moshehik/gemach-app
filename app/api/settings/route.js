import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth, invalidateRequireLoginCache } from '@/lib/auth';
import { validateNumericSetting } from '../../lib/settingsValidation';

export const dynamic = 'force-dynamic';

// GET is intentionally left public: settings (e.g. UI/branding config) are
// read by pages that render before/without login, such as the public
// customer-interface kiosk page and the labels fetched on initial layout
// mount. Writing settings is admin-only (see POST below).
export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          not: 'BRAND_LOGO'
        }
      },
      orderBy: [
        { category: 'asc' },
        { id: 'asc' }
      ]
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }
  try {
    const data = await request.json();
    
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format, expected array' }, { status: 400 });
    }

    for (const item of data) {
      if (!item.key) continue;
      const validationError = validateNumericSetting(item.key, item.value);
      if (validationError) {
        return NextResponse.json({ error: `${item.key}: ${validationError}` }, { status: 400 });
      }
    }

    const updatePromises = data.map(item => {
      if (item.key && item.value !== undefined) {
        return prisma.systemSetting.upsert({
          where: { key: item.key },
          update: { 
            value: String(item.value),
            name: item.name || item.key,
          },
          create: {
            key: item.key,
            value: String(item.value),
            name: item.name || item.key,
          }
        });
      }
      return Promise.resolve();
    });

    // Keep inventory_buffer_days and BUFFER_DAYS always in sync
    const bufferItem = data.find(i => i.key === 'BUFFER_DAYS' || i.key === 'inventory_buffer_days');
    if (bufferItem && bufferItem.value !== undefined) {
      updatePromises.push(
        prisma.systemSetting.upsert({
          where: { key: 'inventory_buffer_days' },
          update: { value: String(bufferItem.value) },
          create: { key: 'inventory_buffer_days', value: String(bufferItem.value), name: 'ימי מרווח ביטחון בין השכרות', category: 'יומן', type: 'number' }
        }),
        prisma.systemSetting.upsert({
          where: { key: 'BUFFER_DAYS' },
          update: { value: String(bufferItem.value) },
          create: { key: 'BUFFER_DAYS', value: String(bufferItem.value), name: 'BUFFER_DAYS', category: 'הזמנות', type: 'number' }
        })
      );
    }

    // Keep nedarim_plus_terminal and NEDARIM_MOSAD always in sync
    const nedarimMosadItem = data.find(i => i.key === 'NEDARIM_MOSAD' || i.key === 'nedarim_plus_terminal');
    if (nedarimMosadItem && nedarimMosadItem.value !== undefined) {
      updatePromises.push(
        prisma.systemSetting.upsert({
          where: { key: 'nedarim_plus_terminal' },
          update: { value: String(nedarimMosadItem.value) },
          create: { key: 'nedarim_plus_terminal', value: String(nedarimMosadItem.value), name: 'קוד מוסד נדרים פלוס', category: 'תשלומים', type: 'text' }
        }),
        prisma.systemSetting.upsert({
          where: { key: 'NEDARIM_MOSAD' },
          update: { value: String(nedarimMosadItem.value) },
          create: { key: 'NEDARIM_MOSAD', value: String(nedarimMosadItem.value), name: 'קוד מוסד נדרים פלוס', category: 'תשלומים', type: 'text' }
        })
      );
    }

    await Promise.all(updatePromises);

    // lib/auth.js caches the require_login setting in-memory (30s TTL) so
    // checkAuth() doesn't hit the DB on every request — drop that cache now
    // so a toggle takes effect immediately on this server instance (other
    // warm serverless instances converge within the TTL).
    invalidateRequireLoginCache();

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
