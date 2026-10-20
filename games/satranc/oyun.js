// Satranç arayüzü: tahta, dokunma/sürükleme, bilgisayar (Web Worker), Günün Bulmacası, kayıt ve istatistik.
(function () {
  'use strict';
  var M = window.SatrancMotor;
  var BULMACALAR = window.SatrancBulmacalar || [];
  var BEYAZ = 0, SIYAH = 1;
  var KAYIT = 'satranc:oyun', TERCIH = 'satranc:tercih', IST = 'satranc:istatistik', BUL = 'satranc:bulmaca';
  var SEVIYE_AD = ['', 'Çaylak', 'Acemi', 'Orta', 'İleri', 'Usta'];
  var TAS_AD = { 1: 'piyon', 2: 'at', 3: 'fil', 4: 'kale', 5: 'vezir', 6: 'şah' };
  var TERFI_AD = { 5: 'Vezir', 4: 'Kale', 3: 'Fil', 2: 'At' };
  var BASLANGIC_ADET = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };
  var DEGER = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
  var azHareket = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }
  var tahtaEl = $('tahta'), durumEl = $('durum'), damgaEl = $('damga');

  var tercih = Depo.oku(TERCIH, null) || {};
  var s = {
    mod: 'bilgisayar', oyun: null, ben: BEYAZ, seviye: tercih.seviye || 3, renkTercih: tercih.renk || 'beyaz',
    ipucu: !!tercih.ipucu, cevrik: false, secili: -1, hedefler: [], bekle: false, bitti: false, sayildi: false,
    sure: 0, sonHamle: 0, durum: { bitti: false, sah: false }, odak: -1, terfi: null, bulmaca: null
  };

  // ---------- Yardımcılar ----------
  function dk(sn) { return (sn >= 3600 ? Math.floor(sn / 3600) + ':' : '') + ('0' + Math.floor((sn % 3600) / 60)).slice(-2) + ':' + ('0' + (sn % 60)).slice(-2); }
  function bugun() { return window.Gunluk ? window.Gunluk.gunAnahtari(new Date()) : new Date().toISOString().slice(0, 10); }
  function dun() { var d = new Date(); d.setDate(d.getDate() - 1); return window.Gunluk ? window.Gunluk.gunAnahtari(d) : d.toISOString().slice(0, 10); }
  function renkAdi(r) { return r === BEYAZ ? 'beyaz' : 'siyah'; }
  function kareEtiket(k, x) { return M.kareAdi(k) + ', ' + (x ? renkAdi((x & 8) >> 3) + ' ' + TAS_AD[x & 7] : 'boş'); }
  function oynayan() { return s.oyun.konum.sira; }
  function benimSiram() { return !s.bitti && !s.bekle && oynayan() === s.ben && !s.terfi; }
  function gorunum(k) { // karenin ekrandaki sütun/satırı
    var f = k & 7, r = k >> 4;
    return s.cevrik ? { c: 7 - f, r: r } : { c: f, r: 7 - r };
  }
  function durumYaz(metin, sinif) { durumEl.textContent = metin || ''; durumEl.className = 'durum' + (sinif ? ' ' + sinif : ''); }

  // ---------- Tahta çizimi ----------
  function tasSvg(x, boyutSinifi) {
    return '<svg class="' + (boyutSinifi || 'tas') + ' ' + ((x & 8) ? 'ts' : 'tb') + '" viewBox="0 0 45 45" aria-hidden="true"><use href="#t-' + (x & 7) + '"/></svg>';
  }
  function ciz(anim) {
    var p = s.oyun.konum, h = '';
    var sahKare = s.durum.sah ? p.sah[p.sira] : -1;
    var tehdit = s.ipucu && s.mod === 'bilgisayar' && !s.bitti ? M.tehditler(p, s.ben) : [];
    var hedefKare = {};
    s.hedefler.forEach(function (m) { hedefKare[M.hamleHedef(m)] = true; });
    var sonDen = s.sonHamle ? M.hamleDen(s.sonHamle) : -1, sonHd = s.sonHamle ? M.hamleHedef(s.sonHamle) : -1;
    var odak = s.odak >= 0 ? s.odak : (s.secili >= 0 ? s.secili : (s.ben === BEYAZ ? 4 : 116));
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        var rank = s.cevrik ? i : 7 - i, file = s.cevrik ? 7 - j : j, k = rank * 16 + file, x = p.t[k];
        var c = 'kare ' + (((rank + file) & 1) ? 'acik' : 'koyu');
        if (k === sonDen || k === sonHd) c += ' son';
        if (k === s.secili) c += ' secili';
        if (hedefKare[k]) c += ' hedef' + ((x || (s.secili >= 0 && p.t[s.secili] && (p.t[s.secili] & 7) === 1 && k === p.ep)) ? ' alma' : '');
        if (k === sahKare) c += ' sahta';
        if (s.ipucuKare === k) c += ' ipucu-kaynak';
        var tehditli = tehdit.indexOf(k) >= 0;
        if (tehditli) c += ' tehdit';
        var oynar = benimSiram() && ((x && ((x & 8) >> 3) === s.ben) || hedefKare[k]);
        if (oynar) c += ' oynar';
        h += '<button type="button" class="' + c + '" data-k="' + k + '" aria-label="' + kareEtiket(k, x) + (hedefKare[k] ? ', hedef' : '') + (tehditli ? ', tehdit altında' : '') +
          '" tabindex="' + (k === odak ? 0 : -1) + '"' + (k === s.secili ? ' aria-pressed="true"' : '') + '>';
        if (j === 0) h += '<span class="koordinat sira" aria-hidden="true">' + (rank + 1) + '</span>';
        if (i === 7) h += '<span class="koordinat sutun" aria-hidden="true">' + 'abcdefgh'.charAt(file) + '</span>';
        if (x) h += tasSvg(x);
        if (tehditli) h += '<span class="tehdit-isaret" aria-hidden="true"></span>';
        h += '</button>';
      }
    }
    tahtaEl.innerHTML = h;
    if (anim && !azHareket) hareketlendir(anim);
    yanPanel();
  }
  function hareketlendir(a) {
    var boyut = tahtaEl.clientWidth / 8;
    [a].concat(a.ek ? [a.ek] : []).forEach(function (o) {
      var el = tahtaEl.querySelector('.kare[data-k="' + o.hd + '"] .tas');
      if (!el || !el.animate) return;
      var den = gorunum(o.den), hd = gorunum(o.hd);
      el.style.zIndex = 4;
      el.animate([{ transform: 'translate(' + (den.c - hd.c) * boyut + 'px,' + (den.r - hd.r) * boyut + 'px)' }, { transform: 'none' }], { duration: 140, easing: 'ease-out' });
    });
  }

  // ---------- Yan bilgiler: yenen taşlar, isimler, hamle listesi, açılış ----------
  function yenenTaslar(renk) { // renk: yenen taşların rengi
    var p = s.oyun.konum, say = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (var k = 0; k < 128; k++) { if (k & 0x88) { k += 7; continue; } var x = p.t[k]; if (x && ((x & 8) >> 3) === renk && (x & 7) < 6) say[x & 7]++; }
    var liste = [], deger = 0;
    [5, 4, 3, 2, 1].forEach(function (t) {
      var eksik = Math.max(0, BASLANGIC_ADET[t] - say[t]);
      for (var i = 0; i < eksik; i++) { liste.push((t | (renk << 3))); deger += DEGER[t]; }
    });
    return { liste: liste, deger: deger };
  }
  function yenenYaz() {
    var beyazYenen = yenenTaslar(SIYAH), siyahYenen = yenenTaslar(BEYAZ); // beyazın yediği siyah taşlar
    var benYenen = s.ben === BEYAZ ? beyazYenen : siyahYenen, rakipYenen = s.ben === BEYAZ ? siyahYenen : beyazYenen;
    function yaz(el, v, fark) {
      el.innerHTML = v.liste.map(function (x) { return tasSvg(x, 'tas-mini'); }).join('') + (fark > 0 ? '<b>+' + fark + '</b>' : '');
      el.querySelectorAll('svg').forEach(function (e) { e.style.cssText = 'position:static;width:18px;height:18px'; });
    }
    yaz($('alt-yenen'), benYenen, benYenen.deger - rakipYenen.deger);
    yaz($('ust-yenen'), rakipYenen, rakipYenen.deger - benYenen.deger);
  }
  function adlariYaz() {
    if (s.mod === 'bulmaca') { $('ust-ad').textContent = 'Rakip'; $('alt-ad').textContent = 'Sen · ' + (s.ben === BEYAZ ? 'Beyaz' : 'Siyah'); }
    else { $('ust-ad').textContent = 'Bilgisayar · Seviye ' + s.seviye + ' (' + SEVIYE_AD[s.seviye] + ')'; $('alt-ad').textContent = 'Sen · ' + (s.ben === BEYAZ ? 'Beyaz' : 'Siyah'); }
  }
  function yanPanel() {
    yenenYaz();
    var sanlar = s.oyun.sanlar, ilk = s.oyun.konum && fenSira0(), h = '';
    var no = ilk.tam, siraDurum = ilk.sira;
    var satir = '', acik = false;
    for (var i = 0; i < sanlar.length; i++) {
      var sonMu = i === sanlar.length - 1, kls = sonMu ? ' class="son-hamle"' : '';
      if (siraDurum === BEYAZ) { h += '<li><span class="no">' + no + '.</span><span' + kls + '>' + sanlar[i] + '</span>'; acik = true; }
      else {
        if (!acik) h += '<li><span class="no">' + no + '…</span><span></span>';
        h += '<span' + kls + '>' + sanlar[i] + '</span></li>'; acik = false; no++;
      }
      siraDurum ^= 1;
    }
    if (acik) h += '<span></span></li>';
    $('hamle-listesi').innerHTML = h;
    var liste = $('hamle-listesi'); liste.scrollTop = liste.scrollHeight;
    $('hamle-sayi').textContent = sanlar.length ? '(' + sanlar.length + ')' : '';
    var ad = M.acilisAdi(s.oyun.uciListesi());
    $('acilis').textContent = s.mod === 'bilgisayar' && sanlar.length ? (ad ? 'Açılış: ' + ad : '') : '';
    $('geri-al').disabled = !(s.mod === 'bilgisayar' && kullaniciHamleSayisi() > 0);
    $('ipucu').setAttribute('aria-pressed', s.ipucu ? 'true' : 'false');
    $('ipucu').title = s.mod === 'bulmaca' ? 'Hangi taşla oynayacağını göster' : 'Tehdit altındaki taşları göster';
    $('pgn-kopyala').disabled = !sanlar.length;
  }
  var ilkKonum = null;
  function fenSira0() { return ilkKonum || (ilkKonum = M.fenOku(s.oyun.baslangic)); }
  function kullaniciHamleSayisi() {
    var ilk = fenSira0().sira, say = 0, n = s.oyun.hamleler.length;
    for (var i = 0; i < n; i++) if (((ilk + i) & 1) === s.ben) say++;
    return say;
  }

  // ---------- Kayıt ----------
  function kaydet() {
    if (s.mod !== 'bilgisayar') return;
    Depo.yaz(KAYIT, { fen: s.oyun.baslangic, h: s.oyun.uciListesi(), ben: s.ben, seviye: s.seviye, ipucu: s.ipucu, cevrik: s.cevrik, sure: s.sure, sayildi: s.sayildi });
  }
  function tercihKaydet() { Depo.yaz(TERCIH, { seviye: s.seviye, renk: s.renkTercih, ipucu: s.ipucu }); }
  function istatistik() {
    var i = Depo.oku(IST, null) || {};
    return { oyun: i.oyun || 0, kazan: i.kazan || 0, kaybet: i.kaybet || 0, bera: i.bera || 0, enSeviye: i.enSeviye || 0, bulmaca: i.bulmaca || 0 };
  }
  function bulmacaKaydi() {
    var b = Depo.oku(BUL, null) || {};
    return { gun: b.gun || '', durum: b.durum || '', hata: b.hata || 0, seri: b.seri && b.seri.sayi ? b.seri : { son: '', sayi: 0 }, cozulen: b.cozulen || 0 };
  }
  function ozetYaz() {
    var i = istatistik(), b = bulmacaKaydi();
    var seriGecerli = b.seri.son === bugun() || b.seri.son === dun();
    var metin = i.oyun ? i.kazan + '/' + i.oyun + ' oyun' : '';
    if (seriGecerli && b.seri.sayi) metin = (metin ? metin + ' · ' : '') + 'Seri ' + b.seri.sayi;
    Depo.ozetYaz('satranc', metin || '');
  }

  // ---------- Hamle uygulama ----------
  function uygula(m, kimden) {
    var den = M.hamleDen(m), hd = M.hamleHedef(m), bay = M.hamleBayrak(m);
    var anim = { den: den, hd: hd };
    if (bay & M.ROK_K) anim.ek = { den: hd + 1, hd: hd - 1 };
    else if (bay & M.ROK_U) anim.ek = { den: hd - 2, hd: hd + 1 };
    s.oyun.yap(m);
    s.sonHamle = m; s.secili = -1; s.hedefler = []; s.ipucuKare = -1; s.terfi = null;
    $('terfi').hidden = true;
    s.durum = s.oyun.durum();
    ciz(anim);
    if (s.mod === 'bilgisayar') kaydet();
    return s.durum;
  }

  function kullaniciHamlesi(m) {
    if (s.mod === 'bulmaca') return bulmacaHamlesi(m);
    var d = uygula(m, 'ben');
    if (d.bitti) return bitir();
    durumGuncelle();
    bilgisayarSirasi();
  }

  function durumGuncelle() {
    if (s.bitti) return;
    var d = s.durum;
    if (s.mod === 'bulmaca') return;
    if (s.bekle) durumYaz('Bilgisayar düşünüyor…');
    else if (d.sah && oynayan() === s.ben) { durumYaz('Şah! Şahını kurtarmalısın.'); damgaGoster('Şah!', 'sah'); }
    else if (d.sah) { durumYaz('Şah! Bilgisayar şahta.'); damgaGoster('Şah!', 'sah'); }
    else durumYaz(oynayan() === s.ben ? 'Sıra sende' : 'Bilgisayarın sırası');
  }
  var damgaZaman = 0;
  function damgaGoster(metin, sinif, kalici) {
    clearTimeout(damgaZaman);
    damgaEl.textContent = metin; damgaEl.className = 'damga ' + (sinif || ''); damgaEl.hidden = false;
    if (!kalici) damgaZaman = setTimeout(function () { damgaEl.hidden = true; }, 1400);
  }

  // ---------- Bilgisayar ----------
  var isci = null, isciNo = 0;
  try {
    isci = new Worker('isci.js');
    isci.onmessage = function (olay) { if (olay.data && olay.data.no === isciNo) cevapGeldi(olay.data.hamle, isciNo); };
    isci.onerror = function () { isci = null; if (s.bekle) { s.bekle = false; bilgisayarSirasi(); } };
  } catch (e) { isci = null; }

  var basla = 0;
  function bilgisayarSirasi() {
    if (s.mod !== 'bilgisayar' || s.bitti || oynayan() === s.ben) return;
    s.bekle = true; basla = Date.now();
    $('dusunuyor').hidden = false;
    durumGuncelle(); ciz();
    var no = ++isciNo;
    if (isci) isci.postMessage({ no: no, baslangic: s.oyun.baslangic, hamleler: s.oyun.uciListesi(), seviye: s.seviye });
    else setTimeout(function () { if (no === isciNo) cevapGeldi(M.bilgisayarHamlesi(s.oyun, s.seviye), no); }, 40);
  }
  function cevapGeldi(uci, no) {
    var gecikme = Math.max(0, 380 - (Date.now() - basla));
    setTimeout(function () {
      if (no !== isciNo || s.mod !== 'bilgisayar') return;
      s.bekle = false; $('dusunuyor').hidden = true;
      var m = uci ? M.hamleBul(s.oyun.konum, uci) : 0;
      if (!m) { var ms = s.oyun.yasal(); m = ms[0]; }
      if (!m) return bitir();
      var d = uygula(m, 'pc');
      if (d.bitti) return bitir();
      durumGuncelle();
    }, gecikme);
  }
  function dusunmeyiIptalEt() { isciNo++; s.bekle = false; $('dusunuyor').hidden = true; }

  // ---------- Oyun sonu ----------
  function bitir() {
    var d = s.durum;
    s.bitti = true; s.bekle = false; $('dusunuyor').hidden = true;
    var sonucMetin = { mat: 'Şah mat', pat: 'Pat: yasal hamle yok', 'uc-tekrar': 'Aynı konum üç kez oluştu', 'elli-hamle': 'Elli hamlede taş alınmadı, piyon oynanmadı', yetersiz: 'İki tarafın da mat yapacak taşı kalmadı' }[d.sonuc];
    var kazandin = d.kazanan === s.ben, berabere = d.kazanan === null;
    var baslik = d.sonuc === 'mat' ? 'Mat!' : d.sonuc === 'pat' ? 'Pat' : 'Berabere';
    damgaGoster(baslik, '', true);
    durumYaz(berabere ? 'Oyun berabere bitti.' : kazandin ? 'Kazandın!' : 'Bilgisayar kazandı.');
    if (!s.sayildi) {
      s.sayildi = true;
      var i = istatistik();
      i.oyun++;
      if (berabere) i.bera++; else if (kazandin) { i.kazan++; i.enSeviye = Math.max(i.enSeviye, s.seviye); } else i.kaybet++;
      Depo.yaz(IST, i); ozetYaz();
    }
    kaydet();
    var ust = berabere ? 'Beraberlik' : kazandin ? 'Kazandın' : 'Kaybettin';
    $('sonuc-ust').textContent = ust;
    var bas = $('sonuc-baslik'); bas.textContent = baslik; bas.className = !berabere && !kazandin ? 'kaybetti' : '';
    $('sonuc-metin').textContent = sonucMetin + '.';
    $('sonuc-ozet').textContent = s.oyun.hamleler.length + ' hamle · ' + dk(s.sure) + ' · Seviye ' + s.seviye + ' (' + SEVIYE_AD[s.seviye] + ')';
    setTimeout(function () { var dlg = $('sonuc'); if (!dlg.open && s.bitti && typeof dlg.showModal === 'function') dlg.showModal(); }, 900);
    yanPanel();
  }

  // ---------- Seçim ve hamle girişi ----------
  function sahipTas(k) { var x = s.oyun.konum.t[k]; return x && ((x & 8) >> 3) === s.ben; }
  function sec(k) {
    s.secili = k; s.ipucuKare = -1;
    var ms = s.oyun.yasal();
    s.hedefler = ms.filter(function (m) { return M.hamleDen(m) === k; });
    s.odak = k;
    ciz();
  }
  function birak() { s.secili = -1; s.hedefler = []; ciz(); }
  function hedefeGit(hd) {
    var adaylar = s.hedefler.filter(function (m) { return M.hamleHedef(m) === hd; });
    if (!adaylar.length) return false;
    if (adaylar.length > 1 && M.hamleTerfi(adaylar[0])) { terfiSor(adaylar); return true; }
    kullaniciHamlesi(adaylar[0]);
    return true;
  }
  function terfiSor(adaylar) {
    s.terfi = adaylar;
    var h = '';
    [5, 4, 3, 2].forEach(function (t) {
      h += '<button type="button" data-terfi="' + t + '" aria-label="' + TERFI_AD[t] + '">' + tasSvg(t | (s.ben << 3), 'tas-terfi') + '<span>' + TERFI_AD[t] + '</span></button>';
    });
    var kutu = $('terfi'); kutu.innerHTML = h; kutu.hidden = false;
    kutu.querySelectorAll('svg').forEach(function (e) { e.style.cssText = 'position:static;width:34px;height:34px;overflow:visible'; });
    durumYaz('Terfi için bir taş seç.');
    ciz();
    var ilk = kutu.querySelector('button'); if (ilk) ilk.focus();
  }
  $('terfi').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-terfi]'); if (!b || !s.terfi) return;
    var t = Number(b.dataset.terfi), m = s.terfi.filter(function (x) { return M.hamleTerfi(x) === t; })[0];
    if (m) { s.terfi = null; kullaniciHamlesi(m); }
  });

  function tikla(k) {
    if (!benimSiram()) return;
    if (s.secili >= 0 && s.secili !== k && hedefeGit(k)) return;
    if (sahipTas(k)) { if (s.secili === k) birak(); else sec(k); }
    else if (s.secili >= 0) birak();
  }

  // Dokunma ve sürükleme (işaretçi olayları); klavye için düğmenin kendi click olayı.
  var asagi = null, hayalet = null;
  tahtaEl.addEventListener('pointerdown', function (e) {
    var kb = e.target.closest('.kare'); if (!kb || e.button > 0) return;
    var k = Number(kb.dataset.k);
    asagi = { k: k, x: e.clientX, y: e.clientY, surukle: false, id: e.pointerId, secildi: s.secili === k };
    if (benimSiram() && sahipTas(k) && s.secili !== k) { sec(k); }
    try { tahtaEl.setPointerCapture(e.pointerId); } catch (x) { /* eski tarayıcı */ }
  });
  tahtaEl.addEventListener('pointermove', function (e) {
    if (!asagi || e.pointerId !== asagi.id) return;
    if (!asagi.surukle) {
      if (Math.abs(e.clientX - asagi.x) + Math.abs(e.clientY - asagi.y) < 8 || !benimSiram() || !sahipTas(asagi.k)) return;
      asagi.surukle = true;
      var x = s.oyun.konum.t[asagi.k];
      var kare = tahtaEl.querySelector('.kare[data-k="' + asagi.k + '"]'); if (kare) kare.classList.add('surukleniyor');
      var boyut = tahtaEl.clientWidth / 8;
      hayalet = document.createElement('div');
      hayalet.innerHTML = tasSvg(x, 'surukle-tas');
      hayalet = hayalet.firstChild; hayalet.style.width = hayalet.style.height = boyut + 'px';
      document.body.appendChild(hayalet);
    }
    hayalet.style.left = e.clientX + 'px'; hayalet.style.top = e.clientY + 'px';
  });
  function suruklemeBitir() { if (hayalet) { hayalet.remove(); hayalet = null; } var kare = tahtaEl.querySelector('.surukleniyor'); if (kare) kare.classList.remove('surukleniyor'); }
  tahtaEl.addEventListener('pointerup', function (e) {
    if (!asagi || e.pointerId !== asagi.id) return;
    var a = asagi; asagi = null;
    if (a.surukle) {
      suruklemeBitir();
      var el = document.elementFromPoint(e.clientX, e.clientY), kb = el && el.closest ? el.closest('.kare') : null;
      if (kb && Number(kb.dataset.k) !== a.k && hedefeGit(Number(kb.dataset.k))) return;
      ciz(); return;
    }
    var kb2 = e.target.closest ? e.target.closest('.kare') : null;
    var k = kb2 ? Number(kb2.dataset.k) : a.k;
    if (a.secildi && s.secili === k) { birak(); return; }
    if (s.secili === k && !a.secildi) return; // bu dokunuşla yeni seçildi
    tikla(k);
  });
  tahtaEl.addEventListener('pointercancel', function () { asagi = null; suruklemeBitir(); ciz(); });
  tahtaEl.addEventListener('click', function (e) { if (e.detail !== 0) return; var kb = e.target.closest('.kare'); if (kb) tikla(Number(kb.dataset.k)); });
  tahtaEl.addEventListener('keydown', function (e) {
    var kb = e.target.closest('.kare'); if (!kb) return;
    var yon = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (e.key === 'Escape' && s.secili >= 0) { birak(); return; }
    if (!yon) return;
    e.preventDefault();
    var g = gorunum(Number(kb.dataset.k)), c = Math.max(0, Math.min(7, g.c + yon[0])), r = Math.max(0, Math.min(7, g.r + yon[1]));
    var f = s.cevrik ? 7 - c : c, rank = s.cevrik ? r : 7 - r, k = rank * 16 + f;
    s.odak = k; ciz();
    var yeni = tahtaEl.querySelector('.kare[data-k="' + k + '"]'); if (yeni) yeni.focus();
  });

  // ---------- Günün Bulmacası ----------
  function bulmacaKur() {
    dusunmeyiIptalEt();
    if (!BULMACALAR.length) { durumYaz('Bulmaca bulunamadı.', 'yanlis'); return; }
    var idx = M.bulmacaSirasi(bugun(), BULMACALAR.length), puz = BULMACALAR[idx];
    s.oyun = new M.Oyun(puz.fen); ilkKonum = null;
    s.ben = s.oyun.konum.sira; s.cevrik = s.ben === SIYAH; s.bitti = false; s.sonHamle = 0; s.secili = -1; s.hedefler = []; s.terfi = null; s.ipucuKare = -1; s.odak = -1;
    s.durum = s.oyun.durum();
    s.bulmaca = { idx: idx, n: puz.n, kalan: puz.n, hata: 0, cozuldu: false, kazananlar: M.matHamleleri(s.oyun.konum, puz.n) };
    damgaEl.hidden = true; $('terfi').hidden = true; $('dusunuyor').hidden = true;
    var kayit = bulmacaKaydi();
    var cozuldu = kayit.gun === bugun() && kayit.durum === 'cozuldu';
    adlariYaz(); ciz();
    var tarafAdi = s.ben === BEYAZ ? 'Beyaz' : 'Siyah';
    durumYaz(cozuldu ? 'Bugünkü bulmacayı çözdün. Seri: ' + kayit.seri.sayi + ' gün. İstersen tekrar çözebilirsin.' :
      tarafAdi + ' oynar ve ' + puz.n + ' hamlede mat eder' + (s.bulmaca.n === 1 ? ' (tek hamle).' : '.'), cozuldu ? 'dogru' : '');
    $('acilis').textContent = '';
  }
  function bulmacaHamlesi(m) {
    var b = s.bulmaca;
    if (!b || b.cozuldu) return;
    if (b.kazananlar.indexOf(m) < 0) {
      b.hata++;
      var kayit = bulmacaKaydi();
      if (kayit.gun !== bugun()) { kayit = { gun: bugun(), durum: 'denendi', hata: 0, seri: kayit.seri, cozulen: kayit.cozulen }; }
      kayit.hata = (kayit.hata || 0) + 1; if (kayit.durum !== 'cozuldu') kayit.durum = 'denendi';
      Depo.yaz(BUL, kayit);
      window.Gunluk && window.Gunluk.kaydet('satranc', { durum: 'yarim', ozet: '' });
      s.secili = -1; s.hedefler = []; ciz();
      tahtaEl.classList.remove('sallanma'); void tahtaEl.offsetWidth; tahtaEl.classList.add('sallanma');
      durumYaz('Bu hamle ' + (b.kalan === 1 ? 'mat getirmiyor' : 'zorunlu mata götürmüyor') + '. Tekrar dene.', 'yanlis');
      return;
    }
    var d = uygula(m, 'ben');
    if (d.sonuc === 'mat') return bulmacaCozuldu();
    // Rakibin cevabı, sonra kalan hamlelerde yine mat aranır.
    b.kalan--;
    s.bekle = true;
    durumYaz('Doğru yol! Rakip cevap veriyor…', 'dogru');
    setTimeout(function () {
      if (s.mod !== 'bulmaca') return;
      var cevap = M.savunmaHamlesi(s.oyun.konum);
      uygula(cevap, 'pc');
      s.bekle = false;
      b.kazananlar = M.matHamleleri(s.oyun.konum, b.kalan);
      durumYaz('Şimdi mat et.', '');
    }, 520);
  }
  function bulmacaCozuldu() {
    var b = s.bulmaca; b.cozuldu = true; s.bitti = true;
    var kayit = bulmacaKaydi(), bu = bugun(), ilkKez = !(kayit.gun === bu && kayit.durum === 'cozuldu');
    if (ilkKez) {
      var seri = kayit.seri;
      seri = { son: bu, sayi: seri.son === dun() ? seri.sayi + 1 : (seri.son === bu ? seri.sayi : 1) };
      kayit = { gun: bu, durum: 'cozuldu', hata: kayit.gun === bu ? kayit.hata : 0, seri: seri, cozulen: kayit.cozulen + 1 };
      Depo.yaz(BUL, kayit);
      window.Gunluk && window.Gunluk.kaydet('satranc', { durum: 'bitti', ozet: b.n + ' hamlede mat' + (seri.sayi > 1 ? ' · seri ' + seri.sayi : '') });
      ozetYaz();
    }
    damgaGoster('Mat!', 'onay', true);
    durumYaz('Doğru! ' + b.n + ' hamlede mat ettin.' + (kayit.seri.sayi ? ' Seri: ' + kayit.seri.sayi + ' gün.' : ''), 'dogru');
    $('geri-al').disabled = true;
  }
  function bulmacaIpucu() {
    var b = s.bulmaca; if (!b || b.cozuldu || s.bekle) return;
    var m = b.kazananlar[0]; if (!m) return;
    s.ipucuKare = M.hamleDen(m); s.ipucu = true; ciz();
    durumYaz('İpucu: işaretli taşla oyna.');
  }

  // ---------- Yeni oyun, mod, yardımcı düğmeler ----------
  function yeniOyun(seviye, renk, ipucu) {
    dusunmeyiIptalEt();
    s.mod = 'bilgisayar'; s.seviye = seviye; s.renkTercih = renk; s.ipucu = ipucu; s.bulmaca = null;
    s.ben = renk === 'siyah' ? SIYAH : renk === 'beyaz' ? BEYAZ : (Math.random() < 0.5 ? BEYAZ : SIYAH);
    s.oyun = new M.Oyun(); ilkKonum = null; s.cevrik = s.ben === SIYAH;
    s.bitti = false; s.sayildi = false; s.sure = 0; s.sonHamle = 0; s.secili = -1; s.hedefler = []; s.terfi = null; s.ipucuKare = -1; s.odak = -1;
    s.durum = s.oyun.durum();
    damgaEl.hidden = true; $('terfi').hidden = true; $('devam-bilgi').hidden = true;
    modGorunumu(); adlariYaz(); ciz(); durumGuncelle(); tercihKaydet(); kaydet();
    bilgisayarSirasi();
  }
  function modGorunumu() {
    document.querySelectorAll('.mod-secimi .buton').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mod === s.mod ? 'true' : 'false'); });
    $('bulmaca-ust').hidden = s.mod !== 'bulmaca';
    $('geri-al').querySelector('span').textContent = 'Geri al';
    $('yeni-oyun').querySelector('span').textContent = s.mod === 'bulmaca' ? 'Tekrar dene' : 'Yeni oyun';
    $('ipucu').querySelector('span').textContent = 'İpucu';
  }
  function modDegistir(mod) {
    if (mod === s.mod) return;
    if (mod === 'bulmaca') {
      s.mod = 'bulmaca'; s.ipucu = false; modGorunumu(); bulmacaKur();
    } else {
      var k = Depo.oku(KAYIT, null);
      s.mod = 'bilgisayar'; s.bulmaca = null; modGorunumu();
      if (k && k.h) kayittanYukle(k); else yeniOyun(s.seviye, s.renkTercih, s.ipucu);
    }
  }
  function kayittanYukle(k) {
    dusunmeyiIptalEt();
    try {
      s.oyun = new M.Oyun(k.fen); ilkKonum = null;
      for (var i = 0; i < k.h.length; i++) { var m = M.hamleBul(s.oyun.konum, k.h[i]); if (!m) throw new Error('bozuk kayıt'); s.oyun.yap(m); }
    } catch (e) { return yeniOyun(s.seviye, s.renkTercih, s.ipucu); }
    s.mod = 'bilgisayar'; s.ben = k.ben === SIYAH ? SIYAH : BEYAZ; s.seviye = k.seviye >= 1 && k.seviye <= 5 ? k.seviye : 3; s.ipucu = !!k.ipucu; s.cevrik = !!k.cevrik;
    s.sure = k.sure || 0; s.sayildi = !!k.sayildi; s.secili = -1; s.hedefler = []; s.terfi = null; s.ipucuKare = -1; s.odak = -1;
    s.sonHamle = s.oyun.hamleler.length ? s.oyun.hamleler[s.oyun.hamleler.length - 1] : 0;
    s.durum = s.oyun.durum(); s.bitti = s.durum.bitti; s.bulmaca = null;
    damgaEl.hidden = true; $('terfi').hidden = true;
    modGorunumu(); adlariYaz(); ciz();
    if (s.bitti) {
      var kazandin = s.durum.kazanan === s.ben, bera = s.durum.kazanan === null;
      damgaGoster(s.durum.sonuc === 'mat' ? 'Mat!' : s.durum.sonuc === 'pat' ? 'Pat' : 'Berabere', '', true);
      durumYaz(bera ? 'Oyun berabere bitti.' : kazandin ? 'Kazandın!' : 'Bilgisayar kazandı.');
    } else {
      if (s.oyun.hamleler.length) $('devam-bilgi').hidden = false;
      durumGuncelle(); bilgisayarSirasi();
    }
  }

  $('geri-al').addEventListener('click', function () {
    if (s.mod !== 'bilgisayar') return;
    var ilk = fenSira0().sira, n = s.oyun.hamleler.length, hedefN = -1;
    for (var i = n - 1; i >= 0; i--) if (((ilk + i) & 1) === s.ben) { hedefN = i; break; }
    if (hedefN < 0) return;
    dusunmeyiIptalEt();
    while (s.oyun.hamleler.length > hedefN) s.oyun.geriAl();
    s.bitti = false; s.sayildi = false; damgaEl.hidden = true; $('sonuc').open && $('sonuc').close();
    s.sonHamle = s.oyun.hamleler.length ? s.oyun.hamleler[s.oyun.hamleler.length - 1] : 0;
    s.secili = -1; s.hedefler = []; s.terfi = null; $('terfi').hidden = true;
    s.durum = s.oyun.durum();
    ciz(); durumGuncelle(); kaydet();
  });
  $('cevir').addEventListener('click', function () { s.cevrik = !s.cevrik; s.odak = -1; ciz(); kaydet(); });
  $('ipucu').addEventListener('click', function () {
    if (s.mod === 'bulmaca') return bulmacaIpucu();
    s.ipucu = !s.ipucu; tercihKaydet(); kaydet(); ciz();
    durumYaz(s.ipucu ? 'İpucu açık: tehdit altındaki taşlarında kırmızı üçgen görünür.' : 'İpucu kapalı.');
  });
  $('yeni-oyun').addEventListener('click', function () {
    if (s.mod === 'bulmaca') { bulmacaKur(); return; }
    ayarAc();
  });
  document.querySelectorAll('.mod-secimi .buton').forEach(function (b) { b.addEventListener('click', function () { modDegistir(b.dataset.mod); }); });
  $('tekrar-oyna').addEventListener('click', function () { $('sonuc').close(); yeniOyun(s.seviye, s.renkTercih, s.ipucu); });

  // PGN
  var pgnZaman = 0;
  $('pgn-kopyala').addEventListener('click', function () {
    var d = new Date(), t = d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
    var bilgisayarAdi = 'Her Gece Oyun Bilgisayar (Seviye ' + s.seviye + ')';
    var pgn = s.oyun.pgn({ tarih: t, beyaz: s.ben === BEYAZ ? 'Sen' : bilgisayarAdi, siyah: s.ben === SIYAH ? 'Sen' : bilgisayarAdi });
    function bitti() { durumYaz('PGN panoya kopyalandı.'); clearTimeout(pgnZaman); pgnZaman = setTimeout(durumGuncelle, 2200); }
    function yedek() {
      var ta = document.createElement('textarea'); ta.value = pgn; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); bitti(); } catch (e) { durumYaz('Kopyalanamadı.', 'yanlis'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pgn).then(bitti, yedek); else yedek();
  });

  // Ayar penceresi
  function secimiIsaretle(kapsayici, ozellik, deger) {
    $(kapsayici).querySelectorAll('.buton').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset[ozellik] === String(deger) ? 'true' : 'false'); });
  }
  var secSeviye = 3, secRenk = 'beyaz';
  function ayarAc() {
    secSeviye = s.seviye; secRenk = s.renkTercih;
    secimiIsaretle('seviye-secimi', 'seviye', secSeviye); secimiIsaretle('renk-secimi', 'renk', secRenk);
    $('ipucu-modu').checked = s.ipucu;
    var dlg = $('ayarlar'); if (typeof dlg.showModal === 'function') dlg.showModal();
  }
  $('seviye-secimi').addEventListener('click', function (e) { var b = e.target.closest('.buton'); if (b) { secSeviye = Number(b.dataset.seviye); secimiIsaretle('seviye-secimi', 'seviye', secSeviye); } });
  $('renk-secimi').addEventListener('click', function (e) { var b = e.target.closest('.buton'); if (b) { secRenk = b.dataset.renk; secimiIsaretle('renk-secimi', 'renk', secRenk); } });
  $('oyunu-baslat').addEventListener('click', function () { $('ayarlar').close(); yeniOyun(secSeviye, secRenk, $('ipucu-modu').checked); });

  // İstatistik
  $('istatistik-ac').addEventListener('click', function () {
    var i = istatistik(), b = bulmacaKaydi();
    $('i-oyun').textContent = i.oyun; $('i-kazan').textContent = i.kazan; $('i-bera').textContent = i.bera;
    $('i-seviye').textContent = i.enSeviye ? i.enSeviye : '–';
    var seriGecerli = b.seri.son === bugun() || b.seri.son === dun();
    $('i-seri').textContent = seriGecerli ? b.seri.sayi : 0; $('i-bulmaca').textContent = b.cozulen;
    var dlg = $('istatistik'); if (typeof dlg.showModal === 'function') dlg.showModal();
  });

  // Süre: yalnızca oyun sürerken ve sayfa görünürken işler.
  setInterval(function () {
    if (s.mod !== 'bilgisayar' || s.bitti || document.hidden || !s.oyun.hamleler.length) return;
    s.sure++; $('sure').textContent = dk(s.sure);
    if (s.sure % 5 === 0) kaydet();
  }, 1000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) kaydet(); });
  window.addEventListener('pagehide', kaydet);

  // Hamle listesi: dar ekranda kapalı, geniş ekranda açık.
  var dar = window.matchMedia('(max-width: 959px)');
  function listeDurumu() { $('hamleler').open = !dar.matches; }
  listeDurumu();
  if (dar.addEventListener) dar.addEventListener('change', listeDurumu);

  // ---------- Başlangıç ----------
  var kayitli = Depo.oku(KAYIT, null);
  if (kayitli && kayitli.h) {
    kayittanYukle(kayitli);
    $('sure').textContent = dk(s.sure);
  } else {
    yeniOyun(s.seviye, s.renkTercih, s.ipucu);
    if (!Depo.oku(TERCIH, null) || !tercih.seviye) setTimeout(function () { /* ilk açılışta ayarlar kullanıcıya sunulur */ ayarAc(); }, 250);
  }
  ozetYaz();
  window.__satranc = s;
})();
