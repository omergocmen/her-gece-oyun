(function () {
  var liste = document.getElementById('oyun-listesi');
  var buGece = document.getElementById('bu-gece');
  var baglanti = document.getElementById('baglanti');

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

  function kart(oyun, n) {
    var li = document.createElement('li');
    var a = el('a', 'oyun-karti');
    a.href = Katalog.oyunAdresi(oyun);
    var img = document.createElement('img');
    img.src = oyun.gorsel;
    img.alt = '';
    img.loading = 'lazy';
    var icerik = el('div', 'icerik');
    var no = el('span', 'no', numara(n) + ' · ');
    no.append(el('span', 'kategori', oyun.kategori));
    icerik.append(no, el('h3', '', oyun.ad), el('p', '', oyun.aciklama));
    var git = el('span', 'git', '→');
    git.setAttribute('aria-hidden', 'true');
    a.append(img, icerik, git);
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
      sirali.forEach(function (oyun) { liste.append(kart(oyun, no[oyun.slug])); });
    })
    .catch(function () {
      buGece.append(el('p', 'bos-durum', 'Oyun listesi yüklenemedi. Bağlantını kontrol edip sayfayı yenile.'));
    });

  function baglantiDurumu() { baglanti.hidden = navigator.onLine; }
  window.addEventListener('online', baglantiDurumu);
  window.addEventListener('offline', baglantiDurumu);
  baglantiDurumu();
})();
