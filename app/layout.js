import './globals.css';
import './design-overrides.css';
import './design-system.css';
import { cookies } from 'next/headers';
import prisma from './lib/prisma';
import { buildCustomPaletteVars, customPaletteCssText } from './lib/customPalette';

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

  // Palette/font/density/textScale/customColors — same per-employee cookie
  // pattern as themeCookie above, so a shared front-desk browser doesn't let
  // whichever employee last edited /display-settings silently override the
  // next employee's own choices (previously these lived only in the
  // browser-wide `gemachDesignPrefs` localStorage key). Written by
  // app/display-settings/page.js as `designPrefs_<employeeId>`, JSON-encoded.
  const designPrefsCookie = authToken?.value ? cookieStore.get(`designPrefs_${authToken.value}`) : null;
  let employeeDesignPrefs = null;
  if (designPrefsCookie?.value) {
    try {
      employeeDesignPrefs = JSON.parse(decodeURIComponent(designPrefsCookie.value));
    } catch (e) {
      employeeDesignPrefs = null;
    }
  }
  // Same "off value = omit the attribute" convention as applyAttr() in
  // app/display-settings/page.js and the no-FOUC bootstrap script below.
  const paletteAttr = employeeDesignPrefs?.palette && employeeDesignPrefs.palette !== 'wine' ? employeeDesignPrefs.palette : undefined;
  const fontAttr = employeeDesignPrefs?.font && employeeDesignPrefs.font !== 'default' ? employeeDesignPrefs.font : undefined;
  const densityAttr = employeeDesignPrefs?.density && employeeDesignPrefs.density !== 'comfortable' ? employeeDesignPrefs.density : undefined;
  const textScaleAttr = employeeDesignPrefs?.textScale && employeeDesignPrefs.textScale !== 'normal' ? employeeDesignPrefs.textScale : undefined;

  // "custom" is the one palette that isn't a fixed hue in design-system.css —
  // derive its --primary-*/--accent-* variable set (light + dark) server-side
  // from the same app/lib/customPalette.js helpers the /display-settings page
  // uses, so it's correct in the very first server-rendered response (no
  // flash of the wrong/no palette while a client script catches up).
  let customPaletteCss = null;
  if (paletteAttr === 'custom' && employeeDesignPrefs?.customColors?.primary && employeeDesignPrefs?.customColors?.accent) {
    customPaletteCss = customPaletteCssText(
      buildCustomPaletteVars(employeeDesignPrefs.customColors.primary, employeeDesignPrefs.customColors.accent)
    );
  }

  const showLogin = requireLogin && !isAuthenticated;

  let bodyClassName = hideAIFeatures ? 'hide-ai-features ' : '';
  if (hideGregorianCalendar) {
    bodyClassName += 'hide-gregorian-calendar ';
  }
  bodyClassName = bodyClassName.trim();

  return (
    <html
      lang="he"
      dir="rtl"
      data-theme={!showLogin ? themePreference : 'light'}
      data-palette={!showLogin ? paletteAttr : undefined}
      data-font={!showLogin ? fontAttr : undefined}
      data-density={!showLogin ? densityAttr : undefined}
      data-text-scale={!showLogin ? textScaleAttr : undefined}
      suppressHydrationWarning
    >
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
    // Palette/font/density/text-scale: for a logged-in employee these are
    // already server-rendered from the designPrefs_<employeeId> cookie (see
    // RootLayout below) — data-palette/data-font/data-density/data-text-scale
    // are already correct on <html> and the matching #custom-palette-style
    // tag (if any) is already in <head> before this script even runs.
    // localStorage is shared by the whole browser profile, so replaying it
    // here for an authenticated session would let whichever employee last
    // touched /display-settings on this shared terminal silently override
    // the next employee's own prefs — exactly the bug the cookie exists to
    // fix. Only fall back to localStorage when nobody is logged in to scope
    // by (guest session / requireLogin off) — same as before this cookie
    // existed.
    var hasEmployeeCookie = ${isAuthenticated ? 'true' : 'false'};
    if (!hasEmployeeCookie) {
    setAttr('data-palette', saved.palette, ['wine']);
    setAttr('data-font', saved.font, ['default']);
    setAttr('data-density', saved.density, ['comfortable']);
    setAttr('data-text-scale', saved.textScale, ['normal']);
    // "custom" is the one palette that isn't a fixed hue in design-system.css
    // — its colors live in saved.customColors ({ primary, accent }) and the
    // full --primary-*/--accent-* set (light + dark) has to be derived here,
    // before paint, exactly like app/lib/customPalette.js does for the
    // /display-settings page itself (that module can't be imported into this
    // raw inline script, so the same HSL math is duplicated below — keep the
    // two in sync, function-for-function, if the derivation ever changes).
    // It's written as a real <style> tag scoped to [data-palette="custom"],
    // not an inline style= on <html>, so it still composes correctly with
    // the [data-theme="dark"] attribute selector below (an inline style
    // override would always win and block the dark-mode block from ever
    // applying).
    if (saved.palette === 'custom' && saved.customColors && saved.customColors.primary && saved.customColors.accent) {
      try {
        var hexRe = /^#?([0-9a-f]{6})$/i;
        function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
        function hexToHsl(hex) {
          var m = hexRe.exec(hex || '');
          var clean = m ? m[1] : '7c2e4d';
          var r = parseInt(clean.slice(0, 2), 16) / 255;
          var g = parseInt(clean.slice(2, 4), 16) / 255;
          var b = parseInt(clean.slice(4, 6), 16) / 255;
          var max = Math.max(r, g, b), min = Math.min(r, g, b);
          var h = 0, s = 0, l = (max + min) / 2, d = max - min;
          if (d !== 0) {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d) + (g < b ? 6 : 0);
            else if (max === g) h = ((b - r) / d) + 2;
            else h = ((r - g) / d) + 4;
            h *= 60;
          }
          return { h: h, s: s * 100, l: l * 100 };
        }
        function hslToHex(h, s, l) {
          var hue = ((h % 360) + 360) % 360;
          var sat = clamp(s, 0, 100) / 100;
          var light = clamp(l, 0, 100) / 100;
          var c = (1 - Math.abs((2 * light) - 1)) * sat;
          var x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
          var m = light - (c / 2);
          var r = 0, g = 0, b = 0;
          if (hue < 60) { r = c; g = x; b = 0; }
          else if (hue < 120) { r = x; g = c; b = 0; }
          else if (hue < 180) { r = 0; g = c; b = x; }
          else if (hue < 240) { r = 0; g = x; b = c; }
          else if (hue < 300) { r = x; g = 0; b = c; }
          else { r = c; g = 0; b = x; }
          function toHex(v) {
            var n = clamp(Math.round((v + m) * 255), 0, 255).toString(16);
            return n.length === 1 ? '0' + n : n;
          }
          return '#' + toHex(r) + toHex(g) + toHex(b);
        }
        var p = hexToHsl(saved.customColors.primary);
        var a = hexToHsl(saved.customColors.accent);
        var lp = hslToHex(p.h, p.s, p.l);
        var lpHover = hslToHex(p.h, clamp(p.s + 4, 0, 95), clamp(p.l - 8, 6, 94));
        var lpTint = hslToHex(p.h, clamp(p.s * 0.5, 12, 34), 93);
        var lpTint2 = hslToHex(p.h, clamp(p.s * 0.6, 16, 40), 83);
        var la = hslToHex(a.h, a.s, a.l);
        var laTint = hslToHex(a.h, clamp(a.s * 0.5, 12, 34), 91);
        var dp = hslToHex(p.h, clamp(p.s * 0.7, 30, 72), clamp(p.l + 38, 60, 82));
        var dpHover = hslToHex(p.h, clamp(p.s * 0.65, 26, 66), clamp(p.l + 48, 70, 88));
        var dpSolid = hslToHex(p.h, clamp(p.s * 0.85, 35, 82), clamp((p.l * 0.85) + 10, 30, 52));
        var dpTint = hslToHex(p.h, clamp(p.s * 0.55, 18, 52), clamp((p.l * 0.22) + 6, 11, 24));
        var dpTint2 = hslToHex(p.h, clamp(p.s * 0.6, 20, 55), clamp((p.l * 0.3) + 7, 15, 30));
        var da = hslToHex(a.h, clamp(a.s * 0.65, 28, 68), clamp(a.l + 36, 58, 80));
        var daSolid = hslToHex(a.h, clamp(a.s * 0.8, 32, 78), clamp((a.l * 0.85) + 9, 28, 48));
        var daTint = hslToHex(a.h, clamp(a.s * 0.55, 18, 50), clamp((a.l * 0.24) + 6, 11, 24));
        var css = ':root[data-palette="custom"]{'
          + '--primary:' + lp + ';--primary-hover:' + lpHover + ';--primary-solid:' + lp + ';'
          + '--primary-tint:' + lpTint + ';--primary-tint-2:' + lpTint2 + ';'
          + '--accent:' + la + ';--accent-solid:' + la + ';--accent-tint:' + laTint + ';'
          + '}'
          + ':root[data-palette="custom"][data-theme="dark"]{'
          + '--primary:' + dp + ';--primary-hover:' + dpHover + ';--primary-solid:' + dpSolid + ';'
          + '--primary-tint:' + dpTint + ';--primary-tint-2:' + dpTint2 + ';'
          + '--accent:' + da + ';--accent-solid:' + daSolid + ';--accent-tint:' + daTint + ';'
          + '}';
        var styleEl = document.getElementById('custom-palette-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'custom-palette-style';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = css;
      } catch (e) {}
    }
    }
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
        {!showLogin && customPaletteCss && (
          <style id="custom-palette-style" dangerouslySetInnerHTML={{ __html: customPaletteCss }} />
        )}
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
