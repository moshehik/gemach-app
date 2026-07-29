import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';

export const dynamic = 'force-dynamic';

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
  try {
    const data = await request.json();
    
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format, expected array' }, { status: 400 });
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

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
