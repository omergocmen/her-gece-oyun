// Okey'in saf oyun mantığı: taş takımı, gösterge/okey, per ve seri doğrulama, el bitirme (okey jokerli),
// çifte gitme, ıstaka dizme, puanlama, bilgisayar rakipler ve tohumlu günlük dağıtım.
// Tarayıcıda window.OkeyMantik, Web Worker'da self.OkeyMantik, Node testlerinde module.exports.
//
// Taş kimliği (0..105): 0..103 normal taşlar, kimlik = renk*26 + (sayı-1)*2 + kopya; 104 ve 105 sahte okey.
// Renkler: 0 kırmızı, 1 sarı, 2 mavi, 3 siyah. "Yüz indeksi" = renk*14 + sayı (sayı 1..13), 56 uzunluklu sayım dizileri için.
// Okey (joker): göstergenin aynı renkte bir fazlası (13'ten sonra 1). Sahte okey, okeyin yüzünü taşır ama joker değildir.
// Oyuncular saat yönünde 0 (insan, alt), 1 (sol), 2 (üst), 3 (sağ). Oyuncu p, (p+3)%4'ün ıskartasını alabilir.
(function (kok) {
  var TOPLAM = 106;
  var SAHTE_ILK = 104;
  var YUVA = 16; // ıstaka: 2 sıra × 8 yuva
  var RENK_ADLARI = ['Kırmızı', 'Sarı', 'Mavi', 'Siyah'];
  var SEVIYELER = ['kolay', 'orta', 'zor'];
  var SEVIYE_ADI = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor' };
  var STILLER = ['temkinli', 'saldirgan', 'cifteci'];
  var STIL_ADI = { temkinli: 'temkinli', saldirgan: 'saldırgan', cifteci: 'çifteci' };
  var RAKIPLER = [
    null,
    { ad: 'Rıza Amca', stil: 'temkinli' },
    { ad: 'Kâzım Abi', stil: 'saldirgan' },
    { ad: 'Nurten Teyze', stil: 'cifteci' }
  ];
  var VARSAYILAN_AYAR = { seviye: 'orta', eller: 3, cifte: true, okeyAtarak: true };

  // ---------- Rastgelelik ----------
  // Tohumlu, deterministik rastgele sayı üreteci (mulberry32).
  function uretec(tohum) {
    var a = tohum >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var x = a;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Birkaç sayıdan tek tohum türetir (karar başına tohum için).
  function karma() {
    var h = 0x811c9dc5;
    for (var i = 0; i < arguments.length; i++) {
      h ^= arguments[i] >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
      h ^= h >>> 15;
    }
    return h >>> 0;
  }
  // 'YYYY-AA-GG' → günlük dağıtımın tohumu (FNV-1a). Aynı gün herkes aynı eli alır.
  function gunTohumu(tarih) {
    var h = 0x811c9dc5;
    var s = 'okey:' + tarih;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function karistir(dizi, rastgele) {
    var d = dizi.slice();
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(rastgele() * (i + 1));
      var t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  // ---------- Taş takımı ----------
  function tamTakim() {
    var l = [];
    for (var i = 0; i < TOPLAM; i++) l.push(i);
    return l;
  }
  function sahteMi(id) { return id >= SAHTE_ILK; }
  function renkOf(id) { return Math.floor(id / 26); }
  function sayiOf(id) { return Math.floor((id % 26) / 2) + 1; }
  // Göstergeden okey: aynı renk, bir fazla sayı; 13'ten sonra 1.
  function okeyBelirle(gostergeId) {
    if (sahteMi(gostergeId)) throw new Error('Gösterge sahte okey olamaz');
    return { renk: renkOf(gostergeId), sayi: sayiOf(gostergeId) % 13 + 1 };
  }
  // Bir taşın oyundaki yüzü: sahte okey, okeyin yüzünü taşır; joker yalnızca gerçek okey taşlarıdır.
  function yuz(id, okey) {
    if (sahteMi(id)) return { r: okey.renk, s: okey.sayi, sahte: true, joker: false };
    var r = renkOf(id), s = sayiOf(id);
    return { r: r, s: s, sahte: false, joker: r === okey.renk && s === okey.sayi };
  }
  function jokerMi(id, okey) { return yuz(id, okey).joker; }
  function indeks(id, okey) { var y = yuz(id, okey); return y.r * 14 + y.s; }

  // ---------- Sayım ----------
  function sayim(ids, okey) {
    var cnt = new Int8Array(56), J = 0, havuz = {}, jokerler = [];
    for (var i = 0; i < ids.length; i++) {
      var y = yuz(ids[i], okey);
      if (y.joker) { J++; jokerler.push(ids[i]); } else {
        var k = y.r * 14 + y.s;
        cnt[k]++;
        (havuz[k] = havuz[k] || []).push(ids[i]);
      }
    }
    return { cnt: cnt, J: J, havuz: havuz, jokerler: jokerler, toplam: ids.length };
  }

  // ---------- Per / seri arama ----------
  // Bir yüz indeksinden başlayarak onu içeren olası gruplar: set (aynı sayı, farklı renk, 3-4 taş)
  // ve seri (aynı renk ardışık, 3-5 taş; 6+ uzunluk her zaman bölünebilir, 12-13-1 geçerli, 13-1-2 değil).
  // Girdi: e = [{idx}] ("idx" -1 ise joker). Yalnızca gerçekten eldeki taşlar ya da jokerler kullanılır.
  function gruplar(cnt, J, i) {
    var cikti = [];
    var r = Math.floor(i / 14), s = i % 14;
    // set
    var uygun = [];
    for (var c = 0; c < 4; c++) if (c !== r && cnt[c * 14 + s] > 0) uygun.push(c);
    for (var mask = 0; mask < (1 << uygun.length); mask++) {
      var secili = [];
      for (var b = 0; b < uygun.length; b++) if (mask & (1 << b)) secili.push(uygun[b]);
      for (var j = 0; j <= Math.min(J, 2); j++) {
        var boyut = 1 + secili.length + j;
        if (boyut < 3 || boyut > 4) continue;
        var e = [{ idx: i }];
        secili.forEach(function (cc) { e.push({ idx: cc * 14 + s }); });
        for (var q = 0; q < j; q++) e.push({ idx: -1 });
        cikti.push({ tur: 'per', e: e });
      }
    }
    // seri
    var konumlar = s === 1 ? [1, 14] : [s];
    konumlar.forEach(function (pos) {
      for (var L = 3; L <= 5; L++) {
        for (var a = pos - L + 1; a <= pos; a++) {
          var bb = a + L - 1;
          if (a < 1 || bb > 14) continue;
          var ent = [], joker = 0, tamam = true;
          for (var p = a; p <= bb; p++) {
            if (p === pos) { ent.push({ idx: i, pos: p }); continue; }
            var k2 = r * 14 + (p === 14 ? 1 : p);
            if (cnt[k2] > 0) ent.push({ idx: k2, pos: p });
            else { joker++; if (joker > J) { tamam = false; break; } ent.push({ idx: -1, pos: p }); }
          }
          if (tamam) cikti.push({ tur: 'seri', e: ent });
        }
      }
    });
    return cikti;
  }

  // En çok taşı per/seri içine alan bölme (kalan taşlar dışarıda bırakılabilir).
  // Dönüş: { kapsanan, gruplar: [{tur, e}], artan: [yüz indeksleri], artanJ }
  function ara(cnt0, J0) {
    var cnt = Int8Array.from(cnt0), J = J0, memo = new Map();
    function anahtar() { return String.fromCharCode.apply(null, cnt) + String.fromCharCode(48 + J); }
    function ilk() { var i = 0; while (i < 56 && cnt[i] <= 0) i++; return i; }
    function uygula(g, yon) {
      for (var n = 0; n < g.e.length; n++) {
        if (g.e[n].idx >= 0) cnt[g.e[n].idx] -= yon; else J -= yon;
      }
    }
    function f() {
      var i = ilk();
      if (i >= 56) return 0;
      var k = anahtar(), m = memo.get(k);
      if (m) return m.v;
      cnt[i]--;
      var en = f(), enG = null;
      cnt[i]++;
      var gs = gruplar(cnt, J, i);
      for (var n = 0; n < gs.length; n++) {
        uygula(gs[n], 1);
        var v = gs[n].e.length + f();
        uygula(gs[n], -1);
        if (v > en) { en = v; enG = gs[n]; }
      }
      memo.set(k, { v: en, g: enG });
      return en;
    }
    var kapsanan = f();
    // yeniden yürü
    var sonuc = [], artan = [];
    for (;;) {
      var i = ilk();
      if (i >= 56) break;
      var m = memo.get(anahtar());
      if (m && m.g) { sonuc.push(m.g); uygula(m.g, 1); } else { artan.push(i); cnt[i]--; }
    }
    return { kapsanan: kapsanan, gruplar: sonuc, artan: artan, artanJ: J };
  }

  // Taş listesini seçilen grup şemasına göre gerçek kimliklere çevirir.
  function kimliklere(sonuc, sy) {
    var havuz = {};
    Object.keys(sy.havuz).forEach(function (k) { havuz[k] = sy.havuz[k].slice(); });
    var jokerler = sy.jokerler.slice();
    function al(idx) { return idx < 0 ? jokerler.pop() : havuz[idx].pop(); }
    var gr = sonuc.gruplar.map(function (g) {
      return { tur: g.tur, taslar: g.e.map(function (x) { return al(x.idx); }) };
    });
    var artan = sonuc.artan.map(function (idx) { return al(idx); });
    for (var q = 0; q < sonuc.artanJ; q++) artan.push(jokerler.pop());
    return { gruplar: gr, artan: artan };
  }

  // ---------- Doğrulama ----------
  // Tek bir taş listesinin geçerli bir per ya da seri olup olmadığı: 'per' | 'seri' | null.
  function grupTuru(ids, okey) {
    var n = ids.length;
    if (n < 3 || n > 14) return null;
    var gercek = [], jok = 0;
    ids.forEach(function (id) {
      var y = yuz(id, okey);
      if (y.joker) jok++; else gercek.push(y);
    });
    if (!gercek.length) return n <= 4 ? 'per' : null;
    // per: aynı sayı, farklı renkler, 3-4 taş
    if (n <= 4 && gercek.every(function (y) { return y.s === gercek[0].s; })) {
      var renkler = {};
      var tekrarsiz = gercek.every(function (y) { if (renkler[y.r]) return false; renkler[y.r] = true; return true; });
      if (tekrarsiz) return 'per';
    }
    // seri: aynı renk, ardışık konumlar (1 hem başta hem 14. konumda olabilir)
    if (gercek.every(function (y) { return y.r === gercek[0].r; })) {
      for (var a = 1; a + n - 1 <= 14; a++) {
        var b = a + n - 1;
        if (a === 1 && b === 14) continue;
        var kullanilan = {}, uyar = true;
        for (var g = 0; g < gercek.length && uyar; g++) {
          var s = gercek[g].s, bulundu = false;
          [s, s === 1 ? 14 : -1].forEach(function (p) {
            if (!bulundu && p >= a && p <= b && !kullanilan[p]) { kullanilan[p] = true; bulundu = true; }
          });
          if (!bulundu) uyar = false;
        }
        if (uyar) return 'seri';
      }
    }
    return null;
  }

  // 14 (ya da herhangi sayıda) taşın tamamı geçerli per/serilere bölünebiliyor mu? → grup listesi ya da null.
  function perlereBol(ids, okey) {
    var sy = sayim(ids, okey);
    var r = ara(sy.cnt, sy.J);
    if (r.kapsanan !== ids.length) return null;
    return kimliklere(r, sy).gruplar;
  }

  // 7 çift: aynı yüzden iki taş ya da okey ile eşleşen tek taş. Okeyler birbiriyle de çift olur.
  function cifteMi(ids, okey) {
    if (ids.length !== 14) return false;
    var sy = sayim(ids, okey), tek = 0;
    for (var i = 0; i < 56; i++) if (sy.cnt[i] % 2) tek++;
    return sy.J >= tek && (sy.J - tek) % 2 === 0;
  }
  // Çiftleri ve artanları (okeyle eşleşenler dahil) listeler: [[a,b],...]
  function ciftGruplari(ids, okey) {
    var sy = sayim(ids, okey), ciftler = [], tekler = [];
    Object.keys(sy.havuz).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var l = sy.havuz[k];
      while (l.length >= 2) ciftler.push([l.pop(), l.pop()]);
      if (l.length) tekler.push(l.pop());
    });
    var jok = sy.jokerler.slice();
    while (tekler.length && jok.length) ciftler.push([tekler.shift(), jok.pop()]);
    while (jok.length >= 2) ciftler.push([jok.pop(), jok.pop()]);
    return { ciftler: ciftler, artan: tekler.concat(jok) };
  }

  // Bir eli (14 taş) bitiren tür: 'cifte' | 'normal' | null.
  function bitisTuru(ids14, okey, ayar) {
    if (ids14.length !== 14) return null;
    if (ayar && ayar.cifte && cifteMi(ids14, okey)) return 'cifte';
    return perlereBol(ids14, okey) ? 'normal' : null;
  }

  // 15 taşlık elde, atıldığında eli bitiren taşlar: [{id, tur, okeyle, puan}] (puan yüksek olan önce).
  function bitisAdaylari(ids15, okey, ayar) {
    var gorulen = {}, liste = [];
    ids15.forEach(function (id, n) {
      var y = yuz(id, okey);
      var k = y.joker ? 'J' : y.r * 14 + y.s;
      if (gorulen[k]) return;
      gorulen[k] = true;
      var kalan = ids15.slice(0, n).concat(ids15.slice(n + 1));
      var tur = bitisTuru(kalan, okey, ayar);
      if (!tur) return;
      var okeyle = y.joker;
      if (okeyle && !(ayar && ayar.okeyAtarak)) return; // okey atarak bitirmek kapalıysa bu taşla bitmez
      liste.push({ id: id, tur: tur, okeyle: okeyle, puan: elPuani(tur, okeyle) });
    });
    liste.sort(function (a, b) { return b.puan - a.puan; });
    return liste;
  }

  // Puanlama: normal 1, çifte ×2, okey atarak ×2 (ikisi birden ×4).
  function elPuani(tur, okeyle) { return (tur === 'cifte' ? 2 : 1) * (okeyle ? 2 : 1); }

  // Maç sonu: en çok puanlı kazanır; eşitlikte -1 (berabere).
  function macKazanani(puanlar) {
    var en = Math.max.apply(null, puanlar), kazan = [];
    puanlar.forEach(function (p, i) { if (p === en) kazan.push(i); });
    return kazan.length === 1 ? kazan[0] : -1;
  }

  // ---------- Istaka dizme ----------
  function enIyiDizilis(ids, okey) {
    var sy = sayim(ids, okey);
    var r = ara(sy.cnt, sy.J);
    var k = kimliklere(r, sy);
    return { kapsanan: r.kapsanan, gruplar: k.gruplar, artan: k.artan, toplam: ids.length };
  }
  function artanSirala(l, okey) {
    return l.slice().sort(function (a, b) {
      var ya = yuz(a, okey), yb = yuz(b, okey);
      if (ya.joker !== yb.joker) return ya.joker ? -1 : 1;
      return ya.r - yb.r || ya.s - yb.s || a - b;
    });
  }
  // Bloklar (gruplar, sonra artanlar) 16 yuvalık ıstakaya yerleştirilir; bloklar satır ortasında bölünmemeye çalışır.
  function yerlestir(bloklar, n) {
    var kalan = YUVA - n, yuvalar = [];
    bloklar.forEach(function (blk, bi) {
      var sutun = yuvalar.length % 8;
      if (blk.length <= 8 && sutun + blk.length > 8) {
        var pad = 8 - sutun;
        if (pad <= kalan) { for (var q = 0; q < pad; q++) yuvalar.push(null); kalan -= pad; }
      }
      blk.forEach(function (id) { yuvalar.push(id); });
      if (kalan > 0 && bi < bloklar.length - 1 && yuvalar.length % 8 !== 0) { yuvalar.push(null); kalan--; }
    });
    while (yuvalar.length < YUVA) yuvalar.push(null);
    return yuvalar.slice(0, YUVA);
  }
  // "Seri diz": en çok taşı per/seriye alan dizilim; gruplar yan yana, artanlar renk ve sayıya göre.
  function seriDiz(ids, okey) {
    var e = enIyiDizilis(ids, okey);
    var bloklar = e.gruplar.map(function (g) { return g.taslar; });
    if (e.artan.length) bloklar.push(artanSirala(e.artan, okey));
    return yerlestir(bloklar, ids.length);
  }
  // "Çift diz": çiftler yan yana, sonra artanlar.
  function ciftDiz(ids, okey) {
    var c = ciftGruplari(ids, okey);
    var bloklar = c.ciftler.slice();
    if (c.artan.length) bloklar.push(artanSirala(c.artan, okey));
    return yerlestir(bloklar, ids.length);
  }

  // ---------- Oyun motoru ----------
  // Durum düz JSON'dur (localStorage'a yazılabilir). sira: şimdi oynayan, faz: 'cek' | 'at'.
  function yeniEl(tohum, baslayan) {
    var rastgele = uretec(tohum);
    var deste = karistir(tamTakim(), rastgele);
    var gi = 0;
    while (sahteMi(deste[gi])) gi++;
    var gosterge = deste.splice(gi, 1)[0];
    var okey = okeyBelirle(gosterge);
    var eller = [[], [], [], []];
    for (var o = 0; o < 4; o++) {
      var adet = o === baslayan ? 15 : 14;
      eller[o] = deste.splice(0, adet);
    }
    return {
      tohum: tohum, baslayan: baslayan, sira: baslayan, faz: 'at', deste: deste, gosterge: gosterge, okey: okey,
      eller: eller, atik: [[], [], [], []], alinan: [[], [], [], []], yasak: null, hamle: 0, bitti: null
    };
  }
  function oncekiOyuncu(p) { return (p + 3) % 4; }

  // Taş çek: kaynak 'deste' | 'iskarta' (önceki oyuncunun son ıskartası). Çekilen kimliği döndürür, olmazsa null.
  function cek(d, kaynak) {
    if (d.bitti || d.faz !== 'cek') return null;
    var p = d.sira, id;
    if (kaynak === 'iskarta') {
      var yigin = d.atik[oncekiOyuncu(p)];
      if (!yigin.length) return null;
      id = yigin.pop();
      d.alinan[p].push(indeks(id, d.okey));
      d.yasak = id;
    } else {
      if (!d.deste.length) return null;
      id = d.deste.shift();
      d.yasak = null;
    }
    d.eller[p].push(id);
    d.faz = 'at';
    return id;
  }
  // Taş at; eli bitiriyorsa d.bitti yazılır. Dönüş: { ok, bitti, hata }.
  function at(d, id, ayar) {
    if (d.bitti || d.faz !== 'at') return { ok: false, hata: 'faz' };
    var p = d.sira, el = d.eller[p], n = el.indexOf(id);
    if (n < 0) return { ok: false, hata: 'yok' };
    if (d.yasak === id) return { ok: false, hata: 'yasak' };
    el.splice(n, 1);
    var y = yuz(id, d.okey);
    var sonuc = null;
    if (!(y.joker && !ayar.okeyAtarak)) {
      var tur = bitisTuru(el, d.okey, ayar);
      if (tur) sonuc = { kazanan: p, tur: tur, okeyle: y.joker, puan: elPuani(tur, y.joker), atilan: id, el: el.slice() };
    }
    d.hamle++;
    d.yasak = null;
    if (sonuc) {
      d.atik[p].push(id);
      d.bitti = sonuc;
      return { ok: true, bitti: true };
    }
    d.atik[p].push(id);
    d.sira = (p + 1) % 4;
    d.faz = 'cek';
    if (!d.deste.length) d.bitti = { kazanan: -1, tur: 'berabere', okeyle: false, puan: 0 };
    return { ok: true, bitti: !!d.bitti };
  }

  // Bir oyuncunun göreceği durum: başkalarının eli ve deste sırası yoktur.
  function gorunum(d, p) {
    return {
      oyuncu: p, el: d.eller[p].slice(), okey: d.okey, gosterge: d.gosterge,
      atik: d.atik.map(function (l) { return l.slice(); }), alinan: d.alinan.map(function (l) { return l.slice(); }),
      desteSayisi: d.deste.length, yasak: d.yasak
    };
  }

  // ---------- Bilgisayar rakipler ----------
  var P = { kapsanan: 10, joker: 6 };

  // Yarım per değeri; bilinmeyen kalan taş sayısına göre (gor: görülen yüz sayımı) ölçeklenir.
  function ciftDegeri(a, b, gor) {
    var ra = Math.floor(a / 14), sa = a % 14, rb = Math.floor(b / 14), sb = b % 14, taban = 0, outs = [];
    if (ra === rb) {
      var lo = Math.min(sa, sb), hi = Math.max(sa, sb), d = hi - lo;
      if (d === 1) {
        taban = (lo === 1 || hi === 13) ? 7 : 9;
        if (lo > 1) outs.push(ra * 14 + lo - 1);
        if (hi < 13) outs.push(ra * 14 + hi + 1); else if (lo === 12) outs.push(ra * 14 + 1);
      } else if (d === 2) { taban = 6; outs.push(ra * 14 + lo + 1); }
      else if (lo === 1 && hi === 13) { taban = 7; outs.push(ra * 14 + 12); }
      else return 0;
    } else if (sa === sb) {
      taban = 7;
      for (var c = 0; c < 4; c++) if (c !== ra && c !== rb) outs.push(c * 14 + sa);
    } else return 0;
    if (!gor) return taban;
    var kalan = 0;
    outs.forEach(function (o) { kalan += Math.max(0, 2 - gor[o]); });
    var tam = outs.length * 2;
    return tam ? taban * (0.35 + 0.65 * kalan / tam) : taban;
  }
  function eslesmePuani(artan, gor) {
    var cift = [];
    for (var i = 0; i < artan.length; i++) for (var j = i + 1; j < artan.length; j++) {
      var v = ciftDegeri(artan[i], artan[j], gor);
      if (v > 0) cift.push([v, i, j]);
    }
    cift.sort(function (a, b) { return b[0] - a[0]; });
    var kullanilan = {}, toplam = 0;
    cift.forEach(function (c) {
      if (kullanilan[c[1]] || kullanilan[c[2]]) return;
      kullanilan[c[1]] = kullanilan[c[2]] = true;
      toplam += c[0];
    });
    return toplam;
  }
  // El değeri (yüksek iyi): per içindeki taşlar + yarım perler + elde tutulan okeyler.
  function degerlendir(ids, okey, gor) {
    var sy = sayim(ids, okey), r = ara(sy.cnt, sy.J);
    return { puan: r.kapsanan * P.kapsanan + eslesmePuani(r.artan, gor) + r.artanJ * P.joker, kapsanan: r.kapsanan, toplam: ids.length };
  }
  // Çifteci için: çift sayısı (okey eşleştirmeli).
  function ciftSayisi(ids, okey) {
    var sy = sayim(ids, okey), cift = 0, tek = 0;
    for (var i = 0; i < 56; i++) { cift += Math.floor(sy.cnt[i] / 2); tek += sy.cnt[i] % 2; }
    var e = Math.min(sy.J, tek);
    return cift + e + Math.floor((sy.J - e) / 2);
  }

  // Görülen taşların (ıskartalar, gösterge, kendi elim) yüz sayımı.
  function goruleni(g) {
    var gor = new Int8Array(56);
    function ekle(id) { gor[indeks(id, g.okey)]++; }
    g.atik.forEach(function (l) { l.forEach(ekle); });
    ekle(g.gosterge);
    g.el.forEach(ekle);
    return gor;
  }

  function tehlike(id, g, sonraki) {
    var y = yuz(id, g.okey), t = 0;
    (g.alinan[sonraki] || []).forEach(function (k) {
      var r = Math.floor(k / 14), s = k % 14;
      if (r === y.r && Math.abs(s - y.s) <= 2 && s !== y.s) t += 4;
      else if (r !== y.r && s === y.s) t += 3;
    });
    return Math.min(8, t);
  }

  function tekTaslar(ids, okey) {
    var gorulen = {}, l = [];
    ids.forEach(function (id) {
      var y = yuz(id, okey), k = y.joker ? 'J' : y.r * 14 + y.s;
      if (!gorulen[k]) { gorulen[k] = true; l.push(id); }
    });
    return l;
  }
  function cikar(ids, id) { var n = ids.indexOf(id); return ids.slice(0, n).concat(ids.slice(n + 1)); }

  function ayarlar(seviye, stil) {
    var zor = seviye === 'zor', kolay = seviye === 'kolay';
    return {
      kolay: kolay, zor: zor,
      gurultu: kolay ? 14 : 0,
      tehlike: stil === 'temkinli' ? (zor ? 1 : 0.5) : (zor ? 0.5 : 0),
      esik: (kolay ? 16 : zor ? 5 : 7) + (stil === 'temkinli' ? 2 : stil === 'saldirgan' ? -2 : 0),
      bitisKacirma: kolay ? 0.35 : 0
    };
  }

  // Çekme kararı: 'iskarta' | 'deste'. g = gorunum (el 14 taş).
  function yzAl(g, ayar, seviye, stil, tohum) {
    var son = g.atik[oncekiOyuncu(g.oyuncu)];
    if (!son.length) return 'deste';
    var ust = son[son.length - 1], rastgele = uretec(tohum), a = ayarlar(seviye, stil);
    var tum = g.el.concat([ust]);
    // hemen bitiriyor mu?
    if (bitisAdaylari(tum, g.okey, ayar).some(function (c) { return c.id !== ust; })) {
      if (rastgele() >= a.bitisKacirma) return 'iskarta';
    }
    var gor = a.zor ? goruleni(g) : null;
    var mevcut = degerlendir(g.el, g.okey, gor).puan;
    if (stil === 'cifteci' && ayar.cifte && ciftSayisi(g.el, g.okey) >= 3) {
      var yeniCift = ciftSayisi(tum, g.okey);
      return yeniCift > ciftSayisi(g.el, g.okey) ? 'iskarta' : 'deste';
    }
    var en = -1e9;
    tekTaslar(tum, g.okey).forEach(function (id) {
      if (id === ust) return;
      var p = degerlendir(cikar(tum, id), g.okey, gor).puan;
      if (p > en) en = p;
    });
    var kazanc = en - mevcut;
    if (a.kolay) kazanc += (rastgele() - 0.5) * 8;
    return kazanc >= a.esik ? 'iskarta' : 'deste';
  }

  // Atma kararı: { at: id }. g = gorunum (el 15 taş). Bitiriyorsa bitis: true.
  function yzAt(g, ayar, seviye, stil, tohum) {
    var rastgele = uretec(tohum), a = ayarlar(seviye, stil);
    var bitisler = bitisAdaylari(g.el, g.okey, ayar).filter(function (c) { return c.id !== g.yasak; });
    if (bitisler.length && rastgele() >= a.bitisKacirma) return { at: bitisler[0].id, bitis: true };
    var gor = a.zor ? goruleni(g) : null;
    var sonraki = (g.oyuncu + 1) % 4;
    var adaylar = tekTaslar(g.el, g.okey).filter(function (id) { return id !== g.yasak; });
    if (!adaylar.length) adaylar = g.el.slice();
    var ciftModu = stil === 'cifteci' && ayar.cifte && ciftSayisi(g.el, g.okey) >= 4;
    var en = -1e9, enId = adaylar[0];
    adaylar.forEach(function (id) {
      var kalan = cikar(g.el, id), puan;
      if (ciftModu) puan = ciftSayisi(kalan, g.okey) * 30 + degerlendir(kalan, g.okey, gor).puan * 0.2;
      else puan = degerlendir(kalan, g.okey, gor).puan;
      if (a.tehlike) puan -= a.tehlike * tehlike(id, g, sonraki);
      if (a.gurultu) puan += (rastgele() - 0.5) * a.gurultu * 2;
      puan += rastgele() * 0.01;
      if (puan > en) { en = puan; enId = id; }
    });
    return { at: enId, bitis: false };
  }

  // Tüm koltukları bilgisayar oynatır (test ve ölçüm). seviyeler/stiller: 4'lük diziler.
  function simule(seviyeler, stiller, tohum, ayar, baslayan, enFazla) {
    ayar = ayar || VARSAYILAN_AYAR;
    var d = yeniEl(tohum, baslayan || 0), adim = 0;
    while (!d.bitti && adim++ < (enFazla || 400)) {
      var p = d.sira, g, karar;
      if (d.faz === 'cek') {
        g = gorunum(d, p);
        karar = yzAl(g, ayar, seviyeler[p], stiller[p], karma(tohum, d.hamle, p, 1));
        if (cek(d, karar) === null) cek(d, 'deste');
      }
      g = gorunum(d, p);
      karar = yzAt(g, ayar, seviyeler[p], stiller[p], karma(tohum, d.hamle, p, 2));
      at(d, karar.at, ayar);
    }
    return d;
  }

  var OkeyMantik = {
    TOPLAM: TOPLAM, YUVA: YUVA, RENK_ADLARI: RENK_ADLARI, SEVIYELER: SEVIYELER, SEVIYE_ADI: SEVIYE_ADI, STILLER: STILLER,
    STIL_ADI: STIL_ADI, RAKIPLER: RAKIPLER, VARSAYILAN_AYAR: VARSAYILAN_AYAR,
    uretec: uretec, karma: karma, gunTohumu: gunTohumu, karistir: karistir,
    tamTakim: tamTakim, sahteMi: sahteMi, renkOf: renkOf, sayiOf: sayiOf, okeyBelirle: okeyBelirle, yuz: yuz,
    jokerMi: jokerMi, indeks: indeks, sayim: sayim,
    grupTuru: grupTuru, perlereBol: perlereBol, cifteMi: cifteMi, ciftGruplari: ciftGruplari, bitisTuru: bitisTuru,
    bitisAdaylari: bitisAdaylari, elPuani: elPuani, macKazanani: macKazanani,
    enIyiDizilis: enIyiDizilis, seriDiz: seriDiz, ciftDiz: ciftDiz,
    yeniEl: yeniEl, oncekiOyuncu: oncekiOyuncu, cek: cek, at: at, gorunum: gorunum,
    degerlendir: degerlendir, ciftSayisi: ciftSayisi, yzAl: yzAl, yzAt: yzAt, simule: simule
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = OkeyMantik;
  else kok.OkeyMantik = OkeyMantik;
})(this);
