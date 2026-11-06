/* Apply the stored theme before first paint (no flash). Lives in its own file so
   the page can run under a strict CSP without an inline-script exception. */
(function () {
  var t = '';
  try { t = localStorage.getItem('mgcalc.theme') || localStorage.getItem('mg.site.theme') || ''; } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'dark' ? '#0a0f15' : '#edf1f6');
})();
