(function () {
  var liste = document.getElementById('oyun-listesi');
  var buGece = document.getElementById('bu-gece');
  var baglanti = document.getElementById('baglanti');
  var bugun = new Date();

  function el(etiket, sinif, metin) {
    var e = document.createElement(etiket);
    if (sinif) e.className = sinif;
    if (metin) e.textContent = metin;
    return e;
  }

  // Oyunlar games.json'daki sırayla numaralanır: ilk oyun No. 001 (Katalog.numaralar).
  function numara(n) { return 'No. ' + String(n).padStart(3, '0'); }

  function tarihYazisi(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Oyun kartı (DESIGN.md → game-card): kapak + damgalar, kategori, başlık, açıklama ve oynanmışsa özet satırı.
  // Kartın tamamı tek bağlantıdır; ekran okuyucu "Tavla, Masa oyunu, 2D, No. 005" gibi kısa bir ad duyar.
  function kart(oyun, n, oneCikan) {
    var li = el('li', oneCikan ? 'one-cikan' : '');
    var a = el('a', 'oyun-karti' + (oneCikan ? ' oyun-karti--one-cikan' : ''));
    a.href = Katalog.oyunAdresi(oyun);
    var yeni = Katalog.yeniMi(oyun, bugun);
    var ozet = Depo.ozetOku(oyun.slug);
    a.setAttribute('aria-label', [oyun.ad, oyun.kategori, oyun.boyut, yeni ? 'Yeni' : numara(n), ozet].filter(Boolean).join(', '));

    var kapak = el('div', 'kapak');
    var img = document.createElement('img');
    img.src = oyun.gorsel;
    img.alt = oyun.ad + ' oyununun kapak çizimi';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 320;
    img.height = 180;
    // "Yeni" damgası numaranın yerine geçer; ikisi birlikte görünmez.
    var damga = el('span', yeni ? 'damga-kart yeni' : 'damga-kart', yeni ? 'Yeni' : numara(n));
    var boyut = el('span', 'damga-kart boyut' + (oyun.boyut === '3D' ? ' uc-boyut' : ''), oyun.boyut);
    damga.setAttribute('aria-hidden', 'true');
    boyut.setAttribute('aria-hidden', 'true');
    kapak.append(img, damga);
    if (oyun.boyut) kapak.append(boyut);

    var metin = el('div', 'metin');
    var aciklama = el('p', 'aciklama', oyun.aciklama);
    aciklama.id = 'aciklama-' + oyun.slug;
    a.setAttribute('aria-describedby', aciklama.id);
    metin.append(el('span', 'kategori', oyun.kategori), el('h3', '', oyun.ad), aciklama);
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
      document.getElementById('oyun-sayisi').textContent = sirali.length + ' oyun';
      var no = Katalog.numaralar(oyunlar);
      buGeceninOyunu(sirali[0], no[sirali[0].slug]);
      // Manşetteki oyun ızgarada tekrar etmez; ızgaranın ilk kartı "öne çıkan" karttır.
      sirali.slice(1).forEach(function (oyun, i) { liste.append(kart(oyun, no[oyun.slug], i === 0)); });
    })
    .catch(function () {
      buGece.append(el('p', 'bos-durum', 'Oyun listesi yüklenemedi. Bağlantını kontrol edip sayfayı yenile.'));
    });

  function baglantiDurumu() { baglanti.hidden = navigator.onLine; }
  window.addEventListener('online', baglantiDurumu);
  window.addEventListener('offline', baglantiDurumu);
  baglantiDurumu();
})();
