// Marmaray Koşusu'nun saf oyun mantığı: tohumlu parça üretimi, şerit/kutu çarpışması, hız eğrisi, skor,
// günlük görev ve kayıt. three.js'e dokunmaz; tarayıcıda window.MarmarayMantik, Node testlerinde module.exports.
//
// Dünya "koşu mesafesi" (p, metre) üzerinde kurulur: oyuncu p'de durur, her şey p'ye göre çizilir.
// Şeritler -1, 0, 1. Gelen trenler oyuncu hızının GELEN_ORAN katıyla yaklaşır; bu yüzden p ekseninde
// [bas, bas + boy / (1 + GELEN_ORAN)] aralığını kaplarlar ve çarpışma her tür için aynı kutu testidir.
(function (kok) {
  var SERITLER = [-1, 0, 1];
  var SERIT_GENISLIK = 2.4;     // sahnede iki şerit merkezi arası (m)
  var HIZ_BAS = 14;             // m/sn
  var HIZ_SON = 32;
  var HIZ_OLCEK = 2600;         // hızın son değere yaklaşma ölçeği (m)
  var ZORLUK_OLCEK = 2000;
  var ILK_BOSLUK = 55;          // başlangıçta engelsiz koşu (m)
  var VAGON_BOY = 15;           // bir vagonun sahnedeki boyu (m)
  var GELEN_ORAN = 0.55;        // gelen trenin hızı / oyuncu hızı
  var PAY = 1;                  // tren aralıklarının iki yanına eklenen güvenlik payı (m)
  var SERIT_DEGISIM = 0.14;     // sn
  var EN_AZ_SATIR_SURESI = 0.78; // iki engel satırı arasındaki en kısa süre (sn); her şerit değişimine yeter

  // Kutu yükseklikleri (m, ray üstünden)
  var YUKSEKLIK = { tren: [0, 3.4], bariyer: [0, 0.95], tabela: [1.1, 2.6] };
  var DERINLIK = { bariyer: 0.5, tabela: 0.4 };
  var OYUNCU = { yariGenislik: 0.13, yariDerinlik: 0.3, boy: 1.6, kayarkenBoy: 0.72 }; // yarı genişlik şerit biriminde
  var ENGEL_YARI_GENISLIK = 0.42;  // şerit biriminde (≈1 m)
  var ZIPLAMA = { sure: 0.62, yukseklik: 1.9 };
  var KAYMA_SURESI = 0.7;
  var JETON_PUAN = 5;
  var MODUL = 6;                // tünel/ray modülü boyu (m)
  var GORUS_MESAFESI = 95;      // sisin tamamen kapandığı uzaklık (m); sahne bunu kullanır

  var GUCLER = ['miknatis', 'jetpack', 'x2'];
  var GUC_SURESI = { miknatis: 9, jetpack: 6, x2: 12 };

  var KARAKTERLER = [
    { id: 'marti', ad: 'Martı', fiyat: 0 },
    { id: 'kedi', ad: 'Tekir', fiyat: 60 },
    { id: 'hamal', ad: 'Hamal', fiyat: 150 },
    { id: 'kaykay', ad: 'Kaykaylı', fiyat: 300 }
  ];

  // İstasyon adları: tünel ağzındaki tabelalar sırayla bunları gösterir.
  var ISTASYONLAR = ['SİRKECİ', 'ÜSKÜDAR', 'YENİKAPI', 'AYRILIKÇEŞMESİ', 'KAZLIÇEŞME', 'SÖĞÜTLÜÇEŞME'];

  // Günlük görevler: tarihe göre biri seçilir, hedefler biraz oynar.
  var GOREVLER = [
    { id: 'jeton', metin: 'Bir koşuda {h} jeton topla', hedefler: [80, 120, 160] },
    { id: 'mesafe', metin: 'Bir koşuda {h} m koş', hedefler: [800, 1200, 1800] },
    { id: 'zipla', metin: 'Bir koşuda {h} kez zıpla', hedefler: [15, 25, 35] },
    { id: 'kay', metin: 'Bir koşuda {h} kez eğilerek kay', hedefler: [10, 18, 26] },
    { id: 'guc', metin: 'Bir koşuda {h} güçlendirici topla', hedefler: [2, 3, 4] }
  ];
  var GOREV_ODULU = 100;

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

  function aralik(r, a, b) { return a + r() * (b - a); }
  function sec(r, dizi) { return dizi[Math.floor(r() * dizi.length)]; }

  // Hız eğrisi: HIZ_BAS'tan başlar, mesafeyle yumuşakça HIZ_SON'a yaklaşır.
  function hiz(p) { return HIZ_BAS + (HIZ_SON - HIZ_BAS) * (1 - Math.exp(-Math.max(0, p) / HIZ_OLCEK)); }
  // 0 (başlangıç) ile 1 (çok uzak) arası zorluk.
  function zorluk(p) { return 1 - Math.exp(-Math.max(0, p - ILK_BOSLUK) / ZORLUK_OLCEK); }
  // İki engel satırı arasındaki süre: başta rahat, zorlaştıkça kısalır.
  function satirSuresi(p) { return 1.3 - 0.52 * zorluk(p); }

  // Bir trenin p ekseninde kapladığı uzunluk.
  function trenUzunlugu(vagon, gelen) { return vagon * VAGON_BOY / (gelen ? 1 + GELEN_ORAN : 1); }

  // Engelin oyuncudan sahnedeki uzaklığı (önü). Gelen tren oyuncuya kendi hızıyla da yaklaştığı için daha uzakta durur.
  function gorunurUzaklik(engel, p) { return (engel.bas - p) * (engel.gelen ? 1 + GELEN_ORAN : 1); }

  // l şeridi [p0, p1] boyunca trensiz mi? (tren aralıkları PAY kadar genişletilir)
  function seritTrensiz(trenler, l, p0, p1) {
    for (var i = 0; i < trenler.length; i++) {
      var t = trenler[i];
      if (t.serit === l && t.bas - PAY < p1 && t.son + PAY > p0) return false;
    }
    return true;
  }
  function trenVarMi(trenler, l, p) { return !seritTrensiz(trenler, l, p, p); }

  // R kümesinden (önceki satırda bulunulabilen şeritler) [p0, p1] içinde ulaşılabilen şeritler.
  // a'dan b'ye geçerken aradaki ve hedef şeritler bu aralıkta trensiz olmalı (temkinli kural).
  function ulasilabilir(trenler, R, p0, p1, hucreler) {
    var sonuc = [];
    for (var bi = 0; bi < SERITLER.length; bi++) {
      var b = SERITLER[bi];
      if (hucreler && hucreler[b + 1] === 'tren') continue;
      if (trenVarMi(trenler, b, p1)) continue;
      for (var ai = 0; ai < R.length; ai++) {
        var a = R[ai], adim = b > a ? 1 : -1, acik = true;
        if (a === b) acik = seritTrensiz(trenler, a, p0, p1);
        else for (var l = a + adim; ; l += adim) {
          if (!seritTrensiz(trenler, l, p0, p1)) { acik = false; break; }
          if (l === b) break;
        }
        if (acik) { sonuc.push(b); break; }
      }
    }
    return sonuc;
  }

  // Bölümler: tünel ve açık (Boğaz) kesimleri sırayla. Tohuma göre uzunluklar değişir.
  function bolumleriOlustur(r) {
    var liste = [], p = 0, tur = 'tunel', i = 0;
    return function (hedef) {
      while (p <= hedef) {
        // Uzunluklar 6 m'nin katı: sahnedeki tünel modülleriyle hizalı.
        var boy = Math.round((tur === 'tunel' ? aralik(r, 520, 820) : aralik(r, 300, 480)) / MODUL) * MODUL;
        liste.push({ tur: tur, bas: p, son: p + boy, istasyon: ISTASYONLAR[i % ISTASYONLAR.length] });
        p += boy; i++;
        tur = tur === 'tunel' ? 'acik' : 'tunel';
      }
      return liste;
    };
  }

  // Parça üretici. Engel satırlarını p ekseninde ileriye doğru üretir; her satırdan sonra en az bir
  // ulaşılabilir şerit kalır (ulasilabilir kümesi hiç boşalmaz).
  function ureticiOlustur(tohum) {
    var r = uretec(tohum);
    var bolumGenislet = bolumleriOlustur(uretec(tohum ^ 0x5bd1e995));
    var engeller = [], jetonlar = [], guclendiriciler = [], satirlar = [];
    var trenler = []; // engeller içindeki trenler (ulaşılabilirlik için)
    var sonP = ILK_BOSLUK, R = [-1, 0, 1], sira = 0;
    var sonrakiGuc = 260 + r() * 180;

    function hucreSec(p, l) {
      var z = zorluk(p);
      if (trenVarMi(trenler, l, p)) return 'dolu';
      var x = r();
      var bos = 0.5 - 0.22 * z, tren = 0.2 + 0.08 * z, bariyer = 0.16 + 0.08 * z;
      if (x < bos) return 'bos';
      if (x < bos + tren) return 'tren';
      if (x < bos + tren + bariyer) return 'bariyer';
      return 'tabela';
    }

    function satirUret() {
      var p0 = sonP;
      var p = p0 + hiz(p0) * satirSuresi(p0) * aralik(r, 1, 1.25);
      // Ara sıra nefes alma boşluğu
      if (r() < 0.07) p += hiz(p0) * 0.8;
      var secilen = null, yeniTrenler = null, yeniR = null;
      for (var deneme = 0; deneme < 14 && !secilen; deneme++) {
        var hucreler = SERITLER.map(function (l) { return hucreSec(p, l); });
        var adayTren = [];
        hucreler.forEach(function (h, i) {
          if (h !== 'tren') return;
          var gelen = r() < 0.35 + 0.3 * zorluk(p);
          var vagon = gelen ? 1 + (r() < 0.5 ? 1 : 0) : 1 + Math.floor(r() * 3);
          adayTren.push({ tur: 'tren', serit: SERITLER[i], bas: p, son: p + trenUzunlugu(vagon, gelen), vagon: vagon, gelen: gelen });
        });
        // Aynı satırda üç tren yok; trenler yan yana iken bir şerit hep trensiz kalır.
        var tumu = trenler.concat(adayTren);
        // Isınma: ilk metrelerde bir satırda daha az yeni engel.
        var yeniEngel = 0;
        for (var i = 0; i < 3; i++) if (hucreler[i] !== 'bos' && hucreler[i] !== 'dolu') yeniEngel++;
        if (yeniEngel > (p < 260 ? 1 : p < 750 ? 2 : 3)) continue;
        var R2 = ulasilabilir(tumu, R, p0, p, hucreler);
        if (!R2.length) continue;
        // Önündeki uzun trenlerle hiç boş şerit kalmasın diye: sonraki 40 m'de en az bir şerit trensiz kalmalı.
        var ileride = SERITLER.filter(function (l) { return seritTrensiz(tumu, l, p + 0.5, p + 40); });
        if (!ileride.length) continue;
        secilen = hucreler; yeniTrenler = adayTren; yeniR = R2;
      }
      if (!secilen) {
        // Güvenli geri dönüş: yeni engel yok, R korunur.
        secilen = SERITLER.map(function (l) { return trenVarMi(trenler, l, p) ? 'dolu' : 'bos'; });
        yeniTrenler = [];
        yeniR = ulasilabilir(trenler, R, p0, p, secilen);
      }
      var satir = { p: p, hucreler: secilen, R: yeniR.slice(), sira: sira++ };
      secilen.forEach(function (h, i) {
        var l = SERITLER[i];
        if (h === 'bariyer' || h === 'tabela') {
          engeller.push({ tur: h, serit: l, bas: p - DERINLIK[h] / 2, son: p + DERINLIK[h] / 2, id: engeller.length + ':' + p.toFixed(1) });
        }
      });
      yeniTrenler.forEach(function (t) { t.id = 'T' + sira + ':' + t.serit; engeller.push(t); trenler.push(t); });
      satirlar.push(satir);
      jetonYerlestir(p0, p, satir);
      R = yeniR;
      sonP = p;
    }

    // Önceki satırdan bu satıra giden ve trensiz kalan bir şeride jeton dizisi.
    function jetonYerlestir(p0, p1, satir) {
      var adaylar = SERITLER.filter(function (l) { return seritTrensiz(trenler, l, p0 - 3, p1 + 3); });
      if (!adaylar.length) return;
      var l = sec(r, adaylar);
      var hucre = satir.hucreler[l + 1];
      // Güçlendirici
      if (p1 >= sonrakiGuc && hucre === 'bos') {
        guclendiriciler.push({ tur: sec(r, GUCLER), serit: l, p: (p0 + p1) / 2, alindi: false, id: 'G' + satir.sira });
        sonrakiGuc = p1 + aralik(r, 380, 650);
        return;
      }
      if (r() > 0.62) return;
      var aralikM = 2.6, bas = p0 + 4, son = p1 - 4;
      if (hucre === 'bariyer') son = p1 - 6;
      for (var x = bas; x <= son; x += aralikM) jetonlar.push({ serit: l, p: x, y: 0.9, alindi: false });
      if (hucre === 'bariyer') {
        // Bariyerin üstünden zıplama yayı
        for (var k = -2; k <= 2; k++) jetonlar.push({ serit: l, p: p1 + k * 2.2, y: 1.0 + 1.5 * Math.cos(k * 0.62), alindi: false });
      } else if (hucre === 'tabela') {
        for (var m = -1; m <= 1; m++) jetonlar.push({ serit: l, p: p1 + m * 1.6, y: 0.45, alindi: false });
      }
    }

    return {
      // p + ileri mesafesine kadar üretir.
      ilerlet: function (hedef) { while (sonP < hedef) satirUret(); },
      // Geride kalanları atar: bellek koşu boyunca sabit kalır.
      temizle: function (p) {
        var alt = p - 40;
        var k = function (e) { return e.son > alt; };
        engeller = engeller.filter(k);
        trenler = trenler.filter(k);
        jetonlar = jetonlar.filter(function (j) { return j.p > alt; });
        guclendiriciler = guclendiriciler.filter(function (g) { return g.p > alt; });
        satirlar = satirlar.filter(function (s) { return s.p > alt; });
      },
      engeller: function () { return engeller; },
      jetonlar: function () { return jetonlar; },
      guclendiriciler: function () { return guclendiriciler; },
      satirlar: function () { return satirlar; },
      bolum: function (p) {
        var liste = bolumGenislet(p + 400);
        for (var i = 0; i < liste.length; i++) if (p < liste[i].son) return liste[i];
        return liste[liste.length - 1];
      },
      bolumler: function (p) { return bolumGenislet(p); },
      sonP: function () { return sonP; }
    };
  }

  // ---------- Çarpışma (şerit + kutu) ----------
  // oy: { x: şerit biriminde sürekli konum, y: ayak yüksekliği, kayiyor: bool }
  function carpisiyorMu(engel, oy, p) {
    if (Math.abs(oy.x - engel.serit) >= OYUNCU.yariGenislik + ENGEL_YARI_GENISLIK) return false;
    if (p + OYUNCU.yariDerinlik <= engel.bas || p - OYUNCU.yariDerinlik >= engel.son) return false;
    var h = YUKSEKLIK[engel.tur];
    var boy = oy.kayiyor ? OYUNCU.kayarkenBoy : OYUNCU.boy;
    return oy.y < h[1] && oy.y + boy > h[0];
  }

  function carpismaBul(engeller, oy, p) {
    for (var i = 0; i < engeller.length; i++) if (carpisiyorMu(engeller[i], oy, p)) return engeller[i];
    return null;
  }

  // Trene yandan mı (şerit değiştirirken, tren zaten yanındayken) önden mi çarpıldı?
  // Yandan çarpma ölümcül değildir: oyuncu geri sekip eski şeridine döner.
  function carpismaTuru(engel, p) {
    if (engel.tur === 'tren' && p - OYUNCU.yariDerinlik - engel.bas > 0.8) return 'yan';
    return 'on';
  }

  // Jeton alınır mı? Mıknatıs açıkken önündeki 10 m'deki tüm jetonlar çekilir.
  function jetonAlinirMi(j, oy, p, miknatis) {
    if (j.alindi) return false;
    if (miknatis) return j.p - p > -1 && j.p - p < 10;
    return Math.abs(oy.x - j.serit) < 0.5 && Math.abs(j.p - p) < 0.9 && Math.abs(oy.y + 0.8 - j.y) < 1.15;
  }
  function gucAlinirMi(g, oy, p) {
    return !g.alindi && Math.abs(oy.x - g.serit) < 0.55 && Math.abs(g.p - p) < 1.1 && oy.y < 2.2;
  }

  // Zıplama yüksekliği (analitik yay), t: zıplamadan beri geçen süre.
  function ziplamaY(t) {
    if (t <= 0 || t >= ZIPLAMA.sure) return 0;
    var u = t / ZIPLAMA.sure;
    return 4 * ZIPLAMA.yukseklik * u * (1 - u);
  }

  // Skor: koşulan her metre 1 puan, her jeton JETON_PUAN; ×2 açıkken ikisi de iki katı.
  function puanArtisi(metre, jeton, x2) { return (metre + jeton * JETON_PUAN) * (x2 ? 2 : 1); }

  // ---------- Günlük görev ----------
  function tarihAnahtari(tarih) {
    var d = tarih instanceof Date ? tarih : new Date(tarih);
    var a = d.getMonth() + 1, g = d.getDate();
    return d.getFullYear() + '-' + (a < 10 ? '0' : '') + a + '-' + (g < 10 ? '0' : '') + g;
  }
  function gunlukGorev(anahtar) {
    var h = 0;
    for (var i = 0; i < anahtar.length; i++) h = (Math.imul(h, 31) + anahtar.charCodeAt(i)) >>> 0;
    var r = uretec(h);
    var g = GOREVLER[Math.floor(r() * GOREVLER.length)];
    var hedef = g.hedefler[Math.floor(r() * g.hedefler.length)];
    return { id: g.id, hedef: hedef, metin: g.metin.replace('{h}', hedef), tarih: anahtar, odul: GOREV_ODULU };
  }
  // ist: { jeton, mesafe, zipla, kay, guc }
  function gorevIlerleme(gorev, ist) { return Math.min(gorev.hedef, Math.floor(ist[gorev.id] || 0)); }

  // ---------- Kalıcı kayıt ----------
  function yeniKayit() { return { enIyi: 0, jeton: 0, acik: ['marti'], secili: 'marti', ses: true, gorev: { tarih: '', tamam: false } }; }

  function karakter(id) {
    for (var i = 0; i < KARAKTERLER.length; i++) if (KARAKTERLER[i].id === id) return KARAKTERLER[i];
    return null;
  }

  function kayitDuzelt(ham) {
    var k = yeniKayit();
    if (!ham || typeof ham !== 'object') return k;
    if (Number.isFinite(ham.enIyi) && ham.enIyi > 0) k.enIyi = Math.floor(ham.enIyi);
    if (Number.isFinite(ham.jeton) && ham.jeton > 0) k.jeton = Math.floor(ham.jeton);
    if (Array.isArray(ham.acik)) ham.acik.forEach(function (id) { if (karakter(id) && k.acik.indexOf(id) === -1) k.acik.push(id); });
    if (k.acik.indexOf(ham.secili) !== -1) k.secili = ham.secili;
    if (ham.ses === false) k.ses = false;
    if (ham.gorev && typeof ham.gorev.tarih === 'string') k.gorev = { tarih: ham.gorev.tarih, tamam: ham.gorev.tamam === true };
    return k;
  }

  function kopya(k) { return JSON.parse(JSON.stringify(k)); }

  // Biten koşuyu işler: rekor, jeton cüzdanı ve günlük görev.
  function turuIsle(kayit, sonuc, anahtar) {
    var yeni = kopya(kayit);
    var skor = Math.max(0, Math.floor(sonuc.skor || 0));
    var yeniRekor = skor > kayit.enIyi;
    if (yeniRekor) yeni.enIyi = skor;
    yeni.jeton += Math.max(0, sonuc.jeton | 0);
    var gorev = gunlukGorev(anahtar);
    if (yeni.gorev.tarih !== anahtar) yeni.gorev = { tarih: anahtar, tamam: false };
    var gorevBitti = false;
    if (!yeni.gorev.tamam && gorevIlerleme(gorev, sonuc) >= gorev.hedef) {
      yeni.gorev.tamam = true;
      yeni.jeton += gorev.odul;
      gorevBitti = true;
    }
    return { kayit: yeni, yeniRekor: yeniRekor, gorevBitti: gorevBitti, gorev: gorev };
  }

  function karakterAc(kayit, id) {
    var k = karakter(id);
    if (!k) return { kayit: kayit, hata: 'Böyle bir karakter yok.' };
    if (kayit.acik.indexOf(id) !== -1) return { kayit: karakterSec(kayit, id), hata: null };
    if (kayit.jeton < k.fiyat) return { kayit: kayit, hata: (k.fiyat - kayit.jeton) + ' jeton daha lazım.' };
    var yeni = kopya(kayit);
    yeni.jeton -= k.fiyat;
    yeni.acik.push(id);
    yeni.secili = id;
    return { kayit: yeni, hata: null };
  }

  function karakterSec(kayit, id) {
    if (kayit.acik.indexOf(id) === -1) return kayit;
    var yeni = kopya(kayit);
    yeni.secili = id;
    return yeni;
  }

  var MarmarayMantik = {
    SERITLER: SERITLER, SERIT_GENISLIK: SERIT_GENISLIK, HIZ_BAS: HIZ_BAS, HIZ_SON: HIZ_SON, ILK_BOSLUK: ILK_BOSLUK, GORUS_MESAFESI: GORUS_MESAFESI, MODUL: MODUL,
    VAGON_BOY: VAGON_BOY, GELEN_ORAN: GELEN_ORAN, PAY: PAY, SERIT_DEGISIM: SERIT_DEGISIM, EN_AZ_SATIR_SURESI: EN_AZ_SATIR_SURESI,
    YUKSEKLIK: YUKSEKLIK, DERINLIK: DERINLIK, OYUNCU: OYUNCU, ENGEL_YARI_GENISLIK: ENGEL_YARI_GENISLIK,
    ZIPLAMA: ZIPLAMA, KAYMA_SURESI: KAYMA_SURESI, JETON_PUAN: JETON_PUAN, GUCLER: GUCLER, GUC_SURESI: GUC_SURESI,
    KARAKTERLER: KARAKTERLER, ISTASYONLAR: ISTASYONLAR, GOREVLER: GOREVLER, GOREV_ODULU: GOREV_ODULU,
    uretec: uretec, hiz: hiz, zorluk: zorluk, satirSuresi: satirSuresi, trenUzunlugu: trenUzunlugu,
    gorunurUzaklik: gorunurUzaklik, seritTrensiz: seritTrensiz, ulasilabilir: ulasilabilir, ureticiOlustur: ureticiOlustur,
    carpisiyorMu: carpisiyorMu, carpismaBul: carpismaBul, carpismaTuru: carpismaTuru,
    jetonAlinirMi: jetonAlinirMi, gucAlinirMi: gucAlinirMi, ziplamaY: ziplamaY, puanArtisi: puanArtisi,
    tarihAnahtari: tarihAnahtari, gunlukGorev: gunlukGorev, gorevIlerleme: gorevIlerleme,
    yeniKayit: yeniKayit, kayitDuzelt: kayitDuzelt, karakter: karakter, turuIsle: turuIsle,
    karakterAc: karakterAc, karakterSec: karakterSec
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MarmarayMantik;
  else kok.MarmarayMantik = MarmarayMantik;
})(this);
