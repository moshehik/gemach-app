import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({
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

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
