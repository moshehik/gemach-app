
import prisma from '@/app/lib/prisma';

export async function calculatePrice(dressModelId, sizeText, eventDate) {
  if (!dressModelId) return { basePrice: 0, deposit: 0 };
  
  const dressModel = await prisma.dressModel.findUnique({
    where: { id: parseInt(dressModelId) }
  });
  
  if (!dressModel) return { basePrice: 0, deposit: 0 };
  
  const category = dressModel.priceCategory;
  const sizeNum = parseInt(sizeText) || 0;
  
  let basePrice = 0;
  
  if (category) {
    // Find price rules for this category
    const priceRules = await prisma.priceList.findMany({
      where: { category: category }
    });
    
    // Filter by size and date
    const validRules = priceRules.filter(p => {
      const sizeMatch = sizeNum >= (p.fromSize || 0) && (p.toSize === null || sizeNum <= p.toSize);
      
      let dateMatch = true;
      if (eventDate) {
        const evDate = new Date(eventDate);
        if (p.startDate && evDate < new Date(p.startDate)) dateMatch = false;
        if (p.endDate && evDate > new Date(p.endDate)) dateMatch = false;
      }
      return sizeMatch && dateMatch;
    });

    if (validRules.length > 0) {
      basePrice = validRules[0].price || 0;
    }
  }

  // Fallback if no price rule found
  if (basePrice === 0) {
    // some default price or 0
    basePrice = 0; 
  }

  return { basePrice, deposit: 0 };
}
