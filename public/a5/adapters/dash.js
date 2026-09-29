/* A5 dash: סיכום כספי אמיתי. load() -> {K, methods, trend} (401/403 נזרקים עם .status) */
(function () {
  const A5 = (window.A5 = window.A5 || {});
  A5.dash = A5.dash || {};
  A5.dash.load = function () { return A5.api('/api/a5/dashboard'); };
})();
