// Sudoku mantığı: üretici (tohumlu, tek çözümlü), çözücü, teknik düzeyine göre zorluk ve Türkçe ipucu.
// Tarayıcıda window.SudokuMantik, Web Worker'da self.SudokuMantik, Node testlerinde module.exports.
//
// Izgara 81 elemanlı dizidir (0 boş, 1-9 rakam), satır satır: kutu = satır * 9 + sütun.
(function (kok) {
  'use strict';

  var SEVIYELER = ['kolay', 'orta', 'zor', 'uzman'];
  var SEVIYE_AD = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor', uzman: 'Uzman' };
  // Bir seviyenin gerektirdiği en ileri teknik düzeyi (uzman: 4 ve üstü, mantıkla çözülemeyebilir).
  var SEVIYE_DUZEY = { kolay: 1, orta: 2, zor: 3, uzman: 4 };
  var IPUCU_HAKKI = { kolay: 5, orta: 4, zor: 3, uzman: 2 };
  // Üretici bu ipucu sayısına inince (daha fazla kutu boşaltmayı bırakır) durur; uzman olabildiğince boşaltır.
  var HEDEF_IPUCU = { kolay: 40, orta: 34, zor: 0, uzman: 0 };
  // Haftanın günü (0 pazar) → günlük bulmaca seviyesi: hafta başı kolay, sonu zor.
  var GUN_SEVIYESI = ['uzman', 'kolay', 'kolay', 'orta', 'orta', 'zor', 'zor'];

  // ---------- Birimler ve akranlar ----------
  var BIRIMLER = [], BIRIM_TUR = [], BIRIM_NO = [];
  var i, j, k;
  for (i = 0; i < 9; i++) { var sat = [], sut = [], blk = []; for (j = 0; j < 9; j++) { sat.push(i * 9 + j); sut.push(j * 9 + i); blk.push((Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + (j % 3)); } BIRIMLER.push(sat); BIRIM_TUR.push(0); BIRIM_NO.push(i); }
  for (i = 0; i < 9; i++) { var s2 = []; for (j = 0; j < 9; j++) s2.push(j * 9 + i); BIRIMLER.push(s2); BIRIM_TUR.push(1); BIRIM_NO.push(i); }
  for (i = 0; i < 9; i++) { var b2 = []; for (j = 0; j < 9; j++) b2.push((Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + (j % 3)); BIRIMLER.push(b2); BIRIM_TUR.push(2); BIRIM_NO.push(i); }
  // BIRIMLER[0..8] satırlar, [9..17] sütunlar, [18..26] bloklar. (İlk döngüdeki 'blk' kullanılmaz.)
  var KUTU_BIRIM = []; // kutu → [satır birimi, sütun birimi, blok birimi]
  var AKRAN = [];
  for (i = 0; i < 81; i++) {
    var r = Math.floor(i / 9), c = i % 9;
    KUTU_BIRIM.push([r, 9 + c, 18 + Math.floor(r / 3) * 3 + Math.floor(c / 3)]);
    var set = {};
    KUTU_BIRIM[i].forEach(function (u) { BIRIMLER[u].forEach(function (x) { if (x !== i) set[x] = true; }); });
    AKRAN.push(Object.keys(set).map(Number));
  }
  var BIT = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256];
  function say(m) { var n = 0; while (m) { m &= m - 1; n++; } return n; }
  function tekRakam(m) { return say(m) === 1 ? Math.round(Math.log2(m)) + 1 : 0; }

  // ---------- Rastgele sayı (tohumlu, her cihazda aynı) ----------
  function tohumdan(metin) {
    var h = 1779033703 ^ metin.length;
    for (var x = 0; x < metin.length; x++) { h = Math.imul(h ^ metin.charCodeAt(x), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    var a = h >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function karistir(dizi, rnd) {
    for (var x = dizi.length - 1; x > 0; x--) { var y = Math.floor(rnd() * (x + 1)); var t = dizi[x]; dizi[x] = dizi[y]; dizi[y] = t; }
    return dizi;
  }

  // ---------- Geri izlemeli çözücü (çözüm sayar) ----------
  // sinir: bu kadar çözüm bulununca durur. rnd verilirse rakam sırası karışır (rastgele dolu ızgara için).
  function cozumleriSay(izgara, sinir, rnd) {
    var v = izgara.slice(), satirM = new Int16Array(9), sutunM = new Int16Array(9), blokM = new Int16Array(9), adet = 0, ilk = null;
    for (var x = 0; x < 81; x++) if (v[x]) {
      var bit = BIT[v[x]], rr = Math.floor(x / 9), cc = x % 9, bb = Math.floor(rr / 3) * 3 + Math.floor(cc / 3);
      if ((satirM[rr] | sutunM[cc] | blokM[bb]) & bit) return { adet: 0, cozum: null };
      satirM[rr] |= bit; sutunM[cc] |= bit; blokM[bb] |= bit;
    }
    function ara() {
      var en = -1, enMask = 0, enSay = 10;
      for (var q = 0; q < 81; q++) {
        if (v[q]) continue;
        var rr = Math.floor(q / 9), cc = q % 9, bb = Math.floor(rr / 3) * 3 + Math.floor(cc / 3);
        var m = ~(satirM[rr] | sutunM[cc] | blokM[bb]) & 511, n = say(m);
        if (n < enSay) { enSay = n; en = q; enMask = m; if (n <= 1) break; }
      }
      if (en < 0) { adet++; if (!ilk) ilk = v.slice(); return adet >= sinir; }
      if (!enMask) return false;
      var rd = Math.floor(en / 9), cd = en % 9, bd = Math.floor(rd / 3) * 3 + Math.floor(cd / 3);
      var rakamlar = [];
      for (var d = 1; d <= 9; d++) if (enMask & BIT[d]) rakamlar.push(d);
      if (rnd) karistir(rakamlar, rnd);
      for (var t = 0; t < rakamlar.length; t++) {
        var dd = rakamlar[t], bt = BIT[dd];
        v[en] = dd; satirM[rd] |= bt; sutunM[cd] |= bt; blokM[bd] |= bt;
        var dur = ara();
        v[en] = 0; satirM[rd] &= ~bt; sutunM[cd] &= ~bt; blokM[bd] &= ~bt;
        if (dur) return true;
      }
      return false;
    }
    ara();
    return { adet: adet, cozum: ilk };
  }

  // ---------- Mantıksal çözücü ----------
  // Teknik düzeyleri: 1 tek aday · 2 gizli tek · 3 çıplak çift, kutu-çizgi · 4 gizli çift, X-Wing.
  var TEKNIK_AD = { 'tek-aday': 'Tek aday', 'gizli-tek': 'Gizli tek', cift: 'Çıplak çift', 'kutu-cizgi': 'Kutu-çizgi', 'gizli-cift': 'Gizli çift', 'x-wing': 'X-Wing', deneme: 'Deneme' };
  var TEKNIK_DUZEY = { 'tek-aday': 1, 'gizli-tek': 2, cift: 3, 'kutu-cizgi': 3, 'gizli-cift': 4, 'x-wing': 4, deneme: 5 };

  function Durum(izgara) {
    this.v = new Int8Array(81); this.c = new Int16Array(81).fill(511);
    for (var x = 0; x < 81; x++) if (izgara[x]) this.koy(x, izgara[x]);
    this.cakisma = false;
  }
  Durum.prototype.koy = function (x, d) {
    this.v[x] = d; this.c[x] = 0;
    var bit = BIT[d], ak = AKRAN[x];
    for (var q = 0; q < ak.length; q++) this.c[ak[q]] &= ~bit;
  };
  // Boş kutunun adayı kalmadıysa ızgara çelişkilidir.
  Durum.prototype.cikmaz = function () { for (var x = 0; x < 81; x++) if (!this.v[x] && !this.c[x]) return true; return false; };

  // Her teknik bir adım döndürür ({ teknik, kutu, rakam } yerleştirme ya da { teknik, elenen:[[kutu, rakam]] } eleme) ya da null.
  function tekAday(S) {
    for (var x = 0; x < 81; x++) if (!S.v[x]) { var d = tekRakam(S.c[x]); if (d) return { teknik: 'tek-aday', kutu: x, rakam: d }; }
    return null;
  }
  function gizliTek(S) {
    for (var u = 0; u < 27; u++) {
      for (var d = 1; d <= 9; d++) {
        var yer = -1, n = 0, unite = BIRIMLER[u];
        for (var q = 0; q < 9; q++) { var x = unite[q]; if (!S.v[x] && (S.c[x] & BIT[d])) { n++; yer = x; if (n > 1) break; } }
        if (n === 1) return { teknik: 'gizli-tek', kutu: yer, rakam: d, birim: u };
      }
    }
    return null;
  }
  function ciftCiplak(S) {
    for (var u = 0; u < 27; u++) {
      var unite = BIRIMLER[u];
      for (var a = 0; a < 9; a++) {
        var xa = unite[a]; if (S.v[xa] || say(S.c[xa]) !== 2) continue;
        for (var b = a + 1; b < 9; b++) {
          var xb = unite[b]; if (S.c[xb] !== S.c[xa] || S.v[xb]) continue;
          var elenen = [];
          for (var q = 0; q < 9; q++) {
            var x = unite[q]; if (x === xa || x === xb || S.v[x]) continue;
            var ortak = S.c[x] & S.c[xa];
            for (var d = 1; d <= 9; d++) if (ortak & BIT[d]) elenen.push([x, d]);
          }
          if (elenen.length) return { teknik: 'cift', elenen: elenen, birim: u, kutular: [xa, xb], rakamlar: [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(function (d) { return S.c[xa] & BIT[d]; }) };
        }
      }
    }
    return null;
  }
  function kutuCizgi(S) {
    for (var d = 1; d <= 9; d++) {
      var bit = BIT[d];
      // işaretçi: bloktaki adaylar tek satır/sütunda → o satır/sütunun blok dışını ele
      for (var bl = 18; bl < 27; bl++) {
        var yerler = BIRIMLER[bl].filter(function (x) { return !S.v[x] && (S.c[x] & bit); });
        if (yerler.length < 2) continue;
        for (var tur = 0; tur < 2; tur++) {
          var u = KUTU_BIRIM[yerler[0]][tur], hepsi = yerler.every(function (x) { return KUTU_BIRIM[x][tur] === u; });
          if (!hepsi) continue;
          var elenen = BIRIMLER[u].filter(function (x) { return KUTU_BIRIM[x][2] !== bl && !S.v[x] && (S.c[x] & bit); }).map(function (x) { return [x, d]; });
          if (elenen.length) return { teknik: 'kutu-cizgi', elenen: elenen, birim: bl, hedefBirim: u, rakam: d, yon: 'isaretci' };
        }
      }
      // sahiplenme: satır/sütundaki adaylar tek blokta → bloğun satır/sütun dışını ele
      for (var u2 = 0; u2 < 18; u2++) {
        var yer2 = BIRIMLER[u2].filter(function (x) { return !S.v[x] && (S.c[x] & bit); });
        if (yer2.length < 2) continue;
        var bl2 = KUTU_BIRIM[yer2[0]][2];
        if (!yer2.every(function (x) { return KUTU_BIRIM[x][2] === bl2; })) continue;
        var elenen2 = BIRIMLER[bl2].filter(function (x) { return KUTU_BIRIM[x][u2 < 9 ? 0 : 1] !== u2 && !S.v[x] && (S.c[x] & bit); }).map(function (x) { return [x, d]; });
        if (elenen2.length) return { teknik: 'kutu-cizgi', elenen: elenen2, birim: u2, hedefBirim: bl2, rakam: d, yon: 'sahiplenme' };
      }
    }
    return null;
  }
  function gizliCift(S) {
    for (var u = 0; u < 27; u++) {
      var unite = BIRIMLER[u], yerler = {};
      for (var d = 1; d <= 9; d++) yerler[d] = unite.filter(function (x) { return !S.v[x] && (S.c[x] & BIT[d]); });
      for (var d1 = 1; d1 <= 9; d1++) {
        if (yerler[d1].length !== 2) continue;
        for (var d2 = d1 + 1; d2 <= 9; d2++) {
          if (yerler[d2].length !== 2 || yerler[d1][0] !== yerler[d2][0] || yerler[d1][1] !== yerler[d2][1]) continue;
          var elenen = [], tut = BIT[d1] | BIT[d2];
          yerler[d1].forEach(function (x) { for (var d = 1; d <= 9; d++) if ((S.c[x] & BIT[d]) && !(tut & BIT[d])) elenen.push([x, d]); });
          if (elenen.length) return { teknik: 'gizli-cift', elenen: elenen, birim: u, kutular: yerler[d1].slice(), rakamlar: [d1, d2] };
        }
      }
    }
    return null;
  }
  function xWing(S) {
    for (var d = 1; d <= 9; d++) {
      var bit = BIT[d];
      for (var tur = 0; tur < 2; tur++) { // 0: satır tabanlı, 1: sütun tabanlı
        var aday = [];
        for (var a = 0; a < 9; a++) {
          var unite = BIRIMLER[tur * 9 + a], yer = [];
          for (var q = 0; q < 9; q++) if (!S.v[unite[q]] && (S.c[unite[q]] & bit)) yer.push(q);
          aday.push(yer);
        }
        for (var a1 = 0; a1 < 9; a1++) {
          if (aday[a1].length !== 2) continue;
          for (var a2 = a1 + 1; a2 < 9; a2++) {
            if (aday[a2].length !== 2 || aday[a2][0] !== aday[a1][0] || aday[a2][1] !== aday[a1][1]) continue;
            var elenen = [];
            aday[a1].forEach(function (q) {
              var diger = BIRIMLER[(1 - tur) * 9 + q];
              for (var t = 0; t < 9; t++) {
                var x = diger[t], sat = tur === 0 ? Math.floor(x / 9) : x % 9;
                if (sat !== a1 && sat !== a2 && !S.v[x] && (S.c[x] & bit)) elenen.push([x, d]);
              }
            });
            if (elenen.length) return { teknik: 'x-wing', elenen: elenen, rakam: d, tur: tur, hatlar: [a1, a2], kesisenler: aday[a1].slice() };
          }
        }
      }
    }
    return null;
  }
  var TEKNIKLER = [tekAday, gizliTek, ciftCiplak, kutuCizgi, gizliCift, xWing];

  function adimUygula(S, adim) {
    if (adim.elenen) adim.elenen.forEach(function (e) { S.c[e[0]] &= ~BIT[e[1]]; });
    else S.koy(adim.kutu, adim.rakam);
  }
  // Mantıkla çözer. enYuksek: kullanılabilecek en ileri teknik düzeyi. Döner: { cozuldu, duzey (kullanılan en ileri), adimlar }.
  function mantikla(izgara, enYuksek, adimTut) {
    var S = new Durum(izgara), duzey = 0, adimlar = [];
    for (;;) {
      var bos = 0; for (var x = 0; x < 81; x++) if (!S.v[x]) bos++;
      if (!bos) return { cozuldu: true, duzey: duzey, adimlar: adimlar, durum: S };
      if (S.cikmaz()) return { cozuldu: false, duzey: duzey, adimlar: adimlar, durum: S };
      var adim = null;
      for (var t = 0; t < TEKNIKLER.length && !adim; t++) {
        adim = TEKNIKLER[t](S);
        if (adim && TEKNIK_DUZEY[adim.teknik] > enYuksek) adim = null;
      }
      if (!adim) return { cozuldu: false, duzey: duzey, adimlar: adimlar, durum: S };
      duzey = Math.max(duzey, TEKNIK_DUZEY[adim.teknik]);
      if (adimTut) adimlar.push(adim);
      adimUygula(S, adim);
    }
  }
  // Bir bulmacanın seviyesi: gereken en düşük teknik düzeyi (4'ün üstü ya da mantıkla çözülemeyen: uzman).
  function seviyeBul(izgara) {
    for (var d = 1; d <= 4; d++) if (mantikla(izgara, d).cozuldu) return SEVIYELER[d - 1];
    return 'uzman';
  }

  // ---------- Üretici ----------
  function doluIzgara(rnd) { return cozumleriSay(new Array(81).fill(0), 1, rnd).cozum; }

  // Tohumdan (metin) ve seviyeden tek çözümlü bulmaca üretir: { bulmaca, cozum, seviye } (iki dizi 81 rakam).
  function uret(tohum, seviye) {
    if (!SEVIYE_DUZEY[seviye]) seviye = 'orta';
    var rnd, tavan = SEVIYE_DUZEY[seviye], hedef = HEDEF_IPUCU[seviye];
    var enIyi = null;
    // Süreye değil deneme sayısına bağlıdır: aynı tohum her cihazda aynı bulmacayı verir. Tutmayan denemede yeni ızgara kurulur.
    for (var deneme = 0; deneme < 60; deneme++) {
      rnd = tohumdan(String(tohum) + '|' + seviye + '|' + deneme);
      var cozum = doluIzgara(rnd), p = cozum.slice(), sira = [], ipucu = 81;
      for (var x = 0; x < 41; x++) sira.push(x); // 0..39 çiftleri + merkez (180° dönme simetrisi)
      karistir(sira, rnd);
      for (var t = 0; t < sira.length && ipucu > hedef; t++) {
        var a = sira[t], b = 80 - a, ya = p[a], yb = p[b];
        if (!ya && !yb) continue;
        p[a] = 0; p[b] = 0;
        var sayim = a === b ? 1 : 2, tamam = true;
        if (cozumleriSay(p, 2).adet !== 1) tamam = false;
        else if (seviye !== 'uzman' && !mantikla(p, tavan).cozuldu) tamam = false;
        if (tamam) ipucu -= sayim; else { p[a] = ya; p[b] = yb; }
      }
      var gercek = seviyeBul(p);
      var sonuc = { bulmaca: p, cozum: cozum, seviye: gercek };
      if (gercek === seviye) return sonuc;
      // uzman değilse düzey çok düşükse (ör. orta isterken kolay), yeniden dene; en yakın sonucu sakla
      if (!enIyi || Math.abs(SEVIYELER.indexOf(gercek) - SEVIYELER.indexOf(seviye)) < Math.abs(SEVIYELER.indexOf(enIyi.seviye) - SEVIYELER.indexOf(seviye))) enIyi = sonuc;
    }
    return enIyi;
  }

  // Günün bulmacası: yerel gün anahtarından ('YYYY-AA-GG') tohum ve haftanın gününe göre seviye.
  function gunSeviyesi(gunAnahtari) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(gunAnahtari);
    if (!p) return 'orta';
    return GUN_SEVIYESI[new Date(Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3]))).getUTCDay()];
  }
  function gunlukUret(gunAnahtari) { return uret('gunluk-' + gunAnahtari, gunSeviyesi(gunAnahtari)); }

  // ---------- Denetim ----------
  // Aynı birimde tekrar eden rakamları taşıyan kutular (kural ihlali).
  function cakisanlar(izgara) {
    var kotu = {};
    for (var u = 0; u < 27; u++) {
      var gor = {};
      BIRIMLER[u].forEach(function (x) {
        var d = izgara[x]; if (!d) return;
        (gor[d] = gor[d] || []).push(x);
      });
      Object.keys(gor).forEach(function (d) { if (gor[d].length > 1) gor[d].forEach(function (x) { kotu[x] = true; }); });
    }
    return Object.keys(kotu).map(Number).sort(function (a, b) { return a - b; });
  }
  function adaylar(izgara) { var S = new Durum(izgara); return Array.prototype.slice.call(S.c); }

  // ---------- Türkçe ipucu ----------
  var EK = { 1: 'in', 2: 'nin', 3: 'ün', 4: 'ün', 5: 'in', 6: 'nın', 7: 'nin', 8: 'in', 9: 'un' };
  var BIRIM_ADI = ['satırda', 'sütunda', 'blokta'];
  var BIRIM_ADI_YALIN = ['satır', 'sütun', 'blok'];
  function rakamEki(d) { return d + "'" + EK[d]; }

  // Verilen ızgara (verilenler + oyuncunun girdileri) ve çözümle bir sonraki mantıksal yerleştirmeyi anlatır.
  // Döner: { kutu, rakam, teknik, aciklama, birim (vurgulanacak birim ya da -1), onceki ([teknik adları]) } ya da
  // oyuncunun yanlış rakamı varsa { yanlis: kutu, aciklama }.
  function ipucuBul(izgara, cozum) {
    for (var x = 0; x < 81; x++) if (izgara[x] && izgara[x] !== cozum[x]) return { yanlis: x, aciklama: 'Bu kutudaki rakam yanlış görünüyor. Silip yeniden dene.' };
    var S = new Durum(izgara), onceki = [];
    for (var tur = 0; tur < 400; tur++) {
      var bos = 0; for (var q = 0; q < 81; q++) if (!S.v[q]) bos++;
      if (!bos) return null;
      var adim = null;
      for (var t = 0; t < TEKNIKLER.length && !adim; t++) adim = TEKNIKLER[t](S);
      if (!adim) break;
      if (adim.elenen) { onceki.push(TEKNIK_AD[adim.teknik]); adimUygula(S, adim); continue; }
      return ipucuAnlat(adim, onceki);
    }
    // Mantıkla ilerlenemiyorsa en az adaylı kutunun doğru rakamını söyler.
    var en = -1, enSay = 10;
    for (var y = 0; y < 81; y++) if (!izgara[y]) { var n = say(adaylar(izgara)[y]); if (n < enSay) { enSay = n; en = y; } }
    if (en < 0) return null;
    return { kutu: en, rakam: cozum[en], teknik: 'deneme', birim: -1, onceki: onceki, aciklama: 'Mantıkla ilerlemek zor. Bu kutunun cevabı ' + cozum[en] + ' (deneme gerektirebilir).' };
  }
  function ipucuAnlat(adim, onceki) {
    var ek = onceki.length ? 'Elemeler (' + onceki.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + ') sonrası ' : '';
    var metin, birim = -1;
    if (adim.teknik === 'tek-aday') metin = ek ? ek + 'bu kutuda tek aday kalıyor: ' + adim.rakam + '.' : 'Bu kutuda tek aday var: ' + adim.rakam + '.';
    else {
      birim = adim.birim;
      var ad = BIRIM_ADI[BIRIM_TUR[adim.birim]];
      metin = (ek ? ek + 'bu ' + ad : 'Bu ' + ad).replace(/^bu /, 'bu ') + ' ' + rakamEki(adim.rakam) + ' yeri tek bir kutu.';
      metin = metin.charAt(0).toUpperCase() + metin.slice(1);
    }
    return { kutu: adim.kutu, rakam: adim.rakam, teknik: adim.teknik, birim: birim, onceki: onceki, aciklama: metin };
  }

  var Mantik = {
    SEVIYELER: SEVIYELER, SEVIYE_AD: SEVIYE_AD, IPUCU_HAKKI: IPUCU_HAKKI, TEKNIK_AD: TEKNIK_AD, BIRIMLER: BIRIMLER, AKRAN: AKRAN, KUTU_BIRIM: KUTU_BIRIM,
    uret: uret, gunlukUret: gunlukUret, gunSeviyesi: gunSeviyesi, seviyeBul: seviyeBul, mantikla: mantikla, cozumleriSay: cozumleriSay,
    cakisanlar: cakisanlar, adaylar: adaylar, ipucuBul: ipucuBul, tohumdan: tohumdan, rakamEki: rakamEki
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Mantik;
  else kok.SudokuMantik = Mantik;
})(typeof self !== 'undefined' ? self : this);
