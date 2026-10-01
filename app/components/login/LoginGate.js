'use client';

// שער בין דף הכניסה החדש (LoginNew, החלטות הבעלים 1.10.2026) למסך הישן (LoginScreen).
// ההכרעה בשרת (app/layout.js): SystemSetting login_page_new - ברירת מחדל (גם בלי שורה ב-DB) = החדש;
// 'false' = הישן, בלי פריסה מחדש. אותו שער משמש גם לכניסה כחלון (isModal) מתפריט המשתמש ומהסרגל החדש,
// ולכן הערך (ושם הגמ"ח לפס העליון) עוברים ב-context ולא כ-prop לכל קורא.

import { createContext, useContext } from 'react';
import LoginScreen from '../LoginScreen';
import LoginNew from './LoginNew';

const LoginVariantContext = createContext({ useNew: true, brand: null });

export function LoginVariantProvider({ value, children }) {
  return <LoginVariantContext.Provider value={value || { useNew: true, brand: null }}>{children}</LoginVariantContext.Provider>;
}

export function useLoginVariant() {
  return useContext(LoginVariantContext);
}

export default function LoginGate(props) {
  const { useNew, brand } = useLoginVariant();
  if (useNew === false) return <LoginScreen {...props} />;
  return <LoginNew {...props} brand={brand} />;
}
