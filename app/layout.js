import './globals.css';
import './design-overrides.css';
import './design-system.css';
import { cookies } from 'next/headers';
import prisma from './lib/prisma';

export const metadata = {
  title: 'גמ"ח שמלות - קטלוג וניהול',
  description: 'מערכת לניהול וצפייה במלאי הגמ"ח - קטלוג דגמים, זמינות לפי מידות',
};

import IconSprite from './components/IconSprite';
import AppShell from './components/AppShell';
import { buildNavGroups } from './components/navConfig';
import LoginScreen from './components/LoginScreen';
import PageTracker from './components/PageTracker';
import AIFloatingWidget from './components/AIFloatingWidget';
import DevEnvBanner from './components/DevEnvBanner';
import { Suspense } from 'react';
import { PopupProvider } from './components/PopupProvider';
import { LabelsProvider } from './components/LabelsContext';
import { UniqueNamesProvider } from './components/UniqueNamesContext';

import PrefetchManager from './components/PrefetchManager';
import OfflineIndicator from './components/OfflineIndicator';
import ClipboardDebugger from '../components/ClipboardDebugger';
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

  // מחובר — נשפט לפי תפקיד (מנהל/מתכנת בלבד), גם כשההתחברות אופציונלית;
  // אורח — רואה הכל רק כשחובת התחברות כבויה. אותו כלל כמו checkPageAccess.
  const showAdminTab = isAuthenticated ? isManager : !requireLogin;
  const showEmployeesTab = isAuthenticated ? isManager : !requireLogin;
  const showRefundsTab = isAuthenticated ? isManager : !requireLogin;

  const navGroups = buildNavGroups({
    showAdminTab,
    showEmployeesTab,
    showRefundsTab,
    enableAlterations,
    showMessages: !hideInternalMessaging,
  });

  const themeCookie = authToken?.value ? cookieStore.get(`theme_${authToken.value}`) : null;
  const themePreference = themeCookie?.value || 'light';

  const showLogin = requireLogin && !isAuthenticated;

  let bodyClassName = hideAIFeatures ? 'hide-ai-features ' : '';
  if (hideGregorianCalendar) {
    bodyClassName += 'hide-gregorian-calendar ';
  }
  bodyClassName = bodyClassName.trim();

  return (
    <html lang="he" dir="rtl" data-theme={!showLogin ? themePreference : 'light'} suppressHydrationWarning>
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    if (typeof window === 'undefined') return;
    var root = document.documentElement;
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('gemachDesignPrefs') || '{}'); } catch (e) { saved = {}; }
    function setAttr(attr, val, offVals) {
      if (!val || offVals.indexOf(val) !== -1) root.removeAttribute(attr);
      else root.setAttribute(attr, val);
    }
    setAttr('data-palette', saved.palette, ['wine']);
    setAttr('data-font', saved.font, ['default']);
    setAttr('data-density', saved.density, ['comfortable']);
    setAttr('data-text-scale', saved.textScale, ['normal']);
    // data-theme is normally set server-side from the theme_<employeeId> cookie
    // (see RootLayout below) — only override it here when the user picked an
    // explicit mode on /display-settings; leave 'auto'/unset alone so the
    // cookie-based value (and its 'auto' fallback there) keeps winning.
    var mode = saved.mode;
    if (mode === 'dark' || mode === 'light' || mode === 'contrast') {
      root.setAttribute('data-theme', mode);
    }
  } catch (e) {}
})();
`
          }}
        />
      </head>
      <body className={bodyClassName}>
        <IconSprite />
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
              <AppShell
                navGroups={navGroups}
                isProgrammer={isProgrammer}
                hideErrorReporting={hideErrorReporting}
                hideInternalMessaging={hideInternalMessaging}
                authToken={authToken?.value}
                themePreference={themePreference}
              >
                {children}
              </AppShell>
              <PrefetchManager />
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
