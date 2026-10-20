// Satranç motoru: kurallar, hamle üretimi, arama ve Türkçe notasyon. Tarayıcıda window.SatrancMotor,
// Web Worker'da self.SatrancMotor, Node testlerinde module.exports.
//
// Tahta 0x88 düzenindedir: kare = sıra*16 + sütun (a1 = 0, h8 = 119). Taş kodu = tür | (renk << 3):
// tür 1 piyon, 2 at, 3 fil, 4 kale, 5 vezir, 6 şah; renk 0 beyaz, 1 siyah (kod 9..14).
// Hamle tek bir sayıdır: den | hedef << 7 | terfi << 14 | bayrak << 17.
(function (kok) {
  'use strict';

  var BEYAZ = 0, SIYAH = 1;
  var EP = 1, CIFT = 2, ROK_K = 4, ROK_U = 8; // hamle bayrakları
  var BASLANGIC = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var DEGER = [0, 100, 320, 330, 500, 900, 20000];
  var MAT = 30000;

  var AT_YON = [33, 31, 18, 14, -33, -31, -18, -14];
  var SAH_YON = [1, -1, 16, -16, 15, 17, -15, -17];
  var FIL_YON = [15, 17, -15, -17];
  var KALE_YON = [1, -1, 16, -16];

  // Bir kareye değince hangi rok haklarının düştüğü (1 BK, 2 BU, 4 SK, 8 SU).
  var ROK_MASKE = new Uint8Array(128).fill(15);
  ROK_MASKE[4] = 12; ROK_MASKE[0] = 13; ROK_MASKE[7] = 14;
  ROK_MASKE[116] = 3; ROK_MASKE[112] = 7; ROK_MASKE[119] = 11;

  // ---------- Kare adları ----------
  function kareAdi(k) { return 'abcdefgh'.charAt(k & 7) + ((k >> 4) + 1); }
  function kareKodu(ad) {
    if (!/^[a-h][1-8]$/.test(ad)) return -1;
    return (ad.charCodeAt(1) - 49) * 16 + (ad.charCodeAt(0) - 97);
  }
  function hamleKur(den, hedef, terfi, bayrak) { return den | (hedef << 7) | ((terfi || 0) << 14) | ((bayrak || 0) << 17); }
  function hamleDen(m) { return m & 127; }
  function hamleHedef(m) { return (m >> 7) & 127; }
  function hamleTerfi(m) { return (m >> 14) & 7; }
  function hamleBayrak(m) { return m >> 17; }
  var TERFI_HARF = { 2: 'n', 3: 'b', 4: 'r', 5: 'q' };
  function hamleYaz(m) {
    var t = hamleTerfi(m);
    return kareAdi(hamleDen(m)) + kareAdi(hamleHedef(m)) + (t ? TERFI_HARF[t] : '');
  }

  // ---------- Zobrist (tekrar tespiti için 32 bit) ----------
  var tohum = 0x9e3779b9;
  function rastgele32() {
    tohum = (tohum + 0x6d2b79f5) | 0;
    var t = Math.imul(tohum ^ (tohum >>> 15), 1 | tohum);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  }
  var Z = [];
  for (var zi = 0; zi < 15; zi++) { Z.push(new Int32Array(128)); for (var zk = 0; zk < 128; zk++) Z[zi][zk] = rastgele32(); }
  var Z_ROK = new Int32Array(16); for (var zr = 0; zr < 16; zr++) Z_ROK[zr] = rastgele32();
  var Z_SIRA = rastgele32();

  // ---------- Konum ----------
  var YIGIN = 4096;
  function Konum() {
    this.t = new Int8Array(128);
    this.sira = BEYAZ; this.rok = 0; this.ep = -1; this.yarim = 0; this.tam = 1;
    this.sah = [4, 116]; this.hash = 0; this.n = 0;
    this.gM = new Int32Array(YIGIN); this.gAlinan = new Int8Array(YIGIN); this.gRok = new Uint8Array(YIGIN);
    this.gEp = new Int16Array(YIGIN); this.gYarim = new Int16Array(YIGIN); this.gHash = new Int32Array(YIGIN + 1);
  }
  function hashHesapla(p) {
    var h = 0;
    for (var k = 0; k < 128; k++) { if (k & 0x88) { k += 7; continue; } if (p.t[k]) h ^= Z[p.t[k]][k]; }
    h ^= Z_ROK[p.rok];
    if (p.sira === SIYAH) h ^= Z_SIRA;
    return h | 0;
  }

  var HARF_TAS = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
  function fenOku(fen) {
    var parca = String(fen).trim().split(/\s+/);
    if (parca.length < 2) throw new Error('Geçersiz FEN');
    var p = new Konum(), sat = parca[0].split('/');
    if (sat.length !== 8) throw new Error('Geçersiz FEN');
    var krallar = [0, 0];
    for (var r = 0; r < 8; r++) {
      var sutun = 0, satir = sat[r];
      for (var i = 0; i < satir.length; i++) {
        var c = satir.charAt(i);
        if (/[1-8]/.test(c)) { sutun += Number(c); continue; }
        var tur = HARF_TAS[c.toLowerCase()];
        if (!tur || sutun > 7) throw new Error('Geçersiz FEN');
        var renk = c === c.toLowerCase() ? SIYAH : BEYAZ;
        var kare = (7 - r) * 16 + sutun;
        p.t[kare] = tur | (renk << 3);
        if (tur === 6) { p.sah[renk] = kare; krallar[renk]++; }
        sutun++;
      }
      if (sutun !== 8) throw new Error('Geçersiz FEN');
    }
    if (krallar[0] !== 1 || krallar[1] !== 1) throw new Error('Her renkten tam bir şah gerekir');
    p.sira = parca[1] === 'b' ? SIYAH : BEYAZ;
    var rk = parca[2] || '-';
    p.rok = (rk.indexOf('K') >= 0 ? 1 : 0) | (rk.indexOf('Q') >= 0 ? 2 : 0) | (rk.indexOf('k') >= 0 ? 4 : 0) | (rk.indexOf('q') >= 0 ? 8 : 0);
    p.ep = parca[3] && parca[3] !== '-' ? kareKodu(parca[3]) : -1;
    p.yarim = Number(parca[4]) || 0; p.tam = Number(parca[5]) || 1;
    p.hash = hashHesapla(p); p.gHash[0] = p.hash;
    return p;
  }
  var TAS_HARF = '.pnbrqk';
  function fenYaz(p, kisa) {
    var s = '';
    for (var r = 7; r >= 0; r--) {
      var bos = 0;
      for (var f = 0; f < 8; f++) {
        var x = p.t[r * 16 + f];
        if (!x) { bos++; continue; }
        if (bos) { s += bos; bos = 0; }
        var h = TAS_HARF.charAt(x & 7);
        s += (x & 8) ? h : h.toUpperCase();
      }
      if (bos) s += bos;
      if (r) s += '/';
    }
    var rk = (p.rok & 1 ? 'K' : '') + (p.rok & 2 ? 'Q' : '') + (p.rok & 4 ? 'k' : '') + (p.rok & 8 ? 'q' : '');
    s += ' ' + (p.sira ? 'b' : 'w') + ' ' + (rk || '-') + ' ' + (p.ep >= 0 ? kareAdi(p.ep) : '-');
    return kisa ? s : s + ' ' + p.yarim + ' ' + p.tam;
  }

  // ---------- Saldırı ----------
  function saldirilmis(p, kare, renk) {
    var t = p.t, i, k, x;
    // piyonlar: beyaz piyon s karesindeyse s+15 ve s+17'yi tutar
    var pk = renk === BEYAZ ? [-15, -17] : [15, 17], pt = 1 | (renk << 3);
    for (i = 0; i < 2; i++) { k = kare + pk[i]; if (!(k & 0x88) && t[k] === pt) return true; }
    var at = 2 | (renk << 3);
    for (i = 0; i < 8; i++) { k = kare + AT_YON[i]; if (!(k & 0x88) && t[k] === at) return true; }
    var sah = 6 | (renk << 3);
    for (i = 0; i < 8; i++) { k = kare + SAH_YON[i]; if (!(k & 0x88) && t[k] === sah) return true; }
    var fil = 3 | (renk << 3), kale = 4 | (renk << 3), vez = 5 | (renk << 3);
    for (i = 0; i < 4; i++) {
      k = kare + FIL_YON[i];
      while (!(k & 0x88)) { x = t[k]; if (x) { if (x === fil || x === vez) return true; break; } k += FIL_YON[i]; }
      k = kare + KALE_YON[i];
      while (!(k & 0x88)) { x = t[k]; if (x) { if (x === kale || x === vez) return true; break; } k += KALE_YON[i]; }
    }
    return false;
  }
  function sahta(p) { return saldirilmis(p, p.sah[p.sira], p.sira ^ 1); }

  // Bir kareyi tutan en değersiz taşın değeri (yoksa 0); korunma/tehdit analizi için.
  function enKucukSaldiran(p, kare, renk) {
    var t = p.t, en = 0, i, k, x, v;
    function dene(deger) { if (!en || deger < en) en = deger; }
    var pk = renk === BEYAZ ? [-15, -17] : [15, 17], pt = 1 | (renk << 3);
    for (i = 0; i < 2; i++) { k = kare + pk[i]; if (!(k & 0x88) && t[k] === pt) dene(DEGER[1]); }
    var at = 2 | (renk << 3);
    for (i = 0; i < 8; i++) { k = kare + AT_YON[i]; if (!(k & 0x88) && t[k] === at) dene(DEGER[2]); }
    var sah = 6 | (renk << 3);
    for (i = 0; i < 8; i++) { k = kare + SAH_YON[i]; if (!(k & 0x88) && t[k] === sah) dene(DEGER[6]); }
    for (i = 0; i < 4; i++) {
      k = kare + FIL_YON[i];
      while (!(k & 0x88)) { x = t[k]; if (x) { if ((x & 8) >> 3 === renk && ((x & 7) === 3 || (x & 7) === 5)) dene(DEGER[x & 7]); break; } k += FIL_YON[i]; }
      k = kare + KALE_YON[i];
      while (!(k & 0x88)) { x = t[k]; if (x) { if ((x & 8) >> 3 === renk && ((x & 7) === 4 || (x & 7) === 5)) dene(DEGER[x & 7]); break; } k += KALE_YON[i]; }
    }
    v = en; return v;
  }

  // ---------- Hamle üretimi (sahte-yasal; yasallık yap sonrası şah kontrolüyle denetlenir) ----------
  function uret(p, almaOnly) {
    var t = p.t, renk = p.sira, rb = renk << 3, ms = [], sq, x, tur, i, k, hd, dir;
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      x = t[sq];
      if (!x || (x & 8) !== rb) continue;
      tur = x & 7;
      if (tur === 1) {
        dir = renk === BEYAZ ? 16 : -16;
        var sonSira = renk === BEYAZ ? 6 : 1, ilkSira = renk === BEYAZ ? 1 : 6;
        var sr = sq >> 4;
        hd = sq + dir;
        if (!t[hd]) {
          if (sr === sonSira) {
            ms.push(hamleKur(sq, hd, 5, 0));
            if (!almaOnly) { ms.push(hamleKur(sq, hd, 4, 0)); ms.push(hamleKur(sq, hd, 3, 0)); ms.push(hamleKur(sq, hd, 2, 0)); }
          } else if (!almaOnly) {
            ms.push(hamleKur(sq, hd, 0, 0));
            if (sr === ilkSira && !t[hd + dir]) ms.push(hamleKur(sq, hd + dir, 0, CIFT));
          }
        }
        for (i = -1; i <= 1; i += 2) {
          hd = sq + dir + i;
          if (hd & 0x88) continue;
          if (t[hd] && (t[hd] & 8) !== rb) {
            if (sr === sonSira) {
              ms.push(hamleKur(sq, hd, 5, 0));
              if (!almaOnly) { ms.push(hamleKur(sq, hd, 4, 0)); ms.push(hamleKur(sq, hd, 3, 0)); ms.push(hamleKur(sq, hd, 2, 0)); }
            } else ms.push(hamleKur(sq, hd, 0, 0));
          } else if (hd === p.ep && p.ep >= 0) ms.push(hamleKur(sq, hd, 0, EP));
        }
      } else if (tur === 2 || tur === 6) {
        var yon = tur === 2 ? AT_YON : SAH_YON;
        for (i = 0; i < 8; i++) {
          hd = sq + yon[i];
          if (hd & 0x88) continue;
          if (!t[hd]) { if (!almaOnly) ms.push(hamleKur(sq, hd, 0, 0)); }
          else if ((t[hd] & 8) !== rb) ms.push(hamleKur(sq, hd, 0, 0));
        }
        if (tur === 6 && !almaOnly) {
          var ev = renk === BEYAZ ? 4 : 116, hakK = renk === BEYAZ ? 1 : 4, hakU = renk === BEYAZ ? 2 : 8, dusman = renk ^ 1;
          if (sq === ev && !sahta(p)) {
            if ((p.rok & hakK) && !t[ev + 1] && !t[ev + 2] && t[ev + 3] === (4 | rb) &&
                !saldirilmis(p, ev + 1, dusman) && !saldirilmis(p, ev + 2, dusman)) ms.push(hamleKur(ev, ev + 2, 0, ROK_K));
            if ((p.rok & hakU) && !t[ev - 1] && !t[ev - 2] && !t[ev - 3] && t[ev - 4] === (4 | rb) &&
                !saldirilmis(p, ev - 1, dusman) && !saldirilmis(p, ev - 2, dusman)) ms.push(hamleKur(ev, ev - 2, 0, ROK_U));
          }
        }
      } else {
        var yonler = tur === 3 ? FIL_YON : tur === 4 ? KALE_YON : SAH_YON;
        var adet = tur === 5 ? 8 : 4;
        for (i = 0; i < adet; i++) {
          dir = yonler[i]; hd = sq + dir;
          while (!(hd & 0x88)) {
            k = t[hd];
            if (!k) { if (!almaOnly) ms.push(hamleKur(sq, hd, 0, 0)); }
            else { if ((k & 8) !== rb) ms.push(hamleKur(sq, hd, 0, 0)); break; }
            hd += dir;
          }
        }
      }
    }
    return ms;
  }

  function yap(p, m) {
    var den = m & 127, hd = (m >> 7) & 127, terfi = (m >> 14) & 7, bay = m >> 17;
    var t = p.t, x = t[den], tur = x & 7, renk = p.sira, alinan = t[hd], h = p.hash, n = p.n;
    p.gM[n] = m; p.gRok[n] = p.rok; p.gEp[n] = p.ep; p.gYarim[n] = p.yarim;
    h ^= Z[x][den];
    if (alinan) h ^= Z[alinan][hd];
    t[den] = 0;
    if (bay & EP) {
      var ks = hd + (renk === BEYAZ ? -16 : 16);
      alinan = t[ks]; h ^= Z[alinan][ks]; t[ks] = 0;
    }
    p.gAlinan[n] = alinan;
    var yeni = terfi ? (terfi | (renk << 3)) : x;
    t[hd] = yeni; h ^= Z[yeni][hd];
    if (bay & ROK_K) { var r1 = t[hd + 1]; t[hd + 1] = 0; t[hd - 1] = r1; h ^= Z[r1][hd + 1] ^ Z[r1][hd - 1]; }
    else if (bay & ROK_U) { var r2 = t[hd - 2]; t[hd - 2] = 0; t[hd + 1] = r2; h ^= Z[r2][hd - 2] ^ Z[r2][hd + 1]; }
    if (tur === 6) p.sah[renk] = hd;
    var rokYeni = p.rok & ROK_MASKE[den] & ROK_MASKE[hd];
    h ^= Z_ROK[p.rok] ^ Z_ROK[rokYeni]; p.rok = rokYeni;
    p.ep = (bay & CIFT) ? (den + hd) >> 1 : -1;
    p.yarim = (tur === 1 || alinan) ? 0 : p.yarim + 1;
    if (renk === SIYAH) p.tam++;
    p.sira = renk ^ 1; h ^= Z_SIRA;
    p.hash = h | 0; p.n = n + 1; p.gHash[p.n] = p.hash;
  }
  function geriAl(p) {
    var n = --p.n, m = p.gM[n], den = m & 127, hd = (m >> 7) & 127, terfi = (m >> 14) & 7, bay = m >> 17;
    var t = p.t, renk = p.sira ^ 1, alinan = p.gAlinan[n], x = t[hd];
    if (terfi) x = 1 | (renk << 3);
    t[den] = x;
    if (bay & EP) { t[hd] = 0; t[hd + (renk === BEYAZ ? -16 : 16)] = alinan; }
    else t[hd] = alinan;
    if (bay & ROK_K) { t[hd + 1] = t[hd - 1]; t[hd - 1] = 0; }
    else if (bay & ROK_U) { t[hd - 2] = t[hd + 1]; t[hd + 1] = 0; }
    if ((x & 7) === 6) p.sah[renk] = den;
    p.rok = p.gRok[n]; p.ep = p.gEp[n]; p.yarim = p.gYarim[n];
    if (renk === SIYAH) p.tam--;
    p.sira = renk; p.hash = p.gHash[n];
  }
  // Boş hamle (arama budaması): taş oynamadan sırayı verir.
  function bosYap(p) {
    var n = p.n; p.gM[n] = 0; p.gEp[n] = p.ep; p.gRok[n] = p.rok; p.gYarim[n] = p.yarim;
    p.ep = -1; p.sira ^= 1; p.hash = (p.hash ^ Z_SIRA) | 0; p.n = n + 1; p.gHash[p.n] = p.hash; p.yarim++;
  }
  function bosGeriAl(p) {
    var n = --p.n; p.sira ^= 1; p.ep = p.gEp[n]; p.yarim = p.gYarim[n]; p.hash = p.gHash[n];
  }

  // Yasal hamleler. Her hamleyi dener; kendi şahını açıkta bırakanları eler.
  function yasal(p) {
    var ms = uret(p, false), ok = [], renk = p.sira;
    for (var i = 0; i < ms.length; i++) {
      yap(p, ms[i]);
      if (!saldirilmis(p, p.sah[renk], renk ^ 1)) ok.push(ms[i]);
      geriAl(p);
    }
    return ok;
  }
  function perft(p, derinlik) {
    if (derinlik === 0) return 1;
    var ms = uret(p, false), renk = p.sira, say = 0;
    for (var i = 0; i < ms.length; i++) {
      yap(p, ms[i]);
      if (!saldirilmis(p, p.sah[renk], renk ^ 1)) say += derinlik === 1 ? 1 : perft(p, derinlik - 1);
      geriAl(p);
    }
    return say;
  }
  function hamleBul(p, metin) {
    var ms = yasal(p);
    for (var i = 0; i < ms.length; i++) if (hamleYaz(ms[i]) === metin) return ms[i];
    return 0;
  }

  // ---------- Sonuç ----------
  function yetersizMateryal(p) {
    var t = p.t, azTas = 0, filKareleri = [], at = 0;
    for (var k = 0; k < 128; k++) {
      if (k & 0x88) { k += 7; continue; }
      var x = t[k] & 7;
      if (!x || x === 6) continue;
      if (x === 1 || x === 4 || x === 5) return false;
      azTas++;
      if (x === 3) filKareleri.push(((k >> 4) + (k & 7)) & 1); else at++;
    }
    if (azTas <= 1) return true;
    if (at === 0) { for (var i = 1; i < filKareleri.length; i++) if (filKareleri[i] !== filKareleri[0]) return false; return true; }
    return false;
  }
  function sahDurumu(p) { return sahta(p); }

  // ---------- Notasyon ----------
  var HARF_TR = { 2: 'A', 3: 'F', 4: 'K', 5: 'V', 6: 'Ş' };
  var HARF_EN = { 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  // dil: 'tr' (Ş V K F A) ya da 'en' (PGN için K Q R B N). Hamle yapılmadan, konum henüz eskiyken çağrılır.
  function san(p, m, dil) {
    var harf = dil === 'en' ? HARF_EN : HARF_TR;
    var den = hamleDen(m), hd = hamleHedef(m), terfi = hamleTerfi(m), bay = hamleBayrak(m);
    var x = p.t[den], tur = x & 7, s = '';
    if (bay & ROK_K) s = 'O-O';
    else if (bay & ROK_U) s = 'O-O-O';
    else {
      var alma = !!p.t[hd] || !!(bay & EP);
      if (tur === 1) { if (alma) s += 'abcdefgh'.charAt(den & 7); }
      else {
        s += harf[tur];
        var ayni = yasal(p).filter(function (o) { return o !== m && hamleHedef(o) === hd && (p.t[hamleDen(o)] & 7) === tur; });
        if (ayni.length) {
          var ayniSutun = ayni.some(function (o) { return (hamleDen(o) & 7) === (den & 7); });
          var ayniSira = ayni.some(function (o) { return (hamleDen(o) >> 4) === (den >> 4); });
          if (!ayniSutun) s += 'abcdefgh'.charAt(den & 7);
          else if (!ayniSira) s += (den >> 4) + 1;
          else s += kareAdi(den);
        }
      }
      if (alma) s += 'x';
      s += kareAdi(hd);
      if (terfi) s += '=' + harf[terfi];
    }
    yap(p, m);
    if (sahta(p)) s += yasal(p).length ? '+' : '#';
    geriAl(p);
    return s;
  }

  // ---------- Oyun: konum + geçmiş + tekrar anahtarları ----------
  function tekrarAnahtari(p) {
    // Geçerken alma yalnızca gerçekten yapılabiliyorsa anahtara girer (FIDE tekrar tanımı).
    var ep = '-';
    if (p.ep >= 0) {
      var ms = yasal(p);
      for (var i = 0; i < ms.length; i++) if (hamleBayrak(ms[i]) & EP) { ep = kareAdi(p.ep); break; }
    }
    var kopya = fenYaz(p, true).split(' ');
    kopya[3] = ep;
    return kopya.join(' ');
  }
  function Oyun(fen) {
    this.baslangic = fen || BASLANGIC;
    this.konum = fenOku(this.baslangic);
    this.hamleler = []; this.sanlar = []; this.anahtarlar = [tekrarAnahtari(this.konum)];
  }
  Oyun.prototype.yap = function (m) {
    this.sanlar.push(san(this.konum, m, 'tr'));
    yap(this.konum, m);
    this.hamleler.push(m);
    this.anahtarlar.push(tekrarAnahtari(this.konum));
  };
  Oyun.prototype.geriAl = function () {
    if (!this.hamleler.length) return 0;
    geriAl(this.konum);
    this.anahtarlar.pop(); this.sanlar.pop();
    return this.hamleler.pop();
  };
  Oyun.prototype.yasal = function () { return yasal(this.konum); };
  // { bitti, sonuc: 'mat'|'pat'|'uc-tekrar'|'elli-hamle'|'yetersiz'|null, kazanan: 0|1|null, sah }
  Oyun.prototype.durum = function () {
    var p = this.konum, sah = sahta(p);
    if (!yasal(p).length) return sah ? { bitti: true, sonuc: 'mat', kazanan: p.sira ^ 1, sah: true } : { bitti: true, sonuc: 'pat', kazanan: null, sah: false };
    var anahtar = this.anahtarlar[this.anahtarlar.length - 1], say = 0;
    for (var i = 0; i < this.anahtarlar.length; i++) if (this.anahtarlar[i] === anahtar) say++;
    if (say >= 3) return { bitti: true, sonuc: 'uc-tekrar', kazanan: null, sah: sah };
    if (p.yarim >= 100) return { bitti: true, sonuc: 'elli-hamle', kazanan: null, sah: sah };
    if (yetersizMateryal(p)) return { bitti: true, sonuc: 'yetersiz', kazanan: null, sah: sah };
    return { bitti: false, sonuc: null, kazanan: null, sah: sah };
  };
  Oyun.prototype.uciListesi = function () { return this.hamleler.map(hamleYaz); };
  Oyun.prototype.pgn = function (ayar) {
    ayar = ayar || {};
    var d = this.durum(), sonuc = d.bitti ? (d.kazanan === BEYAZ ? '1-0' : d.kazanan === SIYAH ? '0-1' : '1/2-1/2') : '*';
    var bas = fenOku(this.baslangic), s = '';
    var tarih = ayar.tarih || '????.??.??';
    s += '[Event "Her Gece Oyun - Satranç"]\n[Site "Her Gece Oyun"]\n[Date "' + tarih + '"]\n[Round "-"]\n';
    s += '[White "' + (ayar.beyaz || 'Beyaz') + '"]\n[Black "' + (ayar.siyah || 'Siyah') + '"]\n[Result "' + sonuc + '"]\n';
    if (this.baslangic !== BASLANGIC) s += '[SetUp "1"]\n[FEN "' + this.baslangic + '"]\n';
    s += '\n';
    var parcalar = [], no = bas.tam, sira = bas.sira;
    for (var i = 0; i < this.hamleler.length; i++) {
      var metin = san(bas, this.hamleler[i], 'en');
      yap(bas, this.hamleler[i]);
      if (sira === BEYAZ) parcalar.push(no + '. ' + metin);
      else { parcalar.push((i === 0 ? no + '... ' : '') + metin); no++; }
      sira ^= 1;
    }
    return s + parcalar.join(' ') + (parcalar.length ? ' ' : '') + sonuc + '\n';
  };

  // ---------- Açılış adları ve küçük kitap ----------
  var ACILISLAR = [
    ['Kral Piyonu Açılışı', 'e2e4'], ['Vezir Piyonu Açılışı', 'd2d4'], ['İngiliz Açılışı', 'c2c4'], ['Réti Açılışı', 'g1f3'],
    ['Açık Oyun', 'e2e4 e7e5'], ['Sicilya Savunması', 'e2e4 c7c5'], ['Fransız Savunması', 'e2e4 e7e6'],
    ['Caro-Kann Savunması', 'e2e4 c7c6'], ['İskandinav Savunması', 'e2e4 d7d5'], ['Pirç Savunması', 'e2e4 d7d6'],
    ['Alekhine Savunması', 'e2e4 g8f6'], ['Kral Gambiti', 'e2e4 e7e5 f2f4'], ['İskoç Oyunu', 'e2e4 e7e5 g1f3 b8c6 d2d4'],
    ['İtalyan Oyunu', 'e2e4 e7e5 g1f3 b8c6 f1c4'], ['İspanyol Açılışı', 'e2e4 e7e5 g1f3 b8c6 f1b5'],
    ['Rus Savunması', 'e2e4 e7e5 g1f3 g8f6'], ['Sicilya, Açık Varyant', 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4'],
    ['İspanyol, Morphy Savunması', 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6'],
    ['Vezir Piyonu Oyunu', 'd2d4 d7d5'], ['Vezir Gambiti', 'd2d4 d7d5 c2c4'], ['Vezir Gambiti Reddedildi', 'd2d4 d7d5 c2c4 e7e6'],
    ['Slav Savunması', 'd2d4 d7d5 c2c4 c7c6'], ['Londra Sistemi', 'd2d4 d7d5 g1f3 g8f6 c1f4'],
    ['Hint Savunması', 'd2d4 g8f6'], ['Kral Hint Savunması', 'd2d4 g8f6 c2c4 g7g6'],
    ['Nimzo-Hint Savunması', 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4']
  ];
  function acilisAdi(uciListe) {
    var en = null, enUzun = 0;
    for (var i = 0; i < ACILISLAR.length; i++) {
      var h = ACILISLAR[i][1].split(' ');
      if (h.length > uciListe.length || h.length < enUzun) continue;
      var uyar = true;
      for (var j = 0; j < h.length; j++) if (uciListe[j] !== h[j]) { uyar = false; break; }
      if (uyar) { en = ACILISLAR[i][0]; enUzun = h.length; }
    }
    return en;
  }
  function kitapHamlesi(uciListe, rnd) {
    var adaylar = [];
    for (var i = 0; i < ACILISLAR.length; i++) {
      var h = ACILISLAR[i][1].split(' ');
      if (h.length <= uciListe.length) continue;
      var uyar = true;
      for (var j = 0; j < uciListe.length; j++) if (uciListe[j] !== h[j]) { uyar = false; break; }
      if (uyar) adaylar.push(h[uciListe.length]);
    }
    return adaylar.length ? adaylar[Math.floor(rnd() * adaylar.length)] : null;
  }

  // ---------- Değerlendirme ----------
  var PST = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  };
  var SAH_SON = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

  // Sıradaki oyuncu açısından puan (santipiyon).
  function degerlendir(p) {
    var t = p.t, puan = 0, vezir = 0, filB = 0, filS = 0;
    for (var k = 0; k < 128; k++) {
      if (k & 0x88) { k += 7; continue; }
      if ((t[k] & 7) === 5) vezir++;
    }
    for (k = 0; k < 128; k++) {
      if (k & 0x88) { k += 7; continue; }
      var x = t[k];
      if (!x) continue;
      var tur = x & 7, renk = (x & 8) >> 3, f = k & 7, r = k >> 4;
      var idx = renk === BEYAZ ? (7 - r) * 8 + f : r * 8 + f;
      var tablo = tur === 6 && !vezir ? SAH_SON : PST[tur];
      var v = DEGER[tur] + tablo[idx];
      if (tur === 3) { if (renk) filS++; else filB++; }
      puan += renk === BEYAZ ? v : -v;
    }
    if (filB > 1) puan += 30;
    if (filS > 1) puan -= 30;
    return p.sira === BEYAZ ? puan : -puan;
  }

  // ---------- Arama ----------
  // Seviyeler: rastgele (1), gürültülü sığ arama (2-3), zaman sınırlı yinelemeli derinleşme (4-5).
  var SEVIYELER = [null,
    { ad: 'Çaylak', rastgele: true },
    { ad: 'Acemi', derinlik: 1, gurultu: 140, sure: 300, kitap: 0.3 },
    { ad: 'Orta', derinlik: 2, gurultu: 55, sure: 500, kitap: 0.8 },
    { ad: 'İleri', derinlik: 5, sure: 900, kitap: 0.9 },
    { ad: 'Usta', derinlik: 12, sure: 1500, kitap: 0.95 }
  ];

  function ara(p, ayar) {
    var bas = Date.now(), sure = ayar.sure || 1000, maxD = ayar.derinlik || 1, gurultu = ayar.gurultu || 0;
    var rnd = ayar.rnd || Math.random;
    var dugum = 0, dur = false, ply0 = p.n, INF = 32000;
    var oldurucu = [], gecmis = new Int32Array(16 * 128);
    for (var q = 0; q < 80; q++) oldurucu.push([0, 0]);
    var renk0 = p.sira;

    function tekrar() {
      var h = p.hash, n = p.n, git = Math.min(p.yarim, n);
      for (var i = 2; i <= git; i += 2) if (p.gHash[n - i] === h) return true;
      return false;
    }
    function skorla(ms, pv, ply) {
      var s = new Array(ms.length);
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i], hd = hamleHedef(m), den = hamleDen(m), v = p.t[hd], sk = 0;
        if (m === pv) sk = 1000000;
        else if (v || (hamleBayrak(m) & EP)) sk = 100000 + 10 * DEGER[v & 7 || 1] - DEGER[p.t[den] & 7];
        else if (hamleTerfi(m)) sk = 90000;
        else if (oldurucu[ply] && oldurucu[ply][0] === m) sk = 80000;
        else if (oldurucu[ply] && oldurucu[ply][1] === m) sk = 79000;
        else sk = gecmis[(p.t[den] & 15) * 128 + hd];
        s[i] = sk;
      }
      return s;
    }
    function sec(ms, s, i) {
      var en = i;
      for (var j = i + 1; j < ms.length; j++) if (s[j] > s[en]) en = j;
      if (en !== i) { var tm = ms[i]; ms[i] = ms[en]; ms[en] = tm; var ts = s[i]; s[i] = s[en]; s[en] = ts; }
    }
    function sessiz(alfa, beta, ply) {
      if ((++dugum & 2047) === 0 && Date.now() - bas > sure) dur = true;
      if (dur) return 0;
      var durus = degerlendir(p);
      if (ply > 60) return durus;
      if (durus >= beta) return durus;
      if (durus > alfa) alfa = durus;
      var ms = uret(p, true), s = skorla(ms, 0, ply), renk = p.sira;
      for (var i = 0; i < ms.length; i++) {
        sec(ms, s, i);
        yap(p, ms[i]);
        if (saldirilmis(p, p.sah[renk], renk ^ 1)) { geriAl(p); continue; }
        var v = -sessiz(-beta, -alfa, ply + 1);
        geriAl(p);
        if (dur) return 0;
        if (v >= beta) return v;
        if (v > alfa) alfa = v;
      }
      return alfa;
    }
    function nm(d, alfa, beta, ply, bosOk) {
      if ((++dugum & 2047) === 0 && Date.now() - bas > sure) dur = true;
      if (dur) return 0;
      if (ply > 0 && (p.yarim >= 100 || tekrar())) return 0;
      var renk = p.sira, sahda = saldirilmis(p, p.sah[renk], renk ^ 1);
      if (sahda && ply < 40) d++;
      if (d <= 0) return sessiz(alfa, beta, ply);
      // boş hamle budaması: yalnızca piyon dışı taşı olan, şahta olmayan tarafta
      if (bosOk && !sahda && d >= 3 && beta < MAT - 100) {
        var tasVar = false;
        for (var k = 0; k < 128 && !tasVar; k++) { if (k & 0x88) { k += 7; continue; } var x = p.t[k]; if (x && (x & 8) >> 3 === renk && (x & 7) > 1 && (x & 7) < 6) tasVar = true; }
        if (tasVar) {
          bosYap(p);
          var vb = -nm(d - 3, -beta, -beta + 1, ply + 1, false);
          bosGeriAl(p);
          if (dur) return 0;
          if (vb >= beta) return beta;
        }
      }
      var ms = uret(p, false), s = skorla(ms, 0, ply), yasalSay = 0, en = -INF;
      for (var i = 0; i < ms.length; i++) {
        sec(ms, s, i);
        var m = ms[i], sessizHamle = !p.t[hamleHedef(m)] && !(hamleBayrak(m) & EP) && !hamleTerfi(m), tas = p.t[hamleDen(m)] & 15;
        yap(p, m);
        if (saldirilmis(p, p.sah[renk], renk ^ 1)) { geriAl(p); continue; }
        yasalSay++;
        var v;
        if (yasalSay > 4 && d >= 3 && sessizHamle && !sahda) {
          v = -nm(d - 2, -alfa - 1, -alfa, ply + 1, true);
          if (v > alfa) v = -nm(d - 1, -beta, -alfa, ply + 1, true);
        } else v = -nm(d - 1, -beta, -alfa, ply + 1, true);
        geriAl(p);
        if (dur) return 0;
        if (v > en) en = v;
        if (v > alfa) alfa = v;
        if (alfa >= beta) {
          if (sessizHamle) {
            if (oldurucu[ply][0] !== m) { oldurucu[ply][1] = oldurucu[ply][0]; oldurucu[ply][0] = m; }
            gecmis[tas * 128 + hamleHedef(m)] += d * d;
          }
          break;
        }
      }
      if (!yasalSay) return sahda ? -MAT + ply : 0;
      return en;
    }

    var kok = yasal(p);
    if (!kok.length) return { hamle: 0, puan: sahta(p) ? -MAT : 0, derinlik: 0, dugum: 0, sure: 0 };
    if (kok.length === 1) return { hamle: kok[0], puan: 0, derinlik: 0, dugum: 0, sure: 0 };

    // Gürültülü seviyeler: sabit derinlikte her hamleyi ayrı puanla, puana rastgelelik ekle.
    if (gurultu) {
      var enHamle = kok[0], enPuan = -Infinity;
      for (var i = 0; i < kok.length; i++) {
        yap(p, kok[i]);
        var pv = -nm(maxD - 1, -INF, INF, 1, false);
        geriAl(p);
        if (dur) break;
        var oynanmis = pv + (rnd() - 0.5) * 2 * gurultu;
        if (oynanmis > enPuan) { enPuan = oynanmis; enHamle = kok[i]; }
      }
      return { hamle: enHamle, puan: enPuan, derinlik: maxD, dugum: dugum, sure: Date.now() - bas };
    }

    var enIyi = kok[0], enPuanK = 0, tamamlanan = 0;
    for (var d = 1; d <= maxD; d++) {
      var alfa = -INF, beta = INF, iterEn = 0, iterPuan = -INF, sk = skorla(kok, enIyi, 0);
      for (var j = 0; j < kok.length; j++) {
        sec(kok, sk, j);
        yap(p, kok[j]);
        var vv = -nm(d - 1, -beta, -alfa, 1, true);
        geriAl(p);
        if (dur) break;
        if (vv > iterPuan) { iterPuan = vv; iterEn = kok[j]; }
        if (vv > alfa) alfa = vv;
      }
      if (dur && d > 1) break;
      if (iterEn) { enIyi = iterEn; enPuanK = iterPuan; tamamlanan = d; }
      if (dur) break;
      if (Math.abs(enPuanK) > MAT - 100) break; // mat bulundu
      if (Date.now() - bas > sure * 0.55) break; // yeni yineleme bitmez
    }
    return { hamle: enIyi, puan: enPuanK, derinlik: tamamlanan, dugum: dugum, sure: Date.now() - bas };
  }

  // Bilgisayarın hamlesi (seviye 1-5). oyun: Oyun; döner: UCI metni ('e2e4') ya da null.
  function bilgisayarHamlesi(oyun, seviye, rnd) {
    rnd = rnd || Math.random;
    var ayar = SEVIYELER[seviye] || SEVIYELER[3], p = oyun.konum, ms = yasal(p);
    if (!ms.length) return null;
    if (ayar.rastgele) {
      var almalar = ms.filter(function (m) { return p.t[hamleHedef(m)]; });
      var havuz = almalar.length && rnd() < 0.35 ? almalar : ms;
      return hamleYaz(havuz[Math.floor(rnd() * havuz.length)]);
    }
    if (p.n < 12 && ayar.kitap && rnd() < ayar.kitap && oyun.baslangic === BASLANGIC) {
      var kh = kitapHamlesi(oyun.uciListesi(), rnd);
      if (kh && hamleBul(p, kh)) return kh;
    }
    var sonuc = ara(p, { derinlik: ayar.derinlik, sure: ayar.sure, gurultu: ayar.gurultu, rnd: rnd });
    return sonuc.hamle ? hamleYaz(sonuc.hamle) : hamleYaz(ms[0]);
  }

  // ---------- Mat çözücü (günün bulmacası) ----------
  // Sıradaki tarafın n hamlede zorunlu mat edebildiği ilk hamleler (bulmaca doğrulaması).
  function matHamleleri(p, n) {
    var kazanan = [], ms = yasal(p);
    for (var i = 0; i < ms.length; i++) {
      yap(p, ms[i]);
      var cevaplar = yasal(p), tamam = false;
      if (!cevaplar.length) tamam = sahta(p);
      else if (n > 1) {
        tamam = true;
        for (var j = 0; j < cevaplar.length; j++) {
          yap(p, cevaplar[j]);
          var devam = matHamleleri(p, n - 1).length > 0;
          geriAl(p);
          if (!devam) { tamam = false; break; }
        }
      }
      geriAl(p);
      if (tamam) kazanan.push(ms[i]);
    }
    return kazanan;
  }
  // Savunan tarafın "en iyi" cevabı: bir hamle sonrası statik puanı en yüksek olan (bulmacada rakibin otomatik cevabı).
  function savunmaHamlesi(p) {
    var ms = yasal(p), en = ms[0], enSkor = -Infinity;
    for (var i = 0; i < ms.length; i++) {
      yap(p, ms[i]);
      var skor = -degerlendir(p);
      geriAl(p);
      if (skor > enSkor) { enSkor = skor; en = ms[i]; }
    }
    return en;
  }

  // Günün bulmacası: yerel gün anahtarından ('YYYY-AA-GG') havuzdaki sırayı seçer. Aynı gün herkese aynı bulmaca;
  // ardışık günler havuzda atlayarak ilerler (adım havuz boyuyla aralarında asal), tur bitmeden tekrar etmez.
  function bulmacaSirasi(gunAnahtari, adet) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(gunAnahtari);
    if (!p || !adet) return 0;
    var gunNo = Math.round(Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3])) / 86400000);
    function ebob(a, b) { return b ? ebob(b, a % b) : a; }
    var adim = 37;
    while (ebob(adim, adet) !== 1) adim++;
    return ((gunNo % adet) * (adim % adet)) % adet;
  }

  // Tehdit altındaki taşlar: rakip tarafından tutulan ve ya korumasız ya da daha değersiz bir taşla tutulan taşlar.
  function tehditler(p, renk) {
    var liste = [];
    for (var k = 0; k < 128; k++) {
      if (k & 0x88) { k += 7; continue; }
      var x = p.t[k];
      if (!x || (x & 8) >> 3 !== renk || (x & 7) === 6) continue;
      var saldiran = enKucukSaldiran(p, k, renk ^ 1);
      if (!saldiran) continue;
      var koruyan = enKucukSaldiran(p, k, renk);
      if (!koruyan || saldiran < DEGER[x & 7]) liste.push(k);
    }
    return liste;
  }

  var Motor = {
    BASLANGIC: BASLANGIC, BEYAZ: BEYAZ, SIYAH: SIYAH, SEVIYELER: SEVIYELER, ACILISLAR: ACILISLAR, MAT: MAT,
    EP: EP, CIFT: CIFT, ROK_K: ROK_K, ROK_U: ROK_U,
    kareAdi: kareAdi, kareKodu: kareKodu, hamleKur: hamleKur, hamleDen: hamleDen, hamleHedef: hamleHedef, hamleTerfi: hamleTerfi,
    hamleBayrak: hamleBayrak, hamleYaz: hamleYaz, hamleBul: hamleBul,
    fenOku: fenOku, fenYaz: fenYaz, yap: yap, geriAl: geriAl, yasal: yasal, perft: perft, sahta: sahta, saldirilmis: saldirilmis,
    san: san, Oyun: Oyun, acilisAdi: acilisAdi, kitapHamlesi: kitapHamlesi, degerlendir: degerlendir, ara: ara,
    bilgisayarHamlesi: bilgisayarHamlesi, matHamleleri: matHamleleri, savunmaHamlesi: savunmaHamlesi, bulmacaSirasi: bulmacaSirasi, tehditler: tehditler,
    yetersizMateryal: yetersizMateryal, sahDurumu: sahDurumu
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
  else kok.SatrancMotor = Motor;
})(typeof self !== 'undefined' ? self : this);
