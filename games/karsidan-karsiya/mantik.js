// Gece Yarısı Karşıdan Karşıya'nın saf oyun mantığı: şerit üretimi, ızgara çarpışması, zorluk, skor ve kayıt.
// three.js'e dokunmaz; tarayıcıda window.KarsiMantik, Node testlerinde module.exports.
// Izgara: satır ileri doğru artar (0, 1, 2 …), sütun soldan sağa -SINIR..SINIR arasındadır.
(function (kok) {
  var SINIR = 4;             // oynanabilir sütunlar: -4..4 (9 hücre)
  var DUNYA = 26;            // araç ve teknelerin döndüğü şerit uzunluğu (-13..13)
  var BASLANGIC_SATIRI = 2;  // oyuncunun başladığı satır; 0..4 boş kaldırımdır
  var OYUNCU_YARI = 0.3;     // oyuncunun hücre içindeki yarım genişliği
  var EN_AZ_ARABA_ARASI = 2.4; // aynı şeritteki iki araç arasında her zaman kalan boşluk (hücre)
  var EN_COK_SU_BOSLUGU = 4;   // iki tekne arasındaki en büyük su boşluğu (hücre)
  var TRAMVAY_EN_AZ_BOSLUK = 2.5; // iki tramvay arasında oynanabilir alanın boş kaldığı en kısa süre (sn)

  var ARACLAR = {
    taksi: { uzunluk: 1.5 },
    dolmus: { uzunluk: 2.2 },
    tramvay: { uzunluk: 7 },
    sandal: { uzunluk: 2 },
    vapur: { uzunluk: 4 }
  };
  var ENGELLER = ['tezgah', 'cop', 'agac', 'bank', 'kedi'];

  var KARAKTERLER = [
    { id: 'simitci', ad: 'Simitçi', fiyat: 0 },
    { id: 'kedi', ad: 'Tekir', fiyat: 25 },
    { id: 'marti', ad: 'Martı', fiyat: 50 },
    { id: 'hamal', ad: 'Hamal', fiyat: 100 }
  ];

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

  // 0 (başlangıç) ile 1 (çok uzak) arasında yumuşak artan zorluk.
  function zorluk(satir) {
    return 1 - Math.exp(-Math.max(0, satir - 5) / 140);
  }

  // x'i [-uzunluk/2, uzunluk/2) aralığına sarar.
  function sar(x, uzunluk) {
    var y = (x + uzunluk / 2) % uzunluk;
    if (y < 0) y += uzunluk;
    return y - uzunluk / 2;
  }

  function aralik(r, a, b) { return a + r() * (b - a); }

  // Toplam boşluğu n parçaya rastgele ama her biri en az `enAz` olacak biçimde böler.
  function bosluklariDagit(r, n, toplam, enAz) {
    var agirlik = [], toplamAgirlik = 0, i;
    for (i = 0; i < n; i++) { agirlik.push(aralik(r, 0.6, 1.4)); toplamAgirlik += agirlik[i]; }
    var serbest = toplam - n * enAz;
    return agirlik.map(function (w) { return enAz + serbest * w / toplamAgirlik; });
  }

  // Üst sınırı aşan boşlukların fazlasını sınırın altındakilere eşit paylaştırır (toplam korunur).
  function sinirla(bosluklar, enCok) {
    for (var tur = 0; tur < 10; tur++) {
      var fazla = 0, alti = [];
      bosluklar.forEach(function (b, i) { if (b > enCok) { fazla += b - enCok; bosluklar[i] = enCok; } else if (b < enCok) alti.push(i); });
      if (fazla < 1e-9 || !alti.length) break;
      alti.forEach(function (i) { bosluklar[i] += fazla / alti.length; });
    }
    return bosluklar;
  }

  // Uzunlukları verilen nesneleri DUNYA uzunluğundaki döngüye, verilen boşluklarla dizer.
  function diz(r, tipler, bosluklar) {
    var x = aralik(r, -DUNYA / 2, DUNYA / 2), nesneler = [];
    for (var i = 0; i < tipler.length; i++) {
      var u = ARACLAR[tipler[i]].uzunluk;
      nesneler.push({ tip: tipler[i], uzunluk: u, x0: sar(x + u / 2, DUNYA) });
      x += u + bosluklar[i];
    }
    return nesneler;
  }

  function yolSeridi(r, satir, z, oncekiYon) {
    var yon = oncekiYon ? (r() < 0.7 ? -oncekiYon : oncekiYon) : (r() < 0.5 ? 1 : -1);
    var hiz = Math.min(5.6, 1.3 + 2.4 * z + r() * (0.5 + z));
    var hedefBosluk = 7.5 - 4.2 * z; // ortalama araç arası
    var tipler = [], toplamUzunluk = 0;
    var adet = Math.max(1, Math.round(DUNYA / (1.9 + hedefBosluk)));
    for (var i = 0; i < adet; i++) {
      var tip = r() < 0.3 + 0.2 * z ? 'dolmus' : 'taksi';
      tipler.push(tip);
      toplamUzunluk += ARACLAR[tip].uzunluk;
    }
    // Güvenli boşluk sığmıyorsa araç azalt.
    while (tipler.length > 1 && DUNYA - toplamUzunluk < tipler.length * EN_AZ_ARABA_ARASI) {
      toplamUzunluk -= ARACLAR[tipler.pop()].uzunluk;
    }
    var bosluklar = bosluklariDagit(r, tipler.length, DUNYA - toplamUzunluk, EN_AZ_ARABA_ARASI);
    return { satir: satir, tur: 'yol', yon: yon, hiz: hiz, dongu: DUNYA, nesneler: diz(r, tipler, bosluklar), simitler: [] };
  }

  function raySeridi(r, satir, z) {
    var yon = r() < 0.5 ? 1 : -1;
    var hiz = 9 + 4 * z + r() * 1.5;
    var u = ARACLAR.tramvay.uzunluk;
    var gecis = (2 * SINIR + 1 + u) / hiz; // tramvayın oynanabilir alanı geçme süresi
    var periyot = Math.max(gecis + TRAMVAY_EN_AZ_BOSLUK + 0.5, aralik(r, 6, 9) - 2 * z);
    var dongu = hiz * periyot;
    return {
      satir: satir, tur: 'ray', yon: yon, hiz: hiz, dongu: dongu, periyot: periyot,
      nesneler: [{ tip: 'tramvay', uzunluk: u, x0: aralik(r, -dongu / 2, dongu / 2) }], simitler: []
    };
  }

  function suSeridi(r, satir, z, oncekiYon) {
    var yon = oncekiYon ? -oncekiYon : (r() < 0.5 ? 1 : -1);
    var vapurlu = r() < 0.4;
    var hiz = vapurlu ? aralik(r, 0.7, 1.1) + 0.6 * z : aralik(r, 0.9, 1.4) + 1.3 * z;
    var tip = vapurlu ? 'vapur' : 'sandal';
    var u = ARACLAR[tip].uzunluk;
    var ortBosluk = aralik(r, 1.5, 2.1) + 0.5 * z; // en fazla 2.6: dağıtımdan sonra 4'ü geçmez
    var adet = Math.max(2, Math.round(DUNYA / (u + ortBosluk)));
    var toplamBosluk = DUNYA - adet * u;
    // Ortalama boşluk 2.5'u aşarsa bir tekne daha eklenir; böylece hiçbir boşluk EN_COK_SU_BOSLUGU'nu geçmez.
    while (toplamBosluk / adet > 2.5) { adet++; toplamBosluk -= u; }
    var tipler = [];
    for (var i = 0; i < adet; i++) tipler.push(tip);
    var bosluklar = sinirla(bosluklariDagit(r, adet, toplamBosluk, 0.4), EN_COK_SU_BOSLUGU - 0.3);
    return { satir: satir, tur: 'su', yon: yon, hiz: hiz, dongu: DUNYA, nesneler: diz(r, tipler, bosluklar), simitler: [] };
  }

  // Kaldırımda bir satırdan ileri doğru ulaşılabilen sütunlar: önceki satırın ulaşılabilir
  // sütunlarından ileri zıplanabilen boş hücreler ve onlarla yan yana bağlı boş hücreler.
  function ulasilabilirHesapla(bosMu, onceki) {
    var sonuc = [];
    for (var c = -SINIR; c <= SINIR; c++) {
      if (!bosMu(c) || onceki.indexOf(c) === -1) continue;
      var a = c, b = c;
      while (a - 1 >= -SINIR && bosMu(a - 1)) a--;
      while (b + 1 <= SINIR && bosMu(b + 1)) b++;
      for (var k = a; k <= b; k++) if (sonuc.indexOf(k) === -1) sonuc.push(k);
    }
    return sonuc.sort(function (x, y) { return x - y; });
  }

  function hepsi() {
    var s = [];
    for (var c = -SINIR; c <= SINIR; c++) s.push(c);
    return s;
  }

  function kaldirimSeridi(r, satir, z, onceki, baslangic) {
    var engeller = [];
    var adet = baslangic ? (satir === BASLANGIC_SATIRI ? 0 : Math.floor(r() * 3)) : Math.floor(aralik(r, 0.5, 2.5 + 2.5 * z));
    for (var i = 0; i < adet; i++) {
      var sutun = Math.floor(aralik(r, -SINIR, SINIR + 1));
      if (baslangic && Math.abs(sutun) <= 1) continue; // başlangıçta karakterin önü açık
      if (engeller.some(function (e) { return e.sutun === sutun; })) continue;
      engeller.push({ sutun: sutun, tip: ENGELLER[Math.floor(r() * ENGELLER.length)] });
    }
    var serit = { satir: satir, tur: 'kaldirim', engeller: engeller, simitler: [] };
    var oncekiUlasilabilir = onceki ? onceki.ulasilabilir : hepsi();
    // Geçilebilirlik garantisi: yeterli ulaşılabilir hücre kalana kadar rastgele engel kaldır.
    for (;;) {
      serit.ulasilabilir = ulasilabilirHesapla(function (c) { return !engelVarMi(serit, c); }, oncekiUlasilabilir);
      if (serit.ulasilabilir.length >= 2 || !engeller.length) break;
      engeller.splice(Math.floor(r() * engeller.length), 1);
    }
    return serit;
  }

  // Tohumlu sonsuz şerit üreticisi; seritAl(i) gerektiği kadar ileri üretir ve önbellekte tutar.
  function ureticiOlustur(tohum) {
    var r = uretec(tohum);
    var seritler = [];
    var sonLamba = -3;
    var sonBlok = 'kaldirim';

    function ekle(serit) {
      if (serit.tur !== 'kaldirim') serit.ulasilabilir = hepsi();
      var z = zorluk(serit.satir);
      // Simit: kaldırımda ulaşılabilir bir hücreye, ara sıra da riskli şekilde yola.
      if (serit.satir > BASLANGIC_SATIRI + 1) {
        if (serit.tur === 'kaldirim' && r() < 0.32) serit.simitler.push(serit.ulasilabilir[Math.floor(r() * serit.ulasilabilir.length)]);
        else if (serit.tur === 'yol' && r() < 0.1 + 0.05 * z) serit.simitler.push(Math.floor(aralik(r, -SINIR, SINIR + 1)));
      }
      // Sokak lambası: 6-8 satırda bir, kaldırımın kenarında.
      if (serit.tur === 'kaldirim' && serit.satir - sonLamba >= 6 + Math.floor(r() * 3)) {
        serit.lamba = r() < 0.5 ? -(SINIR + 1) : SINIR + 1;
        sonLamba = serit.satir;
      }
      seritler.push(serit);
    }

    function blokUret() {
      var satir = seritler.length;
      var onceki = seritler[satir - 1];
      if (satir < 5) { ekle(kaldirimSeridi(r, satir, 0, onceki, true)); return; }
      var z = zorluk(satir);
      var agirlik = {
        yol: 1,
        su: satir >= 12 && sonBlok !== 'su' ? 0.45 + 0.25 * z : 0,
        ray: satir >= 18 && sonBlok !== 'ray' ? 0.3 : 0
      };
      var toplam = agirlik.yol + agirlik.su + agirlik.ray, secim = r() * toplam, tur = 'yol';
      if (secim >= agirlik.yol) tur = secim < agirlik.yol + agirlik.su ? 'su' : 'ray';
      var adet, i, yon = 0;
      if (tur === 'yol') {
        adet = 1 + Math.floor(r() * Math.min(5, 2 + 3.5 * z));
        for (i = 0; i < adet; i++) { var y = yolSeridi(r, seritler.length, z, yon); yon = y.yon; ekle(y); }
      } else if (tur === 'su') {
        adet = 1 + Math.floor(r() * Math.min(3, 1.5 + 2 * z));
        for (i = 0; i < adet; i++) { var s = suSeridi(r, seritler.length, z, yon); yon = s.yon; ekle(s); }
      } else {
        adet = z > 0.4 && r() < 0.35 ? 2 : 1;
        for (i = 0; i < adet; i++) ekle(raySeridi(r, seritler.length, z));
      }
      sonBlok = tur;
      var kaldirimAdet = r() < 0.35 - 0.2 * z ? 2 : 1;
      for (i = 0; i < kaldirimAdet; i++) ekle(kaldirimSeridi(r, seritler.length, z, seritler[seritler.length - 1], false));
    }

    return {
      seritAl: function (i) {
        if (i < 0) return null;
        while (seritler.length <= i) blokUret();
        return seritler[i];
      }
    };
  }

  // Bir nesnenin t anındaki merkez konumu (sütun cinsinden, sürekli).
  function nesneKonumu(serit, nesne, t) {
    return sar(nesne.x0 + serit.yon * serit.hiz * t, serit.dongu);
  }

  function engelVarMi(serit, sutun) {
    if (!serit || serit.tur !== 'kaldirim') return false;
    for (var i = 0; i < serit.engeller.length; i++) if (serit.engeller[i].sutun === sutun) return true;
    return false;
  }

  // Oyuncu bu hücreye zıplayabilir mi? (Sınır içinde ve sabit engel yok.)
  function hareketSerbest(serit, sutun) {
    return !!serit && sutun >= -SINIR && sutun <= SINIR && !engelVarMi(serit, sutun);
  }

  // Izgara çarpışması: x konumundaki oyuncu (yarım genişlik OYUNCU_YARI) bir aracın içinde mi?
  // Yol ve ray şeritlerinde araç sayısı birkaçtır; hücre ile her aracın kapladığı aralık karşılaştırılır.
  function carpismaVarMi(serit, x, t) {
    if (!serit || (serit.tur !== 'yol' && serit.tur !== 'ray')) return false;
    for (var i = 0; i < serit.nesneler.length; i++) {
      var n = serit.nesneler[i];
      if (Math.abs(sar(x - nesneKonumu(serit, n, t), serit.dongu)) < n.uzunluk / 2 + OYUNCU_YARI) return true;
    }
    return false;
  }

  // Hücre dolu mu? Tamsayı sütun için çarpışma testi.
  function hucreDoluMu(serit, sutun, t) { return carpismaVarMi(serit, sutun, t); }

  // Su şeridinde x konumunun altındaki teknenin indeksi; yoksa -1 (suya düşülür).
  function tekneBul(serit, x, t) {
    if (!serit || serit.tur !== 'su') return -1;
    for (var i = 0; i < serit.nesneler.length; i++) {
      var n = serit.nesneler[i];
      if (Math.abs(sar(x - nesneKonumu(serit, n, t), serit.dongu)) <= n.uzunluk / 2 + 0.2) return i;
    }
    return -1;
  }

  // Teknenin üzerindeki en yakın ayak basma yuvasının merkeze göre konumu (her hücre bir yuva).
  function yuvaOfseti(uzunluk, ofset) {
    var adet = Math.max(1, Math.round(uzunluk));
    var k = Math.round(ofset + (adet - 1) / 2);
    k = Math.max(0, Math.min(adet - 1, k));
    return k - (adet - 1) / 2;
  }

  // Tramvayın ön ucunun oynanabilir alana girmesine kalan süre (sn); alan içindeyse 0.
  function tramvayaKalan(serit, t) {
    var n = serit.nesneler[0];
    var x = nesneKonumu(serit, n, t);
    var bas = x - serit.yon * n.uzunluk / 2, son = x + serit.yon * n.uzunluk / 2;
    var kenar = SINIR + 0.5;
    if (Math.max(bas, son) > -kenar - 0.3 && Math.min(bas, son) < kenar + 0.3) return 0;
    var mesafe = serit.yon > 0 ? (-kenar - son) : (son - kenar);
    mesafe = ((mesafe % serit.dongu) + serit.dongu) % serit.dongu;
    return mesafe / serit.hiz;
  }

  // Bekleyen oyuncuyu kapan koca martı: yeni satıra ulaşmadan geçen süre bu eşiği aşınca yakalar.
  function kovalayiciEsigi(satir) { return 9 - 3 * zorluk(satir); }
  function kovalayiciDurumu(bosSure, satir) {
    var kalan = kovalayiciEsigi(satir) - bosSure;
    return { kalan: Math.max(0, kalan), uyari: kalan < 2.5, yakala: kalan <= 0 };
  }

  function skorHesapla(enIleriSatir) { return Math.max(0, enIleriSatir - BASLANGIC_SATIRI); }

  // ---------- Kalıcı kayıt (localStorage içeriği) ----------
  function yeniKayit() { return { enIyi: 0, simit: 0, acik: ['simitci'], secili: 'simitci', ses: true }; }

  // Depodan gelen bozuk ya da eski veriyi güvenli biçime getirir.
  function kayitDuzelt(ham) {
    var k = yeniKayit();
    if (!ham || typeof ham !== 'object') return k;
    if (Number.isFinite(ham.enIyi) && ham.enIyi > 0) k.enIyi = Math.floor(ham.enIyi);
    if (Number.isFinite(ham.simit) && ham.simit > 0) k.simit = Math.floor(ham.simit);
    if (Array.isArray(ham.acik)) {
      ham.acik.forEach(function (id) { if (karakter(id) && k.acik.indexOf(id) === -1) k.acik.push(id); });
    }
    if (k.acik.indexOf(ham.secili) !== -1) k.secili = ham.secili;
    if (ham.ses === false) k.ses = false;
    return k;
  }

  function karakter(id) {
    for (var i = 0; i < KARAKTERLER.length; i++) if (KARAKTERLER[i].id === id) return KARAKTERLER[i];
    return null;
  }

  function kopya(k) { return JSON.parse(JSON.stringify(k)); }

  // Biten turu işler: rekor ve simit cüzdanı güncellenir.
  function turuIsle(kayit, skor, toplananSimit) {
    var yeni = kopya(kayit);
    var yeniRekor = skor > kayit.enIyi;
    if (yeniRekor) yeni.enIyi = skor;
    yeni.simit += Math.max(0, toplananSimit | 0);
    return { kayit: yeni, yeniRekor: yeniRekor };
  }

  // Simitle karakter açar ve seçer. Yeterli simit yoksa kayıt değişmez, hata döner.
  function karakterAc(kayit, id) {
    var k = karakter(id);
    if (!k) return { kayit: kayit, hata: 'Böyle bir karakter yok.' };
    if (kayit.acik.indexOf(id) !== -1) return { kayit: karakterSec(kayit, id), hata: null };
    if (kayit.simit < k.fiyat) return { kayit: kayit, hata: (k.fiyat - kayit.simit) + ' simit daha lazım.' };
    var yeni = kopya(kayit);
    yeni.simit -= k.fiyat;
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

  var KarsiMantik = {
    SINIR: SINIR, DUNYA: DUNYA, BASLANGIC_SATIRI: BASLANGIC_SATIRI, OYUNCU_YARI: OYUNCU_YARI,
    EN_AZ_ARABA_ARASI: EN_AZ_ARABA_ARASI, EN_COK_SU_BOSLUGU: EN_COK_SU_BOSLUGU, TRAMVAY_EN_AZ_BOSLUK: TRAMVAY_EN_AZ_BOSLUK,
    ARACLAR: ARACLAR, KARAKTERLER: KARAKTERLER,
    uretec: uretec, zorluk: zorluk, sar: sar, ureticiOlustur: ureticiOlustur, nesneKonumu: nesneKonumu,
    engelVarMi: engelVarMi, hareketSerbest: hareketSerbest, carpismaVarMi: carpismaVarMi, hucreDoluMu: hucreDoluMu,
    tekneBul: tekneBul, yuvaOfseti: yuvaOfseti, tramvayaKalan: tramvayaKalan,
    kovalayiciEsigi: kovalayiciEsigi, kovalayiciDurumu: kovalayiciDurumu, skorHesapla: skorHesapla,
    yeniKayit: yeniKayit, kayitDuzelt: kayitDuzelt, karakter: karakter, turuIsle: turuIsle,
    karakterAc: karakterAc, karakterSec: karakterSec
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = KarsiMantik;
  else kok.KarsiMantik = KarsiMantik;
})(this);
