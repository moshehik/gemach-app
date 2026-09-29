/* A5 core: שכבת רשת משותפת. בלי לוגיקה עסקית. */
(function () {
  const A5 = (window.A5 = window.A5 || {});
  A5.api = async function (path, opts) {
    opts = opts || {};
    const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, init);
    let data = null;
    try { data = await res.json(); } catch (e) { /* לא JSON */ }
    if (!res.ok) {
      const err = new Error((data && (data.error || data.message)) || ('HTTP ' + res.status));
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  };
  A5.adv = A5.adv || { focus: {} };
  A5.adv.focus = A5.adv.focus || {};
})();
