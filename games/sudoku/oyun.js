// Sudoku arayüzü: ızgara, rakam tuşları, kalem notları, iki aşamalı Türkçe ipucu, günlük bulmaca, kayıt ve istatistik.
(function () {
  'use strict';
  var M = window.SudokuMantik;
  var TERCIH = 'sudoku:tercih', IST = 'sudoku:istatistik';
  var azHareket = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }
  var izgaraEl = $('izgara'), durumEl = $('durum');

  var tercih = Depo.oku(TERCIH, null) || {};
  var s = {
    mod: Depo.oku('sudoku:aktif', 'serbest'), seviye: tercih.seviye || 'orta', hataGoster: tercih.hataGoster !== false,
    bulmaca: null, cozum: null, girdi: null, notlar: null, secili: -1, kalem: false, sure: 0, hata: 0, ipucuKalan: 0,
    bitti: false, sayildi: false, basladi: false, gun: '', bekleyenIpucu: null, duraklat: false, gecmis: [], gecmisNo: 0, hazir: false
  };

  // ---------- Yardımcılar ----------
  function dk(sn) { return ('0' + Math.floor(sn / 60)).slice(-2) + ':' + ('0' + (sn % 60)).slice(-2); }
  function bugun() { return window.Gunluk ? window.Gunluk.gunAnahtari(new Date()) : new Date().toISOString().slice(0, 10); }
  function dun() { var d = new Date(); d.setDate(d.getDate() - 1); return window.Gunluk ? window.Gunluk.gunAnahtari(d) : d.toISOString().slice(0, 10); }
  function metni(dizi) { return dizi.join(''); }
  function diziye(metin) { var a = new Array(81); for (var i = 0; i < 81; i++) a[i] = Number(metin.charAt(i)) || 0; return a; }
  function durumYaz(metin, sinif) { durumEl.textContent = metin || ''; durumEl.className = 'durum' + (sinif ? ' ' + sinif : ''); }
  function verilenMi(i) { return s.bulmaca[i] !== 0; }
  function deger(i) { return s.bulmaca[i] || s.girdi[i]; }
  function izgara() { var g = new Array(81); for (var i = 0; i < 81; i++) g[i] = deger(i); return g; }
  function kayitAnahtari(mod) { return 'sudoku:oyun-' + mod; }

  // ---------- Çizim ----------
  function kurIzgara() {
    var h = '';
    for (var i = 0; i < 81; i++) {
      var r = Math.floor(i / 9), c = i % 9;
      h += '<button type="button" class="hucre' + (c === 2 || c === 5 ? ' sag3' : '') + (r === 2 || r === 5 ? ' alt3' : '') + (c === 8 ? ' son-sutun' : '') + (r === 8 ? ' son-satir' : '') +
        '" data-i="' + i + '" style="--s:' + r + '" tabindex="' + (i === 40 ? 0 : -1) + '"></button>';
    }
    izgaraEl.innerHTML = h;
  }
  function etiket(i) {
    var d = deger(i), r = Math.floor(i / 9) + 1, c = (i % 9) + 1;
    var metin = 'Satır ' + r + ', sütun ' + c + ', ';
    if (verilenMi(i)) return metin + 'verilen ' + d;
    if (d) return metin + d;
    var n = notListesi(i);
    return metin + 'boş' + (n.length ? ', notlar ' + n.join(' ') : '');
  }
  function notListesi(i) { var l = []; for (var d = 1; d <= 9; d++) if (s.notlar[i] & (1 << (d - 1))) l.push(d); return l; }

  function ciz() {
    if (!s.hazir) return;
    var g = izgara(), kotu = {}, secD = s.secili >= 0 ? g[s.secili] : 0, ipucuBirim = {};
    if (s.hataGoster) {
      M.cakisanlar(g).forEach(function (i) { kotu[i] = true; });
      for (var q = 0; q < 81; q++) if (s.girdi[q] && s.girdi[q] !== s.cozum[q]) kotu[q] = true;
    }
    if (s.bekleyenIpucu && s.bekleyenIpucu.birim >= 0) M.BIRIMLER[s.bekleyenIpucu.birim].forEach(function (i) { ipucuBirim[i] = true; });
    var akran = {};
    if (s.secili >= 0) M.AKRAN[s.secili].forEach(function (i) { akran[i] = true; });
    var el = izgaraEl.children;
    for (var i = 0; i < 81; i++) {
      var d = g[i], c = el[i], sinif = 'hucre' + (c.classList.contains('sag3') ? ' sag3' : '') + (c.classList.contains('alt3') ? ' alt3' : '') + (c.classList.contains('son-sutun') ? ' son-sutun' : '') + (c.classList.contains('son-satir') ? ' son-satir' : '');
      if (verilenMi(i)) sinif += ' verilen';
      if (akran[i]) sinif += ' akran';
      if (secD && d === secD && i !== s.secili) sinif += ' ayni';
      if (i === s.secili) sinif += ' secili';
      if (kotu[i]) sinif += ' cakisma';
      if (ipucuBirim[i]) sinif += ' ipucu-birim';
      if (s.bekleyenIpucu && s.bekleyenIpucu.kutu === i) sinif += ' ipucu-hedef';
      if (s.bekleyenIpucu && s.bekleyenIpucu.yanlis === i) sinif += ' ipucu-hedef';
      c.className = sinif;
      var icerik;
      if (d) icerik = '<span class="rakam">' + d + '</span>';
      else if (s.notlar[i]) { icerik = '<span class="notlar" aria-hidden="true">'; for (var n = 1; n <= 9; n++) icerik += '<i>' + ((s.notlar[i] & (1 << (n - 1))) ? n : '') + '</i>'; icerik += '</span>'; }
      else icerik = '';
      if (c.innerHTML !== icerik) c.innerHTML = icerik;
      c.setAttribute('aria-label', etiket(i));
      c.setAttribute('aria-pressed', i === s.secili ? 'true' : 'false');
    }
    izgaraEl.classList.toggle('bitti', s.bitti);
    tuslariYaz(g);
    $('seviye-rozet').textContent = (s.mod === 'gunluk' ? 'Günlük · ' : '') + M.SEVIYE_AD[s.seviye];
    var hataEl = $('hata-sayi'); hataEl.hidden = !s.hataGoster; hataEl.textContent = 'Hata ' + s.hata;
    $('sure').textContent = dk(s.sure);
    $('geri-al').disabled = s.gecmisNo <= 0 || s.bitti;
    $('yinele').disabled = s.gecmisNo >= s.gecmis.length - 1 || s.bitti;
    $('kalem').setAttribute('aria-pressed', s.kalem ? 'true' : 'false');
    $('tuslar').classList.toggle('kalemde', s.kalem);
    var ipucuBtn = $('ipucu'), bekle = !!s.bekleyenIpucu && s.bekleyenIpucu.kutu !== undefined;
    $('ipucu-etiket').textContent = bekle ? 'Yerleştir' : 'İpucu ' + s.ipucuKalan;
    ipucuBtn.disabled = s.bitti || (!bekle && s.ipucuKalan <= 0);
    var kutu = $('ipucu-kutu');
    if (s.bekleyenIpucu) { kutu.hidden = false; kutu.innerHTML = '<p>' + s.bekleyenIpucu.aciklama + '</p>' + (s.bekleyenIpucu.kutu !== undefined ? '<small>Rakamı yerleştirmek için İpucu düğmesine tekrar dokun.</small>' : ''); }
    else kutu.hidden = true;
  }
  function tuslariYaz(g) {
    var say = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < 81; i++) if (g[i] && (verilenMi(i) || g[i] === s.cozum[i] || !s.hataGoster)) say[g[i]]++;
    var kutu = $('tuslar'), h = '';
    if (!kutu.children.length) {
      for (var d = 1; d <= 9; d++) h += '<button type="button" class="tus" data-rakam="' + d + '"><span>' + d + '</span><small></small></button>';
      kutu.innerHTML = h;
    }
    for (var k = 1; k <= 9; k++) {
      var b = kutu.children[k - 1], kalan = 9 - say[k];
      b.querySelector('small').textContent = kalan > 0 ? kalan : '';
      b.disabled = kalan <= 0 || s.bitti;
      b.setAttribute('aria-label', k + (kalan > 0 ? ', ' + kalan + ' tane kaldı' : ', tamamlandı'));
    }
  }

  // ---------- Hamleler ve geçmiş ----------
  function anlik() { return { g: s.girdi.slice(), n: s.notlar.slice() }; }
  function gecmiseYaz() {
    s.gecmis = s.gecmis.slice(0, s.gecmisNo + 1);
    s.gecmis.push(anlik());
    if (s.gecmis.length > 300) s.gecmis.shift();
    s.gecmisNo = s.gecmis.length - 1;
  }
  function geriGit(yon) {
    var no = s.gecmisNo + yon;
    if (no < 0 || no >= s.gecmis.length || s.bitti) return;
    s.gecmisNo = no; s.girdi = s.gecmis[no].g.slice(); s.notlar = s.gecmis[no].n.slice();
    s.bekleyenIpucu = null; ciz(); kaydet();
  }
  function ipucuIptal() { if (s.bekleyenIpucu) s.bekleyenIpucu = null; }

  function rakamGir(d) {
    if (s.bitti || s.secili < 0) { if (s.secili < 0 && !s.bitti) durumYaz('Önce bir kutu seç.'); return; }
    var i = s.secili;
    if (verilenMi(i)) { durumYaz('Bu kutu başlangıçta verilmiş, değiştirilemez.'); return; }
    ipucuIptal(); durumYaz('');
    baslat();
    if (s.kalem) {
      if (s.girdi[i]) return;
      s.notlar[i] ^= (1 << (d - 1));
    } else {
      if (s.girdi[i] === d) { s.girdi[i] = 0; }
      else {
        s.girdi[i] = d; s.notlar[i] = 0;
        if (d !== s.cozum[i]) s.hata++;
        var ak = M.AKRAN[i];
        for (var q = 0; q < ak.length; q++) s.notlar[ak[q]] &= ~(1 << (d - 1));
      }
    }
    gecmiseYaz(); ciz(); kaydet();
    bitisKontrol();
  }
  function sil() {
    if (s.bitti || s.secili < 0) return;
    var i = s.secili;
    if (verilenMi(i) || (!s.girdi[i] && !s.notlar[i])) return;
    ipucuIptal(); s.girdi[i] = 0; s.notlar[i] = 0; gecmiseYaz(); ciz(); kaydet();
  }
  function sec(i) { s.secili = i; ipucuIptal(); ciz(); }

  // ---------- İpucu ----------
  function ipucuIste() {
    if (s.bitti) return;
    if (s.bekleyenIpucu && s.bekleyenIpucu.kutu !== undefined) { // ikinci dokunuş: yerleştir
      var h = s.bekleyenIpucu, i = h.kutu;
      s.bekleyenIpucu = null; s.secili = i;
      s.girdi[i] = h.rakam; s.notlar[i] = 0;
      M.AKRAN[i].forEach(function (q) { s.notlar[q] &= ~(1 << (h.rakam - 1)); });
      gecmiseYaz(); ciz(); kaydet(); bitisKontrol(); return;
    }
    if (s.ipucuKalan <= 0) return;
    var onerilen = M.ipucuBul(izgara(), s.cozum);
    if (!onerilen) return;
    baslat();
    if (onerilen.yanlis !== undefined) { s.bekleyenIpucu = { yanlis: onerilen.yanlis, aciklama: onerilen.aciklama }; s.secili = onerilen.yanlis; ciz(); return; }
    s.ipucuKalan--; s.bekleyenIpucu = onerilen; s.secili = onerilen.kutu;
    ciz(); kaydet();
  }

  // ---------- Süre ve kayıt ----------
  function baslat() {
    if (s.duraklat) { s.duraklat = false; $('devam').hidden = true; }
    if (!s.basladi && s.hazir && !s.bitti) {
      s.basladi = true;
      var ist = istatistik();
      if (!(s.mod === 'gunluk' && s.sayildi)) { ist.oyun++; Depo.yaz(IST, ist); }
      if (s.mod === 'gunluk' && !s.sayildi) window.Gunluk && window.Gunluk.kaydet('sudoku', { durum: 'yarim', ozet: M.SEVIYE_AD[s.seviye] });
    }
  }
  setInterval(function () {
    if (!s.hazir || s.bitti || s.duraklat || document.hidden) return;
    s.sure++; $('sure').textContent = dk(s.sure);
    if (s.sure % 5 === 0) kaydet();
  }, 1000);
  function kaydet() {
    if (!s.hazir) return;
    Depo.yaz(kayitAnahtari(s.mod), { mod: s.mod, seviye: s.seviye, gun: s.gun, bulmaca: metni(s.bulmaca), cozum: metni(s.cozum), girdi: metni(s.girdi), notlar: s.notlar, sure: s.sure, hata: s.hata, ipucuKalan: s.ipucuKalan, bitti: s.bitti, sayildi: s.sayildi, basladi: s.basladi });
    Depo.yaz('sudoku:aktif', s.mod);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) kaydet(); });
  window.addEventListener('pagehide', kaydet);
  function tercihKaydet() { Depo.yaz(TERCIH, { seviye: s.seviye, hataGoster: s.hataGoster }); }

  function istatistik() {
    var i = Depo.oku(IST, null) || {};
    return { oyun: i.oyun || 0, bitti: i.bitti || 0, enIyi: i.enIyi || {}, seri: i.seri && i.seri.sayi ? i.seri : { son: '', sayi: 0 }, gunluk: i.gunluk || '' };
  }
  function ozetYaz() {
    var i = istatistik(), seriGecerli = i.seri.son === bugun() || i.seri.son === dun(), metin = '';
    var enIyiSeviye = M.SEVIYELER.slice().reverse().filter(function (v) { return i.enIyi[v]; })[0];
    if (enIyiSeviye) metin = 'En iyi ' + M.SEVIYE_AD[enIyiSeviye] + ' ' + dk(i.enIyi[enIyiSeviye]);
    if (seriGecerli && i.seri.sayi) metin = 'Seri ' + i.seri.sayi + (metin ? ' · ' + metin : '');
    Depo.ozetYaz('sudoku', metin);
  }

  // ---------- Bitiş ----------
  function bitisKontrol() {
    for (var i = 0; i < 81; i++) if (deger(i) !== s.cozum[i]) return;
    s.bitti = true; s.bekleyenIpucu = null; s.secili = -1;
    var ist = istatistik(), seriBilgi = '';
    if (!s.sayildi) {
      s.sayildi = true; ist.bitti++;
      var onceki = ist.enIyi[s.seviye];
      if (!onceki || s.sure < onceki) ist.enIyi[s.seviye] = s.sure;
      if (s.mod === 'gunluk' && ist.gunluk !== s.gun) {
        ist.gunluk = s.gun;
        ist.seri = { son: s.gun, sayi: ist.seri.son === dun() ? ist.seri.sayi + 1 : (ist.seri.son === s.gun ? ist.seri.sayi : 1) };
        window.Gunluk && window.Gunluk.kaydet('sudoku', { durum: 'bitti', ozet: M.SEVIYE_AD[s.seviye] + ' · ' + dk(s.sure) + (ist.seri.sayi > 1 ? ' · seri ' + ist.seri.sayi : '') });
      }
      Depo.yaz(IST, ist); ozetYaz();
    }
    kaydet(); ciz();
    durumYaz('Bulmacayı çözdün!');
    var seri = istatistik().seri, gecerli = seri.son === bugun() || seri.son === dun();
    $('sonuc-baslik').textContent = 'Çözdün!';
    $('sonuc-ust').textContent = (s.mod === 'gunluk' ? 'Günlük · ' : '') + M.SEVIYE_AD[s.seviye];
    $('s-sure').textContent = dk(s.sure); $('s-hata').textContent = s.hata; $('s-seri').textContent = gecerli && seri.sayi ? seri.sayi : '–';
    var enIyi = istatistik().enIyi[s.seviye];
    $('sonuc-metin').textContent = enIyi === s.sure ? 'Bu seviyedeki en iyi sürenin!' : 'Bu seviyedeki en iyi süren ' + dk(enIyi) + '.';
    setTimeout(function () { var dlg = $('sonuc'); if (!dlg.open && s.bitti && typeof dlg.showModal === 'function') dlg.showModal(); }, azHareket ? 200 : 1200);
  }
  $('paylas').addEventListener('click', function () {
    var metin = 'Her Gece Oyun · Sudoku · ' + (s.mod === 'gunluk' ? s.gun + ' günlük · ' : '') + M.SEVIYE_AD[s.seviye] + ' · ' + dk(s.sure) + ' · ' + s.hata + ' hata\n' + location.origin + location.pathname;
    function tamam() { $('paylas').textContent = 'Kopyalandı'; setTimeout(function () { $('paylas').textContent = 'Paylaş'; }, 1800); }
    function yedek() {
      var ta = document.createElement('textarea'); ta.value = metin; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); tamam(); } catch (e) { /* kopyalanamadı */ }
      ta.remove();
    }
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) { navigator.share({ text: metin }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(metin).then(tamam, yedek); else yedek();
  });

  // ---------- Yeni oyun ----------
  var isci = null, isciNo = 0;
  try {
    isci = new Worker('isci.js');
    isci.onmessage = function (olay) { if (olay.data && olay.data.no === isciNo) bulmacaGeldi(olay.data); };
    isci.onerror = function () { isci = null; if (bekleyenIstek) uret(bekleyenIstek.mod, bekleyenIstek.seviye); };
  } catch (e) { isci = null; }
  var bekleyenIstek = null;

  function uret(mod, seviye) {
    s.hazir = false; bekleyenIstek = { mod: mod, seviye: seviye };
    durumYaz('Bulmaca hazırlanıyor…'); $('seviye-rozet').textContent = 'Hazırlanıyor';
    var no = ++isciNo, gun = bugun(), tohum = mod === 'gunluk' ? null : Math.random().toString(36).slice(2) + Date.now().toString(36);
    var istek = mod === 'gunluk' ? { no: no, gun: gun } : { no: no, tohum: tohum, seviye: seviye };
    if (isci) isci.postMessage(istek);
    else setTimeout(function () {
      var r = mod === 'gunluk' ? M.gunlukUret(gun) : M.uret(tohum, seviye);
      bulmacaGeldi({ no: no, bulmaca: r.bulmaca.join(''), cozum: r.cozum.join(''), seviye: r.seviye });
    }, 30);
  }
  function bulmacaGeldi(r) {
    var istek = bekleyenIstek || { mod: 'serbest' }; bekleyenIstek = null;
    s.mod = istek.mod; s.seviye = r.seviye; s.gun = istek.mod === 'gunluk' ? bugun() : '';
    s.bulmaca = diziye(r.bulmaca); s.cozum = diziye(r.cozum); s.girdi = new Array(81).fill(0); s.notlar = new Array(81).fill(0);
    s.secili = -1; s.kalem = false; s.sure = 0; s.hata = 0; s.ipucuKalan = M.IPUCU_HAKKI[s.seviye]; s.bitti = false; s.bekleyenIpucu = null;
    var ist = istatistik();
    s.sayildi = s.mod === 'gunluk' && ist.gunluk === s.gun; // günlük zaten bitirildiyse tekrar istatistiğe yazılmaz
    s.basladi = false; s.duraklat = false; s.hazir = true;
    s.gecmis = [anlik()]; s.gecmisNo = 0;
    $('devam').hidden = true; durumYaz('');
    ciz(); kaydet();
  }
  function yukle(k) {
    try {
      s.mod = k.mod; s.seviye = k.seviye; s.gun = k.gun || '';
      s.bulmaca = diziye(k.bulmaca); s.cozum = diziye(k.cozum); s.girdi = diziye(k.girdi); s.notlar = k.notlar.slice(0, 81);
      if (s.notlar.length !== 81) throw new Error('bozuk');
      s.sure = k.sure || 0; s.hata = k.hata || 0; s.ipucuKalan = k.ipucuKalan; s.bitti = !!k.bitti; s.sayildi = !!k.sayildi; s.basladi = !!k.basladi;
    } catch (e) { return false; }
    s.secili = -1; s.kalem = false; s.bekleyenIpucu = null; s.hazir = true; s.gecmis = [anlik()]; s.gecmisNo = 0;
    var ilerleme = false; for (var i = 0; i < 81; i++) if (s.girdi[i] || s.notlar[i]) ilerleme = true;
    s.duraklat = !s.bitti && ilerleme;
    ciz();
    if (s.bitti) durumYaz('Bu bulmacayı çözdün.');
    else if (s.duraklat) {
      $('devam').hidden = false;
      $('devam-metin').textContent = (s.mod === 'gunluk' ? 'Günlük ' : '') + M.SEVIYE_AD[s.seviye] + ' bulmaca · ' + dk(s.sure) + ' · yarım kalan oyun.';
    }
    return true;
  }
  function modYukle(mod) {
    var k = Depo.oku(kayitAnahtari(mod), null);
    if (mod === 'gunluk' && k && k.gun !== bugun()) k = null; // eski günün bulmacası geçersiz
    return k && k.bulmaca && k.cozum && yukle(k);
  }

  // ---------- Olaylar ----------
  izgaraEl.addEventListener('click', function (e) { var c = e.target.closest('.hucre'); if (c && s.hazir) { baslat(); sec(Number(c.dataset.i)); } });
  $('tuslar').addEventListener('click', function (e) { var b = e.target.closest('.tus'); if (b) rakamGir(Number(b.dataset.rakam)); });
  $('geri-al').addEventListener('click', function () { geriGit(-1); });
  $('yinele').addEventListener('click', function () { geriGit(1); });
  $('sil').addEventListener('click', sil);
  $('kalem').addEventListener('click', function () { s.kalem = !s.kalem; ciz(); });
  $('ipucu').addEventListener('click', ipucuIste);
  $('devam-et').addEventListener('click', function () { baslat(); });
  $('devam-yeni').addEventListener('click', function () { ayarAc(); });
  $('ayar-ac').addEventListener('click', ayarAc);
  $('sonuc-yeni').addEventListener('click', function () { $('sonuc').close(); ayarAc(); });

  document.addEventListener('keydown', function (e) {
    if (!s.hazir || e.ctrlKey || e.metaKey || e.altKey) { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && s.hazir) { e.preventDefault(); geriGit(e.shiftKey ? 1 : -1); } return; }
    if (document.querySelector('dialog[open]')) return;
    var odak = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.hucre') : null;
    if (/^[1-9]$/.test(e.key)) { rakamGir(Number(e.key)); return; }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { sil(); return; }
    if (e.key === 'n' || e.key === 'N' || (e.key === ' ' && !odak)) { if (e.key === ' ') e.preventDefault(); s.kalem = !s.kalem; ciz(); return; }
    var yon = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key];
    if (yon && (odak || s.secili >= 0)) {
      e.preventDefault();
      var i = s.secili >= 0 ? s.secili : Number(odak.dataset.i), c = i % 9, r = Math.floor(i / 9);
      if ((e.key === 'ArrowLeft' && c === 0) || (e.key === 'ArrowRight' && c === 8) || (e.key === 'ArrowUp' && r === 0) || (e.key === 'ArrowDown' && r === 8)) return;
      sec(i + yon);
      var hedef = izgaraEl.children[i + yon]; if (hedef) { Array.prototype.forEach.call(izgaraEl.children, function (x) { x.tabIndex = -1; }); hedef.tabIndex = 0; hedef.focus(); }
    }
  });

  // Ayar penceresi
  var secSeviye = s.seviye;
  function seviyeIsaretle() { $('seviye-secimi').querySelectorAll('.buton').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.seviye === secSeviye ? 'true' : 'false'); }); }
  function ayarAc() {
    secSeviye = s.seviye; seviyeIsaretle(); $('hata-goster').checked = s.hataGoster;
    var dlg = $('ayarlar'); if (typeof dlg.showModal === 'function') dlg.showModal();
  }
  $('seviye-secimi').addEventListener('click', function (e) { var b = e.target.closest('.buton'); if (b) { secSeviye = b.dataset.seviye; seviyeIsaretle(); } });
  $('oyunu-baslat').addEventListener('click', function () {
    $('ayarlar').close(); s.seviye = secSeviye; s.hataGoster = $('hata-goster').checked; tercihKaydet(); uret('serbest', secSeviye);
  });
  $('gunluk-baslat').addEventListener('click', function () {
    $('ayarlar').close(); s.hataGoster = $('hata-goster').checked; tercihKaydet();
    if (s.hazir) kaydet();
    if (modYukle('gunluk')) { Depo.yaz('sudoku:aktif', 'gunluk'); return; }
    uret('gunluk', M.gunSeviyesi(bugun()));
  });

  // İstatistik
  $('istatistik-ac').addEventListener('click', function () {
    var i = istatistik(), gecerli = i.seri.son === bugun() || i.seri.son === dun();
    $('i-oyun').textContent = i.oyun; $('i-bitti').textContent = i.bitti; $('i-seri').textContent = gecerli ? i.seri.sayi : 0;
    $('en-iyi').innerHTML = M.SEVIYELER.map(function (v) { return '<li><span>' + M.SEVIYE_AD[v] + '</span><strong>' + (i.enIyi[v] ? dk(i.enIyi[v]) : '–') + '</strong></li>'; }).join('');
    var dlg = $('istatistik'); if (typeof dlg.showModal === 'function') dlg.showModal();
  });

  // ---------- Başlangıç ----------
  kurIzgara();
  if (!modYukle(s.mod) && !modYukle(s.mod === 'gunluk' ? 'serbest' : 'gunluk')) {
    uret('serbest', s.seviye);
    if (!tercih.seviye) setTimeout(ayarAc, 400); // ilk açılışta seviye seçimi sunulur
  }
  ozetYaz();
  window.__sudoku = s;
})();
