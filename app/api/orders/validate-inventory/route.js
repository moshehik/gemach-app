import { NextResponse } from 'next/server';
import { getAvailableInventory } from '../../../../lib/inventory';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const data = await request.json();
    const { items, eventDate, isAbroad, fromDate, toDate, orderId } = data;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ valid: true, errors: [] });
    }

    // Determine target dates
    let targetMinDate, targetMaxDate;
    if (isAbroad) {
      if (!fromDate || !toDate) {
         return NextResponse.json({ error: 'חסרים תאריכים עבור אירוע חו"ל' }, { status: 400 });
      }
      targetMinDate = fromDate;
      targetMaxDate = toDate;
    } else {
      if (!eventDate) {
         return NextResponse.json({ error: 'חסר תאריך אירוע' }, { status: 400 });
      }
      targetMinDate = eventDate;
      targetMaxDate = eventDate;
    }

    // Group required items by model and size
    const requiredItems = {};
    for (const item of items) {
      if (item.isDeleted) continue; // Don't check deleted items
      
      const key = `${item.dressModelId}_${item.sizeText}`;
      if (!requiredItems[key]) {
        requiredItems[key] = {
          dressModelId: item.dressModelId,
          sizeText: item.sizeText,
          quantity: 0,
          dressName: item.dressName || item.description || 'פריט'
        };
      }
      requiredItems[key].quantity += (item.quantity || 1);
    }

    // Check each grouped requirement against available inventory
    const errors = [];
    
    // Group models to minimize getAvailableInventory calls
    const modelsToCheck = [...new Set(Object.values(requiredItems).map(i => i.dressModelId))];
    
    // Fetch settings to get bufferDays
    let bufferDays = 3;
    let skipWeekends = true;
    try {
       const settings = await prisma.systemSetting.findMany();
       const bufferSetting = settings.find(s => s.key === 'inventory_buffer_days');
       if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);
       
       const weekendSetting = settings.find(s => s.key === 'inventory_skip_weekends');
       if (weekendSetting) skipWeekends = weekendSetting.value === 'true';
    } catch(e) {
       console.error("Failed to load settings for validation", e);
    }

    for (const modelId of modelsToCheck) {
      const availability = await getAvailableInventory(
        modelId, 
        targetMinDate, 
        bufferDays, 
        skipWeekends, 
        isAbroad, 
        targetMaxDate,
        orderId // Pass orderId to ignore current order's existing bookings
      );

      // Find requirements for this model
      const modelReqs = Object.values(requiredItems).filter(i => i.dressModelId === modelId);
      
      for (const req of modelReqs) {
        // Find availability for this size
        const sizeAvail = availability.find(a => (a.sizeText || a.size || 'כללי') === req.sizeText);
        
        const availableQty = sizeAvail ? sizeAvail.availableQuantity : 0;
        
        if (req.quantity > availableQty) {
          errors.push({
            dressModelId: req.dressModelId,
            sizeText: req.sizeText,
            dressName: req.dressName,
            requested: req.quantity,
            available: availableQty
          });
        }
      }
    }

    return NextResponse.json({
      valid: errors.length === 0,
      errors
    });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: 'שגיאה באימות המלאי: ' + error.message }, { status: 500 });
  }
}
