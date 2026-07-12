import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'ui_labels_mapping' }
    });

    if (!setting || !setting.value) {
      return NextResponse.json({});
    }

    return NextResponse.json(JSON.parse(setting.value));
  } catch (error) {
    console.error('Error fetching UI labels:', error);
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const labels = await req.json();

    const value = JSON.stringify(labels);

    await prisma.systemSetting.upsert({
      where: { key: 'ui_labels_mapping' },
      update: { value, name: 'כיתובי מערכת (UI)', category: 'ui_label' },
      create: { 
        key: 'ui_labels_mapping', 
        value, 
        name: 'כיתובי מערכת (UI)', 
        category: 'ui_label',
        type: 'json'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving UI labels:', error);
    return NextResponse.json({ error: 'Failed to save UI labels' }, { status: 500 });
  }
}
