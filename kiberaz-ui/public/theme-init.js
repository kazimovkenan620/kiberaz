// Mövzu ilk boyamadan ƏVVƏL tətbiq olunur ki, səhv mövzu "işartısı" olmasın.
// Bu fayl index.html-dəki inline skriptin yerinə gəlib: CSP `script-src 'self'` inline
// skriptə icazə vermir, xarici fayl isə eyni işi görür və 'unsafe-inline' tələb etmir.
// Yalnız mövzu seçimi localStorage-da saxlanılır; heç bir token/sessiya məlumatı burada yoxdur.
(function () {
  try {
    var stored = localStorage.getItem('kiberaz-theme');
    var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
