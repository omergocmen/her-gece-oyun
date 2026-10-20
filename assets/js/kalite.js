// 3D oyunların ortak grafik kalitesi: tarayıcıda window.Kalite, Node testlerinde module.exports.
//
// Üç şeyi tek yerde toplar: kare süresine göre piksel oranını (çözünürlüğü) uyarlamak, kullanıcının
// "Düşük grafik" tercihini hatırlamak (hgo:kalite-dusuk, tüm 3D oyunlarda ortak) ve oyunun üst
// çubuğuna bu tercihin düğmesini eklemek. Oyunlar three.js'e bağlı kalır, burası bağlı değildir.
//
// Kullanım (oyun.js):
//   const renderer = new THREE.WebGLRenderer(Kalite.rendererSecenek({ powerPreference: 'high-performance' }));
//   const kalite = Kalite.kur(renderer, { azami: 1.75, boyutla: boyutlandir });
//   Kalite.dugmeEkle(document.getElementById('ses'), kalite);
//   ...her karede: kalite.kare(zaman);
(function (kok) {
  var ANAHTAR = 'kalite-dusuk';
  var TABAN = 0.6;          // bundan küçük piksel oranı okunaksız olur
  var DUSUK_AZAMI = 0.75;   // "Düşük grafik" açıkken en yüksek piksel oranı
  var PENCERE = 2000;       // ms: kare süresi bu aralıkta ortalanır
  var YAVAS_MS = 22;        // ortalama bundan uzunsa oran düşer (30 fps eşiğine pay bırakır)
  var HIZLI_MS = 13;        // ortalama bundan kısaysa oran yavaşça geri yükselir
  var DUSME = 0.15, YUKSELME = 0.1;
  var TOPARLANMA = 15000;   // ms: düşüşten sonra yeniden yükselmeden önce beklenen süre
  var ATLA_MS = 250;        // bundan uzun kare (sekme arka planda, duraklatma) ölçüme katılmaz

  function ekranOrani() { return kok.devicePixelRatio || (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) || 1; }
  function depo() { return kok.Depo || (typeof Depo !== 'undefined' ? Depo : null); }

  function dusukMu() {
    var d = depo();
    return !!(d && d.oku(ANAHTAR, false) === true);
  }
  function dusukYaz(deger) {
    var d = depo();
    if (d) d.yaz(ANAHTAR, !!deger);
  }

  function yuvarla(x) { return Math.round(x * 100) / 100; }

  // Piksel oranının üst sınırı: ekranın, oyunun ve "Düşük grafik" tercihinin en küçüğü.
  function azamiOran(dpr, oyunAzami, dusuk) {
    var a = Math.min(dpr || 1, oyunAzami || 2);
    return yuvarla(dusuk ? Math.min(a, DUSUK_AZAMI) : a);
  }

  // Saf karar: bir ölçüm penceresinin ortalama kare süresine (ms) göre yeni piksel oranını verir.
  // d: { oran, azami, dusurme (son düşüşün zamanı) }, simdi: ms.
  function sonrakiOran(d, ortMs, simdi) {
    var taban = Math.min(TABAN, d.azami);
    if (ortMs > YAVAS_MS && d.oran > taban) return yuvarla(Math.max(taban, d.oran - DUSME));
    if (ortMs < HIZLI_MS && d.oran < d.azami && simdi - d.dusurme > TOPARLANMA) return yuvarla(Math.min(d.azami, d.oran + YUKSELME));
    return d.oran;
  }

  // WebGLRenderer ayarları: "Düşük grafik" ya da yüksek yoğunluklu ekranda kenar yumuşatma kapalı
  // (piksel oranı zaten yüksek ya da ağır sahne). Bağlam kurulduktan sonra değişmez; tercih
  // sonraki açılışta etki eder, piksel oranı ise anında uygulanır.
  function rendererSecenek(ekstra) {
    var dpr = ekranOrani();
    var s = { antialias: !dusukMu() && dpr < 2.5 };
    if (ekstra) for (var k in ekstra) if (Object.prototype.hasOwnProperty.call(ekstra, k)) s[k] = ekstra[k];
    return s;
  }

  // renderer: THREE.WebGLRenderer. secenek: { azami (piksel oranı üst sınırı, 2), boyutla (oran
  // değişince çağrılacak yeniden boyutlandırma işlevi) }. Döner: kare/dusukAyarla/oran okuyucuları.
  function kur(renderer, secenek) {
    secenek = secenek || {};
    var dpr = ekranOrani();
    var durum = {
      dusuk: dusukMu(), oyunAzami: secenek.azami || 2, azami: 0, oran: 0, dusurme: 0,
      son: 0, kare: 0, toplam: 0, ort: 0
    };

    function uygula(oran) {
      oran = yuvarla(oran);
      if (oran === durum.oran) return;
      durum.oran = oran;
      renderer.setPixelRatio(oran);
      if (secenek.boyutla) secenek.boyutla();
    }
    function sinirla() {
      durum.azami = azamiOran(dpr, durum.oyunAzami, durum.dusuk);
    }

    sinirla();
    // Başlangıçta üst sınırın biraz altından başla; hızlı cihazda 2 sn içinde tavana çıkar.
    renderer.setPixelRatio(durum.oran = yuvarla(Math.min(durum.azami, durum.dusuk ? durum.azami : 1.5)));

    var kalite = {
      // Her animasyon karesinde rAF zaman damgasıyla çağrılır.
      kare: function (zaman) {
        var onceki = durum.son;
        durum.son = zaman;
        if (!onceki) return;
        var dt = zaman - onceki;
        if (dt <= 0 || dt > ATLA_MS) return;
        durum.kare++; durum.toplam += dt;
        if (durum.toplam < PENCERE) return;
        durum.ort = durum.toplam / durum.kare;
        var yeni = sonrakiOran(durum, durum.ort, zaman);
        if (yeni < durum.oran) durum.dusurme = zaman;
        uygula(yeni);
        durum.kare = 0; durum.toplam = 0;
      },
      dusukAyarla: function (dusuk) {
        durum.dusuk = !!dusuk;
        dusukYaz(durum.dusuk);
        sinirla();
        // Açılınca hemen tavana in; kapanınca yükselme otomatik olur.
        if (durum.oran > durum.azami) uygula(durum.azami);
        durum.dusurme = durum.son || 0;
      },
      get dusuk() { return durum.dusuk; },
      get oran() { return durum.oran; },
      get azami() { return durum.azami; },
      get ortalamaMs() { return durum.ort; }
    };
    return kalite;
  }

  var IKON = {
    // Üç katmanlı yığın: tam kalite.
    yuksek: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
    // Tek düz katman ve üstü çizili işaret: düşük grafik açık.
    dusuk: '<path d="M12 6l9 5-9 5-9-5 9-5z"/><path d="M4 4l16 16"/>'
  };

  // Üst çubukta, referans düğmenin (genellikle ses düğmesi) yanına "Düşük grafik" düğmesi ekler.
  // Düğme referansın sınıfını kullanır; böylece her oyunun kendi düğme biçimini alır.
  function dugmeEkle(referans, kalite) {
    if (!referans || !referans.parentNode || !kok.document) return null;
    var belge = kok.document;
    var svgRef = referans.querySelector('svg');
    var boyut = (svgRef && svgRef.getAttribute('width')) || '22';
    var b = belge.createElement('button');
    b.type = 'button';
    b.id = 'kalite-dugme';
    b.className = referans.className;
    b.title = 'Düşük grafik';
    function ciz() {
      var dusuk = kalite.dusuk;
      b.setAttribute('aria-pressed', dusuk ? 'true' : 'false');
      b.setAttribute('aria-label', dusuk ? 'Düşük grafik açık' : 'Düşük grafik kapalı');
      b.innerHTML = '<svg viewBox="0 0 24 24" width="' + boyut + '" height="' + boyut + '" aria-hidden="true" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (dusuk ? IKON.dusuk : IKON.yuksek) + '</svg>';
    }
    b.addEventListener('click', function () { kalite.dusukAyarla(!kalite.dusuk); ciz(); });
    ciz();
    referans.parentNode.insertBefore(b, referans.nextSibling);
    return b;
  }

  var Kalite = {
    TABAN: TABAN, DUSUK_AZAMI: DUSUK_AZAMI, YAVAS_MS: YAVAS_MS, HIZLI_MS: HIZLI_MS, TOPARLANMA: TOPARLANMA,
    dusukMu: dusukMu, dusukYaz: dusukYaz, azamiOran: azamiOran, sonrakiOran: sonrakiOran,
    rendererSecenek: rendererSecenek, kur: kur, dugmeEkle: dugmeEkle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Kalite;
  else kok.Kalite = Kalite;
})(this);
