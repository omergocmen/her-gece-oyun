// Günün Kelimesi'nin saf oyun mantığı: tarayıcıda window.KelimeMantik, Node testlerinde module.exports.
(function (kok) {
  var UZUNLUK = 5;
  var HAK = 6;
  var BASLANGIC = Date.UTC(2026, 9, 20); // 20 Ekim 2026: 1 numaralı bulmaca

  // Türkçe kurallarla büyük harfe çevirir (i → İ, ı → I).
  function buyut(metin) {
    return String(metin).toLocaleUpperCase('tr-TR');
  }

  // Her harf için 'dogru' (yeşil), 'var' (sarı) ya da 'yok' (gri) döndürür.
  // Tekrarlanan harflerde cevaptaki adet kadar harf işaretlenir; önce doğru yerdekiler sayılır.
  function renklendir(tahmin, cevap) {
    var t = Array.from(buyut(tahmin));
    var c = Array.from(buyut(cevap));
    var sonuc = new Array(t.length).fill('yok');
    var kalan = {};
    for (var i = 0; i < c.length; i++) {
      if (t[i] === c[i]) sonuc[i] = 'dogru';
      else kalan[c[i]] = (kalan[c[i]] || 0) + 1;
    }
    for (var j = 0; j < t.length; j++) {
      if (sonuc[j] === 'dogru') continue;
      if (kalan[t[j]] > 0) {
        sonuc[j] = 'var';
        kalan[t[j]]--;
      }
    }
    return sonuc;
  }

  // Yerel takvim gününe göre bulmaca numarası (1'den başlar); saat dilimi ve yaz saatinden etkilenmez.
  function bulmacaNo(tarih) {
    var gun = Date.UTC(tarih.getFullYear(), tarih.getMonth(), tarih.getDate());
    return Math.floor((gun - BASLANGIC) / 86400000) + 1;
  }

  function gununKelimesi(cevaplar, tarih) {
    var n = cevaplar.length;
    var indeks = (((bulmacaNo(tarih) - 1) % n) + n) % n;
    return cevaplar[indeks];
  }

  function tarihAnahtari(tarih) {
    var ay = String(tarih.getMonth() + 1).padStart(2, '0');
    var gun = String(tarih.getDate()).padStart(2, '0');
    return tarih.getFullYear() + '-' + ay + '-' + gun;
  }

  var EMOJI = { dogru: '🟩', var: '🟨', yok: '⬛' };

  function paylasimMetni(no, tahminler, cevap, kazandi) {
    var satirlar = tahminler.map(function (t) {
      return renklendir(t, cevap).map(function (r) { return EMOJI[r]; }).join('');
    });
    return 'Günün Kelimesi #' + no + ' ' + (kazandi ? tahminler.length : 'X') + '/' + HAK + '\n\n' + satirlar.join('\n');
  }

  function yeniIstatistik() {
    return { oynanan: 0, kazanilan: 0, seri: 0, enIyiSeri: 0, dagilim: [0, 0, 0, 0, 0, 0], sonGun: null };
  }

  // Biten günlük oyunu istatistiğe işler. Seri, ardışık günlerde kazanınca artar.
  function istatistikIsle(ist, no, kazandi, tahminSayisi) {
    var yeni = JSON.parse(JSON.stringify(ist || yeniIstatistik()));
    if (yeni.sonGun === no) return yeni;
    yeni.oynanan++;
    if (kazandi) {
      yeni.kazanilan++;
      yeni.seri = yeni.sonGun === no - 1 ? yeni.seri + 1 : 1;
      yeni.enIyiSeri = Math.max(yeni.enIyiSeri, yeni.seri);
      yeni.dagilim[tahminSayisi - 1]++;
    } else {
      yeni.seri = 0;
    }
    yeni.sonGun = no;
    return yeni;
  }

  var KelimeMantik = {
    UZUNLUK: UZUNLUK, HAK: HAK, buyut: buyut, renklendir: renklendir, bulmacaNo: bulmacaNo,
    gununKelimesi: gununKelimesi, tarihAnahtari: tarihAnahtari, paylasimMetni: paylasimMetni,
    yeniIstatistik: yeniIstatistik, istatistikIsle: istatistikIsle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = KelimeMantik;
  else kok.KelimeMantik = KelimeMantik;
})(this);
