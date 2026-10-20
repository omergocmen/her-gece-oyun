(function () {
  var liste = document.getElementById('oyun-listesi');
  var buGece = document.getElementById('bu-gece');
  var baglanti = document.getElementById('baglanti');

  function kart(oyun) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.className = 'oyun-karti';
    a.href = Katalog.oyunAdresi(oyun);
    var img = document.createElement('img');
    img.src = oyun.gorsel;
    img.alt = '';
    img.loading = 'lazy';
    var icerik = document.createElement('div');
    icerik.className = 'icerik';
    var kategori = document.createElement('span');
    kategori.className = 'kategori';
    kategori.textContent = oyun.kategori;
    var h3 = document.createElement('h3');
    h3.textContent = oyun.ad;
    var p = document.createElement('p');
    p.textContent = oyun.aciklama;
    icerik.append(kategori, h3, p);
    a.append(img, icerik);
    li.append(a);
    return li;
  }

  function buGeceninOyunu(oyun) {
    buGece.innerHTML = '';
    var etiket = document.createElement('span');
    etiket.className = 'etiket';
    etiket.textContent = 'Bu gecenin oyunu';
    var h1 = document.createElement('h1');
    h1.textContent = oyun.ad;
    var p = document.createElement('p');
    p.textContent = oyun.aciklama;
    var a = document.createElement('a');
    a.className = 'buton';
    a.href = Katalog.oyunAdresi(oyun);
    a.textContent = 'Hemen oyna';
    buGece.append(etiket, h1, p, a);
  }

  fetch('games.json')
    .then(function (yanit) { return yanit.json(); })
    .then(function (oyunlar) {
      var sirali = Katalog.sirala(oyunlar);
      if (!sirali.length) {
        buGece.textContent = 'Henüz oyun yok. Bu gece ilk oyun geliyor!';
        return;
      }
      buGeceninOyunu(sirali[0]);
      sirali.forEach(function (oyun) { liste.append(kart(oyun)); });
    })
    .catch(function () {
      buGece.textContent = 'Oyun listesi yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.';
    });

  function baglantiDurumu() { baglanti.hidden = navigator.onLine; }
  window.addEventListener('online', baglantiDurumu);
  window.addEventListener('offline', baglantiDurumu);
  baglantiDurumu();
})();
