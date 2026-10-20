if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    var kok = document.querySelector('meta[name="site-kok"]');
    navigator.serviceWorker.register((kok ? kok.content : '') + 'sw.js').catch(function () {});
  });
}
