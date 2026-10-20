// Tavla'nın saf oyun mantığı: kurallar, hamle üretici, mars ve yapay zekâ değerlendirmesi.
// Tarayıcıda window.TavlaMantik, Web Worker'da self.TavlaMantik, Node testlerinde module.exports.
//
// Tahta gösterimi: t = [oyuncu0, oyuncu1]; her biri 26 elemanlı dizi ve her oyuncu tahtayı kendi
// gözünden görür. 1..24 hane numarası (24 en uzak, 1 evin dibi), 25 = bar (kırık taşlar), 0 = toplanan.
// Bir oyuncunun i. hanesi rakibin (25 − i). hanesidir. Oyuncu 0 insan (kemik), oyuncu 1 bilgisayar.
(function (kok) {
  var TAS = 15;
  var BAR = 25;
  var SEVIYELER = ['kolay', 'orta', 'zor'];
  var SEVIYE_ADI = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor' };
  var MAC_UZUNLUKLARI = [3, 5];
  var ZOR_ADAY = 6; // Zor seviyede iki katlı aramaya giren en iyi aday sayısı

  // 21 farklı zar atışı ve ağırlıkları (çiftler 1/36, diğerleri 2/36).
  var ATISLAR = [];
  for (var a = 1; a <= 6; a++) for (var b = a; b <= 6; b++) ATISLAR.push([a, b, a === b ? 1 : 2]);

  function baslangic() {
    function dizi() {
      var d = new Array(26).fill(0);
      d[24] = 2; d[13] = 5; d[8] = 3; d[6] = 5;
      return d;
    }
    return [dizi(), dizi()];
  }

  function kopya(t) { return [t[0].slice(), t[1].slice()]; }
  // Konum anahtarı: her hane bir karakter (taş sayısı en fazla 15); join'den çok daha hızlıdır.
  function anahtar(t) {
    return String.fromCharCode.apply(null, t[0]) + String.fromCharCode.apply(null, t[1]);
  }

  // Bütün taşlar evde mi (1..6 ya da toplanmış)? Toplamaya başlamanın şartı.
  function evdeMi(d) {
    for (var i = 7; i <= BAR; i++) if (d[i]) return false;
    return true;
  }

  // Tek zarla tek taş oynatır. Geçersizse null; geçerliyse yeni tahta, hedef hane ve kırma bilgisi.
  function adim(t, p, den, zar) {
    var ben = t[p], rakip = t[1 - p];
    if (den < 1 || den > BAR || ben[den] <= 0) return null;
    if (ben[BAR] > 0 && den !== BAR) return null; // kırık taş varken önce o girer
    var hedef = den - zar;
    var y;
    if (hedef >= 1) {
      var karsi = 25 - hedef;
      if (rakip[karsi] >= 2) return null; // kapı: rakibin iki ya da daha fazla taşı var
      y = kopya(t);
      y[p][den]--; y[p][hedef]++;
      var vurus = false;
      if (y[1 - p][karsi] === 1) { y[1 - p][karsi] = 0; y[1 - p][BAR]++; vurus = true; }
      return { t: y, hedef: hedef, vurus: vurus };
    }
    // Toplama: bütün taşlar evde olmalı; zar fazlaysa yalnızca en uzaktaki taş toplanabilir.
    if (!evdeMi(ben)) return null;
    if (hedef < 0) for (var i = den + 1; i <= 6; i++) if (ben[i]) return null;
    y = kopya(t);
    y[p][den]--; y[p][0]++;
    return { t: y, hedef: 0, vurus: false };
  }

  function zarListesi(zarlar) {
    return zarlar[0] === zarlar[1] ? [zarlar[0], zarlar[0], zarlar[0], zarlar[0]] : [zarlar[0], zarlar[1]];
  }

  function cikar(liste, zar) {
    var i = liste.indexOf(zar);
    return liste.slice(0, i).concat(liste.slice(i + 1));
  }

  // Zarla oynanabilecek bütün geçerli tam hamleler; aynı sonuca varanlar tekilleştirilir.
  // Kurallar: zarlar mümkün olduğunca çok kullanılır (çiftte dört hamle); iki zardan yalnızca biri
  // oynanabiliyorsa ve ikisi de tek başına oynanabiliyorsa büyük zar oynanır. Hamle yoksa boş liste.
  function oyunlar(t, p, zarlar) {
    var sonuclar = new Map();
    var gorulen = new Set();
    var enUzun = 0;
    function ara(dt, kalan, adimlar) {
      var ilerledi = false;
      var denenen = {};
      for (var k = 0; k < kalan.length; k++) {
        var z = kalan[k];
        if (denenen[z]) continue;
        denenen[z] = true;
        var yeniKalan = cikar(kalan, z);
        var ust = dt[p][BAR] > 0 ? BAR : 24;
        var alt = dt[p][BAR] > 0 ? BAR : 1;
        for (var den = ust; den >= alt; den--) {
          if (!dt[p][den]) continue;
          var s = adim(dt, p, den, z);
          if (!s) continue;
          ilerledi = true;
          var anh = anahtar(s.t) + yeniKalan.join('');
          if (gorulen.has(anh)) continue;
          gorulen.add(anh);
          ara(s.t, yeniKalan, adimlar.concat([{ den: den, hedef: s.hedef, zar: z, vurus: s.vurus }]));
        }
      }
      if (!ilerledi && adimlar.length) {
        var son = anahtar(dt);
        if (!sonuclar.has(son) || sonuclar.get(son).adimlar.length < adimlar.length) sonuclar.set(son, { adimlar: adimlar, t: dt });
        if (adimlar.length > enUzun) enUzun = adimlar.length;
      }
    }
    ara(t, zarListesi(zarlar), []);
    var liste = [];
    sonuclar.forEach(function (o) { if (o.adimlar.length === enUzun) liste.push(o); });
    if (enUzun === 1 && zarlar[0] !== zarlar[1]) {
      var buyuk = Math.max(zarlar[0], zarlar[1]);
      var buyukle = liste.filter(function (o) { return o.adimlar[0].zar === buyuk; });
      if (buyukle.length) liste = buyukle;
    }
    return liste;
  }

  // Turun başındaki tahtadan, yapılan adımlardan sonra kalan zarlar.
  function kalanZarlar(zarlar, yapilan) {
    var kalan = zarListesi(zarlar);
    yapilan.forEach(function (a) { kalan = cikar(kalan, a.zar); });
    return kalan;
  }

  function adimlariUygula(t, p, yapilan) {
    var dt = t;
    yapilan.forEach(function (a) { dt = adim(dt, p, a.den, a.zar).t; });
    return dt;
  }

  // Tur içinde bir sonraki adım olarak oynanabilecek tek zarlık hamleler. Bir adım ancak sonunda
  // geçerli bir tam hamleye varılabiliyorsa sunulur; böylece arayüzde kural dışı hamle denenemez.
  function sonrakiAdimlar(t0, p, zarlar, yapilan, yasal) {
    yasal = yasal || oyunlar(t0, p, zarlar);
    if (!yasal.length) return [];
    var gereken = yasal[0].adimlar.length - yapilan.length;
    if (gereken <= 0) return [];
    var hedefler = new Set(yasal.map(function (o) { return anahtar(o.t); }));
    var dt = adimlariUygula(t0, p, yapilan);
    var kalan = kalanZarlar(zarlar, yapilan);
    var bellek = new Map();
    function ulasir(st, kln, kac) {
      if (kac === 0) return hedefler.has(anahtar(st));
      var anh = anahtar(st) + kln.join('');
      if (bellek.has(anh)) return bellek.get(anh);
      var sonuc = false;
      var denenen = {};
      for (var k = 0; k < kln.length && !sonuc; k++) {
        var z = kln[k];
        if (denenen[z]) continue;
        denenen[z] = true;
        for (var den = BAR; den >= 1 && !sonuc; den--) {
          var s = st[p][den] ? adim(st, p, den, z) : null;
          if (s && ulasir(s.t, cikar(kln, z), kac - 1)) sonuc = true;
        }
      }
      bellek.set(anh, sonuc);
      return sonuc;
    }
    var sonuc = [];
    var denenen = {};
    kalan.forEach(function (z) {
      if (denenen[z]) return;
      denenen[z] = true;
      for (var den = BAR; den >= 1; den--) {
        if (!dt[p][den]) continue;
        var s = adim(dt, p, den, z);
        if (s && ulasir(s.t, cikar(kalan, z), gereken - 1)) sonuc.push({ den: den, hedef: s.hedef, zar: z, vurus: s.vurus });
      }
    });
    return sonuc;
  }

  // Seçili haneden gidilebilecek hedefler; aynı taşla art arda zar kullanan zincirler de dahildir
  // (ör. 6-5 ile tek dokunuşta 11 hane). Her hedef için oynanacak adımlar sırayla verilir.
  function hedefSecenekleri(t0, p, zarlar, yapilan, den, yasal) {
    var sonuc = [];
    var gorulen = {};
    function genislet(yol, kaynak) {
      sonrakiAdimlar(t0, p, zarlar, yapilan.concat(yol), yasal).forEach(function (a) {
        if (a.den !== kaynak) return;
        var yeniYol = yol.concat([a]);
        if (!gorulen[a.hedef]) {
          gorulen[a.hedef] = true;
          sonuc.push({ hedef: a.hedef, adimlar: yeniYol });
        }
        if (a.hedef !== 0) genislet(yeniYol, a.hedef);
      });
    }
    genislet([], den);
    return sonuc;
  }

  function pip(d) {
    var toplam = 0;
    for (var i = 1; i <= BAR; i++) toplam += i * d[i];
    return toplam;
  }

  function enArka(d) {
    for (var i = BAR; i >= 1; i--) if (d[i]) return i;
    return 0;
  }

  // Oyun bitti mi? Bitmişse kazanan, mars (kaybeden hiç taş toplayamamış) ve kazanılan puan.
  function oyunSonucu(t) {
    for (var p = 0; p < 2; p++) {
      if (t[p][0] === TAS) {
        var mars = t[1 - p][0] === 0;
        return { kazanan: p, mars: mars, puan: mars ? 2 : 1 };
      }
    }
    return null;
  }

  // Değerlendirmede kullanılan hane ağırlıkları: ev kapıları ve 7'li (bar) hane değerli,
  // rakibin evindeki çapa (20, 21) arka taşları güvenceye alır.
  var KAPI_PUANI = [0, 1, 2, 3, 5, 7, 7, 6, 4, 2.5, 1.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1.5, 2.5, 4, 4, 2, 1, 1];

  function evKapilari(d) {
    var n = 0;
    for (var i = 1; i <= 6; i++) if (d[i] >= 2) n++;
    return n;
  }

  // Rakip sıradayken açık taşların (tek taş) kırılma riski, pip cinsinden beklenen kayıp.
  // Her zar atışı için vurulabilecek en pahalı açık taş sayılır; ara haneler kapalıysa birleşik zar sayılmaz.
  function acikRiski(ben, rakip) {
    var aciklar = [];
    for (var i = 1; i <= 24; i++) if (ben[i] === 1) aciklar.push(i);
    if (!aciklar.length) return 0;
    var rakipKapi = evKapilari(rakip);
    var vurucular = [];
    if (rakip[BAR] > 0) vurucular.push(BAR);
    else for (var j = 1; j <= 24; j++) if (rakip[j]) vurucular.push(j);
    function acik(j) { return j >= 1 && ben[25 - j] < 2; } // rakibin j hanesine konabilir mi
    var toplam = 0;
    for (var r = 0; r < ATISLAR.length; r++) {
      var a = ATISLAR[r][0], b = ATISLAR[r][1], w = ATISLAR[r][2];
      var enPahali = 0;
      for (var k = 0; k < aciklar.length; k++) {
        var i2 = aciklar[k];
        var hedefJ = 25 - i2; // açık taşın rakibin gözündeki hanesi
        var vurur = false;
        for (var v = 0; v < vurucular.length && !vurur; v++) {
          var mesafe = vurucular[v] - hedefJ;
          if (mesafe <= 0) continue;
          var j0 = vurucular[v];
          if (a === b) {
            for (var n = 1; n <= 4; n++) {
              if (n > 1 && !acik(j0 - a * (n - 1))) break;
              if (mesafe === a * n) { vurur = true; break; }
            }
          } else if (mesafe === a || mesafe === b) vurur = true;
          else if (mesafe === a + b && (acik(j0 - a) || acik(j0 - b))) vurur = true;
        }
        if (vurur) {
          var maliyet = (25 - i2) + 4 + rakipKapi * 2;
          if (maliyet > enPahali) enPahali = maliyet;
        }
      }
      toplam += w * enPahali;
    }
    return toplam / 36;
  }

  // En uzun ardışık kapı dizisi (engel).
  function engelUzunlugu(d) {
    var enUzun = 0, simdiki = 0;
    for (var i = 1; i <= 24; i++) {
      if (d[i] >= 2) { simdiki++; if (simdiki > enUzun) enUzun = simdiki; } else simdiki = 0;
    }
    return enUzun;
  }

  // Orta seviyenin kaba açık taş cezası: rakibin önünde 12 hane içinde duran her açık taş sayılır,
  // zar olasılığı hesaplanmaz.
  function basitAcikCezasi(ben, rakip) {
    var ceza = 0;
    for (var i = 1; i <= 24; i++) {
      if (ben[i] !== 1) continue;
      for (var m = 1; m <= 12; m++) {
        var j = 25 - i + m;
        if (j <= BAR && rakip[j]) { ceza += 5 + (25 - i) * 0.3; break; }
      }
    }
    return ceza;
  }

  // p'nin hamlesini bitirdiği, sıranın rakipte olduğu konumun p açısından değeri (büyük = iyi).
  // basit true ise Orta seviyenin kaba sezgisi kullanılır (açık taş, kapı, ilerleme).
  function degerlendir(t, p, basit) {
    var ben = t[p], rakip = t[1 - p];
    if (ben[0] === TAS) return 10000 + (rakip[0] === 0 ? 5000 : 0);
    if (rakip[0] === TAS) return -10000 - (ben[0] === 0 ? 5000 : 0);
    var pipBen = pip(ben), pipRakip = pip(rakip);
    var temas = enArka(ben) + enArka(rakip) > 25;
    if (!temas) {
      // Yarış: kalan yol ve tahtadaki taş sayısı; hiç taş toplamadan mars riskine ceza.
      var s = (pipRakip + 2.5 * (TAS - rakip[0])) - (pipBen + 2.5 * (TAS - ben[0]));
      if (ben[0] === 0) s -= rakip[0] * 1.5;
      if (rakip[0] === 0) s += ben[0] * 1.5;
      return s;
    }
    var deger = pipRakip - pipBen;
    if (basit) {
      for (var b = 1; b <= 24; b++) if (ben[b] >= 2) deger += b <= 7 ? 4 : 1.5;
      return deger - basitAcikCezasi(ben, rakip) + (ben[0] - rakip[0]) * 1.5;
    }
    for (var i = 1; i <= 24; i++) {
      if (ben[i] >= 2) deger += KAPI_PUANI[i];
      if (ben[i] > 3) deger -= (ben[i] - 3) * 1.2;
    }
    var engel = engelUzunlugu(ben);
    if (engel >= 3) deger += (engel - 2) * (engel - 2) * 2.5;
    deger -= acikRiski(ben, rakip) * 1.15;
    deger += acikRiski(rakip, ben) * 0.2;
    if (rakip[BAR] > 0) deger += rakip[BAR] * (3 + evKapilari(ben) * evKapilari(ben) * 1.2);
    if (ben[BAR] > 0) deger -= ben[BAR] * evKapilari(rakip) * evKapilari(rakip) * 1.2;
    deger += (ben[0] - rakip[0]) * 1.5;
    return deger;
  }

  // Rakip sıradayken konumun p için beklenen değeri: 21 zar atışında rakibin en iyi cevabı.
  function beklenenDeger(t, p) {
    var q = 1 - p;
    var toplam = 0;
    for (var r = 0; r < ATISLAR.length; r++) {
      var cevaplar = oyunlar(t, q, [ATISLAR[r][0], ATISLAR[r][1]]);
      var enIyi = -Infinity;
      if (!cevaplar.length) enIyi = degerlendir(t, q);
      for (var c = 0; c < cevaplar.length; c++) {
        var d = degerlendir(cevaplar[c].t, q);
        if (d > enIyi) enIyi = d;
      }
      toplam += ATISLAR[r][2] * -enIyi;
    }
    return toplam / 36;
  }

  // Yapay zekânın seçtiği tam hamle (adımlar ve sonuç tahtası); hamle yoksa null.
  // Kolay: rastgele geçerli hamle. Orta: tek katlı sezgisel değerlendirme.
  // Zor: en iyi adaylar için rakibin 21 zar atışına karşı olasılık ağırlıklı arama.
  function yapayZekaHamlesi(t, p, zarlar, seviye, rastgele) {
    var liste = oyunlar(t, p, zarlar);
    if (!liste.length) return null;
    if (liste.length === 1) return liste[0];
    rastgele = rastgele || Math.random;
    if (seviye === 'kolay') return liste[Math.floor(rastgele() * liste.length)];
    var basit = seviye === 'orta';
    var puanli = liste.map(function (o) { return { o: o, d: degerlendir(o.t, p, basit) }; });
    puanli.sort(function (x, y) { return y.d - x.d; });
    if (seviye !== 'zor' || puanli[0].d >= 10000) return puanli[0].o;
    var enIyi = null, enIyiDeger = -Infinity;
    puanli.slice(0, ZOR_ADAY).forEach(function (aday) {
      var d = beklenenDeger(aday.o.t, p);
      if (d > enIyiDeger) { enIyiDeger = d; enIyi = aday.o; }
    });
    return enIyi;
  }

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

  function zarAt(rastgele) {
    return [1 + Math.floor(rastgele() * 6), 1 + Math.floor(rastgele() * 6)];
  }

  // Açılış: iki taraf birer zar atar, büyük atan başlar; eşitlikte yeniden atılır.
  function acilisZari(rastgele) {
    for (;;) {
      var z = zarAt(rastgele);
      if (z[0] !== z[1]) return { zarlar: z, baslayan: z[0] > z[1] ? 0 : 1 };
    }
  }

  // Türkçe zar adları: yek, dü, se, cihar, penç, şeş; çiftlerin kendi adları vardır.
  var ZAR_ADLARI = ['', 'yek', 'dü', 'se', 'cihar', 'penç', 'şeş'];
  var CIFT_ADLARI = ['', 'Hep yek', 'Dubara', 'Dü-se', 'Dört-cihar', 'Dü-beş', 'Dü-şeş'];
  function zarAdi(zarlar) {
    var a = Math.max(zarlar[0], zarlar[1]), b = Math.min(zarlar[0], zarlar[1]);
    if (a === b) return CIFT_ADLARI[a];
    if (a === 6 && b === 5) return 'Şeş-beş';
    var ad = ZAR_ADLARI[a] + '-' + ZAR_ADLARI[b];
    return ad.charAt(0).toLocaleUpperCase('tr') + ad.slice(1);
  }

  // İki yapay zekâyı birbirine karşı bir oyun oynatır (test ve ölçüm betiği için).
  function oyunSimule(seviyeler, tohum, enFazlaTur) {
    var rastgele = uretec(tohum);
    var t = baslangic();
    var acilis = acilisZari(rastgele);
    var sira = acilis.baslayan;
    var zarlar = acilis.zarlar;
    enFazlaTur = enFazlaTur || 2000;
    for (var tur = 0; tur < enFazlaTur; tur++) {
      var hamle = yapayZekaHamlesi(t, sira, zarlar, seviyeler[sira], rastgele);
      if (hamle) t = hamle.t;
      var sonuc = oyunSonucu(t);
      if (sonuc) { sonuc.tur = tur + 1; return sonuc; }
      sira = 1 - sira;
      zarlar = zarAt(rastgele);
    }
    return null;
  }

  function yeniIstatistik() {
    return { mac: 0, macKazanilan: 0, oyun: 0, oyunKazanilan: 0, marsYapilan: 0, marsYenilen: 0 };
  }

  // Biten oyunu (ve maç bittiyse maçı) istatistiğe işler; kazanan 0 ise oyuncu kazanmıştır.
  function istatistikIsle(ist, sonuc, macBitti, macKazanildi) {
    var yeni = Object.assign(yeniIstatistik(), ist || {});
    yeni.oyun++;
    if (sonuc.kazanan === 0) { yeni.oyunKazanilan++; if (sonuc.mars) yeni.marsYapilan++; }
    else if (sonuc.mars) yeni.marsYenilen++;
    if (macBitti) { yeni.mac++; if (macKazanildi) yeni.macKazanilan++; }
    return yeni;
  }

  var TavlaMantik = {
    TAS: TAS, BAR: BAR, SEVIYELER: SEVIYELER, SEVIYE_ADI: SEVIYE_ADI, MAC_UZUNLUKLARI: MAC_UZUNLUKLARI, ATISLAR: ATISLAR,
    baslangic: baslangic, kopya: kopya, anahtar: anahtar, evdeMi: evdeMi, adim: adim, zarListesi: zarListesi,
    oyunlar: oyunlar, kalanZarlar: kalanZarlar, adimlariUygula: adimlariUygula, sonrakiAdimlar: sonrakiAdimlar,
    hedefSecenekleri: hedefSecenekleri, pip: pip, oyunSonucu: oyunSonucu, degerlendir: degerlendir,
    yapayZekaHamlesi: yapayZekaHamlesi, uretec: uretec, zarAt: zarAt, acilisZari: acilisZari, zarAdi: zarAdi,
    oyunSimule: oyunSimule, yeniIstatistik: yeniIstatistik, istatistikIsle: istatistikIsle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TavlaMantik;
  else kok.TavlaMantik = TavlaMantik;
})(this);
