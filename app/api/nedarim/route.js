import { NextResponse } from 'next/server';
import { chargeNedarimPlus } from '../../lib/nedarim';
import prisma from '../../lib/prisma'; // Optional: if you need to fetch mosadId from settings
import { checkAuth } from '../../../lib/auth';


export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const data = await request.json();
    
    // Attempt to fetch mosadId from settings or env
    // For now, we will use a fallback or require it from frontend/env
    let mosadId = process.env.NEDARIM_MOSAD_ID;

    if (!mosadId) {
      // Check database settings
      const setting = await prisma.setting.findUnique({
        where: { key: 'nedarimMosadId' }
      });
      if (setting && setting.value) {
        mosadId = setting.value;
      } else {
        // Just a fallback to ensure we don't crash, user will need to configure it
        mosadId = data.mosadId || ''; 
      }
    }

    if (!mosadId) {
       return NextResponse.json({ success: false, error: 'מספר מוסד (MosadId) לא מוגדר במערכת. אנא עדכן את ההגדרות.' }, { status: 400 });
    }

    const {
      clientName,
      address,
      phone,
      cardNumber,
      tokef,
      amount,
      installments,
      notes
    } = data;

    const result = await chargeNedarimPlus({
      mosadId,
      clientName,
      address,
      phone,
      cardNumber,
      tokef,
      amount,
      installments,
      notes,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Nedarim API Error:', error);
    return NextResponse.json({ success: false, error: 'שגיאה כללית בחיוב האשראי' }, { status: 500 });
  }
}
