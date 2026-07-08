import './globals.css';
import { cookies } from 'next/headers';
import prisma from './lib/prisma';

export const metadata = {
  title: 'גמ"ח שמלות - קטלוג וניהול',
  description: 'מערכת לניהול וצפייה במלאי הגמ"ח - קטלוג דגמים, זמינות לפי מידות',
};

import BrandLogo from './components/BrandLogo';
import NavigationArrows from './components/NavigationArrows';
import UserMenu from './components/UserMenu';
import LoginScreen from './components/LoginScreen';
import PageTracker from './components/PageTracker';
import AIFloatingWidget from './components/AIFloatingWidget';
import Link from 'next/link';
import { Suspense } from 'react';
import { PopupProvider } from './components/PopupProvider';
import { Users, Shirt, Settings } from 'lucide-react';

export default async function RootLayout({ children }) {
  // Check if login is required
  let requireLogin = false;
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'require_login' }
    });
    if (setting && setting.value === 'true') {
      requireLogin = true;
    }
  } catch (err) {
    console.error('Failed to fetch require_login setting', err);
  }

  // Check if user is authenticated
  const cookieStore = await cookies();
  const authToken = cookieStore.get('auth_token');
  const isAuthenticated = !!authToken?.value;

  const showLogin = requireLogin && !isAuthenticated;

  return (
    <html lang="he" dir="rtl">
      <body>
        <Suspense fallback={null}>
          <PageTracker />
        </Suspense>
        {showLogin ? (
          <LoginScreen />
        ) : (
          <>
            <nav className="navbar">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <BrandLogo />
                <NavigationArrows />
              </div>
              <div className="nav-links">
                <Link href="/" className="nav-link">מערכת כללית</Link>
                <Link href="/customers" className="nav-link">לקוחות</Link>
                <Link href="/customer-interface" className="nav-link">זמינות לקוח</Link>
                <Link href="/orders" className="nav-link">הזמנות ותשלומים</Link>
                <Link href="/rentals" className="nav-link">השכרות והחזרות</Link>
                <Link href="/alterations" className="nav-link">תיקונים ותפירות</Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <Link href="/employees" title="עובדים ונוכחות" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-color)', textDecoration: 'none' }}>
                  <Users size={22} />
                </Link>
                <Link href="/dashboard/dresses" title="ניהול קטלוג" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-color)', textDecoration: 'none' }}>
                  <Shirt size={22} />
                </Link>
                <Link href="/admin" title="אזור ניהול מתקדם" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--primary-color)', textDecoration: 'none' }}>
                  <Settings size={22} />
                </Link>
                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }}></div>
                <UserMenu />
              </div>
            </nav>
            <PopupProvider>
              {children}
            </PopupProvider>
            <AIFloatingWidget />
          </>
        )}
      </body>
    </html>
  );
}
