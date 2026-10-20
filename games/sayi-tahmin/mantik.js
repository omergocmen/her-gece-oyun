// Sayı Bulmaca'nın saf oyun mantığı: tarayıcıda window.SayiMantik, Node testlerinde module.exports.
(function (kok) {
  var SEVIYELER = [3, 4, 5];
  var GUNLUK_HANE = 4;
  var BASLANGIC = Date.UTC(2026, 9, 20); // 20 Ekim 2026: 1 numaralı günlük sayı
  var DAGILIM_UZUNLUK = 10; // 1..9 deneme ve "10+"

  // Doğru yerdeki rakam sayısı (+) ve sayıda olup yanlış yerdeki rakam sayısı (−).
  function ipucu(tahmin, gizli) {
    var arti = 0, eksi = 0;
    for (var i = 0; i < tahmin.length; i++) {
      if (tahmin[i] === gizli[i]) arti++;
      else if (gizli.indexOf(tahmin[i]) !== -1) eksi++;
    }
    return { arti: arti, eksi: eksi };
  }

  // Geçerliyse null, değilse oyuncuya gösterilecek kısa mesaj döndürür.
  function gecersizlik(tahmin, hane) {
    if (!/^\d*$/.test(tahmin)) return 'Yalnızca rakam girilebilir.';
    if (tahmin.length < hane) return hane + ' hane girmelisin.';
    if (tahmin.length > hane) return 'En fazla ' + hane + ' hane girilebilir.';
    if (new Set(tahmin).size !== tahmin.length) return 'Rakamlar birbirinden farklı olmalı.';
    return null;
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

  // Rakamları birbirinden farklı gizli sayı; sifirIleBaslayabilir false ise ilk hane 0 olmaz.
  function gizliUret(hane, rastgele, sifirIleBaslayabilir) {
    var rakamlar = '0123456789'.split('');
    for (var i = rakamlar.length - 1; i > 0; i--) {
      var j = Math.floor(rastgele() * (i + 1));
      var t = rakamlar[i]; rakamlar[i] = rakamlar[j]; rakamlar[j] = t;
    }
    if (!sifirIleBaslayabilir && rakamlar[0] === '0') {
      rakamlar[0] = rakamlar[hane];
      rakamlar[hane] = '0';
    }
    return rakamlar.slice(0, hane).join('');
  }

  // Yerel takvim gününe göre günlük bulmaca numarası (1'den başlar); yaz saatinden etkilenmez.
  function bulmacaNo(tarih) {
    var gun = Date.UTC(tarih.getFullYear(), tarih.getMonth(), tarih.getDate());
    return Math.floor((gun - BASLANGIC) / 86400000) + 1;
  }

  function gununSayisi(tarih) {
    return gizliUret(GUNLUK_HANE, uretec(bulmacaNo(tarih) * 2654435761), false);
  }

  function tarihAnahtari(tarih) {
    return tarih.getFullYear() + '-' + String(tarih.getMonth() + 1).padStart(2, '0') + '-' + String(tarih.getDate()).padStart(2, '0');
  }

  function yeniIstatistik() {
    return { oynanan: 0, toplamDeneme: 0, enIyi: null, dagilim: new Array(DAGILIM_UZUNLUK).fill(0), seri: 0, enIyiSeri: 0, sonGun: null };
  }

  // Biten turu seviye istatistiğine işler. Günlük turda gunNo verilir; seri ardışık günlerde artar
  // ve aynı gün iki kez sayılmaz.
  function istatistikIsle(ist, denemeSayisi, gunNo) {
    var yeni = JSON.parse(JSON.stringify(ist || yeniIstatistik()));
    if (gunNo != null) {
      if (yeni.sonGun === gunNo) return yeni;
      yeni.seri = yeni.sonGun === gunNo - 1 ? yeni.seri + 1 : 1;
      yeni.enIyiSeri = Math.max(yeni.enIyiSeri, yeni.seri);
      yeni.sonGun = gunNo;
    }
    yeni.oynanan++;
    yeni.toplamDeneme += denemeSayisi;
    yeni.enIyi = yeni.enIyi == null ? denemeSayisi : Math.min(yeni.enIyi, denemeSayisi);
    yeni.dagilim[Math.min(denemeSayisi, DAGILIM_UZUNLUK) - 1]++;
    return yeni;
  }

  // Panoya kopyalanan sonuç: emoji yok, yalnızca +/− sayıları; gizli sayı açık edilmez.
  function paylasimMetni(gunNo, hane, tahminler, gizli) {
    var baslik = 'Sayı Bulmaca ' + (gunNo != null ? '#' + gunNo : '· serbest') + ' · ' + hane + ' hane · ' + tahminler.length + ' deneme';
    var satirlar = tahminler.map(function (t) {
      var ip = ipucu(t, gizli);
      return '+' + ip.arti + ' −' + ip.eksi;
    });
    return baslik + '\n\n' + satirlar.join('\n');
  }

  var ISARETLER = ['normal', 'yok', 'var', 'yeri'];
  function sonrakiIsaret(durum) {
    return ISARETLER[(ISARETLER.indexOf(durum || 'normal') + 1) % ISARETLER.length];
  }

  var SayiMantik = {
    SEVIYELER: SEVIYELER, GUNLUK_HANE: GUNLUK_HANE, DAGILIM_UZUNLUK: DAGILIM_UZUNLUK,
    ipucu: ipucu, gecersizlik: gecersizlik, uretec: uretec, gizliUret: gizliUret, bulmacaNo: bulmacaNo,
    gununSayisi: gununSayisi, tarihAnahtari: tarihAnahtari, yeniIstatistik: yeniIstatistik,
    istatistikIsle: istatistikIsle, paylasimMetni: paylasimMetni, sonrakiIsaret: sonrakiIsaret
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SayiMantik;
  else kok.SayiMantik = SayiMantik;
})(this);
