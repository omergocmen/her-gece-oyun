// 3×3 için katman katman (yeni başlayan yöntemi) çözücü. Rehber modu ve ipucu bunu kullanır.
// Tarayıcıda window.KupCozucu, Node testlerinde module.exports. KupMantik'e bağlıdır.
//
// Her aşama, bilinen kısa algoritmaları (dört yandan bakılmış hâlleriyle) ve U çevirmelerini dener;
// önceki aşamaları bozmadan hedef parçayı yerine koyan ilk diziyi seçer. Merkezler yüz hamleleriyle
// yer değiştirmediği için renkler her zaman o anki merkezlere göre okunur.
(function (kok) {
  var M = typeof module !== 'undefined' && module.exports ? require('./mantik.js') : kok.KupMantik;
  var N = 3;

  // Önden bakılan yüze göre harf eşlemesi (y ekseni etrafında tüm küpü çevirmek gibi).
  var ONLER = [
    { F: 'F', R: 'R', B: 'B', L: 'L' },
    { F: 'R', R: 'B', B: 'L', L: 'F' },
    { F: 'B', R: 'L', B: 'F', L: 'R' },
    { F: 'L', R: 'F', B: 'R', L: 'B' }
  ];

  function cevir(alg, on) {
    return alg.split(' ').map(function (p) {
      var h = p[0];
      return (on[h] || h) + p.slice(1);
    }).join(' ');
  }

  function hamleler(alg) { return alg ? M.coz(alg, N) : []; }

  function varyantlar(alg) { return ONLER.map(function (on) { return hamleler(cevir(alg, on)); }); }

  var U_ON = [[], hamleler('U'), hamleler('U2'), hamleler("U'")];

  // Konum + yüz → renk tablosu.
  function tablo(d) {
    var t = {};
    d.c.forEach(function (s) { t[s.x + ',' + s.y + ',' + s.z + ',' + M.yuzNo(s.nx, s.ny, s.nz)] = s.c; });
    return t;
  }

  function merkez(t, f) {
    var v = M.YUZ_VEKTOR[f];
    return t[v[0] * 2 + ',' + v[1] * 2 + ',' + v[2] * 2 + ',' + f];
  }

  // Konumdaki küpçüğün dışa bakan yüzleri.
  function yuzleri(p) {
    var y = [];
    if (p[0]) y.push(p[0] > 0 ? 0 : 1);
    if (p[1]) y.push(p[1] > 0 ? 2 : 3);
    if (p[2]) y.push(p[2] > 0 ? 4 : 5);
    return y;
  }

  // Parça yerinde ve doğru yönde mi?
  function yerinde(t, p) {
    return yuzleri(p).every(function (f) { return t[p.join(',') + ',' + f] === merkez(t, f); });
  }

  // Parça yerinde mi (yönü önemsiz)?
  function konumda(t, p) {
    var istenen = yuzleri(p).map(function (f) { return merkez(t, f); }).sort().join();
    var olan = yuzleri(p).map(function (f) { return t[p.join(',') + ',' + f]; }).sort().join();
    return istenen === olan;
  }

  var ARTI = [
    [0, -2, 2], [2, -2, 0], [0, -2, -2], [-2, -2, 0]
  ];
  var ALT_KOSE = [[2, -2, 2], [2, -2, -2], [-2, -2, -2], [-2, -2, 2]];
  var ORTA = [[2, 0, 2], [2, 0, -2], [-2, 0, -2], [-2, 0, 2]];
  var UST_KENAR = [[0, 2, 2], [2, 2, 0], [0, 2, -2], [-2, 2, 0]];
  var UST_KOSE = [[2, 2, 2], [2, 2, -2], [-2, 2, -2], [-2, 2, 2]];
  var ALT_IKI = ARTI.concat(ALT_KOSE, ORTA);

  function hepsiYerinde(t, liste) { return liste.every(function (p) { return yerinde(t, p); }); }

  // Aday dizilerden koşulu sağlayan ilkini bulur (isteğe bağlı olarak önce bir çıkarma dizisiyle).
  function ara(d, adaylar, kosul, cikarmalar) {
    var i, j;
    for (i = 0; i < adaylar.length; i++) {
      var k = M.hepsiniUygula(M.kopya(d), adaylar[i]);
      if (kosul(tablo(k))) return adaylar[i];
    }
    for (j = 0; j < (cikarmalar || []).length; j++) {
      var ara1 = M.hepsiniUygula(M.kopya(d), cikarmalar[j]);
      for (i = 0; i < adaylar.length; i++) {
        var k2 = M.hepsiniUygula(M.kopya(ara1), adaylar[i]);
        if (kosul(tablo(k2))) return cikarmalar[j].concat(adaylar[i]);
      }
    }
    return null;
  }

  // Makro dizilerle derinlemesine artan arama (en fazla `derinlik` makro).
  function makroAra(d, makrolar, kosul, derinlik) {
    if (kosul(tablo(d))) return [];
    var bulunan = null;
    function dfs(durum, yol, kalan) {
      if (bulunan) return;
      if (kalan === 0) { if (kosul(tablo(durum))) bulunan = yol; return; }
      for (var i = 0; i < makrolar.length && !bulunan; i++) {
        dfs(M.hepsiniUygula(M.kopya(durum), makrolar[i]), yol.concat(makrolar[i]), kalan - 1);
      }
    }
    for (var dd = 1; dd <= derinlik && !bulunan; dd++) dfs(d, [], dd);
    return bulunan;
  }

  function carp(onekler, govdeler) {
    var s = [];
    onekler.forEach(function (o) { govdeler.forEach(function (g) { s.push(o.concat(g)); }); });
    return s;
  }

  function tekrar(dizi, kez) {
    var s = [];
    for (var i = 0; i < kez; i++) s = s.concat(dizi);
    return s;
  }

  // Aşamalar: her biri Türkçe ad, açıklama ve hamle listesi döndürür.
  var ASAMALAR = [
    {
      ad: 'Alt artı',
      metin: 'Alt yüzün merkezi rengindeki dört kenarı alta getir. Her kenarın yan rengi, yanındaki merkezle aynı olmalı; böylece altta bir artı oluşur.'
    },
    {
      ad: 'Alt köşeler',
      metin: 'Alt rengini taşıyan köşeleri tek tek yerine oturt. Köşeyi yuvasının üstüne getir, sonra "R U R\' U\'" dizisini köşe oturana kadar tekrarla.'
    },
    {
      ad: 'Orta katman',
      metin: 'Üst rengi olmayan kenarları orta katmana yerleştir. Kenarı rengi eşleşen merkezin üstüne getir, sağa ya da sola indirme dizisini uygula.'
    },
    {
      ad: 'Üst artı',
      metin: 'Üstte bir artı oluştur: "F R U R\' U\' F\'" dizisi nokta, L ve çizgi şekillerini sırayla artıya çevirir.'
    },
    {
      ad: 'Üst kenarlar',
      metin: 'Üst kenarların yan renklerini merkezlerle eşleştir. "R U R\' U R U2 R\'" dizisi üç kenarı yer değiştirir.'
    },
    {
      ad: 'Üst köşelerin yeri',
      metin: 'Üst köşeleri doğru yerlerine taşı (yönleri sonra düzelecek). "U R U\' L\' U R\' U\' L" dizisi üç köşeyi döndürür.'
    },
    {
      ad: 'Üst köşelerin yönü',
      metin: 'Köşeleri çevirerek bitir. Sağ önde üstteki köşe için "R\' D\' R D" dizisini üst rengi yukarı bakana kadar tekrarla, sonra U ile sıradakini getir. Arada alt katman bozulur; korkma, sonunda düzelir.'
    }
  ];

  function coz(baslangic) {
    if (baslangic.n !== N) throw new Error('Çözücü yalnızca 3×3 içindir');
    var d = M.kopya(baslangic);
    var adimlar = ASAMALAR.map(function (a) { return { ad: a.ad, metin: a.metin, hamleler: [] }; });
    var basarili = true;

    function ekle(i, dizi) {
      if (!dizi) { basarili = false; return; }
      M.hepsiniUygula(d, dizi);
      adimlar[i].hamleler = adimlar[i].hamleler.concat(dizi);
    }

    var yanIkiKez = ['R2', 'L2', 'F2', 'B2'].map(hamleler);
    var cevirmeli = varyantlar("U' R' F R");

    // 1. Alt artı
    var cozulen = [];
    ARTI.forEach(function (p) {
      if (!basarili) return;
      var onceki = cozulen.slice();
      var kosul = function (t) { return hepsiYerinde(t, onceki) && yerinde(t, p); };
      var adaylar = [[]].concat(carp(U_ON, yanIkiKez), carp(U_ON, cevirmeli));
      var cikarmalar = yanIkiKez.concat(varyantlar("R U R'"), varyantlar("R' U R"), varyantlar("F U F'"), varyantlar("F' U F"));
      ekle(0, ara(d, adaylar, kosul, cikarmalar));
      cozulen.push(p);
    });

    // 2. Alt köşeler
    var seksi = varyantlar("R U R' U'");
    ALT_KOSE.forEach(function (p) {
      if (!basarili) return;
      var onceki = cozulen.slice();
      var kosul = function (t) { return hepsiYerinde(t, onceki) && yerinde(t, p); };
      var govdeler = [];
      seksi.forEach(function (s) { for (var kez = 1; kez <= 5; kez++) govdeler.push(tekrar(s, kez)); });
      var adaylar = [[]].concat(carp(U_ON, govdeler));
      ekle(1, ara(d, adaylar, kosul, seksi));
      cozulen.push(p);
    });

    // 3. Orta katman
    var saga = varyantlar("U R U' R' U' F' U F");
    var sola = varyantlar("U' L' U L U F U' F'");
    ORTA.forEach(function (p) {
      if (!basarili) return;
      var onceki = cozulen.slice();
      var kosul = function (t) { return hepsiYerinde(t, onceki) && yerinde(t, p); };
      var adaylar = [[]].concat(carp(U_ON, saga.concat(sola)));
      ekle(2, ara(d, adaylar, kosul, saga));
      cozulen.push(p);
    });

    // 4. Üst artı (kenar yönleri)
    if (basarili) {
      var ustArti = function (t) {
        var u = merkez(t, 2);
        return hepsiYerinde(t, ALT_IKI) && UST_KENAR.every(function (p) { return t[p.join(',') + ',2'] === u; });
      };
      ekle(3, makroAra(d, varyantlar("F R U R' U' F'").concat(varyantlar("F U R U' R' F'")), ustArti, 3));
    }

    // 5. Üst kenarların yeri
    if (basarili) {
      var kenarlar = function (t) { return hepsiYerinde(t, ALT_IKI.concat(UST_KENAR)); };
      var makro5 = U_ON.slice(1).concat(varyantlar("R U R' U R U2 R'"));
      ekle(4, makroAra(d, makro5, kenarlar, 5));
    }

    // 6. Üst köşelerin yeri
    if (basarili) {
      var koseYeri = function (t) {
        return hepsiYerinde(t, ALT_IKI.concat(UST_KENAR)) && UST_KOSE.every(function (p) { return konumda(t, p); });
      };
      ekle(5, makroAra(d, varyantlar("U R U' L' U R' U' L"), koseYeri, 3));
    }

    // 7. Üst köşelerin yönü: sağ ön üst köşeyi R' D' R D ile çevir, U ile sıradakine geç.
    if (basarili) {
      var rdrd = hamleler("R' D' R D");
      var dizi = [];
      var k = M.kopya(d);
      for (var i = 0; i < 4; i++) {
        var guvenlik = 0;
        while (tablo(k)['2,2,2,2'] !== merkez(tablo(k), 2) && guvenlik++ < 3) {
          M.hepsiniUygula(k, rdrd.concat(rdrd));
          dizi = dizi.concat(rdrd, rdrd);
        }
        M.hepsiniUygula(k, U_ON[1]);
        dizi = dizi.concat(U_ON[1]);
      }
      var son = null;
      for (var j = 0; j < 4; j++) {
        if (M.cozulduMu(M.hepsiniUygula(M.kopya(k), U_ON[j]))) { son = U_ON[j]; break; }
      }
      ekle(6, son ? dizi.concat(son) : null);
    }

    adimlar.forEach(function (a) { a.hamleler = M.sadelestir(a.hamleler); });
    var hepsi = [];
    adimlar.forEach(function (a) { hepsi = hepsi.concat(a.hamleler); });
    return { basarili: basarili && M.cozulduMu(d), adimlar: adimlar, hamleler: hepsi };
  }

  var KupCozucu = { coz: coz, ASAMALAR: ASAMALAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = KupCozucu;
  else kok.KupCozucu = KupCozucu;
})(this);
