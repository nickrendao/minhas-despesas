(function () {
  if (window.__finBridge || !window.AndroidApp) return;
  window.__finBridge = true;
  // O WebView não baixa links "blob:" com o atributo download. Aqui lemos o arquivo e entregamos ao Android, que o grava em Downloads.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (!a || !/^blob:/.test(a.href)) return;
    e.preventDefault(); e.stopPropagation();
    var name = a.getAttribute('download') || 'arquivo';
    fetch(a.href).then(function (r) { return r.blob(); }).then(function (b) {
      var fr = new FileReader();
      fr.onloadend = function () { var s = String(fr.result); window.AndroidApp.saveFile(name, b.type || 'application/octet-stream', s.slice(s.indexOf(',') + 1)); };
      fr.readAsDataURL(b);
    });
  }, true);

  // Cor das barras do Android (status e navegação) = cor de fundo do app, no tema claro e no escuro.
  if (window.AndroidApp.setBars) {
    var last = '';
    var paint = function () {
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor || '');
      if (!m) return; var r = +m[1], g = +m[2], b = +m[3], key = r + ',' + g + ',' + b; if (key === last) return; last = key;
      var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      window.AndroidApp.setBars(((255 << 24) | (r << 16) | (g << 8) | b) | 0, luminance > 0.55);
    };
    paint();
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
})();
