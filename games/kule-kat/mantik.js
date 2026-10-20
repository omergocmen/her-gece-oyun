// Kule Kat'ın kesme, hizalama, seri ve hız mantığı: tarayıcıda window.KuleMantik, Node testlerinde module.exports.
//
// Dünya birimi: kat genişliği ~3. Kule x ve z eksenlerinde dönüşümlü kayan katlarla yükselir.
// Katman = { cx, cz, w, d } (merkez ve boyut; w x ekseninde, d z ekseninde). Kayan kat bir önceki katın
// boyutunda doğar, hareket ekseninde üst katın merkezine göre ±MENZIL arasında gidip gelir.
// Bırakınca taşan kısım kesilir; "mükemmel" hizada kat olduğu gibi oturur, seri artar, 3. seriden sonra
// kule yeniden genişler. Hız kat sayısına yumuşak bir eğriyle bağlıdır (ani sıçrama yok).
(function (kok) {
  var KAT_YUKSEKLIK = 0.5;
  var TABAN_EN = 3;          // normal oyunda ilk katın genişliği (ve genişlemenin üst sınırı)
  var MENZIL = 1.9;          // kayan katın üst kat merkezine göre en uzak konumu
  var ESIK = 0.09;           // bu kadar sapma "mükemmel" sayılır
  var AZ_ORTUSME = 0.05;     // bundan az örtüşme kuleyi bitirir
  var BUYUME = 0.25;         // seri >= BUYUME_SERI iken her mükemmel katta genişleme
  var BUYUME_SERI = 3;
  var HIZ0 = 2.4;            // birim/sn, ilk kat
  var HIZ_ARTIS = 0.006;     // kat başına (10 katta %6)
  var HIZ_TAVAN = 1.9;       // hız çarpanı üst sınırı
  var TEMALAR = ['galata', 'kiz', 'suleymaniye'];
  var PALET = ['#e9dcc2', '#c9a46a', '#5a3b24', '#2f6fb0']; // Kemik, Kum, Ceviz, İznik mavisi

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
  function gunTohumu(tarih) {
    var h = 2166136261;
    for (var i = 0; i < tarih.length; i++) { h ^= tarih.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function gunAnahtari(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function yuvarla(x) { return Math.round(x * 1000) / 1000; }

  // Hız çarpanı: kat sayısıyla doğrusal, tavanlı. 10 katta en fazla %6 artar.
  function hizCarpani(kat) { return Math.min(HIZ_TAVAN, 1 + HIZ_ARTIS * kat); }

  // Günlük parametreler: herkes için aynı (başlangıç genişliği, hız, ilk yön).
  function gunParam(tarih) {
    var r = rng(gunTohumu(tarih));
    return { en: yuvarla(2.6 + r() * 0.4), hiz: yuvarla(0.95 + r() * 0.17), ilkYon: r() < 0.5 ? 1 : -1 };
  }

  function yeni(secenek) {
    secenek = secenek || {};
    var p = secenek.gunluk ? gunParam(secenek.tarih || gunAnahtari()) : { en: TABAN_EN, hiz: 1, ilkYon: 1 };
    var s = {
      gunluk: !!secenek.gunluk, tabanEn: p.en, hizCarpan: p.hiz, ilkYon: p.ilkYon,
      katlar: [{ cx: 0, cz: 0, w: p.en, d: p.en }],
      kat: 0, seri: 0, enSeri: 0, mukemmel: 0, bitti: false, hareket: null
    };
    sonraki(s);
    return s;
  }
  function ust(s) { return s.katlar[s.katlar.length - 1]; }

  // Sıradaki kayan katı hazırlar: eksen dönüşümlü, taraf her katta değişir.
  function sonraki(s) {
    var u = ust(s);
    var eksen = s.kat % 2 === 0 ? 'x' : 'z';
    var taraf = (s.kat % 2 === 0 ? 1 : -1) * s.ilkYon;
    s.hareket = { eksen: eksen, ofset: -taraf * MENZIL, yon: taraf, w: u.w, d: u.d };
  }

  function hiz(s) { return HIZ0 * s.hizCarpan * hizCarpani(s.kat); }

  // Kayan katı dt saniye ilerletir; uçlarda yansır.
  function ilerlet(s, dt) {
    if (s.bitti) return;
    var h = s.hareket;
    h.ofset += h.yon * hiz(s) * dt;
    if (h.ofset > MENZIL) { h.ofset = 2 * MENZIL - h.ofset; h.yon = -1; }
    else if (h.ofset < -MENZIL) { h.ofset = -2 * MENZIL - h.ofset; h.yon = 1; }
  }

  // Kayan katın dünya konumu ve boyutu.
  function kayanKat(s) {
    var u = ust(s), h = s.hareket;
    return { cx: h.eksen === 'x' ? u.cx + h.ofset : u.cx, cz: h.eksen === 'z' ? u.cz + h.ofset : u.cz, w: h.w, d: h.d };
  }

  // Katı bırakır. Döner: { tur: 'mukemmel' | 'kes' | 'iska', katman, kesilen, kat, seri }.
  // kesilen: düşecek parça (katman biçiminde) ya da null.
  function birak(s) {
    if (s.bitti) return null;
    var u = ust(s), h = s.hareket, ek = h.eksen;
    var uc = ek === 'x' ? u.cx : u.cz, us = ek === 'x' ? u.w : u.d;
    var fark = h.ofset;
    var hc = uc + fark;
    var lo = Math.max(uc - us / 2, hc - us / 2), hi = Math.min(uc + us / 2, hc + us / 2);
    var ort = hi - lo;
    var kayan = kayanKat(s);

    if (ort < AZ_ORTUSME) {
      s.bitti = true; s.seri = 0;
      return { tur: 'iska', katman: null, kesilen: kayan, kat: s.kat, seri: 0 };
    }
    var katman, kesilen = null, tur;
    if (Math.abs(fark) <= ESIK) {
      tur = 'mukemmel';
      s.seri++; s.mukemmel++;
      if (s.seri > s.enSeri) s.enSeri = s.seri;
      var w = u.w, d = u.d;
      if (s.seri >= BUYUME_SERI) { w = Math.min(s.tabanEn, w + BUYUME); d = Math.min(s.tabanEn, d + BUYUME); }
      katman = { cx: u.cx, cz: u.cz, w: yuvarla(w), d: yuvarla(d) };
    } else {
      tur = 'kes';
      s.seri = 0;
      var orta = (lo + hi) / 2;
      var dis0 = fark > 0 ? hi : hc - us / 2, dis1 = fark > 0 ? hc + us / 2 : lo;
      var disOrta = (dis0 + dis1) / 2, disBoy = dis1 - dis0;
      if (ek === 'x') {
        katman = { cx: yuvarla(orta), cz: u.cz, w: yuvarla(ort), d: u.d };
        kesilen = { cx: yuvarla(disOrta), cz: u.cz, w: yuvarla(disBoy), d: u.d };
      } else {
        katman = { cx: u.cx, cz: yuvarla(orta), w: u.w, d: yuvarla(ort) };
        kesilen = { cx: u.cx, cz: yuvarla(disOrta), w: u.w, d: yuvarla(disBoy) };
      }
    }
    s.katlar.push(katman);
    s.kat++;
    sonraki(s);
    return { tur: tur, katman: katman, kesilen: kesilen, kat: s.kat, seri: s.seri };
  }

  // 1'den başlayan kat numarasına göre tema (her 10 katta bir değişir) ve gökyüzü karanlığı (0..1).
  function tema(kat) { return TEMALAR[Math.floor(kat / 10) % TEMALAR.length]; }
  function temaSirasi(kat) { return Math.floor(kat / 10); }
  function karanlik(kat) { return Math.min(1, Math.floor(kat / 10) / 8); }
  function katRengi(i) { return PALET[((i % PALET.length) + PALET.length) % PALET.length]; }

  var KuleMantik = {
    KAT_YUKSEKLIK: KAT_YUKSEKLIK, TABAN_EN: TABAN_EN, MENZIL: MENZIL, ESIK: ESIK, AZ_ORTUSME: AZ_ORTUSME,
    BUYUME: BUYUME, BUYUME_SERI: BUYUME_SERI, HIZ0: HIZ0, PALET: PALET, TEMALAR: TEMALAR,
    rng: rng, gunTohumu: gunTohumu, gunAnahtari: gunAnahtari, gunParam: gunParam,
    hizCarpani: hizCarpani, hiz: hiz, yeni: yeni, ust: ust, sonraki: sonraki, ilerlet: ilerlet,
    kayanKat: kayanKat, birak: birak, tema: tema, temaSirasi: temaSirasi, karanlik: karanlik, katRengi: katRengi
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = KuleMantik;
  else kok.KuleMantik = KuleMantik;
})(this);
