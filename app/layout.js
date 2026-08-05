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
import GlobalSidebar from './components/GlobalSidebar';
import Link from 'next/link';
import { Suspense } from 'react';
import { PopupProvider } from './components/PopupProvider';
import { LabelsProvider } from './components/LabelsContext';
import { Users, Shirt, Settings, Coins } from 'lucide-react';
import { UniqueNamesProvider } from './components/UniqueNamesContext';

import AppNavLinks from './components/AppNavLinks';
import OfflineIndicator from './components/OfflineIndicator';
import ErrorReportButton from './components/ErrorReportButton';
import ClipboardDebugger from '../components/ClipboardDebugger';
import MessageHistoryButton from './components/MessageHistoryButton';
import LandingPage from './components/LandingPage';
import StickyTableHeaders from './components/StickyTableHeaders';

export default async function RootLayout({ children }) {
  // Check settings
  let requireLogin = false;
  let enableAlterations = true;
  let hideAIFeatures = false;
  let hideInternalMessaging = false;
  let hideGregorianCalendar = false;
  let enableAiSpecific = false;
  let hideErrorReporting = false;
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['require_login', 'enable_alterations', 'hide_ai_features', 'hide_internal_messaging', 'hide_gregorian_calendar', 'enable_ai_specific_employees', 'hide_error_reporting'] } }
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

    const hideErrorReportingSetting = settings.find(s => s.key === 'hide_error_reporting');
    if (hideErrorReportingSetting && hideErrorReportingSetting.value === 'true') {
      hideErrorReporting = true;
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
  let isProgrammer = false;
  if (isAuthenticated) {
    try {
      const parsedLegacy = parseInt(authToken.value, 10);
      const emp = await prisma.employee.findFirst({
        where: {
          OR: [
            { id: authToken.value },
            ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }])
          ]
        },
        select: { roleId: true, showAi: true }
      });
      if (emp && (emp.roleId === 1 || emp.roleId === 2)) {
        isManager = true;
      }
      if (emp && emp.roleId === 1) {
        isMainManager = true;
      }
      if (emp && emp.roleId === 2) {
        isProgrammer = true;
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  if (typeof window === 'undefined' || window.__apiInterceptorInstalled) return;
  window.__apiInterceptorInstalled = true;
  var originalFetch = window.fetch;
  window.fetch = async function() {
    var args = arguments;
    var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    var startTime = performance.now();
    var response = await originalFetch.apply(this, args);

    if (url && url.indexOf('/api/') !== -1 && url.indexOf('/api/log-visit') === -1 && url.indexOf('/api/queries-by-path') === -1) {
      var recordAndDispatch = function(respSize, execTime) {
        try {
          var parsedUrl = new URL(url, window.location.origin);
          var endpoint = parsedUrl.pathname;
          var requestQuery = parsedUrl.search;
          if (!requestQuery && args[1] && args[1].body) {
            requestQuery = typeof args[1].body === 'string' ? args[1].body : JSON.stringify(args[1].body);
          }
          window.__GLOBAL_LAST_API_CALL__ = url;
          window.__LAST_API_CALLS__ = window.__LAST_API_CALLS__ || {};
          window.__LAST_API_CALLS__[window.location.pathname] = url;
          window.__LAST_API_METADATA__ = window.__LAST_API_METADATA__ || {};
          window.__LAST_API_METADATA__[url] = { responseSize: respSize, executionTime: execTime, timestamp: new Date().toISOString() };
          window.dispatchEvent(new CustomEvent('agy_api_call', { detail: { url: url, endpoint: endpoint, requestQuery: requestQuery, responseSize: respSize, executionTime: execTime } }));
          originalFetch('/api/log-visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ pageUrl: url, requestQuery: requestQuery || null, responseSize: respSize, executionTime: execTime }) }).catch(function(){});
        } catch(e) {}
      };

      var contentLength = response.headers.get('content-length');
      if (contentLength && !isNaN(parseInt(contentLength, 10))) {
        recordAndDispatch(parseInt(contentLength, 10), Math.round(performance.now() - startTime));
      } else {
        var originalJson = response.json;
        var originalText = response.text;
        if (originalJson) {
          response.json = async function() {
            var data = await originalJson.apply(this, arguments);
            try {
              var str = JSON.stringify(data);
              var respSize = new Blob([str]).size;
              var execTime = Math.round(performance.now() - startTime);
              recordAndDispatch(respSize, execTime);
            } catch(e) {}
            return data;
          };
        }
        if (originalText) {
          response.text = async function() {
            var text = await originalText.apply(this, arguments);
            try {
              var textStr = typeof text === 'string' ? text : JSON.stringify(text);
              var respSize = new Blob([textStr]).size;
              var execTime = Math.round(performance.now() - startTime);
              recordAndDispatch(respSize, execTime);
            } catch(e) {}
            return text;
          };
        }
      }
    }
    return response;
  };
})();
`
          }}
        />
      </head>
      <body className={bodyClassName}>
        <UniqueNamesProvider data-element-name="רכיב_layout_1">
          <ClipboardDebugger data-element-name="רכיב_layout_2" />
          <DevEnvBanner data-element-name="רכיב_layout_3" />
        {process.env.IS_OFFLINE_MODE === 'true' && <OfflineIndicator data-element-name="רכיב_layout_4" />}
        <Suspense data-element-name="רכיב_layout_5" fallback={null}>
          <PageTracker data-element-name="רכיב_layout_6" />
        </Suspense>
        <Suspense fallback={null}>
          <StickyTableHeaders />
        </Suspense>
        {showLogin ? (
          <LoginScreen data-element-name="רכיב_layout_7" />
        ) : (
          <LabelsProvider data-element-name="רכיב_layout_8">
            <PopupProvider data-element-name="רכיב_layout_22">
              <nav className="navbar">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <BrandLogo data-element-name="רכיב_layout_9" />
                  <NavigationArrows data-element-name="רכיב_layout_10" />
                </div>
                <AppNavLinks data-element-name="רכיב_layout_11" enableAlterations={enableAlterations} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  {showEmployeesTab && (
                    <Link data-element-name="רכיב_layout_12" href="/employees" title="עובדים ונוכחות" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-color)', textDecoration: 'none' }}>
                      <Users data-element-name="רכיב_layout_13" size={22} />
                    </Link>
                  )}
                  <Link data-element-name="רכיב_layout_refunds" href="/refunds" title="זיכויים" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-color)', textDecoration: 'none' }}>
                    <Coins data-element-name="רכיב_layout_refunds_icon" size={22} />
                  </Link>
                  <Link data-element-name="רכיב_layout_14" href="/dashboard/dresses" title="ניהול קטלוג" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-color)', textDecoration: 'none' }}>
                    <Shirt data-element-name="רכיב_layout_15" size={22} />
                  </Link>
                  {showAdminTab && (
                    <Link data-element-name="רכיב_layout_16" href="/admin" title="אזור ניהול מתקדם" className="icon-nav-link" style={{ display: 'flex', alignItems: 'center', color: 'var(--primary-color)', textDecoration: 'none' }}>
                      <Settings data-element-name="רכיב_layout_17" size={22} />
                    </Link>
                  )}
                  <ThemeToggle data-element-name="רכיב_layout_18" employeeId={authToken?.value} initialTheme={themePreference} />
                  <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }}></div>
                  {isProgrammer && <MessageHistoryButton data-element-name="רכיב_layout_msg_hist" />}
                  {!hideErrorReporting && <ErrorReportButton data-element-name="רכיב_layout_19" />}
                  {authToken?.value && !hideInternalMessaging && <NotificationBell data-element-name="רכיב_layout_20" employeeId={authToken.value} />}
                  <UserMenu data-element-name="רכיב_layout_21" />
                </div>
              </nav>
              {children}
              <GlobalSidebar />
              {!hideAIFeatures && <AIFloatingWidget data-element-name="רכיב_layout_23" hideAIFeatures={hideAIFeatures} />}
            </PopupProvider>
          </LabelsProvider>
        )}
        <LandingPage data-element-name="רכיב_layout_24" />
        </UniqueNamesProvider>
      </body>
    </html>
  );
}
