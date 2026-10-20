// Cam Ustası'nın oyun mantığı: tarayıcıda window.CamMantik, Node testlerinde module.exports.
//
// Kamera koridorda -z yönünde sabit hızla ilerler (d = alınan yol, kamera z = -d). Koridor
// x ∈ [-2, 2], y ∈ [0, 3]; kamera x = 0, y = 1.5 hizasında. Odalar tohumlu üreteçle kurulur,
// böylece aynı oda her oyunda aynıdır. Simülasyon sabit adımlıdır (1/120 sn): sonuç kare hızına
// bağlı değildir. Bilye hem cephane hem candır; bitince oyun biter.
(function (kok) {
  var DT = 1 / 120;
  var L = 60; // bir odanın uzunluğu
  var ODA_SAYISI = 10;
  var GEN = 2; // koridorun yarı genişliği
  var YUK = 3; // koridor yüksekliği
  var KAM_Y = 1.5;
  var KAM_R = 0.3; // kameranın çarpışma yarıçapı
  var TOP_R = 0.11;
  var TOP_HIZ = 26;
  var G = 9;
  var TOP_OMUR = 2.6;
  var BASLANGIC = 25;
  var CARPMA_CEZA = 10;
  var NAZAR_CEZA = 5;
  var NAZAR_ODUL = 3;
  var KRISTAL_ODUL = 3;
  var KOMBO_ADIM = 5; // art arda bu kadar isabet bir kombo seviyesi kazandırır
  var MAKS_KOMBO = 5;
  var NISAN_UZAK = 18;

  function rng(tohum) {
    var a = tohum >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hiz(oda) { return Math.min(11, 5.5 + 0.5 * (oda - 1)); }
  function odaNo(d) { return Math.floor(d / L) + 1; }

  function cam(id, oda, z, x0, x1, y0, y1, ek) {
    var e = { id: id, oda: oda, tur: 'cam', z: z, x0: x0, x1: x1, y0: y0, y1: y1, dayanim: 1, hasar: 0, kirik: false, gecildi: false, kayma: null };
    if (ek) for (var k in ek) e[k] = ek[k];
    return e;
  }

  // n. odanın engelleri. Kamerayı kapatan camlar mutlaka kırılabilir; nazar kapısı odanın sonundadır.
  function odaUret(n) {
    var r = rng(n * 9973 + 7);
    var zBas = -(n - 1) * L;
    var zor = Math.min(1, (n - 1) / 9);
    var e = [];
    var i = 0;
    var z = zBas - 12;
    var son = zBas - L + 9;
    function id() { return n + '-' + (i++); }
    while (z > son) {
      var desen = ['duvar', 'orta', 'kapi'];
      if (n >= 2) desen.push('izgara');
      if (n >= 3) desen.push('kayan', 'kayan');
      if (n >= 4) desen.push('bulbul', 'bulbul');
      if (n >= 6) desen.push('ikili');
      var d = desen[Math.floor(r() * desen.length)];
      if (d === 'duvar') {
        e.push(cam(id(), n, z, -GEN, GEN, 0, YUK));
      } else if (d === 'orta') {
        e.push(cam(id(), n, z, -0.9, 0.9, 0.4, 2.6));
      } else if (d === 'kapi') {
        // Ortası açık iki yan cam: kamerayı kapatmaz, kırmak isteğe bağlı.
        e.push(cam(id(), n, z, -GEN, -0.6, 0, YUK));
        e.push(cam(id(), n, z, 0.6, GEN, 0, YUK));
        e.push(cam(id(), n, z, -0.6, 0.6, 2.1, YUK));
      } else if (d === 'izgara') {
        var xs = [-GEN, -0.7, 0.7, GEN], ys = [0, 1, 2, YUK];
        for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) e.push(cam(id(), n, z, xs[a], xs[a + 1], ys[b], ys[b + 1]));
      } else if (d === 'kayan') {
        var A = 1.1 + 0.4 * zor;
        e.push(cam(id(), n, z, -0.8, 0.8, 0.3, 2.7, { kayma: { A: A, w: 1.4 + 1.2 * zor, faz: r() * Math.PI * 2 } }));
      } else if (d === 'bulbul') {
        e.push(cam(id(), n, z, -1.0, 1.0, 0.3, 2.7, { tur: 'bulbul', dayanim: 2 }));
      } else {
        e.push(cam(id(), n, z, -GEN, 0, 0, YUK));
        e.push(cam(id(), n, z - 1.6, 0, GEN, 0, YUK, { tur: n >= 8 ? 'bulbul' : 'cam', dayanim: n >= 8 ? 2 : 1 }));
      }
      if (r() < 0.7) {
        e.push({ id: id(), oda: n, tur: 'kristal', x: -1.4 + r() * 2.8, y: 0.6 + r() * 1.8, z: z - 3.4, r: 0.38, toplandi: false });
      }
      z -= 7.6 - 2.4 * zor + r() * 2;
    }
    e.push({ id: id(), oda: n, tur: 'nazar', z: zBas - L + 3, cx: 0, cy: KAM_Y, rIc: 0.78, rDis: 1.45, kirik: false, gecildi: false });
    return e;
  }

  function yeniOyun(ayar) {
    var mod = (ayar && ayar.mod) || 'oda';
    var oda = (ayar && ayar.oda) || 1;
    var s = {
      mod: mod, baslangicOda: oda, d: (oda - 1) * L, t: 0, oda: oda,
      bilye: BASLANGIC, seri: 0, kombo: 1, enYuksekKombo: 1,
      toplar: [], atislar: {}, atisNo: 0, engeller: [], yuklu: 0,
      kirilan: 0, bitti: false, kazandi: false, olaylar: []
    };
    yukle(s);
    return s;
  }

  // Bulunulan oda ve bir sonrakinin engelleri yüklü kalır; geride kalanlar atılır.
  function yukle(s) {
    var hedef = s.oda + 1;
    if (s.mod === 'oda') hedef = Math.min(hedef, ODA_SAYISI);
    while (s.yuklu < hedef) {
      s.yuklu = Math.max(s.yuklu + 1, s.oda);
      s.engeller = s.engeller.concat(odaUret(s.yuklu));
    }
    var kamZ = -s.d;
    s.engeller = s.engeller.filter(function (e) { return e.z < kamZ + 6; });
  }

  function kayma(e, t) { return e.kayma ? e.kayma.A * Math.sin(e.kayma.w * t + e.kayma.faz) : 0; }

  function camIcinde(e, x, y, t, pay) {
    var k = kayma(e, t);
    return x >= e.x0 + k - pay && x <= e.x1 + k + pay && y >= e.y0 - pay && y <= e.y1 + pay;
  }
  function nazarIcinde(e, x, y) {
    var r = Math.hypot(x - e.cx, y - e.cy);
    return r >= e.rIc && r <= e.rDis;
  }
  // Kamera dairesi (x=0, y=KAM_Y, r=KAM_R) dikdörtgenle kesişiyor mu?
  function kamerayiKapatir(e, t) {
    var k = kayma(e, t);
    var cx = Math.max(e.x0 + k, Math.min(0, e.x1 + k));
    var cy = Math.max(e.y0, Math.min(KAM_Y, e.y1));
    return Math.hypot(cx, cy - KAM_Y) < KAM_R;
  }

  // Bilyenin P noktasından (yerçekimi düşüşü hesaba katılarak) tam geçmesi için ilk hız.
  function yorunge(p0, P) {
    var dx = P.x - p0.x, dy = P.y - p0.y, dz = P.z - p0.z;
    var T = Math.hypot(dx, dy, dz) / TOP_HIZ;
    return { v: { x: dx / T, y: dy / T + 0.5 * G * T, z: dz / T }, T: T };
  }
  function konum(p0, v, t) {
    return { x: p0.x + v.x * t, y: p0.y + v.y * t - 0.5 * G * t * t, z: p0.z + v.z * t };
  }

  // Kameradan `yon` doğrultusundaki ışının ilk değdiği sağlam cam / kristal; yoksa NISAN_UZAK ileride.
  function nisanNoktasi(s, p0, yon) {
    var enK = NISAN_UZAK, uzunluk = Math.hypot(yon.x, yon.y, yon.z);
    var u = { x: yon.x / uzunluk, y: yon.y / uzunluk, z: yon.z / uzunluk };
    s.engeller.forEach(function (e) {
      if (e.tur === 'kristal') {
        if (e.toplandi) return;
        var w = { x: e.x - p0.x, y: e.y - p0.y, z: e.z - p0.z };
        var izd = w.x * u.x + w.y * u.y + w.z * u.z;
        if (izd <= 0) return;
        var dik = Math.hypot(w.x - u.x * izd, w.y - u.y * izd, w.z - u.z * izd);
        if (dik < e.r && izd < enK) enK = izd;
        return;
      }
      if (e.kirik || u.z >= 0) return;
      var k = (e.z - p0.z) / u.z;
      if (k <= 0.5 || k >= enK) return;
      var x = p0.x + u.x * k, y = p0.y + u.y * k;
      var tUlas = s.t + k / TOP_HIZ;
      if (e.tur === 'nazar' ? nazarIcinde(e, x, y) : camIcinde(e, x, y, tUlas, 0)) enK = k;
    });
    return { x: p0.x + u.x * enK, y: p0.y + u.y * enK, z: p0.z + u.z * enK };
  }

  // Kombo seviyesindeki bilye sayısı kadar, hedefin çevresine dağılan atış. Bedeli tek bilye.
  var DAGILIM = [[[0, 0]], [[-0.28, 0], [0.28, 0]], [[0, 0.3], [-0.28, -0.18], [0.28, -0.18]],
    [[-0.28, 0.28], [0.28, 0.28], [-0.28, -0.28], [0.28, -0.28]], [[0, 0], [-0.4, 0.3], [0.4, 0.3], [-0.4, -0.3], [0.4, -0.3]]];
  function at(s, p0, P) {
    if (s.bitti || s.bilye < 1) return false;
    s.bilye -= 1;
    var no = ++s.atisNo;
    var desen = DAGILIM[s.kombo - 1];
    s.atislar[no] = { kalan: desen.length, isabet: false };
    desen.forEach(function (o) {
      var hedef = { x: P.x + o[0], y: P.y + o[1], z: P.z };
      var y = yorunge(p0, hedef);
      s.toplar.push({ x: p0.x, y: p0.y, z: p0.z, vx: y.v.x, vy: y.v.y, vz: y.v.z, yas: 0, atis: no, sekme: 0 });
    });
    s.olaylar.push({ tur: 'atis', sayi: desen.length });
    return true;
  }

  function isabet(s, top) {
    var a = s.atislar[top.atis];
    if (!a || a.isabet) return;
    a.isabet = true;
    s.seri += 1;
    var yeni = Math.min(MAKS_KOMBO, 1 + Math.floor(s.seri / KOMBO_ADIM));
    if (yeni > s.kombo) {
      s.kombo = yeni;
      s.enYuksekKombo = Math.max(s.enYuksekKombo, yeni);
      s.olaylar.push({ tur: 'kombo', kombo: yeni });
    }
  }
  function komboSifirla(s) {
    if (s.kombo > 1) s.olaylar.push({ tur: 'kombo-bitti' });
    s.seri = 0;
    s.kombo = 1;
  }

  function topAdim(s, top) {
    var px = top.x, py = top.y, pz = top.z;
    top.x += top.vx * DT; top.y += top.vy * DT; top.z += top.vz * DT;
    top.vy -= G * DT;
    top.yas += DT;
    for (var i = 0; i < s.engeller.length; i++) {
      var e = s.engeller[i];
      if (e.tur === 'kristal') {
        if (e.toplandi) continue;
        // Bu adımdaki doğru parçasının kristale en yakın noktası
        var sx = top.x - px, sy = top.y - py, sz = top.z - pz;
        var l2 = sx * sx + sy * sy + sz * sz || 1e-9;
        var f = Math.max(0, Math.min(1, ((e.x - px) * sx + (e.y - py) * sy + (e.z - pz) * sz) / l2));
        if (Math.hypot(px + sx * f - e.x, py + sy * f - e.y, pz + sz * f - e.z) < e.r + TOP_R) {
          e.toplandi = true;
          s.bilye += KRISTAL_ODUL;
          isabet(s, top);
          s.olaylar.push({ tur: 'kristal', id: e.id, x: e.x, y: e.y, z: e.z });
        }
        continue;
      }
      if (e.kirik || !(pz > e.z && top.z <= e.z)) continue;
      var k = (pz - e.z) / (pz - top.z);
      var x = px + (top.x - px) * k, y = py + (top.y - py) * k;
      if (e.tur === 'nazar') {
        if (!nazarIcinde(e, x, y)) continue;
        // Cam kırmış ya da sekmiş bilye nazar boncuğundan zararsızca seker; yalnızca doğrudan atış kırar.
        if (top.temas || top.sekme > 0) {
          top.z = e.z + 0.02; top.vz = -top.vz * 0.2; top.vx *= 0.3;
          break;
        }
        e.kirik = true;
        s.bilye = Math.max(0, s.bilye - NAZAR_CEZA);
        komboSifirla(s);
        s.olaylar.push({ tur: 'nazar', id: e.id, x: x, y: y, z: e.z });
        continue;
      }
      if (!camIcinde(e, x, y, s.t, TOP_R * 0.5)) continue;
      e.hasar += 1;
      isabet(s, top);
      if (e.hasar >= e.dayanim) {
        e.kirik = true;
        s.kirilan += 1;
        top.temas = true;
        s.olaylar.push({ tur: 'kirildi', id: e.id, x: x, y: y, z: e.z });
        top.vx *= 0.6; top.vy *= 0.6; top.vz *= 0.6;
      } else {
        s.olaylar.push({ tur: 'catlak', id: e.id, x: x, y: y, z: e.z });
        top.z = e.z + 0.02;
        top.vz = -top.vz * 0.22; top.vx *= 0.3;
        top.vy = Math.min(top.vy, 0);
        break;
      }
    }
    // Duvar, tavan ve zeminden sekme
    if (top.x < -GEN + TOP_R && top.vx < 0) { top.x = -GEN + TOP_R; top.vx = -top.vx * 0.5; }
    if (top.x > GEN - TOP_R && top.vx > 0) { top.x = GEN - TOP_R; top.vx = -top.vx * 0.5; }
    if (top.y > YUK - TOP_R && top.vy > 0) { top.y = YUK - TOP_R; top.vy = -top.vy * 0.4; }
    if (top.y < TOP_R && top.vy < 0) {
      top.y = TOP_R; top.vy = -top.vy * 0.42; top.vx *= 0.7; top.vz *= 0.7;
      top.sekme += 1;
    }
  }

  function topBitti(s, top) {
    var a = s.atislar[top.atis];
    if (!a) return;
    a.kalan -= 1;
    if (a.kalan <= 0) {
      if (!a.isabet) { komboSifirla(s); s.olaylar.push({ tur: 'iska' }); }
      delete s.atislar[top.atis];
    }
  }

  function adim(s) {
    if (s.bitti) return;
    s.t += DT;
    var d0 = s.d;
    s.d += hiz(s.oda) * DT;
    var kamZ0 = -d0, kamZ = -s.d;

    // Kameranın geçtiği engeller
    for (var i = 0; i < s.engeller.length; i++) {
      var e = s.engeller[i];
      if (e.tur === 'kristal' || e.gecildi || !(kamZ0 > e.z && kamZ <= e.z)) continue;
      e.gecildi = true;
      if (e.tur === 'nazar') {
        if (!e.kirik) { s.bilye += NAZAR_ODUL; s.olaylar.push({ tur: 'nazar-gecti', id: e.id }); }
        continue;
      }
      if (!e.kirik && kamerayiKapatir(e, s.t)) {
        e.kirik = true;
        s.bilye = Math.max(0, s.bilye - CARPMA_CEZA);
        komboSifirla(s);
        s.olaylar.push({ tur: 'carpma', id: e.id, x: 0, y: KAM_Y, z: e.z });
      }
    }

    for (var j = s.toplar.length - 1; j >= 0; j--) {
      var top = s.toplar[j];
      topAdim(s, top);
      if (top.yas > TOP_OMUR || top.z > kamZ + 1 || top.sekme > 3) {
        s.toplar.splice(j, 1);
        topBitti(s, top);
      }
    }

    var yeniOda = odaNo(s.d);
    if (s.mod === 'oda' && yeniOda > ODA_SAYISI) {
      s.bitti = true; s.kazandi = true; s.d = ODA_SAYISI * L;
      s.olaylar.push({ tur: 'bitti', kazandi: true });
      return;
    }
    if (yeniOda !== s.oda) {
      s.oda = yeniOda;
      yukle(s);
      s.olaylar.push({ tur: 'oda', oda: yeniOda });
    }
    if (s.bilye <= 0 && s.toplar.length === 0) {
      s.bitti = true;
      s.olaylar.push({ tur: 'bitti', kazandi: false });
    }
  }

  // Kare süresi ne olursa olsun aynı sayıda sabit adım: döndürülen değer sonraki kareye kalan süre.
  function ilerlet(s, biriken, kareSuresi) {
    biriken += Math.min(kareSuresi, 0.1);
    while (biriken >= DT && !s.bitti) { adim(s); biriken -= DT; }
    return biriken;
  }

  function odaIlerleme(s) { return Math.min(1, (s.d - (s.oda - 1) * L) / L); }

  var CamMantik = {
    DT: DT, L: L, ODA_SAYISI: ODA_SAYISI, GEN: GEN, YUK: YUK, KAM_Y: KAM_Y, KAM_R: KAM_R,
    TOP_R: TOP_R, TOP_HIZ: TOP_HIZ, G: G, BASLANGIC: BASLANGIC, CARPMA_CEZA: CARPMA_CEZA,
    NAZAR_CEZA: NAZAR_CEZA, NAZAR_ODUL: NAZAR_ODUL, KRISTAL_ODUL: KRISTAL_ODUL,
    KOMBO_ADIM: KOMBO_ADIM, MAKS_KOMBO: MAKS_KOMBO,
    rng: rng, hiz: hiz, odaNo: odaNo, odaUret: odaUret, yeniOyun: yeniOyun, kayma: kayma,
    camIcinde: camIcinde, nazarIcinde: nazarIcinde, kamerayiKapatir: kamerayiKapatir,
    yorunge: yorunge, konum: konum, nisanNoktasi: nisanNoktasi, at: at, adim: adim,
    ilerlet: ilerlet, odaIlerleme: odaIlerleme
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CamMantik;
  else kok.CamMantik = CamMantik;
})(this);
