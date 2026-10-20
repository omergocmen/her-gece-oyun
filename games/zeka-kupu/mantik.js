// Zekâ Küpü'nün saf küp modeli: tarayıcıda window.KupMantik, Node testlerinde module.exports.
//
// Küp N×N×N; her çıkartma bir küpçüğün merkezindeki konumu (p) ve baktığı yüz (n) ile tutulur.
// Konumlar çift tamsayıdır: N=3 için -2, 0, 2; N=4 için -3, -1, 1, 3. Böylece tek ve çift boyutlar
// aynı kodla çalışır. Hamle { a: eksen (0=x, 1=y, 2=z), k: katman koordinatı, d: +1/-1 } biçimindedir:
// p[a] === k olan katman, +a ekseni etrafında d × 90° (sağ el kuralı) döner.
(function (kok) {
  var BOYUTLAR = [2, 3, 4];
  var BASLANGIC = Date.UTC(2026, 9, 20); // 20 Ekim 2026: 1 numaralı günlük karıştırma
  // Yüz sırası: 0:+x (R), 1:-x (L), 2:+y (U), 3:-y (D), 4:+z (F), 5:-z (B)
  var YUZ_VEKTOR = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  // Çözülmüş küpte yüz renkleri (renk sırası tasarım notundaki gibi): U kemik, D sodyum, R kor, L turkuaz, F yaprak, B İznik mavisi.
  // Renk numaraları: 0 kemik, 1 sodyum, 2 kor, 3 yaprak, 4 İznik mavisi, 5 turkuaz
  var YUZ_RENGI = [2, 5, 0, 1, 3, 4];
  var HARF_YUZ = { R: 0, L: 1, U: 2, D: 3, F: 4, B: 5 };
  var YUZ_HARF = ['R', 'L', 'U', 'D', 'F', 'B'];

  function yuzNo(nx, ny, nz) {
    if (nx) return nx > 0 ? 0 : 1;
    if (ny) return ny > 0 ? 2 : 3;
    return nz > 0 ? 4 : 5;
  }

  // Vektörü a ekseni etrafında d × 90° döndürür.
  function dondur(x, y, z, a, d) {
    if (a === 0) return d > 0 ? [x, -z, y] : [x, z, -y];
    if (a === 1) return d > 0 ? [z, y, -x] : [-z, y, x];
    return d > 0 ? [-y, x, z] : [y, -x, z];
  }

  function cozulmus(n) {
    var m = n - 1, c = [];
    for (var x = -m; x <= m; x += 2) {
      for (var y = -m; y <= m; y += 2) {
        for (var z = -m; z <= m; z += 2) {
          for (var f = 0; f < 6; f++) {
            var v = YUZ_VEKTOR[f];
            if (v[0] * x + v[1] * y + v[2] * z === m) {
              c.push({ x: x, y: y, z: z, nx: v[0], ny: v[1], nz: v[2], c: YUZ_RENGI[f] });
            }
          }
        }
      }
    }
    return { n: n, c: c };
  }

  function kopya(durum) {
    return { n: durum.n, c: durum.c.map(function (s) { return { x: s.x, y: s.y, z: s.z, nx: s.nx, ny: s.ny, nz: s.nz, c: s.c }; }) };
  }

  // Hamleyi yerinde uygular.
  function uygula(durum, h) {
    var c = durum.c;
    for (var i = 0; i < c.length; i++) {
      var s = c[i];
      var deger = h.a === 0 ? s.x : h.a === 1 ? s.y : s.z;
      if (deger !== h.k) continue;
      var p = dondur(s.x, s.y, s.z, h.a, h.d);
      var q = dondur(s.nx, s.ny, s.nz, h.a, h.d);
      s.x = p[0]; s.y = p[1]; s.z = p[2];
      s.nx = q[0]; s.ny = q[1]; s.nz = q[2];
    }
    return durum;
  }

  function hepsiniUygula(durum, hamleler) {
    for (var i = 0; i < hamleler.length; i++) uygula(durum, hamleler[i]);
    return durum;
  }

  function ters(h) { return { a: h.a, k: h.k, d: -h.d }; }

  function tersDizi(hamleler) { return hamleler.slice().reverse().map(ters); }

  // Her yüzün tüm çıkartmaları aynı renkteyse küp çözülmüştür (orta katman döndürülse bile).
  function cozulduMu(durum) {
    var renk = [-1, -1, -1, -1, -1, -1];
    for (var i = 0; i < durum.c.length; i++) {
      var s = durum.c[i];
      var f = yuzNo(s.nx, s.ny, s.nz);
      if (renk[f] === -1) renk[f] = s.c;
      else if (renk[f] !== s.c) return false;
    }
    return true;
  }

  // Durumu karşılaştırılabilir metne çevirir (testler ve kayıt için).
  function imza(durum) {
    return durum.c.map(function (s) { return [s.x, s.y, s.z, yuzNo(s.nx, s.ny, s.nz), s.c].join(','); }).sort().join(';');
  }

  // Yüz hamlesi: "R", "U'", "F2" gibi. N boyutunda dış katmanı döndürür.
  function yuzHamlesi(harf, n, ust) {
    var f = HARF_YUZ[harf];
    var v = YUZ_VEKTOR[f];
    var a = v[0] ? 0 : v[1] ? 1 : 2;
    var isaret = v[a];
    // Saat yönü (yüze bakarken) = yüz normali etrafında -90°.
    var d = -isaret * (ust === "'" ? -1 : 1);
    return { a: a, k: isaret * (n - 1), d: d };
  }

  // "R U R' U2" → çeyrek hamle listesi (2 → iki çeyrek).
  function coz(metin, n) {
    var sonuc = [];
    metin.trim().split(/\s+/).forEach(function (parca) {
      if (!parca) return;
      var harf = parca[0];
      if (!(harf in HARF_YUZ)) throw new Error('Bilinmeyen hamle: ' + parca);
      var ek = parca.slice(1);
      var h = yuzHamlesi(harf, n, ek === "'" ? "'" : '');
      sonuc.push(h);
      if (ek === '2') sonuc.push({ a: h.a, k: h.k, d: h.d });
    });
    return sonuc;
  }

  // Aynı katmandaki ardışık hamleleri birleştirir: R R → R2 (iki çeyrek), R R' → hiç.
  function sadelestir(hamleler) {
    var yigin = []; // { a, k, t } t: -1, 1, 2
    hamleler.forEach(function (h) {
      var son = yigin[yigin.length - 1];
      if (son && son.a === h.a && son.k === h.k) {
        var t = (((son.t + h.d) % 4) + 4) % 4;
        if (t === 0) yigin.pop();
        else son.t = t === 3 ? -1 : t;
      } else {
        yigin.push({ a: h.a, k: h.k, t: h.d });
      }
    });
    var sonuc = [];
    yigin.forEach(function (g) {
      if (g.t === 2) { sonuc.push({ a: g.a, k: g.k, d: 1 }); sonuc.push({ a: g.a, k: g.k, d: 1 }); }
      else sonuc.push({ a: g.a, k: g.k, d: g.t });
    });
    return sonuc;
  }

  // Tohumlu, deterministik rastgele sayı üreteci (mulberry32).
  function uretec(tohum) {
    var a = tohum >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var KARISTIRMA_UZUNLUK = { 2: 11, 3: 22, 4: 40 };

  // Geçerli hamlelerden oluşan karıştırma: her zaman çözülebilir. Aynı eksende arka arkaya hamle yok.
  // Dönüş: çeyrek hamle listesi (yarım dönüşler iki çeyrek olarak).
  function karistir(n, rastgele) {
    var m = n - 1;
    var katmanlar = [];
    for (var k = -m; k <= m; k += 2) katmanlar.push(k);
    // 2×2'de karşı yüzü döndürmek tüm küpü çevirmekle aynı: yalnızca R, U, F.
    if (n === 2) katmanlar = [m];
    // 3×3'te orta katman karıştırmaya girmez (merkezler yerinde kalır).
    if (n === 3) katmanlar = [-m, m];
    var sonuc = [], oncekiEksen = -1;
    for (var i = 0; i < KARISTIRMA_UZUNLUK[n]; i++) {
      var a;
      do { a = Math.floor(rastgele() * 3); } while (a === oncekiEksen);
      oncekiEksen = a;
      var kk = katmanlar[Math.floor(rastgele() * katmanlar.length)];
      var tur = Math.floor(rastgele() * 3); // 0: +90, 1: -90, 2: 180
      if (tur === 2) { sonuc.push({ a: a, k: kk, d: 1 }); sonuc.push({ a: a, k: kk, d: 1 }); }
      else sonuc.push({ a: a, k: kk, d: tur === 0 ? 1 : -1 });
    }
    return sonuc;
  }

  // Yerel takvim gününe göre günlük karıştırma numarası (1'den başlar); yaz saatinden etkilenmez.
  function gunNo(tarih) {
    var gun = Date.UTC(tarih.getFullYear(), tarih.getMonth(), tarih.getDate());
    return Math.floor((gun - BASLANGIC) / 86400000) + 1;
  }

  // Günün karıştırması: aynı gün ve boyut için herkese aynı.
  function gununKaristirmasi(no, n) {
    return karistir(n, uretec(no * 2654435761 + n * 97));
  }

  // Hamle adı. Görünüm haritası: { R: yüzNo, U: yüzNo, F: yüzNo, ... } yani ekranda sağda/üstte/önde
  // duran dünya yüzleri. Verilmezse sabit eksenler kullanılır.
  function hamleAdi(h, n, gorunum) {
    var m = n - 1;
    // Hamlenin eksen vektörünü görünüm yüzlerinden birine eşle.
    var arti = h.a * 2; // +a yüzü (0, 2, 4)
    var harf = null, isaret = 1;
    var harfler = gorunum ? Object.keys(gorunum) : YUZ_HARF;
    for (var i = 0; i < harfler.length; i++) {
      var hf = harfler[i];
      var yuz = gorunum ? gorunum[hf] : HARF_YUZ[hf];
      if (yuz === arti) { harf = hf; isaret = 1; break; }
      if (yuz === arti + 1) { harf = hf; isaret = -1; break; }
    }
    // harf yüzünün dış katman koordinatı isaret*m; katman o yüzden kaçıncı?
    var yerel = h.k * isaret; // harf yüzü yönünde koordinat
    var dYerel = h.d * isaret; // harf yüzü normali etrafında dönüş
    var adim = (m - yerel) / 2; // 0 = dış katman
    var karsi = { R: 'L', L: 'R', U: 'D', D: 'U', F: 'B', B: 'F' };
    if (adim > m / 2) {
      // Karşı yüze daha yakın: onun adıyla yaz.
      harf = karsi[harf];
      adim = m - adim;
      dYerel = -dYerel;
    }
    var saatYonu = dYerel < 0;
    var ad;
    if (adim === 0) ad = harf;
    else if (n === 3) ad = { R: 'M', L: 'M', U: 'E', D: 'E', F: 'S', B: 'S' }[harf];
    else ad = (adim + 1) + harf;
    if (n === 3 && adim === 1) {
      // M, L yönünü; E, D yönünü; S, F yönünü izler.
      var takip = { M: 'L', E: 'D', S: 'F' }[ad];
      if (takip !== harf) saatYonu = !saatYonu;
    }
    return ad + (saatYonu ? '' : "'");
  }

  function sureMetni(ms) {
    var toplamOnda = Math.floor(ms / 100);
    var onda = toplamOnda % 10;
    var sn = Math.floor(toplamOnda / 10) % 60;
    var dk = Math.floor(toplamOnda / 600);
    return String(dk).padStart(2, '0') + ':' + String(sn).padStart(2, '0') + '.' + onda;
  }

  // Boyut başına rekor: en iyi süre ve en az hamle ayrı ayrı tutulur.
  function rekorIsle(rekor, sure, hamle) {
    var yeni = { sure: rekor && rekor.sure, hamle: rekor && rekor.hamle, cozulen: (rekor && rekor.cozulen) || 0 };
    var sureRekor = yeni.sure == null || sure < yeni.sure;
    var hamleRekor = yeni.hamle == null || hamle < yeni.hamle;
    if (sureRekor) yeni.sure = sure;
    if (hamleRekor) yeni.hamle = hamle;
    yeni.cozulen++;
    return { rekor: yeni, sureRekor: sureRekor, hamleRekor: hamleRekor };
  }

  function paylasimMetni(no, n, sure, hamle) {
    return 'Zekâ Küpü' + (no != null ? ' #' + no : '') + ' · ' + n + '×' + n + ' · ' + sureMetni(sure) + ' · ' + hamle + ' hamle';
  }

  var KupMantik = {
    BOYUTLAR: BOYUTLAR, YUZ_VEKTOR: YUZ_VEKTOR, YUZ_RENGI: YUZ_RENGI, HARF_YUZ: HARF_YUZ,
    yuzNo: yuzNo, dondur: dondur, cozulmus: cozulmus, kopya: kopya, uygula: uygula, hepsiniUygula: hepsiniUygula,
    ters: ters, tersDizi: tersDizi, cozulduMu: cozulduMu, imza: imza, yuzHamlesi: yuzHamlesi, coz: coz,
    sadelestir: sadelestir, uretec: uretec, karistir: karistir, gunNo: gunNo, gununKaristirmasi: gununKaristirmasi,
    hamleAdi: hamleAdi, sureMetni: sureMetni, rekorIsle: rekorIsle, paylasimMetni: paylasimMetni
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = KupMantik;
  else kok.KupMantik = KupMantik;
})(this);
