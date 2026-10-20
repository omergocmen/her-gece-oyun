// Smaç'ın fiziği, atış hesabı, pota dizisi ve puanlaması: tarayıcıda window.SmacMantik, Node testlerinde module.exports.
//
// Dünya birimi metre. Top başlangıçta (0, 1.15, 0)'da durur, pota -z yönünde, x sağa, y yukarı.
// Fizik 1/120 sn'lik sabit adımla işler; kare süresi sonucu değiştirmez (aynı atış her fps'te aynı yere düşer).
// Çember, yatay bir halka (merkez çizgisi yarıçapı RR, boru yarıçapı TUP) olarak top küresine karşı sınanır;
// tabela, çemberin arkasındaki düz bir dikdörtgendir. Adım başına en fazla ~0,12 m ilerleyen top
// 0,31 m kalınlığındaki (R + TUP)·2 çember bölgesini atlayamaz, yani tünelleme olmaz.
(function (kok) {
  var DT = 1 / 120;
  var G = 9.81;
  var R = 0.13;            // top yarıçapı
  var RR = 0.4;            // çember yarıçapı (oyun için gerçekten biraz geniş)
  var TUP = 0.025;         // çember borusunun yarıçapı
  var HY = 3.05;           // çember yüksekliği
  var TABELA_ARKA = RR + 0.3;  // çember merkezinden tabelanın ön yüzüne uzaklık (top çember ile tabela arasına sıkışamaz)
  var TABELA_YARI_EN = 0.9;
  var TABELA_ALT = HY - 0.2, TABELA_UST = HY + 0.85;
  var E_RIM = 0.52, E_TABELA = 0.6, E_ZEMIN = 0.55;
  var BASLANGIC = { x: 0, y: 1.15, z: 0 };
  // Atış açısı pota uzaklığına bağlıdır (yakında dik, uzakta yatık): top çembere hep yeterince dik iner.
  // Oyuncu açıyı seçmez; yalnızca güç ve yön verir.
  function teta(D) { return sinirla(65 - (D - 4.4) * 4, 48, 65) * Math.PI / 180; }
  var S0 = 1.0, S1 = 4.5;        // kaydırma hızı aralığı (ekran yüksekliği / sn)
  var VMIN = 6.0, VMAX = 11.5;   // çıkış hızı aralığı (m/sn)
  var AZ_SINIR = 0.6;            // en fazla yön sapması (rad)
  var YARDIM_HIZ = 0.22;         // idealin ±%22'sinde yardım devreye girer
  var YARDIM_AZ = 0.28;
  var YARDIM = { kolay: 0.3, normal: 0.5 }; // ham hatanın kalan oranı (küçük = daha çok yardım)
  var MOD = {
    sure: { ad: '60 saniye', sure: 60 },
    sonsuz: { ad: 'Sonsuz', maksIska: 3 },
    gunluk: { ad: 'Günlük', atis: 10 }
  };

  function sinirla(x, a, b) { return x < a ? a : x > b ? b : x; }
  function yuvarla(x, n) { var k = Math.pow(10, n || 2); return Math.round(x * k) / k; }

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

  // ---------- Pota dizisi ----------
  // i. atışın temel pota konumu yalnızca (tohum, i)'ye bağlıdır: günlük modda herkes aynı diziyi görür.
  function potaTemel(tohum, i) {
    var r = rng((tohum ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
    r(); r();
    var zor = Math.min(1, i / 12);
    var uzak = 4.4 + r() * (1.1 + 1.3 * zor);
    var yan = (r() * 2 - 1) * (0.35 + 0.8 * zor);
    return { x: yuvarla(yan), z: -yuvarla(uzak) };
  }
  // Seri yükseldikçe pota kayar (3+) ve uzaklaşır (6+). Kayma, atıştan 1 sn sonra başlar (uyarı süresi).
  function potaKonum(tohum, i, seri) {
    var t = potaTemel(tohum, i);
    seri = seri || 0;
    var pota = { x: t.x, z: t.z, kayma: null, indeks: i };
    if (seri >= 6) pota.z = yuvarla(Math.max(-8.2, pota.z - Math.min(1.2, 0.2 * (seri - 5))));
    if (seri >= 3) {
      var A = Math.min(1.1, 0.35 + 0.15 * (seri - 3));
      A = Math.min(A, 1.9 - Math.abs(pota.x));
      pota.kayma = { A: yuvarla(A), w: yuvarla(1.1 + 0.05 * Math.min(seri, 10)), gecikme: 1.0 };
    }
    return pota;
  }
  function potaX(pota, t) {
    var k = pota.kayma;
    if (!k || t <= k.gecikme) return pota.x;
    return pota.x + k.A * Math.sin(k.w * (t - k.gecikme));
  }

  // ---------- Atış ----------
  // Sabit TETA açısında (hx, hz) hedefine çıkış noktasından çarpmadan ulaşan hız ve yön.
  function idealAtis(o, hx, hz) {
    var dx = hx - o.x, dz = hz - o.z;
    var D = Math.sqrt(dx * dx + dz * dz);
    var th = teta(D);
    var dh = HY - o.y;
    var c = Math.cos(th);
    var payda = 2 * c * c * (D * Math.tan(th) - dh);
    if (payda <= 0 || D < 0.1) return null;
    var v = Math.sqrt(G * D * D / payda);
    return { hiz: v, az: Math.atan2(dx, -dz), ucus: D / (v * c), teta: th };
  }
  function velOlustur(hiz, az, th) {
    var yat = hiz * Math.cos(th);
    return { x: yat * Math.sin(az), y: hiz * Math.sin(th), z: -yat * Math.cos(az) };
  }
  // girdi: bırakma anındaki son ~80 ms'lik kaydırma hızı, ekran yüksekliği/sn: {vx (sağ +), yukari (yukarı +)}.
  // ayar: {t: pota saati, yardim: 'kolay'|'normal'|'yok'}. Çok yavaş ya da yukarı olmayan kaydırma null döner.
  function atisHesapla(girdi, o, pota, ayar) {
    ayar = ayar || {};
    var s = Math.sqrt(girdi.vx * girdi.vx + girdi.yukari * girdi.yukari);
    if (girdi.yukari <= 0 || s < S0 * 0.6 || girdi.yukari < 0.5 * s) return null;
    var hamHiz = VMIN + (VMAX - VMIN) * sinirla((s - S0) / (S1 - S0), 0, 1);
    var hamAz = sinirla(Math.atan2(girdi.vx, girdi.yukari), -AZ_SINIR, AZ_SINIR);
    var hiz = hamHiz, az = hamAz;
    var t = ayar.t || 0;
    var k = ayar.yardim === 'yok' ? 1 : (YARDIM[ayar.yardim] || YARDIM.normal);
    var ideal = idealAtis(o, potaX(pota, t), pota.z);
    if (ideal && pota.kayma) { // hareketli potada varış anındaki konuma nişan al
      var ideal2 = idealAtis(o, potaX(pota, t + ideal.ucus), pota.z);
      if (ideal2) ideal = ideal2;
    }
    if (ideal && k < 1) {
      if (Math.abs(hamHiz - ideal.hiz) <= YARDIM_HIZ * ideal.hiz) hiz = ideal.hiz + (hamHiz - ideal.hiz) * k;
      if (Math.abs(hamAz - ideal.az) <= YARDIM_AZ) az = ideal.az + (hamAz - ideal.az) * k;
    }
    var th = teta(Math.sqrt((pota.x - o.x) * (pota.x - o.x) + (pota.z - o.z) * (pota.z - o.z)));
    return { hiz: hiz, az: az, teta: th, vel: velOlustur(hiz, az, th), ham: { hiz: hamHiz, az: hamAz }, ideal: ideal };
  }
  // Klavye ve testler için: güç (0..1) ve yönden (rad) kaydırma hızı üretir.
  function kaydirmaGirdisi(guc, az) {
    var s = S0 + sinirla(guc, 0, 1) * (S1 - S0);
    return { vx: s * Math.sin(az || 0), yukari: s * Math.cos(az || 0) };
  }
  // Önizleme noktaları: çarpışmasız yay, n eşit zaman diliminde (çember yüksekliğine inene kadar).
  function yorunge(atis, o, n) {
    var v = atis.vel, a = 0.5 * G;
    var c = HY - o.y, disk = v.y * v.y - 4 * a * c;
    var T = disk > 0 ? (v.y + Math.sqrt(disk)) / (2 * a) : 1;
    var noktalar = [];
    for (var i = 1; i <= n; i++) {
      var t = T * i / n;
      noktalar.push({ x: o.x + v.x * t, y: o.y + v.y * t - a * t * t, z: o.z + v.z * t });
    }
    return noktalar;
  }

  // ---------- Fizik ----------
  function atisBaslat(atis, o, pota, t0) {
    return {
      pota: pota, t: t0 || 0, sure: 0, adim: 0,
      x: o.x, y: o.y, z: o.z, vx: atis.vel.x, vy: atis.vel.y, vz: atis.vel.z,
      rim: 0, tabela: 0, zemin: 0, asildi: false, sayi: false, temiz: false,
      sonuc: null, sonucSure: 0, bitti: false, olaylar: []
    };
  }
  function adim(s) {
    if (s.bitti) return;
    var pota = s.pota;
    s.t += DT; s.sure += DT; s.adim++;
    var ox = s.x, oy = s.y, oz = s.z;
    s.vy -= G * DT;
    s.x += s.vx * DT; s.y += s.vy * DT; s.z += s.vz * DT;
    var hx = potaX(pota, s.t), hz = pota.z;

    // Tabela: ön yüze yaklaşırken (önceki konum önde, şimdi içeride) yansır.
    var zf = hz - TABELA_ARKA;
    if (s.vz < 0 && oz - R >= zf - 1e-9 && s.z - R < zf &&
        Math.abs(s.x - hx) <= TABELA_YARI_EN + R * 0.5 && s.y >= TABELA_ALT - R * 0.5 && s.y <= TABELA_UST + R * 0.5) {
      s.olaylar.push({ tur: 'tabela', siddet: Math.abs(s.vz) });
      s.z = zf + R;
      s.vz = -s.vz * E_TABELA;
      s.vx *= 0.92; s.vy *= 0.92;
      s.tabela++;
    }

    // Çember: top merkezinin halkaya en yakın noktası.
    var ex = s.x - hx, ez = s.z - hz;
    var rho = Math.sqrt(ex * ex + ez * ez);
    var ux = rho > 1e-6 ? ex / rho : 0, uz = rho > 1e-6 ? ez / rho : 1;
    var px = hx + ux * RR, pz = hz + uz * RR;
    var nx = s.x - px, ny = s.y - HY, nz = s.z - pz;
    var dist = Math.sqrt(nx * nx + ny * ny + nz * nz);
    var minD = R + TUP;
    if (dist < minD) {
      if (dist < 1e-6) { nx = 0; ny = 1; nz = 0; dist = 1; }
      nx /= dist; ny /= dist; nz /= dist;
      s.x = px + nx * minD; s.y = HY + ny * minD; s.z = pz + nz * minD;
      var vn = s.vx * nx + s.vy * ny + s.vz * nz;
      if (vn < 0) {
        var f = (1 + E_RIM) * vn;
        s.vx -= f * nx; s.vy -= f * ny; s.vz -= f * nz;
        s.vx *= 0.97; s.vz *= 0.97;
        if (-vn > 0.4) s.olaylar.push({ tur: 'rim', siddet: -vn });
        s.rim++;
      }
    }

    // Sayı: çember düzlemini yukarıdan aşağı, halkanın içinden geçiş.
    if (!s.sayi && oy > HY && s.y <= HY && s.vy < 0) {
      var k = (oy - HY) / (oy - s.y);
      var cx = ox + k * (s.x - ox), cz = oz + k * (s.z - oz);
      var dx = cx - hx, dz = cz - hz;
      if (Math.sqrt(dx * dx + dz * dz) < RR - 0.03) {
        s.sayi = true;
        s.temiz = s.rim === 0 && s.tabela === 0;
        s.olaylar.push({ tur: 'sayi', temiz: s.temiz });
      }
    }
    // File: top fileden geçerken yavaşlar ve ortaya çekilir.
    if (s.sayi && s.y < HY && s.y > HY - 0.55 && s.vy < 0) {
      s.vx *= 0.985; s.vz *= 0.985; s.vy *= 0.993;
      s.vx += (hx - s.x) * 3 * DT; s.vz += (hz - s.z) * 3 * DT;
    }

    // Zemin
    if (s.y - R < 0 && s.vy < 0) {
      s.y = R;
      if (-s.vy > 0.8) s.olaylar.push({ tur: 'zemin', siddet: -s.vy });
      s.vy = -s.vy * E_ZEMIN; s.vx *= 0.8; s.vz *= 0.8;
      s.zemin++;
      if (Math.abs(s.vy) < 0.4) s.vy = 0;
    }

    if (s.y > HY - 0.6) s.asildi = true;
    if (!s.sonuc) {
      var biter = (s.sayi && s.y < HY - 0.6) || (!s.sayi && ((s.asildi && s.vy < 0 && s.y < HY - 0.6) || s.zemin >= 1 || s.sure > 6));
      if (biter) {
        s.sonuc = s.sayi ? 'sayi' : (s.rim + s.tabela > 0 ? 'iska' : 'hava');
        s.sonucSure = s.sure;
      }
    }
    // Sonuç belli olduktan sonra top 1,2 sn daha yuvarlanır (görsel), sonra atış biter.
    if (s.sonuc && s.sure - s.sonucSure > 1.2) s.bitti = true;
  }
  function ilerlet(s, biriken, kareSuresi) {
    biriken += Math.min(kareSuresi, 0.1);
    while (biriken >= DT && !s.bitti) { adim(s); biriken -= DT; }
    return biriken;
  }
  // Testler ve botlar için: atışı sonuna kadar oynat.
  function tamamla(s) {
    var n = 0;
    while (!s.bitti && n++ < 100000) adim(s);
    return s;
  }

  // ---------- Tur ve puan ----------
  function carpan(seri) { return Math.min(5, 1 + Math.floor(seri / 3)); }
  function yeniTur(mod, tohum) {
    var m = MOD[mod] || MOD.sure;
    return {
      mod: MOD[mod] ? mod : 'sure', tohum: tohum >>> 0, puan: 0, seri: 0, enSeri: 0, atis: 0, sayi: 0, iska: 0, smac: 0,
      kalan: m.sure || null, bitti: false
    };
  }
  // Atış sonucunu işler; geri bildirim türü ve kazanılan puanı döner.
  function atisKaydet(tur, sonuc) {
    var olan;
    tur.atis++;
    if (sonuc.sonuc === 'sayi') {
      var c = carpan(tur.seri);
      tur.seri++;
      tur.sayi++;
      if (tur.seri > tur.enSeri) tur.enSeri = tur.seri;
      var smac = tur.seri % 3 === 0;
      var p = (2 + (sonuc.temiz ? 1 : 0)) * c + (smac ? 2 : 0);
      tur.puan += p;
      if (smac) tur.smac++;
      olan = { tur: smac ? 'smac' : 'sayi', puan: p, carpan: c, temiz: !!sonuc.temiz };
    } else {
      tur.seri = 0;
      tur.iska++;
      olan = { tur: sonuc.sonuc === 'iska' ? 'iska' : 'hava', puan: 0, carpan: 1 };
    }
    var m = MOD[tur.mod];
    if (m.maksIska && tur.iska >= m.maksIska) tur.bitti = true;
    if (m.atis && tur.atis >= m.atis) tur.bitti = true;
    return olan;
  }
  function sureDus(tur, dt) {
    if (tur.kalan === null || tur.bitti) return;
    tur.kalan = Math.max(0, tur.kalan - dt);
    if (tur.kalan === 0) tur.bitti = true;
  }
  // Sonraki atış için pota (günlük modda dizi tohuma, öbür modlarda rastgele tohuma bağlıdır).
  function sonrakiPota(tur) { return potaKonum(tur.tohum, tur.atis, tur.seri); }

  var SmacMantik = {
    DT: DT, G: G, R: R, RR: RR, TUP: TUP, HY: HY, TABELA_ARKA: TABELA_ARKA, TABELA_YARI_EN: TABELA_YARI_EN,
    TABELA_ALT: TABELA_ALT, TABELA_UST: TABELA_UST, BASLANGIC: BASLANGIC, teta: teta, VMIN: VMIN, VMAX: VMAX, MOD: MOD,
    rng: rng, gunTohumu: gunTohumu, gunAnahtari: gunAnahtari,
    potaTemel: potaTemel, potaKonum: potaKonum, potaX: potaX,
    idealAtis: idealAtis, atisHesapla: atisHesapla, kaydirmaGirdisi: kaydirmaGirdisi, yorunge: yorunge,
    atisBaslat: atisBaslat, adim: adim, ilerlet: ilerlet, tamamla: tamamla,
    carpan: carpan, yeniTur: yeniTur, atisKaydet: atisKaydet, sureDus: sureDus, sonrakiPota: sonrakiPota
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SmacMantik;
  else kok.SmacMantik = SmacMantik;
})(this);
