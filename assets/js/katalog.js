// Oyun kataloğu yardımcıları: tarayıcıda window.Katalog, Node testlerinde module.exports.
(function (kok) {
  function sirala(oyunlar) {
    return oyunlar.slice().sort(function (a, b) {
      return a.eklenme < b.eklenme ? 1 : a.eklenme > b.eklenme ? -1 : 0;
    });
  }

  function oyunAdresi(oyun) {
    return 'games/' + oyun.slug + '/';
  }

  var Katalog = { sirala: sirala, oyunAdresi: oyunAdresi };
  if (typeof module !== 'undefined' && module.exports) module.exports = Katalog;
  else kok.Katalog = Katalog;
})(this);
