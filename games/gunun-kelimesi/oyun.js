(function () {
  var M = KelimeMantik;
  var GECERLI = new Set(Kelimeler.GECERLI);
  var KLAVYE = [
    ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
    ['GİR', 'Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', 'SİL']
  ];
  var HARFLER = new Set([].concat(KLAVYE[0], KLAVYE[1], KLAVYE[2]).filter(function (h) { return h.length === 1; }));
  var ONCELIK = { dogru: 3, var: 2, yok: 1 };

  var izgara = document.getElementById('izgara');
  var klavye = document.getElementById('klavye');
  var mesaj = document.getElementById('mesaj');
  var sonucAlani = document.getElementById('sonuc');
  var modEtiketi = document.getElementById('mod-etiketi');
  var dialog = document.getElementById('istatistik');

  var bugun = new Date();
  var no = M.bulmacaNo(bugun);
  var durum; // { mod, cevap, tahminler, bitti, kazandi }
  var yazilan = '';
  var tuslar = {};

  function kutular() {
    izgara.innerHTML = '';
    for (var s = 0; s < M.HAK; s++) {
      var satir = document.createElement('div');
      satir.className = 'satir';
      for (var k = 0; k < M.UZUNLUK; k++) {
        var kutu = document.createElement('div');
        kutu.className = 'kutu';
        satir.append(kutu);
      }
      izgara.append(satir);
    }
  }

  function klavyeyiKur() {
    KLAVYE.forEach(function (sira) {
      var satir = document.createElement('div');
      satir.className = 'klavye-satir';
      sira.forEach(function (harf) {
        var tus = document.createElement('button');
        tus.type = 'button';
        tus.className = 'tus' + (harf.length > 1 ? ' genis' : '');
        tus.textContent = harf === 'SİL' ? '⌫' : harf === 'GİR' ? 'GİR' : harf;
        tus.setAttribute('aria-label', harf === 'SİL' ? 'Sil' : harf === 'GİR' ? 'Tahmin et' : harf);
        tus.addEventListener('click', function () { tusla(harf); });
        if (harf.length === 1) tuslar[harf] = tus;
        satir.append(tus);
      });
      klavye.append(satir);
    });
  }

  function ciz() {
    var satirlar = izgara.children;
    var tusDurumu = {};
    for (var s = 0; s < M.HAK; s++) {
      var kutuListesi = satirlar[s].children;
      var tahmin = durum.tahminler[s];
      var harfler = tahmin ? Array.from(tahmin) : s === durum.tahminler.length ? Array.from(yazilan) : [];
      var renkler = tahmin ? M.renklendir(tahmin, durum.cevap) : null;
      for (var k = 0; k < M.UZUNLUK; k++) {
        var kutu = kutuListesi[k];
        kutu.textContent = harfler[k] || '';
        kutu.className = 'kutu' + (harfler[k] ? ' dolu' : '') + (renkler ? ' ' + renkler[k] : '');
        if (renkler && (!tusDurumu[harfler[k]] || ONCELIK[renkler[k]] > ONCELIK[tusDurumu[harfler[k]]])) {
          tusDurumu[harfler[k]] = renkler[k];
        }
      }
    }
    Object.keys(tuslar).forEach(function (harf) {
      tuslar[harf].className = 'tus' + (tusDurumu[harf] ? ' ' + tusDurumu[harf] : '');
    });
    modEtiketi.textContent = durum.mod === 'gunluk' ? '#' + no : '(serbest)';
    sonucAlani.hidden = !durum.bitti;
    document.getElementById('paylas').hidden = durum.mod !== 'gunluk';
  }

  function kaydet() {
    if (durum.mod === 'gunluk') {
      Depo.yaz('kelime:gunluk', { tarih: M.tarihAnahtari(bugun), tahminler: durum.tahminler });
      // Ana sayfadaki "Bugünün meydan okumaları" için ortak günlük kayıt.
      if (durum.tahminler.length) window.Gunluk && window.Gunluk.kaydet('gunun-kelimesi', durum.bitti
        ? { durum: 'bitti', ozet: (durum.kazandi ? durum.tahminler.length : 'X') + '/' + M.HAK } : { durum: 'yarim', ozet: '' });
    }
  }

  function salla() {
    var satir = izgara.children[durum.tahminler.length];
    satir.classList.remove('salla');
    void satir.offsetWidth;
    satir.classList.add('salla');
  }

  function bitir(kazandi) {
    durum.bitti = true;
    durum.kazandi = kazandi;
    mesaj.textContent = kazandi
      ? ['Dahice!', 'Harika!', 'Çok iyi!', 'Güzel!', 'İyi iş!', 'Kıl payı!'][durum.tahminler.length - 1]
      : 'Kelime: ' + durum.cevap;
    if (durum.mod === 'gunluk') {
      var ist = M.istatistikIsle(Depo.oku('kelime:istatistik', null), no, kazandi, durum.tahminler.length);
      Depo.yaz('kelime:istatistik', ist);
      Depo.ozetYaz('gunun-kelimesi', ist.seri ? 'Seri ' + ist.seri : ist.kazanilan + '/' + ist.oynanan + ' gün');
      setTimeout(istatistikGoster, 1200);
    }
  }

  function tahminEt() {
    if (yazilan.length < M.UZUNLUK) {
      mesaj.textContent = 'Harf sayısı yetersiz.';
      salla();
      return;
    }
    if (!GECERLI.has(yazilan)) {
      mesaj.textContent = 'Bu kelime listede yok.';
      salla();
      return;
    }
    durum.tahminler.push(yazilan);
    yazilan = '';
    mesaj.textContent = '';
    var son = durum.tahminler[durum.tahminler.length - 1];
    if (son === durum.cevap) bitir(true);
    else if (durum.tahminler.length === M.HAK) bitir(false);
    kaydet();
    ciz();
  }

  function tusla(tus) {
    if (durum.bitti) return;
    if (tus === 'GİR') return tahminEt();
    if (tus === 'SİL') yazilan = Array.from(yazilan).slice(0, -1).join('');
    else if (HARFLER.has(tus) && Array.from(yazilan).length < M.UZUNLUK) yazilan += tus;
    ciz();
  }

  document.addEventListener('keydown', function (olay) {
    if (olay.ctrlKey || olay.metaKey || olay.altKey || dialog.open) return;
    if (olay.key === 'Enter') { olay.preventDefault(); tusla('GİR'); }
    else if (olay.key === 'Backspace') tusla('SİL');
    else if (olay.key.length === 1) {
      var harf = M.buyut(olay.key);
      if (HARFLER.has(harf)) tusla(harf);
    }
  });

  function gunlukBaslat() {
    var kayit = Depo.oku('kelime:gunluk', null);
    var tahminler = kayit && kayit.tarih === M.tarihAnahtari(bugun) ? kayit.tahminler : [];
    durum = { mod: 'gunluk', cevap: M.gununKelimesi(Kelimeler.CEVAPLAR, bugun), tahminler: tahminler, bitti: false };
    var son = tahminler[tahminler.length - 1];
    if (son === durum.cevap) { durum.bitti = true; mesaj.textContent = 'Bugünün kelimesini buldun. Yarın yeni kelime var!'; }
    else if (tahminler.length >= M.HAK) { durum.bitti = true; mesaj.textContent = 'Kelime: ' + durum.cevap + '. Yarın yeni kelime var!'; }
    durum.kazandi = son === durum.cevap;
    kaydet(); // bu güncellemeden önce bitirilmiş günü ortak kayda da işler
  }

  function serbestBaslat() {
    var cevaplar = Kelimeler.CEVAPLAR;
    var cevap;
    do { cevap = cevaplar[Math.floor(Math.random() * cevaplar.length)]; }
    while (cevaplar.length > 1 && cevap === M.gununKelimesi(cevaplar, bugun));
    durum = { mod: 'serbest', cevap: cevap, tahminler: [], bitti: false };
    yazilan = '';
    mesaj.textContent = 'Serbest mod: rastgele bir kelime seçildi.';
    ciz();
  }

  function istatistikGoster() {
    var ist = Depo.oku('kelime:istatistik', null) || M.yeniIstatistik();
    document.getElementById('ist-oynanan').textContent = ist.oynanan;
    document.getElementById('ist-oran').textContent = ist.oynanan ? Math.round(100 * ist.kazanilan / ist.oynanan) : 0;
    document.getElementById('ist-seri').textContent = ist.seri;
    document.getElementById('ist-en-iyi').textContent = ist.enIyiSeri;
    var liste = document.getElementById('ist-dagilim');
    liste.innerHTML = '';
    var enCok = Math.max.apply(null, ist.dagilim.concat(1));
    ist.dagilim.forEach(function (adet, i) {
      var li = document.createElement('li');
      var cubuk = document.createElement('span');
      var bugunku = durum.mod === 'gunluk' && durum.kazandi && durum.tahminler.length === i + 1;
      cubuk.className = 'ist-cubuk' + (bugunku ? ' bugun' : '');
      cubuk.style.width = Math.max(8, Math.round(100 * adet / enCok)) + '%';
      cubuk.textContent = adet;
      li.append(cubuk);
      liste.append(li);
    });
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  document.getElementById('istatistik-ac').addEventListener('click', istatistikGoster);
  document.getElementById('serbest').addEventListener('click', serbestBaslat);
  document.getElementById('paylas').addEventListener('click', function () {
    var metin = M.paylasimMetni(no, durum.tahminler, durum.cevap, durum.kazandi !== false && durum.tahminler[durum.tahminler.length - 1] === durum.cevap);
    var tamam = function () { mesaj.textContent = 'Sonuç panoya kopyalandı.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(metin).then(tamam, function () { mesaj.textContent = metin; });
    } else {
      mesaj.textContent = metin;
    }
  });

  kutular();
  klavyeyiKur();
  gunlukBaslat();
  ciz();
})();
