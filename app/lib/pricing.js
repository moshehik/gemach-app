import prisma from './prisma';
import { getCachedSetting } from '@/lib/settingsCache';
import { findPriceRowForSize, normalizeGapRule } from '@/lib/priceRows';

/**
 * Calculates the exact price for a dress model based on its category and size.
 * Replicates the Pricing table lookup logic from Access.
 * 
 * @param {number} dressModelId 
 * @param {string|number} sizeText 
 * @param {Date} eventDate 
 */
export async function calculatePrice(dressModelId, sizeText, eventDate = new Date()) {
  const modelId = dressModelId;
  if (!modelId) throw new Error('Invalid dressModelId');

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
  let rules = await prisma.priceList.findMany({
    where: {
      category: category
    }
  });

  if (rules.length === 0 && category !== 'כללי') {
    rules = await prisma.priceList.findMany({
      where: {
        category: 'כללי'
      }
    });
  }

  // חיפוש שורת המחיר לפי מידה ותאריך - אותו כלל כמו במנוע (lib/priceRows.js), כולל
  // gap_size_price_rule: מידה שבין שני טווחים מחויבת לפי הזול כשההגדרה מופעלת.
  const gapRuleRow = await getCachedSetting('gap_size_price_rule');
  const gapRule = normalizeGapRule(gapRuleRow ? gapRuleRow.value : '');
  const { row: rule } = findPriceRowForSize(rules, rules[0]?.category, sizeNum, { eventDate, gapRule });

  if (rule) {
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
