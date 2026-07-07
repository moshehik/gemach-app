import { HDate } from '@hebcal/core';

// מערך המרה תקין לימים בעברית
export const HEBREW_DAYS = [
  "", "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'", "ח'", "ט'", "י'",
  "י\"א", "י\"ב", "י\"ג", "י\"ד", "ט\"ו", "ט\"ז", "י\"ז", "י\"ח", "י\"ט", "כ'",
  "כ\"א", "כ\"ב", "כ\"ג", "כ\"ד", "כ\"ה", "כ\"ו", "כ\"ז", "כ\"ח", "כ\"ט", "ל'"
];

// מערך המרה תקין לחודשים
export const HEBREW_MONTHS = {
  1: "ניסן",
  2: "אייר",
  3: "סיוון",
  4: "תמוז",
  5: "אב",
  6: "אלול",
  7: "תשרי",
  8: "חשוון",
  9: "כסלו",
  10: "טבת",
  11: "שבט",
  12: "אדר",
  13: "אדר ב'"
};

export const getHebrewMonthName = (monthNumber, isLeap) => {
  if (isLeap && monthNumber === 12) return "אדר א'";
  return HEBREW_MONTHS[monthNumber];
};

export const getHebrewYearString = (year) => {
  try {
    const hd = new HDate(1, 7, year);
    const parts = hd.renderGematriya().split(' ');
    let yStr = parts[parts.length - 1]; 
    return yStr.replace(/״/g, '"').replace(/׳/g, "'");
  } catch (e) {
    return year.toString();
  }
};

export function getHebrewDateString(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    
    const hdate = new HDate(d);
    const dayName = HEBREW_DAYS[hdate.getDate()];
    const isLeap = hdate.isLeapYear();
    const monthName = getHebrewMonthName(hdate.getMonth(), isLeap);
    const yearName = getHebrewYearString(hdate.getFullYear());
    
    return `${dayName} ב${monthName} ${yearName}`;
  } catch (e) {
    console.error("Error formatting hebrew date:", e);
    const d = date instanceof Date ? date : new Date(date);
    return !isNaN(d.getTime()) ? d.toLocaleDateString('he-IL') : "";
  }
}

export function getHebrewMonthYear(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    
    const hdate = new HDate(d);
    const isLeap = hdate.isLeapYear();
    const monthName = getHebrewMonthName(hdate.getMonth(), isLeap);
    const yearName = getHebrewYearString(hdate.getFullYear());
    return `${monthName} ${yearName}`;
  } catch (e) {
    return "";
  }
}

export function isHebrewLeapYear(year) {
  return HDate.isLeapYear(year);
}
