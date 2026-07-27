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
import NotificationBell from './components/NotificationBell';
import LoginScreen from './components/LoginScreen';
import PageTracker from './components/PageTracker';
import AIFloatingWidget from './components/AIFloatingWidget';
import DevEnvBanner from './components/DevEnvBanner';
import ThemeToggle from './components/ThemeToggle';
import Link from 'next/link';
import { Suspense } from 'react';
import { PopupProvider } from './components/PopupProvider';
import { LabelsProvider } from './components/LabelsContext';
import { Users, Shirt, Settings } from 'lucide-react';

import AppNavLinks from './components/AppNavLinks';
import OfflineIndicator from './components/OfflineIndicator';
import ErrorReportButton from './components/ErrorReportButton';
import ClipboardDebugger from '../components/ClipboardDebugger';
import LandingPage from './components/LandingPage';

export default async function RootLayout({ children }) {
  // Check settings
  let requireLogin = false;
  let enableAlterations = true;
  let hideAIFeatures = false;
  let hideInternalMessaging = false;
  let hideGregorianCalendar = false;
  let enableAiSpecific = false;
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['require_login', 'enable_alterations', 'hide_ai_features', 'hide_internal_messaging', 'hide_gregorian_calendar', 'enable_ai_specific_employees'] } }
    });
    
    const requireLoginSetting = settings.find(s => s.key === 'require_login');
    if (requireLoginSetting && requireLoginSetting.value === 'true') {
      requireLogin = true;
    }

    const enableAlterationsSetting = settings.find(s => s.key === 'enable_alterations');
    if (enableAlterationsSetting && enableAlterationsSetting.value === 'false') {
      enableAlterations = false;
    }

    const hideAIFeaturesSetting = settings.find(s => s.key === 'hide_ai_features');
    if (hideAIFeaturesSetting && hideAIFeaturesSetting.value === 'true') {
      hideAIFeatures = true;
    }

    const hideInternalMessagingSetting = settings.find(s => s.key === 'hide_internal_messaging');
    if (hideInternalMessagingSetting && hideInternalMessagingSetting.value === 'true') {
      hideInternalMessaging = true;
    }

    const hideGregorianCalendarSetting = settings.find(s => s.key === 'hide_gregorian_calendar');
    if (hideGregorianCalendarSetting && hideGregorianCalendarSetting.value === 'true') {
      hideGregorianCalendar = true;
    }

    const enableAiSpecificSetting = settings.find(s => s.key === 'enable_ai_specific_employees');
    if (enableAiSpecificSetting && enableAiSpecificSetting.value === 'true') {
      enableAiSpecific = true;
    }
  } catch (err) {
    console.warn('Failed to fetch settings:', err?.message || err);
  }

  // Check if user is authenticated
  const cookieStore = await cookies();
  const authToken = cookieStore.get('auth_token');
  const isAuthenticated = !!authToken?.value;

  let isManager = false;
  let isMainManager = false;
  let employeeShowAi = false;
  if (isAuthenticated) {
    try {
      const emp = await prisma.employee.findUnique({
        where: { id: authToken.value },
        select: { roleId: true, showAi: true }
      });
      if (emp && (emp.roleId === 1 || emp.roleId === 2)) {
        isManager = true;
      }
      if (emp && emp.roleId === 1) {
        isMainManager = true;
      }
      if (emp && emp.showAi) {
        employeeShowAi = true;
      }
    } catch (e) {
      console.warn('Error fetching employee role:', e?.message || e);
    }
  }

  if (enableAiSpecific && (!isAuthenticated || !employeeShowAi)) {
    hideAIFeatures = true;
  }

  const showAdminTab = !requireLogin || isMainManager;
  const showEmployeesTab = !requireLogin || isMainManager;

  const themeCookie = authToken?.value ? cookieStore.get(`theme_${authToken.value}`) : null;
  const themePreference = themeCookie?.value || 'light';

  const showLogin = requireLogin && !isAuthenticated;

  let bodyClassName = hideAIFeatures ? 'hide-ai-features ' : '';
  if (hideGregorianCalendar) {
    bodyClassName += 'hide-gregorian-calendar ';
  }
  bodyClassName = bodyClassName.trim();

  return (
    <html lang="he" dir="rtl" data-theme={!showLogin ? themePreference : 'light'}>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={bodyClassName}>
        <ClipboardDebugger />
        <DevEnvBanner />
        {process.env.IS_OFFLINE_MODE === 'true' && <OfflineIndicator />}
        <Suspense fallback={null}>
          <PageTracker />
        </Suspense>
        {showLogin ? (
          <LoginScreen />
        ) : (
          <LabelsProvider>
            <>
              <nav className="navbar">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <BrandLogo />
                  <NavigationArrows />
                </div>
                <AppNavLinks enableAlterations={enableAlterations} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  {showEmployeesTab && (
                    <Link href="/employees" title="עובדים ונוכחות" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-color)', textDecoration: 'none' }}>
                      <Users size={22} />
                    </Link>
                  )}
                  <Link href="/dashboard/dresses" title="ניהול קטלוג" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-color)', textDecoration: 'none' }}>
                    <Shirt size={22} />
                  </Link>
                  {showAdminTab && (
                    <Link href="/admin" title="אזור ניהול מתקדם" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--primary-color)', textDecoration: 'none' }}>
                      <Settings size={22} />
                    </Link>
                  )}
                  <ThemeToggle employeeId={authToken?.value} initialTheme={themePreference} />
                  <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }}></div>
                  <ErrorReportButton />
                  {authToken?.value && !hideInternalMessaging && <NotificationBell employeeId={authToken.value} />}
                  <UserMenu />
                </div>
              </nav>
              <PopupProvider>
                {children}
              </PopupProvider>
              {!hideAIFeatures && <AIFloatingWidget />}
            </>
          </LabelsProvider>
        )}
        <LandingPage />
      </body>
    </html>
  );
}
