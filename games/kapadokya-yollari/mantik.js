// Kapadokya Yolları'nın saf oyun mantığı (three.js'siz): tohumlu gürültü, yol ve arazi üretimi,
// araç fiziği, ralli zamanlaması, hayalet kaydı ve rekorlar. Tarayıcıda window.KapadokyaMantik,
// Node testlerinde module.exports.
(function (kok) {
  'use strict';

  var ADIM = 4;            // yol örnekleri arası mesafe (m)
  var BLOK = 64;           // bir yol bloğundaki örnek sayısı (256 m)
  var YOL_YARI = 4;        // asfalt yarı genişliği (m)
  var OMUZ = 2;            // asfalt kenarından arazi seviyesine inen omuz genişliği (m)
  var YOL_ALTI = 0.35;     // arazi yolun bu kadar altında düzlenir, asfalt hep üstte kalır
  var DUZ_YARICAP = 14;    // arazinin yol yüksekliğine tamamen düzlendiği mesafe
  var GECIS_YARICAP = 34;  // düzlemenin bittiği mesafe
  var KAFES = 8;           // arazi ızgara aralığı (m); örgü ve fizik aynı üçgenleri kullanır
  var PARCA_KAFES = 12;    // bir arazi parçasının kenarındaki kafes sayısı
  var PARCA = KAFES * PARCA_KAFES; // 96 m
  var MAKS_YON = 1.05;     // yolun kuzeyden en fazla sapma açısı (rad); yol kendini kesmez
  var EGRI = 1 / 58;       // en büyük eğrilik (1/m)

  var KN_SAYISI = 8;
  var KN_ARALIK = 300;
  var KN_GENISLIK = 9;     // kontrol noktası kapısının yarı genişliği (m)
  var RALLI_BASLANGIC = 60;
  var HAYALET_ARALIK = 0.1; // hayalet örnekleme aralığı (sn)
  var KAYIT_SINIRI = 8;    // en fazla bu kadar parkurun rekoru saklanır
  var BASLANGIC_GUNU = Date.UTC(2026, 9, 20); // 20 Ekim 2026: 1 numaralı günlük parkur

  // ---------- Tohumlu rastgelelik ve gürültü ----------

  function karistir(a, b, c) {
    var h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }

  // mulberry32: aynı tohum her zaman aynı diziyi verir.
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

  function yumusak(t) { return t * t * (3 - 2 * t); }
  function sinirla(v, a, b) { return v < a ? a : v > b ? b : v; }
  function adimYumusak(a, b, v) { return yumusak(sinirla((v - a) / (b - a), 0, 1)); }

  // 2B değer gürültüsü, 0..1
  function gurultu2(x, z, tohum) {
    var ix = Math.floor(x), iz = Math.floor(z);
    var fx = yumusak(x - ix), fz = yumusak(z - iz);
    var a = karistir(ix, iz, tohum), b = karistir(ix + 1, iz, tohum);
    var c = karistir(ix, iz + 1, tohum), d = karistir(ix + 1, iz + 1, tohum);
    var ust = a + (b - a) * fx, alt = c + (d - c) * fx;
    return (ust + (alt - ust) * fz) / 4294967296;
  }

  // 1B değer gürültüsü, -1..1
  function gurultu1(x, tohum) {
    var i = Math.floor(x), f = yumusak(x - i);
    var a = karistir(i, 7, tohum) / 4294967296, b = karistir(i + 1, 7, tohum) / 4294967296;
    return (a + (b - a) * f) * 2 - 1;
  }

  function fbm2(x, z, tohum, oktav) {
    var top = 0, genlik = 0.5, toplamGenlik = 0;
    for (var o = 0; o < oktav; o++) {
      top += gurultu2(x, z, tohum + o * 101) * genlik;
      toplamGenlik += genlik;
      x *= 2.03; z *= 2.03; genlik *= 0.5;
    }
    return top / toplamGenlik;
  }

  // Yol düzlemesinden önceki doğal arazi: geniş tepeler, küçük tümsekler ve kumlu vadi çizgileri.
  function vadiDegeri(x, z, tohum) { return Math.abs(gurultu2(x / 260, z / 260, tohum + 37) * 2 - 1); }
  function hamYukseklik(x, z, tohum) {
    var genis = fbm2(x / 420, z / 420, tohum + 11, 3);
    var tepe = fbm2(x / 130, z / 130, tohum + 23, 3);
    var vadi = Math.min(1, vadiDegeri(x, z, tohum) * 3);
    return (genis - 0.5) * 70 + (tepe - 0.5) * 22 - (1 - vadi) * (1 - vadi) * 18;
  }

  // ---------- Yol ----------
  // Yol 4 m'lik örneklerden oluşur; eğrilik gürültüden gelir. Bloklar (256 m) gerektiğinde üretilir ve
  // arabadan uzaklaşınca silinir; yalnızca blok başlangıç durumları kalır, böylece bellek sabit kalır
  // ve geri dönülürse blok aynen yeniden üretilir.

  function Yol(tohum) {
    this.tohum = tohum >>> 0;
    this.bloklar = new Map();
    var e = hamYukseklik(0, 0, this.tohum);
    this.baslar = [{ x: 0, z: 0, yon: 0, e: e }];
  }

  Yol.prototype._uret = function (b) {
    var d = this.baslar[b];
    var x = d.x, z = d.z, yon = d.yon, e = d.e, t = this.tohum;
    var blok = { x: new Float64Array(BLOK + 1), z: new Float64Array(BLOK + 1), yon: new Float64Array(BLOK + 1), y: new Float64Array(BLOK + 1) };
    for (var j = 0; j <= BLOK; j++) {
      blok.x[j] = x; blok.z[j] = z; blok.yon[j] = yon; blok.y[j] = e;
      if (j === BLOK) break;
      var s = (b * BLOK + j) * ADIM;
      var giris = adimYumusak(100, 260, s); // başlangıçta düz bir çıkış
      var k = giris * EGRI * (gurultu1(s / 240, t + 1) * 0.85 + gurultu1(s / 70, t + 2) * 0.45) - yon * 0.012;
      yon = sinirla(yon + k * ADIM, -MAKS_YON, MAKS_YON);
      x += Math.sin(yon) * ADIM;
      z += Math.cos(yon) * ADIM;
      e += sinirla((hamYukseklik(x, z, t) - e) * 0.1, -0.28, 0.28); // en fazla %7 eğim
    }
    if (!this.baslar[b + 1]) this.baslar[b + 1] = { x: x, z: z, yon: yon, e: e };
    return blok;
  };

  Yol.prototype.blok = function (b) {
    var blok = this.bloklar.get(b);
    if (blok) return blok;
    for (var i = this.baslar.length - 1; i < b; i++) if (!this.baslar[i + 1]) this.bloklar.set(i, this._uret(i));
    blok = this.bloklar.get(b) || this._uret(b);
    this.bloklar.set(b, blok);
    return blok;
  };

  // i. örnek (blok sınırındaki örnek iki blokta da aynıdır)
  Yol.prototype.ornek = function (i) {
    var b = Math.floor(i / BLOK), j = i - b * BLOK;
    var blok = this.blok(b);
    return { x: blok.x[j], z: blok.z[j], yon: blok.yon[j], y: blok.y[j] };
  };

  // Yol en az z + pay kuzeyine kadar üretilmiş olsun.
  Yol.prototype.kapsa = function (z) {
    while (this.baslar[this.baslar.length - 1].z < z + BLOK * ADIM) this.blok(this.baslar.length - 1);
  };

  // Merkez bloğa uzak blokları siler; başlangıç durumları kalır.
  Yol.prototype.buda = function (merkezBlok, pay) {
    var self = this;
    pay = pay == null ? 6 : pay;
    Array.from(this.bloklar.keys()).forEach(function (b) { if (Math.abs(b - merkezBlok) > pay) self.bloklar.delete(b); });
  };

  // s uzaklığındaki yol noktası (ara değerli).
  Yol.prototype.noktaS = function (s) {
    var f = Math.max(0, s) / ADIM, i = Math.floor(f), t = f - i;
    var a = this.ornek(i), b = this.ornek(i + 1);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, yon: a.yon + (b.yon - a.yon) * t };
  };

  // (x, z)'ye en yakın yol noktası: s (yol boyu konum), u (sağa pozitif yanal uzaklık), d (mesafe), y (yol yüksekliği).
  // Yol hep kuzeye ilerlediği için (z, s ile birlikte artar) yalnızca z'si yakın örneklere bakmak yeterlidir.
  Yol.prototype.yakin = function (x, z, yaricap) {
    yaricap = yaricap || GECIS_YARICAP + 4;
    var sonuc = { s: 0, u: Infinity, d: Infinity, y: 0, yon: 0 };
    if (z + yaricap < this.baslar[0].z) return sonuc;
    this.kapsa(z + yaricap);
    var baslar = this.baslar, lo = 0, hi = baslar.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (baslar[m].z <= z - yaricap) lo = m; else hi = m; }
    var enIyi = Infinity;
    for (var b = lo; b < baslar.length - 1 && baslar[b].z <= z + yaricap; b++) {
      var blok = this.blok(b);
      for (var j = 0; j < BLOK; j++) {
        var az = blok.z[j], bz = blok.z[j + 1];
        if (bz < z - yaricap || az > z + yaricap) continue;
        var ax = blok.x[j], bx = blok.x[j + 1];
        var dx = bx - ax, dz = bz - az, px = x - ax, pz = z - az;
        var t = sinirla((px * dx + pz * dz) / (dx * dx + dz * dz), 0, 1);
        var ex = px - dx * t, ez = pz - dz * t, d2 = ex * ex + ez * ez;
        if (d2 < enIyi) {
          enIyi = d2;
          var yon = blok.yon[j] + (blok.yon[j + 1] - blok.yon[j]) * t;
          sonuc.s = (b * BLOK + j + t) * ADIM;
          // sağ vektör (-cos, sin): u > 0 yolun sağı
          sonuc.u = -ex * Math.cos(yon) + ez * Math.sin(yon);
          sonuc.y = blok.y[j] + (blok.y[j + 1] - blok.y[j]) * t;
          sonuc.yon = yon;
        }
      }
    }
    sonuc.d = Math.sqrt(enIyi);
    if (!(sonuc.d <= yaricap)) { sonuc.d = Infinity; sonuc.u = Infinity; }
    return sonuc;
  };

  // ---------- Dünya: arazi yüksekliği ve nesneler ----------

  function Dunya(tohum) {
    this.tohum = tohum >>> 0;
    this.yol = new Yol(this.tohum);
    this._kafes = new Map(); // köşe yükseklik önbelleği (sınırlı)
  }

  // Kafes köşesindeki yükseklik: doğal arazi, yol yakınında yol seviyesine düzlenir.
  Dunya.prototype.kafesY = function (ix, iz) {
    var anahtar = ix * 1048576 + iz;
    var h = this._kafes.get(anahtar);
    if (h !== undefined) return h;
    if (this._kafes.size > 40000) this._kafes.clear();
    h = this._kafesHesapla(ix, iz);
    this._kafes.set(anahtar, h);
    return h;
  };

  Dunya.prototype._kafesHesapla = function (ix, iz) {
    var x = ix * KAFES, z = iz * KAFES;
    var ham = hamYukseklik(x, z, this.tohum);
    var q = this.yol.yakin(x, z);
    if (q.d >= GECIS_YARICAP) return ham;
    var w = adimYumusak(DUZ_YARICAP, GECIS_YARICAP, q.d);
    return (q.y - YOL_ALTI) * (1 - w) + ham * w;
  };

  // Arazi örgüsüyle birebir aynı üçgen ara değeri: hücre a-d köşegeniyle bölünür.
  Dunya.prototype.araziY = function (x, z) {
    var gx = x / KAFES, gz = z / KAFES, ix = Math.floor(gx), iz = Math.floor(gz);
    var fx = gx - ix, fz = gz - iz;
    var a = this.kafesY(ix, iz), d = this.kafesY(ix + 1, iz + 1);
    if (fx > fz) { var b = this.kafesY(ix + 1, iz); return a + (b - a) * fx + (d - b) * fz; }
    var c = this.kafesY(ix, iz + 1);
    return a + (c - a) * fz + (d - c) * fx;
  };

  // Aracın bastığı zemin: asfalt, omuz ve arazi birbirine yumuşakça bağlanır. yolPayi 1 = asfalt, 0 = arazi.
  Dunya.prototype.zemin = function (x, z) {
    var q = this.yol.yakin(x, z, 12);
    var mutlak = Math.abs(q.u);
    if (!(mutlak < YOL_YARI + OMUZ)) return { y: this.araziY(x, z), yolPayi: 0, yol: q };
    var yolY = q.y;
    if (mutlak <= YOL_YARI) return { y: yolY, yolPayi: 1, yol: q };
    var w = (mutlak - YOL_YARI) / OMUZ;
    return { y: yolY + (this.araziY(x, z) - yolY) * w, yolPayi: 1 - w, yol: q };
  };

  function parcaAnahtari(cx, cz) { return cx + ',' + cz; }

  // (x, z)'ye en yakın noktası yarıçap içinde kalan arazi parçaları, yakından uzağa.
  function gerekliParcalar(x, z, yaricap) {
    var liste = [];
    var c0x = Math.floor((x - yaricap) / PARCA), c1x = Math.floor((x + yaricap) / PARCA);
    var c0z = Math.floor((z - yaricap) / PARCA), c1z = Math.floor((z + yaricap) / PARCA);
    for (var cx = c0x; cx <= c1x; cx++) {
      for (var cz = c0z; cz <= c1z; cz++) {
        var nx = sinirla(x, cx * PARCA, (cx + 1) * PARCA), nz = sinirla(z, cz * PARCA, (cz + 1) * PARCA);
        var d = Math.hypot(nx - x, nz - z);
        if (d <= yaricap) liste.push({ cx: cx, cz: cz, anahtar: parcaAnahtari(cx, cz), mesafe: d });
      }
    }
    return liste.sort(function (a, b) { return a.mesafe - b.mesafe; });
  }

  // Bir parçadaki peribacaları, kayalar, kavaklar ve köy evleri. Aynı tohum ve parça hep aynı nesneleri verir.
  // r çarpışma yarıçapıdır; yolun dibine nesne konmaz.
  Dunya.prototype.parcaNesneleri = function (cx, cz) {
    var r = uretec(karistir(cx, cz, this.tohum + 991));
    var t = this.tohum, liste = [];
    var x0 = cx * PARCA, z0 = cz * PARCA;
    var koy = gurultu2(cx / 5.3, cz / 5.3, t + 555) > 0.72; // seyrek köyler
    var deneme = 26;
    for (var k = 0; k < deneme; k++) {
      var x = x0 + r() * PARCA, z = z0 + r() * PARCA;
      var vadi = vadiDegeri(x, z, t);
      var kume = gurultu2(x / 70, z / 70, t + 77);
      var secim = r(), olcek = 0.7 + r() * 0.8, aci = r() * Math.PI * 2;
      var tur = null, yaricap = 0;
      if (koy && secim < 0.35) { tur = 'ev'; yaricap = 3.2 * olcek; }
      else if (vadi < 0.35 && kume > 0.45 && secim < 0.85) { tur = 'peri'; yaricap = 2.4 * olcek; }
      else if (secim < 0.12 + (vadi < 0.2 ? 0.25 : 0)) { tur = 'kavak'; yaricap = 0.6; }
      else if (secim < 0.3) { tur = 'kaya'; yaricap = 1.6 * olcek; }
      if (!tur) continue;
      var q = this.yol.yakin(x, z);
      if (q.d < YOL_YARI + OMUZ + 5 + yaricap) continue;
      if (tur === 'ev' && q.d > 60) continue; // evler yola yakın durur
      liste.push({ tur: tur, x: x, z: z, y: this.araziY(x, z), olcek: olcek, aci: aci, r: yaricap, tohum: (r() * 1e9) >>> 0 });
    }
    return liste;
  };

  // ---------- Araç fiziği ----------
  // Hafif "arcade" modeli: hız dünyada tutulur, gövde döndükçe yanal kayma oluşur, sınırlı yanal tutuş bunu
  // düzeltir. Tutuşu aşan virajlar ve el freni drift'e yol açar.

  var ARAC = { motor: 10, fren: 26, geri: 7, azamiHiz: 44, aracBoyu: 2.6, direksiyon: 0.55 };

  function yeniArac(x, z, yon) {
    return { x: x, z: z, y: 0, yon: yon || 0, vx: 0, vz: 0, donus: 0, direksiyon: 0, ileriHiz: 0, yanHiz: 0, kayma: 0, boyIvme: 0, yanIvme: 0 };
  }

  // g: { gaz 0..1, fren 0..1, yon -1..1 (+ sağ), elFreni bool }, yolPayi 1 asfalt .. 0 arazi,
  // egim: ileri yöndeki yokuş (yükselme / mesafe); yokuş yukarı yavaşlatır, aşağı hızlandırır.
  function aracAdim(a, g, dt, yolPayi, egim) {
    var fx = Math.sin(a.yon), fz = Math.cos(a.yon), rx = -fz, rz = fx;
    var vf = a.vx * fx + a.vz * fz, vr = a.vx * rx + a.vz * rz;
    var yp = yolPayi == null ? 1 : yolPayi;
    var eskiVf = vf;

    a.direksiyon += (sinirla(g.yon || 0, -1, 1) - a.direksiyon) * Math.min(1, dt * 9);

    var azami = ARAC.azamiHiz * (0.55 + 0.45 * yp);
    var ivme = 0;
    var oran = Math.max(0, vf) / azami;
    if (g.gaz > 0) ivme += g.gaz * ARAC.motor * Math.max(0, 1 - oran * oran) * (vf < 0 ? 2 : 1);
    if (g.fren > 0) {
      if (vf > 0.6) ivme -= g.fren * ARAC.fren;
      else ivme -= g.fren * ARAC.geri * Math.max(0, 1 + vf / 9);
    }
    var surtunme = vf * (0.02 + (1 - yp) * 0.18) + vf * Math.abs(vf) * 0.0012;
    if (Math.abs(vf) > 0.05) surtunme += Math.sign(vf) * (0.3 + (1 - yp) * 0.8);
    ivme -= surtunme;
    if (egim) ivme -= 9.81 * egim / Math.sqrt(1 + egim * egim);
    var yeniVf = vf + ivme * dt;
    // Yalnızca sürtünme varken yön değiştirmesin
    if (!(g.gaz > 0) && !(g.fren > 0) && yeniVf * vf < 0) yeniVf = 0;
    if (g.elFreni) yeniVf -= Math.sign(yeniVf) * Math.min(Math.abs(yeniVf), 6 * dt);
    vf = yeniVf;

    var tutus = (6 + 2.5 * yp) * (g.elFreni ? 0.2 : 1);
    var azamiYanal = (9 + 11 * yp) * (g.elFreni ? 0.4 : 1);
    var dv = -vr * Math.min(1, tutus * dt);
    var sinir = azamiYanal * dt;
    dv = sinirla(dv, -sinir, sinir);
    var eskiVr = vr;
    vr += dv;
    // Lastik yanal hızın çoğunu ileri hıza çevirir (hız kaybı yalnızca kayarken olur).
    var donusen = (eskiVr * eskiVr - vr * vr) * (0.8 - (g.elFreni ? 0.5 : 0));
    if (donusen > 0 && Math.abs(vf) > 0.5) vf = Math.sign(vf) * Math.sqrt(vf * vf + donusen);

    var aci = a.direksiyon * ARAC.direksiyon / (1 + Math.abs(vf) / 24);
    var hiz = Math.sqrt(vf * vf + vr * vr);
    var hedefDonus = -vf * Math.tan(aci) / ARAC.aracBoyu;
    // Dönüş hızı tutuşla sınırlı; biraz fazlası arabayı kaydırır (drift hissi). El freni kuyruğu savurur.
    var donusSiniri = (9 + 11 * yp) * (g.elFreni ? 1.9 : 1.2) / Math.max(4, hiz);
    hedefDonus = sinirla(hedefDonus, -donusSiniri, donusSiniri);
    // Kendiliğinden toparlanma: burun yavaşça hız yönüne döner, araba fırıl fırıl dönmez.
    var kaymaAcisi = Math.atan2(vr, Math.abs(vf) + 2);
    hedefDonus -= kaymaAcisi * (g.elFreni ? 0.6 : 2.2) * Math.min(1, hiz / 6);
    var kayma = Math.abs(vr);
    a.donus += (hedefDonus - a.donus) * Math.min(1, dt * 10);
    a.yon += a.donus * dt;

    a.vx = fx * vf + rx * vr;
    a.vz = fz * vf + rz * vr;
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    a.ileriHiz = vf;
    a.yanHiz = vr;
    a.kayma = kayma;
    a.boyIvme = (vf - eskiVf) / dt;
    a.yanIvme = a.donus * vf + (vr - eskiVr) / dt * 0.2;
    return a;
  }

  // Görsel süspansiyon: ivmeye göre gövde öne/arkaya ve yana yatar, yaylı sönümle salınır.
  function yeniSuspansiyon() { return { egim: 0, egimHiz: 0, yalpa: 0, yalpaHiz: 0, cokme: 0, cokmeHiz: 0 }; }
  function suspansiyonAdim(s, boyIvme, yanIvme, dikeyIvme, dt) {
    var k = 90, c = 9;
    var hedefEgim = sinirla(-boyIvme * 0.0045, -0.06, 0.06);
    var hedefYalpa = sinirla(yanIvme * 0.006, -0.09, 0.09);
    var hedefCokme = sinirla(-dikeyIvme * 0.004, -0.12, 0.12);
    s.egimHiz += ((hedefEgim - s.egim) * k - s.egimHiz * c) * dt; s.egim += s.egimHiz * dt;
    s.yalpaHiz += ((hedefYalpa - s.yalpa) * k - s.yalpaHiz * c) * dt; s.yalpa += s.yalpaHiz * dt;
    s.cokmeHiz += ((hedefCokme - s.cokme) * 140 - s.cokmeHiz * 10) * dt; s.cokme += s.cokmeHiz * dt;
    return s;
  }

  // Motor sesi için vites ve devir (900..6800): vites atınca devir düşer.
  var VITESLER = [0, 11, 20, 28.5, 36, 42, 99];
  function vitesDevir(hiz) {
    var v = Math.abs(hiz), vites = 1;
    while (vites < VITESLER.length - 2 && v > VITESLER[vites]) vites++;
    var alt = vites === 1 ? 0 : VITESLER[vites - 1] * 0.82, ust = VITESLER[vites];
    var oran = sinirla((v - alt) / (ust - alt), 0, 1);
    return { vites: vites, devir: Math.round(900 + oran * 5900) };
  }

  // Araç ile nesne arasındaki dairesel çarpışma: aracı dışarı iter, hızı söndürür. Çarpma şiddetini döndürür.
  function carpismaCoz(a, nesneler, aracYaricap) {
    var ar = aracYaricap || 1.3, siddet = 0;
    for (var i = 0; i < nesneler.length; i++) {
      var n = nesneler[i];
      var dx = a.x - n.x, dz = a.z - n.z, sinir = n.r + ar;
      var d2 = dx * dx + dz * dz;
      if (d2 >= sinir * sinir || d2 === 0) continue;
      var d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      a.x = n.x + nx * sinir; a.z = n.z + nz * sinir;
      var vn = a.vx * nx + a.vz * nz;
      if (vn < 0) {
        a.vx -= vn * nx * 1.35; a.vz -= vn * nz * 1.35;
        a.vx *= 0.7; a.vz *= 0.7;
        siddet = Math.max(siddet, -vn);
      }
    }
    return siddet;
  }

  // ---------- Ralli ----------

  function bulmacaNo(tarih) {
    var gun = Date.UTC(tarih.getFullYear(), tarih.getMonth(), tarih.getDate());
    return Math.floor((gun - BASLANGIC_GUNU) / 86400000) + 1;
  }
  function gunlukTohum(tarih) { return karistir(bulmacaNo(tarih), 2026, 1021) % 1000000; }

  function ralliParkuru(tohum) {
    var kn = [];
    for (var i = 1; i <= KN_SAYISI; i++) kn.push(RALLI_BASLANGIC + i * KN_ARALIK);
    return { tohum: tohum >>> 0, baslangic: RALLI_BASLANGIC, kn: kn, bitis: kn[kn.length - 1] };
  }

  function ralliDurumu() { return { sonraki: 0, araSureler: [], bitti: false }; }

  // Bir fizik adımında aracın yol üzerindeki konumu onceki'den simdi'ye geçti. Sıradaki kapıdan
  // içeriden geçildiyse geçiş anını adım içinde ara değerle bulur ve kapı numarasını döndürür; yoksa -1.
  function ralliKontrol(durum, parkur, onceki, simdi, t0, dt) {
    if (durum.bitti) return -1;
    var hedef = parkur.kn[durum.sonraki];
    if (!(onceki.s < hedef && simdi.s >= hedef)) return -1;
    var oran = (hedef - onceki.s) / (simdi.s - onceki.s);
    var u = onceki.u + (simdi.u - onceki.u) * oran;
    if (Math.abs(u) > KN_GENISLIK) return -1;
    durum.araSureler.push(t0 + dt * oran);
    durum.sonraki++;
    if (durum.sonraki === parkur.kn.length) durum.bitti = true;
    return durum.sonraki - 1;
  }

  // Hayaletle fark: pozitif = hayaletten yavaş.
  function hayaletFarki(benim, onun, i) {
    if (!onun || onun[i] == null || benim[i] == null) return null;
    return benim[i] - onun[i];
  }

  function farkYaz(fark) {
    var mutlak = Math.round(Math.abs(fark) * 10) / 10;
    if (mutlak === 0) return '±0.0';
    return (fark > 0 ? '+' : '−') + mutlak.toFixed(1);
  }

  function sureYaz(sn) {
    if (sn == null || !isFinite(sn)) return '–';
    var ys = Math.floor(sn * 100 + 1e-6);
    var dk = Math.floor(ys / 6000), san = Math.floor(ys / 100) % 60, sal = ys % 100;
    return dk + ':' + String(san).padStart(2, '0') + '.' + String(sal).padStart(2, '0');
  }

  // ---------- Hayalet kaydı ----------

  function hayaletYeni() { return { aralik: HAYALET_ARALIK, v: [] }; }
  function hayaletEkle(h, x, z, yon) {
    h.v.push(Math.round(x * 10), Math.round(z * 10), Math.round(yon * 1000));
  }
  function hayaletUzunluk(h) { return h && h.v ? h.v.length / 3 : 0; }

  // t anındaki hayalet konumu; kayıt bitince son konumda kalır.
  function hayaletKonum(h, t) {
    var n = hayaletUzunluk(h);
    if (!n) return null;
    var f = Math.max(0, t / h.aralik), i = Math.floor(f), oran = f - i;
    if (i >= n - 1) { i = n - 1; oran = 0; }
    var j = Math.min(n - 1, i + 1), v = h.v;
    var y0 = v[i * 3 + 2] / 1000, y1 = v[j * 3 + 2] / 1000;
    var fark = y1 - y0;
    while (fark > Math.PI) fark -= Math.PI * 2;
    while (fark < -Math.PI) fark += Math.PI * 2;
    return {
      x: (v[i * 3] + (v[j * 3] - v[i * 3]) * oran) / 10,
      z: (v[i * 3 + 1] + (v[j * 3 + 1] - v[i * 3 + 1]) * oran) / 10,
      yon: y0 + fark * oran,
      bitti: t / h.aralik >= n - 1
    };
  }

  // ---------- Rekorlar ----------
  // kayitlar: { [tohum]: { sure, araSureler, hayalet, tarih } }. Yalnızca daha iyi süre yazılır ve en yeni
  // KAYIT_SINIRI parkur saklanır.
  function rekorIsle(kayitlar, tohum, sure, araSureler, hayalet, zaman) {
    var yeni = Object.assign({}, kayitlar || {});
    var eski = yeni[tohum];
    var rekor = !eski || sure < eski.sure;
    if (rekor) yeni[tohum] = { sure: sure, araSureler: araSureler.slice(), hayalet: hayalet, tarih: zaman };
    else yeni[tohum] = Object.assign({}, eski, { tarih: zaman });
    var anahtarlar = Object.keys(yeni).sort(function (a, b) { return yeni[b].tarih - yeni[a].tarih; });
    anahtarlar.slice(KAYIT_SINIRI).forEach(function (k) { delete yeni[k]; });
    return { kayitlar: yeni, rekor: rekor, onceki: eski ? eski.sure : null };
  }

  // ---------- Serbest sürüş saati ----------
  // Gündüz yok: saat 19:00'dan sabah 06:00'ya akar, sonra yine alacakaranlığa döner. gece 0 = alacakaranlık, 1 = gece yarısı.
  var DONGU = 360; // sn
  function gokDurumu(t) {
    var faz = ((t / DONGU) % 1 + 1) % 1;
    var dakika = Math.floor(19 * 60 + faz * 11 * 60) % (24 * 60);
    var gece = adimYumusak(0, 0.22, faz) * (1 - adimYumusak(0.78, 1, faz));
    return { faz: faz, gece: gece, saat: String(Math.floor(dakika / 60)).padStart(2, '0') + ':' + String(dakika % 60).padStart(2, '0') };
  }

  var KapadokyaMantik = {
    ADIM: ADIM, BLOK: BLOK, YOL_YARI: YOL_YARI, OMUZ: OMUZ, YOL_ALTI: YOL_ALTI, KAFES: KAFES, PARCA: PARCA,
    PARCA_KAFES: PARCA_KAFES, KN_SAYISI: KN_SAYISI, KN_GENISLIK: KN_GENISLIK, HAYALET_ARALIK: HAYALET_ARALIK,
    KAYIT_SINIRI: KAYIT_SINIRI, MAKS_YON: MAKS_YON, ARAC: ARAC,
    karistir: karistir, uretec: uretec, gurultu2: gurultu2, gurultu1: gurultu1, hamYukseklik: hamYukseklik,
    vadiDegeri: vadiDegeri, adimYumusak: adimYumusak, sinirla: sinirla,
    Yol: Yol, Dunya: Dunya, parcaAnahtari: parcaAnahtari, gerekliParcalar: gerekliParcalar,
    yeniArac: yeniArac, aracAdim: aracAdim, yeniSuspansiyon: yeniSuspansiyon, suspansiyonAdim: suspansiyonAdim,
    vitesDevir: vitesDevir, carpismaCoz: carpismaCoz,
    bulmacaNo: bulmacaNo, gunlukTohum: gunlukTohum, ralliParkuru: ralliParkuru, ralliDurumu: ralliDurumu,
    ralliKontrol: ralliKontrol, hayaletFarki: hayaletFarki, farkYaz: farkYaz, sureYaz: sureYaz,
    hayaletYeni: hayaletYeni, hayaletEkle: hayaletEkle, hayaletUzunluk: hayaletUzunluk, hayaletKonum: hayaletKonum,
    rekorIsle: rekorIsle, gokDurumu: gokDurumu, DONGU: DONGU
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = KapadokyaMantik;
  else kok.KapadokyaMantik = KapadokyaMantik;
})(this);
