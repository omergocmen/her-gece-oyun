// Çini Blok'un saf oyun mantığı: tarayıcıda window.CiniMantik, Node testlerinde module.exports.
// Tahta 64 elemanlı düz bir dizidir: -1 boş hücre, 0..5 o hücredeki çininin rengi.
(function (kok) {
  var BOYUT = 8;
  var RENK_SAYISI = 6; // İznik mavisi, turkuaz, sodyum, kor, yaprak, kemik
  var CIZGI_TABAN = 20; // bir çizginin temel puanı; kombo (aynı hamledeki çizgi sayısı) ve seriyle çarpılır
  var TERTEMIZ_BONUS = 300; // tahtada tek çini kalmazsa
  var SERI_PENCERE = 3; // seri, en geç her 3 hamlede bir çizgi temizlendikçe sürer
  var SERI_TAVAN = 10;
  var BASLANGIC = Date.UTC(2026, 9, 20); // 20 Ekim 2026: 1 numaralı günlük oyun
  var AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  // Parça kalıpları: '#' dolu, '.' boş, '|' satır sonu. agirlik, parçanın ne sık geldiğini belirler.
  var KALIPLAR = [
    ['tek', '#', 2],
    ['ikili-y', '##', 3], ['ikili-d', '#|#', 3],
    ['uclu-y', '###', 3], ['uclu-d', '#|#|#', 3],
    ['dortlu-y', '####', 2], ['dortlu-d', '#|#|#|#', 2],
    ['besli-y', '#####', 1], ['besli-d', '#|#|#|#|#', 1],
    ['kare-2', '##|##', 3], ['kare-3', '###|###|###', 1],
    ['dikdortgen-y', '###|###', 1.5], ['dikdortgen-d', '##|##|##', 1.5],
    ['kose-1', '##|#.', 2], ['kose-2', '##|.#', 2], ['kose-3', '#.|##', 2], ['kose-4', '.#|##', 2],
    ['l-1', '#.|#.|##', 1], ['l-2', '###|#..', 1], ['l-3', '##|.#|.#', 1], ['l-4', '..#|###', 1],
    ['j-1', '.#|.#|##', 1], ['j-2', '#..|###', 1], ['j-3', '##|#.|#.', 1], ['j-4', '###|..#', 1],
    ['t-1', '###|.#.', 1], ['t-2', '.#|##|.#', 1], ['t-3', '.#.|###', 1], ['t-4', '#.|##|#.', 1],
    ['s-y', '.##|##.', 1], ['s-d', '#.|##|.#', 1], ['z-y', '##.|.##', 1], ['z-d', '.#|##|#.', 1],
    ['buyuk-l-1', '#..|#..|###', 1], ['buyuk-l-2', '###|#..|#..', 1],
    ['buyuk-l-3', '###|..#|..#', 1], ['buyuk-l-4', '..#|..#|###', 1]
  ];

  // Kalıbı { id, hucreler: [[satir, sutun]], en, boy, agirlik } biçimine çevirir.
  function kalipCoz(id, desen, agirlik) {
    var satirlar = desen.split('|');
    var hucreler = [];
    satirlar.forEach(function (satir, r) {
      for (var c = 0; c < satir.length; c++) if (satir[c] === '#') hucreler.push([r, c]);
    });
    return { id: id, hucreler: hucreler, boy: satirlar.length, en: satirlar[0].length, agirlik: agirlik };
  }

  var SEKILLER = {};
  var SEKIL_LISTESI = KALIPLAR.map(function (k) {
    var s = kalipCoz(k[0], k[1], k[2]);
    SEKILLER[s.id] = s;
    return s;
  });

  function sekil(id) { return SEKILLER[id]; }

  function bosTahta() {
    var t = new Array(BOYUT * BOYUT);
    for (var i = 0; i < t.length; i++) t[i] = -1;
    return t;
  }

  // Parça (şekil kimliği ya da şekil), sol üst köşesi (satir, sutun) olacak biçimde sığar mı?
  function sigarMi(tahta, sekilId, satir, sutun) {
    var s = typeof sekilId === 'string' ? SEKILLER[sekilId] : sekilId;
    if (satir < 0 || sutun < 0 || satir + s.boy > BOYUT || sutun + s.en > BOYUT) return false;
    for (var i = 0; i < s.hucreler.length; i++) {
      if (tahta[(satir + s.hucreler[i][0]) * BOYUT + sutun + s.hucreler[i][1]] !== -1) return false;
    }
    return true;
  }

  // Parçanın sığdığı ilk konum ({ satir, sutun }) ya da null.
  function ilkYer(tahta, sekilId) {
    var s = typeof sekilId === 'string' ? SEKILLER[sekilId] : sekilId;
    for (var r = 0; r + s.boy <= BOYUT; r++) {
      for (var c = 0; c + s.en <= BOYUT; c++) if (sigarMi(tahta, s, r, c)) return { satir: r, sutun: c };
    }
    return null;
  }

  function yerVarMi(tahta, sekilId) { return ilkYer(tahta, sekilId) !== null; }

  // Dolu satır ve sütunların numaraları.
  function doluCizgiler(tahta) {
    var satirlar = [], sutunlar = [];
    for (var r = 0; r < BOYUT; r++) {
      var dolu = true;
      for (var c = 0; c < BOYUT && dolu; c++) if (tahta[r * BOYUT + c] === -1) dolu = false;
      if (dolu) satirlar.push(r);
    }
    for (var c2 = 0; c2 < BOYUT; c2++) {
      var dolu2 = true;
      for (var r2 = 0; r2 < BOYUT && dolu2; r2++) if (tahta[r2 * BOYUT + c2] === -1) dolu2 = false;
      if (dolu2) sutunlar.push(c2);
    }
    return { satirlar: satirlar, sutunlar: sutunlar };
  }

  // Parçayı koyar, dolan satır/sütunları temizler. Tahtanın kopyasını döndürür, girdiyi değiştirmez.
  // temizlenen: temizlenen hücrelerin dizinleri ve renkleri (animasyon için, çift sayılmaz).
  function yerlestir(tahta, sekilId, satir, sutun, renk) {
    var s = typeof sekilId === 'string' ? SEKILLER[sekilId] : sekilId;
    if (!sigarMi(tahta, s, satir, sutun)) return null;
    var yeni = tahta.slice();
    var konan = s.hucreler.map(function (h) {
      var i = (satir + h[0]) * BOYUT + sutun + h[1];
      yeni[i] = renk;
      return i;
    });
    var cizgiler = doluCizgiler(yeni);
    var silinecek = {};
    cizgiler.satirlar.forEach(function (r) { for (var c = 0; c < BOYUT; c++) silinecek[r * BOYUT + c] = true; });
    cizgiler.sutunlar.forEach(function (c) { for (var r = 0; r < BOYUT; r++) silinecek[r * BOYUT + c] = true; });
    var temizlenen = Object.keys(silinecek).map(Number).sort(function (a, b) { return a - b; }).map(function (i) {
      return { dizin: i, renk: yeni[i] };
    });
    temizlenen.forEach(function (h) { yeni[h.dizin] = -1; });
    return {
      tahta: yeni, konan: konan, satirlar: cizgiler.satirlar, sutunlar: cizgiler.sutunlar,
      cizgi: cizgiler.satirlar.length + cizgiler.sutunlar.length, temizlenen: temizlenen,
      tertemiz: temizlenen.length > 0 && yeni.every(function (h) { return h === -1; })
    };
  }

  // Seri: çizgi temizleyen hamleler en fazla SERI_PENCERE - 1 boş hamleyle ayrıldıkça büyür.
  function seriGuncelle(seri, bosHamle, cizgi) {
    if (cizgi > 0) return { seri: Math.min(seri + 1, SERI_TAVAN), bosHamle: 0 };
    var bos = bosHamle + 1;
    return { seri: bos >= SERI_PENCERE ? 0 : seri, bosHamle: bos };
  }

  // Bir hamlenin puanı. hucre: konan çini sayısı, cizgi: aynı hamlede temizlenen çizgi sayısı,
  // seri: bu hamle dahil seri sayısı (en az 1 kabul edilir).
  function puanHesapla(hucre, cizgi, seri, tertemiz) {
    var kombo = cizgi;
    var carpan = Math.max(1, seri || 0);
    var cizgiPuani = CIZGI_TABAN * cizgi * kombo * carpan;
    var bonus = tertemiz ? TERTEMIZ_BONUS : 0;
    return { hucre: hucre, cizgiPuani: cizgiPuani, kombo: kombo, carpan: carpan, bonus: bonus, toplam: hucre + cizgiPuani + bonus };
  }

  function yeniDurum() {
    return { tahta: bosTahta(), tepsi: [null, null, null], puan: 0, cizgi: 0, seri: 0, bosHamle: 0, tur: 0, hamle: 0, bitti: false };
  }

  // Tepsideki parçalardan hiçbiri sığmıyorsa oyun biter. Tepsi tamamen boşsa (yeni parça bekleniyor) bitmez.
  function oyunBittiMi(tahta, tepsi) {
    var kalan = tepsi.filter(Boolean);
    if (!kalan.length) return false;
    return kalan.every(function (p) { return !yerVarMi(tahta, p.sekil); });
  }

  // Tepsideki bir parçayı oynar: yeni durum ve animasyonun ihtiyaç duyduğu olay bilgisini döndürür.
  // Geçersiz hamlede null. Tepsi boşalırsa yeniden doldurmak çağıranın işidir (tepsiDoldur).
  function hamleUygula(durum, yuva, satir, sutun) {
    var parca = durum.tepsi[yuva];
    if (!parca || durum.bitti) return null;
    var sonuc = yerlestir(durum.tahta, parca.sekil, satir, sutun, parca.renk);
    if (!sonuc) return null;
    var seri = seriGuncelle(durum.seri, durum.bosHamle, sonuc.cizgi);
    var puan = puanHesapla(sonuc.konan.length, sonuc.cizgi, seri.seri, sonuc.tertemiz);
    var tepsi = durum.tepsi.slice();
    tepsi[yuva] = null;
    var yeni = {
      tahta: sonuc.tahta, tepsi: tepsi, puan: durum.puan + puan.toplam, cizgi: durum.cizgi + sonuc.cizgi,
      seri: seri.seri, bosHamle: seri.bosHamle, tur: durum.tur, hamle: durum.hamle + 1, bitti: false
    };
    yeni.bitti = oyunBittiMi(yeni.tahta, yeni.tepsi);
    return { durum: yeni, sonuc: sonuc, puan: puan };
  }

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

  // Ağırlıklı şekil seçimi. Puan büyüdükçe büyük parçalar sıklaşır, tek ve ikililer seyrekleşir.
  function sekilSec(rastgele, puan, aday) {
    var liste = aday || SEKIL_LISTESI;
    var zorluk = Math.min(1, (puan || 0) / 4000);
    var agirliklar = liste.map(function (s) {
      var n = s.hucreler.length;
      var a = s.agirlik;
      if (n <= 2) a *= 1 - 0.5 * zorluk;
      if (n >= 5) a *= 1 + 0.8 * zorluk;
      return a;
    });
    var toplam = agirliklar.reduce(function (x, y) { return x + y; }, 0);
    var hedef = rastgele() * toplam;
    for (var i = 0; i < liste.length; i++) {
      hedef -= agirliklar[i];
      if (hedef < 0) return liste[i];
    }
    return liste[liste.length - 1];
  }

  function parcaUret(rastgele, puan, aday) {
    return { sekil: sekilSec(rastgele, puan, aday).id, renk: Math.floor(rastgele() * RENK_SAYISI) };
  }

  // Üç parça bir sırayla, aradaki temizlemeler hesaba katılarak tahtaya konabilir mi?
  // Arama bütçesi aşılırsa "hayır" sayılır; bu yalnızca üreteci biraz daha cimri yapar.
  function hepsiYerlesirMi(tahta, sekiller, butce) {
    var kalanButce = { n: butce || 6000 };
    function ara(t, kalan) {
      if (!kalan.length) return true;
      var denenen = {};
      for (var k = 0; k < kalan.length; k++) {
        var s = SEKILLER[kalan[k]];
        if (denenen[s.id]) continue;
        denenen[s.id] = true;
        var geri = kalan.slice(0, k).concat(kalan.slice(k + 1));
        for (var r = 0; r + s.boy <= BOYUT; r++) {
          for (var c = 0; c + s.en <= BOYUT; c++) {
            if (--kalanButce.n < 0) return false;
            if (!sigarMi(t, s, r, c)) continue;
            if (ara(yerlestir(t, s, r, c, 0).tahta, geri)) return true;
          }
        }
      }
      return false;
    }
    return ara(tahta, sekiller);
  }

  // Klasik mod üreteci: zor ama adil. Çoğu zaman üçü birden yerleşebilen bir üçlü arar; puan arttıkça
  // bu koruma azalır. Her durumda üç parçadan en az biri tahtaya sığar.
  function ucluUret(tahta, rastgele, puan) {
    var koruma = Math.max(0.45, 1 - (puan || 0) / 6000);
    var uclu;
    if (rastgele() < koruma) {
      for (var deneme = 0; deneme < 14; deneme++) {
        uclu = [parcaUret(rastgele, puan), parcaUret(rastgele, puan), parcaUret(rastgele, puan)];
        if (hepsiYerlesirMi(tahta, uclu.map(function (p) { return p.sekil; }))) return uclu;
      }
    }
    uclu = [parcaUret(rastgele, puan), parcaUret(rastgele, puan), parcaUret(rastgele, puan)];
    if (!uclu.some(function (p) { return yerVarMi(tahta, p.sekil); })) {
      var sigan = SEKIL_LISTESI.filter(function (s) { return yerVarMi(tahta, s); });
      // Tahta hiç tam dolu kalmaz (dolu çizgiler temizlenir), bu yüzden en azından tek kare sığar.
      uclu[Math.floor(rastgele() * 3)] = parcaUret(rastgele, puan, sigan);
    }
    return uclu;
  }

  // Yerel takvim gününe göre günlük oyun numarası (1'den başlar); yaz saatinden etkilenmez.
  function gunNo(tarih) {
    var gun = Date.UTC(tarih.getFullYear(), tarih.getMonth(), tarih.getDate());
    return Math.floor((gun - BASLANGIC) / 86400000) + 1;
  }

  // Günlük modun parça dizisi yalnızca gün ve tur numarasına bağlıdır: aynı gün herkes aynı üçlüleri
  // aynı sırayla alır. Her üçlüde en az bir küçük (en fazla 3 kareli) parça bulunur.
  function gunlukUclu(no, tur) {
    var rastgele = uretec(Math.imul(no, 2654435761) ^ Math.imul(tur + 1, 40503));
    var zorluk = Math.min(4000, tur * 220);
    var uclu = [parcaUret(rastgele, zorluk), parcaUret(rastgele, zorluk), parcaUret(rastgele, zorluk)];
    if (!uclu.some(function (p) { return SEKILLER[p.sekil].hucreler.length <= 3; })) {
      var kucukler = SEKIL_LISTESI.filter(function (s) { return s.hucreler.length <= 3; });
      uclu[Math.floor(rastgele() * 3)] = parcaUret(rastgele, 0, kucukler);
    }
    return uclu;
  }

  // Tepsi boşaldıysa yeni üçlüyü koyar (mod: 'gunluk' ya da 'klasik'). Yeni durum döndürür.
  function tepsiDoldur(durum, mod, ek) {
    if (durum.tepsi.some(Boolean)) return durum;
    var yeni = Object.assign({}, durum);
    yeni.tepsi = mod === 'gunluk' ? gunlukUclu(ek.gunNo, durum.tur) : ucluUret(durum.tahta, ek.rastgele, durum.puan);
    yeni.tur = durum.tur + 1;
    yeni.bitti = oyunBittiMi(yeni.tahta, yeni.tepsi);
    return yeni;
  }

  function tarihAnahtari(tarih) {
    return tarih.getFullYear() + '-' + String(tarih.getMonth() + 1).padStart(2, '0') + '-' + String(tarih.getDate()).padStart(2, '0');
  }

  // Panoya kopyalanan günlük sonuç: emoji yok.
  function paylasimMetni(tarih, puan, cizgi) {
    return 'Çini Blok · ' + tarih.getDate() + ' ' + AYLAR[tarih.getMonth()] + ' · ' + puan + ' puan · ' + cizgi + ' çizgi';
  }

  // Kayıttan okunan durumun bozuk olmadığını denetler (eski sürüm, elle düzenleme).
  function durumGecerliMi(d) {
    if (!d || !Array.isArray(d.tahta) || d.tahta.length !== BOYUT * BOYUT || !Array.isArray(d.tepsi) || d.tepsi.length !== 3) return false;
    if (!d.tahta.every(function (h) { return Number.isInteger(h) && h >= -1 && h < RENK_SAYISI; })) return false;
    return d.tepsi.every(function (p) { return p === null || (p && SEKILLER[p.sekil] && p.renk >= 0 && p.renk < RENK_SAYISI); }) &&
      ['puan', 'cizgi', 'seri', 'bosHamle', 'tur', 'hamle'].every(function (a) { return Number.isFinite(d[a]); });
  }

  var CiniMantik = {
    BOYUT: BOYUT, RENK_SAYISI: RENK_SAYISI, CIZGI_TABAN: CIZGI_TABAN, TERTEMIZ_BONUS: TERTEMIZ_BONUS, SERI_PENCERE: SERI_PENCERE,
    SEKILLER: SEKILLER, SEKIL_LISTESI: SEKIL_LISTESI, sekil: sekil, bosTahta: bosTahta, sigarMi: sigarMi, ilkYer: ilkYer,
    yerVarMi: yerVarMi, doluCizgiler: doluCizgiler, yerlestir: yerlestir, seriGuncelle: seriGuncelle, puanHesapla: puanHesapla,
    yeniDurum: yeniDurum, oyunBittiMi: oyunBittiMi, hamleUygula: hamleUygula, uretec: uretec, sekilSec: sekilSec,
    parcaUret: parcaUret, hepsiYerlesirMi: hepsiYerlesirMi, ucluUret: ucluUret, gunNo: gunNo, gunlukUclu: gunlukUclu,
    tepsiDoldur: tepsiDoldur, tarihAnahtari: tarihAnahtari, paylasimMetni: paylasimMetni, durumGecerliMi: durumGecerliMi
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CiniMantik;
  else kok.CiniMantik = CiniMantik;
})(this);
