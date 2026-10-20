// Mini Golf Türkiye'nin fizik motoru: tarayıcıda window.GolfFizik, Node testlerinde module.exports.
//
// Top xz düzleminde yuvarlanır; yükseklik h(x, z) rampalardan gelir ve topa eğim ivmesi verir.
// Sabit zaman adımı (1/120 sn) ve hız büyüdükçe artan alt adımlar kullanılır: aynı vuruş her
// kare hızında aynı sonucu verir ve top bir adımda yarıçapından fazla ilerlemediği için duvardan
// geçemez. Hareketli engellerin konumu yalnızca adım sayısına (t) bağlıdır.
(function (kok) {
  var DT = 1 / 120;
  var TOP_R = 0.09;
  var DELIK_R = 0.16;
  var HUCRE = 0.5;
  var MAKS_HIZ = 7.5;
  var SURTUNME = { cim: 0.85, kum: 4.4, sig: 2.6, vapur: 0.85 };
  var SURUKLEME = 0.2;
  var G = 7.0; // yuvarlanan top için etkin yerçekimi (5/7 g)
  var STATIK = 1.0; // bu eğim ivmesinin altında top durabilir
  var DUR_HIZ = 0.06;
  var SEKME = 0.68;
  var YAKALAMA_HIZ = 1.4;
  var DUVAR_W = 0.04;

  function anahtar(i, j) { return i + ',' + j; }

  function icinde(r, x, z) { return x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]; }

  // Dikdörtgen [x0, z0, x1, z1]'i (sıralı olmayabilir) normalize eder.
  function dz(r) { return [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])]; }

  // Hücre birleşiminin sınır kenarlarını birleştirip duvar parçalarına çevirir.
  function sinirlar(hucreler) {
    var yatay = {}, dikey = {};
    Object.keys(hucreler).forEach(function (k) {
      var p = k.split(',').map(Number), i = p[0], j = p[1];
      if (!hucreler[anahtar(i, j - 1)]) (yatay[j] = yatay[j] || []).push(i);
      if (!hucreler[anahtar(i, j + 1)]) (yatay[j + 1] = yatay[j + 1] || []).push(i);
      if (!hucreler[anahtar(i - 1, j)]) (dikey[i] = dikey[i] || []).push(j);
      if (!hucreler[anahtar(i + 1, j)]) (dikey[i + 1] = dikey[i + 1] || []).push(j);
    });
    var parcalar = [];
    function birlestir(tablo, yataySa) {
      Object.keys(tablo).forEach(function (cizgi) {
        var c = Number(cizgi);
        var liste = tablo[cizgi].slice().sort(function (a, b) { return a - b; });
        var bas = liste[0], son = liste[0];
        for (var n = 1; n <= liste.length; n++) {
          if (n < liste.length && liste[n] === son + 1) { son = liste[n]; continue; }
          if (n < liste.length && liste[n] === son) continue;
          if (yataySa) parcalar.push({ ax: bas * HUCRE, az: c * HUCRE, bx: (son + 1) * HUCRE, bz: c * HUCRE, w: DUVAR_W, duvar: true });
          else parcalar.push({ ax: c * HUCRE, az: bas * HUCRE, bx: c * HUCRE, bz: (son + 1) * HUCRE, w: DUVAR_W, duvar: true });
          if (n < liste.length) { bas = liste[n]; son = liste[n]; }
        }
      });
    }
    birlestir(yatay, true);
    birlestir(dikey, false);
    return parcalar;
  }

  // Delik verisini fizik için derler.
  function derle(d) {
    var hucreler = {};
    d.alan.forEach(function (r0) {
      var r = dz(r0);
      for (var i = Math.round(r[0] / HUCRE); i < Math.round(r[2] / HUCRE); i++) {
        for (var j = Math.round(r[1] / HUCRE); j < Math.round(r[3] / HUCRE); j++) hucreler[anahtar(i, j)] = true;
      }
    });
    var cizgiler = sinirlar(hucreler);
    var kutular = (d.kutular || []).map(function (k) { return { r: dz(k.r), y: k.y || 0.25, tur: k.tur }; });
    kutular.forEach(function (k) {
      var r = k.r;
      [[r[0], r[1], r[2], r[1]], [r[2], r[1], r[2], r[3]], [r[2], r[3], r[0], r[3]], [r[0], r[3], r[0], r[1]]].forEach(function (s) {
        cizgiler.push({ ax: s[0], az: s[1], bx: s[2], bz: s[3], w: 0 });
      });
    });
    (d.tamponlar || []).forEach(function (t) {
      cizgiler.push({ ax: t[0], az: t[1], bx: t[2], bz: t[3], w: 0.06, tampon: true });
    });
    return {
      veri: d,
      hucreler: hucreler,
      cizgiler: cizgiler,
      kutular: kutular,
      daireler: (d.daireler || []).map(function (c) { return { x: c[0], z: c[1], r: c[2], tur: c[3] }; }),
      kapilar: d.kapilar || [],
      vapurlar: d.vapurlar || [],
      su: (d.su || []).map(dz),
      kum: (d.kum || []).map(dz),
      sig: (d.sig || []).map(dz),
      rampalar: d.rampalar || [],
      tee: d.tee,
      delik: d.delik,
      par: d.par
    };
  }

  function alandaMi(D, x, z) { return !!D.hucreler[anahtar(Math.floor(x / HUCRE), Math.floor(z / HUCRE))]; }

  function rampaOrani(r, x, z) {
    var c = r.eksen === 'x' ? x : z;
    var t = (c - r.a) / (r.b - r.a);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  function yukseklik(D, x, z) {
    var h = 0;
    for (var i = 0; i < D.rampalar.length; i++) h += D.rampalar[i].dh * rampaOrani(D.rampalar[i], x, z);
    return h;
  }

  function egim(D, x, z) {
    var gx = 0, gz = 0;
    for (var i = 0; i < D.rampalar.length; i++) {
      var r = D.rampalar[i];
      var c = r.eksen === 'x' ? x : z;
      var lo = Math.min(r.a, r.b), hi = Math.max(r.a, r.b);
      if (c <= lo || c >= hi) continue;
      var g = r.dh / (r.b - r.a);
      if (r.eksen === 'x') gx += g; else gz += g;
    }
    return [gx, gz];
  }

  // Kapı: merkez etrafında dönen çubuk. Uçlar ve açısal hız.
  function kapiDurumu(k, t) {
    var aci = (k.faz || 0) + k.w * t * DT;
    var cx = Math.cos(aci) * k.L, cz = Math.sin(aci) * k.L;
    return { ax: k.x - cx, az: k.z - cz, bx: k.x + cx, bz: k.z + cz, aci: aci };
  }

  // Vapur: x ekseninde salınan düz platform.
  function vapurDurumu(v, t) {
    var faz = 2 * Math.PI * (t * DT) / v.periyot + (v.faz || 0);
    var cx = v.x + Math.sin(faz) * v.genlik;
    var hiz = Math.cos(faz) * v.genlik * 2 * Math.PI / v.periyot;
    return { r: [cx - v.en / 2, v.z - v.boy / 2, cx + v.en / 2, v.z + v.boy / 2], x: cx, z: v.z, vx: hiz };
  }

  function vapurda(D, x, z, t) {
    for (var i = 0; i < D.vapurlar.length; i++) {
      var v = vapurDurumu(D.vapurlar[i], t);
      if (icinde(v.r, x, z)) return v;
    }
    return null;
  }

  function zemin(D, x, z, t) {
    if (vapurda(D, x, z, t)) return 'vapur';
    var i;
    for (i = 0; i < D.su.length; i++) if (icinde(D.su[i], x, z)) return 'su';
    for (i = 0; i < D.kum.length; i++) if (icinde(D.kum[i], x, z)) return 'kum';
    for (i = 0; i < D.sig.length; i++) if (icinde(D.sig[i], x, z)) return 'sig';
    return 'cim';
  }

  function yeniDurum(D, t) {
    return {
      x: D.tee[0], z: D.tee[1], vx: 0, vz: 0, t: t || 0,
      hareket: false, dustu: false, guvenliX: D.tee[0], guvenliZ: D.tee[1], olaylar: []
    };
  }

  // Bir vuruş: aci xz düzleminde (x ekseninden z'ye), guc 0..1.
  function vur(s, aci, guc) {
    var g = Math.max(0, Math.min(1, guc));
    var v = vapurdaHiz(s);
    s.vx = Math.cos(aci) * g * MAKS_HIZ + v;
    s.vz = Math.sin(aci) * g * MAKS_HIZ;
    s.hareket = true;
    s.vurusX = s.x; s.vurusZ = s.z;
  }
  function vapurdaHiz(s) { return s.platformVx || 0; }

  // Top ile kalınlıklı doğru parçası çarpışması. Hareketli parça için temas noktası hızı verilir.
  function parcaCarp(s, ax, az, bx, bz, w, hizF, olaylar) {
    var ex = bx - ax, ez = bz - az;
    var uz2 = ex * ex + ez * ez;
    var t = uz2 > 0 ? ((s.x - ax) * ex + (s.z - az) * ez) / uz2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var px = ax + ex * t, pz = az + ez * t;
    var dx = s.x - px, dzz = s.z - pz;
    var uz = Math.sqrt(dx * dx + dzz * dzz);
    var sinir = TOP_R + w;
    if (uz >= sinir) return false;
    var nx, nz;
    if (uz > 1e-9) { nx = dx / uz; nz = dzz / uz; }
    else { nx = -ez; nz = ex; var l = Math.sqrt(nx * nx + nz * nz) || 1; nx /= l; nz /= l; }
    s.x = px + nx * sinir;
    s.z = pz + nz * sinir;
    var ox = 0, oz = 0;
    if (hizF) { var o = hizF(px, pz); ox = o[0]; oz = o[1]; }
    var rx = s.vx - ox, rz = s.vz - oz;
    var vn = rx * nx + rz * nz;
    if (vn < 0) {
      var tx = rx - vn * nx, tz = rz - vn * nz;
      rx = tx * 0.96 - vn * SEKME * nx;
      rz = tz * 0.96 - vn * SEKME * nz;
      s.vx = rx + ox; s.vz = rz + oz;
      if (-vn > 0.35) olaylar.push({ tur: 'sekme', guc: Math.min(1, -vn / MAKS_HIZ) });
    }
    return true;
  }

  function daireCarp(s, c, olaylar) {
    var dx = s.x - c.x, dzz = s.z - c.z;
    var uz = Math.sqrt(dx * dx + dzz * dzz);
    var sinir = TOP_R + c.r;
    if (uz >= sinir) return;
    var nx = uz > 1e-9 ? dx / uz : 1, nz = uz > 1e-9 ? dzz / uz : 0;
    s.x = c.x + nx * sinir;
    s.z = c.z + nz * sinir;
    var vn = s.vx * nx + s.vz * nz;
    if (vn < 0) {
      var tx = s.vx - vn * nx, tz = s.vz - vn * nz;
      s.vx = tx * 0.96 - vn * SEKME * nx;
      s.vz = tz * 0.96 - vn * SEKME * nz;
      if (-vn > 0.35) olaylar.push({ tur: 'sekme', guc: Math.min(1, -vn / MAKS_HIZ) });
    }
  }

  function carpismalar(D, s, t) {
    var i;
    for (i = 0; i < D.cizgiler.length; i++) {
      var c = D.cizgiler[i];
      parcaCarp(s, c.ax, c.az, c.bx, c.bz, c.w, null, s.olaylar);
    }
    for (i = 0; i < D.daireler.length; i++) daireCarp(s, D.daireler[i], s.olaylar);
    for (i = 0; i < D.kapilar.length; i++) {
      var k = D.kapilar[i];
      var kd = kapiDurumu(k, t);
      var w = k.w;
      parcaCarp(s, kd.ax, kd.az, kd.bx, kd.bz, k.kalinlik || 0.06, function (px, pz) {
        return [-w * (pz - k.z), w * (px - k.x)];
      }, s.olaylar);
      if (k.direk) daireCarp(s, { x: k.x, z: k.z, r: k.direk }, s.olaylar);
    }
  }

  // Bir sabit adım. Olaylar s.olaylar'a eklenir: sekme, delik, ceza, durdu.
  function adim(D, s) {
    s.t++;
    var t = s.t;
    var v = vapurda(D, s.x, s.z, t);
    s.platformVx = v ? v.vx : 0;
    if (!s.hareket) {
      if (s.dustu) return;
      // Duran top vapurdaysa onunla taşınır; vapur çekilip suya düşerse ceza.
      if (D.vapurlar.length) {
        var onceki = vapurda(D, s.x, s.z, t - 1);
        if (onceki) {
          s.x += onceki.vx * DT;
          carpismalar(D, s, t);
          if (zemin(D, s.x, s.z, t) === 'su') ceza(D, s);
        }
      }
      return;
    }
    var yer = zemin(D, s.x, s.z, t);
    if (yer === 'su') { ceza(D, s); return; }
    var pv = s.platformVx;
    var g = egim(D, s.x, s.z);
    var ax = -G * g[0], az = -G * g[1];
    s.vx += ax * DT;
    s.vz += az * DT;
    var rx = s.vx - pv, rz = s.vz;
    var hiz = Math.sqrt(rx * rx + rz * rz);
    var yavas = (SURTUNME[yer] + SURUKLEME * hiz) * DT;
    if (hiz > yavas) { rx *= (hiz - yavas) / hiz; rz *= (hiz - yavas) / hiz; } else { rx = 0; rz = 0; }
    s.vx = rx + pv; s.vz = rz;

    var top = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
    var n = Math.max(1, Math.ceil(top * DT / (TOP_R * 0.4)));
    var hx = D.delik[0], hz = D.delik[1];
    for (var k = 0; k < n; k++) {
      s.x += s.vx * DT / n;
      s.z += s.vz * DT / n;
      carpismalar(D, s, t);
      var ddx = hx - s.x, ddz = hz - s.z;
      var uz = Math.sqrt(ddx * ddx + ddz * ddz);
      var sHiz = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
      if (uz < DELIK_R - TOP_R * 0.35 && sHiz < YAKALAMA_HIZ) {
        s.hareket = false; s.dustu = true; s.vx = 0; s.vz = 0;
        s.olaylar.push({ tur: 'delik' });
        return;
      }
      if (uz < DELIK_R * 1.3 && sHiz < 1.0 && uz > 1e-6) {
        // Delik ağzı topu hafifçe içeri çeker.
        s.vx += ddx / uz * 2.2 * DT / n;
        s.vz += ddz / uz * 2.2 * DT / n;
      }
    }
    var gHiz = Math.sqrt(ax * ax + az * az);
    var gx = s.vx - pv, gz = s.vz;
    // Yavaş top eğimde değilse durur; eğimde duvara yaslanıp kıpırdayamıyorsa da kısa süre sonra durur.
    var cokYavas = Math.sqrt(gx * gx + gz * gz) < DUR_HIZ;
    s.yavasAdim = cokYavas ? (s.yavasAdim || 0) + 1 : 0;
    if (cokYavas && (gHiz < STATIK || s.yavasAdim > 30)) {
      s.vx = pv; s.vz = 0;
      s.hareket = false;
      s.yavasAdim = 0;
      if (!vapurda(D, s.x, s.z, t)) { s.guvenliX = s.x; s.guvenliZ = s.z; }
      s.olaylar.push({ tur: 'durdu' });
    }
  }

  function ceza(D, s) {
    s.hareket = false;
    s.vx = 0; s.vz = 0;
    s.x = s.guvenliX; s.z = s.guvenliZ;
    s.olaylar.push({ tur: 'ceza' });
  }

  // Vuruşu top durana kadar (ya da sınır adım) simüle eder; testler ve parkur doğrulaması için.
  function simuleEt(D, s, aci, guc, sinir) {
    vur(s, aci, guc);
    var n = 0;
    sinir = sinir || 120 * 40;
    while (s.hareket && n++ < sinir) adim(D, s);
    return s;
  }

  function kopya(s) {
    return { x: s.x, z: s.z, vx: s.vx, vz: s.vz, t: s.t, hareket: s.hareket, dustu: s.dustu,
      guvenliX: s.guvenliX, guvenliZ: s.guvenliZ, platformVx: s.platformVx, yavasAdim: s.yavasAdim, olaylar: [] };
  }

  // Kare süresinden bağımsız ilerletme: biriken süre sabit adımlara bölünür.
  function ilerlet(D, s, biriken, kareSuresi) {
    biriken += Math.min(kareSuresi, 0.1);
    while (biriken >= DT) { adim(D, s); biriken -= DT; }
    return biriken;
  }

  function skorAdi(vurus, par) {
    if (vurus === 1) return 'TEK VURUŞ!';
    var f = vurus - par;
    if (f <= -3) return 'Albatross!';
    if (f === -2) return 'Eagle!';
    if (f === -1) return 'Birdie!';
    if (f === 0) return 'Par';
    if (f === 1) return 'Bogey';
    if (f === 2) return 'Double Bogey';
    return '+' + f;
  }

  var GolfFizik = {
    DT: DT, TOP_R: TOP_R, DELIK_R: DELIK_R, HUCRE: HUCRE, MAKS_HIZ: MAKS_HIZ, DUVAR_W: DUVAR_W,
    derle: derle, alandaMi: alandaMi, yukseklik: yukseklik, egim: egim, zemin: zemin,
    kapiDurumu: kapiDurumu, vapurDurumu: vapurDurumu, yeniDurum: yeniDurum, vur: vur, adim: adim,
    simuleEt: simuleEt, kopya: kopya, ilerlet: ilerlet, skorAdi: skorAdi, icinde: icinde
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GolfFizik;
  else kok.GolfFizik = GolfFizik;
})(this);
