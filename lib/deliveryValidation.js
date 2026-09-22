// לוגיקת חובה משותפת לשדות המשלוח (עיר/כתובת) - קובץ אחד ללא תלות ב-Prisma כדי שגם
// קליינט (app/orders/new/page.js, ModernGeneralDetails.js) וגם שרת (API routes) ישתמשו
// באותה לוגיקה בדיוק, במקום לשכפל אותה בכל מקום עם סיכון להתפצל (ר' דיווחים על
// אכיפה חלקית - שדה חובה מוצג בעריכת הזמנה חדשה אך לא נאכף בעריכת הזמנה קיימת/בשרת).

// עיר המשלוח שונה מעיר המגורים של הלקוח - כתובת משלוח מפורשת הופכת לשדה חובה, אחרת
// אין למשלוח לאן להגיע (לא מסתפקים בכתובת המגורים הרגילה).
export function isDeliveryAddressRequired(order, customerCity) {
  const deliveryCity = String(order?.deliveryCity || '').trim();
  const custCity = String(customerCity || '').trim();
  return !!(order?.isDelivery && deliveryCity && custCity && deliveryCity !== custCity);
}

// עיר המגורים של הלקוח אינה ברשימת הערים שיש להן מחיר משלוח מוגדר (delivery_price_by_city) -
// אי אפשר להניח שהמשלוח יגיע אליה כרגיל, ולכן יש לחייב הזנה מפורשת של עיר משלוח.
export function isDeliveryCityRequired(order, customerCity, deliveryPriceCities) {
  const custCity = String(customerCity || '').trim();
  const customerCityKnown = custCity && (deliveryPriceCities || []).includes(custCity);
  return !!(order?.isDelivery && !customerCityKnown);
}

// מחזיר הודעת שגיאה (בעברית, מוכנה ל-alert/400) אם ההזמנה לא עומדת בדרישות שדות
// המשלוח, אחרת null.
export function validateDeliveryFields(order, customerCity, deliveryPriceCities) {
  if (!order?.isDelivery) return null;
  if (isDeliveryCityRequired(order, customerCity, deliveryPriceCities) && !String(order.deliveryCity || '').trim()) {
    return 'עיר המגורים של הלקוח אינה ברשימת ערי המשלוח המוגדרות - יש להזין עיר משלוח באופן מפורש.';
  }
  if (isDeliveryAddressRequired(order, customerCity) && !String(order.deliveryAddress || '').trim()) {
    return 'עיר המשלוח שונה מעיר המגורים של הלקוח - יש להזין כתובת משלוח מלאה.';
  }
  return null;
}
