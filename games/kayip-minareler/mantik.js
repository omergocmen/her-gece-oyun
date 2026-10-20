// Kayıp Minareler'in bulmaca mantığı: tarayıcıda window.MinareMantik, Node testlerinde module.exports.
//
// Dünya birim küplerden oluşur; her küp [x, y, z, tür]. Bekçi üstü boş "yol" küplerinin
// üstünde yürür. Kamera tam izometriktir ve (1, 1, 1) yönünden bakar: bu yönde kayan iki nokta
// ekranda aynı yere düşer. Bir küpün ekrandaki hücresi (p, q) = (x - y, z - y) olur.
// İmkânsız geometri kuralı: "gözün gördüğü yürünür". Ekranda yan yana görünen iki karo,
// gerçekte farklı yükseklik ve derinlikte olsalar bile birbirine bağlıdır. Bir sütunda
// yalnızca kameraya en yakın küp görünür; arkasındakiler gizlidir ve yürünemez.
//
// Bölümdeki hareketli gruplar dönen (90°'lik adımlarla bir pivot çevresinde) ya da kayan
// (bir eksen boyunca) parçalardır. Basınç plakaları üstlerine basılınca bir grubu belirli
// bir duruma getirir.
(function (kok) {
  var YURUNUR = { y: true, c: true }; // y: taş yol, c: çini avlu
  var DERIN = 40;

  function anahtar(x, y, z) { return x + ',' + y + ',' + z; }
  function esit(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }

  // +90° döndürmeler (sağ el kuralı; three.js ile aynı yön)
  function dondur(v, eksen, n) {
    var x = v[0], y = v[1], z = v[2], t;
    n = ((n % 4) + 4) % 4;
    for (var i = 0; i < n; i++) {
      if (eksen === 'x') { t = y; y = -z; z = t; }
      else if (eksen === 'y') { t = x; x = z; z = -t; }
      else { t = x; x = -y; y = t; }
    }
    return [x + 0, y + 0, z + 0]; // -0 yerine 0
  }
  var EKSEN = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

  function grupKonumu(g, deger, b) {
    if (g.tur === 'donen') {
      var d = dondur([b[0] - g.pivot[0], b[1] - g.pivot[1], b[2] - g.pivot[2]], g.eksen, deger);
      return [d[0] + g.pivot[0], d[1] + g.pivot[1], d[2] + g.pivot[2]];
    }
    var e = EKSEN[g.eksen];
    return [b[0] + e[0] * deger, b[1] + e[1] * deger, b[2] + e[2] * deger];
  }

  function kur(bolum) {
    var s = { b: bolum, durum: {}, basili: {}, konum: bolum.baslangic.slice(), bitti: false };
    (bolum.gruplar || []).forEach(function (g) { s.durum[g.id] = g.baslangic || 0; });
    s.bitti = esit(s.konum, bolum.hedef);
    return s;
  }
  function kopya(s) {
    return { b: s.b, durum: Object.assign({}, s.durum), basili: Object.assign({}, s.basili), konum: s.konum.slice(), bitti: s.bitti };
  }

  // Bütün küpler, o anki grup durumlarıyla: anahtar → { x, y, z, tur, grup, i }
  function dunya(s) {
    var m = new Map();
    s.b.bloklar.forEach(function (b) { m.set(anahtar(b[0], b[1], b[2]), { x: b[0], y: b[1], z: b[2], tur: b[3] || 't', grup: null, i: -1 }); });
    (s.b.gruplar || []).forEach(function (g) {
      g.bloklar.forEach(function (b, i) {
        var k = grupKonumu(g, s.durum[g.id], b);
        m.set(anahtar(k[0], k[1], k[2]), { x: k[0], y: k[1], z: k[2], tur: b[3] || 't', grup: g.id, i: i });
      });
    });
    return m;
  }

  // Görünen ve yürünebilen karolar: ekran hücresi "p,q" → küp
  function karolar(s, d) {
    d = d || dunya(s);
    var sutun = new Map();
    d.forEach(function (b) {
      var k = (b.x - b.y) + ',' + (b.z - b.y);
      var o = sutun.get(k);
      if (!o || b.x + b.y + b.z > o.x + o.y + o.z) sutun.set(k, b);
    });
    var sonuc = new Map();
    sutun.forEach(function (b, k) {
      if (YURUNUR[b.tur] && !d.has(anahtar(b.x, b.y + 1, b.z))) sonuc.set(k, b);
    });
    return sonuc;
  }
  function hucre(v) { return (v[0] - v[1]) + ',' + (v[2] - v[1]); }

  function komsular(s, karo, kr) {
    var p = karo.x - karo.y, q = karo.z - karo.y, sonuc = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var u = kr.get((p + d[0]) + ',' + (q + d[1]));
      if (u) sonuc.push(u);
    });
    (s.b.baglar || []).forEach(function (bg) {
      var a = bg[0], b = bg[1], ka = kr.get(hucre(a)), kb = kr.get(hucre(b));
      if (!ka || !kb || !esit([ka.x, ka.y, ka.z], a) || !esit([kb.x, kb.y, kb.z], b)) return;
      if (ka === karo) sonuc.push(kb);
      else if (kb === karo) sonuc.push(ka);
    });
    return sonuc;
  }

  // Bekçinin durduğu karodan hedefe en kısa yol (karo listesi, başlangıç hariç); yoksa null.
  function yol(s, hedef) {
    var kr = karolar(s);
    var bas = kr.get(hucre(s.konum));
    if (!bas || !esit([bas.x, bas.y, bas.z], s.konum)) return null;
    var son = kr.get(hucre(hedef));
    if (!son || !esit([son.x, son.y, son.z], hedef)) return null;
    var onceki = new Map([[bas, null]]), kuyruk = [bas];
    while (kuyruk.length) {
      var u = kuyruk.shift();
      if (u === son) break;
      komsular(s, u, kr).forEach(function (v) { if (!onceki.has(v)) { onceki.set(v, u); kuyruk.push(v); } });
    }
    if (!onceki.has(son)) return null;
    var liste = [];
    for (var c = son; c !== bas; c = onceki.get(c)) liste.unshift([c.x, c.y, c.z]);
    return liste;
  }

  function erisilen(s) {
    var kr = karolar(s);
    var bas = kr.get(hucre(s.konum));
    if (!bas) return [];
    var gor = new Set([bas]), kuyruk = [bas];
    while (kuyruk.length) {
      komsular(s, kuyruk.shift(), kr).forEach(function (v) { if (!gor.has(v)) { gor.add(v); kuyruk.push(v); } });
    }
    return Array.from(gor).map(function (b) { return [b.x, b.y, b.z]; });
  }

  function bekcininGrubu(s) {
    var b = dunya(s).get(anahtar(s.konum[0], s.konum[1], s.konum[2]));
    return b ? b : null;
  }

  // Grubu yeni duruma getir; bekçi o grubun üstündeyse onunla birlikte taşınır.
  function grupAyarla(s, id, deger) {
    var g = (s.b.gruplar || []).find(function (x) { return x.id === id; });
    var alt = bekcininGrubu(s);
    s.durum[id] = deger;
    if (alt && alt.grup === id) {
      var k = grupKonumu(g, deger, g.bloklar[alt.i]);
      s.konum = k;
    }
  }

  // Oyuncunun grubu değiştirebilmesi: bekçi üstündeyken yalnız dikey eksenli dönüşe izin verilir.
  function kilitli(s, id) {
    if (s.bitti) return true;
    var g = (s.b.gruplar || []).find(function (x) { return x.id === id; });
    if (!g || g.surekli === false) return true;
    var alt = bekcininGrubu(s);
    return !!(alt && alt.grup === id && g.tur === 'donen' && g.eksen !== 'y');
  }
  function degerler(g) {
    if (g.durumlar) return g.durumlar;
    if (g.tur === 'donen') return [0, 1, 2, 3];
    var d = [];
    for (var i = g.min || 0; i <= g.max; i++) d.push(i);
    return d;
  }
  function oynat(s, id, deger) {
    if (kilitli(s, id)) return false;
    var g = s.b.gruplar.find(function (x) { return x.id === id; });
    if (degerler(g).indexOf(deger) < 0) return false;
    grupAyarla(s, id, deger);
    return true;
  }

  // Bir adım: bekçiyi karoya taşır, basınç plakasını ve hedefi denetler. Olay listesi döner.
  function adim(s, karo) {
    s.konum = karo.slice();
    var olaylar = [];
    (s.b.plakalar || []).forEach(function (p, i) {
      if (s.basili[i] || !esit(p.konum, karo)) return;
      s.basili[i] = true;
      grupAyarla(s, p.hedef, p.deger);
      olaylar.push({ tur: 'plaka', i: i, hedef: p.hedef, deger: p.deger });
    });
    if (esit(s.konum, s.b.hedef)) { s.bitti = true; olaylar.push({ tur: 'bitti' }); }
    return olaylar;
  }
  // Yolu baştan sona yürü (testler ve çözücü için); plaka yolu değiştirirse orada durur.
  function yuru(s, hedef) {
    var y = yol(s, hedef);
    if (!y) return false;
    for (var i = 0; i < y.length; i++) {
      var o = adim(s, y[i]);
      if (o.some(function (e) { return e.tur === 'plaka'; }) && i < y.length - 1) return 'durdu';
      if (s.bitti) break;
    }
    return true;
  }

  function imza(s) {
    return s.konum.join(',') + '|' + Object.keys(s.durum).sort().map(function (k) { return s.durum[k]; }).join(',') + '|' + Object.keys(s.basili).sort().join(',');
  }

  // Genişlik öncelikli çözücü: hamle = bir karoya yürümek ya da bir grubu bir duruma getirmek.
  function coz(bolum, sinir) {
    var bas = kur(bolum);
    var gor = new Map([[imza(bas), null]]);
    var kuyruk = [{ s: bas, hamleler: [] }];
    sinir = sinir || 200000;
    while (kuyruk.length && gor.size < sinir) {
      var d = kuyruk.shift();
      if (d.s.bitti) return d.hamleler;
      var adaylar = [];
      erisilen(d.s).forEach(function (k) { if (!esit(k, d.s.konum)) adaylar.push({ tur: 'yuru', k: k }); });
      (bolum.gruplar || []).forEach(function (g) {
        if (kilitli(d.s, g.id)) return;
        degerler(g).forEach(function (v) { if (v !== d.s.durum[g.id]) adaylar.push({ tur: 'grup', id: g.id, v: v }); });
      });
      for (var i = 0; i < adaylar.length; i++) {
        var a = adaylar[i], y = kopya(d.s);
        if (a.tur === 'yuru') yuru(y, a.k); else oynat(y, a.id, a.v);
        var im = imza(y);
        if (gor.has(im)) continue;
        gor.set(im, true);
        var h = d.hamleler.concat([a]);
        if (y.bitti) return h;
        kuyruk.push({ s: y, hamleler: h });
      }
    }
    return null;
  }

  var MinareMantik = {
    anahtar: anahtar, esit: esit, dondur: dondur, grupKonumu: grupKonumu, kur: kur, kopya: kopya,
    dunya: dunya, karolar: karolar, hucre: hucre, komsular: komsular, yol: yol, erisilen: erisilen,
    kilitli: kilitli, degerler: degerler, oynat: oynat, adim: adim, yuru: yuru, coz: coz, YURUNUR: YURUNUR
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MinareMantik;
  else kok.MinareMantik = MinareMantik;
})(this);
