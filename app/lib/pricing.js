import prisma from './prisma';

/**
 * Calculates the exact price for a dress model based on its category and size.
 * Replicates the Pricing table lookup logic from Access.
 * 
 * @param {number} dressModelId 
 * @param {string|number} sizeText 
 * @param {Date} eventDate 
 */
export async function calculatePrice(dressModelId, sizeText, eventDate = new Date()) {
  const modelId = parseInt(dressModelId, 10);
  if (isNaN(modelId)) throw new Error('Invalid dressModelId');

  const dressModel = await prisma.dressModel.findUnique({
    where: { id: modelId }
  });

  if (!dressModel) throw new Error('Dress model not found');

  const category = dressModel.priceCategory || 'כללי';
  
  // Extract numerical size for comparison
  let sizeNum = parseFloat(sizeText);
  if (isNaN(sizeNum)) {
    // If size is string like 'S', 'M', 'L' etc, we might have to fallback or it maps to a specific string.
    // Assuming mostly numerical sizes as per Access setup.
    sizeNum = 0; 
  }

  // Find all price rules for this category
  // In Access, if a specific category isn't found, it might fall back to 'כללי'
  let rules = await prisma.priceRule.findMany({
    where: {
      category: category
    }
  });

  if (rules.length === 0 && category !== 'כללי') {
    rules = await prisma.priceRule.findMany({
      where: {
        category: 'כללי'
      }
    });
  }

  // Filter by size and date
  const validRules = rules.filter(r => {
    // Check size range
    const minSize = r.minSize !== null ? r.minSize : -999;
    const maxSize = r.maxSize !== null ? r.maxSize : 999;
    if (sizeNum < minSize || sizeNum > maxSize) return false;

    // Check dates
    if (r.startDate && eventDate < r.startDate) return false;
    if (r.endDate && eventDate > r.endDate) return false;

    return true;
  });

  if (validRules.length > 0) {
    // Pick the most relevant rule (usually there's only one matching)
    const rule = validRules[0];
    return {
      basePrice: rule.price || 0,
      ruleId: rule.id,
      category: rule.category
    };
  }

  // Fallback if no rule matches
  // Default base price from model if it exists, else 0
  return {
    basePrice: 0,
    ruleId: null,
    category: 'לא נמצא מחירון'
  };
}
