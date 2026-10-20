// Yokuş Aşağı'nın pist üreticisi ve top fiziği: tarayıcıda window.YokusMantik, Node testlerinde module.exports.
//
// Pist -z yönünde iner; d alınan yol (metre), pistin yüksekliği h(d) = -EGIM * d. Pist 1 m'lik
// satırlardan oluşur: her satırda zemin aralıkları, kor engeller, rampa ve kayan platform olabilir.
// İleri hız yalnızca yola bağlıdır (v = V0 + K·d, en fazla VMAX); oyuncu yalnızca sağa/sola
// yönlendirir. Böylece bir satıra varış zamanı önceden bilinir ve üretici, kayan platformlar dahil
// her satırda topun sığabileceği güvenli bir koridor bırakır. Fizik sabit adımlıdır (1/120 sn).
(function (kok) {
  var DT = 1 / 120;
  var EGIM = 0.16;
  var V0 = 9, VMAX = 21, K = 0.004;
  var G = 22;
  var ZIPLAMA = 6;
  var TOP_R = 0.25;
  var VX = 6.5; // en yüksek yanal hız
  var AX = 34; // yanal ivme
  var SONUM = 9; // bırakınca yanal yavaşlama
  var ENGEL_Y = 0.9;
  var KONMA = 0.5; // zemin bu kadar yukarıdaysa top kenara çarpar
  var GEN = 1.8; // tam pistin yarı genişliği
  var KORIDOR = 0.62; // güvenli koridorun yarı genişliği
  var TABELA = ['Cihangir Yokuşu', 'Galata Yokuşu', 'Yüksek Kaldırım', 'Kamondo Merdivenleri', 'Boğazkesen', 'Şişhane Yokuşu',
    'Tophane Yokuşu', 'Asmalımescit', 'Kumbaracı Yokuşu', 'Ayaspaşa', 'Fındıklı Yokuşu', 'Defterdar Yokuşu', 'Beyoğlu', 'Karaköy'];

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

  function hiz(d) { return Math.min(VMAX, V0 + K * Math.max(0, d)); }
  // d noktasına varış zamanı (ileri hız yalnızca d'ye bağlı olduğundan kapalı biçimde)
  var D_MAX = (VMAX - V0) / K;
  function varis(d) {
    if (d <= D_MAX) return Math.log((V0 + K * d) / V0) / K;
    return Math.log(VMAX / V0) / K + (d - D_MAX) / VMAX;
  }
  function yukseklik(d) { return -EGIM * d; }
  function kayma(k, t) { return k ? k.A * Math.sin(k.w * t + k.faz) : 0; }

  // ---------- Pist üretici ----------
  // Satırlar sırayla üretilir ve önbellekte tutulur; geride kalanlar atılır (bellek sabit kalır).
  function pist(tohum) {
    var p = { tohum: tohum, r: rng(tohum), satirlar: new Map(), son: -1, c: 0, m: 0, plan: [], ilk: 0 };
    return p;
  }
  // Rampadan sıçrayan topun pist boyunca havada kat ettiği yol (eğime göre bağıl)
  function havaMesafesi(v) { return v * 2 * (ZIPLAMA + EGIM * v) / G; }
  function zorluk(i) { return Math.min(1, i / 3000); }
  function enFazlaKayma(i) { return 0.55 * VX / hiz(i); }

  function desenPlanla(p, i) {
    var r = p.r, z = zorluk(i);
    var plan = [];
    if (i < 30) { for (var a = 0; a < 30; a++) plan.push({ tur: 'duz' }); return plan; }
    var secenek = ['duz', 'engel', 'engel', 'kivrim', 'bosluk', 'dar', 'duvar'];
    if (i > 300) secenek.push('rampa', 'duvar');
    if (i > 600) secenek.push('kayan', 'kayan', 'dar');
    if (i > 1200) secenek.push('engel', 'bosluk', 'kayan');
    var d = secenek[Math.floor(r() * secenek.length)];
    var uz = 8 + Math.floor(r() * 6);
    var k;
    if (d === 'duz') for (k = 0; k < uz; k++) plan.push({ tur: 'duz' });
    else if (d === 'engel') {
      for (k = 0; k < uz + 6; k++) plan.push({ tur: 'duz', engel: k % Math.max(3, 6 - Math.floor(z * 3)) === 2, hedefC: k === 0 ? (r() * 2 - 1) * 1.1 : null });
    } else if (d === 'kivrim') {
      var hedefM = Math.max(-2.4, Math.min(2.4, p.m + (r() < 0.5 ? -1 : 1) * (0.8 + r() * 1.2)));
      for (k = 0; k < uz + 8; k++) plan.push({ tur: 'duz', hedefM: hedefM });
    } else if (d === 'bosluk') {
      var bos = 1 + (z > 0.5 && r() < 0.3 ? 1 : 0) - (hiz(i) < 11 ? 0 : 0);
      plan.push({ tur: 'duz' }, { tur: 'duz' });
      for (k = 0; k < Math.min(bos, 1); k++) plan.push({ tur: 'bos' });
      for (k = 0; k < 4; k++) plan.push({ tur: 'duz' });
    } else if (d === 'dar') {
      for (k = 0; k < uz; k++) plan.push({ tur: 'dar', hedefC: k === 0 ? (r() * 2 - 1) * 1.2 : null });
      plan.push({ tur: 'duz' }, { tur: 'duz' });
    } else if (d === 'duvar') {
      plan.push({ tur: 'duz', hedefC: (r() * 2 - 1) * 1.3 });
      for (k = 0; k < 5; k++) plan.push({ tur: 'duz' });
      plan.push({ tur: 'duvar' });
      for (k = 0; k < 3; k++) plan.push({ tur: 'duz' });
    } else if (d === 'rampa') {
      // Rampa: üstünden geçilecek uzunlukta boşluk ve arkasında engel sırası
      plan.push({ tur: 'duz' }, { tur: 'duz' }, { tur: 'rampa' });
      var hava = havaMesafesi(hiz(i));
      var bosl = Math.max(2, Math.min(9, Math.floor(0.45 * hava)));
      for (k = 0; k < bosl; k++) plan.push({ tur: 'bos' });
      // Top yere inene kadar düz zemin, sonra biraz daha
      var kalan = Math.ceil(hava - bosl) + 4;
      for (k = 0; k < kalan; k++) plan.push({ tur: 'duz' });
    } else if (d === 'kayan') {
      var A = 0.8 + 0.6 * z, w = 1.2 + 0.8 * z;
      var kay = { A: A, w: w, faz: r() * Math.PI * 2 };
      plan.push({ tur: 'duz' }, { tur: 'duz' });
      var n = 5 + Math.floor(r() * 4);
      for (k = 0; k < n; k++) plan.push({ tur: 'kayan', kayma: kay });
      plan.push({ tur: 'duz' }, { tur: 'duz' }, { tur: 'duz' });
    }
    return plan;
  }

  function satirUret(p, i) {
    if (!p.plan.length) p.plan = desenPlanla(p, i);
    var adim = p.plan.shift();
    var r = p.r, kmax = enFazlaKayma(i);
    var oncekiC = p.c;
    if (adim.hedefM != null) p.hedefM = adim.hedefM;
    if (p.hedefM != null) {
      var dm = Math.max(-kmax, Math.min(kmax, p.hedefM - p.m));
      p.m += dm; p.c += dm;
      if (Math.abs(p.hedefM - p.m) < 1e-6) p.hedefM = null;
    }
    if (adim.hedefC != null) p.hedefC = p.m + adim.hedefC;
    if (p.hedefC != null) {
      var dc = Math.max(-kmax, Math.min(kmax, p.hedefC - p.c));
      p.c += dc;
      if (Math.abs(p.hedefC - p.c) < 1e-6) p.hedefC = null;
    }
    p.c = Math.max(p.m - GEN + KORIDOR, Math.min(p.m + GEN - KORIDOR, p.c));
    var s = { i: i, zeminler: [], engeller: [], rampa: false, kayma: null, guvenli: p.c, merkez: p.m, tabela: null };
    if (i > 0 && i % 500 === 0) s.tabela = TABELA[(i / 500 - 1) % TABELA.length].toLocaleUpperCase('tr') + ' · ' + i + ' m';
    var cMin = Math.min(oncekiC, p.c), cMax = Math.max(oncekiC, p.c);
    if (adim.tur === 'duz' || adim.tur === 'rampa') {
      s.zeminler.push([p.m - GEN, p.m + GEN]);
      s.rampa = adim.tur === 'rampa';
      if (adim.engel) {
        // Koridorun bir ya da iki yanına engel: koridorun önceki ve şimdiki konumundan uzak
        var solBos = cMin - KORIDOR - (p.m - GEN), sagBos = p.m + GEN - (cMax + KORIDOR);
        if (solBos > 0.5 && r() < 0.8) s.engeller.push([p.m - GEN, cMin - KORIDOR - 0.08]);
        if (sagBos > 0.5 && r() < 0.8) s.engeller.push([cMax + KORIDOR + 0.08, p.m + GEN]);
      }
    } else if (adim.tur === 'dar') {
      s.zeminler.push([cMin - KORIDOR - 0.15, cMax + KORIDOR + 0.15]);
    } else if (adim.tur === 'duvar') {
      s.zeminler.push([p.m - GEN, p.m + GEN]);
      var gen = KORIDOR + 0.12;
      if (p.c - gen > p.m - GEN) s.engeller.push([p.m - GEN, p.c - gen]);
      if (p.c + gen < p.m + GEN) s.engeller.push([p.c + gen, p.m + GEN]);
    } else if (adim.tur === 'kayan') {
      // Platform, top bu satıra vardığında koridor üstünde olacak biçimde kayar
      s.kayma = adim.kayma;
      var ofs = kayma(adim.kayma, varis(i + 0.5));
      s.zeminler.push([-0.85, 0.85]);
      s.taban = p.c - ofs; // platformun kayma öncesi merkezi
      s.zeminler[0] = [s.taban - 0.85, s.taban + 0.85];
    }
    return s;
  }

  function satir(p, i) {
    if (i < 0) return { i: i, zeminler: [[-GEN, GEN]], engeller: [], rampa: false, kayma: null, guvenli: 0, merkez: 0 };
    while (p.son < i) { p.son += 1; p.satirlar.set(p.son, satirUret(p, p.son)); }
    return p.satirlar.get(i);
  }
  function temizle(p, i) {
    while (p.ilk < i - 30) { p.satirlar.delete(p.ilk); p.ilk += 1; }
  }

  // ---------- Oyun ----------
  function yeniOyun(tohum) {
    return {
      p: pist(tohum), tohum: tohum, d: 0, t: 0, x: 0, y: 0, vx: 0, vy: -EGIM * V0,
      havada: false, oldu: false, neden: null, olaylar: []
    };
  }
  function zeminVar(s, sat, x) {
    var k = kayma(sat.kayma, s.t);
    for (var j = 0; j < sat.zeminler.length; j++) {
      if (x >= sat.zeminler[j][0] + k && x <= sat.zeminler[j][1] + k) return true;
    }
    return false;
  }

  function adim(s, girdi) {
    if (s.oldu) return;
    s.t += DT;
    var v = hiz(s.d);
    s.d += v * DT;
    // Yanal hareket
    var etki = s.havada ? 0.5 : 1;
    if (girdi) s.vx += girdi * AX * etki * DT;
    else s.vx *= Math.exp(-SONUM * etki * DT);
    s.vx = Math.max(-VX, Math.min(VX, s.vx));
    s.x += s.vx * DT;

    var sat = satir(s.p, Math.floor(s.d));
    var h = yukseklik(s.d);
    var altta = zeminVar(s, sat, s.x);
    if (!s.havada) {
      if (altta) {
        s.y = h; s.vy = -EGIM * v;
        if (sat.rampa) { s.havada = true; s.vy = ZIPLAMA; s.y = h + 0.001; s.olaylar.push({ tur: 'zipla' }); }
      } else {
        s.havada = true;
      }
    }
    if (s.havada) {
      s.vy -= G * DT;
      s.y += s.vy * DT;
      if (altta && s.y <= h && s.vy < 0) {
        if (s.y >= h - KONMA) {
          s.y = h; s.havada = false; s.vy = -EGIM * v;
          s.olaylar.push({ tur: 'kondu' });
        } else {
          s.oldu = true; s.neden = 'kenar';
        }
      }
      if (s.y < h - 4) { s.oldu = true; s.neden = 'dustu'; }
    }
    // Kor engeller
    if (!s.oldu && s.y < h + ENGEL_Y) {
      for (var j = 0; j < sat.engeller.length; j++) {
        var e = sat.engeller[j];
        if (s.x + TOP_R * 0.8 > e[0] && s.x - TOP_R * 0.8 < e[1]) { s.oldu = true; s.neden = 'engel'; break; }
      }
    }
    if (sat.tabela && !s.tabelaGoruldu) s.tabelaGoruldu = {};
    if (sat.tabela && !s.tabelaGoruldu[sat.i]) { s.tabelaGoruldu[sat.i] = true; s.olaylar.push({ tur: 'tabela', yazi: sat.tabela }); }
    if (s.oldu) s.olaylar.push({ tur: 'oldu', neden: s.neden });
    temizle(s.p, Math.floor(s.d));
  }

  function ilerlet(s, biriken, kareSuresi, girdi) {
    biriken += Math.min(kareSuresi, 0.1);
    while (biriken >= DT && !s.oldu) { adim(s, girdi); biriken -= DT; }
    return biriken;
  }

  var YokusMantik = {
    DT: DT, EGIM: EGIM, V0: V0, VMAX: VMAX, G: G, ZIPLAMA: ZIPLAMA, TOP_R: TOP_R, VX: VX, GEN: GEN, KORIDOR: KORIDOR, ENGEL_Y: ENGEL_Y,
    havaMesafesi: havaMesafesi, rng: rng, gunTohumu: gunTohumu, hiz: hiz, varis: varis, yukseklik: yukseklik, kayma: kayma,
    pist: pist, satir: satir, enFazlaKayma: enFazlaKayma, yeniOyun: yeniOyun, zeminVar: zeminVar, adim: adim, ilerlet: ilerlet
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = YokusMantik;
  else kok.YokusMantik = YokusMantik;
})(this);
