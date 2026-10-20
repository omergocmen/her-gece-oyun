// Dama arayüzü: tahta, dokunma/sürükleme, çok duraklı yeme seçimi, bilgisayar (Web Worker), Günün Bulmacası, kayıt ve istatistik.
(function () {
  'use strict';
  var M = window.DamaMotor;
  var BULMACALAR = window.DamaBulmacalar || [];
  var ACIK = 0, KOYU = 1;
  var KAYIT = 'dama:oyun', TERCIH = 'dama:tercih', IST = 'dama:istatistik', BUL = 'dama:bulmaca';
  var SEVIYE_AD = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };
  var azHareket = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }
  var tahtaEl = $('tahta'), durumEl = $('durum'), damgaEl = $('damga'), seritEl = $('serit');

  var tercih = Depo.oku(TERCIH, null) || {};
  var s = {
    mod: 'bilgisayar', oyun: null, ben: ACIK, seviye: tercih.seviye || 2, renkTercih: tercih.renk || 'acik',
    tum: [], secili: -1, adim: 0, yol: [], adaylar: [], bekle: false, bitti: false, sayildi: false,
    sure: 0, sonHamle: null, odak: -1, ipucuKare: -1, bulmaca: null, no: 0
  };

  // ---------- Yardımcılar ----------
  function dk(sn) { return (sn >= 3600 ? Math.floor(sn / 3600) + ':' : '') + ('0' + Math.floor((sn % 3600) / 60)).slice(-2) + ':' + ('0' + (sn % 60)).slice(-2); }
  function bugun() { return window.Gunluk ? window.Gunluk.gunAnahtari(new Date()) : new Date().toISOString().slice(0, 10); }
  function dun() { var d = new Date(); d.setDate(d.getDate() - 1); return window.Gunluk ? window.Gunluk.gunAnahtari(d) : d.toISOString().slice(0, 10); }
  function renkAdi(r) { return r === ACIK ? 'açık' : 'koyu'; }
  function benimSiram() { return !s.bitti && !s.bekle && !!s.oyun && s.oyun.konum.sira === s.ben; }
  function gorunum(k) { // karenin ekrandaki sütun/satırı
    var r = k >> 3, c = k & 7;
    return s.ben === ACIK ? { c: c, r: 7 - r } : { c: 7 - c, r: r };
  }
  function durumYaz(metin, sinif) { durumEl.textContent = metin || ''; durumEl.className = 'durum' + (sinif ? ' ' + sinif : ''); }
  function kareEtiket(k, x) {
    return M.kareAdi(k) + ', ' + (x ? renkAdi(M.renk(x)) + (M.damaMi(x) ? ' dama' : ' taş') : 'boş');
  }
  function gunlukKaydet(durum, ozet) {
    if (window.Gunluk && typeof window.Gunluk.kaydet === 'function') window.Gunluk.kaydet('dama', { durum: durum, ozet: ozet || '' });
  }

  // ---------- Tahta çizimi ----------
  function tasSvg(x, sinif) {
    return '<svg class="' + (sinif || 'tas') + ' ' + (M.renk(x) ? 'ts' : 'tb') + '" viewBox="0 0 45 45" aria-hidden="true">' +
      '<circle class="dis" cx="22.5" cy="22.5" r="19"/><circle class="ic" cx="22.5" cy="22.5" r="13"/>' +
      (M.damaMi(x) ? '<path class="tac" d="M14.5 29L12.5 15.5 18.5 21 22.5 13 26.5 21 32.5 15.5 30.5 29z"/>' : '') + '</svg>';
  }
  function zorunluMu() { return s.tum.length > 0 && s.tum[0].yen.length > 0; }
  function ciz(anim) {
    var p = s.oyun.konum;
    s.tum = benimSiram() ? M.hamleler(p) : [];
    var oynar = {}, zorunlu = {}, hedef = {}, adimNo = {};
    s.tum.forEach(function (m) { oynar[m.de] = true; if (m.yen.length) zorunlu[m.de] = true; });
    if (s.secili >= 0) s.adaylar.forEach(function (m) { hedef[m.yol[s.adim]] = m.yen.length > 0; });
    s.yol.forEach(function (k, i) { adimNo[k] = i + 1; });
    var sonDen = s.sonHamle ? s.sonHamle.de : -1, sonHd = s.sonHamle ? s.sonHamle.yol[s.sonHamle.yol.length - 1] : -1;
    var odak = s.odak >= 0 ? s.odak : (s.secili >= 0 ? s.secili : (s.ben === ACIK ? 8 + 4 : 48 + 3));
    var h = '';
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        var r = s.ben === ACIK ? 7 - i : i, c = s.ben === ACIK ? j : 7 - j, k = r * 8 + c, x = p.t[k];
        var sn = 'kare ' + (((r + c) & 1) ? 'acik' : 'koyu');
        if (k === sonDen || k === sonHd) sn += ' son';
        if (k === s.secili) sn += ' secili';
        if (hedef[k] !== undefined) sn += ' hedef' + (hedef[k] ? ' yeme' : '');
        if (s.ipucuKare === k) sn += ' ipucu-kaynak';
        var zor = zorunlu[k] && s.secili < 0;
        if (zor) sn += ' zorunlu';
        if (benimSiram() && (oynar[k] || hedef[k] !== undefined)) sn += ' oynar';
        var etiket = kareEtiket(k, x) + (hedef[k] !== undefined ? (hedef[k] ? ', yeme durağı' : ', hedef') : '') + (zor ? ', yeme zorunlu' : '');
        h += '<button type="button" class="' + sn + '" data-k="' + k + '" aria-label="' + etiket + '" tabindex="' + (k === odak ? 0 : -1) + '"' +
          (k === s.secili ? ' aria-pressed="true"' : '') + '>';
        if (j === 0) h += '<span class="koordinat sira" aria-hidden="true">' + (r + 1) + '</span>';
        if (i === 7) h += '<span class="koordinat sutun" aria-hidden="true">' + 'abcdefgh'.charAt(c) + '</span>';
        if (x) h += tasSvg(x);
        if (zor) h += '<span class="rozet" aria-hidden="true">!</span>';
        if (adimNo[k]) h += '<span class="adim" aria-hidden="true">' + adimNo[k] + '</span>';
        h += '</button>';
      }
    }
    tahtaEl.innerHTML = h;
    if (anim && !azHareket) hareketlendir(anim);
    seritYaz();
    yanPanel();
  }
  function seritYaz() {
    var goster = benimSiram() && zorunluMu();
    seritEl.hidden = !goster;
    if (!goster) { seritEl.textContent = '\u00a0'; return; }
    var coklu = s.tum.some(function (m) { return m.yen.length > 1; });
    seritEl.className = 'serit';
    seritEl.textContent = 'Yemek zorunlu' + (coklu ? ' · en çok yiyen yol' : '') + (s.secili >= 0 && s.adaylar.length > 1 && s.adim ? ' · sıradaki durağa dokun' : '');
  }
  function hareketlendir(a) {
    var boyut = tahtaEl.clientWidth / 8, kutu = tahtaEl.parentNode;
    var son = a.m.yol[a.m.yol.length - 1];
    var el = tahtaEl.querySelector('.kare[data-k="' + son + '"] .tas');
    var adim = Math.min(160, 560 / a.m.yol.length);
    if (el && el.animate) {
      var gs = gorunum(son), anaht = [], noktalar = [a.m.de].concat(a.m.yol);
      noktalar.forEach(function (k) {
        var g = gorunum(k);
        anaht.push({ transform: 'translate(' + (g.c - gs.c) * boyut + 'px,' + (g.r - gs.r) * boyut + 'px)' });
      });
      el.style.zIndex = 4;
      el.animate(anaht, { duration: adim * a.m.yol.length, easing: 'ease-in-out' });
    }
    // yenen taşlar kısa süre hayalet olarak solar
    a.m.yen.forEach(function (k, i) {
      var x = a.once[k];
      if (!x) return;
      var g = gorunum(k), div = document.createElement('div');
      div.className = 'hayalet';
      div.style.cssText = 'left:' + g.c * boyut + 'px;top:' + g.r * boyut + 'px;width:' + boyut + 'px;height:' + boyut + 'px';
      div.innerHTML = tasSvg(x);
      kutu.appendChild(div);
      var bekleme = adim * (i + 1) * 0.9;
      if (div.animate) {
        var an = div.animate([{ opacity: 1 }, { opacity: 1, offset: 0.001 }, { opacity: 0 }], { duration: bekleme + 260, delay: 0, fill: 'forwards' });
        an.onfinish = function () { div.remove(); };
      } else setTimeout(function () { div.remove(); }, bekleme + 260);
    });
  }

  // ---------- Yan bilgiler ----------
  function yenenTaslar(renk) { // renk: yenen taşların rengi
    var say = M.say(s.oyun.konum), eksik;
    if (s.mod === 'bulmaca') return 0;
    eksik = 16 - (renk === ACIK ? say.bt + say.bd : say.st + say.sd);
    return Math.max(0, eksik);
  }
  function yenenYaz() {
    function yaz(el, renk) {
      var n = yenenTaslar(renk), h = '';
      for (var i = 0; i < Math.min(n, 16); i++) h += tasSvg(renk === ACIK ? 1 : 3, 'tas');
      el.innerHTML = h + (n ? '<b>' + n + '</b>' : '');
      el.querySelectorAll('svg').forEach(function (e) { e.style.cssText = 'position:static;width:14px;height:14px;margin-right:-3px'; });
    }
    yaz($('alt-yenen'), 1 - s.ben);
    yaz($('ust-yenen'), s.ben);
  }
  function adlariYaz() {
    if (s.mod === 'bulmaca') { $('ust-ad').textContent = 'Rakip'; $('alt-ad').textContent = 'Sen · Açık'; }
    else {
      $('ust-ad').textContent = 'Bilgisayar · ' + SEVIYE_AD[s.seviye];
      $('alt-ad').textContent = 'Sen · ' + (s.ben === ACIK ? 'Açık' : 'Koyu');
    }
    $('yan-seviye').textContent = s.mod === 'bulmaca' ? 'Bulmaca' : SEVIYE_AD[s.seviye];
    document.querySelectorAll('#seviye-segment button').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.dataset.seviye) === s.seviye ? 'true' : 'false'); });
    $('bulmaca-sekme').setAttribute('aria-pressed', s.mod === 'bulmaca' ? 'true' : 'false');
  }
  function yanPanel() {
    yenenYaz();
    var l = s.oyun.hamleler, h = '';
    for (var i = 0; i < l.length; i += 2) {
      h += '<li><span class="no">' + (i / 2 + 1) + '.</span><span' + (i === l.length - 1 ? ' class="son-hamle"' : '') + '>' + M.hamleYaz(l[i]) + '</span>' +
        (l[i + 1] ? '<span' + (i + 1 === l.length - 1 ? ' class="son-hamle"' : '') + '>' + M.hamleYaz(l[i + 1]) + '</span>' : '<span></span>') + '</li>';
    }
    $('hamle-listesi').innerHTML = h;
    var liste = $('hamle-listesi'); liste.scrollTop = liste.scrollHeight;
    $('hamle-sayi').textContent = Math.ceil(l.length / 2);
    $('geri-al').disabled = !(s.mod === 'bilgisayar' && kullaniciHamleSayisi() > 0 && !s.bekle);
    $('sure').hidden = s.mod === 'bulmaca';
  }
  function kullaniciHamleSayisi() {
    var n = s.oyun.hamleler.length;
    return s.ben === ACIK ? Math.ceil(n / 2) : Math.floor(n / 2);
  }

  // ---------- İstatistik ve özet ----------
  function istatistik() { return Object.assign({ oyun: 0, kazan: 0, bera: 0, gseri: 0 }, Depo.oku(IST, null) || {}); }
  function bulmacaKayit() {
    var b = Object.assign({ gun: '', cozuldu: false, deneme: 0, seri: 0, son: '', cozulen: 0 }, Depo.oku(BUL, null) || {});
    if (b.gun !== bugun()) { b.gun = bugun(); b.cozuldu = false; b.deneme = 0; }
    return b;
  }
  function ozetYazGenel() {
    var i = istatistik(), b = bulmacaKayit(), metin = '';
    var seriGecerli = b.son === bugun() || b.son === dun();
    if (seriGecerli && b.seri > 1) metin = 'Bulmaca serisi ' + b.seri;
    else if (i.kazan) metin = i.kazan + ' galibiyet';
    Depo.ozetYaz('dama', metin);
  }

  // ---------- Kayıt / devam ----------
  function kaydet() {
    if (s.mod !== 'bilgisayar') return;
    if (s.bitti || !s.oyun.hamleler.length) { Depo.yaz(KAYIT, null); return; }
    Depo.yaz(KAYIT, { ben: s.ben, seviye: s.seviye, sure: s.sure, hamleler: s.oyun.hamleler.map(function (m) { return [m.de, m.yol]; }) });
  }
  function devamEt() {
    var k = Depo.oku(KAYIT, null);
    if (!k || !Array.isArray(k.hamleler) || !k.hamleler.length) return false;
    var o = new M.Oyun();
    for (var i = 0; i < k.hamleler.length; i++) {
      var m = M.hamleBul(o.konum, k.hamleler[i][0], k.hamleler[i][1]);
      if (!m) { Depo.yaz(KAYIT, null); return false; }
      o.yap(m);
    }
    if (o.durum().bitti) { Depo.yaz(KAYIT, null); return false; }
    s.mod = 'bilgisayar'; s.oyun = o; s.ben = k.ben === KOYU ? KOYU : ACIK; s.seviye = SEVIYE_AD[k.seviye] ? k.seviye : 2;
    s.sure = k.sure || 0; s.sayildi = o.hamleler.length > 0; s.bitti = false; s.bekle = false;
    s.sonHamle = o.hamleler.length ? o.hamleler[o.hamleler.length - 1] : null;
    return true;
  }

  // ---------- Oyun akışı ----------
  function sifirlaSecim() { s.secili = -1; s.adim = 0; s.yol = []; s.adaylar = []; s.ipucuKare = -1; }
  function yeniOyun(renkSecimi) {
    s.no++;
    var r = renkSecimi === 'rastgele' ? (Math.random() < 0.5 ? 'acik' : 'koyu') : renkSecimi;
    s.mod = 'bilgisayar'; s.ben = r === 'koyu' ? KOYU : ACIK;
    s.oyun = new M.Oyun(); s.sure = 0; s.bitti = false; s.bekle = false; s.sayildi = false; s.sonHamle = null; s.odak = -1;
    sifirlaSecim();
    $('devam-bilgi').hidden = true; damgaEl.hidden = true; seritEl.hidden = true;
    Depo.yaz(KAYIT, null);
    adlariYaz(); durumYaz(s.ben === ACIK ? 'Sıra sende. Bir taşa dokun.' : 'Bilgisayar açıyor…');
    ciz();
    siraKontrol();
  }
  function siraKontrol() {
    if (s.bitti) return;
    if (s.mod === 'bilgisayar' && s.oyun.konum.sira !== s.ben) bilgisayarOyna();
    else if (s.mod === 'bilgisayar') durumYaz(zorunluMu() ? 'Sıra sende. Yemek zorunlu.' : 'Sıra sende.');
  }
  function oynaHamle(m) {
    var once = new Int8Array(s.oyun.konum.t);
    s.oyun.yap(m);
    s.sonHamle = m; s.sayildi = true;
    sifirlaSecim();
    if (s.mod === 'bulmaca') { ciz({ m: m, once: once }); bulmacaHamlesiSonrasi(m); return; }
    ciz({ m: m, once: once });
    kaydet();
    var d = s.oyun.durum();
    if (d.bitti) bitir(d); else siraKontrol();
  }

  // Bilgisayar: Worker'da arama, çalışmazsa ana iş parçacığında zaman sınırlı
  var worker = null, workerHata = false;
  function workerAl() {
    if (worker || workerHata || !window.Worker) return worker;
    try {
      worker = new Worker('isci.js');
      worker.onmessage = function (e) { bekleyenCevap(e.data); };
      worker.onerror = function () { workerHata = true; worker = null; if (bekleyen) { var b = bekleyen; bekleyen = null; anaIsParcacigi(b); } };
    } catch (e) { workerHata = true; worker = null; }
    return worker;
  }
  var bekleyen = null;
  function bekleyenCevap(c) {
    if (!bekleyen || c.no !== bekleyen.no) return;
    var b = bekleyen; bekleyen = null;
    b.cevap(c.hamle);
  }
  function anaIsParcacigi(b) {
    setTimeout(function () {
      var m = null;
      try { m = M.bilgisayarHamlesi(new M.Oyun(M.diziden(b.t, b.sira)), b.seviye, Math.random); } catch (e) { m = null; }
      b.cevap(m ? { de: m.de, yol: m.yol } : null);
    }, 30);
  }
  function hamleIste(seviye, cevap) {
    var p = s.oyun.konum;
    var b = { no: ++s.no, t: M.diziye(p), sira: p.sira, sayac: p.sayac, seviye: seviye, cevap: cevap };
    bekleyen = b;
    var w = workerAl();
    if (w) { try { w.postMessage({ no: b.no, t: b.t, sira: b.sira, sayac: b.sayac, seviye: seviye }); } catch (e) { workerHata = true; worker = null; anaIsParcacigi(b); } }
    else anaIsParcacigi(b);
  }
  function bilgisayarOyna() {
    s.bekle = true;
    durumYaz('Bilgisayar düşünüyor…');
    $('dusunuyor').hidden = false;
    var oyun = s.oyun, bas = Date.now(), no = s.no + 1;
    ciz();
    hamleIste(s.seviye, function (c) {
      var bekle = Math.max(0, 450 - (Date.now() - bas));
      setTimeout(function () {
        if (s.oyun !== oyun || s.no !== no || s.bitti) return;
        $('dusunuyor').hidden = true;
        s.bekle = false;
        var m = c && M.hamleBul(oyun.konum, c.de, c.yol);
        if (!m) { var l = M.hamleler(oyun.konum); m = l[Math.floor(Math.random() * l.length)]; }
        durumYaz('');
        oynaHamle(m);
      }, bekle);
    });
  }

  // ---------- Seçim ve hamle girişi ----------
  function oynayabilen(k) { return s.tum.some(function (m) { return m.de === k; }); }
  function sec(k) {
    s.secili = k; s.adim = 0; s.yol = []; s.adaylar = s.tum.filter(function (m) { return m.de === k; }); s.ipucuKare = -1; s.odak = k;
    durumYaz(s.adaylar[0].yen.length ? 'Yeme yolunu seç: duraklara sırayla dokun.' : '');
    ciz();
  }
  function salla() {
    if (azHareket) return;
    tahtaEl.classList.remove('sallanma'); void tahtaEl.offsetWidth; tahtaEl.classList.add('sallanma');
  }
  function kareTikla(k) {
    if (!benimSiram()) return;
    s.odak = k;
    if (s.secili >= 0) {
      var es = s.adaylar.filter(function (m) { return m.yol[s.adim] === k; });
      if (es.length) {
        s.yol.push(k); s.adim++; s.adaylar = es;
        var tam = es.filter(function (m) { return m.yol.length === s.adim; });
        if (tam.length) return oynaHamle(tam[0]);
        return ciz();
      }
      var son = s.adaylar.filter(function (m) { return m.yol[m.yol.length - 1] === k; });
      if (son.length) return oynaHamle(son[0]);
      if (k === s.secili) { sifirlaSecim(); durumYaz(''); return ciz(); }
    }
    if (oynayabilen(k)) return sec(k);
    var x = s.oyun.konum.t[k];
    if (x && M.renk(x) === s.ben && zorunluMu()) { durumYaz('Yemek zorunlu: köşesinde “!” olan taşlardan biriyle ye.', 'yanlis'); salla(); }
    else if (s.secili >= 0) { sifirlaSecim(); durumYaz(''); ciz(); }
  }

  // Sürükle-bırak: taşa bas, kaydır, hedefe (durak ya da son kare) bırak
  var surukle = null;
  tahtaEl.addEventListener('pointerdown', function (e) {
    var kare = e.target.closest && e.target.closest('.kare');
    if (!kare || !benimSiram() || (e.button !== undefined && e.button > 0)) return;
    var k = Number(kare.dataset.k);
    if (oynayabilen(k)) {
      var kapat = k === s.secili && !s.adim;
      if (!kapat) sec(k);
      surukle = { k: k, x: e.clientX, y: e.clientY, aktif: false, id: e.pointerId, kapat: kapat, el: null };
    } else { e.preventDefault(); kareTikla(k); surukle = null; }
  });
  document.addEventListener('pointermove', function (e) {
    if (!surukle || e.pointerId !== surukle.id) return;
    if (!surukle.aktif && Math.hypot(e.clientX - surukle.x, e.clientY - surukle.y) > 8) {
      var tas = tahtaEl.querySelector('.kare[data-k="' + surukle.k + '"]');
      if (!tas || !tas.querySelector('.tas')) return;
      surukle.aktif = true;
      var el = document.createElement('div');
      el.className = 'surukle-tas';
      el.innerHTML = tasSvg(s.oyun.konum.t[surukle.k]).replace('class="tas ', 'style="width:100%;height:100%;overflow:visible" class="tas ');
      document.body.appendChild(el);
      surukle.el = el; tas.classList.add('surukleniyor');
    }
    if (surukle.aktif) { surukle.el.style.left = e.clientX + 'px'; surukle.el.style.top = e.clientY + 'px'; }
  });
  function surukleBitir(e, iptal) {
    if (!surukle || (e && e.pointerId !== surukle.id)) return;
    var sr = surukle; surukle = null;
    if (sr.el) sr.el.remove();
    var kaynak = tahtaEl.querySelector('.kare.surukleniyor');
    if (kaynak) kaynak.classList.remove('surukleniyor');
    if (iptal) return;
    if (sr.aktif && e) {
      var hedef = document.elementFromPoint(e.clientX, e.clientY), kare = hedef && hedef.closest && hedef.closest('.kare');
      if (kare && Number(kare.dataset.k) !== sr.k) kareTikla(Number(kare.dataset.k));
    } else if (sr.kapat) { kareTikla(sr.k); }
  }
  document.addEventListener('pointerup', function (e) { surukleBitir(e, false); });
  document.addEventListener('pointercancel', function (e) { surukleBitir(e, true); });
  tahtaEl.addEventListener('click', function (e) {
    var kare = e.target.closest && e.target.closest('.kare');
    if (!kare || e.detail !== 0) return; // fare/dokunma pointer olaylarından; burası klavye (Enter/Boşluk)
    kareTikla(Number(kare.dataset.k));
  });
  tahtaEl.addEventListener('keydown', function (e) {
    var kare = e.target.closest && e.target.closest('.kare');
    if (!kare) return;
    var k = Number(kare.dataset.k), g = gorunum(k), c = g.c, r = g.r;
    if (e.key === 'ArrowLeft') c--; else if (e.key === 'ArrowRight') c++; else if (e.key === 'ArrowUp') r--; else if (e.key === 'ArrowDown') r++; else return;
    e.preventDefault();
    c = Math.max(0, Math.min(7, c)); r = Math.max(0, Math.min(7, r));
    var yk = s.ben === ACIK ? (7 - r) * 8 + c : r * 8 + (7 - c);
    s.odak = yk; ciz();
    var yeni = tahtaEl.querySelector('.kare[data-k="' + yk + '"]');
    if (yeni) yeni.focus();
  });

  // ---------- Bitiş ----------
  function bitir(d) {
    s.bitti = true; s.bekle = false;
    $('dusunuyor').hidden = true;
    var kazandim = d.kazanan === s.ben, bera = d.kazanan === null;
    var i = istatistik();
    i.oyun++;
    if (kazandim) { i.kazan++; i.gseri++; } else { i.gseri = 0; if (bera) i.bera++; }
    Depo.yaz(IST, i);
    Depo.yaz(KAYIT, null);
    ozetYazGenel();
    var baslik = bera ? 'Berabere' : (kazandim ? 'Kazandın' : 'Kaybettin');
    var neden = {
      'kilit': kazandim ? 'Rakibin oynayacak hamlesi kalmadı.' : 'Oynayacak hamlen kalmadı.',
      'tas-yok': kazandim ? 'Rakibin hiç taşı kalmadı.' : 'Hiç taşın kalmadı.',
      'tekrar': 'Aynı konum üçüncü kez oluştu.',
      'hamle-siniri': 'Kırk hamledir yeme ve taş hamlesi yok.',
      'dama-dama': 'Tahtada yalnızca birer dama kaldı.'
    }[d.neden] || '';
    damgaEl.textContent = baslik;
    damgaEl.className = 'damga' + (kazandim ? '' : bera ? '' : ' kaybet');
    damgaEl.hidden = false;
    durumYaz(baslik + '. ' + neden, kazandim ? 'dogru' : (bera ? '' : 'yanlis'));
    $('sonuc-baslik').textContent = baslik;
    $('sonuc-baslik').className = kazandim || bera ? '' : 'kaybetti';
    $('sonuc-metin').textContent = neden;
    $('sonuc-ozet').textContent = Math.ceil(s.oyun.hamleler.length / 2) + ' hamle · ' + dk(s.sure) + ' · ' + SEVIYE_AD[s.seviye];
    ciz();
    setTimeout(function () { var dlg = $('sonuc'); if (dlg.showModal && !dlg.open) dlg.showModal(); }, 900);
  }

  // ---------- Günün Bulmacası ----------
  function bulmacaAc(baska) {
    s.no++;
    if (!BULMACALAR.length) return;
    var idx = M.bulmacaSirasi(bugun(), BULMACALAR.length), b = BULMACALAR[idx], kayit = bulmacaKayit();
    var p = M.diziden(b.t, 0);
    s.mod = 'bulmaca'; s.ben = ACIK; s.bitti = false; s.bekle = false; s.sayildi = false; s.sonHamle = null; s.odak = -1;
    s.oyun = new M.Oyun(p);
    s.bulmaca = { b: b, adim: 0, baslangic: p, cozuldu: kayit.cozuldu };
    sifirlaSecim();
    damgaEl.hidden = true; $('devam-bilgi').hidden = true;
    adlariYaz();
    durumYaz(kayit.cozuldu ? 'Bugünkü bulmacayı çözdün. İstersen yine dene; yarın yenisi gelir.' : 'Açık taşlarla ' + b.n + ' hamlede kazan: rakip taşsız ya da hamlesiz kalmalı.');
    seritEl.hidden = true;
    ciz();
    if (!kayit.cozuldu) gunlukKaydet('yarim', '');
  }
  function bulmacaSifirla(mesaj) {
    var b = s.bulmaca;
    s.oyun = new M.Oyun(b.baslangic); b.adim = 0; s.bekle = false; s.bitti = false; s.sonHamle = null; sifirlaSecim();
    durumYaz(mesaj || '', mesaj ? 'yanlis' : '');
    ciz();
  }
  function bulmacaHamlesiSonrasi(m) {
    var b = s.bulmaca, q = s.oyun.konum;
    if (b.adim === 0) {
      var onceki = s.oyun.gecmis[s.oyun.gecmis.length - 1];
      var rakipHamleleri = M.hamleler(q);
      if (!rakipHamleleri.length) return bulmacaCoz();   // rakip ilk hamlede bitti
      if (!M.zorlaKazandirir(onceki, m)) return bulmacaBasarisiz('Olmadı: rakibin bir cevabı seni kurtarıyor. Baştan dene.');
      s.bekle = true; durumYaz('Rakip cevap veriyor…');
      var cevap = rakipHamleleri[0];
      for (var i = 0; i < rakipHamleleri.length; i++) if (rakipHamleleri[i].yen.length > cevap.yen.length) cevap = rakipHamleleri[i];
      setTimeout(function () {
        if (s.mod !== 'bulmaca') return;
        var once = new Int8Array(s.oyun.konum.t);
        s.oyun.yap(cevap); s.sonHamle = cevap; s.bekle = false; b.adim = 1;
        durumYaz('Şimdi bitir: ikinci hamle rakibi taşsız ya da hamlesiz bırakmalı.');
        ciz({ m: cevap, once: once });
      }, 650);
    } else {
      if (!M.hamleler(q).length) return bulmacaCoz();
      bulmacaBasarisiz('Olmadı: rakip hâlâ oynayabiliyor. Baştan dene.');
    }
  }
  function bulmacaBasarisiz(metin) {
    var k = bulmacaKayit(); k.deneme++; Depo.yaz(BUL, k);
    durumYaz(metin, 'yanlis'); salla(); s.bekle = true;
    setTimeout(function () { if (s.mod === 'bulmaca') bulmacaSifirla(metin); }, 1300);
  }
  function bulmacaCoz() {
    s.bitti = true; s.bekle = false;
    var k = bulmacaKayit(), ilk = !k.cozuldu;
    if (ilk) {
      k.cozuldu = true; k.cozulen++;
      k.seri = k.son === dun() ? k.seri + 1 : 1;
      k.son = bugun();
    }
    k.deneme++;
    Depo.yaz(BUL, k);
    gunlukKaydet('bitti', k.deneme + '. denemede çözüldü' + (k.seri > 1 ? ' · seri ' + k.seri : ''));
    ozetYazGenel();
    damgaEl.textContent = 'Çözüldü'; damgaEl.className = 'damga onay'; damgaEl.hidden = false;
    durumYaz('Çözüldü! ' + (ilk ? 'Serin: ' + k.seri + ' gün.' : ''), 'dogru');
    ciz();
  }

  // ---------- Düğmeler ----------
  function geriAl() {
    if (s.mod !== 'bilgisayar' || s.bekle || kullaniciHamleSayisi() === 0) return;
    s.no++;
    while (s.oyun.hamleler.length) {
      s.oyun.geriAl();
      if (s.oyun.hamleler.length % 2 === s.ben) break;
    }
    s.bitti = false; damgaEl.hidden = true; sifirlaSecim();
    s.sonHamle = s.oyun.hamleler.length ? s.oyun.hamleler[s.oyun.hamleler.length - 1] : null;
    durumYaz('Hamlen geri alındı.');
    kaydet();
    ciz();
    siraKontrol();
  }
  function ipucuVer() {
    if (s.bitti || s.bekle) return;
    s.ipucuKare = -1;
    if (s.mod === 'bulmaca') {
      var q = s.oyun.konum, m = s.bulmaca.adim === 0 ? M.ikideKazandiranlar(q)[0] : M.birdeKazanir(q);
      if (m) { s.ipucuKare = m.de; durumYaz('İpucu: yanıp sönen taşla oyna.'); ciz(); }
      return;
    }
    if (!benimSiram()) return;
    var oyun = s.oyun;
    s.bekle = true;
    durumYaz('İpucu aranıyor…'); $('dusunuyor').hidden = false;
    hamleIste(2, function (c) {
      s.bekle = false; $('dusunuyor').hidden = true;
      if (s.oyun !== oyun || s.bitti || !c) { durumYaz(''); ciz(); return; }
      s.ipucuKare = c.de; durumYaz('İpucu: yanıp sönen taşı oynamayı dene.'); ciz();
    });
  }
  function seviyeSec(n) {
    s.seviye = n;
    Depo.yaz(TERCIH, { seviye: s.seviye, renk: s.renkTercih });
    adlariYaz();
    if (s.mod === 'bulmaca') { s.mod = 'bilgisayar'; yeniOyun(s.renkTercih); }
  }
  function yeniPencere() {
    document.querySelectorAll('#renk-secimi .buton').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.renk === s.renkTercih ? 'true' : 'false'); });
    var dlg = $('yeni-pencere');
    if (dlg.showModal) dlg.showModal(); else yeniOyun(s.renkTercih);
  }
  function istatistikAc() {
    var i = istatistik(), b = bulmacaKayit();
    $('i-oyun').textContent = i.oyun; $('i-kazan').textContent = i.kazan; $('i-bera').textContent = i.bera; $('i-gseri').textContent = i.gseri;
    $('i-seri').textContent = (b.son === bugun() || b.son === dun()) ? b.seri : 0; $('i-bulmaca').textContent = b.cozulen;
    var dlg = $('istatistik'); if (dlg.showModal) dlg.showModal();
  }

  document.querySelectorAll('#seviye-segment button').forEach(function (b) { b.addEventListener('click', function () { seviyeSec(Number(b.dataset.seviye)); }); });
  $('bulmaca-sekme').addEventListener('click', function () { if (s.mod === 'bulmaca') { yeniOyun(s.renkTercih); } else bulmacaAc(); });
  $('geri-al').addEventListener('click', geriAl);
  $('ipucu').addEventListener('click', ipucuVer);
  $('yeni-oyun').addEventListener('click', function () {
    if (s.mod === 'bulmaca') { bulmacaAc(); return; }
    yeniPencere();
  });
  document.querySelectorAll('#renk-secimi .buton').forEach(function (b) {
    b.addEventListener('click', function () {
      s.renkTercih = b.dataset.renk;
      document.querySelectorAll('#renk-secimi .buton').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    });
  });
  $('oyunu-baslat').addEventListener('click', function () {
    Depo.yaz(TERCIH, { seviye: s.seviye, renk: s.renkTercih });
    $('yeni-pencere').close();
    yeniOyun(s.renkTercih);
  });
  $('tekrar-oyna').addEventListener('click', function () { $('sonuc').close(); yeniOyun(s.renkTercih); });
  $('istatistik-ac').addEventListener('click', istatistikAc);

  // Süre sayacı: yalnızca bilgisayara karşı oyunda, sekme görünürken
  setInterval(function () {
    if (s.mod !== 'bilgisayar' || s.bitti || document.hidden || !s.sayildi) return;
    s.sure++; $('sure').textContent = dk(s.sure);
    if (s.sure % 5 === 0) kaydet();
  }, 1000);
  window.addEventListener('pagehide', function () { kaydet(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) kaydet(); });

  // ---------- Başlangıç ----------
  function basla() {
    var devam = devamEt();
    if (!devam) { s.oyun = new M.Oyun(); s.ben = s.renkTercih === 'koyu' ? KOYU : ACIK; s.sure = 0; }
    $('devam-bilgi').hidden = !devam;
    adlariYaz(); $('sure').textContent = dk(s.sure);
    durumYaz(devam ? 'Sıra ' + (s.oyun.konum.sira === s.ben ? 'sende.' : 'bilgisayarda.') : (s.ben === ACIK ? 'Sıra sende. Bir taşa dokun.' : 'Bilgisayar açıyor…'));
    ciz();
    ozetYazGenel();
    siraKontrol();
  }
  // Tarayıcı testleri için küçük kanca
  window.__dama = { get s() { return s; }, M: M, ciz: ciz, kareTikla: kareTikla, bulmacaAc: bulmacaAc, yeniOyun: yeniOyun };
  basla();
})();
