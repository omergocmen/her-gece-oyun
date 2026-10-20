// Pasyans arayüzü: DOM kartları, sürükle-bırak, dokunarak taşıma, klavye, geri al, ipucu, günlük deste, kazanma şelalesi.
(function () {
  'use strict';
  var M = PasyansMantik;
  var SUTUN = M.SUTUN_SAYISI;
  var SURUKLEME_ESIGI = 7; // bundan az kayan basış sürükleme değil, dokunuştur
  var CIFT_DOKUNUS = 420; // ms
  var SVG_AD = 'http://www.w3.org/2000/svg';

  function $(id) { return document.getElementById(id); }
  var masa = $('masa');
  var mesajEl = $('mesaj');
  var sonucDialog = $('sonuc');
  var onayDialog = $('onay');
  var modDugmeleri = Array.prototype.slice.call(document.querySelectorAll('.mod-secimi [data-mod]'));
  var otoDugme = $('oto-temel');
  var cekilisDugme = $('cekilis');
  var geriDugme = $('geri-al');
  var yeniDugme = $('yeni-el');

  var bugun = new Date();
  var bugunAnahtar = M.tarihAnahtari(bugun);

  function hareketAz() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ---------- Durum ----------
  var ayar = Depo.oku('pasyans:ayar', {}) || {};
  var cekilisAyar = ayar.cekilis === 3 ? 3 : 1;
  var otoTemel = ayar.oto !== false;
  var mod = ayar.mod === 'gunluk' ? 'gunluk' : 'serbest';
  var ist = Object.assign({ oynanan: 0, kazanilan: 0, seri: 0, enIyiSeri: 0, enIyiSure: null, enAzHamle: null }, Depo.oku('pasyans:istatistik', {}) || {});

  var durum = null;
  var sureMs = 0, sureBasi = 0;
  var sayildi = false; // ilk hamle yapıldı mı (istatistikte oynanan sayılır)
  var bitti = false;
  var kilitli = false; // animasyonlu zincir sürerken girdi alınmaz
  var gunlukDeneme = null;
  var secim = null, onizleme = null;
  var ipucu = null, ipucuNo = 0, ipucuZamani = 0;
  var imlec = { p: 6, c: -1 };
  var klavyeAcik = false;
  var sonDokunus = { k: -1, t: 0 };
  var onayEylemi = null;
  var K = {}; // kart -> konum bilgisi
  var kartEl = [];
  var yuvaEl = {};
  var zGeciciler = {};
  var L = {};

  function ayarKaydet() { Depo.yaz('pasyans:ayar', { cekilis: cekilisAyar, oto: otoTemel, mod: mod }); }
  function istKaydet() { Depo.yaz('pasyans:istatistik', ist); ozetGuncelle(); istatistikCiz(); }

  function ozetGuncelle() {
    var m = '';
    if (ist.kazanilan) m = ist.seri >= 2 ? 'Seri ' + ist.seri : ist.kazanilan + ' galibiyet';
    else if (ist.oynanan) m = ist.oynanan + ' el';
    Depo.ozetYaz('pasyans', m);
  }
  function istatistikCiz() {
    var oran = ist.oynanan ? Math.round(ist.kazanilan * 100 / ist.oynanan) : 0;
    var p = ['Oynanan ' + ist.oynanan, 'Kazanma %' + oran, 'Seri ' + ist.seri];
    if (ist.enIyiSure != null) p.push('En iyi ' + M.sureBicim(ist.enIyiSure));
    $('istatistik').textContent = p.join(' · ');
  }

  // Ortak günlük kayıt yardımcısı (başka bir yerde yüklenir); yoksa sessizce atlanır.
  function gunlukBildir(durumAd, ozet) {
    try {
      if (window.Gunluk && typeof window.Gunluk.kaydet === 'function') window.Gunluk.kaydet('pasyans', { durum: durumAd, ozet: ozet });
    } catch (e) { /* ortak yardımcı hata verse de oyun sürer */ }
  }

  function mesaj(metin) { mesajEl.textContent = metin || ''; }

  // ---------- Süre ----------
  function sureBaslat() { if (!sureBasi && sayildi && !bitti && !document.hidden) sureBasi = performance.now(); }
  function sureDurdur() { if (sureBasi) { sureMs += performance.now() - sureBasi; sureBasi = 0; } }
  function sureSimdi() { return sureMs + (sureBasi ? performance.now() - sureBasi : 0); }
  function sureCiz() { $('sure').textContent = M.sureBicim(sureSimdi()); }
  setInterval(sureCiz, 500);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { sureDurdur(); kaydet(); } else sureBaslat();
  });
  window.addEventListener('pagehide', function () { sureDurdur(); kaydet(); });

  // ---------- Kayıt ----------
  function kaydet() {
    if (!durum) return;
    var s = { durum: durum, sure: Math.round(sureSimdi()), sayildi: sayildi, bitti: bitti };
    if (mod === 'gunluk') {
      s.tarih = bugunAnahtar; s.deneme = gunlukDeneme;
      Depo.yaz('pasyans:gunluk', s);
    } else {
      Depo.yaz('pasyans:serbest', bitti ? null : s);
    }
  }

  // ---------- Sahne kurulumu ----------
  function sembolOlustur(t) {
    var svg = document.createElementNS(SVG_AD, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(SVG_AD, 'use');
    u.setAttribute('href', '#s' + t);
    svg.appendChild(u);
    return svg;
  }

  function yuvaYap(anahtar, sinif, ic) {
    var e = document.createElement('div');
    e.className = 'yuva ' + sinif;
    e.dataset.yuva = anahtar;
    if (ic) e.appendChild(ic);
    masa.appendChild(e);
    yuvaEl[anahtar] = e;
  }

  function sahneKur() {
    yuvaYap('stok', 'stok-yuva', (function () {
      var svg = document.createElementNS(SVG_AD, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      var p = document.createElementNS(SVG_AD, 'path');
      p.setAttribute('d', 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5');
      svg.appendChild(p);
      return svg;
    })());
    yuvaYap('atik', 'atik-yuva');
    for (var t = 0; t < 4; t++) yuvaYap('t' + t, 'temel-yuva', sembolOlustur(t));
    for (var c = 0; c < SUTUN; c++) {
      var h = document.createElement('span');
      h.textContent = 'K';
      h.setAttribute('aria-hidden', 'true');
      yuvaYap('s' + c, 'sutun-yuva', h);
    }
    for (var k = 0; k < 52; k++) {
      var e = document.createElement('div');
      e.className = 'kart' + (M.kirmizi(k) ? ' kirmizi' : '');
      e.dataset.k = k;
      var tp = M.tip(k);
      e.innerHTML = '<div class="yuz"><span class="kose"><b>' + M.isaret(k) + '</b></span></div><div class="arka"></div>';
      e.querySelector('.kose').appendChild(sembolOlustur(tp));
      var orta = sembolOlustur(tp);
      orta.setAttribute('class', 'orta');
      e.querySelector('.yuz').appendChild(orta);
      masa.appendChild(e);
      kartEl.push(e);
    }
  }

  // ---------- Yerleşim ----------
  function olc() {
    var W = masa.clientWidth || 340;
    var kucuk = W < 460;
    var aralik = kucuk ? 3 : 12;
    var kw = Math.min(84, Math.floor(((W - 6 * aralik) / SUTUN) * 2) / 2);
    var kh = Math.round(kw * 1.4);
    L.W = W; L.kucuk = kucuk; L.aralik = aralik; L.kw = kw; L.kh = kh;
    L.x0 = Math.max(0, (W - (SUTUN * kw + (SUTUN - 1) * aralik)) / 2);
    L.satirAraligi = kucuk ? 10 : 18;
    L.sutunY = kh + L.satirAraligi;
    L.adimK = kucuk ? 6 : 9;
    L.adimAMax = Math.round(kucuk ? kh * 0.32 : kh * 0.26);
    L.adimAMin = kucuk ? 16 : 22;
    L.yelpaze = Math.round(kw * (kucuk ? 0.28 : 0.24));
    L.kapasite = Math.max(kh * 5.2, window.innerHeight - kh - 220);
    masa.style.setProperty('--kw', kw + 'px');
    masa.style.setProperty('--kh', kh + 'px');
    masa.style.setProperty('--r', Math.round(kw * 0.11) + 'px');
    masa.style.setProperty('--fk', Math.min(24, Math.round(kw * (kucuk ? 0.29 : 0.3) * 10) / 10) + 'px');
  }
  function sx(c) { return L.x0 + c * (L.kw + L.aralik); }

  // Her kartın ekran konumu ve rolü.
  function konumlar(d) {
    var P = {};
    d.stok.forEach(function (k, s) { P[k] = { x: sx(0), y: 0, z: s + 1, acik: false, yer: 'stok', i: 0 }; });
    var ga = d.atik.length, yel = d.cekilis === 3 ? 3 : 1;
    d.atik.forEach(function (k, s) {
      P[k] = { x: sx(1) + Math.max(0, s - (ga - yel)) * L.yelpaze, y: 0, z: s + 1, acik: true, yer: 'atik', i: 0, n: 1, tasinabilir: s === ga - 1 };
    });
    d.temel.forEach(function (t, ti) {
      t.forEach(function (k, s) { P[k] = { x: sx(3 + ti), y: 0, z: s + 1, acik: true, yer: 'temel', i: ti, n: 1, tasinabilir: s === t.length - 1 }; });
    });
    var enUzun = L.kh;
    d.sutun.forEach(function (sc, ci) {
      var y = L.sutunY, x = sx(ci), z = 10;
      var kap = sc.kapali.length, ac = sc.acik.length;
      var adimA = L.adimAMax;
      if (ac > 1) adimA = Math.max(L.adimAMin, Math.min(L.adimAMax, (L.kapasite - L.kh - kap * L.adimK) / (ac - 1)));
      sc.kapali.forEach(function (k) { P[k] = { x: x, y: y, z: z++, acik: false, yer: 'sutun', i: ci }; y += L.adimK; });
      sc.acik.forEach(function (k, j) {
        P[k] = { x: x, y: y, z: z++, acik: true, yer: 'sutun', i: ci, n: ac - j, tasinabilir: true, ust: j === ac - 1 };
        if (j < ac - 1) y += adimA;
      });
      if (ac) y += L.kh; else if (kap) y += L.kh - L.adimK;
      enUzun = Math.max(enUzun, y - L.sutunY);
    });
    P.yukseklik = L.sutunY + enUzun + 6;
    return P;
  }

  function yuvalariKonumla() {
    var konum = { stok: [sx(0), 0], atik: [sx(1), 0] };
    for (var t = 0; t < 4; t++) konum['t' + t] = [sx(3 + t), 0];
    for (var c = 0; c < SUTUN; c++) konum['s' + c] = [sx(c), L.sutunY];
    Object.keys(konum).forEach(function (a) {
      yuvaEl[a].style.transform = 'translate3d(' + konum[a][0] + 'px,' + konum[a][1] + 'px,0)';
    });
  }

  // ---------- İşaretler (seçim, hedef, ipucu, klavye imleci) ----------
  function hedefAnahtari(durumu, h) {
    if (!h) return null;
    if (h.yer === 'temel') {
      var t = durumu.temel[h.i];
      return t.length ? { kart: t[t.length - 1] } : { yuva: 't' + h.i };
    }
    var a = durumu.sutun[h.i].acik;
    return a.length ? { kart: a[a.length - 1] } : { yuva: 's' + h.i };
  }

  var PILE = ['stok', 'atik', 't0', 't1', 't2', 't3', 's0', 's1', 's2', 's3', 's4', 's5', 's6'];
  function imlecHedefi() {
    var a = PILE[imlec.p];
    if (a === 'stok') return durum.stok.length ? { kart: durum.stok[durum.stok.length - 1] } : { yuva: 'stok' };
    if (a === 'atik') return durum.atik.length ? { kart: durum.atik[durum.atik.length - 1] } : { yuva: 'atik' };
    if (a[0] === 't') { var t = durum.temel[+a[1]]; return t.length ? { kart: t[t.length - 1] } : { yuva: a }; }
    var sc = durum.sutun[+a[1]];
    if (!sc.acik.length) return { yuva: a };
    var c = imlec.c < 0 || imlec.c >= sc.acik.length ? sc.acik.length - 1 : imlec.c;
    return { kart: sc.acik[c] };
  }

  function isaretKumeleri() {
    var s = { secili: {}, hedef: {}, ipucu: {}, imlec: {} };
    var yuvaH = { hedef: {}, ipucu: {}, imlec: {} };
    if (secim) {
      (M.kaynakKartlar(durum, secim) || []).forEach(function (k) { s.secili[k] = true; });
      var ha = hedefAnahtari(durum, onizleme);
      if (ha) { if (ha.kart != null) s.hedef[ha.kart] = true; else yuvaH.hedef[ha.yuva] = true; }
    }
    if (ipucu) {
      if (ipucu.tip === 'cek') yuvaH.ipucu.stok = true;
      else {
        (M.kaynakKartlar(durum, ipucu.kaynak) || []).forEach(function (k) { s.ipucu[k] = true; });
        var hb = hedefAnahtari(durum, ipucu.hedef);
        if (hb) { if (hb.kart != null) s.ipucu[hb.kart] = true; else yuvaH.ipucu[hb.yuva] = true; }
      }
    }
    if (klavyeAcik) {
      var ih = imlecHedefi();
      if (ih.kart != null) s.imlec[ih.kart] = true; else yuvaH.imlec[ih.yuva] = true;
    }
    s.yuva = yuvaH;
    return s;
  }

  // ---------- Çizim ----------
  function ciz() {
    var P = konumlar(durum);
    var isr = isaretKumeleri();
    for (var k = 0; k < 52; k++) {
      var e = kartEl[k], p = P[k], o = K[k];
      e.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)';
      var tasindi = o && (o.yer !== p.yer || o.i !== p.i);
      if (tasindi && !hareketAz()) { zGeciciler[k] = true; (function (kk) { setTimeout(function () { delete zGeciciler[kk]; kartEl[kk].style.zIndex = K[kk] ? K[kk].z : 0; }, 280); })(k); }
      e.style.zIndex = p.z + (zGeciciler[k] ? 300 : 0);
      if (o && !o.acik && p.acik && !hareketAz()) { e.classList.remove('cevir'); void e.offsetWidth; e.classList.add('cevir'); }
      e.classList.toggle('acik', p.acik);
      e.classList.toggle('tasinabilir', !!p.tasinabilir && !bitti);
      e.classList.toggle('secili', !!isr.secili[k]);
      e.classList.toggle('hedef', !!isr.hedef[k]);
      e.classList.toggle('ipucu', !!isr.ipucu[k]);
      e.classList.toggle('imlec', !!isr.imlec[k]);
      if (p.acik) { e.setAttribute('aria-label', M.kartAdi(k)); e.setAttribute('role', 'img'); e.removeAttribute('aria-hidden'); }
      else { e.removeAttribute('aria-label'); e.removeAttribute('role'); e.setAttribute('aria-hidden', 'true'); }
    }
    K = P;
    masa.style.height = Math.ceil(P.yukseklik) + 'px';
    Object.keys(yuvaEl).forEach(function (a) {
      var e = yuvaEl[a];
      e.classList.toggle('hedef', !!isr.yuva.hedef[a]);
      e.classList.toggle('ipucu', !!isr.yuva.ipucu[a]);
      e.classList.toggle('imlec', !!isr.yuva.imlec[a]);
    });
    yuvaEl.stok.classList.toggle('devre', !durum.stok.length && !M.cekebilirMi(durum));
    hudCiz();
  }

  function hudCiz() {
    sureCiz();
    $('hamle').textContent = durum.hamle;
    var cd = durum.cekilis + (durum.turSiniri ? ' · tur ' + Math.min(durum.tur, durum.turSiniri) + '/' + durum.turSiniri : '');
    $('cekilis-deger').textContent = cd;
    cekilisDugme.setAttribute('aria-label', 'Çekiliş: ' + durum.cekilis + ' kart' + (mod === 'serbest' ? '. Değiştirmek için dokun.' : '.'));
    cekilisDugme.disabled = mod !== 'serbest';
    $('gunluk-rozet').hidden = mod !== 'gunluk';
    $('dogrulandi').hidden = !durum.dogrulandi || mod === 'gunluk';
    geriDugme.disabled = !durum.gecmis.length || kilitli || bitti;
    yeniDugme.textContent = mod === 'gunluk' ? 'Baştan' : 'Yeni el';
    yeniDugme.disabled = mod === 'gunluk' && bitti;
    $('ipucu').disabled = bitti;
    otoDugme.setAttribute('aria-pressed', String(otoTemel));
    modDugmeleri.forEach(function (d) { d.setAttribute('aria-pressed', String(d.dataset.mod === mod)); });
    panelCiz();
  }

  function panelCiz() {
    var panel = $('panel');
    var gunlukBitti = mod === 'gunluk' && bitti;
    var takildi = !bitti && !kilitli && !M.hamleVarMi(durum);
    panel.hidden = !(gunlukBitti || takildi);
    if (panel.hidden) return;
    $('panel-baslik').textContent = gunlukBitti ? 'Bugün tamamlandı' : 'Hamle kalmadı';
    $('panel-metin').textContent = gunlukBitti
      ? M.ozetMetni(Depo.oku('pasyans:gunluk', {}).sure || 0, durum.hamle) + '. Yarın yeni bir deste gelecek.'
      : 'Geri alıp başka bir yol dene ya da yeni bir el başlat.';
    $('panel-geri').hidden = gunlukBitti;
    $('panel-yeni').hidden = gunlukBitti;
    $('panel-yeni').textContent = mod === 'gunluk' ? 'Baştan' : 'Yeni el';
    $('panel-paylas').hidden = !gunlukBitti;
  }

  // ---------- Seçim ve ipucu ----------
  function secimTemizle() { secim = null; onizleme = null; }
  function ipucuTemizle() { ipucu = null; ipucuNo = 0; }

  function sec(kaynak) {
    secim = kaynak;
    onizleme = M.enIyiHedef(durum, kaynak);
    var k = M.kaynakKartlar(durum, kaynak)[0];
    mesaj(onizleme ? M.kartAdi(k) + ' seçildi. Taşımak için tekrar dokun.' : M.kartAdi(k) + ' için uygun hedef yok.');
    ciz();
  }

  function ipucuGoster() {
    if (kilitli || bitti) return;
    secimTemizle();
    var liste = M.ipuclari(durum);
    if (!liste.length) { mesaj('Hamle kalmadı.'); ciz(); return; }
    ipucu = liste[ipucuNo % liste.length];
    ipucuNo++;
    mesaj('İpucu: ' + M.hamleMetni(durum, ipucu));
    ciz();
    var damga = ++ipucuZamani;
    setTimeout(function () { if (damga === ipucuZamani && ipucu) { ipucu = null; ciz(); } }, 3600);
  }

  // ---------- Hamle uygulama ----------
  function sallat(yer, i) {
    if (hareketAz()) return;
    var kartlar = [];
    if (yer === 'sutun') kartlar = durum.sutun[i].kapali.concat(durum.sutun[i].acik);
    else if (yer === 'atik') kartlar = durum.atik.slice(-3);
    kartlar.forEach(function (k) {
      var e = kartEl[k];
      e.classList.remove('salla'); void e.offsetWidth; e.classList.add('salla');
      setTimeout(function () { e.classList.remove('salla'); }, 330);
    });
    if (yer === 'sutun' && !kartlar.length) {
      var y = yuvaEl['s' + i];
      y.classList.remove('hedef');
    }
  }

  function yap(h) {
    if (kilitli || bitti) return false;
    var n = M.hamleYap(durum, h);
    if (!n) return false;
    durum = n;
    secimTemizle(); ipucuTemizle(); ipucuZamani++;
    if (!sayildi) {
      sayildi = true; ist.oynanan++; istKaydet();
      if (mod === 'gunluk') gunlukBildir('yarim', 'Devam ediyor');
    }
    sureBaslat();
    mesaj('');
    ciz();
    kaydet();
    zincir();
    return true;
  }

  // Hamleden sonra: otomatik temel, otomatik bitirme, kazanma denetimi.
  function zincir() {
    if (M.kazandiMi(durum)) { kazandi(); return; }
    var hizli = hareketAz();
    var h = otoTemel ? M.otoTemelHamle(durum) : null;
    if (h) {
      kilitli = true;
      setTimeout(function () {
        var n = M.otoUygula(durum, h);
        if (n) { durum = n; ciz(); kaydet(); }
        zincir();
      }, hizli ? 0 : 90);
      return;
    }
    var dizi = M.bitirDizisi(durum);
    if (dizi && dizi.length) {
      kilitli = true;
      mesaj('Kalan kartlar temele gidiyor…');
      var i = 0;
      (function adim() {
        var n = i < dizi.length ? M.otoUygula(durum, dizi[i]) : null;
        i++;
        if (n) { durum = n; ciz(); }
        if (M.kazandiMi(durum) || !n) { kaydet(); kilitli = false; if (M.kazandiMi(durum)) kazandi(); else ciz(); return; }
        setTimeout(adim, hizli ? 0 : 60);
      })();
      return;
    }
    kilitli = false;
    ciz();
    kaydet();
  }

  function cek() {
    if (!M.cekebilirMi(durum)) {
      mesaj(durum.turSiniri ? 'Deste en fazla ' + durum.turSiniri + ' kez çevrilebilir.' : 'Çekilecek kart yok.');
      return;
    }
    yap({ tip: 'cek' });
  }

  function geriAl() {
    if (kilitli || bitti) return;
    var n = M.geriAl(durum);
    if (!n) return;
    durum = n;
    secimTemizle(); ipucuTemizle();
    mesaj('Hamle geri alındı.');
    ciz(); kaydet();
  }

  // ---------- Dokunma mantığı ----------
  function bilgiCoz(b) {
    // { kart } ya da { yuva } → { yer, i, kart }
    if (b.kart != null) { var p = K[b.kart]; return { yer: p.yer, i: p.i, kart: b.kart, p: p }; }
    var a = b.yuva;
    if (a === 'stok') return { yer: 'stok', i: 0 };
    if (a === 'atik') return { yer: 'atik', i: 0 };
    return { yer: a[0] === 't' ? 'temel' : 'sutun', i: +a[1] };
  }

  function kaynakOlustur(r) {
    var p = r.p;
    if (!p || !p.tasinabilir) return null;
    if (p.yer === 'sutun') return { yer: 'sutun', i: p.i, n: p.n };
    if (p.yer === 'atik') return { yer: 'atik' };
    if (p.yer === 'temel') return { yer: 'temel', i: p.i };
    return null;
  }

  function dokun(b) {
    if (kilitli || bitti) return;
    ipucuTemizle(); ipucuZamani++;
    if (!b) { if (secim) { secimTemizle(); ciz(); } return; }
    var r = bilgiCoz(b);
    if (r.yer === 'stok') { secimTemizle(); cek(); return; }
    var simdi = Date.now();
    var kaynak = r.kart != null ? kaynakOlustur(r) : null;

    // Çift dokunuş: tek kart temele gidebiliyorsa doğrudan gönder
    if (kaynak && sonDokunus.k === r.kart && simdi - sonDokunus.t < CIFT_DOKUNUS) {
      var kartlar = M.kaynakKartlar(durum, kaynak);
      if (kartlar.length === 1 && kaynak.yer !== 'temel' && M.temeleKonurMu(durum, kartlar[0])) {
        sonDokunus = { k: -1, t: 0 };
        yap({ tip: 'tasi', kaynak: kaynak, hedef: { yer: 'temel', i: M.tip(kartlar[0]) } });
        return;
      }
    }
    if (r.kart != null) sonDokunus = { k: r.kart, t: simdi };

    if (secim) {
      var ilk = M.kaynakKartlar(durum, secim)[0];
      // Aynı karta ikinci dokunuş: önizlenen hedefe taşı
      if (r.kart === ilk) {
        if (onizleme) yap({ tip: 'tasi', kaynak: secim, hedef: onizleme });
        else { sallat(secim.yer, secim.i); secimTemizle(); mesaj('Bu kart için uygun hedef yok.'); ciz(); }
        return;
      }
      // Geçerli bir hedefe dokunuldu mu?
      var hedef = null;
      if (r.yer === 'temel') hedef = { yer: 'temel', i: M.tip(ilk) };
      else if (r.yer === 'sutun' && (r.kart == null || !r.p.acik || r.p.ust)) hedef = { yer: 'sutun', i: r.i };
      if (hedef) {
        var h = { tip: 'tasi', kaynak: secim, hedef: hedef };
        if (M.hamleGecerliMi(durum, h)) { yap(h); return; }
      }
    }
    if (kaynak) { sec(kaynak); return; }
    if (secim) {
      if (r.yer === 'sutun' || r.yer === 'temel') { sallat(r.yer === 'sutun' ? 'sutun' : '', r.i); mesaj('Kart oraya konamaz.'); }
      secimTemizle();
      ciz();
    }
  }

  // ---------- Sürükle-bırak ----------
  var tut = null;

  masa.addEventListener('pointerdown', function (e) {
    if (kilitli || bitti || e.button > 0 || !e.isPrimary) return;
    klavyeAcik = false; masa.classList.remove('klavye');
    var el = e.target.closest ? e.target.closest('.kart, .yuva') : null;
    var b = null;
    if (el && el.classList.contains('kart')) b = { kart: +el.dataset.k };
    else if (el) b = { yuva: el.dataset.yuva };
    var kaynak = null;
    if (b && b.kart != null) kaynak = kaynakOlustur(bilgiCoz(b));
    tut = { id: e.pointerId, x: e.clientX, y: e.clientY, b: b, kaynak: kaynak, surukle: false };
  });

  masa.addEventListener('pointermove', function (e) {
    if (!tut || e.pointerId !== tut.id) return;
    var dx = e.clientX - tut.x, dy = e.clientY - tut.y;
    if (!tut.surukle) {
      if (!tut.kaynak || Math.hypot(dx, dy) < SURUKLEME_ESIGI) return;
      surukleBasla();
    }
    tut.dx = dx; tut.dy = dy; tut.ly = e.clientY;
    tut.els.forEach(function (it) {
      it.e.style.transform = 'translate3d(' + (it.x + dx) + 'px,' + (it.y + dy) + 'px,0) scale(1.04)';
    });
    e.preventDefault();
  });

  function surukleBasla() {
    tut.surukle = true;
    secimTemizle(); ipucuTemizle(); ipucuZamani++;
    ciz();
    var kartlar = M.kaynakKartlar(durum, tut.kaynak);
    tut.kartlar = kartlar;
    tut.els = kartlar.map(function (k, j) {
      var e = kartEl[k];
      e.classList.add('surukle');
      e.style.zIndex = 1000 + j;
      return { e: e, x: K[k].x, y: K[k].y };
    });
    try { masa.setPointerCapture(tut.id); } catch (x) { /* yok sayılır */ }
  }

  function surukleBitir(iptal) {
    var t = tut;
    t.els.forEach(function (it) { it.e.classList.remove('surukle'); });
    var gecerli = false;
    if (!iptal) {
      var cx = t.els[0].x + (t.dx || 0) + L.kw / 2;
      var cy = t.els[0].y + (t.dy || 0) + L.kh / 2;
      var py = t.ly != null ? t.ly - masa.getBoundingClientRect().top : cy;
      var hedef = hedefBul(cx, Math.min(cy, py), t.kaynak, t.kartlar);
      if (hedef && yap({ tip: 'tasi', kaynak: t.kaynak, hedef: hedef })) gecerli = true;
    }
    if (!gecerli) {
      // Kart 150 ms'de yerine döner, sütun hafifçe sallanır
      t.els.forEach(function (it) { it.e.style.zIndex = K[+it.e.dataset.k].z; });
      ciz();
      if (!iptal) sallat(t.kaynak.yer, t.kaynak.i);
    }
  }

  // Bırakma noktasına göre hedef: üst sıradaysa temel, değilse en yakın sütun (geçersizse komşusu).
  function hedefBul(cx, cy, kaynak, kartlar) {
    var aday = [];
    if (cy < L.sutunY - L.satirAraligi / 2 && kartlar.length === 1) {
      aday.push({ yer: 'temel', i: M.tip(kartlar[0]) });
    } else {
      var ham = (cx - L.x0 - L.kw / 2) / (L.kw + L.aralik);
      var ci = Math.max(0, Math.min(SUTUN - 1, Math.round(ham)));
      aday.push({ yer: 'sutun', i: ci });
      var komsu = ham > ci ? ci + 1 : ci - 1;
      if (komsu >= 0 && komsu < SUTUN && Math.abs(ham - ci) > 0.3) aday.push({ yer: 'sutun', i: komsu });
    }
    for (var j = 0; j < aday.length; j++) {
      if (M.hamleGecerliMi(durum, { tip: 'tasi', kaynak: kaynak, hedef: aday[j] })) return aday[j];
    }
    return null;
  }

  masa.addEventListener('pointerup', function (e) {
    if (!tut || e.pointerId !== tut.id) return;
    var t = tut;
    if (t.surukle) { surukleBitir(false); tut = null; return; }
    tut = null;
    dokun(t.b);
  });
  masa.addEventListener('pointercancel', function (e) {
    if (!tut || e.pointerId !== tut.id) return;
    if (tut.surukle) surukleBitir(true);
    tut = null;
  });
  masa.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- Klavye ----------
  function imlecKarti(a) {
    var sc = durum.sutun[+a[1]];
    return sc ? sc.acik : [];
  }
  function imlecDuyur() {
    var h = imlecHedefi();
    var a = PILE[imlec.p];
    var yerAd = a === 'stok' ? 'Deste' : a === 'atik' ? 'Atık' : a[0] === 't' ? 'Temel ' + M.TIPLER[+a[1]] : 'Sütun ' + (+a[1] + 1);
    mesaj(yerAd + (h.kart != null ? ': ' + M.kartAdi(h.kart) : ': boş'));
  }

  masa.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); geriAl(); }
      return;
    }
    var tus = e.key;
    var kucuk = tus.length === 1 ? tus.toLowerCase() : tus;
    if (!klavyeAcik) { klavyeAcik = true; masa.classList.add('klavye'); }
    var ok = true;
    if (kilitli) { e.preventDefault(); return; }
    if (tus === 'ArrowRight') { imlec.p = Math.min(PILE.length - 1, imlec.p + 1); imlec.c = -1; }
    else if (tus === 'ArrowLeft') { imlec.p = Math.max(0, imlec.p - 1); imlec.c = -1; }
    else if (tus === 'ArrowUp' || tus === 'ArrowDown') {
      var a = PILE[imlec.p];
      if (a[0] === 's') {
        var kartlar = imlecKarti(a);
        var c = imlec.c < 0 ? kartlar.length - 1 : imlec.c;
        c += tus === 'ArrowUp' ? -1 : 1;
        imlec.c = Math.max(0, Math.min(kartlar.length - 1, c));
      }
    }
    else if (tus === 'Enter' || tus === ' ') {
      var h = imlecHedefi();
      ipucuTemizle();
      dokun(h);
    }
    else if (tus === 'Escape') { secimTemizle(); ipucuTemizle(); mesaj('Seçim bırakıldı.'); }
    else if (kucuk === 'd') cek();
    else if (kucuk === 'u') geriAl();
    else if (kucuk === 'h') ipucuGoster();
    else ok = false;
    if (ok) {
      e.preventDefault();
      if (tus.indexOf('Arrow') === 0) imlecDuyur();
      ciz();
    }
  });
  masa.addEventListener('focus', function () { /* odak halkası yalnızca klavye kullanılınca görünür */ });
  masa.addEventListener('blur', function () { if (klavyeAcik) { klavyeAcik = false; masa.classList.remove('klavye'); if (durum) ciz(); } });

  // ---------- Oyun başlatma ----------
  function sifirla(d, sure, say) {
    durum = d; sureMs = sure || 0; sureBasi = 0; sayildi = !!say; bitti = false; kilitli = false;
    secimTemizle(); ipucuTemizle(); ipucuZamani++;
    selaleDurdur();
    zGeciciler = {};
  }

  function dagitAnimasyonu() {
    if (hareketAz() || durum.hamle) { K = {}; ciz(); return; }
    var P = konumlar(durum);
    K = {};
    for (var k = 0; k < 52; k++) {
      kartEl[k].style.transition = 'none';
      kartEl[k].style.transform = 'translate3d(' + sx(0) + 'px,0,0)';
    }
    void masa.offsetWidth;
    var sira = 0;
    for (var r = 0; r < SUTUN; r++) {
      for (var c = r; c < SUTUN; c++) {
        var sc = durum.sutun[c];
        var kart = r < sc.kapali.length ? sc.kapali[r] : sc.acik[0];
        kartEl[kart].style.transitionDelay = (sira++ * 22) + 'ms';
      }
    }
    for (var q = 0; q < 52; q++) kartEl[q].style.transition = '';
    kilitli = true;
    ciz();
    setTimeout(function () {
      for (var z = 0; z < 52; z++) kartEl[z].style.transitionDelay = '';
      kilitli = false;
      ciz();
    }, 28 * 22 + 320);
  }

  function serbestYukle() {
    mod = 'serbest'; ayarKaydet();
    var kayit = Depo.oku('pasyans:serbest', null);
    if (kayit && kayit.durum && M.durumGecerliMi(kayit.durum)) {
      sifirla(kayit.durum, kayit.sure, kayit.sayildi);
      cekilisAyar = kayit.durum.cekilis;
      mesaj(durum.hamle ? 'Yarım kalan el sürüyor.' : '');
      K = {}; ciz(); sureBaslat();
      zincirBekle();
    } else {
      serbestYeniEl(false);
    }
  }

  // Yüklenen eldeki otomatik bitirme/temel taşımaları sürsün diye
  function zincirBekle() {
    if (!bitti && (M.bitirDizisi(durum) || (otoTemel && M.otoTemelHamle(durum)))) zincir();
  }

  function serbestYeniEl(kaybet) {
    if (kaybet && sayildi && !bitti) { ist.seri = 0; istKaydet(); }
    mod = 'serbest'; ayarKaydet();
    var ek = cekilisAyar;
    kilitli = true;
    selaleDurdur();
    mesaj('Deste karılıyor…');
    setTimeout(function () {
      var d = M.kazanilabilirDagit(ek, ek === 3 ? 3 : null, { sureMs: 300 });
      sifirla(d, 0, false);
      mesaj('');
      olc(); yuvalariKonumla();
      dagitAnimasyonu();
      kaydet();
    }, 30);
  }

  function gunlukHazirla(sonra) {
    var onbellek = Depo.oku('pasyans:gunluk-deneme', null);
    if (onbellek && onbellek.tarih === bugunAnahtar && Number.isInteger(onbellek.deneme)) {
      var d = M.yeniEl(M.gunlukTohum(bugunAnahtar, onbellek.deneme), 1, null);
      d.dogrulandi = !!onbellek.dogrulandi;
      sonra(d, onbellek.deneme);
      return;
    }
    kilitli = true;
    mesaj('Günün destesi hazırlanıyor…');
    setTimeout(function () {
      var g = M.gunlukDagit(bugunAnahtar);
      Depo.yaz('pasyans:gunluk-deneme', { tarih: bugunAnahtar, deneme: g.deneme, dogrulandi: !!g.cozum });
      kilitli = false;
      sonra(g.durum, g.deneme);
    }, 30);
  }

  function gunlukYukle() {
    mod = 'gunluk'; ayarKaydet();
    var kayit = Depo.oku('pasyans:gunluk', null);
    if (kayit && kayit.tarih === bugunAnahtar && kayit.durum && M.durumGecerliMi(kayit.durum)) {
      gunlukDeneme = kayit.deneme;
      sifirla(kayit.durum, kayit.sure, kayit.sayildi);
      bitti = !!kayit.bitti;
      mesaj(bitti ? '' : (durum.hamle ? 'Günün destesinde kaldığın yerden devam.' : 'Bugün herkes aynı desteyi alıyor.'));
      olc(); yuvalariKonumla();
      K = {}; ciz(); sureBaslat();
      if (!bitti) zincirBekle();
      return;
    }
    gunlukHazirla(function (d, deneme) {
      gunlukDeneme = deneme;
      sifirla(d, 0, false);
      mesaj('Bugün herkes aynı desteyi alıyor.');
      olc(); yuvalariKonumla();
      dagitAnimasyonu();
      kaydet();
    });
  }

  function gunlukBastan() {
    var d = M.yeniEl(M.gunlukTohum(bugunAnahtar, gunlukDeneme), 1, null);
    d.dogrulandi = durum.dogrulandi;
    sifirla(d, 0, sayildi);
    mesaj('Günün destesi baştan dağıtıldı.');
    dagitAnimasyonu();
    kaydet();
  }

  function modDegistir(yeni) {
    if (yeni === mod || kilitli) return;
    sureDurdur(); kaydet();
    if (yeni === 'gunluk') gunlukYukle(); else serbestYukle();
  }

  // ---------- Kazanma ----------
  function kazandi() {
    if (bitti) return;
    bitti = true; kilitli = false;
    sureDurdur();
    secimTemizle(); ipucuTemizle();
    var sure = Math.round(sureMs);
    if (!sayildi) { sayildi = true; ist.oynanan++; }
    ist.kazanilan++; ist.seri++;
    ist.oynanan = Math.max(ist.oynanan, ist.kazanilan);
    ist.enIyiSeri = Math.max(ist.enIyiSeri, ist.seri);
    var rekor = false;
    var oncekiSure = ist.enIyiSure;
    if (sure >= 1000 && (oncekiSure == null || sure < oncekiSure)) { rekor = oncekiSure != null; ist.enIyiSure = sure; }
    if (durum.hamle > 0 && (ist.enAzHamle == null || durum.hamle < ist.enAzHamle)) ist.enAzHamle = durum.hamle;
    istKaydet();
    var ozet = M.ozetMetni(sure, durum.hamle);
    kaydet();
    if (mod === 'gunluk') {
      var gec = Depo.oku('pasyans:gunluk-gecmis', {}) || {};
      gec[bugunAnahtar] = { sure: sure, hamle: durum.hamle };
      Depo.yaz('pasyans:gunluk-gecmis', gec);
      gunlukBildir('bitti', ozet);
    }
    mesaj('Kazandın! ' + ozet);
    ciz();
    var hizli = hareketAz();
    if (!hizli) selale();
    setTimeout(function () { sonucGoster(rekor); }, hizli ? 0 : 1800);
  }

  function sonucGoster(rekor) {
    var sure = Math.round(sureMs);
    var oran = ist.oynanan ? Math.round(ist.kazanilan * 100 / ist.oynanan) : 0;
    $('sonuc-ust').textContent = mod === 'gunluk' ? 'Günün destesi' : (durum.cekilis === 3 ? 'Serbest · 3 kart' : 'Serbest · 1 kart');
    $('sonuc-sure').textContent = M.sureBicim(sure);
    $('sonuc-hamle').textContent = durum.hamle;
    $('sonuc-oran').textContent = '%' + oran;
    $('rekor-damga').hidden = !rekor;
    $('sonuc-not').textContent = 'Seri ' + ist.seri + ' · En iyi süre ' + (ist.enIyiSure != null ? M.sureBicim(ist.enIyiSure) : '—');
    $('sonuc-yeni').hidden = mod === 'gunluk';
    $('sonuc-paylas').hidden = mod !== 'gunluk';
    $('sonuc-serbest').hidden = mod !== 'gunluk';
    if (typeof sonucDialog.showModal === 'function') { if (!sonucDialog.open) sonucDialog.showModal(); }
    else sonucDialog.setAttribute('open', '');
    sonucDialog.focus();
  }

  function paylas(not) {
    var sure = Math.round(sureMs);
    var kayit = Depo.oku('pasyans:gunluk', {}) || {};
    var metin = M.paylasimMetni(bugun, kayit.sure || sure, durum.hamle);
    var goster = function () { if (not) not.textContent = metin; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(metin).then(function () { if (not) not.textContent = 'Sonuç panoya kopyalandı.'; }, goster);
    } else goster();
  }

  // ---------- Kart şelalesi (hareket azaltma açıkken çalışmaz) ----------
  var selaleKimlik = 0;
  function selaleDurdur() {
    selaleKimlik++;
    var cv = $('selale');
    cv.classList.remove('acik');
    var cx = cv.getContext && cv.getContext('2d');
    if (cx) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); }
  }

  function selale() {
    var cv = $('selale');
    var cx = cv.getContext('2d');
    if (!cx) return;
    var kimlik = ++selaleKimlik;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var gen = window.innerWidth, yuk = window.innerHeight;
    cv.width = Math.round(gen * dpr); cv.height = Math.round(yuk * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cv.classList.add('acik');
    var stil = getComputedStyle(document.documentElement);
    var kemik = stil.getPropertyValue('--kemik').trim() || '#e9dcc2';
    var kor = stil.getPropertyValue('--kor').trim() || '#ff6a48';
    var murekkep = stil.getPropertyValue('--murekkep').trim() || '#110f0d';
    var yollar = [0, 1, 2, 3].map(function (t) { return new Path2D(document.querySelector('#s' + t + ' path').getAttribute('d')); });
    var rect = masa.getBoundingClientRect();
    var kuyruk = [];
    for (var r = 13; r >= 1; r--) for (var t = 0; t < 4; t++) kuyruk.push(t * 13 + r - 1);
    var parcalar = [];
    var son = 0, bas = performance.now();
    var kw = L.kw, kh = L.kh;

    function kartCiz(k, x, y) {
      var kr = M.kirmizi(k);
      var renk = kr ? '#a54a35' : murekkep;
      cx.fillStyle = kemik;
      cx.beginPath();
      var rr = Math.max(4, kw * 0.1);
      cx.moveTo(x + rr, y); cx.arcTo(x + kw, y, x + kw, y + kh, rr); cx.arcTo(x + kw, y + kh, x, y + kh, rr);
      cx.arcTo(x, y + kh, x, y, rr); cx.arcTo(x, y, x + kw, y, rr); cx.closePath();
      cx.fill();
      cx.strokeStyle = 'rgba(17,15,13,.55)'; cx.lineWidth = 1; cx.stroke();
      cx.fillStyle = renk;
      cx.font = '800 ' + Math.round(kw * 0.3) + 'px sans-serif';
      cx.textBaseline = 'top';
      cx.fillText(M.isaret(k), x + kw * 0.08, y + kh * 0.04);
      cx.save();
      var s = kw * 0.4 / 24;
      cx.translate(x + kw * 0.5, y + kh * 0.5);
      cx.scale(s, s);
      cx.fill(yollar[M.tip(k)]);
      cx.restore();
    }

    function kare(simdi) {
      if (kimlik !== selaleKimlik) return;
      while (kuyruk.length && simdi - son > 140) {
        var k = kuyruk.shift();
        var tp = M.tip(k);
        parcalar.push({ k: k, x: rect.left + sx(3 + tp), y: rect.top, vx: (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 4.5), vy: -(1 + Math.random() * 4) });
        son = simdi;
      }
      parcalar = parcalar.filter(function (p) {
        p.vy += 0.5;
        p.x += p.vx; p.y += p.vy;
        var zemin = yuk - kh;
        if (p.y > zemin) { p.y = zemin; p.vy = -p.vy * 0.82; }
        kartCiz(p.k, p.x, p.y);
        return p.x > -kw && p.x < gen;
      });
      if (kuyruk.length || parcalar.length) {
        if (simdi - bas < 16000) requestAnimationFrame(kare);
      }
    }
    requestAnimationFrame(kare);
  }

  // ---------- Düğmeler ----------
  modDugmeleri.forEach(function (d) {
    d.addEventListener('click', function () { modDegistir(d.dataset.mod); });
  });
  otoDugme.addEventListener('click', function () {
    otoTemel = !otoTemel; ayarKaydet();
    if (durum) { ciz(); if (otoTemel && !bitti && !kilitli) zincir(); }
  });
  geriDugme.addEventListener('click', geriAl);
  $('ipucu').addEventListener('click', ipucuGoster);
  $('panel-geri').addEventListener('click', geriAl);

  function onayIste(baslik, metin, eylem) {
    $('onay-baslik').textContent = baslik;
    $('onay-metin').textContent = metin;
    onayEylemi = eylem;
    onayDialog.returnValue = '';
    if (typeof onayDialog.showModal === 'function') onayDialog.showModal(); else eylem();
  }
  onayDialog.addEventListener('close', function () {
    if (onayDialog.returnValue === 'evet' && onayEylemi) onayEylemi();
    onayEylemi = null;
  });

  function yeniElIste() {
    if (kilitli) return;
    if (mod === 'gunluk') {
      if (bitti) return;
      if (durum.hamle > 0) onayIste('Baştan başlansın mı?', 'Günün destesi baştan dağıtılır ve süre sıfırlanır.', gunlukBastan);
      else gunlukBastan();
      return;
    }
    if (sayildi && !bitti) onayIste('Yeni el başlasın mı?', 'Bu el yenilgi sayılır ve seri sıfırlanır.', function () { serbestYeniEl(true); });
    else serbestYeniEl(false);
  }
  yeniDugme.addEventListener('click', yeniElIste);
  $('panel-yeni').addEventListener('click', yeniElIste);

  cekilisDugme.addEventListener('click', function () {
    if (mod !== 'serbest' || kilitli) return;
    var yeni = cekilisAyar === 1 ? 3 : 1;
    var uygula = function () { cekilisAyar = yeni; ayarKaydet(); serbestYeniEl(true); };
    if (sayildi && !bitti) onayIste(yeni + ' kartlık çekiliş', 'Çekilişi değiştirmek yeni bir el başlatır; bu el yenilgi sayılır.', uygula);
    else uygula();
  });

  $('sonuc-yeni').addEventListener('click', function () { sonucDialog.close(); selaleDurdur(); serbestYeniEl(false); });
  $('sonuc-serbest').addEventListener('click', function () { sonucDialog.close(); selaleDurdur(); modDegistir('serbest'); });
  $('sonuc-paylas').addEventListener('click', function () { paylas($('sonuc-not')); });
  $('panel-paylas').addEventListener('click', function () { paylas(mesajEl); });
  sonucDialog.addEventListener('close', function () { selaleDurdur(); });

  var boyutZamanlayici = null;
  function yenidenOlc() {
    if (!durum) return;
    olc(); yuvalariKonumla(); ciz();
  }
  window.addEventListener('resize', function () {
    clearTimeout(boyutZamanlayici);
    boyutZamanlayici = setTimeout(yenidenOlc, 80);
  });

  // Sınama ve elle deneme için küçük kanca: bir durumu doğrudan yükler.
  window.__pasyans = {
    yukle: function (d, say) { sifirla(d, 0, !!say); K = {}; olc(); yuvalariKonumla(); ciz(); sureBaslat(); },
    durum: function () { return durum; },
    kazandiGoster: function () { zincir(); }
  };

  sahneKur();
  olc();
  yuvalariKonumla();
  ozetGuncelle();
  istatistikCiz();
  if (mod === 'gunluk') gunlukYukle(); else serbestYukle();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(yenidenOlc);
})();
