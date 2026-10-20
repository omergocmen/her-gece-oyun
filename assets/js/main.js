(function () {
  var liste = document.getElementById('oyun-listesi');
  var buGece = document.getElementById('bu-gece');
  var baglanti = document.getElementById('baglanti');
  var bugun = new Date();
  var suzgec = document.getElementById('suzgec');
  var suzgecBos = document.getElementById('suzgec-bos');
  var kaldiginBolum = document.getElementById('kaldigin-yer');
  var sonOynananlar = document.getElementById('son-oynananlar');
  var katalog = [];       // en yeni başta
  var numaralar = {};     // slug → No.
  var seciliAnahtar = null;
  var gecisZamani = null;

  function el(etiket, sinif, metin) {
    var e = document.createElement(etiket);
    if (sinif) e.className = sinif;
    if (metin) e.textContent = metin;
    return e;
  }

  // Oyunlar eklenme sırasıyla numaralanır: ilk oyun No. 001.
  function numara(n) { return 'No. ' + String(n).padStart(3, '0'); }

  function tarihYazisi(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Oyun kartı (DESIGN.md → game-card): kapak + damgalar, kategori, başlık, açıklama ve oynanmışsa özet satırı.
  // Kartın tamamı tek bağlantıdır; ekran okuyucu "Tavla, Masa oyunu, 2D, No. 005" gibi kısa bir ad duyar.
  // tur: '' (normal), 'one-cikan' (ızgaranın ilk kartı) ya da 'kompakt' ("Kaldığın yerden" şeridi:
  // yalnızca kapak, başlık ve özet; kategori, açıklama ve damgalar yok).
  function kart(oyun, n, tur) {
    var kompakt = tur === 'kompakt';
    var li = el('li', tur === 'one-cikan' ? 'one-cikan' : '');
    var a = el('a', 'oyun-karti' + (tur ? ' oyun-karti--' + tur : ''));
    a.href = Katalog.oyunAdresi(oyun);
    var yeni = Katalog.yeniMi(oyun, bugun);
    var ozet = Depo.ozetOku(oyun.slug);
    a.setAttribute('aria-label', (kompakt ? [oyun.ad, ozet]
      : [oyun.ad, oyun.kategori, oyun.boyut, yeni ? 'Yeni' : numara(n), ozet]).filter(Boolean).join(', '));

    var kapak = el('div', 'kapak');
    var img = document.createElement('img');
    img.src = oyun.gorsel;
    img.alt = oyun.ad + ' oyununun kapak çizimi';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 320;
    img.height = 180;
    kapak.append(img);
    if (!kompakt) {
      // "Yeni" damgası numaranın yerine geçer; ikisi birlikte görünmez.
      var damga = el('span', yeni ? 'damga-kart yeni' : 'damga-kart', yeni ? 'Yeni' : numara(n));
      damga.setAttribute('aria-hidden', 'true');
      kapak.append(damga);
      if (oyun.boyut) {
        var boyut = el('span', 'damga-kart boyut' + (oyun.boyut === '3D' ? ' uc-boyut' : ''), oyun.boyut);
        boyut.setAttribute('aria-hidden', 'true');
        kapak.append(boyut);
      }
    }

    var metin = el('div', 'metin');
    if (kompakt) {
      metin.append(el('h3', '', oyun.ad));
    } else {
      var aciklama = el('p', 'aciklama', oyun.aciklama);
      aciklama.id = 'aciklama-' + oyun.slug;
      a.setAttribute('aria-describedby', aciklama.id);
      metin.append(el('span', 'kategori', oyun.kategori), el('h3', '', oyun.ad), aciklama);
    }
    // Özet yalnızca oyun Depo'ya yazdıysa çizilir; oynanmamış kartta boş satır kalmaz.
    if (ozet) metin.append(el('span', 'ozet', ozet));

    a.append(kapak, metin);
    li.append(a);
    return li;
  }

  function buGeceninOyunu(oyun, n) {
    buGece.innerHTML = '';
    var adres = Katalog.oyunAdresi(oyun);
    var metin = el('div', 'metin');
    var baslik = el('h2');
    var baslikBag = el('a', '', oyun.ad);
    baslikBag.href = adres;
    baslik.append(baslikBag);
    var buton = el('a', 'buton', 'Hemen oyna ');
    buton.href = adres;
    buton.append(el('span', 'ok', '→'));
    metin.append(
      el('span', 'damga', 'Bu gecenin oyunu'),
      baslik,
      el('span', 'meta', numara(n) + ' · ' + oyun.kategori + ' · ' + tarihYazisi(oyun.eklenme)),
      el('p', '', oyun.aciklama),
      buton
    );
    var vitrin = el('a', 'vitrin');
    vitrin.href = adres;
    vitrin.tabIndex = -1;
    vitrin.setAttribute('aria-hidden', 'true');
    var img = document.createElement('img');
    img.src = oyun.gorsel;
    img.alt = '';
    vitrin.append(img);
    buGece.append(metin, vitrin);
  }

  document.getElementById('tarih').textContent = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

  fetch('games.json')
    .then(function (yanit) { return yanit.json(); })
    .then(function (oyunlar) {
      var sirali = Katalog.sirala(oyunlar);
      document.getElementById('sayi').textContent = String(sirali.length).padStart(3, '0');
      if (!sirali.length) {
        buGece.append(el('p', 'bos-durum', 'Henüz oyun yok. Bu gece ilk oyun geliyor!'));
        return;
      }
      katalog = sirali;
      sirali.forEach(function (oyun, i) { numaralar[oyun.slug] = sirali.length - i; });
      buGeceninOyunu(sirali[0], sirali.length);
      kaldiginYer();
      suzgecKur();
      izgaraCiz(anahtarOku(), false);
    })
    .catch(function () {
      buGece.append(el('p', 'bos-durum', 'Oyun listesi yüklenemedi. Bağlantını kontrol edip sayfayı yenile.'));
    });

  // ---------- Kaldığın yerden ----------
  // Son açılan en fazla 4 oyun, en yeniden eskiye; hiç oyun açılmadıysa ya da depolama kapalıysa bölüm hiç çizilmez.
  function kaldiginYer() {
    var oyunlar = Katalog.sonOynananlar(Depo.sonOynananlar(), katalog, 4);
    if (!oyunlar.length) return;
    oyunlar.forEach(function (oyun) { sonOynananlar.append(kart(oyun, numaralar[oyun.slug], 'kompakt')); });
    kaldiginBolum.hidden = false;
  }

  // ---------- Kategori süzgeci ----------
  // Seçili süzgeç URL'ye yansır (?kategori=bulmaca): bağlantı paylaşılabilir, geri tuşu önceki süzgece döner.
  function anahtarOku() {
    var anahtar = new URLSearchParams(location.search).get('kategori');
    return Katalog.gecerliAnahtar(katalog, anahtar || Katalog.TUMU);
  }

  function suzgecKur() {
    Katalog.kategoriler(katalog).forEach(function (k) {
      var dugme = el('button', '', k.ad);
      dugme.type = 'button';
      dugme.dataset.anahtar = k.anahtar;
      dugme.setAttribute('aria-pressed', 'false');
      dugme.addEventListener('click', function () {
        if (k.anahtar === seciliAnahtar) return;
        var adres = k.anahtar === Katalog.TUMU ? location.pathname : '?kategori=' + encodeURIComponent(k.anahtar);
        history.pushState({ kategori: k.anahtar }, '', adres);
        izgaraCiz(k.anahtar, true);
      });
      suzgec.append(dugme);
    });
    suzgec.hidden = false;
    suzgec.addEventListener('scroll', suzgecKenari, { passive: true });
    window.addEventListener('resize', suzgecKenari);
    window.addEventListener('popstate', function () { izgaraCiz(anahtarOku(), true); });
  }

  // Sağ kenardaki solma maskesi yalnızca kaydırılacak düğme kaldıkça görünür.
  function suzgecKenari() {
    suzgec.classList.toggle('sonda', suzgec.scrollLeft + suzgec.clientWidth >= suzgec.scrollWidth - 2);
  }

  function izgaraCiz(anahtar, gecisli) {
    seciliAnahtar = anahtar;
    Array.prototype.forEach.call(suzgec.children, function (dugme) {
      var secili = dugme.dataset.anahtar === anahtar;
      dugme.setAttribute('aria-pressed', String(secili));
      // Seçili düğme dar ekranda görünür alana kaydırılır; sayfa dikeyde oynamaz.
      if (secili) suzgec.scrollLeft = Math.max(0, Math.min(suzgec.scrollLeft, dugme.offsetLeft - 16),
        dugme.offsetLeft + dugme.offsetWidth + 16 - suzgec.clientWidth);
    });
    suzgecKenari();
    // "Tümü"de manşetteki oyun ızgarada tekrar etmez; başka bir süzgeçte o kategorideyse görünür.
    var oyunlar = anahtar === Katalog.TUMU ? katalog.slice(1) : Katalog.suz(katalog, anahtar);
    var say = anahtar === Katalog.TUMU ? katalog.length : oyunlar.length;
    document.getElementById('oyun-sayisi').textContent = say + ' oyun';

    function diz() {
      liste.innerHTML = '';
      // Izgaranın ilk kartı "öne çıkan" karttır.
      oyunlar.forEach(function (oyun, i) { liste.append(kart(oyun, numaralar[oyun.slug], i === 0 ? 'one-cikan' : '')); });
      suzgecBos.hidden = oyunlar.length > 0;
      liste.classList.remove('soluyor');
    }
    clearTimeout(gecisZamani);
    if (!gecisli || hareketAz()) return diz();
    // Kartlar 150 ms solar, yeniden dizilir ve geri gelir.
    liste.classList.add('soluyor');
    gecisZamani = setTimeout(diz, 150);
  }

  function hareketAz() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function baglantiDurumu() { baglanti.hidden = navigator.onLine; }
  window.addEventListener('online', baglantiDurumu);
  window.addEventListener('offline', baglantiDurumu);
  baglantiDurumu();
})();
