// Pasyans'ın (Klondike) saf oyun mantığı: tarayıcıda window.PasyansMantik, Node testlerinde module.exports.
// Kart bir tamsayıdır: tip * 13 + (değer - 1). Tipler: 0 Maça, 1 Kupa, 2 Karo, 3 Sinek. Değerler 1 (As) .. 13 (Papaz).
// Durum: { sutun: [{ kapali: [...], acik: [...] } × 7], temel: [4 dizi, tipe göre], stok, atik, cekilis, turSiniri, tur, hamle, gecmis }.
// Dizilerde son eleman üsttedir (sütunda en alttaki görünen kart, stokta çekilecek kart, atıkta açık kart).
(function (kok) {
  var TIPLER = ['Maça', 'Kupa', 'Karo', 'Sinek'];
  var TIP_SEMBOL = ['♠', '♥', '♦', '♣'];
  var DEGER_AD = ['', 'As', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Vale', 'Kız', 'Papaz'];
  var DEGER_ISARET = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var SUTUN_SAYISI = 7;
  var GECMIS_SINIR = 600;
  var AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  function tip(k) { return (k / 13) | 0; }
  function deger(k) { return (k % 13) + 1; }
  function kirmizi(k) { var t = tip(k); return t === 1 || t === 2; }
  function kartAdi(k) { return TIPLER[tip(k)] + ' ' + DEGER_AD[deger(k)]; }
  function isaret(k) { return DEGER_ISARET[deger(k)]; }

  // Tohumlu, deterministik rastgele sayı üreteci (mulberry32).
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

  // Aynı tohum her zaman aynı desteyi verir (Fisher–Yates).
  function karistir(tohum) {
    var rastgele = uretec(tohum);
    var deste = [];
    for (var i = 0; i < 52; i++) deste.push(i);
    for (var j = 51; j > 0; j--) {
      var r = Math.floor(rastgele() * (j + 1));
      var gecici = deste[j]; deste[j] = deste[r]; deste[r] = gecici;
    }
    return deste;
  }

  // Desteyi dağıtır: i. sütuna i + 1 kart (sonuncusu açık), kalan 24 kart stoğa.
  function dagit(deste, cekilis, turSiniri, tohum) {
    var sutun = [];
    var s = 0;
    for (var i = 0; i < SUTUN_SAYISI; i++) {
      var kartlar = deste.slice(s, s + i + 1);
      s += i + 1;
      sutun.push({ kapali: kartlar.slice(0, i), acik: [kartlar[i]] });
    }
    return {
      sutun: sutun, temel: [[], [], [], []], stok: deste.slice(s), atik: [],
      cekilis: cekilis === 3 ? 3 : 1, turSiniri: turSiniri == null ? null : turSiniri, tur: 1, hamle: 0,
      tohum: tohum == null ? null : tohum, dogrulandi: false, gecmis: []
    };
  }

  function yeniEl(tohum, cekilis, turSiniri) {
    return dagit(karistir(tohum), cekilis, turSiniri, tohum);
  }

  function klonSade(d) {
    return {
      sutun: d.sutun.map(function (s) { return { kapali: s.kapali.slice(), acik: s.acik.slice() }; }),
      temel: d.temel.map(function (t) { return t.slice(); }),
      stok: d.stok.slice(), atik: d.atik.slice(), cekilis: d.cekilis, turSiniri: d.turSiniri, tur: d.tur, hamle: d.hamle,
      tohum: d.tohum, dogrulandi: d.dogrulandi
    };
  }
  function klon(d) { var n = klonSade(d); n.gecmis = d.gecmis; return n; }

  function kazandiMi(d) {
    return d.temel[0].length + d.temel[1].length + d.temel[2].length + d.temel[3].length === 52;
  }

  // ---------- Kurallar ----------
  function sutunUstu(d, i) { var a = d.sutun[i].acik; return a.length ? a[a.length - 1] : -1; }

  // Renk değişimi, azalan sıra, boş sütuna yalnızca papaz.
  function sutunaKonurMu(d, i, kart) {
    var s = d.sutun[i];
    if (!s.acik.length) return s.kapali.length === 0 && deger(kart) === 13;
    var u = s.acik[s.acik.length - 1];
    return kirmizi(u) !== kirmizi(kart) && deger(u) === deger(kart) + 1;
  }
  // Temelde her tipin kendi yuvası vardır; sıra As'tan başlayıp tek tek artar.
  function temeleKonurMu(d, kart) { return d.temel[tip(kart)].length === deger(kart) - 1; }

  function cekebilirMi(d) {
    return d.stok.length > 0 || (d.atik.length > 0 && (d.turSiniri == null || d.tur < d.turSiniri));
  }

  // Kaynağın taşıyacağı kartlar (üstten alta sırayla, ilk eleman en alttaki); geçersizse null.
  function kaynakKartlar(d, k) {
    if (!k) return null;
    if (k.yer === 'atik') return d.atik.length ? [d.atik[d.atik.length - 1]] : null;
    if (k.yer === 'temel') {
      var t = d.temel[k.i];
      return t && t.length ? [t[t.length - 1]] : null;
    }
    if (k.yer === 'sutun') {
      var s = d.sutun[k.i];
      if (!s || !(k.n >= 1) || k.n > s.acik.length) return null;
      return s.acik.slice(s.acik.length - k.n);
    }
    return null;
  }

  function hamleGecerliMi(d, h) {
    if (!h) return false;
    if (h.tip === 'cek') return cekebilirMi(d);
    if (h.tip !== 'tasi') return false;
    var kartlar = kaynakKartlar(d, h.kaynak);
    if (!kartlar || !h.hedef) return false;
    if (h.hedef.yer === 'temel') {
      return kartlar.length === 1 && h.kaynak.yer !== 'temel' && h.hedef.i === tip(kartlar[0]) && temeleKonurMu(d, kartlar[0]);
    }
    if (h.hedef.yer === 'sutun') {
      if (!(h.hedef.i >= 0 && h.hedef.i < SUTUN_SAYISI)) return false;
      if (h.kaynak.yer === 'sutun' && h.kaynak.i === h.hedef.i) return false;
      return sutunaKonurMu(d, h.hedef.i, kartlar[0]);
    }
    return false;
  }

  // d'yi yerinde değiştirir. say: hamle sayacı artsın mı.
  function uygula(d, h, say) {
    if (h.tip === 'cek') {
      if (d.stok.length) {
        for (var i = 0; i < d.cekilis && d.stok.length; i++) d.atik.push(d.stok.pop());
      } else {
        d.stok = d.atik.reverse();
        d.atik = [];
        d.tur++;
      }
    } else {
      var k = h.kaynak, kartlar;
      if (k.yer === 'atik') kartlar = [d.atik.pop()];
      else if (k.yer === 'temel') kartlar = [d.temel[k.i].pop()];
      else {
        var s = d.sutun[k.i];
        kartlar = s.acik.splice(s.acik.length - k.n, k.n);
        if (!s.acik.length && s.kapali.length) s.acik.push(s.kapali.pop()); // alttaki kart açılır
      }
      if (h.hedef.yer === 'temel') d.temel[h.hedef.i].push(kartlar[0]);
      else Array.prototype.push.apply(d.sutun[h.hedef.i].acik, kartlar);
    }
    if (say) d.hamle++;
    return d;
  }

  // Kullanıcı hamlesi: geçmişe önceki durumu ekler. Geçersizse null.
  function hamleYap(d, h) {
    if (!hamleGecerliMi(d, h)) return null;
    var yeni = klon(d);
    var onceki = klonSade(d);
    yeni.gecmis = d.gecmis.length >= GECMIS_SINIR ? d.gecmis.slice(1).concat([onceki]) : d.gecmis.concat([onceki]);
    return uygula(yeni, h, true);
  }

  // Geri al: son kullanıcı hamlesini (ve ona bağlı otomatik temel taşımalarını) geri alır. Geçmiş boşsa null.
  function geriAl(d) {
    if (!d.gecmis.length) return null;
    var onceki = klonSade(d.gecmis[d.gecmis.length - 1]);
    onceki.gecmis = d.gecmis.slice(0, -1);
    return onceki;
  }

  // Otomatik taşıma: geçmişe yazılmaz ve hamle sayılmaz (geri al, kullanıcı hamlesiyle birlikte geri sarar).
  function otoUygula(d, h) {
    if (!hamleGecerliMi(d, h)) return null;
    return uygula(klon(d), h, false);
  }

  // ---------- Hedef seçimi ----------
  function temelHedefi(d, kart) { return { yer: 'temel', i: tip(kart) }; }

  // Kaynağın geçerli tüm hedefleri (önce temel, sonra dolu sütunlar, en sonda ilk boş sütun).
  function hedefler(d, kaynak) {
    var kartlar = kaynakKartlar(d, kaynak);
    if (!kartlar) return [];
    var sonuc = [];
    if (kartlar.length === 1 && kaynak.yer !== 'temel' && temeleKonurMu(d, kartlar[0])) sonuc.push(temelHedefi(d, kartlar[0]));
    var bos = [];
    for (var i = 0; i < SUTUN_SAYISI; i++) {
      if (kaynak.yer === 'sutun' && kaynak.i === i) continue;
      if (!sutunaKonurMu(d, i, kartlar[0])) continue;
      if (d.sutun[i].acik.length) sonuc.push({ yer: 'sutun', i: i });
      else bos.push({ yer: 'sutun', i: i });
    }
    return sonuc.concat(bos);
  }

  // Dokunarak taşımada ön izlenen hedef. Boşa kaymamak için, tüm sütunu başka boş sütuna taşımak önerilmez.
  function enIyiHedef(d, kaynak) {
    var liste = hedefler(d, kaynak);
    for (var i = 0; i < liste.length; i++) {
      var h = liste[i];
      if (h.yer === 'sutun' && !d.sutun[h.i].acik.length && kaynak.yer === 'sutun' &&
          kaynak.n === d.sutun[kaynak.i].acik.length && d.sutun[kaynak.i].kapali.length === 0) continue;
      return h;
    }
    return null;
  }

  // ---------- Otomatik temel ve otomatik bitirme ----------
  // Güvenli: bu kartı temelde tutmanın hiçbir faydası yok (zıt renkteki iki tip yeterince ilerlemiş).
  function guvenliMi(d, kart) {
    var v = deger(kart);
    if (v <= 2) return true;
    var zit = kirmizi(kart) ? [0, 3] : [1, 2];
    return d.temel[zit[0]].length >= v - 1 && d.temel[zit[1]].length >= v - 1;
  }

  // Sıradaki güvenli temel hamlesi (yoksa null). Önce atık, sonra sütunlar.
  function otoTemelHamle(d) {
    if (d.atik.length) {
      var a = d.atik[d.atik.length - 1];
      if (temeleKonurMu(d, a) && guvenliMi(d, a)) return { tip: 'tasi', kaynak: { yer: 'atik' }, hedef: temelHedefi(d, a) };
    }
    for (var i = 0; i < SUTUN_SAYISI; i++) {
      var u = sutunUstu(d, i);
      if (u >= 0 && temeleKonurMu(d, u) && guvenliMi(d, u)) return { tip: 'tasi', kaynak: { yer: 'sutun', i: i, n: 1 }, hedef: temelHedefi(d, u) };
    }
    return null;
  }

  // Oyun sonu: kapalı kart kalmadıysa, kartların hepsini temele götüren hamle dizisi (yoksa null).
  // Açgözlü benzetim: temele gidebilen her kartı gönderir, olmuyorsa desteden çeker.
  function bitirDizisi(d) {
    for (var i = 0; i < SUTUN_SAYISI; i++) if (d.sutun[i].kapali.length) return null;
    var c = klonSade(d);
    var dizi = [];
    var cekmeSayaci = 0;
    var hamleSiniri = 400;
    while (!kazandiMi(c) && hamleSiniri-- > 0) {
      var h = null;
      if (c.atik.length && temeleKonurMu(c, c.atik[c.atik.length - 1])) {
        h = { tip: 'tasi', kaynak: { yer: 'atik' }, hedef: temelHedefi(c, c.atik[c.atik.length - 1]) };
      }
      for (var j = 0; !h && j < SUTUN_SAYISI; j++) {
        var u = sutunUstu(c, j);
        if (u >= 0 && temeleKonurMu(c, u)) h = { tip: 'tasi', kaynak: { yer: 'sutun', i: j, n: 1 }, hedef: temelHedefi(c, u) };
      }
      if (h) { cekmeSayaci = 0; }
      else if (cekebilirMi(c) && cekmeSayaci <= c.stok.length + c.atik.length + 1) { h = { tip: 'cek' }; cekmeSayaci++; }
      else return null;
      uygula(c, h, false);
      dizi.push(h);
    }
    return kazandiMi(c) ? dizi : null;
  }

  // ---------- Anlamlı hamleler (ipucu, çözücü, takılma denetimi) ----------
  // Bir sütun hamlesi yalnızca bir kartı açıyor, sütunu boşaltıyor ya da altta kalan kartı işe yarar kılıyorsa anlamlıdır.
  function sutunHamleleri(d) {
    var liste = [];
    for (var i = 0; i < SUTUN_SAYISI; i++) {
      var s = d.sutun[i];
      for (var n = 1; n <= s.acik.length; n++) {
        var ilk = s.acik[s.acik.length - n];
        var tamami = n === s.acik.length;
        var kapaliSayisi = s.kapali.length;
        var acilan = tamami ? -1 : s.acik[s.acik.length - n - 1]; // taşımadan sonra görünen kart
        var kaynak = { yer: 'sutun', i: i, n: n };
        // Temel (yalnızca tek kart)
        if (n === 1 && temeleKonurMu(d, ilk)) {
          liste.push({ tip: 'tasi', kaynak: kaynak, hedef: temelHedefi(d, ilk), oncelik: 0 });
        }
        var bosGoruldu = false;
        for (var j = 0; j < SUTUN_SAYISI; j++) {
          if (j === i || !sutunaKonurMu(d, j, ilk)) continue;
          var bos = !d.sutun[j].acik.length;
          if (bos) { if (bosGoruldu) continue; bosGoruldu = true; }
          var oncelik = -1;
          if (tamami && kapaliSayisi > 0) oncelik = 1; // kapalı kartı açar
          else if (tamami && !bos) oncelik = 4; // sütunu boşaltır
          else if (!tamami && acilan >= 0 && (temeleKonurMu(d, acilan) || altKartIsYarar(d, i, acilan))) oncelik = 3;
          if (oncelik < 0) continue;
          liste.push({ tip: 'tasi', kaynak: kaynak, hedef: { yer: 'sutun', i: j }, oncelik: oncelik });
        }
      }
    }
    return liste;
  }

  // Açılan kart, atık üstüne ya da başka bir sütunun taşınabilir kartına yuva oluyor mu?
  function altKartIsYarar(d, i, acilan) {
    var v = deger(acilan), kr = kirmizi(acilan);
    if (d.atik.length) {
      var a = d.atik[d.atik.length - 1];
      if (deger(a) === v - 1 && kirmizi(a) !== kr) return true;
    }
    for (var j = 0; j < SUTUN_SAYISI; j++) {
      if (j === i) continue;
      var ac = d.sutun[j].acik;
      for (var q = 0; q < ac.length; q++) {
        if (deger(ac[q]) === v - 1 && kirmizi(ac[q]) !== kr) return true;
      }
    }
    return false;
  }

  function atikHamleleri(d) {
    var liste = [];
    if (!d.atik.length) return liste;
    var a = d.atik[d.atik.length - 1];
    var kaynak = { yer: 'atik' };
    if (temeleKonurMu(d, a)) liste.push({ tip: 'tasi', kaynak: kaynak, hedef: temelHedefi(d, a), oncelik: 0 });
    var bosGoruldu = false;
    for (var j = 0; j < SUTUN_SAYISI; j++) {
      if (!sutunaKonurMu(d, j, a)) continue;
      var bos = !d.sutun[j].acik.length;
      if (bos) { if (bosGoruldu) continue; bosGoruldu = true; }
      liste.push({ tip: 'tasi', kaynak: kaynak, hedef: { yer: 'sutun', i: j }, oncelik: 2 });
    }
    return liste;
  }

  // Desteden çekerek ulaşılabilecek atık hamleleri: [{ cekme: k, hamle }]. Hiç çekmeden olanlar k = 0.
  function atikMakrolari(d) {
    var cikti = [];
    var t = klonSade(d);
    var k = 0;
    var gorulen = {};
    var gorulduMu = {};
    while (true) {
      var anahtar = t.stok.join(',') + '|' + t.atik.join(',') + '|' + t.tur;
      if (gorulen[anahtar]) break;
      gorulen[anahtar] = true;
      if (t.atik.length) {
        var kart = t.atik[t.atik.length - 1];
        if (!gorulduMu[kart]) {
          var yeniler = atikHamleleri(t);
          if (yeniler.length) gorulduMu[kart] = true;
          for (var i = 0; i < yeniler.length; i++) cikti.push({ cekme: k, hamle: yeniler[i] });
        }
      }
      if (!cekebilirMi(t) || k > 80) break;
      uygula(t, { tip: 'cek' }, false);
      k++;
    }
    return cikti;
  }

  function oncekiAyni(a, b) { return a.oncelik - b.oncelik; }

  // İpucu listesi: en yararlıdan başlayarak. Hamle yoksa gerekirse "deste çek"; hiçbiri yoksa boş.
  function ipuclari(d) {
    var liste = sutunHamleleri(d).concat(atikHamleleri(d));
    liste.sort(function (a, b) {
      if (a.oncelik !== b.oncelik) return a.oncelik - b.oncelik;
      // Aynı öncelikte, çok kapalı kartlı sütundan açmak daha değerli
      var ka = a.kaynak.yer === 'sutun' ? d.sutun[a.kaynak.i].kapali.length : 0;
      var kb = b.kaynak.yer === 'sutun' ? d.sutun[b.kaynak.i].kapali.length : 0;
      return kb - ka;
    });
    var sonuc = liste.map(function (h) { return { tip: 'tasi', kaynak: h.kaynak, hedef: h.hedef }; });
    if (!sonuc.length) {
      var makrolar = atikMakrolari(d).filter(function (m) { return m.cekme > 0; });
      if (makrolar.length) sonuc.push({ tip: 'cek' });
    } else if (cekebilirMi(d)) {
      sonuc.push({ tip: 'cek' });
    }
    return sonuc;
  }

  // Oynanabilir anlamlı bir hamle var mı (deste çevirerek ulaşılanlar dahil)? Yoksa oyun takılmıştır.
  function hamleVarMi(d) {
    if (kazandiMi(d)) return false;
    if (sutunHamleleri(d).length) return true;
    return atikMakrolari(d).length > 0;
  }

  // ---------- Çözücü ----------
  // Durum anahtarı (ziyaret edilen durumları tanımak için).
  function tamAnahtar(d, sade) {
    var p = [];
    for (var i = 0; i < SUTUN_SAYISI; i++) p.push(d.sutun[i].kapali.length + ':' + d.sutun[i].acik.join('.'));
    var anahtar = p.join('/') + '#' + d.temel[0].length + d.temel[1].length + d.temel[2].length + d.temel[3].length;
    if (sade) {
      var c = d.atik.concat(d.stok.slice().reverse());
      var en = c.length ? c.indexOf(Math.min.apply(null, c)) : 0;
      return anahtar + '#' + c.slice(en).concat(c.slice(0, en)).join('.');
    }
    return anahtar + '#' + d.stok.join('.') + '|' + d.atik.join('.') + '|' + d.tur;
  }

  // Derinlik öncelikli arama. Sonuç: { sonuc: 'kazanir' | 'kazanamaz' | 'bilinmiyor', hamleler, dugum }.
  // dugumSiniri belirleyicidir (herkeste aynı sonuç); sureMs yalnızca ek güvenlik sınırıdır.
  function coz(d0, secenek) {
    secenek = secenek || {};
    var sinir = secenek.dugumSiniri || 50000;
    var bitis = secenek.sureMs ? Date.now() + secenek.sureMs : 0;
    var sade = d0.cekilis === 1 && d0.turSiniri == null;
    var ziyaret = {};
    var dugum = 0;
    var iptal = false;
    var yol = [];

    function ara(d) {
      if (kazandiMi(d)) return true;
      dugum++;
      if (dugum > sinir || (bitis && (dugum & 255) === 0 && Date.now() > bitis)) { iptal = true; return false; }
      var onceki = yol.length;
      // Güvenli temel taşımaları zorunlu sayılır, dallanma yok
      var c = klon(d);
      var oh;
      while ((oh = otoTemelHamle(c))) { uygula(c, oh, false); yol.push(oh); }
      if (kazandiMi(c)) return true;
      var anahtar = tamAnahtar(c, sade);
      if (ziyaret[anahtar]) { yol.length = onceki; return false; }
      ziyaret[anahtar] = true;

      var adaylar = sutunHamleleri(c).map(function (h) { return { cekme: 0, hamle: h }; });
      var makrolar = atikMakrolari(c);
      for (var i = 0; i < makrolar.length; i++) {
        var m = makrolar[i];
        m.hamle.oncelik = m.hamle.oncelik + (m.cekme ? 0.5 : 0);
        adaylar.push(m);
      }
      adaylar.sort(function (a, b) { return oncekiAyni(a.hamle, b.hamle) || a.cekme - b.cekme; });
      for (var j = 0; j < adaylar.length && !iptal; j++) {
        var a = adaylar[j];
        var n = klon(c);
        var eklenen = [];
        for (var q = 0; q < a.cekme; q++) { uygula(n, { tip: 'cek' }, false); eklenen.push({ tip: 'cek' }); }
        var hm = { tip: 'tasi', kaynak: a.hamle.kaynak, hedef: a.hamle.hedef };
        uygula(n, hm, false);
        eklenen.push(hm);
        var geri = yol.length;
        Array.prototype.push.apply(yol, eklenen);
        if (ara(n)) return true;
        yol.length = geri;
      }
      yol.length = onceki;
      return false;
    }

    var kazandi = ara(klon(d0));
    return { sonuc: kazandi ? 'kazanir' : (iptal ? 'bilinmiyor' : 'kazanamaz'), hamleler: kazandi ? yol.slice() : [], dugum: dugum };
  }

  // Çözümü gerçek kurallarla baştan oynar; kazanılırsa son durumu verir (testler ve doğrulama için).
  function cozumuOyna(d, hamleler) {
    var c = d;
    for (var i = 0; i < hamleler.length; i++) {
      var n = hamleYap(c, hamleler[i]);
      if (!n) return null;
      c = n;
    }
    return c;
  }

  // ---------- Günlük ve kazanılabilir deste ----------
  function gunlukTohum(anahtar, deneme) {
    var h = 2166136261;
    var s = 'pasyans:' + anahtar + ':' + (deneme || 0);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Günlük deste: tarihten türeyen denemelerin ilki, çözücüyle kazanılabilir bulunan deste.
  // Düğüm sınırı kullanıldığından sonuç herkeste aynıdır. Günlük deste 1 kart çekilişli, sınırsız turludur.
  function gunlukDagit(tarihAnahtari, secenek) {
    secenek = secenek || {};
    var sinir = secenek.dugumSiniri || 6000;
    var enCok = secenek.denemeSiniri || 80;
    var ilk = secenek.baslangic || 0;
    for (var deneme = ilk; deneme < enCok; deneme++) {
      var d = yeniEl(gunlukTohum(tarihAnahtari, deneme), 1, null);
      var r = coz(d, { dugumSiniri: sinir });
      if (r.sonuc === 'kazanir') {
        d.dogrulandi = true;
        return { durum: d, deneme: deneme, cozum: r.hamleler };
      }
    }
    var son = yeniEl(gunlukTohum(tarihAnahtari, enCok), 1, null);
    return { durum: son, deneme: enCok, cozum: null };
  }

  // Serbest oyun: süre sınırı içinde kazanılabilir bir deste arar; bulamazsa sıradan rastgele deste verir.
  function kazanilabilirDagit(cekilis, turSiniri, secenek) {
    secenek = secenek || {};
    var tohumUret = secenek.rastgele || Math.random;
    var bitis = Date.now() + (secenek.sureMs == null ? 350 : secenek.sureMs);
    var sinir = secenek.dugumSiniri || 6000;
    var tohum;
    do {
      tohum = Math.floor(tohumUret() * 4294967296) >>> 0;
      var d = yeniEl(tohum, cekilis, turSiniri);
      var kalan = bitis - Date.now();
      if (kalan <= 0) break;
      var r = coz(d, { dugumSiniri: sinir, sureMs: kalan });
      if (r.sonuc === 'kazanir') { d.dogrulandi = true; return d; }
    } while (Date.now() < bitis);
    return yeniEl(tohum, cekilis, turSiniri);
  }

  // ---------- Metin ve biçim ----------
  function sureBicim(ms) {
    var sn = Math.max(0, Math.floor(ms / 1000));
    var dk = Math.floor(sn / 60);
    sn = sn % 60;
    var saat = Math.floor(dk / 60);
    dk = dk % 60;
    var iki = function (x) { return (x < 10 ? '0' : '') + x; };
    return (saat ? saat + ':' + iki(dk) : iki(dk)) + ':' + iki(sn);
  }
  function ozetMetni(ms, hamle) { return sureBicim(ms) + ' · ' + hamle + ' hamle'; }

  function tarihAnahtari(tarih) {
    return tarih.getFullYear() + '-' + String(tarih.getMonth() + 1).padStart(2, '0') + '-' + String(tarih.getDate()).padStart(2, '0');
  }
  function paylasimMetni(tarih, ms, hamle) {
    return 'Pasyans · Günün destesi ' + tarih.getDate() + ' ' + AYLAR[tarih.getMonth()] + ' · ' + ozetMetni(ms, hamle);
  }

  // Hamleyi Türkçe cümleye çevirir (ipucu ve ekran okuyucu için).
  function hamleMetni(d, h) {
    if (h.tip === 'cek') return d.stok.length ? 'Desteden kart çek.' : 'Atığı desteye çevir.';
    var kartlar = kaynakKartlar(d, h.kaynak);
    if (!kartlar) return '';
    var ad = kartAdi(kartlar[0]) + (kartlar.length > 1 ? ' ve üstündeki ' + (kartlar.length - 1) + ' kart' : ' kartı');
    if (kartlar.length > 1) ad = kartAdi(kartlar[0]) + ' ve üstündeki ' + (kartlar.length - 1) + ' kartı';
    if (h.hedef.yer === 'temel') return kartAdi(kartlar[0]) + ' kartını temele gönder.';
    var u = sutunUstu(d, h.hedef.i);
    return u < 0 ? ad + ' boş sütuna taşı.' : ad + ' ' + kartAdi(u) + ' kartının üstüne taşı.';
  }

  // Kayıttan okunan durumun bozuk olmadığını denetler: 52 kart bir kez, kapalı/açık yapısı doğru.
  function durumGecerliMi(d) {
    if (!d || !Array.isArray(d.sutun) || d.sutun.length !== SUTUN_SAYISI || !Array.isArray(d.temel) || d.temel.length !== 4) return false;
    if (!Array.isArray(d.stok) || !Array.isArray(d.atik) || !Array.isArray(d.gecmis)) return false;
    if (d.cekilis !== 1 && d.cekilis !== 3) return false;
    if (!['tur', 'hamle'].every(function (a) { return Number.isFinite(d[a]); })) return false;
    var gorulen = {};
    var say = 0;
    var tamam = true;
    function ekle(k) {
      if (!Number.isInteger(k) || k < 0 || k > 51 || gorulen[k]) tamam = false;
      gorulen[k] = true;
      say++;
    }
    for (var i = 0; i < SUTUN_SAYISI; i++) {
      var s = d.sutun[i];
      if (!s || !Array.isArray(s.kapali) || !Array.isArray(s.acik)) return false;
      if (s.kapali.length && !s.acik.length) return false;
      s.kapali.forEach(ekle);
      s.acik.forEach(ekle);
    }
    for (var t = 0; t < 4; t++) {
      if (!Array.isArray(d.temel[t])) return false;
      d.temel[t].forEach(function (k, sira) { ekle(k); if (tip(k) !== t || deger(k) !== sira + 1) tamam = false; });
    }
    d.stok.forEach(ekle);
    d.atik.forEach(ekle);
    return tamam && say === 52;
  }

  var PasyansMantik = {
    TIPLER: TIPLER, TIP_SEMBOL: TIP_SEMBOL, DEGER_AD: DEGER_AD, SUTUN_SAYISI: SUTUN_SAYISI,
    tip: tip, deger: deger, kirmizi: kirmizi, kartAdi: kartAdi, isaret: isaret,
    uretec: uretec, karistir: karistir, dagit: dagit, yeniEl: yeniEl, klonSade: klonSade, kazandiMi: kazandiMi,
    sutunUstu: sutunUstu, sutunaKonurMu: sutunaKonurMu, temeleKonurMu: temeleKonurMu, cekebilirMi: cekebilirMi,
    kaynakKartlar: kaynakKartlar, hamleGecerliMi: hamleGecerliMi, hamleYap: hamleYap, geriAl: geriAl, otoUygula: otoUygula,
    hedefler: hedefler, enIyiHedef: enIyiHedef, guvenliMi: guvenliMi, otoTemelHamle: otoTemelHamle, bitirDizisi: bitirDizisi,
    sutunHamleleri: sutunHamleleri, atikMakrolari: atikMakrolari, ipuclari: ipuclari, hamleVarMi: hamleVarMi,
    coz: coz, cozumuOyna: cozumuOyna, gunlukTohum: gunlukTohum, gunlukDagit: gunlukDagit, kazanilabilirDagit: kazanilabilirDagit,
    sureBicim: sureBicim, ozetMetni: ozetMetni, tarihAnahtari: tarihAnahtari, paylasimMetni: paylasimMetni,
    hamleMetni: hamleMetni, durumGecerliMi: durumGecerliMi
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PasyansMantik;
  else kok.PasyansMantik = PasyansMantik;
})(typeof window !== 'undefined' ? window : this);
