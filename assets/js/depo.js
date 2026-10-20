// localStorage sarmalayıcısı: gizli sekmede ya da depolama kapalıyken sessizce çalışmaya devam eder.
(function (kok) {
  var ONEK = 'hgo:';
  var Depo = {
    oku: function (anahtar, varsayilan) {
      try {
        var deger = kok.localStorage.getItem(ONEK + anahtar);
        return deger === null ? varsayilan : JSON.parse(deger);
      } catch (e) {
        return varsayilan;
      }
    },
    yaz: function (anahtar, deger) {
      try {
        kok.localStorage.setItem(ONEK + anahtar, JSON.stringify(deger));
      } catch (e) { /* depolama yoksa ilerleme kaydedilmez */ }
    },
    // Ana sayfadaki oyun kartının özet satırı ("En iyi 1240", "Seri 4"): hgo:ozet:<slug>.
    // Oyun yalnızca yazar, ana sayfa yalnızca okur; boş metin yazılmaz ki kart boş satır çizmesin.
    ozetYaz: function (slug, metin) {
      if (metin) Depo.yaz('ozet:' + slug, String(metin));
    },
    ozetOku: function (slug) {
      var metin = Depo.oku('ozet:' + slug, null);
      return typeof metin === 'string' && metin ? metin : null;
    },
    // "Kaldığın yerden" şeridi için son açılan oyunlar (hgo:son-oynanan), en yeni başta, tekrar etmez.
    oynandi: function (slug) {
      var liste = Depo.sonOynananlar().filter(function (s) { return s !== slug; });
      liste.unshift(slug);
      Depo.yaz('son-oynanan', liste.slice(0, SON_SINIR));
    },
    sonOynananlar: function () {
      var liste = Depo.oku('son-oynanan', []);
      return Array.isArray(liste) ? liste.filter(function (s) { return typeof s === 'string'; }) : [];
    }
  };
  var SON_SINIR = 12;
  kok.Depo = Depo;

  // ---------- Günlük meydan okumalar (hgo:gunluk) ----------
  // { tarih:'YYYY-AA-GG' (YEREL gün), oyunlar:{ slug:{ durum:'yarim'|'bitti', ozet } }, seri:{ son, sayi } }
  // Oyun yalnızca Gunluk.kaydet çağırır; ana sayfa Gunluk.oku ile okur. Yeni gün oyunlar'ı sıfırlar, seri sayacını değil.
  function iki(n) { return (n < 10 ? '0' : '') + n; }
  // Yerel takvim günü (UTC değil): gece yarısı yerel saate göre döner.
  function gunAnahtari(d) { return d.getFullYear() + '-' + iki(d.getMonth() + 1) + '-' + iki(d.getDate()); }
  function anahtarGecerli(a) { return typeof a === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a); }
  // İki YYYY-AA-GG arasındaki takvim günü farkı (b - a). 24 saat çıkarmak yaz saati geçişinde şaşar;
  // bu yüzden yalnızca Y/A/G bileşenlerinden Date.UTC kurulur.
  function gunFarki(a, b) {
    var x = a.split('-'), y = b.split('-');
    return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 864e5);
  }
  function bosGunluk(bugun) { return { tarih: bugun, oyunlar: {}, seri: { son: null, sayi: 0 } }; }
  // Kayıttaki bozuk alanları atar; başka güne ait oyunları siler. Seri korunur.
  function gunlukNormalle(ham, bugun) {
    var s = bosGunluk(bugun);
    if (!ham || typeof ham !== 'object') return s;
    var seri = ham.seri;
    if (seri && anahtarGecerli(seri.son) && typeof seri.sayi === 'number' && seri.sayi > 0) {
      s.seri = { son: seri.son, sayi: Math.floor(seri.sayi) };
    }
    if (ham.tarih === bugun && ham.oyunlar && typeof ham.oyunlar === 'object') {
      Object.keys(ham.oyunlar).forEach(function (slug) {
        var o = ham.oyunlar[slug];
        if (o && (o.durum === 'yarim' || o.durum === 'bitti')) {
          s.oyunlar[slug] = { durum: o.durum, ozet: typeof o.ozet === 'string' ? o.ozet : '' };
        }
      });
    }
    return s;
  }
  // Saf: sonucu duruma işler. 'bitti' hiçbir zaman 'yarim' ile ezilmez; ilk bitiş seriyi bir kez uzatır.
  function gunlukIsle(durum, slug, sonuc, bugun) {
    var s = gunlukNormalle(durum, bugun);
    if (!slug || !sonuc || (sonuc.durum !== 'yarim' && sonuc.durum !== 'bitti')) return s;
    var onceki = s.oyunlar[slug];
    if (onceki && onceki.durum === 'bitti' && sonuc.durum !== 'bitti') return s;
    s.oyunlar[slug] = { durum: sonuc.durum, ozet: sonuc.ozet == null ? '' : String(sonuc.ozet) };
    if (sonuc.durum === 'bitti') {
      var son = s.seri.son;
      if (son === bugun) { /* bugün zaten sayıldı */ }
      else if (son && gunFarki(son, bugun) === 1) s.seri = { son: bugun, sayi: s.seri.sayi + 1 };
      else s.seri = { son: bugun, sayi: 1 };
    }
    return s;
  }
  // Rozette gösterilecek seri: dünden eskiyse (gün atlandı) 0. bitti: bugün en az bir meydan okuma bitti mi.
  function gunlukSeri(durum, bugun) {
    var seri = gunlukNormalle(durum, bugun).seri;
    if (!seri.son) return { sayi: 0, bugunBitti: false };
    var fark = gunFarki(seri.son, bugun);
    if (fark === 0) return { sayi: seri.sayi, bugunBitti: true };
    return { sayi: fark === 1 ? seri.sayi : 0, bugunBitti: false };
  }
  var Gunluk = {
    ANAHTAR: 'gunluk', gunAnahtari: gunAnahtari, gunFarki: gunFarki, normalle: gunlukNormalle, isle: gunlukIsle, seri: gunlukSeri,
    kaydet: function (slug, sonuc, simdi) {
      try {
        var bugun = gunAnahtari(simdi || new Date());
        Depo.yaz(Gunluk.ANAHTAR, gunlukIsle(Depo.oku(Gunluk.ANAHTAR, null), slug, sonuc, bugun));
      } catch (e) { /* günlük kayıt oyunu asla bozmaz */ }
    },
    // Bugünün normalleştirilmiş durumu; depolama kapalıysa null (ana sayfa bölümü gizler).
    oku: function (simdi) {
      try {
        var bugun = gunAnahtari(simdi || new Date());
        kok.localStorage.getItem(ONEK + 'gunluk'); // kapalıysa burada fırlar
        return gunlukNormalle(Depo.oku(Gunluk.ANAHTAR, null), bugun);
      } catch (e) { return null; }
    }
  };
  kok.Gunluk = Gunluk;
  if (typeof module !== 'undefined' && module.exports) module.exports = Gunluk;

  // Her oyun sayfası depo.js'yi yükler; sayfa /games/<slug>/ altındaysa kendini son oynananlara ekler.
  // Böylece yeni oyun eklenince oyun koduna ayrıca satır yazmak gerekmez.
  var yol = /\/games\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(?:index\.html)?$/.exec((kok.location && kok.location.pathname) || '');
  if (yol) Depo.oynandi(yol[1]);
})(this);
