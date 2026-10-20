(function () {
  var M = CiniMantik;
  var N = M.BOYUT;
  var PARMAK_USTU = 56; // dokunmatikte parçanın alt kenarı parmağın bu kadar üstünde durur
  var DOKUNMA_ESIGI = 8; // bundan az kayan basış sürükleme değil, seçimdir
  var TEMIZLEME_ARALIK = 30; // fırınlamada hücreler arası gecikme (ms)

  var kok = document.querySelector('.cini-oyunu');
  var tahtaKap = document.getElementById('tahta-kap');
  var tahtaEl = document.getElementById('tahta');
  var efektler = document.getElementById('efektler');
  var tepsiEl = document.getElementById('tepsi');
  var skorEl = document.getElementById('skor');
  var enIyiEl = document.getElementById('en-iyi');
  var enIyiKutu = enIyiEl.parentNode;
  var enIyiEtiket = document.getElementById('en-iyi-etiket');
  var seriRozeti = document.getElementById('seri-rozeti');
  var mesaj = document.getElementById('mesaj');
  var modBilgi = document.getElementById('mod-bilgi');
  var modDugmeleri = Array.from(document.querySelectorAll('.mod-secimi [data-mod]'));
  var sesDugmesi = document.getElementById('ses');
  var yenidenDugmesi = document.getElementById('yeniden');
  var sonucDialog = document.getElementById('sonuc');
  var onayDialog = document.getElementById('onay');

  var bugun = new Date();
  var gunNo = M.gunNo(bugun);
  var bugunAnahtar = M.tarihAnahtari(bugun);
  var AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  var bugunMetni = bugun.getDate() + ' ' + AYLAR[bugun.getMonth()];

  var mod = 'klasik';
  var durum;
  var eskiEnIyi = 0; // oyun başındaki en iyi skor (yeni rekor damgası için)
  var rekorDuyuruldu = false;
  var hucreler = [];
  var yuvalar = [];
  var olcu = { hucre: 36, aralik: 2, adim: 38, tc: 20 };
  var surukleme = null;
  var secim = null;
  var isaretliler = []; // önizlemede işaretlenen hücre dizinleri
  var gosterilenSkor = 0;
  var skorAnimasyonu = null;

  function hareketAz() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function genisEkran() {
    return window.matchMedia && window.matchMedia('(min-width: 760px)').matches;
  }
  function yeniden(el, sinif) {
    el.classList.remove(sinif);
    void el.offsetWidth;
    el.classList.add(sinif);
  }

  // ---------- Ses: dosya yok, Web Audio ile üretilen kısa ve yumuşak tonlar ----------
  var sesAcik = Depo.oku('cini:ses', true);
  var sesBaglam = null, anaSes = null;

  function sesHazirla() {
    if (!sesAcik) return null;
    var Baglam = window.AudioContext || window.webkitAudioContext;
    if (!Baglam) return null;
    if (!sesBaglam) {
      try {
        sesBaglam = new Baglam();
        var suzgec = sesBaglam.createBiquadFilter();
        suzgec.type = 'lowpass';
        suzgec.frequency.value = 3200;
        anaSes = sesBaglam.createGain();
        anaSes.gain.value = 0.55;
        anaSes.connect(suzgec);
        suzgec.connect(sesBaglam.destination);
      } catch (e) { sesBaglam = null; return null; }
    }
    if (sesBaglam.state === 'suspended') sesBaglam.resume();
    return sesBaglam;
  }

  function ton(frekans, gecikme, sure, tip, siddet, hedef) {
    var b = sesBaglam;
    var t = b.currentTime + gecikme;
    var o = b.createOscillator();
    var g = b.createGain();
    o.type = tip;
    o.frequency.setValueAtTime(frekans, t);
    if (hedef) o.frequency.exponentialRampToValueAtTime(hedef, t + sure);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(siddet, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g);
    g.connect(anaSes);
    o.start(t);
    o.stop(t + sure + 0.03);
  }

  var GAM = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
  function sesCal(tur, cizgi, seri) {
    if (!sesHazirla()) return;
    if (tur === 'al') ton(520, 0, 0.05, 'sine', 0.05, 660);
    else if (tur === 'koy') { ton(210, 0, 0.1, 'triangle', 0.2, 130); ton(1240, 0, 0.025, 'sine', 0.03); }
    else if (tur === 'hata') ton(170, 0, 0.14, 'sine', 0.1, 120);
    else if (tur === 'temizle') {
      ton(210, 0, 0.1, 'triangle', 0.16, 130);
      var bas = Math.min(Math.max(seri - 1, 0), 4);
      var adet = 2 + Math.min(cizgi, 4);
      for (var i = 0; i < adet; i++) {
        var f = GAM[Math.min(bas + i, GAM.length - 1)];
        ton(f, 0.03 + i * 0.05, 0.32, 'sine', 0.09);
        ton(f * 2, 0.03 + i * 0.05, 0.12, 'triangle', 0.015);
      }
      if (cizgi >= 2) { ton(GAM[bas] / 2, 0.05, 0.5, 'triangle', 0.07); ton(GAM[bas + 2] / 2, 0.05, 0.5, 'sine', 0.05); }
    } else if (tur === 'tertemiz') {
      [0, 2, 4, 5, 7, 9].forEach(function (k, i) { ton(GAM[k], 0.35 + i * 0.06, 0.4, 'sine', 0.08); });
    } else if (tur === 'bitti') {
      ton(392, 0, 0.3, 'triangle', 0.1);
      ton(311.13, 0.18, 0.35, 'triangle', 0.09);
      ton(233.08, 0.38, 0.6, 'triangle', 0.09);
    }
  }

  function sesDugmesiCiz() {
    sesDugmesi.setAttribute('aria-pressed', String(sesAcik));
    sesDugmesi.setAttribute('aria-label', sesAcik ? 'Sesi kapat' : 'Sesi aç');
  }

  // ---------- Kayıt ----------
  function enIyiAnahtari() { return mod === 'gunluk' ? 'cini:gunluk-en-iyi' : 'cini:en-iyi'; }

  function kaydet() {
    if (mod === 'gunluk') Depo.yaz('cini:gunluk', { tarih: bugunAnahtar, durum: durum });
    else Depo.yaz('cini:klasik', durum);
    if (durum.puan > Depo.oku(enIyiAnahtari(), 0)) Depo.yaz(enIyiAnahtari(), durum.puan);
    Depo.ozetYaz('cini-blok', durum.puan && 'En iyi ' + Math.max(Depo.oku('cini:en-iyi', 0), Depo.oku('cini:gunluk-en-iyi', 0)));
  }

  // ---------- Çizim ----------
  function tahtaKur() {
    for (var i = 0; i < N * N; i++) {
      var h = document.createElement('div');
      h.className = 'hucre';
      h.dataset.i = i;
      hucreler.push(h);
      tahtaEl.append(h);
    }
    for (var y = 0; y < 3; y++) {
      var yuva = document.createElement('button');
      yuva.type = 'button';
      yuva.className = 'yuva';
      yuva.dataset.yuva = y;
      yuvalar.push(yuva);
      tepsiEl.append(yuva);
    }
  }

  function tahtaCiz() {
    for (var i = 0; i < hucreler.length; i++) {
      var v = durum.tahta[i];
      hucreler[i].className = 'hucre' + (v >= 0 ? ' cini r-' + v : '');
    }
    isaretliler = [];
  }

  function onizlemeTemizle() {
    isaretliler.forEach(function (i) {
      var v = durum.tahta[i];
      hucreler[i].className = 'hucre' + (v >= 0 ? ' cini r-' + v : '');
    });
    isaretliler = [];
  }

  // Parça (satir, sutun)'a sığıyorsa gölgesini ve tamamlanacak çizgileri gösterir.
  function onizlemeGoster(parca, satir, sutun) {
    onizlemeTemizle();
    if (!parca || !M.sigarMi(durum.tahta, parca.sekil, satir, sutun)) return false;
    var s = M.sekil(parca.sekil);
    var gecici = durum.tahta.slice();
    s.hucreler.forEach(function (h) {
      var i = (satir + h[0]) * N + sutun + h[1];
      gecici[i] = parca.renk;
      hucreler[i].className = 'hucre golge r-' + parca.renk;
      isaretliler.push(i);
    });
    var c = M.doluCizgiler(gecici);
    var yanan = {};
    c.satirlar.forEach(function (r) { for (var k = 0; k < N; k++) yanan[r * N + k] = true; });
    c.sutunlar.forEach(function (k) { for (var r = 0; r < N; r++) yanan[r * N + k] = true; });
    Object.keys(yanan).forEach(function (i) {
      hucreler[i].classList.add('yanar');
      if (isaretliler.indexOf(Number(i)) === -1) isaretliler.push(Number(i));
    });
    return true;
  }

  function parcaEl(parca, h, a) {
    var s = M.sekil(parca.sekil);
    var el = document.createElement('span');
    el.className = 'parca';
    el.style.width = (s.en * h + (s.en - 1) * a) + 'px';
    el.style.height = (s.boy * h + (s.boy - 1) * a) + 'px';
    el.style.setProperty('--h', h + 'px');
    s.hucreler.forEach(function (hc) {
      var k = document.createElement('i');
      k.className = 'r-' + parca.renk;
      k.style.left = hc[1] * (h + a) + 'px';
      k.style.top = hc[0] * (h + a) + 'px';
      el.append(k);
    });
    return el;
  }

  function tepsiCiz(yeniGeldi) {
    yuvalar.forEach(function (yuva, y) {
      var p = durum.tepsi[y];
      yuva.innerHTML = '';
      yuva.className = 'yuva' + (p ? '' : ' bos');
      yuva.disabled = !p || durum.bitti;
      if (p) {
        yuva.append(parcaEl(p, olcu.tc, Math.max(1, Math.round(olcu.aralik * 0.6))));
        var sigar = M.yerVarMi(durum.tahta, p.sekil);
        if (!sigar) yuva.classList.add('sigmaz');
        yuva.setAttribute('aria-label', 'Parça ' + (y + 1) + ', ' + M.sekil(p.sekil).hucreler.length + ' kare' + (sigar ? '' : ', yer yok'));
        if (yeniGeldi && !hareketAz()) yuva.classList.add('gel');
      } else {
        yuva.setAttribute('aria-label', 'Parça ' + (y + 1) + ' kullanıldı');
      }
    });
  }

  function skorGoster(hedef, animasyonlu) {
    if (skorAnimasyonu) cancelAnimationFrame(skorAnimasyonu);
    if (!animasyonlu || hareketAz() || hedef <= gosterilenSkor) {
      gosterilenSkor = hedef;
      skorEl.textContent = hedef;
      return;
    }
    var bas = gosterilenSkor, t0 = performance.now(), sure = 420;
    yeniden(skorEl, 'zipla');
    function adim(t) {
      var k = Math.min(1, (t - t0) / sure);
      gosterilenSkor = Math.round(bas + (hedef - bas) * (1 - Math.pow(1 - k, 3)));
      skorEl.textContent = gosterilenSkor;
      if (k < 1) skorAnimasyonu = requestAnimationFrame(adim);
    }
    skorAnimasyonu = requestAnimationFrame(adim);
  }

  function hudCiz(animasyonlu) {
    skorGoster(durum.puan, animasyonlu);
    var enIyi = Math.max(Depo.oku(enIyiAnahtari(), 0), durum.puan);
    enIyiEl.textContent = enIyi;
    enIyiEtiket.textContent = mod === 'gunluk' ? 'Günlük en iyi' : 'En iyi';
    enIyiKutu.classList.toggle('rekor', eskiEnIyi > 0 && durum.puan > eskiEnIyi);
    var oncekiSeri = seriRozeti.hidden ? 0 : Number(seriRozeti.dataset.seri || 0);
    if (durum.seri >= 2) {
      seriRozeti.hidden = false;
      seriRozeti.dataset.seri = durum.seri;
      seriRozeti.textContent = 'Seri ×' + durum.seri;
      if (oncekiSeri && durum.seri > oncekiSeri && animasyonlu && !hareketAz()) yeniden(seriRozeti, 'artti');
    } else {
      seriRozeti.hidden = true;
    }
    modDugmeleri.forEach(function (d) { d.setAttribute('aria-pressed', String(d.dataset.mod === mod)); });
    modBilgi.textContent = mod === 'gunluk' ? bugunMetni : '';
    yenidenDugmesi.hidden = mod === 'gunluk';
  }

  // Tahta hücre boyunu ölçer; tepsideki parçalar tahta ölçeğinin en fazla %60'ı olur ve yuvaya sığar.
  function olcuGuncelle() {
    var r0 = hucreler[0].getBoundingClientRect();
    var r1 = hucreler[1].getBoundingClientRect();
    olcu.hucre = r0.width;
    olcu.adim = r1.left - r0.left;
    olcu.aralik = olcu.adim - olcu.hucre;
    var tepsiR = tepsiEl.getBoundingClientRect();
    var tc;
    if (genisEkran()) {
      var yuvaYuk = (tahtaKap.getBoundingClientRect().height - 16) / 3;
      tc = Math.min(olcu.hucre * 0.6, (yuvaYuk - 14) / 5.3, (tepsiR.width - 14) / 5.3);
    } else {
      tc = Math.min(olcu.hucre * 0.6, ((tepsiR.width - 16) / 3 - 12) / 5.3);
    }
    olcu.tc = Math.max(10, Math.floor(tc));
    kok.style.setProperty('--tc', olcu.tc + 'px');
    kok.style.setProperty('--aralik', '2px');
  }

  function ciz(yeniGeldi) {
    tahtaCiz();
    tepsiCiz(yeniGeldi);
    hudCiz(false);
    tahtaKap.classList.toggle('bitti', durum.bitti);
  }

  // ---------- Efektler ----------
  function hucreKonumu(i) {
    var h = hucreler[i];
    return { x: h.offsetLeft, y: h.offsetTop, w: h.offsetWidth };
  }

  function efektEkle(el, sure) {
    efektler.append(el);
    setTimeout(function () { el.remove(); }, sure);
  }

  function firinla(sonuc, puan) {
    if (hareketAz()) return;
    var sira = {};
    sonuc.satirlar.forEach(function (r) { for (var c = 0; c < N; c++) sira[r * N + c] = Math.min(sira[r * N + c] == null ? 99 : sira[r * N + c], c); });
    sonuc.sutunlar.forEach(function (c) { for (var r = 0; r < N; r++) sira[r * N + c] = Math.min(sira[r * N + c] == null ? 99 : sira[r * N + c], r); });
    var topX = 0, topY = 0;
    sonuc.temizlenen.forEach(function (h) {
      var k = hucreKonumu(h.dizin);
      var el = document.createElement('div');
      el.className = 'firin r-' + h.renk;
      el.style.cssText = 'left:' + k.x + 'px;top:' + k.y + 'px;width:' + k.w + 'px;height:' + k.w + 'px;animation-delay:' + sira[h.dizin] * TEMIZLEME_ARALIK + 'ms';
      efektEkle(el, 480);
      topX += k.x + k.w / 2;
      topY += k.y + k.w / 2;
    });
    var n = sonuc.temizlenen.length;
    var ucan = document.createElement('div');
    ucan.className = 'ucan-puan';
    ucan.textContent = '+' + (puan.cizgiPuani + puan.bonus);
    ucan.style.left = (topX / n) + 'px';
    ucan.style.top = (topY / n) + 'px';
    efektEkle(ucan, 470);
  }

  function ortaYazi(baslik, alt) {
    var el = document.createElement('div');
    el.className = 'kombo-yazi';
    el.textContent = baslik;
    if (alt) {
      var k = document.createElement('small');
      k.textContent = alt;
      el.append(k);
    }
    efektEkle(el, hareketAz() ? 900 : 470);
  }

  // ---------- Hamle ----------
  function hamleYap(yuva, satir, sutun) {
    var h = M.hamleUygula(durum, yuva, satir, sutun);
    if (!h) return false;
    durum = h.durum;
    var bosaldi = !durum.tepsi.some(Boolean);
    if (bosaldi) durum = M.tepsiDoldur(durum, mod, { gunNo: gunNo, rastgele: Math.random });
    secimBitir();
    kaydet();
    tahtaCiz();
    if (!hareketAz()) {
      h.sonuc.konan.forEach(function (i) { if (durum.tahta[i] >= 0) yeniden(hucreler[i], 'otur'); });
    }
    var cizgi = h.sonuc.cizgi;
    if (cizgi > 0) {
      firinla(h.sonuc, h.puan);
      if (h.sonuc.tertemiz) ortaYazi('Tertemiz', '+' + M.TERTEMIZ_BONUS);
      else if (cizgi >= 2) ortaYazi('Kombo ×' + cizgi, durum.seri >= 2 ? 'Seri ×' + durum.seri : '');
      sesCal('temizle', cizgi, durum.seri);
      if (h.sonuc.tertemiz) sesCal('tertemiz');
      if (navigator.vibrate) navigator.vibrate(cizgi >= 2 ? [12, 40, 18] : 14);
    } else {
      sesCal('koy');
      if (navigator.vibrate) navigator.vibrate(6);
    }
    hudCiz(true);
    tepsiCiz(bosaldi);
    if (eskiEnIyi > 0 && durum.puan > eskiEnIyi && !rekorDuyuruldu) {
      rekorDuyuruldu = true;
      mesaj.textContent = 'Yeni rekor! Devam et.';
    } else if (cizgi > 0) {
      mesaj.textContent = cizgi === 1 ? '1 çizgi fırınlandı.' : cizgi + ' çizgi birden fırınlandı.';
    } else {
      mesaj.textContent = '';
    }
    if (durum.bitti) oyunBitti();
    return true;
  }

  function oyunBitti() {
    if (mod === 'gunluk') {
      var gecmis = Depo.oku('cini:gunluk-gecmis', {});
      gecmis[bugunAnahtar] = { puan: durum.puan, cizgi: durum.cizgi };
      Depo.yaz('cini:gunluk-gecmis', gecmis);
    }
    mesaj.textContent = 'Yer kalmadı. Hiçbir parça sığmıyor.';
    tahtaKap.classList.add('bitti');
    yuvalar.forEach(function (y) { if (!y.classList.contains('bos') && !hareketAz()) yeniden(y, 'titre'); });
    sesCal('bitti');
    setTimeout(function () { sonucGoster(); }, hareketAz() ? 300 : 1000);
  }

  function sonucGoster() {
    var gunluk = mod === 'gunluk';
    var enIyi = Math.max(Depo.oku(enIyiAnahtari(), 0), durum.puan);
    document.getElementById('sonuc-ust').textContent = gunluk ? 'Günlük · ' + bugunMetni : 'Yer kalmadı';
    document.getElementById('sonuc-baslik').textContent = gunluk ? 'Bugünkü sonucun' : 'Oyun bitti';
    document.getElementById('sonuc-puan').textContent = durum.puan;
    document.getElementById('sonuc-cizgi').textContent = durum.cizgi;
    document.getElementById('sonuc-en-iyi').textContent = enIyi;
    document.getElementById('rekor-damga').hidden = !(eskiEnIyi > 0 && durum.puan > eskiEnIyi);
    document.getElementById('sonuc-not').textContent = gunluk
      ? 'Yarın yeni bir parça dizisi seni bekliyor.'
      : (durum.puan > eskiEnIyi && eskiEnIyi > 0 ? 'Eski rekorun ' + eskiEnIyi + ' puandı.' : 'Bir el daha?');
    document.getElementById('paylas').hidden = !gunluk;
    document.getElementById('klasik-oyna').hidden = !gunluk;
    document.getElementById('tekrar').hidden = gunluk;
    document.getElementById('tum-oyunlar').hidden = gunluk;
    if (!sonucDialog.open && typeof sonucDialog.showModal === 'function') {
      sonucDialog.showModal();
      sonucDialog.focus(); // ilk düğmeye odak halkası düşmesin; Tab ile düğmelere geçilir
    }
  }

  // ---------- Seçim: klavye ve dokun-bırak ----------
  function secimBaslat(yuva) {
    var p = durum.tepsi[yuva];
    if (!p || durum.bitti) return;
    secimBitir();
    var s = M.sekil(p.sekil);
    var yer = M.ilkYer(durum.tahta, p.sekil) || { satir: 0, sutun: 0 };
    secim = { yuva: yuva, satir: yer.satir, sutun: yer.sutun };
    yuvalar[yuva].classList.add('secili');
    tahtaKap.classList.add('secili');
    onizlemeGoster(p, secim.satir, secim.sutun);
    mesaj.textContent = s.hucreler.length + ' kareli parça seçildi. Tahtada bir kareye dokun ya da ok tuşlarıyla taşıyıp Enter\'a bas.';
  }

  function secimBitir() {
    if (secim && yuvalar[secim.yuva]) yuvalar[secim.yuva].classList.remove('secili');
    secim = null;
    tahtaKap.classList.remove('secili');
    onizlemeTemizle();
  }

  function secimTasi(satir, sutun) {
    var s = M.sekil(durum.tepsi[secim.yuva].sekil);
    secim.satir = Math.max(0, Math.min(N - s.boy, satir));
    secim.sutun = Math.max(0, Math.min(N - s.en, sutun));
    onizlemeGoster(durum.tepsi[secim.yuva], secim.satir, secim.sutun);
  }

  function secimiBirak() {
    if (!secim) return;
    var y = secim.yuva;
    if (!hamleYap(y, secim.satir, secim.sutun)) {
      sesCal('hata');
      mesaj.textContent = 'Buraya sığmıyor.';
      if (!hareketAz()) yeniden(yuvalar[y], 'titre');
    }
  }

  // Dokunulan hücre parçanın ortasına denk gelecek biçimde sol üst köşeyi bulur.
  function hucredenKonum(i) {
    var s = M.sekil(durum.tepsi[secim.yuva].sekil);
    return { satir: Math.floor(i / N) - Math.floor((s.boy - 1) / 2), sutun: (i % N) - Math.floor((s.en - 1) / 2) };
  }

  tahtaEl.addEventListener('click', function (olay) {
    if (!secim) return;
    var h = olay.target.closest('.hucre');
    if (!h) return;
    var k = hucredenKonum(Number(h.dataset.i));
    secimTasi(k.satir, k.sutun);
    secimiBirak();
  });
  tahtaEl.addEventListener('pointermove', function (olay) {
    if (!secim || surukleme || olay.pointerType !== 'mouse') return;
    var h = olay.target.closest('.hucre');
    if (!h) return;
    var k = hucredenKonum(Number(h.dataset.i));
    if (k.satir !== secim.satir || k.sutun !== secim.sutun) secimTasi(k.satir, k.sutun);
  });

  // ---------- Sürükle-bırak (fare, dokunmatik, kalem) ----------
  function ucanKonum(x, y) {
    var w = surukleme.genislik, h = surukleme.yukseklik;
    return { sol: x - w / 2, ust: surukleme.dokunma ? y - PARMAK_USTU - h : y - h / 2 };
  }

  function surukle(x, y) {
    var k = ucanKonum(x, y);
    surukleme.el.style.transform = 'translate(' + k.sol + 'px,' + k.ust + 'px)';
    var o = hucreler[0].getBoundingClientRect();
    var sutun = Math.round((k.sol - o.left) / olcu.adim);
    var satir = Math.round((k.ust - o.top) / olcu.adim);
    if (satir === surukleme.satir && sutun === surukleme.sutun) return;
    surukleme.satir = satir;
    surukleme.sutun = sutun;
    surukleme.gecerli = onizlemeGoster(durum.tepsi[surukleme.yuva], satir, sutun);
  }

  function suruklemeBitir(birak) {
    var s = surukleme;
    surukleme = null;
    document.removeEventListener('pointermove', hareketDinle);
    document.removeEventListener('pointerup', birakDinle);
    document.removeEventListener('pointercancel', iptalDinle);
    var yuvaEl = yuvalar[s.yuva];
    if (!s.hareket && birak) {
      s.el.remove();
      yuvaEl.classList.remove('tasiniyor');
      onizlemeTemizle();
      if (secim && secim.yuva === s.yuva) secimBitir();
      else secimBaslat(s.yuva);
      return;
    }
    if (birak && s.gecerli && hamleYap(s.yuva, s.satir, s.sutun)) {
      s.el.remove();
      return;
    }
    onizlemeTemizle();
    if (birak && s.hareket) sesCal('hata');
    var hedef = yuvaEl.getBoundingClientRect();
    var olcek = olcu.tc / olcu.hucre;
    var sol = hedef.left + hedef.width / 2 - s.genislik / 2;
    var ust = hedef.top + hedef.height / 2 - s.yukseklik / 2;
    if (hareketAz()) {
      s.el.remove();
      yuvaEl.classList.remove('tasiniyor');
      return;
    }
    s.el.classList.add('donus');
    s.el.style.transform = 'translate(' + sol + 'px,' + ust + 'px) scale(' + olcek + ')';
    setTimeout(function () { s.el.remove(); yuvaEl.classList.remove('tasiniyor'); }, 190);
  }

  function hareketDinle(olay) {
    if (!surukleme || olay.pointerId !== surukleme.pointerId) return;
    olay.preventDefault();
    if (!surukleme.hareket && Math.hypot(olay.clientX - surukleme.x0, olay.clientY - surukleme.y0) < DOKUNMA_ESIGI) return;
    if (!surukleme.hareket) {
      surukleme.hareket = true;
      if (secim) secimBitir();
      surukleme.el.hidden = false;
      yuvalar[surukleme.yuva].classList.add('tasiniyor');
    }
    surukle(olay.clientX, olay.clientY);
  }
  function birakDinle(olay) {
    if (!surukleme || olay.pointerId !== surukleme.pointerId) return;
    if (surukleme.hareket) surukle(olay.clientX, olay.clientY);
    suruklemeBitir(true);
  }
  function iptalDinle(olay) {
    if (!surukleme || olay.pointerId !== surukleme.pointerId) return;
    suruklemeBitir(false);
  }

  tepsiEl.addEventListener('pointerdown', function (olay) {
    var yuvaEl = olay.target.closest('.yuva');
    if (!yuvaEl || surukleme || durum.bitti || (olay.pointerType === 'mouse' && olay.button !== 0)) return;
    var y = Number(yuvaEl.dataset.yuva);
    var p = durum.tepsi[y];
    if (!p) return;
    olay.preventDefault();
    sesHazirla();
    var el = document.createElement('div');
    el.className = 'ucan-parca';
    var parca = parcaEl(p, olcu.hucre, olcu.aralik);
    el.append(parca);
    el.hidden = true;
    document.body.append(el);
    var s = M.sekil(p.sekil);
    surukleme = {
      yuva: y, el: el, pointerId: olay.pointerId, dokunma: olay.pointerType !== 'mouse',
      x0: olay.clientX, y0: olay.clientY, hareket: false, satir: null, sutun: null, gecerli: false,
      genislik: s.en * olcu.hucre + (s.en - 1) * olcu.aralik, yukseklik: s.boy * olcu.hucre + (s.boy - 1) * olcu.aralik
    };
    sesCal('al');
    document.addEventListener('pointermove', hareketDinle, { passive: false });
    document.addEventListener('pointerup', birakDinle);
    document.addEventListener('pointercancel', iptalDinle);
  });
  // Klavyeyle (Enter/Boşluk) basılan yuva seçilir; fare/dokunma tıklamaları pointer olaylarıyla işlenir.
  tepsiEl.addEventListener('click', function (olay) {
    var yuvaEl = olay.target.closest('.yuva');
    if (!yuvaEl || olay.detail !== 0) return;
    var y = Number(yuvaEl.dataset.yuva);
    if (secim && secim.yuva === y) secimiBirak();
    else secimBaslat(y);
  });
  tepsiEl.addEventListener('contextmenu', function (olay) { olay.preventDefault(); });

  document.addEventListener('keydown', function (olay) {
    if (olay.ctrlKey || olay.metaKey || olay.altKey || sonucDialog.open || onayDialog.open) return;
    if (/^[123]$/.test(olay.key) && !durum.bitti) {
      var y = Number(olay.key) - 1;
      if (durum.tepsi[y]) { secimBaslat(y); yuvalar[y].focus(); }
      return;
    }
    if (!secim) return;
    var yon = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[olay.key];
    if (yon) {
      olay.preventDefault();
      secimTasi(secim.satir + yon[0], secim.sutun + yon[1]);
    } else if (olay.key === 'Enter' || olay.key === ' ') {
      olay.preventDefault();
      secimiBirak();
    } else if (olay.key === 'Escape') {
      secimBitir();
      mesaj.textContent = '';
    }
  });

  // ---------- Modlar ----------
  function klasikBaslat(yeni) {
    mod = 'klasik';
    Depo.yaz('cini:mod', mod);
    var kayit = Depo.oku('cini:klasik', null);
    durum = !yeni && M.durumGecerliMi(kayit) && !kayit.bitti
      ? kayit
      : M.tepsiDoldur(M.yeniDurum(), 'klasik', { rastgele: Math.random });
    eskiEnIyi = Depo.oku('cini:en-iyi', 0);
    rekorDuyuruldu = durum.puan > eskiEnIyi && eskiEnIyi > 0;
    if (durum.puan > eskiEnIyi) eskiEnIyi = durum.puan;
    kaydet();
    secimBitir();
    gosterilenSkor = durum.puan;
    ciz(true);
    mesaj.textContent = durum.hamle ? 'Kaldığın yerden devam.' : 'Bir parçayı tutup tahtaya sürükle.';
  }

  function gunlukBaslat() {
    mod = 'gunluk';
    Depo.yaz('cini:mod', mod);
    var kayit = Depo.oku('cini:gunluk', null);
    var bugunku = kayit && kayit.tarih === bugunAnahtar && M.durumGecerliMi(kayit.durum);
    durum = bugunku ? kayit.durum : M.tepsiDoldur(M.yeniDurum(), 'gunluk', { gunNo: gunNo });
    var gecmis = Depo.oku('cini:gunluk-gecmis', {});
    eskiEnIyi = Object.keys(gecmis).filter(function (t) { return t !== bugunAnahtar; })
      .reduce(function (en, t) { return Math.max(en, gecmis[t].puan || 0); }, 0);
    rekorDuyuruldu = true; // günlükte oyun içi rekor duyurusu yok, sonuçta damga var
    kaydet();
    secimBitir();
    gosterilenSkor = durum.puan;
    ciz(!bugunku);
    if (durum.bitti) {
      mesaj.textContent = 'Bugünün oyununu oynadın. Yarın yeni parça dizisi gelecek.';
      sonucGoster();
    } else {
      mesaj.textContent = durum.hamle ? 'Günlük oyuna kaldığın yerden devam.' : 'Bugün herkes aynı parçaları alıyor. Tek deneme!';
    }
  }

  modDugmeleri.forEach(function (d) {
    d.addEventListener('click', function () {
      if (d.dataset.mod === mod) {
        if (durum.bitti) sonucGoster();
        return;
      }
      if (d.dataset.mod === 'gunluk') gunlukBaslat();
      else klasikBaslat(false);
    });
  });

  yenidenDugmesi.addEventListener('click', function () {
    if (mod !== 'klasik') return;
    if (durum.hamle > 0 && !durum.bitti) {
      document.getElementById('onay-metin').textContent = 'Bu oyundaki ' + durum.puan + ' puan kaybolur.';
      onayDialog.returnValue = '';
      if (typeof onayDialog.showModal === 'function') onayDialog.showModal();
    } else {
      klasikBaslat(true);
    }
  });
  onayDialog.addEventListener('close', function () {
    if (onayDialog.returnValue === 'evet') klasikBaslat(true);
  });

  sesDugmesi.addEventListener('click', function () {
    sesAcik = !sesAcik;
    Depo.yaz('cini:ses', sesAcik);
    sesDugmesiCiz();
    if (sesAcik) sesCal('koy');
  });

  document.getElementById('tekrar').addEventListener('click', function () {
    sonucDialog.close();
    klasikBaslat(true);
  });
  document.getElementById('klasik-oyna').addEventListener('click', function () {
    sonucDialog.close();
    klasikBaslat(false);
  });
  document.getElementById('paylas').addEventListener('click', function () {
    var metin = M.paylasimMetni(bugun, durum.puan, durum.cizgi);
    var not = document.getElementById('sonuc-not');
    var goster = function () { not.textContent = metin; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(metin).then(function () { not.textContent = 'Sonuç panoya kopyalandı.'; }, goster);
    } else {
      goster();
    }
  });

  var boyutZamanlayici = null;
  window.addEventListener('resize', function () {
    clearTimeout(boyutZamanlayici);
    boyutZamanlayici = setTimeout(function () { olcuGuncelle(); tepsiCiz(false); }, 80);
  });

  tahtaKur();
  sesDugmesiCiz();
  olcuGuncelle();
  if (Depo.oku('cini:mod', 'klasik') === 'gunluk') gunlukBaslat();
  else klasikBaslat(false);
  // Yazı tipi yüklenince yerleşim değişebilir; ölçüleri tazele.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { olcuGuncelle(); tepsiCiz(false); });
})();
