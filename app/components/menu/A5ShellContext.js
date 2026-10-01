'use client';

// הקשר שהמעטפת החדשה (MenuA5Shell) מספקת לדפים שמתחתיה: עץ התפריט כפי שהשרת חישב אותו.
// מחוץ למעטפת החדשה (מעטפת 'legacy', קיוסק, הדפסה) הערך הוא null - כך דף יכול להחליט להציג משהו רק במעטפת החדשה.
import { createContext, useContext } from 'react';

const A5ShellContext = createContext(null);

export const A5ShellProvider = A5ShellContext.Provider;

/** @returns {{ menuTree: object } | null} */
export function useA5Shell() {
  return useContext(A5ShellContext);
}
