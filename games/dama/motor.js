// Türk daması motoru: tarayıcıda window.DamaMotor, Web Worker'da self.DamaMotor, Node testlerinde module.exports.
//
// Tahta 8×8, kare numarası = satır * 8 + sütun (satır 0 = beyazın tarafı, sütun 0 = a dikeyi).
// Taş: 1 beyaz taş, 2 beyaz dama, 3 siyah taş, 4 siyah dama. Beyaz yukarı (satır +1), siyah aşağı gider.
// Kurallar: taşlar ileri ve yana birer kare yürür (geri ve çapraz yok); yeme zorunludur ve en çok taş
// yediren yol seçilmek zorundadır (çoğunluk kuralı); yenen taşlar yenir yenmez tahtadan kalkar, dama
// uzun menzillidir, yeme sırasında geri dönemez. Taş son sıraya ulaşınca hamle bitince dama olur
// (yeme sürüyorsa taş olarak sürer). Hamle: { de, yol: [duraklar], yen: [yenen kareler], ter }.
(function (kok) {
  'use strict';
  var BOS = 0, BT = 1, BD = 2, ST = 3, SD = 4;
  var BERABERE_PLY = 80;      // yeme ve taş hamlesi olmadan bu kadar yarım hamle: beraberlik
  var DEGER_TAS = 100, DEGER_DAMA = 330;
  var DAMA_YONLERI = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function renk(x) { return x <= BD ? 0 : 1; }
  function damaMi(x) { return x === BD || x === SD; }
  function kareAdi(k) { return 'abcdefgh'.charAt(k & 7) + ((k >> 3) + 1); }

  function baslangic() {
    var t = new Int8Array(64);
    for (var c = 0; c < 8; c++) { t[8 + c] = BT; t[16 + c] = BT; t[40 + c] = ST; t[48 + c] = ST; }
    return { t: t, sira: 0, sayac: 0 };
  }
  function kopya(p) { return { t: new Int8Array(p.t), sira: p.sira, sayac: p.sayac }; }
  // Bulmaca/kayıt biçimi: 64 karakter (0 boş, 1-4 taş), a1'den h8'e satır satır; ayrı sira.
  function diziden(s, sira) {
    var t = new Int8Array(64);
    for (var i = 0; i < 64; i++) t[i] = s.charCodeAt(i) - 48;
    return { t: t, sira: sira || 0, sayac: 0 };
  }
  function diziye(p) {
    var s = '';
    for (var i = 0; i < 64; i++) s += String.fromCharCode(48 + p.t[i]);
    return s;
  }
  function anahtar(p) { return diziye(p) + p.sira; }

  // ---------- Hamle üretimi ----------
  function yemeleri(t, de, x, k, sonYon, yol, yen, cikti) {
    var r = k >> 3, c = k & 7, bulundu = false, ben = renk(x), kral = damaMi(x);
    var yonler = kral ? DAMA_YONLERI : [[ben === 0 ? 1 : -1, 0], [0, 1], [0, -1]];
    for (var d = 0; d < yonler.length; d++) {
      var dr = yonler[d][0], dc = yonler[d][1];
      if (sonYon && sonYon[0] === -dr && sonYon[1] === -dc) continue;
      var nr = r + dr, nc = c + dc;
      if (kral) { // boş kareleri geç, ilk dolu kare rakipse ve ardı boşsa ye
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && t[nr * 8 + nc] === BOS) { nr += dr; nc += dc; }
      }
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
      var hk = nr * 8 + nc, hx = t[hk];
      if (hx === BOS || renk(hx) === ben) continue;
      var ar = nr + dr, ac = nc + dc;
      while (ar >= 0 && ar < 8 && ac >= 0 && ac < 8 && t[ar * 8 + ac] === BOS) {
        bulundu = true;
        t[hk] = BOS;
        yol.push(ar * 8 + ac); yen.push(hk);
        yemeleri(t, de, x, ar * 8 + ac, [dr, dc], yol, yen, cikti);
        yol.pop(); yen.pop();
        t[hk] = hx;
        if (!kral) break;
        ar += dr; ac += dc;
      }
    }
    if (!bulundu && yen.length) {
      var son = yol[yol.length - 1];
      cikti.push({ de: de, yol: yol.slice(), yen: yen.slice(), ter: !kral && (ben === 0 ? son >> 3 === 7 : son >> 3 === 0) });
    }
  }

  function hamleler(p) {
    var t = p.t, ben = p.sira, cikti = [], i;
    for (i = 0; i < 64; i++) {
      var x = t[i];
      if (x && renk(x) === ben) { t[i] = BOS; yemeleri(t, i, x, i, null, [], [], cikti); t[i] = x; }
    }
    if (cikti.length) {
      var en = 0;
      for (i = 0; i < cikti.length; i++) if (cikti[i].yen.length > en) en = cikti[i].yen.length;
      var elenen = [], gorulen = {};
      for (i = 0; i < cikti.length; i++) {
        var m = cikti[i], a = m.de + ':' + m.yol.join(',');
        if (m.yen.length === en && !gorulen[a]) { gorulen[a] = 1; elenen.push(m); }
      }
      return elenen;
    }
    for (i = 0; i < 64; i++) {
      var y = t[i];
      if (!y || renk(y) !== ben) continue;
      var r = i >> 3, c = i & 7, kral = damaMi(y);
      var yon = kral ? DAMA_YONLERI : [[ben === 0 ? 1 : -1, 0], [0, 1], [0, -1]];
      for (var d = 0; d < yon.length; d++) {
        var nr = r + yon[d][0], nc = c + yon[d][1];
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && t[nr * 8 + nc] === BOS) {
          var hk = nr * 8 + nc;
          cikti.push({ de: i, yol: [hk], yen: [], ter: !kral && (ben === 0 ? nr === 7 : nr === 0) });
          if (!kral) break;
          nr += yon[d][0]; nc += yon[d][1];
        }
      }
    }
    return cikti;
  }

  function yap(p, m) {
    var q = kopya(p), x = q.t[m.de];
    q.t[m.de] = BOS;
    for (var i = 0; i < m.yen.length; i++) q.t[m.yen[i]] = BOS;
    q.t[m.yol[m.yol.length - 1]] = m.ter ? x + 1 : x;
    q.sayac = (m.yen.length || !damaMi(x)) ? 0 : p.sayac + 1;
    q.sira = 1 - p.sira;
    return q;
  }

  function say(p) {
    var s = [0, 0, 0, 0, 0];
    for (var i = 0; i < 64; i++) s[p.t[i]]++;
    return { bt: s[1], bd: s[2], st: s[3], sd: s[4] };
  }

  // ---------- Oyun (geçmiş, geri alma, bitiş) ----------
  function Oyun(baslangicKonum) {
    this.baslangic = baslangicKonum ? kopya(baslangicKonum) : baslangic();
    this.konum = kopya(this.baslangic);
    this.gecmis = [];      // önceki konumlar
    this.hamleler = [];    // yapılan hamleler
    this.tekrar = {};
    this.tekrar[anahtar(this.konum)] = 1;
  }
  Oyun.prototype.yap = function (m) {
    this.gecmis.push(this.konum);
    this.hamleler.push(m);
    this.konum = yap(this.konum, m);
    var a = anahtar(this.konum);
    this.tekrar[a] = (this.tekrar[a] || 0) + 1;
  };
  Oyun.prototype.geriAl = function () {
    if (!this.gecmis.length) return null;
    var a = anahtar(this.konum);
    this.tekrar[a]--;
    this.konum = this.gecmis.pop();
    return this.hamleler.pop();
  };
  // { bitti, kazanan (0 beyaz, 1 siyah, null beraberlik), neden }
  Oyun.prototype.durum = function () {
    var p = this.konum, s = say(p);
    if (!hamleler(p).length) return { bitti: true, kazanan: 1 - p.sira, neden: (p.sira === 0 ? s.bt + s.bd : s.st + s.sd) ? 'kilit' : 'tas-yok' };
    if (s.bt + s.st === 0 && s.bd + s.sd === 2) return { bitti: true, kazanan: null, neden: 'dama-dama' };
    if (this.tekrar[anahtar(p)] >= 3) return { bitti: true, kazanan: null, neden: 'tekrar' };
    if (p.sayac >= BERABERE_PLY) return { bitti: true, kazanan: null, neden: 'hamle-siniri' };
    return { bitti: false, kazanan: null, neden: '' };
  };

  // Hamle yazımı: "c3-c4" ya da yemede "c3xc5xe5".
  function hamleYaz(m) {
    return m.yen.length ? kareAdi(m.de) + m.yol.map(function (k) { return 'x' + kareAdi(k); }).join('') : kareAdi(m.de) + '-' + kareAdi(m.yol[0]);
  }
  function hamleBul(p, de, yol) {
    var l = hamleler(p);
    for (var i = 0; i < l.length; i++) if (l[i].de === de && l[i].yol.join(',') === yol.join(',')) return l[i];
    return null;
  }

  // ---------- Değerlendirme ve arama ----------
  // Sıradaki taraf açısından puan. Taş ilerledikçe, dama merkezde ve arka sıra korunurken artar.
  function degerlendir(p) {
    var t = p.t, puan = 0;
    for (var i = 0; i < 64; i++) {
      var x = t[i];
      if (!x) continue;
      var b = renk(x) === 0, v;
      if (damaMi(x)) {
        var r = i >> 3, c = i & 7;
        v = DEGER_DAMA + 6 - (Math.abs(r - 3.5) + Math.abs(c - 3.5)) * 1.5;
      } else {
        var ilerleme = b ? (i >> 3) - 1 : 6 - (i >> 3);
        v = DEGER_TAS + ilerleme * ilerleme * 1.6 + (ilerleme >= 5 ? 14 : 0);
        var yanlar = i & 7;
        if (yanlar === 0 || yanlar === 7) v -= 3;
      }
      puan += (b === (p.sira === 0)) ? v : -v;
    }
    return puan;
  }

  var ZAMAN_ASIMI = { zaman: true };
  function ara(p, azamiDerinlik, sinirMs, rnd, gurultu) {
    var bitis = Date.now() + (sinirMs || 1e9), dugum = 0, enIyi = null, enIyiPuan = 0, tamamlanan = 0;
    var kok = hamleler(p);
    if (!kok.length) return null;
    if (kok.length === 1) return kok[0];

    function sirala(l, oncelik) {
      if (oncelik) for (var i = 0; i < l.length; i++) if (l[i] === oncelik) { l.unshift(l.splice(i, 1)[0]); break; }
      return l;
    }
    function nega(q, derin, alfa, beta, kat) {
      if (++dugum % 512 === 0 && Date.now() > bitis) throw ZAMAN_ASIMI;
      var l = hamleler(q);
      if (!l.length) return -50000 + kat;
      if (q.sayac >= BERABERE_PLY) return 0;
      if (derin <= 0) return degerlendir(q);
      for (var i = 0; i < l.length; i++) {
        var v = -nega(yap(q, l[i]), derin - 1, -beta, -alfa, kat + 1);
        if (v > alfa) { alfa = v; if (alfa >= beta) break; }
      }
      return alfa;
    }

    var sira = sirala(kok.slice());
    var oncekiEn = null;
    for (var d = 1; d <= azamiDerinlik; d++) {
      try {
        var alfa = -1e9, en = null, enP = -1e9, puanlar = [];
        sirala(sira, oncekiEn);
        for (var i = 0; i < sira.length; i++) {
          var v = -nega(yap(p, sira[i]), d - 1, -1e9, -alfa, 1);
          if (gurultu && d === azamiDerinlik) v += (rnd() - 0.5) * 2 * gurultu;
          puanlar.push(v);
          if (v > enP) { enP = v; en = sira[i]; }
          if (v > alfa && !gurultu) alfa = v;
        }
        enIyi = en; enIyiPuan = enP; oncekiEn = en; tamamlanan = d;
        if (enP > 40000) break; // zorunlu galibiyet bulundu
      } catch (e) {
        if (e !== ZAMAN_ASIMI) throw e;
        break;
      }
    }
    if (!enIyi) enIyi = kok[0];
    ara.sonDerinlik = tamamlanan; ara.sonPuan = enIyiPuan;
    return enIyi;
  }

  // Seviyeler: 1 Kolay, 2 Orta, 3 Zor
  var SEVIYELER = {
    1: { ad: 'Kolay', derinlik: 2, ms: 300, gurultu: 90, rastgele: 0.2 },
    2: { ad: 'Orta', derinlik: 5, ms: 600, gurultu: 18, rastgele: 0 },
    3: { ad: 'Zor', derinlik: 14, ms: 1300, gurultu: 0, rastgele: 0 }
  };
  function bilgisayarHamlesi(oyun, seviye, rnd) {
    rnd = rnd || Math.random;
    var s = SEVIYELER[seviye] || SEVIYELER[2], l = hamleler(oyun.konum);
    if (!l.length) return null;
    if (s.rastgele && rnd() < s.rastgele) return l[Math.floor(rnd() * l.length)];
    return ara(oyun.konum, s.derinlik, s.ms, rnd, s.gurultu);
  }

  // ---------- Günün bulmacası: "2 hamlede kazan" ----------
  // Sıradaki taraf (beyaz) önce oynar, rakip cevap verir, beyazın ikinci hamlesi rakibi hamlesiz/taşsız bırakır.
  function hamleSizMi(p) { return !hamleler(p).length; }
  function birdeKazanir(p) {
    var l = hamleler(p);
    for (var i = 0; i < l.length; i++) if (hamleSizMi(yap(p, l[i]))) return l[i];
    return null;
  }
  // Birinci hamle adayı m için: rakibin her cevabından sonra beyazın kazandıran hamlesi var mı?
  function zorlaKazandirir(p, m) {
    var q = yap(p, m);
    var cevaplar = hamleler(q);
    if (!cevaplar.length) return true;
    for (var i = 0; i < cevaplar.length; i++) if (!birdeKazanir(yap(q, cevaplar[i]))) return false;
    return true;
  }
  function ikideKazandiranlar(p) {
    var l = hamleler(p), c = [];
    for (var i = 0; i < l.length; i++) if (zorlaKazandirir(p, l[i])) c.push(l[i]);
    return c;
  }

  // Havuzda gün gün tekrarsız seçim (her tur karışık sıralanır).
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
  function gunNo(anahtarGun) {
    var a = anahtarGun.split('-').map(Number);
    return Math.floor(Date.UTC(a[0], a[1] - 1, a[2]) / 86400000);
  }
  function bulmacaSirasi(anahtarGun, adet) {
    var no = gunNo(anahtarGun), tur = Math.floor(no / adet), dizi = [], i;
    for (i = 0; i < adet; i++) dizi.push(i);
    var r = rng(tur * 2654435761 + 12345);
    for (i = adet - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = dizi[i]; dizi[i] = dizi[j]; dizi[j] = x; }
    return dizi[((no % adet) + adet) % adet];
  }

  var DamaMotor = {
    BOS: BOS, BT: BT, BD: BD, ST: ST, SD: SD, SEVIYELER: SEVIYELER, BERABERE_PLY: BERABERE_PLY,
    renk: renk, damaMi: damaMi, kareAdi: kareAdi, baslangic: baslangic, kopya: kopya, diziden: diziden, diziye: diziye,
    anahtar: anahtar, hamleler: hamleler, yap: yap, say: say, Oyun: Oyun, hamleYaz: hamleYaz, hamleBul: hamleBul,
    degerlendir: degerlendir, ara: ara, bilgisayarHamlesi: bilgisayarHamlesi,
    birdeKazanir: birdeKazanir, zorlaKazandirir: zorlaKazandirir, ikideKazandiranlar: ikideKazandiranlar,
    rng: rng, gunNo: gunNo, bulmacaSirasi: bulmacaSirasi
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = DamaMotor;
  else kok.DamaMotor = DamaMotor;
})(typeof self !== 'undefined' ? self : this);
