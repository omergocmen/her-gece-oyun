// Okey arayüzü: masa, ıstaka (sürükle-bırak + dokun-seç-yerleştir), bilgisayar rakipler (Web Worker),
// maç, günün eli ve kayıt. Oyun kuralları mantik.js içindedir.
(function () {
  'use strict';
  var M = OkeyMantik;
  var KAYIT = { mac: 'okey:mac', gunluk: 'okey:gunluk' };
  var SURUM = 1;
  var GUN_AYAR = { seviye: 'orta', eller: 1, cifte: true, okeyAtarak: true };

  var $ = function (id) { return document.getElementById(id); };
  var istakaEl = $('istaka'), masaEl = $('masa'), durumEl = $('durum');
  var ayarDialog = $('ayarlar'), sonucDialog = $('sonuc'), istDialog = $('istatistik');

  var S = {
    mod: 'mac',
    ayar: null,         // oynanan ayar (maçta tercih, günün elinde sabit)
    tercih: null,       // maç ayarları: { seviye, eller, cifte, okeyAtarak }
    mac: null,          // { el, puan: [4], baslayan, gecmis: [] }
    d: null,            // motor durumu (mantik.js yeniEl)
    yuvalar: [],        // ıstaka: 16 yuvada taş kimliği ya da null
    secili: -1, odak: 0, hamle: 0, islendi: false, tarih: null,
    kilit: false, nesil: 0, yeniId: null, dagit: false, sonTik: 0, devam: false
  };

  // ---------- Yardımcılar ----------
  function hareketAz() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function bekle(ms) { return new Promise(function (coz) { setTimeout(coz, ms); }); }
  function iki(n) { return n < 10 ? '0' + n : '' + n; }
  function bugun() { var t = new Date(); return t.getFullYear() + '-' + iki(t.getMonth() + 1) + '-' + iki(t.getDate()); }
  function ad(p) { return p === 0 ? 'Sen' : M.RAKIPLER[p].ad; }
  function kisaAd(p) { return p === 0 ? 'Sen' : M.RAKIPLER[p].ad.split(' ')[0]; }
  function gunlukBildir(durum, ozet) {
    try { if (window.Gunluk && typeof window.Gunluk.kaydet === 'function') window.Gunluk.kaydet('okey', { durum: durum, ozet: ozet }); } catch (e) { /* günlük yardımcı yoksa sessizce geçilir */ }
  }

  // ---------- Taş görünümü ----------
  var ISARET = [
    '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.8"/></svg>',
    '<svg viewBox="0 0 12 12"><polygon points="6,1 11.2,10.8 0.8,10.8"/></svg>',
    '<svg viewBox="0 0 12 12"><rect x="1.6" y="1.6" width="8.8" height="8.8" rx="1.2"/></svg>',
    '<svg viewBox="0 0 12 12"><polygon points="6,0.8 11.2,6 6,11.2 0.8,6"/></svg>'
  ];
  var ISARET_AD = ['yuvarlak', 'üçgen', 'kare', 'baklava'];
  var YILDIZ = '<svg class="yildiz" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"/></svg>';
  var SIRT = '<span class="tas sirt"></span>';

  function tasHtml(id, okey) {
    var y = M.yuz(id, okey);
    var sinif = 'tas c' + y.r + (y.joker ? ' okey' : '') + (y.sahte ? ' sahte' : '');
    return '<span class="' + sinif + '">' + (y.sahte ? YILDIZ : '') + '<span class="sayi">' + y.s +
      '</span><span class="isaret" aria-hidden="true">' + ISARET[y.r] + '</span></span>';
  }
  function tasAdi(id, okey) {
    var y = M.yuz(id, okey);
    if (y.sahte) return 'Sahte okey';
    return M.RENK_ADLARI[y.r] + ' ' + y.s + ' (' + ISARET_AD[y.r] + ')' + (y.joker ? ', okey' : '');
  }

  // ---------- Kayıt ----------
  function kaydet() {
    if (!S.d) return;
    Depo.yaz('okey:mod', S.mod);
    Depo.yaz(KAYIT[S.mod], {
      surum: SURUM, ayar: S.ayar, mac: S.mac, d: S.d, yuvalar: S.yuvalar, hamle: S.hamle, islendi: S.islendi, tarih: S.tarih
    });
  }
  function kayitGecerli(k) {
    return k && k.surum === SURUM && k.d && Array.isArray(k.d.eller) && k.d.eller.length === 4 && Array.isArray(k.d.deste) &&
      k.mac && Array.isArray(k.mac.puan) && k.ayar && typeof k.d.sira === 'number';
  }
  // Kayıtlı ıstaka dizilimi eldeki taşlarla uyuşmuyorsa onarılır.
  function yuvalariDuzelt() {
    var el = S.d.eller[0], kalan = el.slice(), yeni = [];
    for (var i = 0; i < M.YUVA; i++) {
      var id = S.yuvalar[i];
      var n = id == null ? -1 : kalan.indexOf(id);
      if (n >= 0) { yeni.push(id); kalan.splice(n, 1); } else yeni.push(null);
    }
    kalan.forEach(function (id) { var b = yeni.indexOf(null); if (b >= 0) yeni[b] = id; });
    S.yuvalar = yeni;
  }
  function istatistikOku() {
    var o = Depo.oku('okey:istatistik', null) || {};
    return Object.assign({ mac: 0, macKazanilan: 0, el: 0, elKazanilan: 0, cifte: 0, okeyle: 0, gun: 0, gunKazanilan: 0 }, o);
  }

  // ---------- Başlatma ----------
  function varsayilanTercih() { return Object.assign({}, M.VARSAYILAN_AYAR); }

  function yeniMac() {
    S.mod = 'mac';
    S.ayar = Object.assign({}, S.tercih);
    S.mac = { el: 1, puan: [0, 0, 0, 0], baslayan: 0, gecmis: [] };
    S.tarih = null;
    elBaslat();
  }
  function gunluguBaslat() {
    S.mod = 'gunluk';
    S.ayar = Object.assign({}, GUN_AYAR);
    S.mac = { el: 1, puan: [0, 0, 0, 0], baslayan: 0, gecmis: [] };
    S.tarih = bugun();
    elBaslat();
  }
  function elBaslat() {
    S.nesil++;
    S.kilit = false;
    var tohum = S.mod === 'gunluk' ? M.gunTohumu(S.tarih) : ((Math.random() * 4294967296) >>> 0);
    var baslayan = S.mod === 'gunluk' ? 0 : S.mac.baslayan;
    S.d = M.yeniEl(tohum, baslayan);
    S.yuvalar = [];
    for (var i = 0; i < M.YUVA; i++) S.yuvalar.push(i < S.d.eller[0].length ? S.d.eller[0][i] : null);
    S.secili = -1; S.odak = 0; S.hamle = 0; S.islendi = false; S.yeniId = null; S.devam = false;
    S.dagit = !hareketAz();
    if (sonucDialog.open) sonucDialog.close();
    if (S.mod === 'gunluk') gunlukBildir('yarim', 'Devam ediyor');
    kaydet();
    ilerle();
    S.dagit = false;
  }
  function yukle(mod) {
    var k = Depo.oku(KAYIT[mod], null);
    if (!kayitGecerli(k) || (mod === 'gunluk' && k.tarih !== bugun())) return false;
    S.mod = mod; S.ayar = k.ayar; S.mac = k.mac; S.d = k.d; S.yuvalar = Array.isArray(k.yuvalar) ? k.yuvalar : [];
    S.hamle = k.hamle || 0; S.islendi = !!k.islendi; S.tarih = k.tarih || null;
    S.secili = -1; S.odak = 0; S.yeniId = null; S.dagit = false;
    S.nesil++; S.kilit = false;
    yuvalariDuzelt();
    return true;
  }
  function modSec(mod) {
    if (mod === S.mod && S.d) return;
    if (sonucDialog.open) sonucDialog.close();
    S.nesil++;
    kaydet();
    if (yukle(mod)) {
      S.devam = !S.d.bitti;
      if (mod === 'gunluk' && !S.d.bitti) gunlukBildir('yarim', 'Devam ediyor');
      ilerle();
      if (S.d.bitti) sonucGoster();
    } else if (mod === 'gunluk') gunluguBaslat();
    else yeniMac();
  }

  // ---------- Akış ----------
  function insanSirasi() { return !!S.d && !S.d.bitti && S.d.sira === 0 && !S.kilit; }

  function ilerle() {
    render();
    var d = S.d;
    if (!d || d.bitti) return;
    if (d.sira !== 0 && !S.kilit) {
      S.kilit = true;
      var nesil = S.nesil;
      aiTur(nesil).catch(function () { if (nesil === S.nesil) { S.kilit = false; } });
    }
  }

  // ---------- Bilgisayar: Web Worker (olmazsa ana iş parçacığı) ----------
  var isci = null, isciNo = 0, bekleyen = {};
  try {
    isci = new Worker('isci.js');
    isci.onmessage = function (olay) {
      var cb = bekleyen[olay.data.no];
      delete bekleyen[olay.data.no];
      if (cb) cb(olay.data.sonuc);
    };
    isci.onerror = function () { isci = null; };
  } catch (e) { isci = null; }

  function karar(tur, d, p) {
    var istek = {
      tur: tur, gorunum: M.gorunum(d, p), ayar: S.ayar, seviye: S.ayar.seviye, stil: M.RAKIPLER[p].stil,
      tohum: M.karma(d.tohum, d.hamle, p, tur === 'al' ? 1 : 2)
    };
    function yerel() {
      return tur === 'al' ? M.yzAl(istek.gorunum, istek.ayar, istek.seviye, istek.stil, istek.tohum)
        : M.yzAt(istek.gorunum, istek.ayar, istek.seviye, istek.stil, istek.tohum);
    }
    return new Promise(function (coz) {
      if (!isci) { coz(yerel()); return; }
      var no = ++isciNo, bitti = false;
      bekleyen[no] = function (s) { if (!bitti) { bitti = true; coz(s); } };
      isci.postMessage(Object.assign({ no: no }, istek));
      // İşçi yanıt vermezse aynı hesap ana iş parçacığında yapılır.
      setTimeout(function () { if (!bitti) { bitti = true; delete bekleyen[no]; coz(yerel()); } }, 4000);
    });
  }

  function rakipEl(p) { return document.querySelector('.rakip[data-p="' + p + '"] .avatar'); }
  function iskartaYer(p) { return document.querySelector('.iskarta[data-p="' + p + '"] .yer'); }

  function ucur(kaynak, hedef, html, sure) {
    if (hareketAz() || !kaynak || !hedef || !kaynak.animate) return Promise.resolve();
    var a = kaynak.getBoundingClientRect(), b = hedef.getBoundingClientRect();
    var mw = parseFloat(getComputedStyle(masaEl).getPropertyValue('--mw')) || 32;
    var tas = document.createElement('div');
    tas.className = 'ucan';
    tas.innerHTML = html;
    document.body.appendChild(tas);
    var w = tas.offsetWidth || mw, h = tas.offsetHeight || mw * 1.4;
    var ax = a.left + a.width / 2 - w / 2, ay = a.top + a.height / 2 - h / 2;
    var bx = b.left + b.width / 2 - w / 2, by = b.top + b.height / 2 - h / 2;
    var anim = tas.animate(
      [{ transform: 'translate(' + ax + 'px,' + ay + 'px) scale(.8)' }, { transform: 'translate(' + bx + 'px,' + by + 'px) scale(1)' }],
      { duration: sure, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
    );
    var bitir = function () { if (tas.parentNode) tas.parentNode.removeChild(tas); };
    return anim.finished.then(bitir, bitir);
  }

  async function aiTur(nesil) {
    var d = S.d, p = d.sira;
    await bekle(hareketAz() ? 140 : 400 + Math.random() * 300);
    if (nesil !== S.nesil) return;
    if (d.faz === 'cek') {
      var onceki = M.oncekiOyuncu(p), yigin = d.atik[onceki];
      var kaynak = yigin.length ? await karar('al', d, p) : 'deste';
      if (nesil !== S.nesil) return;
      if (kaynak === 'iskarta') await ucur(iskartaYer(onceki), rakipEl(p), tasHtml(yigin[yigin.length - 1], d.okey), 240);
      else await ucur($('deste'), rakipEl(p), SIRT, 240);
      if (nesil !== S.nesil) return;
      if (M.cek(d, kaynak) === null && M.cek(d, 'deste') === null) { S.kilit = false; return; }
      kaydet(); render();
      await bekle(hareketAz() ? 50 : 200);
      if (nesil !== S.nesil) return;
    }
    var k = await karar('at', d, p);
    if (nesil !== S.nesil) return;
    var id = k && d.eller[p].indexOf(k.at) >= 0 && k.at !== d.yasak ? k.at : d.eller[p].filter(function (x) { return x !== d.yasak; })[0];
    await ucur(rakipEl(p), iskartaYer(p), tasHtml(id, d.okey), 240);
    if (nesil !== S.nesil) return;
    M.at(d, id, S.ayar);
    S.kilit = false;
    kaydet();
    ilerle();
    if (d.bitti) elBitir();
  }

  // ---------- İnsan hamleleri ----------
  function ilkBos() { return S.yuvalar.indexOf(null); }

  function insanCek(kaynak) {
    if (!insanSirasi() || S.d.faz !== 'cek') return;
    var d = S.d, onceki = M.oncekiOyuncu(0);
    var gorsel = kaynak === 'iskarta' && d.atik[onceki].length ? tasHtml(d.atik[onceki][d.atik[onceki].length - 1], d.okey) : SIRT;
    var from = kaynak === 'iskarta' ? iskartaYer(onceki) : $('deste');
    var id = M.cek(d, kaynak);
    if (id === null) return;
    S.devam = false;
    var yer = ilkBos();
    S.yuvalar[yer] = id;
    S.yeniId = id; S.odak = yer; S.secili = -1;
    setTimeout(function () { S.yeniId = null; }, 500);
    kaydet(); render();
    ucur(from, istakaEl.children[yer], gorsel, 200);
  }

  function insanAt(slot) {
    if (!insanSirasi() || S.d.faz !== 'at') return;
    var id = S.yuvalar[slot];
    if (id == null) return;
    var d = S.d, yer = istakaEl.children[slot];
    var sonuc = M.at(d, id, S.ayar);
    S.devam = false;
    if (!sonuc.ok) {
      if (sonuc.hata === 'yasak') durumGoster('Iskartadan aldığın taşı aynı turda geri atamazsın.');
      return;
    }
    ucur(yer, iskartaYer(0), tasHtml(id, d.okey), 200);
    S.yuvalar[slot] = null; S.secili = -1; S.hamle++;
    kaydet();
    ilerle();
    if (d.bitti) setTimeout(elBitir, hareketAz() ? 0 : 450);
  }

  function bitirTikla() {
    if (!insanSirasi() || S.d.faz !== 'at') return;
    var adaylar = M.bitisAdaylari(S.d.eller[0], S.d.okey, S.ayar).filter(function (c) { return c.id !== S.d.yasak; });
    if (!adaylar.length) return;
    var secilenId = S.secili >= 0 ? S.yuvalar[S.secili] : null;
    var secim = adaylar.filter(function (c) { return c.id === secilenId; })[0] || adaylar[0];
    insanAt(S.yuvalar.indexOf(secim.id));
  }

  var durumGecici = null;
  function durumGoster(metin) {
    durumEl.textContent = metin;
    clearTimeout(durumGecici);
    durumGecici = setTimeout(render, 2600);
  }

  function dizTikla(mod) {
    if (!S.d || S.d.bitti) return;
    var el = S.d.eller[0];
    S.yuvalar = mod === 'cift' ? M.ciftDiz(el, S.d.okey) : M.seriDiz(el, S.d.okey);
    S.secili = -1;
    kaydet(); render();
  }

  // ---------- Istaka: dokun-seç-yerleştir ve sürükle-bırak ----------
  function yuvaTikla(i) {
    if (!S.d || S.d.bitti) return;
    S.odak = i;
    var simdi = Date.now();
    if (S.secili < 0) {
      if (S.yuvalar[i] != null) S.secili = i;
    } else if (S.secili === i) {
      // seçili taşa hızlıca ikinci dokunuş: at
      if (simdi - S.sonTik < 380 && insanSirasi() && S.d.faz === 'at') { S.sonTik = 0; insanAt(i); return; }
      S.secili = -1;
    } else {
      var t = S.yuvalar[i];
      S.yuvalar[i] = S.yuvalar[S.secili];
      S.yuvalar[S.secili] = t;
      S.secili = -1;
      kaydet();
    }
    S.sonTik = simdi;
    render();
  }

  function tasiYuva(den, hedef) {
    if (den === hedef) return;
    var t = S.yuvalar[hedef];
    S.yuvalar[hedef] = S.yuvalar[den];
    S.yuvalar[den] = t;
    S.secili = -1; S.odak = hedef;
    kaydet(); render();
  }

  var sur = null;
  function hedefBul(x, y) {
    var e = document.elementFromPoint(x, y);
    if (!e) return { tur: null };
    var yuva = e.closest && e.closest('.yuva');
    if (yuva && istakaEl.contains(yuva)) return { tur: 'yuva', i: +yuva.dataset.i, el: yuva };
    if (e.closest && e.closest('#masa')) return { tur: 'masa', el: masaEl };
    return { tur: null };
  }
  function surukleTemizle() {
    if (!sur) return;
    document.removeEventListener('pointermove', surHareket);
    document.removeEventListener('pointerup', surBirak);
    document.removeEventListener('pointercancel', surIptal);
    if (sur.klon && sur.klon.parentNode) sur.klon.parentNode.removeChild(sur.klon);
    Array.prototype.forEach.call(istakaEl.children, function (y) { y.classList.remove('suruklenen', 'hedef'); });
    masaEl.classList.remove('birak');
    sur = null;
  }
  function surHareket(e) {
    if (!sur || e.pointerId !== sur.pid) return;
    var dx = e.clientX - sur.x0, dy = e.clientY - sur.y0;
    if (!sur.basladi) {
      if (dx * dx + dy * dy < 64) return;
      sur.basladi = true;
      var klon = document.createElement('div');
      klon.className = 'surukle';
      klon.innerHTML = tasHtml(sur.id, S.d.okey);
      document.body.appendChild(klon);
      sur.klon = klon;
      istakaEl.children[sur.i].classList.add('suruklenen');
      S.secili = -1;
    }
    e.preventDefault();
    var w = sur.klon.offsetWidth, h = sur.klon.offsetHeight;
    var kaydir = e.pointerType === 'touch' ? h * 0.7 : 0; // parmağın altında kalmasın
    sur.klon.style.transform = 'translate(' + (e.clientX - w / 2) + 'px,' + (e.clientY - h / 2 - kaydir) + 'px)';
    var h2 = hedefBul(e.clientX, e.clientY - kaydir * 0.4);
    Array.prototype.forEach.call(istakaEl.children, function (y) { y.classList.remove('hedef'); });
    masaEl.classList.remove('birak');
    if (h2.tur === 'yuva' && h2.i !== sur.i) h2.el.classList.add('hedef');
    else if (h2.tur === 'masa' && insanSirasi() && S.d.faz === 'at') masaEl.classList.add('birak');
  }
  function surBirak(e) {
    if (!sur || e.pointerId !== sur.pid) return;
    var s = sur, kaydir = e.pointerType === 'touch' ? (s.klon ? s.klon.offsetHeight * 0.7 : 0) : 0;
    var hedef = s.basladi ? hedefBul(e.clientX, e.clientY - kaydir * 0.4) : null;
    surukleTemizle();
    if (!s.basladi) { yuvaTikla(s.i); return; }
    if (hedef.tur === 'yuva') tasiYuva(s.i, hedef.i);
    else if (hedef.tur === 'masa') {
      if (insanSirasi() && S.d.faz === 'at') insanAt(s.i);
      else if (S.d.sira === 0 && S.d.faz === 'cek' && insanSirasi()) durumGoster('Önce desteden ya da ıskartadan bir taş çekmelisin.');
      else render();
    } else render();
  }
  function surIptal(e) { if (sur && e.pointerId === sur.pid) { surukleTemizle(); render(); } }

  istakaEl.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || !S.d || S.d.bitti) return;
    var yuva = e.target.closest && e.target.closest('.yuva');
    if (!yuva) return;
    var i = +yuva.dataset.i;
    sur = { i: i, id: S.yuvalar[i], x0: e.clientX, y0: e.clientY, pid: e.pointerId, basladi: false, klon: null };
    document.addEventListener('pointermove', surHareket, { passive: false });
    document.addEventListener('pointerup', surBirak);
    document.addEventListener('pointercancel', surIptal);
  });
  // Fare ve dokunma tıklaması pointerup'ta işlenir; yalnızca klavye (detail 0) click ile gelir.
  istakaEl.addEventListener('click', function (e) {
    if (e.detail !== 0) return;
    var yuva = e.target.closest && e.target.closest('.yuva');
    if (yuva) yuvaTikla(+yuva.dataset.i);
  });
  istakaEl.addEventListener('keydown', function (e) {
    var i = S.odak, y = null;
    if (e.key === 'ArrowRight') y = Math.min(15, i + 1);
    else if (e.key === 'ArrowLeft') y = Math.max(0, i - 1);
    else if (e.key === 'ArrowDown') y = Math.min(15, i + 8);
    else if (e.key === 'ArrowUp') y = Math.max(0, i - 8);
    else if (e.key === 'Home') y = 0;
    else if (e.key === 'End') y = 15;
    if (y === null) return;
    e.preventDefault();
    S.odak = y;
    render();
    istakaEl.children[y].focus();
  });

  // ---------- Çizim ----------
  function kurIskeleti() {
    var rak = $('rakipler');
    for (var p = 1; p <= 3; p++) {
      var li = document.createElement('li');
      li.className = 'rakip'; li.dataset.p = p;
      li.innerHTML = '<span class="avatar" aria-hidden="true">' + M.RAKIPLER[p].ad.charAt(0) + '</span><span class="ad">' + M.RAKIPLER[p].ad +
        '</span><span class="stil">' + M.STIL_ADI[M.RAKIPLER[p].stil] + '</span><span class="tas-sayisi"><strong>14</strong> taş</span>';
      rak.appendChild(li);
    }
    var isk = $('iskartalar');
    for (var q = 0; q < 4; q++) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'iskarta'; b.dataset.p = q; b.id = 'iskarta-' + q;
      b.innerHTML = '<span class="yer"></span><span class="yazi"><b>' + kisaAd(q) + '</b><small></small></span>';
      isk.appendChild(b);
    }
    for (var i = 0; i < M.YUVA; i++) {
      var y = document.createElement('button');
      y.type = 'button'; y.className = 'yuva'; y.dataset.i = i; y.tabIndex = -1;
      istakaEl.appendChild(y);
    }
  }

  function durumMetni() {
    var d = S.d;
    if (d.bitti) return S.mod === 'gunluk' ? 'Bugünün eli bitti. Yarın yeni bir dağıtım gelir.' : 'El bitti.';
    if (d.sira === 0) {
      if (d.faz === 'cek') return 'Sıra sende: desteden çek ya da sağdaki ıskartayı al.';
      var ad2 = M.bitisAdaylari(d.eller[0], d.okey, S.ayar).some(function (c) { return c.id !== d.yasak; });
      return ad2 ? 'Elin hazır: Bitir\'e bas ya da bir taş at.' : 'Bir taş at.';
    }
    return ad(d.sira) + ' oynuyor…';
  }

  function render() {
    var d = S.d;
    if (!d) return;
    var insan = d.sira === 0 && !d.bitti;
    // üst bilgi
    var macMetin;
    if (S.mod === 'gunluk') {
      macMetin = '<strong>Günün eli</strong> · ' + new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' · tek el · Orta';
    } else {
      macMetin = 'El <strong>' + S.mac.el + '/' + S.ayar.eller + '</strong> · ' + [0, 1, 2, 3].map(function (p) { return kisaAd(p) + ' <strong>' + S.mac.puan[p] + '</strong>'; }).join(' · ') +
        ' · ' + M.SEVIYE_ADI[S.ayar.seviye];
    }
    $('mac-bilgi').innerHTML = macMetin;
    $('devam-bilgi').hidden = !S.devam;
    $('mod-mac').setAttribute('aria-pressed', S.mod === 'mac');
    $('mod-gunluk').setAttribute('aria-pressed', S.mod === 'gunluk');
    // rakipler
    for (var p = 1; p <= 3; p++) {
      var li = document.querySelector('.rakip[data-p="' + p + '"]');
      li.classList.toggle('sirada', d.sira === p && !d.bitti);
      li.querySelector('.tas-sayisi strong').textContent = d.eller[p].length;
      if (d.sira === p && !d.bitti) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current');
    }
    // masa
    $('gosterge').innerHTML = tasHtml(d.gosterge, d.okey);
    $('okey-tasi').innerHTML = tasHtml(d.okey.renk * 26 + (d.okey.sayi - 1) * 2, d.okey);
    $('deste-sayi').textContent = d.deste.length;
    var cekebilir = insan && d.faz === 'cek';
    var desteDugme = $('deste');
    desteDugme.disabled = !cekebilir || !d.deste.length;
    desteDugme.classList.toggle('cek', cekebilir && d.deste.length > 0);
    var onceki = M.oncekiOyuncu(0);
    for (var q = 0; q < 4; q++) {
      var b = $('iskarta-' + q), yigin = d.atik[q];
      b.querySelector('.yer').innerHTML = yigin.length ? tasHtml(yigin[yigin.length - 1], d.okey) : '';
      b.querySelector('small').textContent = yigin.length ? yigin.length + ' taş' : 'boş';
      var alinabilir = cekebilir && q === onceki && yigin.length > 0;
      b.disabled = !alinabilir;
      b.classList.toggle('alinabilir', alinabilir);
      b.classList.toggle('sirada', d.sira === q && !d.bitti);
      b.setAttribute('aria-label', yigin.length ? kisaAd(q) + ' son attığı taş: ' + tasAdi(yigin[yigin.length - 1], d.okey) + (alinabilir ? ', almak için dokun' : '') : kisaAd(q) + ' ıskarta yığını boş');
    }
    istakaCiz();
    // durum, bilgi, düğmeler
    durumEl.textContent = durumMetni();
    var el = d.eller[0], e = M.enIyiDizilis(el, d.okey);
    $('per-bilgi').innerHTML = d.bitti ? '' : 'Per ya da seri içinde: <strong>' + Math.min(e.kapsanan, 14) + '</strong> / 14 taş';
    var adaylar = insan && d.faz === 'at' ? M.bitisAdaylari(el, d.okey, S.ayar).filter(function (c) { return c.id !== d.yasak; }) : [];
    $('bitir').disabled = !adaylar.length;
    $('at-dugme').disabled = !(insan && d.faz === 'at' && S.secili >= 0 && S.yuvalar[S.secili] != null);
    $('seri-diz').disabled = $('cift-diz').disabled = !!d.bitti;
    $('sonuc-ac').hidden = !(d.bitti && !sonucDialog.open);
  }

  function istakaCiz() {
    var d = S.d, okeyAnahtar = d.okey.renk * 14 + d.okey.sayi;
    for (var i = 0; i < M.YUVA; i++) {
      var yuva = istakaEl.children[i], id = S.yuvalar[i];
      var imza = (id == null ? '-' : id) + '|' + (i === S.secili ? 1 : 0) + '|' + (S.yeniId === id ? 1 : 0) + '|' + (i === S.odak ? 1 : 0) + '|' + okeyAnahtar + '|' + (S.dagit ? 1 : 0);
      if (yuva._imza === imza) continue;
      yuva._imza = imza;
      yuva.className = 'yuva' + (id != null ? ' dolu' : '') + (i === S.secili ? ' secili' : '') + (id != null && S.yeniId === id ? ' yeni' : '') + (S.dagit && id != null ? ' dagit' : '');
      yuva.style.setProperty('--n', i);
      yuva.innerHTML = id != null ? tasHtml(id, d.okey) : '';
      yuva.tabIndex = i === S.odak ? 0 : -1;
      yuva.setAttribute('aria-label', 'Yuva ' + (i + 1) + (id != null ? ': ' + tasAdi(id, d.okey) + (i === S.secili ? ', seçili' : '') : ': boş'));
      yuva.setAttribute('aria-pressed', i === S.secili ? 'true' : 'false');
    }
  }

  // ---------- Sonuç ----------
  function elBitir() {
    var d = S.d, b = d.bitti;
    if (!b) return;
    S.devam = false;
    var macBitti = S.mod === 'gunluk' || S.mac.gecmis.length + 1 >= S.ayar.eller;
    if (!S.islendi) {
      S.islendi = true;
      if (b.kazanan >= 0) S.mac.puan[b.kazanan] += b.puan;
      S.mac.gecmis.push({ kazanan: b.kazanan, puan: b.puan, tur: b.tur, okeyle: !!b.okeyle });
      var ist = istatistikOku();
      if (S.mod === 'gunluk') { ist.gun++; if (b.kazanan === 0) ist.gunKazanilan++; }
      else {
        ist.el++;
        if (b.kazanan === 0) { ist.elKazanilan++; if (b.tur === 'cifte') ist.cifte++; if (b.okeyle) ist.okeyle++; }
        if (macBitti) { ist.mac++; if (M.macKazanani(S.mac.puan) === 0) ist.macKazanilan++; }
      }
      Depo.yaz('okey:istatistik', ist);
      Depo.ozetYaz('okey', ist.mac ? ist.macKazanilan + '/' + ist.mac + ' maç' : (ist.el ? ist.elKazanilan + '/' + ist.el + ' el' : ist.gunKazanilan + '/' + ist.gun + ' gün'));
      if (S.mod === 'gunluk') {
        gunlukBildir('bitti', b.kazanan === 0 ? 'Kazandın · ' + S.hamle + ' hamle' : b.kazanan > 0 ? 'Kaybettin' : 'Berabere');
      }
      kaydet();
    }
    render();
    sonucGoster();
  }

  function miniGrup(ids, okey, n0) {
    return '<span class="grup">' + ids.map(function (id, i) {
      return '<span class="mini" style="--n:' + (n0 + i) + '">' + tasHtml(id, okey) + '</span>';
    }).join('') + '</span>';
  }

  function sonucGoster() {
    var d = S.d, b = d.bitti;
    if (!b) return;
    var macBitti = S.mod === 'gunluk' || S.mac.gecmis.length >= S.ayar.eller;
    var kazanan = b.kazanan;
    $('sonuc-ust').textContent = S.mod === 'gunluk' ? 'Günün eli' : (macBitti ? 'Maç bitti' : S.mac.el + '. el bitti');
    var baslik = $('sonuc-baslik');
    baslik.className = '';
    var metin = '';
    if (kazanan === 0) {
      baslik.textContent = macBitti && S.mod !== 'gunluk' ? 'Maç senin' : 'Kazandın';
      baslik.classList.add('kazandi');
    } else if (kazanan > 0) {
      baslik.textContent = 'Kaybettin';
      baslik.classList.add('kaybetti');
    } else baslik.textContent = 'Berabere';
    $('okey-damga').hidden = kazanan !== 0;
    if (kazanan >= 0) {
      var tur = b.tur === 'cifte' ? 'yedi çiftle' : 'per ve serilerle';
      metin = (kazanan === 0 ? 'Eli ' : ad(kazanan) + ' eli ') + tur + (b.okeyle ? ', son taş olarak okey atarak' : '') + ' bitirdi: ' + b.puan + ' puan.';
    } else metin = 'Deste bitti, kimse eli bitiremedi. Bu el puan getirmedi.';
    if (macBitti && S.mod !== 'gunluk') {
      var mk = M.macKazanani(S.mac.puan);
      metin += mk === 0 ? ' Maçı en çok puanla sen kazandın.' : mk > 0 ? ' Maçı ' + ad(mk) + ' kazandı.' : ' Maç berabere bitti.';
      if (mk > 0) { baslik.textContent = 'Maçı ' + kisaAd(mk) + ' aldı'; baslik.className = 'kaybetti'; }
    }
    $('sonuc-metin').textContent = metin;
    // kazanan el
    var kutu = $('sonuc-el');
    if (kazanan >= 0 && b.el) {
      var html = '', n = 0;
      if (b.tur === 'cifte') {
        M.ciftGruplari(b.el, d.okey).ciftler.forEach(function (c) { html += miniGrup(c, d.okey, n); n += 2; });
      } else {
        (M.perlereBol(b.el, d.okey) || []).forEach(function (g) { html += miniGrup(g.taslar, d.okey, n); n += g.taslar.length; });
      }
      kutu.innerHTML = html;
      kutu.hidden = false;
    } else { kutu.innerHTML = ''; kutu.hidden = true; }
    // puan tablosu
    var satirlar = [0, 1, 2, 3].map(function (p) {
      var buEl = kazanan === p ? '+' + b.puan : '–';
      var disarda = '';
      if (kazanan >= 0 && p !== kazanan) {
        var kapsanan = M.enIyiDizilis(d.eller[p], d.okey).kapsanan;
        disarda = ' <small>(' + Math.max(0, Math.min(14, d.eller[p].length) - Math.min(14, kapsanan)) + ' taş dışarıda)</small>';
      }
      var topl = S.mod === 'gunluk' ? '' : '<td>' + S.mac.puan[p] + '</td>';
      return '<tr class="' + (kazanan === p ? 'kazanan' : '') + '"><td>' + ad(p) + disarda + '</td><td class="buel">' + buEl + '</td>' + topl + '</tr>';
    }).join('');
    $('sonuc-tablo').innerHTML = '<table><thead><tr><th>Oyuncu</th><th>Bu el</th>' + (S.mod === 'gunluk' ? '' : '<th>Toplam</th>') + '</tr></thead><tbody>' + satirlar + '</tbody></table>';
    // düğmeler
    var sonraki = $('sonraki-el'), yeni = $('sonuc-yeni-mac');
    sonraki.hidden = macBitti;
    yeni.textContent = S.mod === 'gunluk' ? 'Maç oyna' : 'Yeni maç';
    yeni.className = macBitti ? 'buton' : 'buton ikincil';
    if (!sonucDialog.open) sonucDialog.showModal();
  }

  // ---------- Pencereler ve düğmeler ----------
  var taslak = null;
  function ayarCiz() {
    Array.prototype.forEach.call($('seviye-secimi').children, function (b) { b.setAttribute('aria-pressed', b.dataset.seviye === taslak.seviye); });
    Array.prototype.forEach.call($('el-secimi').children, function (b) { b.setAttribute('aria-pressed', +b.dataset.el === taslak.eller); });
    $('ayar-cifte').checked = !!taslak.cifte;
    $('ayar-okey').checked = !!taslak.okeyAtarak;
  }
  $('ayar-ac').addEventListener('click', function () { taslak = Object.assign({}, S.tercih); ayarCiz(); ayarDialog.showModal(); });
  $('seviye-secimi').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { taslak.seviye = b.dataset.seviye; ayarCiz(); } });
  $('el-secimi').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { taslak.eller = +b.dataset.el; ayarCiz(); } });
  $('ayar-cifte').addEventListener('change', function () { taslak.cifte = this.checked; });
  $('ayar-okey').addEventListener('change', function () { taslak.okeyAtarak = this.checked; });
  $('yeni-mac-baslat').addEventListener('click', function () {
    S.tercih = Object.assign({}, taslak);
    Depo.yaz('okey:tercih', S.tercih);
    ayarDialog.close();
    yeniMac();
  });
  $('istatistik-ac').addEventListener('click', function () {
    var i = istatistikOku();
    $('i-mac').textContent = i.mac; $('i-mac-k').textContent = i.macKazanilan; $('i-el').textContent = i.el; $('i-el-k').textContent = i.elKazanilan;
    $('i-cifte').textContent = i.cifte; $('i-okey').textContent = i.okeyle; $('i-gun').textContent = i.gun; $('i-gun-k').textContent = i.gunKazanilan;
    istDialog.showModal();
  });
  $('mod-mac').addEventListener('click', function () { modSec('mac'); });
  $('mod-gunluk').addEventListener('click', function () { modSec('gunluk'); });
  $('deste').addEventListener('click', function () { insanCek('deste'); });
  $('iskartalar').addEventListener('click', function (e) {
    var b = e.target.closest('.iskarta');
    if (b && +b.dataset.p === M.oncekiOyuncu(0)) insanCek('iskarta');
  });
  $('seri-diz').addEventListener('click', function () { dizTikla('seri'); });
  $('cift-diz').addEventListener('click', function () { dizTikla('cift'); });
  $('at-dugme').addEventListener('click', function () { if (S.secili >= 0) insanAt(S.secili); });
  $('bitir').addEventListener('click', bitirTikla);
  $('sonraki-el').addEventListener('click', function () {
    var b = S.d.bitti;
    S.mac.el++;
    S.mac.baslayan = b && b.kazanan >= 0 ? b.kazanan : (S.d.baslayan + 1) % 4;
    elBaslat();
  });
  $('sonuc-yeni-mac').addEventListener('click', function () { sonucDialog.close(); yeniMac(); });
  $('sonuc-kapat').addEventListener('click', function () { sonucDialog.close(); });
  $('sonuc-ac').addEventListener('click', sonucGoster);
  sonucDialog.addEventListener('close', render);
  sonucDialog.addEventListener('cancel', function () { /* Esc: masaya bak */ });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    var t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    var k = e.key.toLowerCase();
    if (k === 'c') insanCek('deste');
    else if (k === 'i') insanCek('iskarta');
    else if (k === 'a' || k === 'delete') { if (S.secili >= 0) insanAt(S.secili); }
    else if (k === 'b') bitirTikla();
  });

  // ---------- Açılış ----------
  kurIskeleti();
  S.tercih = Object.assign(varsayilanTercih(), Depo.oku('okey:tercih', null) || {});
  (function ac() {
    var sonMod = Depo.oku('okey:mod', 'mac');
    if (sonMod === 'gunluk' && yukle('gunluk')) { /* günün eli kaldığı yerden */ }
    else if (yukle('mac')) { /* maç kaldığı yerden */ }
    else { yeniMac(); return; }
    S.devam = !S.d.bitti;
    if (S.mod === 'gunluk' && !S.d.bitti) gunlukBildir('yarim', 'Devam ediyor');
    ilerle();
    if (S.d.bitti) sonucGoster();
  })();
  window.addEventListener('pagehide', kaydet);
  document.addEventListener('visibilitychange', function () { if (document.hidden) kaydet(); });
})();
