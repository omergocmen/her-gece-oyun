(function () {
  var M = SayiMantik;
  var UZUN_BASIS = 450;
  var ISARET_ADI = { normal: '', yok: 'yok', var: 'var', yeri: 'yeri belli' };

  var gecmis = document.getElementById('gecmis');
  var aktif = document.getElementById('aktif');
  var mesaj = document.getElementById('mesaj');
  var denemeSayaci = document.getElementById('deneme');
  var modEtiketi = document.getElementById('mod-etiketi');
  var tuslar = document.getElementById('tuslar');
  var isaretleDugmesi = document.getElementById('isaretle');
  var gunlugeDon = document.getElementById('gunluge-don');
  var seviyeDugmeleri = Array.from(document.querySelectorAll('.seviye [data-hane]'));
  var istDialog = document.getElementById('istatistik');
  var ayarDialog = document.getElementById('ayarlar');
  var sifirAyari = document.getElementById('sifir-ayari');

  var bugun = new Date();
  var no = M.bulmacaNo(bugun);
  var durum; // { mod, hane, gizli, tahminler, isaretler, bitti }
  var yazilan = '';
  var isaretModu = false;
  var tusElemanlari = {};

  function hareketAz() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function haneKutusu(rakam) {
    var kutu = document.createElement('span');
    kutu.className = 'hane' + (rakam ? ' dolu' : '');
    kutu.textContent = rakam || '';
    return kutu;
  }

  function rozet(isaret, sayi) {
    var r = document.createElement('span');
    r.className = 'rozet ' + (sayi === 0 ? 'sifir' : isaret === '+' ? 'arti' : 'eksi');
    r.textContent = isaret + sayi;
    return r;
  }

  function gecmisiCiz(yeniEklendi) {
    gecmis.innerHTML = '';
    if (!durum.tahminler.length) {
      var bos = document.createElement('li');
      bos.className = 'bos';
      bos.textContent = durum.hane + ' farklı rakamlı sayıyı bul. + doğru yer, − yanlış yer.';
      gecmis.append(bos);
      return;
    }
    durum.tahminler.forEach(function (t, i) {
      var li = document.createElement('li');
      li.className = 'hane-satiri';
      var sonSatir = i === durum.tahminler.length - 1;
      if (!(sonSatir && yeniEklendi)) li.classList.add('eski');
      var ip = M.ipucu(t, durum.gizli);
      Array.from(t).forEach(function (r) { li.append(haneKutusu(r)); });
      var rozetler = document.createElement('span');
      rozetler.className = 'rozetler';
      rozetler.append(rozet('+', ip.arti), rozet('−', ip.eksi));
      li.append(rozetler);
      li.setAttribute('aria-label', t.split('').join(' ') + ': artı ' + ip.arti + ', eksi ' + ip.eksi);
      if (t === durum.gizli) li.classList.add('kazandi');
      gecmis.append(li);
    });
  }

  function aktifCiz() {
    aktif.innerHTML = '';
    aktif.hidden = durum.bitti;
    for (var i = 0; i < durum.hane; i++) aktif.append(haneKutusu(yazilan[i]));
  }

  function tuslariCiz() {
    Object.keys(tusElemanlari).forEach(function (r) {
      var isaret = durum.isaretler[r] || 'normal';
      var tus = tusElemanlari[r];
      tus.className = 'tus' + (isaret !== 'normal' ? ' ' + isaret : '');
      tus.setAttribute('aria-label', r + (ISARET_ADI[isaret] ? ', ' + ISARET_ADI[isaret] : ''));
    });
    isaretleDugmesi.setAttribute('aria-pressed', String(isaretModu));
  }

  function ustCiz() {
    modEtiketi.textContent = durum.mod === 'gunluk' ? '#' + no : 'serbest';
    denemeSayaci.textContent = durum.tahminler.length;
    gunlugeDon.hidden = durum.mod === 'gunluk';
    seviyeDugmeleri.forEach(function (d) {
      d.setAttribute('aria-pressed', String(Number(d.dataset.hane) === durum.hane));
    });
  }

  function ciz(yeniEklendi) {
    ustCiz();
    gecmisiCiz(yeniEklendi);
    aktifCiz();
    tuslariCiz();
  }

  function kaydet() {
    if (durum.mod !== 'gunluk') return;
    Depo.yaz('sayi:gunluk', { tarih: M.tarihAnahtari(bugun), tahminler: durum.tahminler, isaretler: durum.isaretler });
    // Ana sayfadaki "Bugünün meydan okumaları" için ortak günlük kayıt.
    if (durum.tahminler.length) window.Gunluk && window.Gunluk.kaydet('sayi-tahmin', durum.bitti
      ? { durum: 'bitti', ozet: durum.tahminler.length + ' deneme' } : { durum: 'yarim', ozet: '' });
  }

  function uyar(metin) {
    mesaj.textContent = metin;
    aktif.classList.remove('salla');
    void aktif.offsetWidth;
    aktif.classList.add('salla');
  }

  function rakamYaz(r) {
    if (durum.bitti) return;
    if (yazilan.indexOf(r) !== -1) return uyar('Rakamlar birbirinden farklı olmalı.');
    if (yazilan.length >= durum.hane) return;
    yazilan += r;
    mesaj.textContent = '';
    aktifCiz();
  }

  function sil() {
    if (durum.bitti) return;
    yazilan = yazilan.slice(0, -1);
    mesaj.textContent = '';
    aktifCiz();
  }

  function isaretDegistir(r) {
    durum.isaretler[r] = M.sonrakiIsaret(durum.isaretler[r]);
    if (durum.isaretler[r] === 'normal') delete durum.isaretler[r];
    kaydet();
    tuslariCiz();
  }

  function istatistikAnahtari(hane) { return 'sayi:ist:' + hane; }

  function tahminEt() {
    if (durum.bitti) return;
    var hata = M.gecersizlik(yazilan, durum.hane);
    if (hata) return uyar(hata);
    durum.tahminler.push(yazilan);
    yazilan = '';
    mesaj.textContent = '';
    var kazandi = durum.tahminler[durum.tahminler.length - 1] === durum.gizli;
    if (kazandi) {
      durum.bitti = true;
      var ist = M.istatistikIsle(Depo.oku(istatistikAnahtari(durum.hane), null), durum.tahminler.length,
        durum.mod === 'gunluk' ? no : null);
      Depo.yaz(istatistikAnahtari(durum.hane), ist);
      Depo.ozetYaz('sayi-tahmin', 'En iyi ' + ist.enIyi + ' deneme');
    }
    kaydet();
    ciz(true);
    if (kazandi) {
      var satir = gecmis.lastElementChild;
      mesaj.textContent = 'Buldun! ' + durum.tahminler.length + ' denemede.';
      setTimeout(function () {
        satir.classList.add('sicra');
        setTimeout(function () { istatistikGoster(true); }, hareketAz() ? 0 : 1100);
      }, hareketAz() ? 0 : 500 + durum.hane * 100);
    }
  }

  function istatistikGoster(sonuc) {
    var ist = Depo.oku(istatistikAnahtari(durum.hane), null) || M.yeniIstatistik();
    document.getElementById('ist-baslik').textContent = sonuc ? 'Tebrikler!' : 'İstatistikler';
    var sonucSatiri = document.getElementById('ist-sonuc');
    sonucSatiri.hidden = !sonuc;
    sonucSatiri.textContent = sonuc ? durum.tahminler.length + ' denemede buldun.' : '';
    document.getElementById('ist-eylemler').hidden = !durum.bitti;
    document.getElementById('serbest').textContent = durum.mod === 'serbest' ? 'Yeni sayı' : 'Serbest modda oyna';
    document.getElementById('ist-oynanan').textContent = ist.oynanan;
    document.getElementById('ist-ortalama').textContent = ist.oynanan ? (ist.toplamDeneme / ist.oynanan).toFixed(1).replace('.', ',') : '–';
    document.getElementById('ist-en-iyi').textContent = ist.enIyi == null ? '–' : ist.enIyi;
    document.getElementById('ist-seri').textContent = durum.hane === M.GUNLUK_HANE ? ist.seri : '–';
    document.getElementById('ist-seviye').textContent = '· ' + durum.hane + ' hane';
    var liste = document.getElementById('ist-dagilim');
    liste.innerHTML = '';
    var enCok = Math.max.apply(null, ist.dagilim.concat(1));
    ist.dagilim.forEach(function (adet, i) {
      var li = document.createElement('li');
      var etiket = document.createElement('span');
      etiket.textContent = i === M.DAGILIM_UZUNLUK - 1 ? (i + 1) + '+' : String(i + 1);
      var cubuk = document.createElement('span');
      var bu = durum.bitti && Math.min(durum.tahminler.length, M.DAGILIM_UZUNLUK) === i + 1;
      cubuk.className = 'ist-cubuk' + (bu ? ' bugun' : '');
      cubuk.style.width = Math.max(8, Math.round(100 * adet / enCok)) + '%';
      cubuk.textContent = adet;
      li.append(etiket, cubuk);
      liste.append(li);
    });
    if (!istDialog.open && typeof istDialog.showModal === 'function') istDialog.showModal();
  }

  function gunlukBaslat() {
    var kayit = Depo.oku('sayi:gunluk', null);
    var bugunku = kayit && kayit.tarih === M.tarihAnahtari(bugun);
    durum = {
      mod: 'gunluk', hane: M.GUNLUK_HANE, gizli: M.gununSayisi(bugun),
      tahminler: bugunku ? kayit.tahminler : [], isaretler: bugunku ? (kayit.isaretler || {}) : {}, bitti: false
    };
    durum.bitti = durum.tahminler[durum.tahminler.length - 1] === durum.gizli;
    kaydet(); // bu güncellemeden önce bitirilmiş günü ortak kayda da işler
    yazilan = '';
    mesaj.textContent = durum.bitti ? 'Bugünün sayısını buldun. Yarın yeni sayı var!' : '';
    ciz(false);
  }

  function serbestBaslat(hane) {
    var sifir = Depo.oku('sayi:sifir', false);
    durum = { mod: 'serbest', hane: hane, gizli: M.gizliUret(hane, Math.random, sifir), tahminler: [], isaretler: {}, bitti: false };
    yazilan = '';
    mesaj.textContent = '';
    ciz(false);
  }

  // Rakam tuşları: dokunma yazar; uzun basış ya da İşaretle modu rakamın notunu değiştirir.
  '1234567890'.split('').forEach(function (r) {
    var tus = document.createElement('button');
    tus.type = 'button';
    tus.className = 'tus';
    tus.textContent = r;
    var zamanlayici = null;
    var uzunBasildi = false;
    tus.addEventListener('pointerdown', function () {
      uzunBasildi = false;
      zamanlayici = setTimeout(function () { uzunBasildi = true; isaretDegistir(r); }, UZUN_BASIS);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (olay) {
      tus.addEventListener(olay, function () { clearTimeout(zamanlayici); });
    });
    tus.addEventListener('contextmenu', function (olay) { olay.preventDefault(); });
    tus.addEventListener('click', function () {
      if (uzunBasildi) { uzunBasildi = false; return; }
      if (isaretModu) isaretDegistir(r);
      else rakamYaz(r);
    });
    tusElemanlari[r] = tus;
    tuslar.append(tus);
  });

  document.getElementById('sil').addEventListener('click', sil);
  document.getElementById('tahmin-et').addEventListener('click', tahminEt);
  isaretleDugmesi.addEventListener('click', function () { isaretModu = !isaretModu; tuslariCiz(); });

  document.addEventListener('keydown', function (olay) {
    if (olay.ctrlKey || olay.metaKey || olay.altKey || istDialog.open || ayarDialog.open) return;
    if (olay.target.closest && olay.target.closest('input')) return;
    if (/^\d$/.test(olay.key)) rakamYaz(olay.key);
    else if (olay.key === 'Backspace') sil();
    else if (olay.key === 'Enter' && !(olay.target.closest && olay.target.closest('button'))) { olay.preventDefault(); tahminEt(); }
  });

  seviyeDugmeleri.forEach(function (d) {
    d.addEventListener('click', function () {
      var hane = Number(d.dataset.hane);
      if (durum.mod === 'serbest' && durum.hane === hane && !durum.bitti) return;
      serbestBaslat(hane);
    });
  });
  gunlugeDon.addEventListener('click', gunlukBaslat);

  document.getElementById('istatistik-ac').addEventListener('click', function () { istatistikGoster(false); });
  document.getElementById('ayar-ac').addEventListener('click', function () {
    sifirAyari.checked = Depo.oku('sayi:sifir', false);
    if (typeof ayarDialog.showModal === 'function') ayarDialog.showModal();
  });
  sifirAyari.addEventListener('change', function () { Depo.yaz('sayi:sifir', sifirAyari.checked); });

  document.getElementById('serbest').addEventListener('click', function () {
    istDialog.close();
    serbestBaslat(durum.mod === 'serbest' ? durum.hane : M.GUNLUK_HANE);
  });
  document.getElementById('paylas').addEventListener('click', function () {
    var metin = M.paylasimMetni(durum.mod === 'gunluk' ? no : null, durum.hane, durum.tahminler, durum.gizli);
    var sonucSatiri = document.getElementById('ist-sonuc');
    var tamam = function () { sonucSatiri.hidden = false; sonucSatiri.textContent = 'Sonuç panoya kopyalandı.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(metin).then(tamam, function () { sonucSatiri.hidden = false; sonucSatiri.textContent = metin; });
    } else {
      sonucSatiri.hidden = false;
      sonucSatiri.textContent = metin;
    }
  });

  // Fare/dokunma ile basılan düğme odakta kalmasın; yoksa fiziksel klavyedeki Enter o düğmeyi tekrar basar.
  document.querySelector('.sayi-oyunu').addEventListener('click', function (olay) {
    var dugme = olay.target.closest && olay.target.closest('button');
    if (dugme && olay.detail > 0) dugme.blur();
  });

  gunlukBaslat();
})();
