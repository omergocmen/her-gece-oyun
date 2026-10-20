// Oyun kataloğu yardımcıları: tarayıcıda window.Katalog, Node testlerinde module.exports.
(function (kok) {
  // Son kaç gün içinde eklenen oyun kartında "Yeni" damgası taşır.
  var YENI_GUN = 7;

  function sirala(oyunlar) {
    return oyunlar.slice().sort(function (a, b) {
      return a.eklenme < b.eklenme ? 1 : a.eklenme > b.eklenme ? -1 : 0;
    });
  }

  function oyunAdresi(oyun) {
    return 'games/' + oyun.slug + '/';
  }

  // YYYY-AA-GG tarihini yerel gece yarısına çevirir; saat dilimi kayması olmasın diye Date.parse kullanılmaz.
  function gunBasi(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  // Oyun bugünden en fazla YENI_GUN gün önce eklendiyse yenidir (gelecek tarihli kayıt da yeni sayılır).
  function yeniMi(oyun, bugun) {
    var b = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
    return Math.round((b - gunBasi(oyun.eklenme)) / 864e5) < YENI_GUN;
  }

  // ---------- Kategori süzgeci ----------
  var TUMU = 'tumu';
  var UC_BOYUT = '3d';
  var TR_HARF = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i̇': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };

  // "Masa oyunu" → "masa-oyunu": URL'de (?kategori=…) paylaşılabilir süzgeç anahtarı.
  function kategoriAnahtari(ad) {
    return String(ad).toLocaleLowerCase('tr-TR')
      .replace(/i̇|[çğıöşüâîû]/g, function (h) { return TR_HARF[h]; })
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Süzgeç düğmeleri games.json'dan türetilir: "Tümü", sonra kategoriler listede ilk göründükleri sırayla,
  // en sonda (3D oyun varsa) boyut alanından gelen "3D". Yeni kategori eklenince kod değişmez.
  function kategoriler(oyunlar) {
    var sonuc = [{ anahtar: TUMU, ad: 'Tümü' }];
    var gorulen = {};
    gorulen[TUMU] = gorulen[UC_BOYUT] = true;
    oyunlar.forEach(function (oyun) {
      var anahtar = kategoriAnahtari(oyun.kategori);
      if (anahtar && !gorulen[anahtar]) {
        gorulen[anahtar] = true;
        sonuc.push({ anahtar: anahtar, ad: oyun.kategori });
      }
    });
    if (oyunlar.some(function (o) { return o.boyut === '3D'; })) sonuc.push({ anahtar: UC_BOYUT, ad: '3D' });
    return sonuc;
  }

  function suz(oyunlar, anahtar) {
    if (!anahtar || anahtar === TUMU) return oyunlar.slice();
    return oyunlar.filter(function (oyun) {
      return anahtar === UC_BOYUT ? oyun.boyut === '3D' : kategoriAnahtari(oyun.kategori) === anahtar;
    });
  }

  // URL'den gelen anahtar listede yoksa (eski bağlantı, yazım hatası) süzgeç "Tümü"ne döner.
  function gecerliAnahtar(oyunlar, anahtar) {
    return kategoriler(oyunlar).some(function (k) { return k.anahtar === anahtar; }) ? anahtar : TUMU;
  }

  // ---------- Kaldığın yerden ----------
  // Depo'daki son oynanan slug listesini (en yeni başta) katalogdaki oyunlara çevirir; silinmiş oyunlar atlanır.
  function sonOynananlar(sluglar, oyunlar, sinir) {
    var sonuc = [];
    if (!Array.isArray(sluglar)) return sonuc;
    sluglar.forEach(function (slug) {
      if (sonuc.length >= (sinir || 4)) return;
      for (var i = 0; i < oyunlar.length; i++) {
        if (oyunlar[i].slug === slug && sonuc.indexOf(oyunlar[i]) === -1) { sonuc.push(oyunlar[i]); return; }
      }
    });
    return sonuc;
  }

  var Katalog = {
    YENI_GUN: YENI_GUN, TUMU: TUMU, sirala: sirala, oyunAdresi: oyunAdresi, gunBasi: gunBasi, yeniMi: yeniMi,
    kategoriAnahtari: kategoriAnahtari, kategoriler: kategoriler, suz: suz, gecerliAnahtar: gecerliAnahtar,
    sonOynananlar: sonOynananlar
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Katalog;
  else kok.Katalog = Katalog;
})(this);
